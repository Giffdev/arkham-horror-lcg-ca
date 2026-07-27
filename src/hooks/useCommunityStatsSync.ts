import { useEffect } from 'react'
import { Playthrough } from '@/lib/types'
import { rebuildCommunityStats, CommunityStats } from '@/lib/community-stats'

export function useCommunityStatsSync(
  playthroughs: Playthrough[] | undefined,
  onRebuilt?: (stats: CommunityStats) => void
) {
  useEffect(() => {
    if (playthroughs && playthroughs.length > 0) {
      rebuildCommunityStats(playthroughs)
        .then(stats => { if (stats && onRebuilt) onRebuilt(stats) })
        .catch(console.error)
    }
  }, [playthroughs, onRebuilt])
}
