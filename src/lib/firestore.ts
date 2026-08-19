import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  where,
  type Transaction,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import { isContinuableCampaignLog } from './campaign-data'
import { assertValidNormalizedImportPayload, type NormalizedImportPayload } from './import-export'
import {
  assertValidNewCampaignRun,
  appendCampaignScenarioLog as appendCampaignScenarioLogToRun,
  buildCampaignRunFromSourcePlaythrough,
  type CampaignScenarioLogEditInput,
  type NewCampaignScenarioLogInput,
  deleteCampaignScenarioLog as deleteCampaignScenarioLogFromRun,
  editCampaignRun as editCampaignRunData,
  editCampaignScenarioLog as editCampaignScenarioLogInRun,
  toCampaignStartTimestamp,
} from './campaign-runs'
import type { CommunityStats } from './community-stats-core'
import { assertPlayerLimit } from './playthrough-validation'
import { requestCommunityStatsRefresh } from './community-stats-wake'
import type {
  CampaignRun,
  CampaignScenarioLog,
  CampaignType,
  Playthrough,
} from './types'

type EditableCampaignRunFields = {
  campaignName?: string
  campaignSet?: string
  campaignType?: CampaignType
  customCampaignName?: string
  startedAt?: string
  status?: CampaignRun['status']
  setupSnapshot?: Partial<CampaignRun['setupSnapshot']>
}

type EditableCampaignScenarioLogFields = {
  date?: string
  scenarioName?: string
  investigators?: CampaignScenarioLog['investigators']
  sideStories?: string[]
  notes?: string
  scenarioType?: CampaignScenarioLogEditInput['scenarioType']
  resolution?: CampaignScenarioLogEditInput['resolution']
  rosterBefore?: CampaignScenarioLogEditInput['rosterBefore']
  investigatorOutcomes?: CampaignScenarioLogEditInput['investigatorOutcomes']
  preScenarioAdjustments?: CampaignScenarioLogEditInput['preScenarioAdjustments']
  rosterChanges?: CampaignScenarioLogEditInput['rosterChanges']
  rosterAfter?: CampaignScenarioLogEditInput['rosterAfter']
}

function sanitizeObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeObject(entry))
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === undefined) continue
      result[key] = sanitizeObject(nested)
    }
    return result
  }
  return value
}

function nowIso(): string {
  return new Date().toISOString()
}

function withDocId<T>(id: string, data: Record<string, unknown>): T {
  return {
    id,
    ...data,
  } as T
}

function withoutId<T extends { id: string }>(value: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = value
  return rest
}

function campaignRunDoc(uid: string, campaignRunId: string) {
  return doc(db, 'users', uid, 'campaignRuns', campaignRunId)
}

function playthroughDoc(uid: string, playthroughId: string) {
  return doc(db, 'users', uid, 'playthroughs', playthroughId)
}

const COMMUNITY_STATS_OUTBOX_COLLECTION = 'communityStatsOutbox'
const MAX_FIRESTORE_TRANSACTION_WRITES = 500
const MAX_COMMUNITY_STATS_OUTBOX_AFFECTED_DOCUMENTS = MAX_FIRESTORE_TRANSACTION_WRITES - 1

type CommunityStatsOutboxReason =
  | 'user-create'
  | 'playthrough-write'
  | 'playthrough-delete'
  | 'campaign-run-write'
  | 'campaign-run-delete'
  | 'campaign-run-promotion'
  | 'campaign-run-restoration'
  | 'import'

type UserProfileDocumentInput = {
  id: string
  email: string
  createdAt: number
  authProvider?: 'email' | 'google'
  displayName?: string | null
}

function createClientMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mutation-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function communityStatsOutboxDoc(uid: string, mutationId: string) {
  return doc(db, 'users', uid, COMMUNITY_STATS_OUTBOX_COLLECTION, mutationId)
}

function assertValidCommunityStatsMutationId(mutationId: string): void {
  if (!mutationId.trim()) {
    throw new Error('Community stats mutation ids must be non-empty.')
  }
  if (mutationId !== mutationId.trim()) {
    throw new Error('Community stats mutation ids must not include surrounding whitespace.')
  }
  if (mutationId.includes('/')) {
    throw new Error('Community stats mutation ids must not contain "/".')
  }
}

