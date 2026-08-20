import {
  getCommunityStatsFromFirestore,
  subscribeToCommunityStatsFromFirestore,
} from './firestore'
import {
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

export type CommunityStatsAvailability = 'ready' | 'stale' | 'failed' | 'unavailable' | 'old-schema'

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

  if (stats.refreshState === 'failed') return 'failed'
  if (stats.refreshState === 'stale') return 'stale'

  const generatedAt = getCommunityStatsGeneratedAt(stats)
  if (stats.refreshState !== 'ready'
    && !isCommunityStatsFresh(stats, Date.now(), COMMUNITY_STATS_STALE_AFTER_MS)) {
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
