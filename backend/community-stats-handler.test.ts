import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ensureFirebaseAdminApp: vi.fn(),
  verifyIdToken: vi.fn(),
  pendingGet: vi.fn(),
  rebuildUserContribution: vi.fn(),
}))

vi.mock('./firebase-admin', () => ({
  ensureFirebaseAdminApp: mocks.ensureFirebaseAdminApp,
}))

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: mocks.verifyIdToken,
  }),
}))

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: mocks.pendingGet,
      })),
    })),
    collectionGroup: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: mocks.pendingGet,
      })),
    })),
  }),
}))

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

describe('Vercel community stats process handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.COMMUNITY_STATS_BACKEND_ENABLED = 'true'
    process.env.CRON_SECRET = 'test-cron-secret'
    mocks.verifyIdToken.mockResolvedValue({ uid: 'owner-1' })
    mocks.pendingGet.mockResolvedValue({
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

    await handleCommunityStatsProcess(
      { method: 'GET', headers: { authorization: 'Bearer test-cron-secret' } },
      output.response,
    )

    expect(output.result()).toEqual({
      statusCode: 503,
      body: { error: 'backend-not-enabled' },
    })
    expect(mocks.rebuildUserContribution).not.toHaveBeenCalled()
  })

  it('accepts an authenticated owner only when that owner has durable queued work', async () => {
    const output = responseMock()

    await handleCommunityStatsProcess(
      { method: 'POST', headers: { authorization: 'Bearer firebase-id-token' } },
      output.response,
    )

    expect(mocks.verifyIdToken).toHaveBeenCalledWith('firebase-id-token', true)
    expect(output.result().statusCode).toBe(200)
    expect(mocks.rebuildUserContribution).toHaveBeenCalledWith('owner-1')
  })

  it('rejects owner wakes without an owner-scoped outbox event', async () => {
    mocks.pendingGet.mockResolvedValue({ empty: true })
    const output = responseMock()

    await handleCommunityStatsProcess(
      { method: 'POST', headers: { authorization: 'Bearer firebase-id-token' } },
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
    const request: CommunityStatsProcessRequest = {
      method: 'GET',
      headers: { authorization: 'Bearer test-cron-secret' },
    }

    await handleCommunityStatsProcess(request, output.response)

    expect(output.result().statusCode).toBe(503)
    expect(output.result().body).toMatchObject({ status: 'failed', shouldRetry: true })
  })

  it('quarantines a poison owner and continues bounded recovery with a healthy owner', async () => {
    mocks.pendingGet.mockResolvedValue({
      empty: false,
      docs: [
        { ref: { path: 'users/poison-owner/communityStatsOutbox/event-1' } },
        { ref: { path: 'users/healthy-owner/communityStatsOutbox/event-2' } },
      ],
    })
    mocks.rebuildUserContribution
      .mockResolvedValueOnce({
        status: 'failed',
        failureKind: 'poison',
        refreshState: 'failed',
        shouldRetry: false,
      })
      .mockResolvedValueOnce({
        status: 'published',
        refreshState: 'failed',
        pendingOutboxCount: 0,
      })
    const output = responseMock()

    await handleCommunityStatsProcess({
      method: 'GET',
      headers: { authorization: 'Bearer test-cron-secret' },
    }, output.response)

    expect(mocks.rebuildUserContribution.mock.calls).toEqual([
      ['poison-owner'],
      ['healthy-owner'],
    ])
    expect(output.result()).toMatchObject({
      statusCode: 200,
      body: {
        status: 'recovered',
        results: [
          { ownerUid: 'poison-owner', failureKind: 'poison', shouldRetry: false },
          { ownerUid: 'healthy-owner', status: 'published' },
        ],
      },
    })
  })

  it('does not repeat acknowledged poison work when recovery is invoked again', async () => {
    mocks.pendingGet
      .mockResolvedValueOnce({
        empty: false,
        docs: [{ ref: { path: 'users/poison-owner/communityStatsOutbox/event-1' } }],
      })
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({ empty: true, docs: [] })
    mocks.rebuildUserContribution.mockResolvedValueOnce({
      status: 'failed',
      failureKind: 'poison',
      refreshState: 'failed',
      shouldRetry: false,
    })

    const first = responseMock()
    await handleCommunityStatsProcess({
      method: 'GET',
      headers: { authorization: 'Bearer test-cron-secret' },
    }, first.response)
    const second = responseMock()
    await handleCommunityStatsProcess({
      method: 'GET',
      headers: { authorization: 'Bearer test-cron-secret' },
    }, second.response)

    expect(mocks.rebuildUserContribution).toHaveBeenCalledTimes(1)
    expect(second.result()).toEqual({
      statusCode: 200,
      body: { status: 'skipped', skipReason: 'no-pending-work' },
    })
  })
})