function normalizeAffectedDocumentsCount(affectedDocuments = 1): number {
  if (!Number.isInteger(affectedDocuments)) {
    throw new Error('Community stats affectedDocuments must be an integer.')
  }
  if (affectedDocuments < 1 || affectedDocuments > MAX_COMMUNITY_STATS_OUTBOX_AFFECTED_DOCUMENTS) {
    throw new Error(
      `Community stats affectedDocuments must be between 1 and ${MAX_COMMUNITY_STATS_OUTBOX_AFFECTED_DOCUMENTS}.`,
    )
  }
  return affectedDocuments
}

function queueCommunityStatsSignalInTransaction(
  transaction: Transaction,
  input: {
    uid: string
    reason: CommunityStatsOutboxReason
    affectedDocuments?: number
    requestedAtMs?: number
    mutationId?: string
  },
): string {
  const mutationId = input.mutationId ?? createClientMutationId()
  assertValidCommunityStatsMutationId(mutationId)
  const affectedDocuments = normalizeAffectedDocumentsCount(input.affectedDocuments ?? 1)
  transaction.set(communityStatsOutboxDoc(input.uid, mutationId), {
    mutationId,
    requestedAtMs: input.requestedAtMs ?? Date.now(),
    requestedBy: 'client',
    reason: input.reason,
    affectedDocuments,
  })
  return mutationId
}

async function runOwnerMutation<T>(
  uid: string,
  updateFunction: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  const result = await runTransaction(db, updateFunction)
  void requestCommunityStatsRefresh(uid)
  return result
}

export async function ensureUserProfileDocument(input: UserProfileDocumentInput): Promise<void> {
  await runOwnerMutation(input.id, async (transaction) => {
    const userRef = doc(db, 'users', input.id)
    const existing = await transaction.get(userRef)
    if (existing.exists()) {
      return
    }

    transaction.set(userRef, {
      email: input.email,
      createdAt: input.createdAt,
      authProvider: input.authProvider,
      displayName: input.displayName ?? null,
    })
    queueCommunityStatsSignalInTransaction(transaction, {
      uid: input.id,
      reason: 'user-create',
    })
  })
}

function assertContinuablePromotionSource(playthrough: Playthrough): void {
  const isContinuable = isContinuableCampaignLog({
    campaignName: playthrough.campaignName,
    campaignSet: playthrough.campaignSet,
    campaignType: playthrough.campaignType,
    customCampaignName: playthrough.customCampaignName,
  })
  if (!isContinuable) {
    throw new Error('Only Full Campaign, Small Campaign, and Fan-Made records can be promoted to a campaign run.')
  }
}

// --- Playthroughs ---

export function playthroughsCollection(uid: string) {
  return collection(db, 'users', uid, 'playthroughs')
}

/**
 * Strip undefined values from a playthrough before writing to Firestore.
 * Firestore rejects documents containing explicit `undefined` field values
 * (FirebaseError: Unsupported field value: undefined).
 */
export function sanitizePlaythrough<T extends Omit<Playthrough, 'id'>>(data: T): T {
  return sanitizeObject(data) as T
}

function sanitizeCampaignRun<T extends Omit<CampaignRun, 'id'>>(data: T): T {
  return sanitizeObject(data) as T
}

export function subscribeToPlaythroughs(
  uid: string,
  callback: (playthroughs: Playthrough[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(playthroughsCollection(uid), orderBy('date', 'desc'))
  return onSnapshot(
    q,
    (snapshot) => {
      const playthroughs = snapshot.docs.map((entry) =>
        withDocId<Playthrough>(entry.id, entry.data()),
      )
      callback(playthroughs)
    },
    (error) => {
      console.error('[Firestore] onSnapshot error:', error)
      if (onError) onError(error)
    },
  )
}

export async function addPlaythrough(uid: string, data: Omit<Playthrough, 'id'>): Promise<string> {
  if (!data.campaignName || !data.campaignName.trim()) {
    throw new Error('Campaign name is required')
  }
  assertPlayerLimit(data)
  const playthroughId = createClientMutationId()
  await runOwnerMutation(uid, async (transaction) => {
    transaction.set(
      playthroughDoc(uid, playthroughId),
      sanitizePlaythrough(data) as Record<string, unknown>,
    )
    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'playthrough-write',
    })
  })
  return playthroughId
}

