import { useEffect, useRef } from 'react'
import { Playthrough } from '@/lib/types'
import { resolveInvestigator } from '@/lib/investigator-data'

export function useLegacyDataMigration(
  playthroughs: Playthrough[] | undefined,
  updatePlaythrough: (playthrough: Playthrough) => Promise<void>
) {
  const hasMigratedRef = useRef(false)

  useEffect(() => {
    if (hasMigratedRef.current) return
    if (!playthroughs || playthroughs.length === 0) return

    const toUpdate: Playthrough[] = []

    for (const playthrough of playthroughs) {
      let changed = false
      const updates: Partial<Playthrough> = {}

      if (playthrough.campaignType === 'Standalone' as any) {
        updates.campaignType = 'Scenario Pack'
        changed = true
      }

      if (
        (playthrough.campaignName === 'The Night of the Zealot' ||
         playthrough.campaignName === 'Return to The Night of the Zealot') &&
        playthrough.campaignType === 'Full Campaign'
      ) {
        updates.campaignType = 'Small Campaign'
        changed = true
      }

      const updatedInvestigators = playthrough.investigators.map(inv => {
        if (inv.isCustom || inv.isUnknown || inv.investigatorName === 'Unknown') return inv
        const data = resolveInvestigator(inv)
        const invUpdates: Partial<typeof inv> = {}
        if (!inv.investigatorSet && data) { invUpdates.investigatorSet = data.set; changed = true }
        if (!inv.archetypes && data) { invUpdates.archetypes = data.archetypes; changed = true }
        if (!inv.investigatorId && data) { invUpdates.investigatorId = data.id; invUpdates.chapter = data.chapter; changed = true }
        return Object.keys(invUpdates).length ? { ...inv, ...invUpdates } : inv
      })

      if (changed) {
        toUpdate.push({ ...playthrough, ...updates, investigators: updatedInvestigators })
      }
    }

    hasMigratedRef.current = true
    if (toUpdate.length > 0) {
      Promise.all(toUpdate.map(p => updatePlaythrough(p))).catch(console.error)
    }
  }, [playthroughs]) // eslint-disable-line react-hooks/exhaustive-deps
}
