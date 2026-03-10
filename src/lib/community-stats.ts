import { Playthrough, Archetype } from './types'

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

const COMMUNITY_STATS_KEY = 'public:community-stats'

export async function rebuildCommunityStats(): Promise<void> {
  try {
    const allKeys = await spark.kv.keys()
    const playthroughKeys = allKeys.filter(key => key.includes('playthroughs') && !key.includes('migration') && !key.includes('public:'))
    const userKeys = allKeys.filter(key => key.startsWith('user:') && !key.includes(':password') && key.includes('@'))
    
    const campaignCounts = new Map<string, { count: number; set?: string }>()
    const investigatorCounts = new Map<string, { count: number; archetypes: Archetype[] }>()
    const sideScenarioCounts = new Map<string, number>()
    const standaloneCounts = new Map<string, { count: number; set?: string }>()
    let totalGames = 0
    
    for (const key of playthroughKeys) {
      const playthroughs = await spark.kv.get<Playthrough[]>(key)
      if (!playthroughs || !Array.isArray(playthroughs)) continue
      
      totalGames += playthroughs.length
      
      for (const playthrough of playthroughs) {
        if (playthrough.campaignName && playthrough.campaignName !== 'Unknown' && playthrough.campaignName !== 'Unknown Campaign') {
          const existing = campaignCounts.get(playthrough.campaignName) || { count: 0, set: playthrough.campaignSet }
          campaignCounts.set(playthrough.campaignName, {
            count: existing.count + 1,
            set: existing.set || playthrough.campaignSet
          })

          if (playthrough.campaignType === 'Scenario Pack') {
            const existingStandalone = standaloneCounts.get(playthrough.campaignName) || { count: 0, set: playthrough.campaignSet }
            standaloneCounts.set(playthrough.campaignName, {
              count: existingStandalone.count + 1,
              set: existingStandalone.set || playthrough.campaignSet
            })
          }
        }

        if (playthrough.sideStories && Array.isArray(playthrough.sideStories) && playthrough.sideStories.length > 0) {
          for (const sideStory of playthrough.sideStories) {
            if (sideStory && typeof sideStory === 'string' && sideStory.trim()) {
              const count = sideScenarioCounts.get(sideStory) || 0
              sideScenarioCounts.set(sideStory, count + 1)
            }
          }
        }

        for (const inv of playthrough.investigators || []) {
          if (inv.investigatorName && inv.investigatorName !== 'Unknown' && !inv.isCustom) {
            const existing = investigatorCounts.get(inv.investigatorName) || { 
              count: 0, 
              archetypes: inv.archetypes || [inv.archetype] 
            }
            investigatorCounts.set(inv.investigatorName, {
              count: existing.count + 1,
              archetypes: existing.archetypes
            })
          }
        }
      }
    }

    const topCampaigns = Array.from(campaignCounts.entries())
      .map(([name, data]) => ({ name, count: data.count, set: data.set }))
      .sort((a, b) => b.count - a.count)

    const topInvestigators = Array.from(investigatorCounts.entries())
      .map(([name, data]) => ({ name, count: data.count, archetypes: data.archetypes }))
      .sort((a, b) => b.count - a.count)

    const topSideScenarios = Array.from(sideScenarioCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    const topStandalones = Array.from(standaloneCounts.entries())
      .map(([name, data]) => ({ name, count: data.count, set: data.set }))
      .sort((a, b) => b.count - a.count)

    const newStats: CommunityStats = {
      totalGames,
      topCampaigns,
      topInvestigators,
      totalInvestigatorsPlayed: investigatorCounts.size,
      topSideScenarios,
      topStandalones,
      registeredUsers: userKeys.length,
      lastUpdated: Date.now()
    }

    await spark.kv.set(COMMUNITY_STATS_KEY, newStats)
  } catch (error) {
    console.error('Failed to rebuild community stats:', error)
  }
}

export async function getCommunityStats(): Promise<CommunityStats | null> {
  try {
    const stats = await spark.kv.get<CommunityStats>(COMMUNITY_STATS_KEY)
    return stats || null
  } catch (error) {
    console.error('Failed to get community stats:', error)
    return null
  }
}
