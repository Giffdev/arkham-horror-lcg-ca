import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Archetype, CampaignType, ARCHETYPES, CAMPAIGN_TYPES, ARCHETYPE_COLORS } from '@/lib/types'
import { X, Funnel } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Funnel size={20} weight="duotone" className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="gap-2"
          >
            <X size={16} />
            Clear All
          </Button>
        )}
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Archetypes</Label>
          <div className="flex flex-wrap gap-2">
            {ARCHETYPES.filter(archetype => archetype !== 'Unknown').map((archetype) => {
              const isSelected = selectedArchetypes.includes(archetype)
              return (
                <Badge
                  key={archetype}
                  variant={isSelected ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-all hover:scale-105 px-3 py-1',
                    isSelected && ARCHETYPE_COLORS[archetype]
                  )}
                  onClick={() => onArchetypeToggle(archetype)}
                >
                  {archetype}
                </Badge>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Campaign Types</Label>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_TYPES.map((type) => {
              const isSelected = selectedCampaignTypes.includes(type)
              return (
                <Badge
                  key={type}
                  variant={isSelected ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-all hover:scale-105 px-3 py-1',
                    isSelected && 'bg-primary text-primary-foreground'
                  )}
                  onClick={() => onCampaignTypeToggle(type)}
                >
                  {type}
                </Badge>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
