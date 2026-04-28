import { useMemo } from 'react'
import { Playthrough } from '@/lib/types'

export interface CompletionBreakdown {
  fullCampaigns: number
  smallCampaigns: number
  scenarioPacks: number
  fanMade: number
}

export interface CompletionStats {
  total: number
  breakdown: CompletionBreakdown
}

function computeStats(playthroughs: Playthrough[]): CompletionStats {
  const breakdown: CompletionBreakdown = {
    fullCampaigns: 0,
    smallCampaigns: 0,
    scenarioPacks: 0,
    fanMade: 0,
  }

  for (const p of playthroughs) {
    switch (p.campaignType) {
      case 'Full Campaign':
        breakdown.fullCampaigns++
        break
      case 'Small Campaign':
        breakdown.smallCampaigns++
        break
      case 'Scenario Pack':
        breakdown.scenarioPacks++
        break
      case 'Fan-Made':
        breakdown.fanMade++
        break
    }
  }

  return {
    total: playthroughs.length,
    breakdown,
  }
}

/**
 * Computes campaign completion statistics from the user's playthrough data.
 */
export function useCompletionStats(
  personalPlaythroughs: Playthrough[] | undefined,
): { personal: CompletionStats } {
  const personal = useMemo(() => {
    if (!personalPlaythroughs || personalPlaythroughs.length === 0) {
      return { total: 0, breakdown: { fullCampaigns: 0, smallCampaigns: 0, scenarioPacks: 0, fanMade: 0 } }
    }
    return computeStats(personalPlaythroughs)
  }, [personalPlaythroughs])

  return { personal }
}
