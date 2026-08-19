import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Timestamp {
    constructor(private readonly millis: number) {}

    static fromMillis(millis: number) {
      return new Timestamp(millis)
    }

    toMillis() {
      return this.millis
    }
  }

  return {
    DELETE_FIELD: Symbol('delete-field'),
    Timestamp,
    ensureFirebaseAdminApp: vi.fn(),
    verifyIdToken: vi.fn(),
    ownerPendingGet: vi.fn(),
    rebuildUserContribution: vi.fn(),
    recoveryDocs: [] as Array<{ ref: { path: string } }>,
    recoveryQueryCursors: [] as Array<string | null>,
    cursorState: {} as Record<string, unknown>,
  }
})

vi.mock('./firebase-admin', () => ({
  ensureFirebaseAdminApp: mocks.ensureFirebaseAdminApp,
}))

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: mocks.verifyIdToken,
  }),
}))

vi.mock('firebase-admin/firestore', () => {
  const applyCursorWrite = (value: Record<string, unknown>) => {
    for (const [key, fieldValue] of Object.entries(value)) {
      if (fieldValue === mocks.DELETE_FIELD) delete mocks.cursorState[key]
      else mocks.cursorState[key] = fieldValue
    }
  }
  const recoveryQuery = (cursor: string | null = null) => ({
    startAfter: (nextCursor: string) => recoveryQuery(nextCursor),
    limit: (count: number) => ({
      get: async () => {
        mocks.recoveryQueryCursors.push(cursor)
        const docs = mocks.recoveryDocs
          .filter((entry) => !cursor || entry.ref.path > cursor)
          .slice(0, count)
        return { empty: docs.length === 0, docs }
      },
    }),
  })
  const cursorRef = { path: 'community-stats-internal/recovery-cursor' }
  return {
    FieldPath: { documentId: () => '__name__' },
    FieldValue: { delete: () => mocks.DELETE_FIELD },
    Timestamp: mocks.Timestamp,
    getFirestore: () => ({
      collection: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: mocks.ownerPendingGet,
        })),
      })),
      collectionGroup: vi.fn(() => ({
        orderBy: vi.fn(() => recoveryQuery()),
      })),
      doc: vi.fn(() => cursorRef),
      runTransaction: async (
        callback: (transaction: {
          get: () => Promise<{ data: () => Record<string, unknown> }>
          set: (_ref: unknown, value: Record<string, unknown>) => void
        }) => Promise<unknown>,
      ) => callback({
        get: async () => ({ data: () => ({ ...mocks.cursorState }) }),
        set: (_ref, value) => applyCursorWrite(value),
      }),
    }),
  }
})

vi.mock('./community-stats-contributions', () => ({
  COMMUNITY_STATS_OUTBOX_COLLECTION: 'communityStatsOutbox',
  rebuildUserContribution: mocks.rebuildUserContribution,
}))

import {
  handleCommunityStatsProcess,
  type CommunityStatsProcessRequest,
} from './community-stats-handler'

function responseMock() {
  let statusCode = 200
  let body: unknown
  return {
    response: {
      status(code: number) {
        statusCode = code
        return this
      },
      setHeader: vi.fn(),
      json(value: unknown) {
        body = value
      },
    },
    result: () => ({ statusCode, body }),
  }
}

function recoveryRequest(): CommunityStatsProcessRequest {
  return {
    method: 'GET',
    headers: { authorization: ['Bearer', 'test-cron-secret'].join(' ') },
  }
}

function ownerRequest(): CommunityStatsProcessRequest {
  return {
    method: 'POST',
    headers: { authorization: ['Bearer', 'firebase-id-token'].join(' ') },
  }
}

