import { useMemo } from 'react'
import { computeCampaignCountSummary } from '@/lib/campaign-runs'
import { CampaignRun, Playthrough } from '@/lib/types'

export interface CompletionBreakdown {
  fullCampaigns: number
  smallCampaigns: number
  scenarioPacks: number
  fanMade: number
}

export interface CompletionStats {
  total: number
  campaignRunsPlayedCount: number
  uniqueCampaignFamilyCount: number
  breakdown: CompletionBreakdown
}

function emptyStats(): CompletionStats {
  return {
    total: 0,
    campaignRunsPlayedCount: 0,
    uniqueCampaignFamilyCount: 0,
    breakdown: { fullCampaigns: 0, smallCampaigns: 0, scenarioPacks: 0, fanMade: 0 },
  }
}

/**
 * Computes campaign completion statistics from the user's playthrough data.
 */
export function useCompletionStats(
  personalPlaythroughs: Playthrough[] | undefined,
  campaignRuns: CampaignRun[] = [],
): { personal: CompletionStats } {
  const personal = useMemo(() => {
    if ((!personalPlaythroughs || personalPlaythroughs.length === 0) && campaignRuns.length === 0) {
      return emptyStats()
    }
    const summary = computeCampaignCountSummary(personalPlaythroughs ?? [], campaignRuns)
    return {
      total: summary.campaignRunsPlayedCount,
      campaignRunsPlayedCount: summary.campaignRunsPlayedCount,
      uniqueCampaignFamilyCount: summary.uniqueCampaignFamilyCount,
      breakdown: summary.breakdown,
    }
  }, [campaignRuns, personalPlaythroughs])

  return { personal }
}
