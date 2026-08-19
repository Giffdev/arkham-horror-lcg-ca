import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CampaignRun, Playthrough } from './types'

const firebaseDbHolder = vi.hoisted(() => ({
  db: undefined as Firestore | undefined,
}))

vi.mock('./firebase', () => ({
  get db() {
    if (!firebaseDbHolder.db) {
      throw new Error('Test Firebase database has not been initialized.')
    }
    return firebaseDbHolder.db
  },
}))

const currentDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(currentDir, '..', '..')
const firestoreRules = readFileSync(resolve(repoRoot, 'firestore.rules'), 'utf8')
const firebaseJson = JSON.parse(readFileSync(resolve(repoRoot, 'firebase.json'), 'utf8')) as {
  emulators?: { firestore?: { port?: number } }
}

const [emulatorHost = '127.0.0.1', emulatorPort = String(firebaseJson.emulators?.firestore?.port ?? 8080)] =
  (process.env.FIRESTORE_EMULATOR_HOST ?? `127.0.0.1:${firebaseJson.emulators?.firestore?.port ?? 8080}`).split(':')
const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const describeWithEmulator = hasEmulator ? describe : describe.skip
const EMULATOR_TEST_TIMEOUT_MS = 30_000
const VALID_CLIENT_OUTBOX_REASONS = [
  'user-create',
  'playthrough-write',
  'playthrough-delete',
  'campaign-run-write',
  'campaign-run-delete',
  'campaign-run-promotion',
  'campaign-run-restoration',
  'import',
] as const

function validClientOutboxEvent(
  eventId: string,
  reason: (typeof VALID_CLIENT_OUTBOX_REASONS)[number],
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    mutationId: eventId,
    requestedAtMs: 1_725_000_000_000,
    requestedBy: 'client',
    reason,
    affectedDocuments: reason === 'import' ? 499 : 1,
    ...overrides,
  }
}

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
      investigators: [
        {
          playerName: 'Alice',
          investigatorName: 'Roland Banks',
          archetype: 'Guardian',
        },
      ],
    },
    scenarioLogs: [],
    ...overrides,
  }
}

async function loadImportNormalizedData(db: Firestore) {
  firebaseDbHolder.db = db
  vi.resetModules()
  const firestoreModule = await import('./firestore')
  return firestoreModule.importNormalizedData
}

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  if (!hasEmulator) return
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-arkham-horror-lcg-ca',
    firestore: {
      host: emulatorHost,
      port: Number(emulatorPort),
      rules: firestoreRules,
    },
  })
})

afterAll(async () => {
  if (!testEnv) return
  await testEnv.cleanup()
})

beforeEach(async () => {
  if (!testEnv) return
  firebaseDbHolder.db = undefined
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'users', 'owner-1', 'playthroughs', 'playthrough-1'), {
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
    })
    await setDoc(doc(db, 'users', 'owner-1', 'campaignRuns', 'run-1'), {
      version: 2,
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      startedAt: '2026-08-18',
      updatedAt: '2026-08-18T00:00:00.000Z',
      status: 'active',
      setupSnapshot: {
        date: '2026-08-18',
        investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
      },
      scenarioLogs: [],
    })
    await setDoc(doc(db, 'community-stats', 'global'), {
      totalGames: 3,
      registeredUsers: 2,
      totalInvestigatorsPlayed: 4,
      topCampaigns: [],
      topInvestigators: [],
      topClasses: [],
      topSideScenarios: [],
      topStandalones: [],
      lastUpdated: 1,
      generatedAt: 1,
      sourceGeneration: 1,
      pipelineGeneration: 1,
      snapshotReadAt: 1,
      schemaVersion: 3,
      refreshState: 'ready',
    })
  })
}, EMULATOR_TEST_TIMEOUT_MS)

