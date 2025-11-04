import { Button } from '@/components/ui/button'
import { Archetype, CampaignType, ARCHETYPES, CAMPAIGN_TYPES, Playthrough } from '@/lib/types'
import { Funnel, X } from '@phosphor-icons/react'
import { getFullCampaignNames, getStandaloneCampaignNames } from '@/lib/campaign-data'
import { useMemo, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'

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

function FilterContent({
  selectedArchetypes,
  selectedCampaignTypes,
  selectedCampaigns,
  onArchetypeToggle,
  onCampaignTypeToggle,
  onCampaignToggle,
  playthroughs
}: Omit<FiltersProps, 'onClearFilters'>) {
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
  )
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
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const hasActiveFilters = selectedArchetypes.length > 0 || selectedCampaignTypes.length > 0 || selectedCampaigns.length > 0
  const activeFilterCount = selectedArchetypes.length + selectedCampaignTypes.length + selectedCampaigns.length

  if (isMobile) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 justify-between">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 flex-1">
                <Funnel size={16} />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Funnel size={20} />
                  Filter Games
                </SheetTitle>
              </SheetHeader>
              <div className="py-4">
                <FilterContent
                  selectedArchetypes={selectedArchetypes}
                  selectedCampaignTypes={selectedCampaignTypes}
                  selectedCampaigns={selectedCampaigns}
                  onArchetypeToggle={onArchetypeToggle}
                  onCampaignTypeToggle={onCampaignTypeToggle}
                  onCampaignToggle={onCampaignToggle}
                  playthroughs={playthroughs}
                />
              </div>
              {hasActiveFilters && (
                <div className="sticky bottom-0 bg-background border-t pt-4 -mx-4 px-4 pb-4">
                  <Button 
                    onClick={() => {
                      onClearFilters()
                      setOpen(false)
                    }} 
                    variant="outline" 
                    className="w-full gap-2"
                  >
                    <X size={16} />
                    Clear All Filters
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="gap-2 flex-shrink-0"
            >
              <X size={16} />
              Clear
            </Button>
          )}
        </div>
        
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {selectedArchetypes.map((archetype) => (
              <Badge key={archetype} variant="secondary" className="gap-1">
                {archetype}
                <button
                  onClick={() => onArchetypeToggle(archetype)}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full"
                >
                  <X size={12} />
                </button>
              </Badge>
            ))}
            {selectedCampaignTypes.map((type) => (
              <Badge key={type} variant="secondary" className="gap-1">
                {type}
                <button
                  onClick={() => onCampaignTypeToggle(type)}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full"
                >
                  <X size={12} />
                </button>
              </Badge>
            ))}
            {selectedCampaigns.map((campaign) => (
              <Badge key={campaign} variant="secondary" className="gap-1">
                {campaign}
                <button
                  onClick={() => onCampaignToggle(campaign)}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full"
                >
                  <X size={12} />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Funnel size={16} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filter by:</span>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="ml-auto gap-2 h-7 text-xs"
          >
            <X size={14} />
            Clear All
          </Button>
        )}
      </div>

      <FilterContent
        selectedArchetypes={selectedArchetypes}
        selectedCampaignTypes={selectedCampaignTypes}
        selectedCampaigns={selectedCampaigns}
        onArchetypeToggle={onArchetypeToggle}
        onCampaignTypeToggle={onCampaignTypeToggle}
        onCampaignToggle={onCampaignToggle}
        playthroughs={playthroughs}
      />
    </div>
  )
}
