import { createHash, randomUUID } from 'node:crypto'

import { FieldValue, Timestamp } from '@google-cloud/firestore'

import { ALL_CAMPAIGNS } from '../src/lib/campaign-data.js'
import { computeCampaignCountSummary, flattenGameLogs } from '../src/lib/campaign-runs.js'
import { resolveInvestigator } from '../src/lib/investigator-data.js'
import {
  COMMUNITY_STATS_SCHEMA_VERSION,
  computeCommunityStats,
  type CommunityPairing,
  type CommunityStats,
  type CompletionBreakdown,
} from '../src/lib/community-stats-core.js'
import type { Archetype, CampaignRun, Playthrough } from '../src/lib/types.js'
import {
  COMMUNITY_STATS_BOOTSTRAP_LEASE_OWNER_ID,
  COMMUNITY_STATS_STATE_DOC_PATH,
} from './community-stats-control-ids.js'
import { listFirebaseAuthUserIds } from './firebase-identity.js'
import { getBackendFirestore } from './google-cloud.js'

export const COMMUNITY_STATS_OUTBOX_COLLECTION = 'communityStatsOutbox'
export const COMMUNITY_STATS_CONTRIBUTIONS_COLLECTION = 'community-stats-contributions'
export const COMMUNITY_STATS_QUARANTINE_COLLECTION = 'community-stats-quarantine'
export const COMMUNITY_STATS_DOC_PATH = 'community-stats/global'
export { COMMUNITY_STATS_STATE_DOC_PATH } from './community-stats-control-ids.js'
export { COMMUNITY_STATS_SCHEMA_VERSION }
export const COMMUNITY_STATS_LEASE_MS = 75_000

const MAX_USER_SOURCE_DOCUMENTS = 5_000
const MAX_CONTRIBUTIONS = 10_000
const MAX_OUTBOX_DELETES = 498
const MAX_QUARANTINE_OUTBOX_DELETES = 497
const CANONICAL_CAMPAIGNS = new Set(ALL_CAMPAIGNS.map((campaign) => campaign.name))

type CountedCampaign = CommunityStats['topCampaigns'][number]
type CountedInvestigator = CommunityStats['topInvestigators'][number]
type CountedClass = CommunityStats['topClasses'][number]
type CountedStandalone = CommunityStats['topStandalones'][number]
type CountedSideScenario = CommunityStats['topSideScenarios'][number]
type InvestigatorAssignment = Playthrough['investigators'][number]
type CampaignRosterEntry = NonNullable<CampaignRun['currentRoster']>[number]

export interface CommunityStatsContribution {
  schemaVersion: number
  generatedAt: number
  hasSourceRecords: boolean
  totalGames: number
  campaignRunsPlayedCount: number
  campaignFamilyHashes: string[]
  campaigns: CountedCampaign[]
  investigators: CountedInvestigator[]
  classes: CountedClass[]
  standalones: CountedStandalone[]
  sideScenarios: CountedSideScenario[]
  pairings: CommunityPairing[]
  completionBreakdown: CompletionBreakdown
}

export interface ContributionProcessResult {
  status: 'published' | 'updated' | 'skipped' | 'failed'
  skipReason?: 'lease-active' | 'no-pending-work'
  processedOutboxCount?: number
  pendingOutboxCount?: number
  refreshState?: 'ready' | 'stale' | 'failed'
  failureKind?: 'poison' | 'transient'
  shouldRetry?: boolean
}

export interface CommunityStatsBootstrapResult {
  userCount: number
  schemaVersion: number
  pipelineGeneration: number
  refreshState: 'ready'
}

type Lease = {
  leaseId: string
  uid: string
}

class DeterministicContributionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DeterministicContributionError'
  }
}

function withId<T>(id: string, data: FirebaseFirestore.DocumentData): T {
  return { id, ...data } as T
}

