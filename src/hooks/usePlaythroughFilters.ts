import { useState, useMemo } from 'react'
import { Archetype, CampaignType, Playthrough } from '@/lib/types'
import { getRecordCampaignNames, getRecordCampaignTypes } from '@/lib/campaign-play-history'

export function usePlaythroughFilters(playthroughs: Playthrough[] | undefined) {
  const [selectedArchetypes, setSelectedArchetypes] = useState<Archetype[]>([])
  const [selectedCampaignTypes, setSelectedCampaignTypes] = useState<CampaignType[]>([])
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])

  const filteredPlaythroughs = useMemo(() => {
    if (!playthroughs) return []

    return playthroughs.filter((playthrough) => {
      if (selectedArchetypes.length > 0) {
        const hasMatchingArchetype = playthrough.investigators.some((inv) => {
          const investigatorArchetypes = inv.archetypes || [inv.archetype]
          return investigatorArchetypes.some(archetype => selectedArchetypes.includes(archetype))
        })
        if (!hasMatchingArchetype) return false
      }

      if (selectedCampaignTypes.length > 0) {
        if (!getRecordCampaignTypes(playthrough).some(type => selectedCampaignTypes.includes(type))) {
          return false
        }
      }

      if (selectedCampaigns.length > 0) {
        if (!getRecordCampaignNames(playthrough).some(name => selectedCampaigns.includes(name))) {
          return false
        }
      }

      return true
    })
  }, [playthroughs, selectedArchetypes, selectedCampaignTypes, selectedCampaigns])

  const handleArchetypeToggle = (archetype: Archetype) => {
    setSelectedArchetypes((current) =>
      current.includes(archetype)
        ? current.filter((a) => a !== archetype)
        : [...current, archetype]
    )
  }

  const handleCampaignTypeToggle = (type: CampaignType) => {
    setSelectedCampaignTypes((current) =>
      current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type]
    )
    if (selectedCampaignTypes.includes(type)) {
      setSelectedCampaigns([])
    }
  }

  const handleCampaignToggle = (campaign: string) => {
    setSelectedCampaigns((current) =>
      current.includes(campaign)
        ? current.filter((c) => c !== campaign)
        : [...current, campaign]
    )
  }

  const handleClearFilters = () => {
    setSelectedArchetypes([])
    setSelectedCampaignTypes([])
    setSelectedCampaigns([])
  }

  return {
    filters: {
      selectedArchetypes,
      selectedCampaignTypes,
      selectedCampaigns,
    },
    handlers: {
      onArchetypeToggle: handleArchetypeToggle,
      onCampaignTypeToggle: handleCampaignTypeToggle,
      onCampaignToggle: handleCampaignToggle,
      onClearFilters: handleClearFilters,
    },
    filteredPlaythroughs,
  }
}
