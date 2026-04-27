import { Playthrough, Archetype } from './types'
import { getCommunityStatsFromFirestore, saveCommunityStats } from './firestore'

export interface CommunityStats {
  totalGames: number
  topCampaigns: { name: string; count: number; set?: string }[]
  topInvestigators: { name: string; count: number; archetypes: Archetype[] }[]
  totalInvestigatorsPlayed: number
  topSideScenarios: { name: string; count: number }[]
  topStandalones: { name: string; count: number; set?: string }[]
  registeredUsers: number
  lastUpdated: number
}

/**
 * Rebuild community stats.
 * In this Firebase version we just write a placeholder / no-op on the client.
 * A Cloud Function should do the real aggregation long-term.
 * For now the public homepage shows whatever's in the aggregate doc.
 */
export async function rebuildCommunityStats(): Promise<void> {
  // no-op on client — aggregation should be done server-side
  // We keep this export so existing call-sites don't break.
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