export async function updatePlaythrough(uid: string, playthrough: Playthrough): Promise<void> {
  if (!playthrough.campaignName || !playthrough.campaignName.trim()) {
    throw new Error('Campaign name is required')
  }
  assertPlayerLimit(playthrough)
  const { id, ...data } = playthrough
  await runOwnerMutation(uid, async (transaction) => {
    transaction.update(playthroughDoc(uid, id), sanitizePlaythrough(data) as Record<string, unknown>)
    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'playthrough-write',
    })
  })
}

export async function upsertPlaythrough(uid: string, playthrough: Playthrough): Promise<void> {
  if (!playthrough.campaignName || !playthrough.campaignName.trim()) {
    throw new Error('Campaign name is required')
  }
  assertPlayerLimit(playthrough)
  const { id, ...data } = playthrough
  await runOwnerMutation(uid, async (transaction) => {
    transaction.set(playthroughDoc(uid, id), sanitizePlaythrough(data) as Record<string, unknown>)
    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'playthrough-write',
    })
  })
}

export async function deletePlaythrough(uid: string, playthroughId: string): Promise<void> {
  await runOwnerMutation(uid, async (transaction) => {
    transaction.delete(playthroughDoc(uid, playthroughId))
    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'playthrough-delete',
    })
  })
}

// --- Campaign Runs ---

export function campaignRunsCollection(uid: string) {
  return collection(db, 'users', uid, 'campaignRuns')
}

export function subscribeToCampaignRuns(
  uid: string,
  callback: (campaignRuns: CampaignRun[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(campaignRunsCollection(uid), orderBy('updatedAt', 'desc'))
  return onSnapshot(
    q,
    (snapshot) => {
      const campaignRuns = snapshot.docs.map((entry) =>
        withDocId<CampaignRun>(entry.id, entry.data()),
      )
      callback(campaignRuns)
    },
    (error) => {
      console.error('[Firestore] campaignRuns onSnapshot error:', error)
      if (onError) onError(error)
    },
  )
}

export async function addCampaignRun(uid: string, campaignRun: Omit<CampaignRun, 'id'>): Promise<string> {
  assertValidNewCampaignRun(campaignRun)
  const now = nowIso()
  const campaignRunId = createClientMutationId()
  const payload = sanitizeCampaignRun({
    ...campaignRun,
    version: campaignRun.version === 1 ? 1 : 2,
    startedAt: toCampaignStartTimestamp(campaignRun.startedAt, now),
    updatedAt: now,
  })
  await runOwnerMutation(uid, async (transaction) => {
    transaction.set(campaignRunDoc(uid, campaignRunId), payload)
    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'campaign-run-write',
    })
  })
  return campaignRunId
}

export async function upsertCampaignRun(uid: string, campaignRun: CampaignRun): Promise<void> {
  const payload = sanitizeCampaignRun({
    ...withoutId(campaignRun),
    version: campaignRun.version === 1 ? 1 : 2,
    updatedAt: nowIso(),
  })
  await runOwnerMutation(uid, async (transaction) => {
    transaction.set(campaignRunDoc(uid, campaignRun.id), payload)
    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'campaign-run-write',
    })
  })
}

export async function editCampaignRun(
  uid: string,
  campaignRunId: string,
  updates: EditableCampaignRunFields,
): Promise<CampaignRun> {
  return runOwnerMutation(uid, async (transaction) => {
    const runRef = campaignRunDoc(uid, campaignRunId)
    const runSnap = await transaction.get(runRef)
    if (!runSnap.exists()) {
      throw new Error('Campaign run not found.')
    }

    const existing = withDocId<CampaignRun>(runSnap.id, runSnap.data())
    const updated = editCampaignRunData(existing, updates, nowIso)
    transaction.update(runRef, sanitizeCampaignRun(withoutId(updated)) as Record<string, unknown>)
    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'campaign-run-write',
    })
    return updated
  })
}

