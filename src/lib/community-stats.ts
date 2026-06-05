import { Playthrough, Archetype } from './types'
import { getCommunityStatsFromFirestore, saveCommunityStats, getAllPlaythroughs } from './firestore'
import { getCampaignSet } from './campaign-data'

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

export interface CommunityStats {
  totalGames: number
  topCampaigns: { name: string; count: number; set?: string }[]
  topInvestigators: { name: string; count: number; archetypes: Archetype[]; chapter?: 1 | 2 }[]
  topClasses: { archetype: Archetype; count: number }[]
  totalInvestigatorsPlayed: number
  topSideScenarios: { name: string; count: number }[]
  topStandalones: { name: string; count: number; set?: string }[]
  completionBreakdown?: CompletionBreakdown
  topPairings?: CommunityPairing[]
  registeredUsers: number
  lastUpdated: number
}

/**
 * Rebuild community stats from ALL users' playthroughs across Firestore.
 * The local playthroughs param is ignored — we query the full collectionGroup.
 */
export async function rebuildCommunityStats(_localPlaythroughs?: Playthrough[]): Promise<void> {
  try {
    const { playthroughs, userCount } = await getAllPlaythroughs()
    console.log(`[CommunityStats] Found ${playthroughs.length} playthroughs from ${userCount} users`)
    if (!playthroughs.length) return

  const campaignCounts = new Map<string, { count: number; set?: string }>()
  const investigatorCounts = new Map<string, { count: number; archetypes: Archetype[]; chapter?: 1 | 2 }>()
  const classCounts = new Map<Archetype, number>()
  const uniqueInvestigators = new Set<string>()
  const completionBreakdown: CompletionBreakdown = { fullCampaigns: 0, smallCampaigns: 0, scenarioPacks: 0, fanMade: 0 }
  const pairCounts = new Map<string, number>()

  for (const p of playthroughs) {
    // Count campaigns - use customCampaignName as fallback for legacy Fan-Made entries
    const effectiveName = (p.campaignName && p.campaignName.trim()) 
      ? p.campaignName.trim()
      : (p.customCampaignName && p.customCampaignName.trim()) 
        ? p.customCampaignName.trim() 
        : null
    if (effectiveName) {
      const existing = campaignCounts.get(effectiveName) || { count: 0, set: getCampaignSet(effectiveName) }
      existing.count++
      campaignCounts.set(effectiveName, existing)
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
      uniqueInvestigators.add(name)
      if (!validNames.includes(name)) validNames.push(name)
      const invEntry = investigatorCounts.get(name) || { count: 0, archetypes: inv.archetypes || [inv.archetype], chapter: inv.chapter as 1 | 2 | undefined }
      invEntry.count++
      investigatorCounts.set(name, invEntry)

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
    .slice(0, 10)

  const topInvestigators = Array.from(investigatorCounts.entries())
    .map(([name, data]) => {
      const entry: { name: string; count: number; archetypes: Archetype[]; chapter?: 1 | 2 } = {
        name, count: data.count, archetypes: data.archetypes || []
      }
      if (data.chapter) entry.chapter = data.chapter
      return entry
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const topClasses = Array.from(classCounts.entries())
    .map(([archetype, count]) => ({ archetype, count }))
    .sort((a, b) => b.count - a.count)

  const topPairings = Array.from(pairCounts.entries())
    .map(([key, count]) => {
      const [a, b] = key.split('|||')
      return { investigator1: a, investigator2: b, count }
    })
    .sort((a, b) => b.count - a.count || a.investigator1.localeCompare(b.investigator1))

  const stats: CommunityStats = {
    totalGames: playthroughs.length,
    topCampaigns,
    topInvestigators,
    topClasses,
    totalInvestigatorsPlayed: uniqueInvestigators.size,
    topSideScenarios: [],
    topStandalones: [],
    completionBreakdown,
    topPairings,
    registeredUsers: userCount,
    lastUpdated: Date.now(),
  }

    await saveCommunityStats(stats)
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
      // Filter out any blank campaign names that may have been stored previously
      stats.topCampaigns = stats.topCampaigns.filter(c => c.name && c.name.trim())
    }
    return stats
  } catch (error) {
    console.error('Failed to get community stats:', error)
    return null
  }
}
