import { Button } from '@/components/ui/button'
import { Archetype, CampaignType, ARCHETYPES, CAMPAIGN_TYPES } from '@/lib/types'
import { Funnel } from '@phosphor-icons/react'

interface FiltersProps {
  selectedArchetypes: Archetype[]
  selectedCampaignTypes: CampaignType[]
  onArchetypeToggle: (archetype: Archetype) => void
  onCampaignTypeToggle: (type: CampaignType) => void
  onClearFilters: () => void
}

export function Filters({
  selectedArchetypes,
  selectedCampaignTypes,
  onArchetypeToggle,
  onCampaignTypeToggle,
  onClearFilters
}: FiltersProps) {
  const hasActiveFilters = selectedArchetypes.length > 0 || selectedCampaignTypes.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Funnel size={16} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filter by:</span>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Class</p>
            {selectedArchetypes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onClearFilters()}
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
            <p className="text-sm font-medium">Campaign</p>
            {selectedCampaignTypes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onClearFilters()}
                className="h-6 text-xs px-2"
              >
                Clear
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_TYPES.map((type) => {
              const isSelected = selectedCampaignTypes.includes(type)
              return (
                <Button
                  key={type}
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => onCampaignTypeToggle(type)}
                >
                  {type}
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
