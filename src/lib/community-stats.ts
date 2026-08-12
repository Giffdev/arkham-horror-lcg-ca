import { Playthrough, Archetype } from './types'
import { getCommunityStatsFromFirestore, saveCommunityStats, getAllPlaythroughs } from './firestore'
import { getCampaignSet, ALL_CAMPAIGNS, SCENARIO_PACK_SCENARIOS } from './campaign-data'
import { getInvestigatorPairKey, resolveInvestigator } from './investigator-data'

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

export interface CommunityStats {
  totalGames: number
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
}

/** Normalize a scenario/side-story name for map keying. Trim, lowercase, collapse whitespace. */
function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Rebuild community stats from ALL users' playthroughs across Firestore.
 * The local playthroughs param is ignored — we query the full collectionGroup.
 */
export async function rebuildCommunityStats(_localPlaythroughs?: Playthrough[]): Promise<CommunityStats | void> {
  try {
    const { playthroughs, userCount } = await getAllPlaythroughs()
    console.log(`[CommunityStats] Found ${playthroughs.length} playthroughs from ${userCount} users`)
    if (!playthroughs.length) return

  const campaignCounts = new Map<string, { count: number; set?: string }>()
  const investigatorCounts = new Map<string, { name: string; count: number; archetypes: Archetype[]; chapter?: 1 | 2; investigatorId?: string; investigatorSet?: string }>()
  const classCounts = new Map<Archetype, number>()
  const uniqueInvestigators = new Set<string>()
  const completionBreakdown: CompletionBreakdown = { fullCampaigns: 0, smallCampaigns: 0, scenarioPacks: 0, fanMade: 0 }
  const pairCounts = new Map<string, number>()

  // Canonical campaign names for the public ranking — user freeform text (customCampaignName,
  // or any non-canonical string) must never appear in public stats output.
  const canonicalCampaignNames = new Set(ALL_CAMPAIGNS.map(c => c.name))

  // Canonical scenario pack names for standalone lookup (lowercase key → canonical name + set)
  const canonicalStandaloneMap = new Map<string, { name: string; set: string }>()
  for (const sp of SCENARIO_PACK_SCENARIOS) {
    canonicalStandaloneMap.set(normalizeKey(sp.name), { name: sp.name, set: sp.set })
  }

  // standalone counts: key = canonical name
  const standaloneCounts = new Map<string, { name: string; set: string; asStandalone: number; asSideStory: number }>()
  // side scenario counts: key = normalized string, value = { display, count }
  const sideCounts = new Map<string, { name: string; count: number }>()

  for (const p of playthroughs) {
    // Count campaigns — exclude Scenario Pack playthroughs (they have their own card)
    if (p.campaignType !== 'Scenario Pack') {
      const effectiveName = (p.campaignName && p.campaignName.trim())
        ? p.campaignName.trim()
        : (p.customCampaignName && p.customCampaignName.trim())
          ? p.customCampaignName.trim()
          : null
      if (effectiveName && canonicalCampaignNames.has(effectiveName)) {
        const existing = campaignCounts.get(effectiveName) || { count: 0, set: getCampaignSet(effectiveName) }
        existing.count++
        campaignCounts.set(effectiveName, existing)
      }
    }

    // Count standalone scenario pack plays (asStandalone)
    if (p.campaignType === 'Scenario Pack') {
      const name = p.campaignName?.trim()
      if (name) {
        const key = normalizeKey(name)
        const canonical = canonicalStandaloneMap.get(key)
        if (canonical) {
          const entry = standaloneCounts.get(canonical.name) || { name: canonical.name, set: canonical.set, asStandalone: 0, asSideStory: 0 }
          entry.asStandalone++
          standaloneCounts.set(canonical.name, entry)
        }
      }
    }

    // Count side story appearances — only canonical scenario pack names feed topStandalones.
    // Custom user-entered side-story strings are intentionally not persisted into public aggregate output.
    if (p.sideStories && p.sideStories.length > 0) {
      for (const raw of p.sideStories) {
        const trimmed = raw?.trim()
        if (!trimmed) continue
        const key = normalizeKey(trimmed)
        const canonical = canonicalStandaloneMap.get(key)
        if (canonical) {
          const entry = standaloneCounts.get(canonical.name) || { name: canonical.name, set: canonical.set, asStandalone: 0, asSideStory: 0 }
          entry.asSideStory++
          standaloneCounts.set(canonical.name, entry)
        }
        // Count in sideCounts only for canonical entries (used for backward-compat topSideScenarios output)
        if (canonical) {
          const existing = sideCounts.get(key)
          if (existing) {
            existing.count++
          } else {
            sideCounts.set(key, { name: canonical.name, count: 1 })
          }
        }
      }
    }

    // Count completion breakdown by type
    switch (p.campaignType) {
      case 'Full Campaign': completionBreakdown.fullCampaigns++; break
      case 'Small Campaign': completionBreakdown.smallCampaigns++; break
      case 'Scenario Pack': completionBreakdown.scenarioPacks++; break
      case 'Fan-Made': completionBreakdown.fanMade++; break
    }

    // Count investigators, classes, and pairings
    const validNames: string[] = []
    for (const inv of p.investigators) {
      if (inv.isUnknown || !inv.investigatorName || inv.investigatorName === 'Unknown') continue
      const name = inv.investigatorName
      const resolved = resolveInvestigator(inv)
      const resolvedChapter = resolved?.chapter ?? inv.chapter
      const pairingName = getInvestigatorPairKey({ investigatorName: name, chapter: resolvedChapter })
      uniqueInvestigators.add(pairingName)
      if (!validNames.includes(pairingName)) validNames.push(pairingName)
      const chapter = pairingName !== name ? resolvedChapter ?? 1 : resolvedChapter
      const invEntry = investigatorCounts.get(pairingName) || {
        name,
        count: 0,
        archetypes: inv.archetypes || [inv.archetype],
        chapter: chapter as 1 | 2 | undefined,
        investigatorId: resolved?.id ?? inv.investigatorId,
        investigatorSet: resolved?.set ?? inv.investigatorSet,
      }
      invEntry.count++
      investigatorCounts.set(pairingName, invEntry)

      // Count classes
      const archetypes = inv.archetypes || (inv.archetype ? [inv.archetype] : [])
      for (const arch of archetypes) {
        if (arch && arch !== 'neutral') {
          classCounts.set(arch, (classCounts.get(arch) || 0) + 1)
        }
      }
    }

    // Generate all C(N,2) investigator pairs for this playthrough
    for (let i = 0; i < validNames.length; i++) {
      for (let j = i + 1; j < validNames.length; j++) {
        const key = validNames[i] < validNames[j]
          ? `${validNames[i]}|||${validNames[j]}`
          : `${validNames[j]}|||${validNames[i]}`
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1)
      }
    }
  }

  const topCampaigns = Array.from(campaignCounts.entries())
    .filter(([name]) => name && name.trim())
    .map(([name, data]) => {
      const entry: { name: string; count: number; set?: string } = { name, count: data.count }
      if (data.set) entry.set = data.set
      return entry
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)

  const topInvestigators = Array.from(investigatorCounts.entries())
    .map(([, data]) => {
      const entry: { name: string; count: number; archetypes: Archetype[]; chapter?: 1 | 2; investigatorId?: string; investigatorSet?: string } = {
        name: data.name, count: data.count, archetypes: data.archetypes || []
      }
      if (data.chapter) entry.chapter = data.chapter
      if (data.investigatorId) entry.investigatorId = data.investigatorId
      if (data.investigatorSet) entry.investigatorSet = data.investigatorSet
      return entry
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)

  const topClasses = Array.from(classCounts.entries())
    .map(([archetype, count]) => ({ archetype, count }))
    .sort((a, b) => b.count - a.count)

  const topStandalones = Array.from(standaloneCounts.values())
    .map(entry => ({
      name: entry.name,
      count: entry.asStandalone + entry.asSideStory,
      set: entry.set,
      breakdown: { asStandalone: entry.asStandalone, asSideStory: entry.asSideStory },
    }))
    .filter(e => e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)

  const topSideScenarios = Array.from(sideCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)

  const topPairings = Array.from(pairCounts.entries())
    .map(([key, count]) => {
      const [a, b] = key.split('|||')
      return { investigator1: a, investigator2: b, count }
    })
    .sort((a, b) => b.count - a.count || a.investigator1.localeCompare(b.investigator1))
    .slice(0, 200)

  const stats: CommunityStats = {
    totalGames: playthroughs.length,
    topCampaigns,
    topInvestigators,
    topClasses,
    totalInvestigatorsPlayed: uniqueInvestigators.size,
    topSideScenarios,
    topStandalones,
    completionBreakdown,
    topPairings,
    registeredUsers: userCount,
    lastUpdated: Date.now(),
  }

    await saveCommunityStats(stats)
    return stats
  } catch (err) {
    console.error('[CommunityStats] Failed to rebuild:', err)
  }
}

/**
 * Increment community stats after a local CRUD op.
 * This is a quick client-side patch; full accuracy comes from a Cloud Function.
 */
export async function bumpCommunityStats(delta: {
  gamesAdded?: number
  gamesRemoved?: number
}): Promise<void> {
  try {
    const existing = await getCommunityStatsFromFirestore()
    if (!existing) return
    const totalGames = Math.max(0, existing.totalGames + (delta.gamesAdded || 0) - (delta.gamesRemoved || 0))
    await saveCommunityStats({ ...existing, totalGames, lastUpdated: Date.now() })
  } catch (err) {
    console.error('Failed to bump community stats:', err)
  }
}

export async function getCommunityStats(): Promise<CommunityStats | null> {
  try {
    const stats = await getCommunityStatsFromFirestore()
    if (stats) {
      // Filter blank + non-canonical campaign names — guards against persisted aggregates
      // that were written before the canonical-only filter was introduced in rebuild.
      const canonicalNames = new Set(ALL_CAMPAIGNS.map(c => c.name))
      stats.topCampaigns = (stats.topCampaigns ?? []).filter(
        c => c.name && c.name.trim() && canonicalNames.has(c.name)
      )
      stats.topStandalones = stats.topStandalones ?? []
      stats.topSideScenarios = stats.topSideScenarios ?? []
      stats.topPairings = stats.topPairings ?? []
      stats.topClasses = stats.topClasses ?? []
    }
    return stats
  } catch (error) {
    console.error('Failed to get community stats:', error)
    return null
  }
}
