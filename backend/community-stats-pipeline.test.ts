import { beforeEach, describe, expect, it, vi } from 'vitest'

import { COMMUNITY_STATS_SCHEMA_VERSION } from '../src/lib/community-stats-core'
import type { CampaignRun, Playthrough } from '../src/lib/types'

const store = new Map<string, Record<string, unknown>>()
const readCounts = {
  campaignRuns: 0,
  outbox: 0,
  playthroughs: 0,
  users: 0,
}
let transactionChain: Promise<void> = Promise.resolve()
let queryReadTimeMs = 1_000

const firestoreAdminMocks = vi.hoisted(() => ({
  FieldValue: {
    delete: vi.fn(() => ({ __op: 'delete' as const })),
  },
  Timestamp: {
    fromMillis: vi.fn((ms: number) => ms),
  },
  getApps: vi.fn(() => [{}]),
  getFirestore: vi.fn(),
  initializeApp: vi.fn(),
}))

vi.mock('firebase-admin/app', () => ({
  getApps: firestoreAdminMocks.getApps,
  initializeApp: firestoreAdminMocks.initializeApp,
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: firestoreAdminMocks.FieldValue,
  Timestamp: firestoreAdminMocks.Timestamp,
  getFirestore: firestoreAdminMocks.getFirestore,
}))

function clone<T>(value: T): T {
  return structuredClone(value)
}

function docPath(...segments: string[]): string {
  return segments.join('/')
}

function withoutId<T extends { id: string }>(value: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = value
  return rest
}

function isFieldOp(value: unknown): value is { __op: 'delete' } {
  return Boolean(
    value &&
    typeof value === 'object' &&
    '__op' in value &&
    (value as { __op?: unknown }).__op === 'delete',
  )
}

function applyPatch(path: string, patch: Record<string, unknown>, merge: boolean): void {
  const base = merge ? clone(store.get(path) ?? {}) : {}
  for (const [key, value] of Object.entries(patch)) {
    if (isFieldOp(value)) {
      delete base[key]
      continue
    }
    base[key] = clone(value)
  }
  store.set(path, base)
}

type FakeQuery = {
  __kind: 'collection' | 'collectionGroup'
  collectionId: string
  limitCount?: number
  limit: (count: number) => FakeQuery
}

function makeQuery(kind: FakeQuery['__kind'], collectionId: string, limitCount?: number): FakeQuery {
  return {
    __kind: kind,
    collectionId,
    limitCount,
    limit: (count: number) => makeQuery(kind, collectionId, count),
  }
}

function docsForQuery(query: FakeQuery) {
  if (query.__kind === 'collection' && query.collectionId === 'users') {
    const docs = Array.from(store.entries())
      .filter(([path]) => {
        const segments = path.split('/')
        return segments.length === 2 && segments[0] === 'users'
      })
      .map(([path, data]) => ({
        id: path.split('/')[1],
        ref: { path },
        data: () => clone(data),
      }))
    return query.limitCount ? docs.slice(0, query.limitCount) : docs
  }

  const docs = Array.from(store.entries())
    .filter(([path]) => {
      const segments = path.split('/')
      return segments.length >= 2 && segments[segments.length - 2] === query.collectionId
    })
    .map(([path, data]) => ({
      id: path.split('/').at(-1) ?? '',
      ref: { path },
      data: () => clone(data),
    }))
    .sort((left, right) => left.ref.path.localeCompare(right.ref.path))
  return query.limitCount ? docs.slice(0, query.limitCount) : docs
}

function querySnapshot(query: FakeQuery) {
  if (query.collectionId === 'playthroughs') readCounts.playthroughs++
  if (query.collectionId === 'campaignRuns') readCounts.campaignRuns++
  if (query.collectionId === 'communityStatsOutbox') readCounts.outbox++
  if (query.__kind === 'collection' && query.collectionId === 'users') readCounts.users++
  return {
    size: docsForQuery(query).length,
    docs: docsForQuery(query),
    readTime: {
      toMillis: () => queryReadTimeMs,
    },
  }
}

