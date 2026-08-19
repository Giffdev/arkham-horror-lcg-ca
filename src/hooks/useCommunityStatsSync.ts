import { useEffect } from 'react'
import type { Playthrough } from '@/lib/types'
import { type CommunityStats, subscribeToCommunityStats } from '@/lib/community-stats'
import { requestCommunityStatsRefresh } from '@/lib/community-stats-wake'

export function useCommunityStatsSync(
  _playthroughs: Playthrough[] | undefined,
  onSync?: (stats: CommunityStats | null) => void,
) {
  useEffect(() => {
    void requestCommunityStatsRefresh()
    const unsubscribe = subscribeToCommunityStats(
      (stats) => {
        if (onSync) onSync(stats)
      },
      (error) => {
        console.error('Failed to sync community stats:', error)
      },
    )

    return () => unsubscribe()
  }, [onSync])
}
