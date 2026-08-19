import type { Archetype, CampaignRun, Playthrough } from './types.js'
import { getCampaignSet, SCENARIO_PACK_SCENARIOS } from './campaign-data.js'
import { computeCampaignCountSummary } from './campaign-runs.js'
import { getInvestigatorPairKey, resolveInvestigator } from './investigator-data.js'

export interface CompletionBreakdown {
  fullCampaigns: number
  smallCampaigns: number
  scenarioPacks: number
  fanMade: number
}

export interface CommunityPairing {
  investigator1: string
  investigator2: string
  count: number
}

export interface StandalonePlayBreakdown {
  asStandalone: number
  asSideStory: number
}

export const COMMUNITY_STATS_SCHEMA_VERSION = 3
export const COMMUNITY_STATS_STALE_AFTER_MS = 15 * 60_000

export type CommunityStatsRefreshState = 'ready' | 'stale' | 'failed'

export interface CommunityStats {
  totalGames: number
  campaignRunsPlayedCount?: number
  uniqueCampaignFamilyCount?: number
  topCampaigns: { name: string; count: number; set?: string }[]
  topInvestigators: { name: string; count: number; archetypes: Archetype[]; chapter?: 1 | 2; investigatorId?: string; investigatorSet?: string }[]
  topClasses: { archetype: Archetype; count: number }[]
  totalInvestigatorsPlayed: number
  topSideScenarios: { name: string; count: number }[]
  topStandalones: { name: string; count: number; set?: string; breakdown?: StandalonePlayBreakdown }[]
  completionBreakdown?: CompletionBreakdown
  topPairings?: CommunityPairing[]
  registeredUsers: number
  lastUpdated: number
  generatedAt?: number
  snapshotReadAt?: number
  sourceGeneration?: number
  pipelineGeneration?: number
  schemaVersion?: number
  refreshState?: CommunityStatsRefreshState
  lastFailureAt?: number
  lastFailedGeneration?: number
}