export async function appendCampaignScenarioLog(
  uid: string,
  campaignRunId: string,
  scenarioLog: NewCampaignScenarioLogInput,
): Promise<CampaignRun> {
  return runOwnerMutation(uid, async (transaction) => {
    const runRef = campaignRunDoc(uid, campaignRunId)
    const runSnap = await transaction.get(runRef)
    if (!runSnap.exists()) {
      throw new Error('Campaign run not found.')
    }

    const existing = withDocId<CampaignRun>(runSnap.id, runSnap.data())
    const updated = appendCampaignScenarioLogToRun(existing, scenarioLog, {
      now: nowIso,
    })
    transaction.update(runRef, sanitizeCampaignRun(withoutId(updated)) as Record<string, unknown>)
    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'campaign-run-write',
    })
    return updated
  })
}

export async function editCampaignScenarioLog(
  uid: string,
  campaignRunId: string,
  scenarioLogId: string,
  updates: EditableCampaignScenarioLogFields,
): Promise<CampaignRun> {
  return runOwnerMutation(uid, async (transaction) => {
    const runRef = campaignRunDoc(uid, campaignRunId)
    const runSnap = await transaction.get(runRef)
    if (!runSnap.exists()) {
      throw new Error('Campaign run not found.')
    }

    const existing = withDocId<CampaignRun>(runSnap.id, runSnap.data())
    const updated = editCampaignScenarioLogInRun(existing, scenarioLogId, updates, nowIso)
    transaction.update(runRef, sanitizeCampaignRun(withoutId(updated)) as Record<string, unknown>)
    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'campaign-run-write',
    })
    return updated
  })
}

export async function deleteCampaignScenarioLog(
  uid: string,
  campaignRunId: string,
  scenarioLogId: string,
): Promise<CampaignRun> {
  return runOwnerMutation(uid, async (transaction) => {
    const runRef = campaignRunDoc(uid, campaignRunId)
    const runSnap = await transaction.get(runRef)
    if (!runSnap.exists()) {
      throw new Error('Campaign run not found.')
    }

    const existing = withDocId<CampaignRun>(runSnap.id, runSnap.data())
    const updated = deleteCampaignScenarioLogFromRun(existing, scenarioLogId, nowIso)
    transaction.update(runRef, sanitizeCampaignRun(withoutId(updated)) as Record<string, unknown>)
    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'campaign-run-delete',
    })
    return updated
  })
}

export async function promotePlaythroughToCampaignRun(
  uid: string,
  sourcePlaythroughId: string,
): Promise<{ campaignRunId: string; status: 'created' | 'already-promoted' | 'recovered' }> {
  return runOwnerMutation(uid, async (transaction) => {
    const sourceRef = playthroughDoc(uid, sourcePlaythroughId)
    const sourceSnap = await transaction.get(sourceRef)
    if (!sourceSnap.exists()) {
      throw new Error('The selected playthrough no longer exists.')
    }

    const source = withDocId<Playthrough>(sourceSnap.id, sourceSnap.data())
    assertContinuablePromotionSource(source)

    const existingPromotedRunId = source.promotedToCampaignRunId?.trim()
    if (existingPromotedRunId) {
      const existingRunRef = campaignRunDoc(uid, existingPromotedRunId)
      const existingRunSnap = await transaction.get(existingRunRef)
      if (existingRunSnap.exists()) {
        return {
          campaignRunId: existingPromotedRunId,
          status: 'already-promoted',
        }
      }

      const recoveredRun = buildCampaignRunFromSourcePlaythrough(source, {
        campaignRunId: existingPromotedRunId,
        now: nowIso,
      })
      transaction.set(existingRunRef, sanitizeCampaignRun(withoutId(recoveredRun)))
      transaction.update(sourceRef, { promotedToCampaignRunId: existingPromotedRunId })
      queueCommunityStatsSignalInTransaction(transaction, {
        uid,
        reason: 'campaign-run-promotion',
        affectedDocuments: 2,
      })
      return {
        campaignRunId: existingPromotedRunId,
        status: 'recovered',
      }
    }

    const deterministicRunId = sourcePlaythroughId
    const deterministicRunRef = campaignRunDoc(uid, deterministicRunId)
    const deterministicRunSnap = await transaction.get(deterministicRunRef)
    if (deterministicRunSnap.exists()) {
      transaction.update(sourceRef, { promotedToCampaignRunId: deterministicRunId })
      queueCommunityStatsSignalInTransaction(transaction, {
        uid,
        reason: 'campaign-run-promotion',
        affectedDocuments: 1,
      })
      return {
        campaignRunId: deterministicRunId,
        status: 'recovered',
      }
    }

    const campaignRun = buildCampaignRunFromSourcePlaythrough(source, {
      campaignRunId: deterministicRunId,
      now: nowIso,
    })
    transaction.set(deterministicRunRef, sanitizeCampaignRun(withoutId(campaignRun)))
    transaction.update(sourceRef, { promotedToCampaignRunId: deterministicRunId })
    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'campaign-run-promotion',
      affectedDocuments: 2,
    })
    return {
      campaignRunId: deterministicRunId,
      status: 'created',
    }
  })
}