function hashFamily(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function addCount<T extends string>(
  target: Map<T, number>,
  key: T,
  count: number,
): void {
  target.set(key, (target.get(key) ?? 0) + count)
}

function canonicalizeInvestigator(
  investigator: InvestigatorAssignment,
): InvestigatorAssignment | null {
  if (investigator.isCustom) return null
  const canonical = resolveInvestigator(investigator)
  if (!canonical) return null

  return {
    ...investigator,
    investigatorName: canonical.name,
    investigatorId: canonical.id,
    investigatorSet: canonical.set,
    chapter: canonical.chapter,
    archetype: canonical.archetypes[0],
    archetypes: canonical.archetypes,
    isCustom: false,
  }
}

function canonicalizeInvestigators(
  investigators: InvestigatorAssignment[],
): InvestigatorAssignment[] {
  return investigators.flatMap((investigator) => {
    const canonical = canonicalizeInvestigator(investigator)
    return canonical ? [canonical] : []
  })
}

function canonicalizeRoster(
  roster: CampaignRosterEntry[] | undefined,
): CampaignRosterEntry[] | undefined {
  if (!roster) return undefined
  return roster.flatMap((entry) => {
    const investigator = canonicalizeInvestigator(entry.investigator)
    return investigator ? [{ ...entry, investigator }] : []
  })
}

function canonicalizePublicSource(input: {
  playthroughs: Playthrough[]
  campaignRuns: CampaignRun[]
}): {
  playthroughs: Playthrough[]
  campaignRuns: CampaignRun[]
} {
  return {
    playthroughs: input.playthroughs.map((playthrough) => ({
      ...playthrough,
      investigators: canonicalizeInvestigators(playthrough.investigators),
    })),
    campaignRuns: input.campaignRuns.map((campaignRun) => ({
      ...campaignRun,
      setupSnapshot: {
        ...campaignRun.setupSnapshot,
        investigators: canonicalizeInvestigators(campaignRun.setupSnapshot.investigators),
      },
      currentRoster: canonicalizeRoster(campaignRun.currentRoster),
      scenarioLogs: campaignRun.scenarioLogs.map((scenarioLog) => ({
        ...scenarioLog,
        investigators: canonicalizeInvestigators(scenarioLog.investigators),
        rosterBefore: canonicalizeRoster(scenarioLog.rosterBefore),
        rosterAfter: canonicalizeRoster(scenarioLog.rosterAfter),
        rosterChanges: scenarioLog.rosterChanges?.flatMap((change) => {
          const investigator = canonicalizeInvestigator(change.newEntry.investigator)
          return investigator
            ? [{
                ...change,
                newEntry: {
                  ...change.newEntry,
                  investigator,
                },
              }]
            : []
        }),
      })),
    })),
  }
}

async function claimLease(uid: string, force: boolean): Promise<Lease | ContributionProcessResult> {
  const db = getBackendFirestore()
  const stateRef = db.doc(COMMUNITY_STATS_STATE_DOC_PATH)
  const outboxQuery = db.collection(`users/${uid}/${COMMUNITY_STATS_OUTBOX_COLLECTION}`).limit(1)
  const nowMs = Date.now()

  return db.runTransaction(async (transaction) => {
    const [stateSnapshot, outboxSnapshot] = await Promise.all([
      transaction.get(stateRef),
      transaction.get(outboxQuery),
    ])
    if (!force && outboxSnapshot.empty) {
      return { status: 'skipped', skipReason: 'no-pending-work' } satisfies ContributionProcessResult
    }

    const state = stateSnapshot.data() ?? {}
    const leaseExpiresAt = state.leaseExpiresAt instanceof Timestamp
      ? state.leaseExpiresAt.toMillis()
      : 0
    if (typeof state.leaseId === 'string' && leaseExpiresAt > nowMs) {
      return {
        status: 'skipped',
        skipReason: 'lease-active',
        shouldRetry: true,
      } satisfies ContributionProcessResult
    }

    const lease = { leaseId: randomUUID(), uid }
    transaction.set(stateRef, {
      leaseId: lease.leaseId,
      leaseOwnerUid: uid,
      leaseExpiresAt: Timestamp.fromMillis(nowMs + COMMUNITY_STATS_LEASE_MS),
      lastStartedAt: Timestamp.fromMillis(nowMs),
    }, { merge: true })
    return lease
  })
}

async function loadUserSource(uid: string): Promise<{
  playthroughs: Playthrough[]
  campaignRuns: CampaignRun[]
}> {
  const db = getBackendFirestore()
  const [playthroughSnapshot, campaignRunSnapshot] = await Promise.all([
    db.collection(`users/${uid}/playthroughs`).limit(MAX_USER_SOURCE_DOCUMENTS + 1).get(),
    db.collection(`users/${uid}/campaignRuns`).limit(MAX_USER_SOURCE_DOCUMENTS + 1).get(),
  ])
  if (
    playthroughSnapshot.size > MAX_USER_SOURCE_DOCUMENTS ||
    campaignRunSnapshot.size > MAX_USER_SOURCE_DOCUMENTS
  ) {
    throw new DeterministicContributionError(
      `User source exceeds the ${MAX_USER_SOURCE_DOCUMENTS}-document processing bound.`,
    )
  }
  return {
    playthroughs: playthroughSnapshot.docs.map((entry) =>
      withId<Playthrough>(entry.id, entry.data())),
    campaignRuns: campaignRunSnapshot.docs.map((entry) =>
      withId<CampaignRun>(entry.id, entry.data())),
  }
}

async function loadQueuedOutbox(uid: string): Promise<{
  paths: string[]
  hasMore: boolean
}> {
  const snapshot = await getBackendFirestore()
    .collection(`users/${uid}/${COMMUNITY_STATS_OUTBOX_COLLECTION}`)
    .orderBy('requestedAtMs')
    .limit(MAX_OUTBOX_DELETES + 1)
    .get()
  return {
    paths: snapshot.docs.slice(0, MAX_OUTBOX_DELETES).map((entry) => entry.ref.path),
    hasMore: snapshot.size > MAX_OUTBOX_DELETES,
  }
}

export function buildCommunityStatsContribution(input: {
  playthroughs: Playthrough[]
  campaignRuns: CampaignRun[]
  generatedAt?: number
}): CommunityStatsContribution {
  const generatedAt = input.generatedAt ?? Date.now()
  const flattened = flattenGameLogs(input).map((playthrough) => ({
    ...playthrough,
    sideStories: playthrough.scenarioType === 'side_scenario' && playthrough.scenarioName
      ? Array.from(new Set([...(playthrough.sideStories ?? []), playthrough.scenarioName]))
      : playthrough.sideStories,
  }))
  const allStats = computeCommunityStats({
    playthroughs: flattened,
    rootPlaythroughs: input.playthroughs,
    campaignRuns: input.campaignRuns,
    userCount: 1,
    generatedAt,
    limits: {
      campaigns: Number.MAX_SAFE_INTEGER,
      investigators: Number.MAX_SAFE_INTEGER,
      standalones: Number.MAX_SAFE_INTEGER,
      sideScenarios: Number.MAX_SAFE_INTEGER,
      pairings: Number.MAX_SAFE_INTEGER,
    },
  })
  const canonicalSource = canonicalizePublicSource(input)
  const canonicalFlattened = flattenGameLogs(canonicalSource).map((playthrough) => ({
    ...playthrough,
    sideStories: playthrough.scenarioType === 'side_scenario' && playthrough.scenarioName
      ? Array.from(new Set([...(playthrough.sideStories ?? []), playthrough.scenarioName]))
      : playthrough.sideStories,
  }))
  const canonicalStats = computeCommunityStats({
    playthroughs: canonicalFlattened,
    rootPlaythroughs: canonicalSource.playthroughs,
    campaignRuns: canonicalSource.campaignRuns,
    userCount: 1,
    generatedAt,
    limits: {
      campaigns: Number.MAX_SAFE_INTEGER,
      investigators: Number.MAX_SAFE_INTEGER,
      standalones: Number.MAX_SAFE_INTEGER,
      sideScenarios: Number.MAX_SAFE_INTEGER,
      pairings: Number.MAX_SAFE_INTEGER,
    },
  })
  const summary = computeCampaignCountSummary(input.playthroughs, input.campaignRuns)

  return {
    schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION,
    generatedAt,
    hasSourceRecords: input.playthroughs.length > 0 || input.campaignRuns.length > 0,
    totalGames: allStats?.totalGames ?? 0,
    campaignRunsPlayedCount: summary.campaignRunsPlayedCount,
    campaignFamilyHashes: Array.from(new Set(
      summary.roots.map((root) => hashFamily(root.campaignLineageId)),
    )).sort(),
    campaigns: (allStats?.topCampaigns ?? []).filter((campaign) =>
      CANONICAL_CAMPAIGNS.has(campaign.name)),
    investigators: canonicalStats?.topInvestigators ?? [],
    classes: allStats?.topClasses ?? [],
    standalones: allStats?.topStandalones ?? [],
    sideScenarios: allStats?.topSideScenarios ?? [],
    pairings: canonicalStats?.topPairings ?? [],
    completionBreakdown: allStats?.completionBreakdown ?? {
      fullCampaigns: 0,
      smallCampaigns: 0,
      scenarioPacks: 0,
      fanMade: 0,
    },
  }
}

export function mergeCommunityStatsContributions(
  contributions: CommunityStatsContribution[],
  generatedAt = Date.now(),
  generation = 1,
  refreshState: 'ready' | 'stale' | 'failed' = 'ready',
): CommunityStats {
  const incompatibleSchemaVersions = Array.from(new Set(
    contributions
      .filter((contribution) =>
        contribution.schemaVersion !== COMMUNITY_STATS_SCHEMA_VERSION)
      .map((contribution) => contribution.schemaVersion),
  ))
  if (incompatibleSchemaVersions.length > 0) {
    throw new Error(
      `Community stats contributions require schema ${COMMUNITY_STATS_SCHEMA_VERSION}; ` +
      `found incompatible schema versions: ${incompatibleSchemaVersions.join(', ')}.`,
    )
  }

  const campaignCounts = new Map<string, CountedCampaign>()
  const investigatorCounts = new Map<string, CountedInvestigator>()
  const classCounts = new Map<Archetype, number>()
  const standaloneCounts = new Map<string, CountedStandalone>()
  const sideCounts = new Map<string, number>()
  const pairingCounts = new Map<string, CommunityPairing>()
  const campaignFamilies = new Set<string>()
  const completionBreakdown: CompletionBreakdown = {
    fullCampaigns: 0,
    smallCampaigns: 0,
    scenarioPacks: 0,
    fanMade: 0,
  }
  let totalGames = 0
  let campaignRunsPlayedCount = 0
  let registeredUsers = 0

  for (const contribution of contributions) {
    registeredUsers++
    totalGames += contribution.totalGames
    campaignRunsPlayedCount += contribution.campaignRunsPlayedCount
    contribution.campaignFamilyHashes.forEach((key) => campaignFamilies.add(key))
    for (const campaign of contribution.campaigns) {
      const existing = campaignCounts.get(campaign.name)
      campaignCounts.set(campaign.name, {
        ...campaign,
        count: (existing?.count ?? 0) + campaign.count,
      })
    }
    for (const investigator of contribution.investigators) {
      const key = investigator.investigatorId ?? `${investigator.name}:${investigator.chapter ?? 1}`
      const existing = investigatorCounts.get(key)
      investigatorCounts.set(key, {
        ...investigator,
        count: (existing?.count ?? 0) + investigator.count,
        archetypes: Array.from(new Set([
          ...(existing?.archetypes ?? []),
          ...investigator.archetypes,
        ])),
      })
    }
    for (const entry of contribution.classes) addCount(classCounts, entry.archetype, entry.count)
    for (const entry of contribution.standalones) {
      const existing = standaloneCounts.get(entry.name)
      standaloneCounts.set(entry.name, {
        ...entry,
        count: (existing?.count ?? 0) + entry.count,
        breakdown: {
          asStandalone:
            (existing?.breakdown?.asStandalone ?? 0) +
            (entry.breakdown?.asStandalone ?? 0),
          asSideStory:
            (existing?.breakdown?.asSideStory ?? 0) +
            (entry.breakdown?.asSideStory ?? 0),
        },
      })
    }
    for (const entry of contribution.sideScenarios) addCount(sideCounts, entry.name, entry.count)
    for (const entry of contribution.pairings) {
      const key = `${entry.investigator1}|||${entry.investigator2}`
      const existing = pairingCounts.get(key)
      pairingCounts.set(key, {
        ...entry,
        count: (existing?.count ?? 0) + entry.count,
      })
    }
    completionBreakdown.fullCampaigns += contribution.completionBreakdown.fullCampaigns
    completionBreakdown.smallCampaigns += contribution.completionBreakdown.smallCampaigns
    completionBreakdown.scenarioPacks += contribution.completionBreakdown.scenarioPacks
    completionBreakdown.fanMade += contribution.completionBreakdown.fanMade
  }

  const byCount = <T extends { count: number }>(left: T, right: T) =>
    right.count - left.count

  return {
    totalGames,
    campaignRunsPlayedCount,
    uniqueCampaignFamilyCount: campaignFamilies.size,
    topCampaigns: Array.from(campaignCounts.values()).sort(byCount).slice(0, 25),
    topInvestigators: Array.from(investigatorCounts.values()).sort(byCount).slice(0, 25),
    topClasses: Array.from(classCounts, ([archetype, count]) => ({ archetype, count }))
      .sort(byCount),
    totalInvestigatorsPlayed: investigatorCounts.size,
    topSideScenarios: Array.from(sideCounts, ([name, count]) => ({ name, count }))
      .sort(byCount)
      .slice(0, 25),
    topStandalones: Array.from(standaloneCounts.values()).sort(byCount).slice(0, 25),
    completionBreakdown,
    topPairings: Array.from(pairingCounts.values()).sort(byCount).slice(0, 200),
    registeredUsers,
    lastUpdated: generatedAt,
    generatedAt,
    snapshotReadAt: generatedAt,
    sourceGeneration: generation,
    pipelineGeneration: generation,
    schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION,
    refreshState,
  }
}

async function persistContribution(
  lease: Lease,
  contribution: CommunityStatsContribution,
  queuedOutbox: { paths: string[]; hasMore: boolean },
): Promise<{ processed: number; pending: number }> {
  const db = getBackendFirestore()
  const stateRef = db.doc(COMMUNITY_STATS_STATE_DOC_PATH)
  const contributionRef = db.doc(`${COMMUNITY_STATS_CONTRIBUTIONS_COLLECTION}/${lease.uid}`)
  const quarantineRef = db.doc(`${COMMUNITY_STATS_QUARANTINE_COLLECTION}/${lease.uid}`)

  return db.runTransaction(async (transaction) => {
    const stateSnapshot = await transaction.get(stateRef)
    if (stateSnapshot.data()?.leaseId !== lease.leaseId) {
      throw new Error('Community stats contribution lease was lost.')
    }
    transaction.set(contributionRef, contribution)
    transaction.delete(quarantineRef)
    for (const path of queuedOutbox.paths) transaction.delete(db.doc(path))
    return {
      processed: queuedOutbox.paths.length,
      pending: queuedOutbox.hasMore ? 1 : 0,
    }
  })
}

async function publishWithLease(
  lease: Lease,
  options: { afterOutboxPreflight?: () => Promise<void> } = {},
): Promise<CommunityStats> {
  const db = getBackendFirestore()
  const pendingOutboxQuery = db.collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION).limit(1)
  await pendingOutboxQuery.get()
  await options.afterOutboxPreflight?.()
  const [snapshot, quarantineSnapshot] = await Promise.all([
    db.collection(COMMUNITY_STATS_CONTRIBUTIONS_COLLECTION)
      .limit(MAX_CONTRIBUTIONS + 1)
      .get(),
    db.collection(COMMUNITY_STATS_QUARANTINE_COLLECTION).limit(1).get(),
  ])
  if (snapshot.size > MAX_CONTRIBUTIONS) {
    throw new Error(`Community contributions exceed the ${MAX_CONTRIBUTIONS}-document bound.`)
  }
  const contributions = snapshot.docs.map((entry) =>
    entry.data() as CommunityStatsContribution)
  const stateRef = db.doc(COMMUNITY_STATS_STATE_DOC_PATH)
  const aggregateRef = db.doc(COMMUNITY_STATS_DOC_PATH)

  return db.runTransaction(async (transaction) => {
    const [stateSnapshot, pendingOutbox] = await Promise.all([
      transaction.get(stateRef),
      transaction.get(pendingOutboxQuery),
    ])
    const state = stateSnapshot.data() ?? {}
    if (state.leaseId !== lease.leaseId) {
      throw new Error('Community stats publish lease was lost.')
    }
    const generation = typeof state.pipelineGeneration === 'number'
      ? state.pipelineGeneration + 1
      : 1
    const aggregate = mergeCommunityStatsContributions(
      contributions,
      Date.now(),
      generation,
      quarantineSnapshot.empty ? pendingOutbox.empty ? 'ready' : 'stale' : 'failed',
    )
    transaction.set(aggregateRef, aggregate)
    transaction.set(stateRef, {
      pipelineGeneration: generation,
      lastCompletedAt: Timestamp.now(),
      pendingOutboxCount: pendingOutbox.empty ? 0 : 1,
      leaseId: FieldValue.delete(),
      leaseOwnerUid: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
      ...(quarantineSnapshot.empty ? {
        lastErrorAt: FieldValue.delete(),
        lastErrorMessage: FieldValue.delete(),
      } : {}),
    }, { merge: true })
    return aggregate
  })
}

