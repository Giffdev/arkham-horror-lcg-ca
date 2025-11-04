import { Button } from '@/components/ui/button'
import { Archetype, CampaignType, ARCHETYPES, CAMPAIGN_TYPES, Playthrough } from '@/lib/types'
import { Funnel } from '@phosphor-icons/react'
import { getFullCampaignNames, getStandaloneCampaignNames } from '@/lib/campaign-data'
import { useMemo } from 'react'

interface FiltersProps {
  selectedArchetypes: Archetype[]
  selectedCampaignTypes: CampaignType[]
  selectedCampaigns: string[]
  onArchetypeToggle: (archetype: Archetype) => void
  onCampaignTypeToggle: (type: CampaignType) => void
  onCampaignToggle: (campaign: string) => void
  onClearFilters: () => void
  playthroughs: Playthrough[]
}

export function Filters({
  selectedArchetypes,
  selectedCampaignTypes,
  selectedCampaigns,
  onArchetypeToggle,
  onCampaignTypeToggle,
  onCampaignToggle,
  onClearFilters,
  playthroughs
}: FiltersProps) {
  const hasActiveFilters = selectedArchetypes.length > 0 || selectedCampaignTypes.length > 0 || selectedCampaigns.length > 0

  const campaignTypeCounts = useMemo(() => {
    const counts: Record<CampaignType, number> = {
      'Full Campaign': 0,
      'Standalone': 0,
      'Fan-Made': 0,
      'Unknown': 0
    }
    playthroughs.forEach(p => {
      counts[p.campaignType] = (counts[p.campaignType] || 0) + 1
    })
    return counts
  }, [playthroughs])

  const availableCampaigns = useMemo(() => {
    if (selectedCampaignTypes.length === 0) return []
    
    if (selectedCampaignTypes.includes('Full Campaign')) {
      return getFullCampaignNames()
    } else if (selectedCampaignTypes.includes('Standalone')) {
      return getStandaloneCampaignNames()
    }
    return []
  }, [selectedCampaignTypes])

  const specificCampaignCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    playthroughs.forEach(p => {
      if (selectedCampaignTypes.includes(p.campaignType)) {
        const campaignName = p.customCampaignName || p.campaignName
        counts[campaignName] = (counts[campaignName] || 0) + 1
      }
    })
    return counts
  }, [playthroughs, selectedCampaignTypes])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Funnel size={16} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filter by:</span>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Class</p>
            {selectedArchetypes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  selectedArchetypes.forEach(archetype => onArchetypeToggle(archetype))
                }}
                className="h-6 text-xs px-2"
              >
                Clear
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ARCHETYPES.filter(archetype => archetype !== 'Unknown').map((archetype) => {
              const isSelected = selectedArchetypes.includes(archetype)
              return (
                <Button
                  key={archetype}
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => onArchetypeToggle(archetype)}
                >
                  {archetype}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Campaign Type</p>
            {selectedCampaignTypes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  selectedCampaignTypes.forEach(type => onCampaignTypeToggle(type))
                  selectedCampaigns.forEach(campaign => onCampaignToggle(campaign))
                }}
                className="h-6 text-xs px-2"
              >
                Clear
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_TYPES.map((type) => {
              const isSelected = selectedCampaignTypes.includes(type)
              const count = campaignTypeCounts[type]
              return (
                <Button
                  key={type}
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => onCampaignTypeToggle(type)}
                  className="gap-2"
                >
                  {type}
                  <span className={`text-xs ${isSelected ? 'opacity-80' : 'text-muted-foreground'}`}>
                    ({count})
                  </span>
                </Button>
              )
            })}
          </div>
        </div>

        {availableCampaigns.length > 0 && selectedCampaignTypes.length === 1 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Specific Campaign</p>
              {selectedCampaigns.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    selectedCampaigns.forEach(campaign => onCampaignToggle(campaign))
                  }}
                  className="h-6 text-xs px-2"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableCampaigns.map((campaign) => {
                const isSelected = selectedCampaigns.includes(campaign)
                const count = specificCampaignCounts[campaign] || 0
                if (count === 0) return null
                return (
                  <Button
                    key={campaign}
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => onCampaignToggle(campaign)}
                    className="gap-2"
                  >
                    {campaign}
                    <span className={`text-xs ${isSelected ? 'opacity-80' : 'text-muted-foreground'}`}>
                      ({count})
                    </span>
                  </Button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
