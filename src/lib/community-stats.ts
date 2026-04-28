import { Playthrough, Archetype } from './types'
import { getCommunityStatsFromFirestore, saveCommunityStats, getAllPlaythroughs } from './firestore'
import { getCampaignSet } from './campaign-data'

export interface CommunityStats {
  totalGames: number
  topCampaigns: { name: string; count: number; set?: string }[]
  topInvestigators: { name: string; count: number; archetypes: Archetype[]; chapter?: 1 | 2 }[]
  totalInvestigatorsPlayed: number
  topSideScenarios: { name: string; count: number }[]
  topStandalones: { name: string; count: number; set?: string }[]
  registeredUsers: number
  lastUpdated: number
}

/**
 * Rebuild community stats from ALL users' playthroughs across Firestore.
 * The local playthroughs param is ignored — we query the full collectionGroup.
 */
export async function rebuildCommunityStats(_localPlaythroughs?: Playthrough[]): Promise<void> {
  const { playthroughs, userCount } = await getAllPlaythroughs()
  if (!playthroughs.length) return

  const campaignCounts = new Map<string, { count: number; set?: string }>()
  const investigatorCounts = new Map<string, { count: number; archetypes: Archetype[]; chapter?: 1 | 2 }>()
  const uniqueInvestigators = new Set<string>()

  for (const p of playthroughs) {
    // Count campaigns
    const existing = campaignCounts.get(p.campaignName) || { count: 0, set: getCampaignSet(p.campaignName) }
    existing.count++
    campaignCounts.set(p.campaignName, existing)

    // Count investigators
    for (const inv of p.investigators) {
      if (inv.isUnknown || !inv.investigatorName || inv.investigatorName === 'Unknown') continue
      const name = inv.investigatorName
      uniqueInvestigators.add(name)
      const invEntry = investigatorCounts.get(name) || { count: 0, archetypes: inv.archetypes || [inv.archetype], chapter: inv.chapter as 1 | 2 | undefined }
      invEntry.count++
      investigatorCounts.set(name, invEntry)
    }
  }

  const topCampaigns = Array.from(campaignCounts.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const topInvestigators = Array.from(investigatorCounts.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const stats: CommunityStats = {
    totalGames: playthroughs.length,
    topCampaigns,
    topInvestigators,
    totalInvestigatorsPlayed: uniqueInvestigators.size,
    topSideScenarios: [],
    topStandalones: [],
    registeredUsers: userCount,
    lastUpdated: Date.now(),
  }

  await saveCommunityStats(stats)
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
    return await getCommunityStatsFromFirestore()
  } catch (error) {
    console.error('Failed to get community stats:', error)
    return null
  }
}
