import type { Playthrough } from './types'
import {
  getAllPlaythroughs,
  getCommunityStatsFromFirestore,
  saveCommunityStats,
  subscribeToCommunityStatsFromFirestore,
} from './firestore'
import {
  buildEmptyCommunityStats,
  computeCommunityStats,
  COMMUNITY_STATS_SCHEMA_VERSION,
  COMMUNITY_STATS_STALE_AFTER_MS,
  getCommunityStatsGeneratedAt,
  hasCurrentCommunityStatsSchema,
  isCommunityStatsFresh,
  type CommunityStats,
  type CommunityPairing,
  type CompletionBreakdown,
  type StandalonePlayBreakdown,
} from './community-stats-core'
import { ALL_CAMPAIGNS } from './campaign-data'

export type {
  CommunityStats,
  CommunityPairing,
  CompletionBreakdown,
  StandalonePlayBreakdown,
} from './community-stats-core'

export type CommunityStatsAvailability = 'ready' | 'stale' | 'unavailable' | 'old-schema'

const COMMUNITY_STATS_CLOCK_SKEW_TOLERANCE_MS = 60_000

let pendingAggregateRefresh:
  | {
      baselineLastUpdated: number | null
      dirtySince: number
    }
  | null = null

const CANONICAL_PUBLIC_CAMPAIGN_NAMES = new Set(ALL_CAMPAIGNS.map(campaign => campaign.name))

function filterCanonicalTopCampaigns(campaigns: CommunityStats['topCampaigns'] | undefined): CommunityStats['topCampaigns'] {
  return (campaigns ?? []).filter(
    campaign => campaign.name && campaign.name.trim() && CANONICAL_PUBLIC_CAMPAIGN_NAMES.has(campaign.name),
  )
}

function normalizeCommunityStats(stats: CommunityStats | null): CommunityStats | null {
  if (!stats) return null
  stats.topCampaigns = filterCanonicalTopCampaigns(stats.topCampaigns)
  stats.topStandalones = stats.topStandalones ?? []
  stats.topSideScenarios = stats.topSideScenarios ?? []
  stats.topPairings = stats.topPairings ?? []
  stats.topClasses = stats.topClasses ?? []
  return stats
}

export function markCommunityStatsDirty(lastKnownAggregateUpdatedAt?: number | null): void {
  pendingAggregateRefresh = {
    baselineLastUpdated: lastKnownAggregateUpdatedAt ?? null,
    dirtySince: Date.now(),
  }
}

export function getCommunityStatsAvailability(stats: CommunityStats | null): CommunityStatsAvailability {
  if (!stats) return 'unavailable'

  if (!hasCurrentCommunityStatsSchema(stats)) return 'old-schema'

  if (stats.refreshState === 'failed' || stats.refreshState === 'stale') return 'stale'

  const generatedAt = getCommunityStatsGeneratedAt(stats)
  if (!isCommunityStatsFresh(stats, Date.now(), COMMUNITY_STATS_STALE_AFTER_MS)) {
    return 'stale'
  }

  if (pendingAggregateRefresh) {
    const currentAggregateTimestamp = generatedAt ?? 0
    const hasAdvancedBeyondBaseline = pendingAggregateRefresh.baselineLastUpdated !== null
      ? currentAggregateTimestamp > pendingAggregateRefresh.baselineLastUpdated
      : currentAggregateTimestamp >= pendingAggregateRefresh.dirtySince - COMMUNITY_STATS_CLOCK_SKEW_TOLERANCE_MS
    if (hasAdvancedBeyondBaseline) {
      pendingAggregateRefresh = null
    } else {
      return 'stale'
    }
  }

  return 'ready'
}

/**
 * Trusted/admin rebuild path retained for tests and backend tooling.
 * Ordinary clients should read the published aggregate document instead.
 */
export async function rebuildCommunityStats(_localPlaythroughs?: Playthrough[]): Promise<CommunityStats | void> {
  try {
    const source = await getAllPlaythroughs()
    const generatedAt = Date.now()
    const stats = computeCommunityStats({
      playthroughs: source.playthroughs,
      rootPlaythroughs: source.rootPlaythroughs,
      campaignRuns: source.campaignRuns,
      userCount: source.userCount,
      generatedAt,
      snapshotReadAt: generatedAt,
      schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION,
      refreshState: 'ready',
    }) ?? buildEmptyCommunityStats({
      userCount: source.userCount,
      generatedAt,
      snapshotReadAt: generatedAt,
      schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION,
      refreshState: 'ready',
    })
    stats.topCampaigns = filterCanonicalTopCampaigns(stats.topCampaigns)
    await saveCommunityStats(stats)
    return stats
  } catch (error) {
    console.error('[CommunityStats] Failed to rebuild:', error)
  }
}

export async function bumpCommunityStats(delta: {
  gamesAdded?: number
  gamesRemoved?: number
}): Promise<void> {
  try {
    const existing = await getCommunityStatsFromFirestore()
    if (!existing) return
    const generatedAt = Date.now()
    const totalGames = Math.max(
      0,
      existing.totalGames + (delta.gamesAdded || 0) - (delta.gamesRemoved || 0),
    )
    await saveCommunityStats({
      ...existing,
      totalGames,
      lastUpdated: generatedAt,
      generatedAt,
      snapshotReadAt: generatedAt,
      schemaVersion: existing.schemaVersion ?? COMMUNITY_STATS_SCHEMA_VERSION,
      refreshState: 'ready',
      sourceGeneration: existing.sourceGeneration ?? 0,
      pipelineGeneration: existing.pipelineGeneration ?? existing.sourceGeneration ?? 0,
    })
  } catch (error) {
    console.error('Failed to bump community stats:', error)
  }
}

export async function getCommunityStats(): Promise<CommunityStats | null> {
  try {
    const stats = normalizeCommunityStats(await getCommunityStatsFromFirestore())
    getCommunityStatsAvailability(stats)
    return stats
  } catch (error) {
    console.error('Failed to get community stats:', error)
    return null
  }
}

export function subscribeToCommunityStats(
  callback: (stats: CommunityStats | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return subscribeToCommunityStatsFromFirestore(
    (stats) => {
      const normalized = normalizeCommunityStats(stats)
      getCommunityStatsAvailability(normalized)
      callback(normalized)
    },
    onError,
  )
}