describeWithEmulator('firestore rules emulator', () => {
  it('allows owners to read and write their own playthroughs and campaign runs', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore()

    const playthroughSnapshot = await assertSucceeds(getDoc(doc(ownerDb, 'users', 'owner-1', 'playthroughs', 'playthrough-1')))
    expect(playthroughSnapshot.exists()).toBe(true)
    await assertSucceeds(setDoc(doc(ownerDb, 'users', 'owner-1', 'playthroughs', 'playthrough-2'), {
      campaignName: 'The Dunwich Legacy',
      campaignType: 'Full Campaign',
      investigators: [],
    }))
    await assertSucceeds(getDoc(doc(ownerDb, 'users', 'owner-1', 'campaignRuns', 'run-1')))
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('denies cross-user raw document reads and collection-group reads to ordinary clients', async () => {
    const strangerDb = testEnv.authenticatedContext('stranger-1').firestore()

    await assertFails(getDoc(doc(strangerDb, 'users', 'owner-1', 'playthroughs', 'playthrough-1')))
    await assertFails(getDoc(doc(strangerDb, 'users', 'owner-1', 'campaignRuns', 'run-1')))
    await assertFails(getDocs(query(collectionGroup(strangerDb, 'playthroughs'))))
    await assertFails(getDocs(query(collectionGroup(strangerDb, 'campaignRuns'))))
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('allows public reads of the published aggregate', async () => {
    const anonymousDb = testEnv.unauthenticatedContext().firestore()

    const snapshot = await assertSucceeds(getDoc(doc(anonymousDb, 'community-stats', 'global')))

    expect(snapshot.exists()).toBe(true)
    expect(snapshot.data()).toMatchObject({ totalGames: 3 })
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('denies ordinary client writes to the global aggregate', async () => {
    const ordinaryUserDb = testEnv.authenticatedContext('owner-1').firestore()

    await assertFails(setDoc(doc(ordinaryUserDb, 'community-stats', 'global'), {
      totalGames: 999,
      registeredUsers: 999,
    }))
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('allows owner batched source plus outbox writes with the exact approved client schema', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore()
    const batch = writeBatch(ownerDb)
    batch.set(doc(ownerDb, 'users', 'owner-1', 'playthroughs', 'playthrough-batched'), {
      campaignName: 'The Forgotten Age',
      campaignType: 'Full Campaign',
      investigators: [],
    })
    batch.set(
      doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-batched'),
      validClientOutboxEvent('event-batched', 'playthrough-write'),
    )

    await assertSucceeds(batch.commit())
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('allows every legitimate client mutation reason but denies outbox reads and internal state writes', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore()

    for (const reason of VALID_CLIENT_OUTBOX_REASONS) {
      const eventId = `event-${reason}`
      await assertSucceeds(
        setDoc(
          doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', eventId),
          validClientOutboxEvent(eventId, reason),
        ),
      )
    }

    await assertFails(getDoc(doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-playthrough-write')))
    await assertFails(setDoc(doc(ownerDb, 'community-stats-internal', 'state'), {
      leaseId: 'forbidden',
    }))
    await assertFails(getDoc(doc(ownerDb, 'community-stats-internal', 'recovery-cursor')))
    await assertFails(setDoc(doc(ownerDb, 'community-stats-internal', 'recovery-cursor'), {
      afterPath: 'users/owner-1/communityStatsOutbox/event-playthrough-write',
      leaseId: 'forbidden',
    }))
    await assertFails(getDoc(doc(ownerDb, 'community-stats-contributions', 'owner-1')))
    await assertFails(setDoc(doc(ownerDb, 'community-stats-contributions', 'owner-1'), {
      totalGames: 999,
    }))
    await assertFails(getDoc(doc(ownerDb, 'community-stats-quarantine', 'owner-1')))
    await assertFails(setDoc(doc(ownerDb, 'community-stats-quarantine', 'owner-1'), {
      failureKind: 'poison',
    }))
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('denies forged marker, extra-field, pii, wrong-requestedBy, invalid-reason, invalid-type, and id-mismatch client outbox writes', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore()

    await assertFails(setDoc(
      doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-marker'),
      {
        ...validClientOutboxEvent('event-marker', 'playthrough-write'),
        bootstrapMarkerId: 'forged-marker',
      },
    ))
    await assertFails(setDoc(
      doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-extra'),
      {
        ...validClientOutboxEvent('event-extra', 'playthrough-write'),
        unexpected: 'value',
      },
    ))
    await assertFails(setDoc(
      doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-pii'),
      {
        ...validClientOutboxEvent('event-pii', 'playthrough-write'),
        email: 'alice@example.com',
      },
    ))
    await assertFails(setDoc(
      doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-requested-by'),
      validClientOutboxEvent('event-requested-by', 'playthrough-write', {
        requestedBy: 'bootstrap',
      }),
    ))
    await assertFails(setDoc(
      doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-reason'),
      validClientOutboxEvent('event-reason', 'playthrough-write', {
        reason: 'manual',
      }),
    ))
    await assertFails(setDoc(
      doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-type'),
      validClientOutboxEvent('event-type', 'playthrough-write', {
        requestedAtMs: 'not-a-number',
      }),
    ))
    await assertFails(setDoc(
      doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-timestamp-bounds'),
      validClientOutboxEvent('event-timestamp-bounds', 'playthrough-write', {
        requestedAtMs: 1,
      }),
    ))
    await assertFails(setDoc(
      doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-affected-zero'),
      validClientOutboxEvent('event-affected-zero', 'playthrough-write', {
        affectedDocuments: 0,
      }),
    ))
    await assertFails(setDoc(
      doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-affected-overflow'),
      validClientOutboxEvent('event-affected-overflow', 'import', {
        affectedDocuments: 500,
      }),
    ))
    await assertFails(setDoc(
      doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-id-mismatch'),
      validClientOutboxEvent('wrong-id', 'playthrough-write'),
    ))
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('denies cross-user, update, delete, and system-path writes from ordinary clients', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore()
    const strangerDb = testEnv.authenticatedContext('stranger-1').firestore()

    await assertFails(setDoc(
      doc(strangerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-cross-user'),
      validClientOutboxEvent('event-cross-user', 'playthrough-write'),
    ))

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore()
      await setDoc(
        doc(adminDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-existing'),
        validClientOutboxEvent('event-existing', 'playthrough-write'),
      )
    })

    await assertFails(updateDoc(
      doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-existing'),
      { affectedDocuments: 2 },
    ))
    await assertFails(deleteDoc(doc(ownerDb, 'users', 'owner-1', 'communityStatsOutbox', 'event-existing')))
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('imports 499 source records atomically and queues one exact outbox event in the emulator', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-2').firestore()
    const importNormalizedData = await loadImportNormalizedData(ownerDb as Firestore)

    const result = await importNormalizedData('owner-2', {
      version: 2,
      playthroughs: Array.from({ length: 498 }, (_, index) => makePlaythrough(`playthrough-${index}`)),
      campaignRuns: [makeCampaignRun('run-499')],
    })

    expect(result).toEqual({
      importedPlaythroughs: 498,
      importedCampaignRuns: 1,
    })

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore()
      const playthroughSnapshot = await getDocs(collection(adminDb, 'users', 'owner-2', 'playthroughs'))
      const campaignRunSnapshot = await getDocs(collection(adminDb, 'users', 'owner-2', 'campaignRuns'))
      const outboxSnapshot = await getDocs(collection(adminDb, 'users', 'owner-2', 'communityStatsOutbox'))

      expect(playthroughSnapshot.size).toBe(498)
      expect(campaignRunSnapshot.size).toBe(1)
      expect(outboxSnapshot.size).toBe(1)
      expect(outboxSnapshot.docs[0]?.data()).toMatchObject({
        mutationId: outboxSnapshot.docs[0]!.id,
        requestedBy: 'client',
        reason: 'import',
        affectedDocuments: 499,
      })
      expect(typeof outboxSnapshot.docs[0]?.data().requestedAtMs).toBe('number')
    })
  }, EMULATOR_TEST_TIMEOUT_MS)

  it('rejects 500 source records before any emulator writes occur', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-3').firestore()
    const importNormalizedData = await loadImportNormalizedData(ownerDb as Firestore)

    await expect(importNormalizedData('owner-3', {
      version: 2,
      playthroughs: Array.from({ length: 500 }, (_, index) => makePlaythrough(`playthrough-${index}`)),
      campaignRuns: [],
    })).rejects.toThrow(/only 499 source records fit in one atomic import/i)

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore()
      expect((await getDocs(collection(adminDb, 'users', 'owner-3', 'playthroughs'))).size).toBe(0)
      expect((await getDocs(collection(adminDb, 'users', 'owner-3', 'campaignRuns'))).size).toBe(0)
      expect((await getDocs(collection(adminDb, 'users', 'owner-3', 'communityStatsOutbox'))).size).toBe(0)
    })
  }, EMULATOR_TEST_TIMEOUT_MS)
})