const fakeDb = {
  collection: (collectionId: string) => makeQuery('collection', collectionId),
  collectionGroup: (collectionId: string) => makeQuery('collectionGroup', collectionId),
  doc: (path: string) => ({
    id: path.split('/').at(-1) ?? '',
    path,
    get: async () => {
      const value = store.get(path)
      return {
        exists: value !== undefined,
        data: () => clone(value),
      }
    },
    set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      applyPatch(path, data, options?.merge === true)
    },
  }),
  runTransaction: async <T>(
    callback: (transaction: {
      get: (refOrQuery: { path: string } | FakeQuery) => Promise<unknown>
      set: (ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => void
      delete: (ref: { path: string }) => void
    }) => Promise<T>,
  ) => {
    const run = async () => {
      const pending: Array<() => void> = []
      let hasWritten = false
      let writeCount = 0
      const transaction = {
        get: async (refOrQuery: { path: string } | FakeQuery) => {
          if (hasWritten) {
            throw new Error('Firestore transactions require all reads to happen before writes.')
          }
          if ('path' in refOrQuery) {
            const value = store.get(refOrQuery.path)
            return {
              exists: value !== undefined,
              data: () => clone(value),
            }
          }
          return querySnapshot(refOrQuery)
        },
        set: (ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => {
          hasWritten = true
          writeCount++
          if (writeCount > 500) {
            throw new Error('Firestore transactions support at most 500 writes.')
          }
          pending.push(() => applyPatch(ref.path, data, options?.merge === true))
        },
        delete: (ref: { path: string }) => {
          hasWritten = true
          writeCount++
          if (writeCount > 500) {
            throw new Error('Firestore transactions support at most 500 writes.')
          }
          pending.push(() => store.delete(ref.path))
        },
      }

      const result = await callback(transaction)
      for (const operation of pending) operation()
      return result
    }

    const chained = transactionChain.then(run)
    transactionChain = chained.then(() => undefined, () => undefined)
    return chained
  },
}

vi.mocked(firestoreAdminMocks.getFirestore).mockImplementation(() => fakeDb as never)

function makePlaythrough(id: string, overrides: Partial<Playthrough> = {}): Playthrough {
  return {
    id,
    date: '2026-08-18',
    campaignName: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    investigators: [
      {
        playerName: 'Alice',
        investigatorName: 'Roland Banks',
        archetype: 'Guardian',
      },
    ],
    ...overrides,
  }
}

function makeCampaignRun(id: string, overrides: Partial<CampaignRun> = {}): CampaignRun {
  return {
    id,
    version: 2,
    campaignLineageId: 'campaign:path-to-carcosa',
    campaignName: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    startedAt: '2026-08-18',
    updatedAt: '2026-08-18T00:00:00.000Z',
    status: 'active',
    sourcePlaythroughId: 'source-1',
    setupSnapshot: {
      date: '2026-08-18',
      investigators: makePlaythrough('seed').investigators,
    },
    scenarioLogs: [
      {
        id: 'scenario-1',
        date: '2026-08-19',
        scenarioName: 'Curtain Call',
        investigators: makePlaythrough('seed').investigators,
      },
    ],
    ...overrides,
  }
}

function seedUser(uid: string): void {
  store.set(docPath('users', uid), {
    displayName: uid,
  })
}

function seedPlaythrough(uid: string, playthrough: Playthrough): void {
  store.set(
    docPath('users', uid, 'playthroughs', playthrough.id),
    clone(withoutId(playthrough)) as Record<string, unknown>,
  )
}

function seedCampaignRun(uid: string, campaignRun: CampaignRun): void {
  store.set(
    docPath('users', uid, 'campaignRuns', campaignRun.id),
    clone(withoutId(campaignRun)) as Record<string, unknown>,
  )
}

function seedClientOutboxEntry(
  uid: string,
  mutationId: string,
  requestedAtMs: number,
  overrides: Partial<Record<string, unknown>> = {},
): void {
  store.set(docPath('users', uid, 'communityStatsOutbox', mutationId), {
    mutationId,
    requestedAtMs,
    requestedBy: 'client',
    reason: 'playthrough-write',
    affectedDocuments: 1,
    ...clone(overrides),
  })
}

function seedBootstrapMarker(markerId: string, requestedAtMs: number): void {
  store.set(docPath('community-stats-system', 'system', 'communityStatsOutbox', markerId), {
    mutationId: markerId,
    requestedAtMs,
    requestedBy: 'bootstrap',
    reason: 'bootstrap',
    affectedDocuments: 0,
    bootstrapMarkerId: markerId,
  })
}

function completedBootstrapMarker(markerId: string, requestedAtMs: number, completedAtMs: number) {
  return {
    markerId,
    requestedAtMs,
    completedAtMs,
  }
}

function maxLengthBootstrapMarkerId(seed: string): string {
  const prefix = `bootstrap-${seed}-`
  return `${prefix}${'a'.repeat(COMMUNITY_STATS_BOOTSTRAP_MARKER_ID_MAX_CHARS - prefix.length)}`
}

async function readAggregate() {
  return clone(store.get('community-stats/global'))
}

async function readState() {
  return clone(store.get('community-stats-internal/state'))
}

function outboxPaths(): string[] {
  return Array.from(store.keys())
    .filter((path) => path.endsWith('/communityStatsOutbox') === false && path.includes('/communityStatsOutbox/'))
    .sort()
}

function readOutboxEntries() {
  return outboxPaths().map((path) => ({
    path,
    data: clone(store.get(path) ?? {}),
  }))
}

import {
  COMMUNITY_STATS_BOOTSTRAP_MARKER_COMPLETION_CLOCK_SKEW_MS,
  COMMUNITY_STATS_BOOTSTRAP_MARKER_ID_MAX_CHARS,
  COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS,
  COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS,
  COMMUNITY_STATS_LEASE_MS,
  claimCommunityStatsRebuild,
  loadCommunityStatsSnapshot,
  processCommunityStatsQueue,
  publishClaimedCommunityStats,
  queueCommunityStatsRebuild,
  recoverCommunityStatsQueue,
} from './community-stats-pipeline'

describe('community stats pipeline', () => {
  beforeEach(() => {
    vi.useRealTimers()
    store.clear()
    readCounts.campaignRuns = 0
    readCounts.outbox = 0
    readCounts.playthroughs = 0
    readCounts.users = 0
    queryReadTimeMs = 1_000
    transactionChain = Promise.resolve()
    vi.clearAllMocks()
    vi.mocked(firestoreAdminMocks.getApps).mockReturnValue([{}] as never)
    vi.mocked(firestoreAdminMocks.getFirestore).mockImplementation(() => fakeDb as never)
  })

  it('publishes a current-schema aggregate from a queued outbox event', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))

    await queueCommunityStatsRebuild({
      ownerUid: 'u1',
      mutationId: 'event-1',
      reason: 'playthrough-write',
    })
    queryReadTimeMs = 900

    const result = await processCommunityStatsQueue({ nowMs: 1_000 })
    const aggregate = await readAggregate()

    expect(result).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      processedOutboxCount: 1,
      pendingOutboxCount: 0,
      pipelineGeneration: 1,
    })
    expect(aggregate).toMatchObject({
      totalGames: 1,
      sourceGeneration: 1,
      pipelineGeneration: 1,
      schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION,
      refreshState: 'ready',
      generatedAt: 1_000,
      snapshotReadAt: 900,
    })
    expect(outboxPaths()).toEqual([])
  })

  it('deletes up to 498 outbox events in one publish transaction and finishes ready at the exact boundary', async () => {
    seedUser('u1')

    for (let index = 0; index < 498; index++) {
      seedPlaythrough('u1', makePlaythrough(`source-${index}`))
      await queueCommunityStatsRebuild({
        ownerUid: 'u1',
        mutationId: `event-${index}`,
        reason: 'playthrough-write',
      })
    }

    const claim = await claimCommunityStatsRebuild(1_500)
    expect(claim).not.toBeNull()

    const result = await publishClaimedCommunityStats(claim!, { nowMs: 1_500 })
    expect(result).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      processedOutboxCount: 498,
      pendingOutboxCount: 0,
    })
    expect(outboxPaths()).toEqual([])
  })

  it('leaves one queued event stale at 499 and drains it on the next pass', async () => {
    seedUser('u1')

    for (let index = 0; index < 499; index++) {
      seedPlaythrough('u1', makePlaythrough(`source-${index}`))
      await queueCommunityStatsRebuild({
        ownerUid: 'u1',
        mutationId: `event-${index}`,
        reason: 'playthrough-write',
      })
    }

    const claim = await claimCommunityStatsRebuild(1_600)
    expect(claim).not.toBeNull()

    const firstPass = await publishClaimedCommunityStats(claim!, { nowMs: 1_600 })
    expect(firstPass).toMatchObject({
      status: 'published',
      refreshState: 'stale',
      processedOutboxCount: 498,
      pendingOutboxCount: 1,
    })
    expect(outboxPaths()).toHaveLength(1)

    const secondPass = await processCommunityStatsQueue({ nowMs: 1_601 })
    expect(secondPass).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      processedOutboxCount: 1,
      pendingOutboxCount: 0,
    })
    expect(outboxPaths()).toEqual([])
  })

  it('persists bootstrap markers that are deleted during stale cleanup until a ready publish can acknowledge them', async () => {
    seedUser('u1')
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 0, 0)
    seedBootstrapMarker('bootstrap-1', requestedAtMs)

    for (let index = 0; index < 498; index++) {
      seedPlaythrough('u1', makePlaythrough(`source-${index}`))
      seedClientOutboxEntry('u1', `event-${index}`, requestedAtMs)
    }

    const claim = await claimCommunityStatsRebuild(1_800)
    expect(claim).not.toBeNull()

    const firstPass = await publishClaimedCommunityStats(claim!, { nowMs: 1_800 })
    expect(firstPass).toMatchObject({
      status: 'published',
      refreshState: 'stale',
      processedOutboxCount: 498,
      pendingOutboxCount: 1,
      bootstrapMarkerId: 'bootstrap-1',
    })
    expect(outboxPaths()).toHaveLength(1)
    expect(outboxPaths()).not.toContain('community-stats-system/system/communityStatsOutbox/bootstrap-1')
    expect(await readState()).toMatchObject({
      pendingBootstrapMarkers: [
        {
          markerId: 'bootstrap-1',
          requestedAtMs,
        },
      ],
      pendingOutboxCount: 1,
    })

    const secondPass = await processCommunityStatsQueue({ nowMs: 1_801 })
    expect(secondPass).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      processedOutboxCount: 1,
      pendingOutboxCount: 0,
      bootstrapMarkerId: 'bootstrap-1',
    })
    const finalState = await readState()
    expect(finalState).toMatchObject({
      lastCompletedBootstrapMarkerId: 'bootstrap-1',
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-1', requestedAtMs, 1_801),
      ],
    })
    expect(finalState).not.toHaveProperty('pendingBootstrapMarkers')
    expect(outboxPaths()).toEqual([])
  })

  it('keeps only deleted bootstrap markers in pending state while newer markers remain observable in outbox order', async () => {
    seedUser('u1')
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 2, 0)
    seedBootstrapMarker('bootstrap-older', requestedAtMs)

    for (let index = 0; index < 497; index++) {
      seedPlaythrough('u1', makePlaythrough(`source-${index}`))
      seedClientOutboxEntry('u1', `event-${index}`, requestedAtMs + 1)
    }

    seedBootstrapMarker('bootstrap-newer', requestedAtMs + 2)
    seedClientOutboxEntry('u1', 'event-tail', requestedAtMs + 3)

    const claim = await claimCommunityStatsRebuild(1_850)
    expect(claim).not.toBeNull()

    const firstPass = await publishClaimedCommunityStats(claim!, { nowMs: 1_850 })
    expect(firstPass).toMatchObject({
      status: 'published',
      refreshState: 'stale',
      processedOutboxCount: 498,
      pendingOutboxCount: 2,
      bootstrapMarkerId: 'bootstrap-newer',
    })
    expect(await readState()).toMatchObject({
      pendingBootstrapMarkers: [
        {
          markerId: 'bootstrap-older',
          requestedAtMs,
        },
      ],
      pendingOutboxCount: 2,
    })
    expect(outboxPaths()).toEqual([
      'community-stats-system/system/communityStatsOutbox/bootstrap-newer',
      'users/u1/communityStatsOutbox/event-tail',
    ])

    const secondPass = await processCommunityStatsQueue({ nowMs: 1_851 })
    expect(secondPass).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      pendingOutboxCount: 0,
      bootstrapMarkerId: 'bootstrap-newer',
    })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: 'bootstrap-newer',
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-older', requestedAtMs, 1_851),
        completedBootstrapMarker('bootstrap-newer', requestedAtMs + 2, 1_851),
      ],
    })
  })

  it('coalesces 500 queued outbox events into two bounded rebuild passes instead of 500 scans', async () => {
    seedUser('u1')

    for (let index = 0; index < 500; index++) {
      seedPlaythrough('u1', makePlaythrough(`source-${index}`))
      await queueCommunityStatsRebuild({
        ownerUid: 'u1',
        mutationId: `event-${index}`,
        reason: 'playthrough-write',
      })
    }

    const results = await Promise.all([
      processCommunityStatsQueue({ nowMs: 2_000 }),
      processCommunityStatsQueue({ nowMs: 2_001 }),
      processCommunityStatsQueue({ nowMs: 2_002 }),
    ])

    expect(results.filter((result) => result.status === 'published')).toHaveLength(1)
    expect(readCounts.playthroughs).toBeLessThanOrEqual(2)
    expect(readCounts.campaignRuns).toBeLessThanOrEqual(2)
    expect(readCounts.users).toBeLessThanOrEqual(2)
    expect((await readAggregate())?.totalGames).toBe(500)
    expect(outboxPaths()).toEqual([])
  })

  it('retains pending bootstrap markers across transient failures between cleanup passes', async () => {
    seedUser('u1')
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 5, 0)
    seedBootstrapMarker('bootstrap-2', requestedAtMs)

    for (let index = 0; index < 498; index++) {
      seedPlaythrough('u1', makePlaythrough(`source-${index}`))
      seedClientOutboxEntry('u1', `event-${index}`, requestedAtMs)
    }

    const firstClaim = await claimCommunityStatsRebuild(2_300)
    expect(firstClaim).not.toBeNull()

    const firstPass = await publishClaimedCommunityStats(firstClaim!, { nowMs: 2_300 })
    expect(firstPass).toMatchObject({
      status: 'published',
      refreshState: 'stale',
      pendingOutboxCount: 1,
      bootstrapMarkerId: 'bootstrap-2',
    })

    const failed = await processCommunityStatsQueue({
      nowMs: 2_301,
      loadSnapshot: async () => {
        throw new Error('simulated bootstrap drain failure')
      },
    })
    expect(failed).toMatchObject({
      status: 'failed',
      failureKind: 'transient',
      shouldRetry: true,
    })
    expect(await readState()).toMatchObject({
      pendingBootstrapMarkers: [
        {
          markerId: 'bootstrap-2',
          requestedAtMs,
        },
      ],
      lastErrorMessage: 'Error: simulated bootstrap drain failure',
      pendingOutboxCount: 1,
    })

    const recovered = await processCommunityStatsQueue({ nowMs: 2_302 })
    expect(recovered).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      pendingOutboxCount: 0,
      bootstrapMarkerId: 'bootstrap-2',
    })
    const finalState = await readState()
    expect(finalState).toMatchObject({
      lastCompletedBootstrapMarkerId: 'bootstrap-2',
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-2', requestedAtMs, 2_302),
      ],
    })
    expect(finalState).not.toHaveProperty('pendingBootstrapMarkers')
  })

  it('publishes stale and retains newer outbox work that arrives during rebuild', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))

    await queueCommunityStatsRebuild({
      ownerUid: 'u1',
      mutationId: 'event-1',
      reason: 'playthrough-write',
    })

    const claim = await claimCommunityStatsRebuild(3_000)
    expect(claim).not.toBeNull()

    const result = await publishClaimedCommunityStats(claim!, {
      nowMs: 3_100,
      loadSnapshot: async () => {
        queryReadTimeMs = 3_050
        const snapshot = await loadCommunityStatsSnapshot()
        seedPlaythrough('u1', makePlaythrough('source-2', {
          investigators: [
            {
              playerName: 'Bob',
              investigatorName: 'Jenny Barnes',
              archetype: 'Rogue',
            },
          ],
        }))
        await queueCommunityStatsRebuild({
          ownerUid: 'u1',
          mutationId: 'event-2',
          reason: 'playthrough-write',
        })
        return snapshot
      },
    })

    expect(result).toMatchObject({
      status: 'published',
      refreshState: 'stale',
      processedOutboxCount: 1,
      pendingOutboxCount: 1,
    })
    expect((await readAggregate())).toMatchObject({
      totalGames: 1,
      refreshState: 'stale',
      pipelineGeneration: 1,
      sourceGeneration: 1,
    })
    expect(outboxPaths()).toEqual(['users/u1/communityStatsOutbox/event-2'])
  })

  it('immediately follows up newer work that arrives mid-rebuild when using the queue processor', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))

    await queueCommunityStatsRebuild({
      ownerUid: 'u1',
      mutationId: 'event-1',
      reason: 'playthrough-write',
    })

    const result = await processCommunityStatsQueue({
      nowMs: 3_200,
      loadSnapshot: async () => {
        queryReadTimeMs = 3_150
        const snapshot = await loadCommunityStatsSnapshot()
        if (!store.has(docPath('users', 'u1', 'playthroughs', 'source-2'))) {
          seedPlaythrough('u1', makePlaythrough('source-2'))
          await queueCommunityStatsRebuild({
            ownerUid: 'u1',
            mutationId: 'event-2',
            reason: 'playthrough-write',
          })
        }
        return snapshot
      },
    })

    expect(result).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      pendingOutboxCount: 0,
    })
    expect((await readAggregate())).toMatchObject({
      totalGames: 2,
      refreshState: 'ready',
    })
    expect(outboxPaths()).toEqual([])
  })

  it('retains queued work after failure and recovers on the next attempt', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))
    await queueCommunityStatsRebuild({
      ownerUid: 'u1',
      mutationId: 'event-1',
      reason: 'playthrough-write',
    })

    const failed = await processCommunityStatsQueue({
      nowMs: 4_000,
      loadSnapshot: async () => {
        throw new Error('simulated rebuild failure')
      },
    })

    expect(failed).toMatchObject({
      status: 'failed',
      failureKind: 'transient',
      shouldRetry: true,
    })
    expect(outboxPaths()).toEqual(['users/u1/communityStatsOutbox/event-1'])
    expect((await readState())).toMatchObject({
      lastFailedGeneration: 1,
      lastErrorMessage: 'Error: simulated rebuild failure',
    })

    const recovered = await processCommunityStatsQueue({ nowMs: 4_100 })
    expect(recovered).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      processedOutboxCount: 1,
      pendingOutboxCount: 0,
    })
    expect((await readAggregate())).toMatchObject({
      totalGames: 1,
      refreshState: 'ready',
      pipelineGeneration: 1,
    })
    expect(outboxPaths()).toEqual([])
  })

  it('recovers orphaned leases after expiry', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))
    await queueCommunityStatsRebuild({
      ownerUid: 'u1',
      mutationId: 'event-1',
      reason: 'playthrough-write',
    })

    const claim = await claimCommunityStatsRebuild(5_000)
    expect(claim).not.toBeNull()

    expect(await processCommunityStatsQueue({ nowMs: 5_001 })).toMatchObject({
      status: 'skipped',
      skipReason: 'lease-active',
      shouldRetry: true,
    })

    const recovered = await recoverCommunityStatsQueue({ nowMs: 5_000 + COMMUNITY_STATS_LEASE_MS + 1 })
    expect(recovered).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      processedOutboxCount: 1,
      pendingOutboxCount: 0,
    })
    expect(outboxPaths()).toEqual([])
  })

  it('ignores a late older worker after a recovered newer lease publishes', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))
    await queueCommunityStatsRebuild({
      ownerUid: 'u1',
      mutationId: 'event-1',
      reason: 'playthrough-write',
    })

    const firstClaim = await claimCommunityStatsRebuild(6_000)
    expect(firstClaim).not.toBeNull()

    seedPlaythrough('u1', makePlaythrough('source-2'))
    await queueCommunityStatsRebuild({
      ownerUid: 'u1',
      mutationId: 'event-2',
      reason: 'playthrough-write',
    })
    queryReadTimeMs = 6_050
    const staleWorkerSnapshot = await loadCommunityStatsSnapshot()

    const recovered = await recoverCommunityStatsQueue({ nowMs: 6_000 + COMMUNITY_STATS_LEASE_MS + 1 })
    expect(recovered).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      processedOutboxCount: 2,
      pendingOutboxCount: 0,
    })
    expect((await readAggregate())).toMatchObject({
      totalGames: 2,
      pipelineGeneration: 1,
    })

    const lateOldWorker = await publishClaimedCommunityStats(firstClaim!, {
      nowMs: 6_500 + COMMUNITY_STATS_LEASE_MS,
      loadSnapshot: async () => staleWorkerSnapshot,
    })
    expect(lateOldWorker.status).toBe('lease-lost')
    expect((await readAggregate())?.totalGames).toBe(2)
  })

  it('quarantines poison outbox events without retry storms and leaves a bounded manual wake for recovery', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))
    store.set(docPath('community-stats', 'global'), {
      totalGames: 0,
      registeredUsers: 1,
      totalInvestigatorsPlayed: 0,
      topCampaigns: [],
      topInvestigators: [],
      topClasses: [],
      topSideScenarios: [],
      topStandalones: [],
      lastUpdated: 1,
      generatedAt: 1,
      snapshotReadAt: 1,
      sourceGeneration: 0,
      pipelineGeneration: 0,
      schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION,
      refreshState: 'ready',
    })
    store.set(docPath('users', 'u1', 'communityStatsOutbox', 'event-poison'), {
      mutationId: 'event-poison',
      requestedAtMs: 8_000,
      requestedBy: 'client',
      reason: 'playthrough-write',
      affectedDocuments: 1,
      bootstrapMarkerId: 'forged-marker',
    })

    const poisoned = await processCommunityStatsQueue({ nowMs: 8_100 })
    expect(poisoned).toMatchObject({
      status: 'failed',
      failureKind: 'poison',
      shouldRetry: false,
    })
    expect(await readAggregate()).toMatchObject({
      refreshState: 'stale',
      lastFailureAt: 8_100,
    })
    expect(await readState()).toMatchObject({
      lastQuarantinedOutboxCount: 1,
      lastQuarantinedOutboxPaths: ['users/u1/communityStatsOutbox/event-poison'],
      pendingOutboxCount: 1,
    })
    expect(readOutboxEntries()).toEqual([
      {
        path: expect.stringMatching(/^community-stats-system\/system\/communityStatsOutbox\/manual-/),
        data: expect.objectContaining({
          requestedBy: 'system',
          reason: 'manual',
          affectedDocuments: 0,
        }),
      },
    ])

    const recovered = await processCommunityStatsQueue({ nowMs: 8_200 })
    expect(recovered).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      pendingOutboxCount: 0,
    })
    expect(await readState()).toMatchObject({
      lastQuarantinedOutboxCount: 1,
      lastQuarantinedOutboxPaths: ['users/u1/communityStatsOutbox/event-poison'],
    })
    expect((await readAggregate())?.totalGames).toBe(1)
    expect(outboxPaths()).toEqual([])
  })

  it('preserves promoted-source suppression and restoration through full snapshot rebuilds', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1', {
      promotedToCampaignRunId: 'run-1',
      scenarioName: 'The Gathering',
    }))
    seedCampaignRun('u1', makeCampaignRun('run-1'))

    await queueCommunityStatsRebuild({
      ownerUid: 'u1',
      mutationId: 'event-1',
      reason: 'campaign-run-write',
    })
    await processCommunityStatsQueue({ nowMs: 7_000 })
    expect((await readAggregate())?.totalGames).toBe(1)

    store.delete(docPath('users', 'u1', 'campaignRuns', 'run-1'))
    await queueCommunityStatsRebuild({
      ownerUid: 'u1',
      mutationId: 'event-2',
      reason: 'campaign-run-delete',
    })
    await processCommunityStatsQueue({ nowMs: 7_100 })

    expect(await readAggregate()).toMatchObject({
      totalGames: 1,
      topCampaigns: [expect.objectContaining({ name: 'The Path to Carcosa', count: 1 })],
      refreshState: 'ready',
    })
  })

  it('rejects invalid and oversized bootstrap marker ids before storing them', async () => {
    const oversizedMarkerId = `${maxLengthBootstrapMarkerId('oversized') }z`
    const invalidMarkerCases: Array<{ markerId: string; message: RegExp }> = [
      { markerId: 'bootstrap-..-escape', message: /bootstrap/i },
      { markerId: 'bootstrap-ümlaut', message: /bootstrap/i },
      { markerId: 'bootstrap-', message: /bootstrap/i },
      { markerId: oversizedMarkerId, message: /64 characters/i },
    ]

    for (const { markerId, message } of invalidMarkerCases) {
      await expect(queueCommunityStatsRebuild({
        requestedBy: 'bootstrap',
        mutationId: markerId,
        reason: 'bootstrap',
        bootstrapMarkerId: markerId,
      })).rejects.toThrow(message)
    }

    expect(outboxPaths()).toEqual([])
  })

  it('accepts a near-limit bootstrap marker id and acknowledges the exact id on ready publish', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))
    const markerId = maxLengthBootstrapMarkerId('near-limit')

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-18T00:12:00.000Z'))

    try {
      await queueCommunityStatsRebuild({
        requestedBy: 'bootstrap',
        mutationId: markerId,
        reason: 'bootstrap',
        bootstrapMarkerId: markerId,
      })
    } finally {
      vi.useRealTimers()
    }

    const result = await processCommunityStatsQueue({ nowMs: Date.UTC(2026, 7, 18, 0, 12, 1) })
    expect(result).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      pendingOutboxCount: 0,
      bootstrapMarkerId: markerId,
    })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: markerId,
      completedBootstrapMarkers: [
        expect.objectContaining({
          markerId,
          completedAtMs: Date.UTC(2026, 7, 18, 0, 12, 1),
        }),
      ],
    })
  })

  it('quarantines malformed system bootstrap markers with invalid ids instead of acknowledging them', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))
    const invalidMarkerId = 'bootstrap-..-poison'
    const invalidPath = docPath(
      'community-stats-system',
      'system',
      'communityStatsOutbox',
      invalidMarkerId,
    )

    store.set(invalidPath, {
      mutationId: invalidMarkerId,
      requestedAtMs: 8_500,
      requestedBy: 'bootstrap',
      reason: 'bootstrap',
      affectedDocuments: 0,
      bootstrapMarkerId: invalidMarkerId,
    })

    const poisoned = await processCommunityStatsQueue({ nowMs: 8_600 })
    expect(poisoned).toMatchObject({
      status: 'failed',
      failureKind: 'poison',
      shouldRetry: false,
    })
    expect(await readState()).toMatchObject({
      lastQuarantinedOutboxCount: 1,
      lastQuarantinedOutboxPaths: [invalidPath],
      pendingOutboxCount: 1,
    })
    expect(readOutboxEntries()).toEqual([
      {
        path: expect.stringMatching(/^community-stats-system\/system\/communityStatsOutbox\/manual-/),
        data: expect.objectContaining({
          requestedBy: 'system',
          reason: 'manual',
        }),
      },
    ])
  })

  it('retains completed bootstrap markers through the full timeout window and prunes them immediately after expiration', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))
    const markerId = 'bootstrap-retained'
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 20, 0)

    seedClientOutboxEntry('u1', 'event-1', requestedAtMs)
    seedBootstrapMarker(markerId, requestedAtMs)

    await processCommunityStatsQueue({ nowMs: requestedAtMs + 1_000 })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: markerId,
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, requestedAtMs + 1_000),
      ],
    })

    seedClientOutboxEntry('u1', 'event-2', requestedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS - 1)
    await processCommunityStatsQueue({ nowMs: requestedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS - 1 })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: markerId,
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, requestedAtMs + 1_000),
      ],
    })

    seedClientOutboxEntry('u1', 'event-3', requestedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS + 1)
    await processCommunityStatsQueue({ nowMs: requestedAtMs + 1_000 + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS + 1 })
    const finalState = await readState()
    expect(finalState).not.toHaveProperty('completedBootstrapMarkers')
    expect(finalState).not.toHaveProperty('lastCompletedBootstrapMarkerId')
  })

  it('uses trusted completion time instead of a year-2100 requestedAt timestamp for retention', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))
    const markerId = 'bootstrap-year-2100'
    const requestedAtMs = Date.UTC(2100, 0, 1)
    const completionAtMs = Date.UTC(2026, 7, 18, 0, 26, 0)

    seedBootstrapMarker(markerId, requestedAtMs)

    await processCommunityStatsQueue({ nowMs: completionAtMs })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: markerId,
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, completionAtMs),
      ],
    })

    seedClientOutboxEntry('u1', 'event-future-requested-still-visible', completionAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS - 1)
    await processCommunityStatsQueue({ nowMs: completionAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS - 1 })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: markerId,
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, completionAtMs),
      ],
    })

    seedClientOutboxEntry('u1', 'event-future-requested-expired', completionAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS + 1)
    await processCommunityStatsQueue({ nowMs: completionAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS + 1 })
    const expiredState = await readState()
    expect(expiredState).not.toHaveProperty('completedBootstrapMarkers')
    expect(expiredState).not.toHaveProperty('lastCompletedBootstrapMarkerId')
  })

  it('clamps forged future completion timestamps to the bounded skew window and prunes them finitely', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))
    const markerId = 'bootstrap-forged-future'
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 27, 0)
    const nowMs = requestedAtMs + 1_000
    const clampedCompletedAtMs = nowMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_COMPLETION_CLOCK_SKEW_MS

    store.set(docPath('community-stats-internal', 'state'), {
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, Date.UTC(2100, 0, 1)),
      ],
      lastCompletedBootstrapMarkerId: markerId,
    })
    seedClientOutboxEntry('u1', 'event-clamp-future-completion', nowMs)

    await processCommunityStatsQueue({ nowMs })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: markerId,
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, clampedCompletedAtMs),
      ],
    })

    seedClientOutboxEntry(
      'u1',
      'event-clamp-future-visible',
      clampedCompletedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS - 1,
    )
    await processCommunityStatsQueue({
      nowMs: clampedCompletedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS - 1,
    })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: markerId,
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, clampedCompletedAtMs),
      ],
    })

    seedClientOutboxEntry(
      'u1',
      'event-clamp-future-expired',
      clampedCompletedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS + 1,
    )
    await processCommunityStatsQueue({
      nowMs: clampedCompletedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS + 1,
    })
    const prunedState = await readState()
    expect(prunedState).not.toHaveProperty('completedBootstrapMarkers')
    expect(prunedState).not.toHaveProperty('lastCompletedBootstrapMarkerId')
  })

  it('does not refresh a completed marker timestamp when duplicate pending state is revisited', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))
    const markerId = 'bootstrap-duplicate'
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 28, 0)
    const completedAtMs = requestedAtMs + 1_000

    store.set(docPath('community-stats-internal', 'state'), {
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, completedAtMs),
      ],
      lastCompletedBootstrapMarkerId: markerId,
      pendingBootstrapMarkers: [
        {
          markerId,
          requestedAtMs,
        },
      ],
    })
    seedClientOutboxEntry('u1', 'event-duplicate-pending', completedAtMs + 5_000)

    await processCommunityStatsQueue({ nowMs: completedAtMs + 5_000 })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: markerId,
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, completedAtMs),
      ],
    })
  })

  it('recovers bootstrap capacity after bounded completion timestamps expire', async () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 29, 0)
    const completedBootstrapMarkers = Array.from(
      { length: COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS },
      (_, index) => completedBootstrapMarker(
        `bootstrap-capacity-${index.toString(36)}`,
        requestedAtMs,
        Date.UTC(2100, 0, 1),
      ),
    )
    store.set(docPath('community-stats-internal', 'state'), {
      completedBootstrapMarkers,
      lastCompletedBootstrapMarkerId: completedBootstrapMarkers.at(-1)?.markerId,
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date(requestedAtMs))

    try {
      await expect(queueCommunityStatsRebuild({
        requestedBy: 'bootstrap',
        mutationId: 'bootstrap-capacity-recovered',
        reason: 'bootstrap',
        bootstrapMarkerId: 'bootstrap-capacity-recovered',
      })).rejects.toThrow(/at capacity/i)
    } finally {
      vi.useRealTimers()
    }

    const normalizedState = await readState()
    expect(normalizedState?.completedBootstrapMarkers?.[0]).toMatchObject({
      markerId: 'bootstrap-capacity-0',
      completedAtMs: requestedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_COMPLETION_CLOCK_SKEW_MS,
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date(
      requestedAtMs +
      COMMUNITY_STATS_BOOTSTRAP_MARKER_COMPLETION_CLOCK_SKEW_MS +
      COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS +
      1,
    ))

    try {
      await expect(queueCommunityStatsRebuild({
        requestedBy: 'bootstrap',
        mutationId: 'bootstrap-capacity-recovered',
        reason: 'bootstrap',
        bootstrapMarkerId: 'bootstrap-capacity-recovered',
      })).resolves.toBe('bootstrap-capacity-recovered')
    } finally {
      vi.useRealTimers()
    }

    expect(outboxPaths()).toContain('community-stats-system/system/communityStatsOutbox/bootstrap-capacity-recovered')
  })

  it('rejects new bootstrap markers when the tracked marker count cap is already full', async () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 30, 0)
    const completedBootstrapMarkers = Array.from(
      { length: COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS },
      (_, index) => ({
        markerId: `bootstrap-count-${index.toString(36)}`,
        requestedAtMs,
      }),
    )
    store.set(docPath('community-stats-internal', 'state'), {
      completedBootstrapMarkers,
      lastCompletedBootstrapMarkerId: completedBootstrapMarkers.at(-1)?.markerId,
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date(requestedAtMs))

    try {
      await expect(queueCommunityStatsRebuild({
        requestedBy: 'bootstrap',
        mutationId: 'bootstrap-count-overflow',
        reason: 'bootstrap',
        bootstrapMarkerId: 'bootstrap-count-overflow',
      })).rejects.toThrow(/at capacity/i)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects new bootstrap markers when the serialized marker state would exceed the safe cap', async () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 35, 0)
    const completedBootstrapMarkers = Array.from(
      { length: COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS - 2 },
      (_, index) => ({
        markerId: maxLengthBootstrapMarkerId(`size-${index.toString(36)}`),
        requestedAtMs,
      }),
    )
    store.set(docPath('community-stats-internal', 'state'), {
      completedBootstrapMarkers,
      lastCompletedBootstrapMarkerId: completedBootstrapMarkers.at(-1)?.markerId,
    })
    const overflowMarkerId = maxLengthBootstrapMarkerId('size-overflow')

    vi.useFakeTimers()
    vi.setSystemTime(new Date(requestedAtMs))

    try {
      await expect(queueCommunityStatsRebuild({
        requestedBy: 'bootstrap',
        mutationId: overflowMarkerId,
        reason: 'bootstrap',
        bootstrapMarkerId: overflowMarkerId,
      })).rejects.toThrow(/at capacity/i)
    } finally {
      vi.useRealTimers()
    }
  })

  it('quarantines overflow bootstrap markers instead of wedging the worker or acknowledging them early', async () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 40, 0)
    const completedBootstrapMarkers = Array.from(
      { length: COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS },
      (_, index) => ({
        markerId: `bootstrap-occupied-${index.toString(36)}`,
        requestedAtMs,
      }),
    )
    store.set(docPath('community-stats-internal', 'state'), {
      completedBootstrapMarkers,
      lastCompletedBootstrapMarkerId: completedBootstrapMarkers.at(-1)?.markerId,
    })
    seedBootstrapMarker('bootstrap-overflow', requestedAtMs + 1)

    const poisoned = await processCommunityStatsQueue({ nowMs: requestedAtMs + 2 })
    expect(poisoned).toMatchObject({
      status: 'failed',
      failureKind: 'poison',
      shouldRetry: false,
      pendingOutboxCount: 1,
    })
    expect(await readState()).toMatchObject({
      lastQuarantinedOutboxCount: 1,
      lastQuarantinedOutboxPaths: [
        'community-stats-system/system/communityStatsOutbox/bootstrap-overflow',
      ],
      pendingOutboxCount: 1,
    })
    expect(readOutboxEntries()).toEqual([
      {
        path: expect.stringMatching(/^community-stats-system\/system\/communityStatsOutbox\/manual-/),
        data: expect.objectContaining({
          requestedBy: 'system',
          reason: 'manual',
        }),
      },
    ])
  })

  it('tracks multiple completed bootstrap markers without losing earlier exact marker visibility', async () => {
    seedUser('u1')
    seedPlaythrough('u1', makePlaythrough('source-1'))
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 10, 0)
    seedClientOutboxEntry('u1', 'event-1', requestedAtMs)
    seedBootstrapMarker('bootstrap-a', requestedAtMs)
    seedBootstrapMarker('bootstrap-b', requestedAtMs + 1)

    const result = await processCommunityStatsQueue({ nowMs: 9_100 })
    expect(result).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      pendingOutboxCount: 0,
      bootstrapMarkerId: 'bootstrap-b',
    })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: 'bootstrap-b',
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-a', requestedAtMs, 9_100),
        completedBootstrapMarker('bootstrap-b', requestedAtMs + 1, 9_100),
      ],
    })
  })
})
