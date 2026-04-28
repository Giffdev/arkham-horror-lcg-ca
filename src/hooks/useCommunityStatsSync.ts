import { useEffect } from 'react'
import { Playthrough } from '@/lib/types'
import { rebuildCommunityStats } from '@/lib/community-stats'

export function useCommunityStatsSync(playthroughs: Playthrough[] | undefined) {
  useEffect(() => {
    if (playthroughs && playthroughs.length > 0) {
      rebuildCommunityStats(playthroughs).catch(console.error)
    }
  }, [playthroughs])
}