async function quarantinePoisonContribution(
  lease: Lease,
  queuedOutbox: { paths: string[]; hasMore: boolean },
  error: DeterministicContributionError,
): Promise<ContributionProcessResult> {
  const db = getBackendFirestore()
  const stateRef = db.doc(COMMUNITY_STATS_STATE_DOC_PATH)
  const aggregateRef = db.doc(COMMUNITY_STATS_DOC_PATH)
  const quarantineRef = db.doc(`${COMMUNITY_STATS_QUARANTINE_COLLECTION}/${lease.uid}`)
  const paths = queuedOutbox.paths.slice(0, MAX_QUARANTINE_OUTBOX_DELETES)
  const pending = queuedOutbox.hasMore || queuedOutbox.paths.length > paths.length ? 1 : 0

  await db.runTransaction(async (transaction) => {
    const stateSnapshot = await transaction.get(stateRef)
    if (stateSnapshot.data()?.leaseId !== lease.leaseId) {
      throw new Error('Community stats contribution lease was lost during quarantine.')
    }
    transaction.set(quarantineRef, {
      ownerUid: lease.uid,
      failureKind: 'poison',
      lastErrorAt: Timestamp.now(),
      lastErrorMessage: error.message.slice(0, 512),
      acknowledgedOutboxCount: paths.length,
    }, { merge: true })
    for (const path of paths) transaction.delete(db.doc(path))
    transaction.set(stateRef, {
      lastErrorAt: Timestamp.now(),
      lastErrorMessage: error.message.slice(0, 512),
      lastFailureKind: 'poison',
      pendingOutboxCount: pending,
      leaseId: FieldValue.delete(),
      leaseOwnerUid: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
    }, { merge: true })
    transaction.set(aggregateRef, { refreshState: 'failed' }, { merge: true })
  })

  return {
    status: 'failed',
    failureKind: 'poison',
    refreshState: 'failed',
    processedOutboxCount: paths.length,
    pendingOutboxCount: pending,
    shouldRetry: false,
  }
}

