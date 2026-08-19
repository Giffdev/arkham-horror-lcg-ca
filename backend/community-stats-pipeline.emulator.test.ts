import { randomUUID } from 'node:crypto'

import { deleteApp, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { COMMUNITY_STATS_SCHEMA_VERSION } from '../src/lib/community-stats-core'
import type { Playthrough } from '../src/lib/types'
import {
  COMMUNITY_STATS_BOOTSTRAP_MARKER_COMPLETION_CLOCK_SKEW_MS,
  COMMUNITY_STATS_BOOTSTRAP_MARKER_ID_MAX_CHARS,
  COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS,
  COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS,
  COMMUNITY_STATS_DOC_PATH,
  COMMUNITY_STATS_LEASE_MS,
  COMMUNITY_STATS_OUTBOX_COLLECTION,
  COMMUNITY_STATS_STATE_DOC_PATH,
  COMMUNITY_STATS_SYSTEM_OUTBOX_PARENT_PATH,
  claimCommunityStatsRebuild,
  processCommunityStatsQueue,
  publishClaimedCommunityStats,
  recoverCommunityStatsQueue,
} from './community-stats-pipeline'

const projectId = process.env.GCLOUD_PROJECT ?? 'demo-arkham-horror-lcg-ca'
const EMULATOR_TEST_TIMEOUT_MS = 60_000
const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const describeWithEmulator = hasEmulator ? describe : describe.skip

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

function withoutId<T extends { id: string }>(value: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = value
  return rest
}

async function clearFirestore() {
  const db = getFirestore()
  const collections = await db.listCollections()
  for (const collection of collections) {
    await db.recursiveDelete(collection)
  }
}

async function seedPlaythroughWithOutbox(
  uid: string,
  playthrough: Playthrough,
  mutationId = randomUUID(),
  requestedAtMs = Date.now(),
) {
  const db = getFirestore()
  const batch = db.batch()
  batch.set(db.doc(`users/${uid}`), { displayName: uid }, { merge: true })
  batch.set(db.doc(`users/${uid}/playthroughs/${playthrough.id}`), withoutId(playthrough))
  batch.set(db.doc(`users/${uid}/${COMMUNITY_STATS_OUTBOX_COLLECTION}/${mutationId}`), {
    mutationId,
    requestedAtMs,
    requestedBy: 'client',
    reason: 'playthrough-write',
    affectedDocuments: 1,
  })
  await batch.commit()
}

async function seedBootstrapMarker(markerId: string, requestedAtMs = Date.now()) {
  await getFirestore().doc(
    `${COMMUNITY_STATS_SYSTEM_OUTBOX_PARENT_PATH}/${COMMUNITY_STATS_OUTBOX_COLLECTION}/${markerId}`,
  ).set({
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

async function pendingOutboxCount() {
  const snapshot = await getFirestore().collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION).get()
  return snapshot.size
}

async function readState() {
  return (await getFirestore().doc(COMMUNITY_STATS_STATE_DOC_PATH).get()).data() ?? {}
}

async function readOutboxEntries() {
  return (await getFirestore().collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION).get()).docs
    .map((doc) => ({
      path: doc.ref.path,
      data: doc.data(),
    }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

beforeAll(() => {
  if (!hasEmulator) return
  if (!getApps().length) {
    initializeApp({ projectId })
  }
})

beforeEach(async () => {
  if (!hasEmulator) return
  await clearFirestore()
}, EMULATOR_TEST_TIMEOUT_MS)

afterAll(async () => {
  if (!hasEmulator) return
  await clearFirestore()
  await Promise.all(getApps().map((app) => deleteApp(app)))
}, EMULATOR_TEST_TIMEOUT_MS)

describeWithEmulator('community stats pipeline emulator', () => {
  it('publishes ready when exactly 498 outbox events fit in one Firestore publish transaction', async () => {
    await Promise.all(
      Array.from({ length: 498 }, (_, index) =>
        seedPlaythroughWithOutbox('u1', makePlaythrough(`source-${index}`), `event-${index}`),
      ),
    )

    const claim = await claimCommunityStatsRebuild(900)
    expect(claim).not.toBeNull()

    const result = await publishClaimedCommunityStats(claim!, { nowMs: 900 })
    expect(result).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      processedOutboxCount: 498,
      pendingOutboxCount: 0,
    })
    expect(await pendingOutboxCount()).toBe(0)
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('publishes stale at 499 outbox events, then drains the final event on the next pass', async () => {
    await Promise.all(
      Array.from({ length: 499 }, (_, index) =>
        seedPlaythroughWithOutbox('u1', makePlaythrough(`source-${index}`), `event-${index}`),
      ),
    )

    const claim = await claimCommunityStatsRebuild(950)
    expect(claim).not.toBeNull()

    const firstPass = await publishClaimedCommunityStats(claim!, { nowMs: 950 })
    expect(firstPass).toMatchObject({
      status: 'published',
      refreshState: 'stale',
      processedOutboxCount: 498,
      pendingOutboxCount: 1,
    })
    expect(await pendingOutboxCount()).toBe(1)

    const secondPass = await processCommunityStatsQueue({ nowMs: 951 })
    expect(secondPass).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      processedOutboxCount: 1,
      pendingOutboxCount: 0,
    })
    expect(await pendingOutboxCount()).toBe(0)
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('persists bootstrap marker watermarks across a stale cleanup pass and completes them on the ready drain pass', async () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 15, 0)
    await Promise.all(
      Array.from({ length: 498 }, (_, index) =>
        seedPlaythroughWithOutbox('u1', makePlaythrough(`source-${index}`), `event-${index}`, requestedAtMs),
      ),
    )
    await seedBootstrapMarker('bootstrap-marker', requestedAtMs)

    const claim = await claimCommunityStatsRebuild(976)
    expect(claim).not.toBeNull()

    const firstPass = await publishClaimedCommunityStats(claim!, { nowMs: 976 })
    expect(firstPass).toMatchObject({
      status: 'published',
      refreshState: 'stale',
      processedOutboxCount: 498,
      pendingOutboxCount: 1,
      bootstrapMarkerId: 'bootstrap-marker',
    })
    expect(await readState()).toMatchObject({
      pendingBootstrapMarkers: [
        {
          markerId: 'bootstrap-marker',
          requestedAtMs,
        },
      ],
      pendingOutboxCount: 1,
    })
    expect(await pendingOutboxCount()).toBe(1)

    const secondPass = await processCommunityStatsQueue({ nowMs: 977 })
    expect(secondPass).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      processedOutboxCount: 1,
      pendingOutboxCount: 0,
      bootstrapMarkerId: 'bootstrap-marker',
    })
    const finalState = await readState()
    expect(finalState).toMatchObject({
      lastCompletedBootstrapMarkerId: 'bootstrap-marker',
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-marker', requestedAtMs, 977),
      ],
    })
    expect(finalState).not.toHaveProperty('pendingBootstrapMarkers')
    expect(await pendingOutboxCount()).toBe(0)
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('stores only deleted bootstrap markers in pending state while newer markers remain visible in outbox', async () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 16, 0)
    await Promise.all(
      Array.from({ length: 497 }, (_, index) =>
        seedPlaythroughWithOutbox('u1', makePlaythrough(`source-${index}`), `event-${index}`, requestedAtMs + 1),
      ),
    )
    await seedBootstrapMarker('bootstrap-older', requestedAtMs)
    await seedBootstrapMarker('bootstrap-newer', requestedAtMs + 2)
    await seedPlaythroughWithOutbox('u1', makePlaythrough('source-tail'), 'event-tail', requestedAtMs + 3)

    const claim = await claimCommunityStatsRebuild(978)
    expect(claim).not.toBeNull()

    const firstPass = await publishClaimedCommunityStats(claim!, { nowMs: 978 })
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
    expect(await readOutboxEntries()).toEqual([
      {
        path: 'community-stats-system/system/communityStatsOutbox/bootstrap-newer',
        data: expect.objectContaining({
          requestedBy: 'bootstrap',
          reason: 'bootstrap',
        }),
      },
      {
        path: 'users/u1/communityStatsOutbox/event-tail',
        data: expect.objectContaining({
          requestedBy: 'client',
          reason: 'playthrough-write',
        }),
      },
    ])
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('handles 500 concurrent outbox writes with one published rebuild and no lost work', async () => {
    await Promise.all(
      Array.from({ length: 500 }, (_, index) =>
        seedPlaythroughWithOutbox('u1', makePlaythrough(`source-${index}`), `event-${index}`),
      ),
    )

    const results = await Promise.all([
      processCommunityStatsQueue({ nowMs: 1_000 }),
      processCommunityStatsQueue({ nowMs: 1_001 }),
      processCommunityStatsQueue({ nowMs: 1_002 }),
    ])

    expect(results.filter((result) => result.status === 'published')).toHaveLength(1)
    expect(await pendingOutboxCount()).toBe(0)

    const aggregate = (await getFirestore().doc(COMMUNITY_STATS_DOC_PATH).get()).data()
    expect(aggregate).toMatchObject({
      totalGames: 500,
      schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION,
      refreshState: 'ready',
    })
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('keeps queued work durable across transient failures and recovers it on retry', async () => {
    await seedPlaythroughWithOutbox('u1', makePlaythrough('source-1'), 'event-1')

    const claim = await claimCommunityStatsRebuild(2_000)
    expect(claim).not.toBeNull()

    const failed = await publishClaimedCommunityStats(claim!, {
      nowMs: 2_100,
      loadSnapshot: async () => {
        throw new Error('transient emulator failure')
      },
    })

    expect(failed).toMatchObject({
      status: 'failed',
      failureKind: 'transient',
      shouldRetry: true,
    })
    expect(await pendingOutboxCount()).toBe(1)

    const recovered = await processCommunityStatsQueue({ nowMs: 2_200 })
    expect(recovered).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      processedOutboxCount: 1,
      pendingOutboxCount: 0,
    })
    expect(await pendingOutboxCount()).toBe(0)

    const aggregate = (await getFirestore().doc(COMMUNITY_STATS_DOC_PATH).get()).data()
    expect(aggregate).toMatchObject({
      totalGames: 1,
      refreshState: 'ready',
      schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION,
    })
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('keeps pending bootstrap markers durable across transient failures between drain passes', async () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 20, 0)
    await Promise.all(
      Array.from({ length: 498 }, (_, index) =>
        seedPlaythroughWithOutbox('u1', makePlaythrough(`source-${index}`), `event-${index}`, requestedAtMs),
      ),
    )
    await seedBootstrapMarker('bootstrap-retry', requestedAtMs)

    const claim = await claimCommunityStatsRebuild(2_260)
    expect(claim).not.toBeNull()

    const firstPass = await publishClaimedCommunityStats(claim!, { nowMs: 2_260 })
    expect(firstPass).toMatchObject({
      status: 'published',
      refreshState: 'stale',
      pendingOutboxCount: 1,
      bootstrapMarkerId: 'bootstrap-retry',
    })

    const failed = await processCommunityStatsQueue({
      nowMs: 2_261,
      loadSnapshot: async () => {
        throw new Error('emulator bootstrap drain failure')
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
          markerId: 'bootstrap-retry',
          requestedAtMs,
        },
      ],
      lastErrorMessage: 'Error: emulator bootstrap drain failure',
      pendingOutboxCount: 1,
    })

    const recovered = await processCommunityStatsQueue({ nowMs: 2_262 })
    expect(recovered).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      pendingOutboxCount: 0,
      bootstrapMarkerId: 'bootstrap-retry',
    })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: 'bootstrap-retry',
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-retry', requestedAtMs, 2_262),
      ],
    })
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('accepts a near-limit bootstrap marker id and completes the exact id', async () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 22, 0)
    const markerId = maxLengthBootstrapMarkerId('near-limit')

    await seedPlaythroughWithOutbox('u1', makePlaythrough('source-1'), 'event-1', requestedAtMs)
    await seedBootstrapMarker(markerId, requestedAtMs + 1)

    const result = await processCommunityStatsQueue({ nowMs: requestedAtMs + 2 })
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
          completedAtMs: requestedAtMs + 2,
        }),
      ],
    })
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('retains completed bootstrap markers through the timeout window and prunes them after expiration', async () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 23, 0)
    await seedPlaythroughWithOutbox('u1', makePlaythrough('source-1'), 'event-1', requestedAtMs)
    await seedBootstrapMarker('bootstrap-retained', requestedAtMs + 1)

    await processCommunityStatsQueue({ nowMs: requestedAtMs + 2 })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: 'bootstrap-retained',
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-retained', requestedAtMs + 1, requestedAtMs + 2),
      ],
    })

    await seedPlaythroughWithOutbox(
      'u1',
      makePlaythrough('source-2'),
      'event-2',
      requestedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS - 1,
    )
    await processCommunityStatsQueue({
      nowMs: requestedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS - 1,
    })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: 'bootstrap-retained',
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-retained', requestedAtMs + 1, requestedAtMs + 2),
      ],
    })

    await seedPlaythroughWithOutbox(
      'u1',
      makePlaythrough('source-3'),
      'event-3',
      requestedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS + 2,
    )
    await processCommunityStatsQueue({
      nowMs: requestedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS + 3,
    })
    const finalState = await readState()
    expect(finalState).not.toHaveProperty('completedBootstrapMarkers')
    expect(finalState).not.toHaveProperty('lastCompletedBootstrapMarkerId')
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('expires a year-2100 requested bootstrap marker by trusted completion time instead of requestedAt', async () => {
    const markerId = 'bootstrap-year-2100'
    const requestedAtMs = Date.UTC(2100, 0, 1)
    const completionAtMs = Date.UTC(2026, 7, 18, 0, 23, 30)

    await seedPlaythroughWithOutbox('u1', makePlaythrough('source-future-requested'), 'event-future-requested', requestedAtMs - 1)
    await seedBootstrapMarker(markerId, requestedAtMs)

    await processCommunityStatsQueue({ nowMs: completionAtMs })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: markerId,
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, completionAtMs),
      ],
    })

    await seedPlaythroughWithOutbox(
      'u1',
      makePlaythrough('source-future-requested-expire'),
      'event-future-requested-expire',
      completionAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS + 1,
    )
    await processCommunityStatsQueue({
      nowMs: completionAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS + 1,
    })
    const expiredState = await readState()
    expect(expiredState).not.toHaveProperty('completedBootstrapMarkers')
    expect(expiredState).not.toHaveProperty('lastCompletedBootstrapMarkerId')
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('clamps forged future completion timestamps to bounded skew and prunes them finitely', async () => {
    const markerId = 'bootstrap-forged-future'
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 23, 40)
    const nowMs = requestedAtMs + 1_000
    const clampedCompletedAtMs = nowMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_COMPLETION_CLOCK_SKEW_MS

    await getFirestore().doc(COMMUNITY_STATS_STATE_DOC_PATH).set({
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, Date.UTC(2100, 0, 1)),
      ],
      lastCompletedBootstrapMarkerId: markerId,
    })
    await seedPlaythroughWithOutbox('u1', makePlaythrough('source-future-completion'), 'event-future-completion', nowMs)

    await processCommunityStatsQueue({ nowMs })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: markerId,
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, clampedCompletedAtMs),
      ],
    })

    await seedPlaythroughWithOutbox(
      'u1',
      makePlaythrough('source-future-completion-expire'),
      'event-future-completion-expire',
      clampedCompletedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS + 1,
    )
    await processCommunityStatsQueue({
      nowMs: clampedCompletedAtMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS + 1,
    })
    const prunedState = await readState()
    expect(prunedState).not.toHaveProperty('completedBootstrapMarkers')
    expect(prunedState).not.toHaveProperty('lastCompletedBootstrapMarkerId')
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('does not refresh completion timestamps when duplicate pending marker state is revisited', async () => {
    const markerId = 'bootstrap-duplicate'
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 23, 50)
    const completedAtMs = requestedAtMs + 1_000

    await getFirestore().doc(COMMUNITY_STATS_STATE_DOC_PATH).set({
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
    await seedPlaythroughWithOutbox('u1', makePlaythrough('source-duplicate'), 'event-duplicate', completedAtMs + 5_000)

    await processCommunityStatsQueue({ nowMs: completedAtMs + 5_000 })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: markerId,
      completedBootstrapMarkers: [
        completedBootstrapMarker(markerId, requestedAtMs, completedAtMs),
      ],
    })
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('quarantines invalid system bootstrap marker ids and overflow markers explicitly', async () => {
    const invalidMarkerId = 'bootstrap-..-invalid'
    await getFirestore().doc(
      `${COMMUNITY_STATS_SYSTEM_OUTBOX_PARENT_PATH}/${COMMUNITY_STATS_OUTBOX_COLLECTION}/${invalidMarkerId}`,
    ).set({
      mutationId: invalidMarkerId,
      requestedAtMs: Date.UTC(2026, 7, 18, 0, 24, 0),
      requestedBy: 'bootstrap',
      reason: 'bootstrap',
      affectedDocuments: 0,
      bootstrapMarkerId: invalidMarkerId,
    })

    const poisonedInvalid = await processCommunityStatsQueue({ nowMs: Date.UTC(2026, 7, 18, 0, 24, 1) })
    expect(poisonedInvalid).toMatchObject({
      status: 'failed',
      failureKind: 'poison',
      shouldRetry: false,
    })
    expect(await readOutboxEntries()).toEqual([
      {
        path: expect.stringMatching(/^community-stats-system\/system\/communityStatsOutbox\/manual-/),
        data: expect.objectContaining({
          requestedBy: 'system',
          reason: 'manual',
        }),
      },
    ])

    await clearFirestore()
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 24, 2)
    const completedBootstrapMarkers = Array.from(
      { length: COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS },
      (_, index) => ({
        markerId: `bootstrap-occupied-${index.toString(36)}`,
        requestedAtMs,
      }),
    )
    await getFirestore().doc(COMMUNITY_STATS_STATE_DOC_PATH).set({
      completedBootstrapMarkers,
      lastCompletedBootstrapMarkerId: completedBootstrapMarkers.at(-1)?.markerId,
    })
    await seedBootstrapMarker('bootstrap-overflow', requestedAtMs + 1)

    const poisonedOverflow = await processCommunityStatsQueue({ nowMs: requestedAtMs + 2 })
    expect(poisonedOverflow).toMatchObject({
      status: 'failed',
      failureKind: 'poison',
      shouldRetry: false,
    })
    expect(await readState()).toMatchObject({
      lastQuarantinedOutboxPaths: [
        'community-stats-system/system/communityStatsOutbox/bootstrap-overflow',
      ],
      pendingOutboxCount: 1,
    })
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('marks active-lease skips as retryable while leaving the queued wake durable', async () => {
    await seedPlaythroughWithOutbox('u1', makePlaythrough('source-1'), 'event-1')

    const claim = await claimCommunityStatsRebuild(2_500)
    expect(claim).not.toBeNull()

    const skipped = await processCommunityStatsQueue({ nowMs: 2_501 })
    expect(skipped).toMatchObject({
      status: 'skipped',
      skipReason: 'lease-active',
      shouldRetry: true,
      pendingOutboxCount: 1,
    })
    expect(await pendingOutboxCount()).toBe(1)
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('recovers an expired lease through the sweeper path', async () => {
    await seedPlaythroughWithOutbox('u1', makePlaythrough('source-1'), 'event-1')
    await getFirestore().doc(`${COMMUNITY_STATS_SYSTEM_OUTBOX_PARENT_PATH}/${COMMUNITY_STATS_OUTBOX_COLLECTION}/bootstrap-recover`).set({
      mutationId: 'bootstrap-recover',
      requestedAtMs: Date.now(),
      requestedBy: 'bootstrap',
      reason: 'bootstrap',
      affectedDocuments: 0,
      bootstrapMarkerId: 'bootstrap-recover',
    })

    const claim = await claimCommunityStatsRebuild(3_000)
    expect(claim).not.toBeNull()

    const recovered = await recoverCommunityStatsQueue({
      nowMs: 3_000 + COMMUNITY_STATS_LEASE_MS + 1,
    })

    expect(recovered).toMatchObject({
      status: 'published',
      refreshState: 'ready',
    })
    expect(await pendingOutboxCount()).toBe(0)
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('records multiple completed bootstrap markers so exact older markers remain discoverable', async () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 25, 0)
    await seedPlaythroughWithOutbox('u1', makePlaythrough('source-1'), 'event-1', requestedAtMs)
    await seedBootstrapMarker('bootstrap-a', requestedAtMs)
    await seedBootstrapMarker('bootstrap-b', requestedAtMs + 1)

    const result = await processCommunityStatsQueue({ nowMs: 3_510 })
    expect(result).toMatchObject({
      status: 'published',
      refreshState: 'ready',
      pendingOutboxCount: 0,
      bootstrapMarkerId: 'bootstrap-b',
    })
    expect(await readState()).toMatchObject({
      lastCompletedBootstrapMarkerId: 'bootstrap-b',
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-a', requestedAtMs, 3_510),
        completedBootstrapMarker('bootstrap-b', requestedAtMs + 1, 3_510),
      ],
    })
  }, EMULATOR_TEST_TIMEOUT_MS)
})