export interface CommunityStatsSourceInput {
  playthroughs: Playthrough[]
  rootPlaythroughs: Playthrough[]
  campaignRuns: CampaignRun[]
  userCount: number
  lastUpdated?: number
  generatedAt?: number
  snapshotReadAt?: number
  sourceGeneration?: number
  pipelineGeneration?: number
  schemaVersion?: number
  refreshState?: CommunityStatsRefreshState
  limits?: {
    campaigns?: number
    investigators?: number
    standalones?: number
    sideScenarios?: number
    pairings?: number
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getCommunityStatsGeneratedAt(
  stats: Pick<CommunityStats, 'generatedAt' | 'lastUpdated'> | null | undefined,
): number | null {
  const generatedAt = stats?.generatedAt ?? stats?.lastUpdated
  return typeof generatedAt === 'number' && Number.isFinite(generatedAt) ? generatedAt : null
}

export function hasCurrentCommunityStatsSchema(
  stats: Pick<CommunityStats, 'schemaVersion'> | null | undefined,
): boolean {
  return stats?.schemaVersion === COMMUNITY_STATS_SCHEMA_VERSION
}

export function isCommunityStatsFresh(
  stats: Pick<CommunityStats, 'generatedAt' | 'lastUpdated'> | null | undefined,
  now = Date.now(),
  maxAgeMs = COMMUNITY_STATS_STALE_AFTER_MS,
): boolean {
  const generatedAt = getCommunityStatsGeneratedAt(stats)
  return generatedAt !== null && now - generatedAt <= maxAgeMs
}

export function buildEmptyCommunityStats(input: {
  userCount: number
  generatedAt?: number
  snapshotReadAt?: number
  sourceGeneration?: number
  pipelineGeneration?: number
  schemaVersion?: number
  refreshState?: CommunityStatsRefreshState
  lastFailureAt?: number
  lastFailedGeneration?: number
}): CommunityStats {
  const generatedAt = input.generatedAt ?? Date.now()

  return {
    totalGames: 0,
    campaignRunsPlayedCount: 0,
    uniqueCampaignFamilyCount: 0,
    topCampaigns: [],
    topInvestigators: [],
    topClasses: [],
    totalInvestigatorsPlayed: 0,
    topSideScenarios: [],
    topStandalones: [],
    completionBreakdown: {
      fullCampaigns: 0,
      smallCampaigns: 0,
      scenarioPacks: 0,
      fanMade: 0,
    },
    topPairings: [],
    registeredUsers: input.userCount,
    lastUpdated: generatedAt,
    generatedAt,
    ...(input.snapshotReadAt !== undefined ? { snapshotReadAt: input.snapshotReadAt } : {}),
    schemaVersion: input.schemaVersion ?? COMMUNITY_STATS_SCHEMA_VERSION,
    refreshState: input.refreshState ?? 'ready',
    ...(input.sourceGeneration !== undefined ? { sourceGeneration: input.sourceGeneration } : {}),
    ...(input.pipelineGeneration !== undefined ? { pipelineGeneration: input.pipelineGeneration } : {}),
    ...(input.lastFailureAt !== undefined ? { lastFailureAt: input.lastFailureAt } : {}),
    ...(input.lastFailedGeneration !== undefined ? { lastFailedGeneration: input.lastFailedGeneration } : {}),
  }
}

export function computeCommunityStats(input: CommunityStatsSourceInput): CommunityStats | null {
  const generatedAt = input.generatedAt ?? input.lastUpdated ?? Date.now()
  const {
    playthroughs,
    rootPlaythroughs,
    campaignRuns,
    userCount,
    snapshotReadAt,
    sourceGeneration,
    pipelineGeneration,
    schemaVersion = COMMUNITY_STATS_SCHEMA_VERSION,
    refreshState = 'ready',
    limits = {},
  } = input
  if (!playthroughs.length && !rootPlaythroughs.length && !campaignRuns.length && userCount === 0) {
    return null
  }

  const campaignCountSummary = computeCampaignCountSummary(rootPlaythroughs, campaignRuns)
  const campaignCounts = new Map<string, { count: number; set?: string }>()
  const investigatorCounts = new Map<string, {
    name: string
    count: number
    archetypes: Archetype[]
    chapter?: 1 | 2
    investigatorId?: string
    investigatorSet?: string
  }>()
  const classCounts = new Map<Archetype, number>()
  const uniqueInvestigators = new Set<string>()
  const pairCounts = new Map<string, number>()

  const canonicalStandaloneMap = new Map<string, { name: string; set: string }>()
  for (const standalone of SCENARIO_PACK_SCENARIOS) {
    canonicalStandaloneMap.set(normalizeKey(standalone.name), {
      name: standalone.name,
      set: standalone.set,
    })
  }

  const standaloneCounts = new Map<string, {
    name: string
    set: string
    asStandalone: number
    asSideStory: number
  }>()
  const sideCounts = new Map<string, { name: string; count: number }>()

  for (const playthrough of playthroughs) {
    if (playthrough.campaignType === 'Scenario Pack') {
      const standaloneName = playthrough.campaignName?.trim()
      if (standaloneName) {
        const canonical = canonicalStandaloneMap.get(normalizeKey(standaloneName))
        if (canonical) {
          const entry = standaloneCounts.get(canonical.name) ?? {
            name: canonical.name,
            set: canonical.set,
            asStandalone: 0,
            asSideStory: 0,
          }
          entry.asStandalone++
          standaloneCounts.set(canonical.name, entry)
        }
      }
    }

    if (playthrough.sideStories?.length) {
      for (const rawSideStory of playthrough.sideStories) {
        const trimmed = rawSideStory?.trim()
        if (!trimmed) continue
        const canonical = canonicalStandaloneMap.get(normalizeKey(trimmed))
        if (!canonical) continue

        const standaloneEntry = standaloneCounts.get(canonical.name) ?? {
          name: canonical.name,
          set: canonical.set,
          asStandalone: 0,
          asSideStory: 0,
        }
        standaloneEntry.asSideStory++
        standaloneCounts.set(canonical.name, standaloneEntry)

        const sideKey = normalizeKey(trimmed)
        const existingSide = sideCounts.get(sideKey)
        if (existingSide) {
          existingSide.count++
        } else {
          sideCounts.set(sideKey, { name: canonical.name, count: 1 })
        }
      }
    }

    const validNames: string[] = []
    for (const investigator of playthrough.investigators) {
      if (investigator.isUnknown || !investigator.investigatorName || investigator.investigatorName === 'Unknown') {
        continue
      }

      const resolved = resolveInvestigator(investigator)
      const resolvedChapter = resolved?.chapter ?? investigator.chapter
      const pairKey = getInvestigatorPairKey({
        investigatorName: investigator.investigatorName,
        chapter: resolvedChapter,
      })
      uniqueInvestigators.add(pairKey)
      if (!validNames.includes(pairKey)) {
        validNames.push(pairKey)
      }

      const chapter = pairKey !== investigator.investigatorName ? resolvedChapter ?? 1 : resolvedChapter
      const investigatorEntry = investigatorCounts.get(pairKey) ?? {
        name: investigator.investigatorName,
        count: 0,
        archetypes: investigator.archetypes || [investigator.archetype],
        chapter: chapter as 1 | 2 | undefined,
        investigatorId: resolved?.id ?? investigator.investigatorId,
        investigatorSet: resolved?.set ?? investigator.investigatorSet,
      }
      investigatorEntry.count++
      investigatorCounts.set(pairKey, investigatorEntry)

      const archetypes = investigator.archetypes || (investigator.archetype ? [investigator.archetype] : [])
      for (const archetype of archetypes) {
        if (archetype && archetype.toLowerCase() !== 'neutral') {
          classCounts.set(archetype, (classCounts.get(archetype) || 0) + 1)
        }
      }
    }

    for (let left = 0; left < validNames.length; left++) {
      for (let right = left + 1; right < validNames.length; right++) {
        const [first, second] = validNames[left] < validNames[right]
          ? [validNames[left], validNames[right]]
          : [validNames[right], validNames[left]]
        pairCounts.set(`${first}|||${second}`, (pairCounts.get(`${first}|||${second}`) || 0) + 1)
      }
    }
  }

  for (const root of campaignCountSummary.roots) {
    if (root.campaignType === 'Scenario Pack') continue
    const effectiveName = root.campaignName?.trim()
    if (!effectiveName) continue
    const existing = campaignCounts.get(effectiveName) ?? {
      count: 0,
      set: getCampaignSet(effectiveName),
    }
    existing.count++
    campaignCounts.set(effectiveName, existing)
  }

  const topCampaigns = Array.from(campaignCounts.entries())
    .filter(([name]) => name && name.trim())
    .map(([name, data]) => ({
      name,
      count: data.count,
      ...(data.set ? { set: data.set } : {}),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limits.campaigns ?? 25)

  const topInvestigators = Array.from(investigatorCounts.values())
    .map((investigator) => ({
      name: investigator.name,
      count: investigator.count,
      archetypes: investigator.archetypes || [],
      ...(investigator.chapter ? { chapter: investigator.chapter } : {}),
      ...(investigator.investigatorId ? { investigatorId: investigator.investigatorId } : {}),
      ...(investigator.investigatorSet ? { investigatorSet: investigator.investigatorSet } : {}),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limits.investigators ?? 25)

  const topClasses = Array.from(classCounts.entries())
    .map(([archetype, count]) => ({ archetype, count }))
    .sort((left, right) => right.count - left.count)

  const topStandalones = Array.from(standaloneCounts.values())
    .map((entry) => ({
      name: entry.name,
      count: entry.asStandalone + entry.asSideStory,
      set: entry.set,
      breakdown: {
        asStandalone: entry.asStandalone,
        asSideStory: entry.asSideStory,
      },
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, limits.standalones ?? 25)

  const topSideScenarios = Array.from(sideCounts.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, limits.sideScenarios ?? 25)

  const topPairings = Array.from(pairCounts.entries())
    .map(([key, count]) => {
      const [investigator1, investigator2] = key.split('|||')
      return { investigator1, investigator2, count }
    })
    .sort((left, right) => right.count - left.count || left.investigator1.localeCompare(right.investigator1))
    .slice(0, limits.pairings ?? 200)

  return {
    totalGames: playthroughs.length,
    campaignRunsPlayedCount: campaignCountSummary.campaignRunsPlayedCount,
    uniqueCampaignFamilyCount: campaignCountSummary.uniqueCampaignFamilyCount,
    topCampaigns,
    topInvestigators,
    topClasses,
    totalInvestigatorsPlayed: uniqueInvestigators.size,
    topSideScenarios,
    topStandalones,
    completionBreakdown: campaignCountSummary.breakdown,
    topPairings,
    registeredUsers: userCount,
    lastUpdated: generatedAt,
    generatedAt,
    ...(snapshotReadAt !== undefined ? { snapshotReadAt } : {}),
    schemaVersion,
    refreshState,
    ...(sourceGeneration !== undefined ? { sourceGeneration } : {}),
    ...(pipelineGeneration !== undefined ? { pipelineGeneration } : {}),
  }
}