async function failLease(lease: Lease, error: unknown): Promise<void> {
  const db = getBackendFirestore()
  const stateRef = db.doc(COMMUNITY_STATS_STATE_DOC_PATH)
  const aggregateRef = db.doc(COMMUNITY_STATS_DOC_PATH)
  await db.runTransaction(async (transaction) => {
    const stateSnapshot = await transaction.get(stateRef)
    if (stateSnapshot.data()?.leaseId !== lease.leaseId) return
    transaction.set(stateRef, {
      lastErrorAt: Timestamp.now(),
      lastErrorMessage: error instanceof Error ? error.message.slice(0, 512) : String(error).slice(0, 512),
      lastFailureKind: 'transient',
      leaseId: FieldValue.delete(),
      leaseOwnerUid: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
    }, { merge: true })
    transaction.set(aggregateRef, { refreshState: 'failed' }, { merge: true })
  })
}

async function releaseLease(lease: Lease): Promise<void> {
  const db = getBackendFirestore()
  const stateRef = db.doc(COMMUNITY_STATS_STATE_DOC_PATH)
  await db.runTransaction(async (transaction) => {
    const stateSnapshot = await transaction.get(stateRef)
    if (stateSnapshot.data()?.leaseId !== lease.leaseId) return
    transaction.set(stateRef, {
      leaseId: FieldValue.delete(),
      leaseOwnerUid: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
    }, { merge: true })
  })
}