export async function unpromoteCampaignRun(
  uid: string,
  campaignRunId: string,
): Promise<'restored' | 'deleted' | 'noop'> {
  const markedSourcesSnapshot = await getDocs(query(
    playthroughsCollection(uid),
    where('promotedToCampaignRunId', '==', campaignRunId),
  ))
  const markedSourceIds = markedSourcesSnapshot.docs.map(entry => entry.id)

  return runOwnerMutation(uid, async (transaction) => {
    const runRef = campaignRunDoc(uid, campaignRunId)
    const runSnap = await transaction.get(runRef)

    let sourcePlaythroughId = campaignRunId
    if (runSnap.exists()) {
      const run = withDocId<CampaignRun>(runSnap.id, runSnap.data())
      sourcePlaythroughId = run.sourcePlaythroughId?.trim() || campaignRunId
    }

    const sourceIds = Array.from(new Set([sourcePlaythroughId, ...markedSourceIds]))
    const sourceReads = []
    for (const sourceId of sourceIds) {
      const ref = playthroughDoc(uid, sourceId)
      sourceReads.push({ ref, snap: await transaction.get(ref) })
    }

    if (runSnap.exists()) {
      transaction.delete(runRef)
    }

    let restored = false
    for (const { ref, snap } of sourceReads) {
      if (!snap.exists()) continue
      const source = withDocId<Playthrough>(snap.id, snap.data())
      if (source.promotedToCampaignRunId === campaignRunId) {
        transaction.update(ref, { promotedToCampaignRunId: deleteField() })
        restored = true
      }
    }

    if (!runSnap.exists() && !restored) return 'noop'
    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'campaign-run-restoration',
      affectedDocuments: (runSnap.exists() ? 1 : 0) + sourceReads.filter(({ snap }) => snap.exists()).length,
    })
    if (restored) return 'restored'
    return 'deleted'
  })
}

export async function deleteCampaignRunWithRestoration(uid: string, campaignRunId: string): Promise<void> {
  await unpromoteCampaignRun(uid, campaignRunId)
}

const MAX_ATOMIC_IMPORT_RECORDS = MAX_COMMUNITY_STATS_OUTBOX_AFFECTED_DOCUMENTS

function buildImportCollisionError(input: {
  playthroughIds: string[]
  campaignRunIds: string[]
}): Error {
  const conflicts: string[] = []
  if (input.playthroughIds.length > 0) {
    conflicts.push(`playthrough ids (${input.playthroughIds.join(', ')})`)
  }
  if (input.campaignRunIds.length > 0) {
    conflicts.push(`campaign run ids (${input.campaignRunIds.join(', ')})`)
  }

  return new Error(
    `Import would overwrite existing data. Conflicting ${conflicts.join(' and ')}. ` +
    'Resolve the collisions or change the incoming ids before retrying.',
  )
}