describe('Vercel community stats process handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.COMMUNITY_STATS_BACKEND_ENABLED = 'true'
    process.env.CRON_SECRET = 'test-cron-secret'
    mocks.cursorState = {}
    mocks.recoveryDocs = [
      { ref: { path: 'users/owner-1/communityStatsOutbox/event-1' } },
    ]
    mocks.recoveryQueryCursors = []
    mocks.verifyIdToken.mockResolvedValue({ uid: 'owner-1' })
    mocks.ownerPendingGet.mockResolvedValue({
      empty: false,
      docs: [{ ref: { path: 'users/owner-1/communityStatsOutbox/event-1' } }],
    })
    mocks.rebuildUserContribution.mockResolvedValue({
      status: 'published',
      refreshState: 'ready',
      pendingOutboxCount: 0,
    })
  })

  it('requires the explicit backend readiness gate', async () => {
    process.env.COMMUNITY_STATS_BACKEND_ENABLED = 'false'
    const output = responseMock()

    await handleCommunityStatsProcess(recoveryRequest(), output.response)

    expect(output.result()).toEqual({
      statusCode: 503,
      body: { error: 'backend-not-enabled' },
    })
    expect(mocks.rebuildUserContribution).not.toHaveBeenCalled()
  })

  it('accepts an authenticated owner only when that owner has durable queued work', async () => {
    const output = responseMock()

    await handleCommunityStatsProcess(
      ownerRequest(),
      output.response,
    )

    expect(mocks.verifyIdToken).toHaveBeenCalledWith('firebase-id-token', true)
    expect(output.result().statusCode).toBe(200)
    expect(mocks.rebuildUserContribution).toHaveBeenCalledWith('owner-1')
  })

  it('rejects owner wakes without an owner-scoped outbox event', async () => {
    mocks.ownerPendingGet.mockResolvedValue({ empty: true })
    const output = responseMock()

    await handleCommunityStatsProcess(
      ownerRequest(),
      output.response,
    )

    expect(output.result().statusCode).toBe(401)
    expect(mocks.rebuildUserContribution).not.toHaveBeenCalled()
  })

  it('uses the Vercel cron secret for daily recovery and reports retryable failures', async () => {
    mocks.rebuildUserContribution.mockResolvedValue({
      status: 'failed',
      failureKind: 'transient',
      shouldRetry: true,
      pendingOutboxCount: 1,
    })
    const output = responseMock()

    await handleCommunityStatsProcess(recoveryRequest(), output.response)

    expect(output.result().statusCode).toBe(503)
    expect(output.result().body).toMatchObject({ status: 'failed', shouldRetry: true })
    expect(mocks.cursorState.afterPath).toBeUndefined()
  })

  it('persists bounded progress past more than 50 poison events to reach healthy work', async () => {
    mocks.recoveryDocs = [
      ...Array.from({ length: 55 }, (_, index) => ({
        ref: {
          path: `users/aaa-poison/communityStatsOutbox/event-${String(index).padStart(3, '0')}`,
        },
      })),
      { ref: { path: 'users/zzz-healthy/communityStatsOutbox/event-healthy' } },
    ]
    mocks.rebuildUserContribution.mockImplementation(async (ownerUid: string) =>
      ownerUid === 'aaa-poison'
        ? {
            status: 'failed',
            failureKind: 'poison',
            refreshState: 'failed',
            shouldRetry: false,
          }
        : {
            status: 'published',
            refreshState: 'ready',
            pendingOutboxCount: 0,
          })

    const first = responseMock()
    await handleCommunityStatsProcess(recoveryRequest(), first.response)
    const second = responseMock()
    await handleCommunityStatsProcess(recoveryRequest(), second.response)

    expect(mocks.rebuildUserContribution.mock.calls).toEqual([
      ['aaa-poison'],
      ['aaa-poison'],
      ['zzz-healthy'],
    ])
    expect(mocks.recoveryQueryCursors).toEqual([
      null,
      'users/aaa-poison/communityStatsOutbox/event-049',
    ])
    expect(mocks.cursorState.afterPath).toBe(
      'users/zzz-healthy/communityStatsOutbox/event-healthy',
    )
    expect(second.result()).toMatchObject({
      statusCode: 200,
      body: {
        status: 'recovered',
        results: [
          { ownerUid: 'aaa-poison', failureKind: 'poison' },
          { ownerUid: 'zzz-healthy', status: 'published' },
        ],
      },
    })
  })

  it('wraps a persisted cursor and advances from the beginning', async () => {
    mocks.cursorState.afterPath = 'users/zzz/communityStatsOutbox/event-z'
    const output = responseMock()

    await handleCommunityStatsProcess(recoveryRequest(), output.response)

    expect(mocks.recoveryQueryCursors).toEqual([
      'users/zzz/communityStatsOutbox/event-z',
      null,
    ])
    expect(mocks.rebuildUserContribution).toHaveBeenCalledWith('owner-1')
    expect(mocks.cursorState.afterPath).toBe(
      'users/owner-1/communityStatsOutbox/event-1',
    )
  })

  it('serializes concurrent recovery invocations with a private cursor lease', async () => {
    mocks.cursorState = {
      leaseId: 'active-recovery',
      leaseExpiresAt: mocks.Timestamp.fromMillis(Date.now() + 60_000),
      afterPath: 'users/owner-0/communityStatsOutbox/event-1',
    }
    const output = responseMock()

    await handleCommunityStatsProcess(recoveryRequest(), output.response)

    expect(output.result()).toEqual({
      statusCode: 202,
      body: {
        status: 'skipped',
        skipReason: 'lease-active',
        shouldRetry: true,
      },
    })
    expect(mocks.rebuildUserContribution).not.toHaveBeenCalled()
  })
})