export async function rebuildUserContribution(
  uid: string,
  options: { force?: boolean; publish?: boolean } = {},
): Promise<ContributionProcessResult> {
  const claim = await claimLease(uid, options.force === true)
  if (!('leaseId' in claim)) return claim

  let queuedOutbox: { paths: string[]; hasMore: boolean } | undefined
  try {
    // Snapshot the queue first. Source writes that commit after this watermark leave a
    // newer outbox event behind and cannot be accidentally acknowledged by this pass.
    queuedOutbox = await loadQueuedOutbox(uid)
    const source = await loadUserSource(uid)
    let contribution: CommunityStatsContribution
    try {
      contribution = buildCommunityStatsContribution(source)
    } catch (error) {
      throw new DeterministicContributionError(
        'User source could not be converted into a community stats contribution.',
        { cause: error },
      )
    }
    const persisted = await persistContribution(claim, contribution, queuedOutbox)
    if (options.publish === false) {
      await releaseLease(claim)
      return {
        status: 'updated',
        processedOutboxCount: persisted.processed,
        pendingOutboxCount: persisted.pending,
      }
    }
    const aggregate = await publishWithLease(claim)
    return {
      status: 'published',
      processedOutboxCount: persisted.processed,
      pendingOutboxCount: persisted.pending,
      refreshState: aggregate.refreshState,
      shouldRetry: persisted.pending > 0,
    }
  } catch (error) {
    if (error instanceof DeterministicContributionError && queuedOutbox) {
      console.error('Quarantining deterministic community stats contribution failure.', error)
      return quarantinePoisonContribution(claim, queuedOutbox, error)
    }
    await failLease(claim, error)
    console.error('Failed to rebuild a community stats contribution.', error)
    return {
      status: 'failed',
      failureKind: 'transient',
      refreshState: 'failed',
      shouldRetry: true,
    }
  }
}