export async function importNormalizedData(
  uid: string,
  payload: NormalizedImportPayload,
): Promise<{ importedPlaythroughs: number; importedCampaignRuns: number }> {
  const totalWrites = payload.playthroughs.length + payload.campaignRuns.length
  if (totalWrites === 0) {
    return { importedPlaythroughs: 0, importedCampaignRuns: 0 }
  }
  if (totalWrites > MAX_ATOMIC_IMPORT_RECORDS) {
    throw new Error(
      `Import contains ${totalWrites} records, but only ${MAX_ATOMIC_IMPORT_RECORDS} source records fit in one ` +
      `atomic import because the transaction also writes one community-stats outbox event ` +
      `(Firestore limit: ${MAX_FIRESTORE_TRANSACTION_WRITES} writes). Split the export into smaller imports and retry.`,
    )
  }

  assertValidNormalizedImportPayload(payload)
  for (const playthrough of payload.playthroughs) {
    if (!playthrough.campaignName || !playthrough.campaignName.trim()) {
      throw new Error(`Imported playthrough ${playthrough.id} is missing a campaign name.`)
    }
    assertPlayerLimit(playthrough)
  }
  for (const campaignRun of payload.campaignRuns) {
    assertValidNewCampaignRun(campaignRun)
  }

  return runOwnerMutation(uid, async (transaction) => {
    const playthroughTargets = payload.playthroughs.map((playthrough) => ({
      playthrough,
      ref: playthroughDoc(uid, playthrough.id),
    }))
    const campaignRunTargets = payload.campaignRuns.map((campaignRun) => ({
      campaignRun,
      ref: campaignRunDoc(uid, campaignRun.id),
    }))

    const conflictingPlaythroughIds: string[] = []
    const conflictingCampaignRunIds: string[] = []

    for (const { playthrough, ref } of playthroughTargets) {
      if (!playthrough.campaignName || !playthrough.campaignName.trim()) {
        throw new Error(`Imported playthrough ${playthrough.id} is missing a campaign name.`)
      }
      assertPlayerLimit(playthrough)
      const snapshot = await transaction.get(ref)
      if (snapshot.exists()) {
        conflictingPlaythroughIds.push(playthrough.id)
      }
    }

    for (const { campaignRun, ref } of campaignRunTargets) {
      assertValidNewCampaignRun(campaignRun)
      const snapshot = await transaction.get(ref)
      if (snapshot.exists()) {
        conflictingCampaignRunIds.push(campaignRun.id)
      }
    }

    if (conflictingPlaythroughIds.length > 0 || conflictingCampaignRunIds.length > 0) {
      throw buildImportCollisionError({
        playthroughIds: conflictingPlaythroughIds,
        campaignRunIds: conflictingCampaignRunIds,
      })
    }

    for (const { playthrough, ref } of playthroughTargets) {
      transaction.set(
        ref,
        sanitizePlaythrough(withoutId(playthrough)) as Record<string, unknown>,
      )
    }

    for (const { campaignRun, ref } of campaignRunTargets) {
      transaction.set(
        ref,
        sanitizeCampaignRun({
          ...withoutId(campaignRun),
          version: campaignRun.version === 1 ? 1 : 2,
        }) as Record<string, unknown>,
      )
    }

    queueCommunityStatsSignalInTransaction(transaction, {
      uid,
      reason: 'import',
      affectedDocuments: totalWrites,
    })

    return {
      importedPlaythroughs: payload.playthroughs.length,
      importedCampaignRuns: payload.campaignRuns.length,
    }
  })
}

// --- Community Stats ---

const COMMUNITY_STATS_DOC = doc(db, 'community-stats', 'global')

export async function getCommunityStatsFromFirestore(): Promise<CommunityStats | null> {
  const snap = await getDoc(COMMUNITY_STATS_DOC)
  return snap.exists() ? (snap.data() as CommunityStats) : null
}

export function subscribeToCommunityStatsFromFirestore(
  callback: (stats: CommunityStats | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    COMMUNITY_STATS_DOC,
    (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as CommunityStats) : null)
    },
    (error) => {
      console.error('[Firestore] community-stats onSnapshot error:', error)
      if (onError) onError(error)
    },
  )
}