async function removeDeletedAuthUserState(activeUserIds: Set<string>): Promise<void> {
  const db = getBackendFirestore()
  const snapshots = await Promise.all([
    db.collection(COMMUNITY_STATS_CONTRIBUTIONS_COLLECTION).limit(MAX_CONTRIBUTIONS + 1).get(),
    db.collection(COMMUNITY_STATS_QUARANTINE_COLLECTION).limit(MAX_CONTRIBUTIONS + 1).get(),
  ])
  for (const snapshot of snapshots) {
    if (snapshot.size > MAX_CONTRIBUTIONS) {
      throw new Error(`Community stats server state exceeds the ${MAX_CONTRIBUTIONS}-document bound.`)
    }
  }
  const stale = snapshots.flatMap((snapshot) =>
    snapshot.docs.filter((entry) => !activeUserIds.has(entry.id)))
  for (let offset = 0; offset < stale.length; offset += 500) {
    const batch = db.batch()
    for (const entry of stale.slice(offset, offset + 500)) batch.delete(entry.ref)
    await batch.commit()
  }
}

export async function bootstrapCommunityStatsContributions(options: {
  listUserIds?: () => Promise<string[]>
  beforeFinalPublish?: () => Promise<void>
  afterOutboxPreflight?: () => Promise<void>
} = {}): Promise<CommunityStatsBootstrapResult> {
  const userIds = await (options.listUserIds ?? listFirebaseAuthUserIds)()
  for (const uid of userIds) {
    const result = await rebuildUserContribution(uid, { force: true, publish: false })
    if (result.status === 'failed') {
      throw new Error(`Failed to build contribution for user ${uid}.`)
    }
  }
  await removeDeletedAuthUserState(new Set(userIds))
  await options.beforeFinalPublish?.()
  const bootstrapLease = await claimLease(COMMUNITY_STATS_BOOTSTRAP_LEASE_OWNER_ID, true)
  if (!('leaseId' in bootstrapLease)) {
    throw new Error('Unable to claim the final bootstrap publish lease.')
  }
  const aggregate = await publishWithLease(bootstrapLease, {
    afterOutboxPreflight: options.afterOutboxPreflight,
  })
  const pipelineGeneration = aggregate.pipelineGeneration
  if (
    aggregate.schemaVersion !== COMMUNITY_STATS_SCHEMA_VERSION ||
    aggregate.refreshState !== 'ready' ||
    typeof pipelineGeneration !== 'number' ||
    !Number.isSafeInteger(pipelineGeneration) ||
    pipelineGeneration < 1
  ) {
    throw new Error(
      `Community stats bootstrap did not publish a ready schema-${COMMUNITY_STATS_SCHEMA_VERSION} aggregate.`,
    )
  }
  return {
    userCount: userIds.length,
    schemaVersion: aggregate.schemaVersion,
    pipelineGeneration,
    refreshState: aggregate.refreshState,
  }
}
