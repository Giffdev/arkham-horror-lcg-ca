import { Playthrough, Archetype } from '@/lib/types'
import { BookOpen } from '@phosphor-icons/react'
import { PlaythroughCard } from '@/components/PlaythroughCard'
import { EmptyState } from '@/components/EmptyState'
import { Filters } from '@/components/Filters'

interface GamesTabProps {
  isLoading: boolean
  playthroughs: Playthrough[] | undefined
  filteredPlaythroughs: Playthrough[]
  filters: {
    selectedArchetypes: Archetype[]
    selectedCampaignTypes: import('@/lib/types').CampaignType[]
    selectedCampaigns: string[]
  }
  filterHandlers: {
    onArchetypeToggle: (archetype: Archetype) => void
    onCampaignTypeToggle: (type: import('@/lib/types').CampaignType) => void
    onCampaignToggle: (campaign: string) => void
    onClearFilters: () => void
  }
  onEdit: (playthrough: Playthrough) => void
  onDelete: (id: string) => void
}

export function GamesTab({
  isLoading,
  playthroughs,
  filteredPlaythroughs,
  filters,
  filterHandlers,
  onEdit,
  onDelete,
}: GamesTabProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <BookOpen size={48} className="text-primary mb-4 animate-pulse" weight="duotone" />
        <p className="text-muted-foreground">Loading playthroughs...</p>
      </div>
    )
  }

  return (
    <>
      <Filters
        selectedArchetypes={filters.selectedArchetypes}
        selectedCampaignTypes={filters.selectedCampaignTypes}
        selectedCampaigns={filters.selectedCampaigns}
        onArchetypeToggle={filterHandlers.onArchetypeToggle}
        onCampaignTypeToggle={filterHandlers.onCampaignTypeToggle}
        onCampaignToggle={filterHandlers.onCampaignToggle}
        onClearFilters={filterHandlers.onClearFilters}
        playthroughs={playthroughs || []}
      />

      {playthroughs && playthroughs.length === 0 ? (
        <EmptyState />
      ) : filteredPlaythroughs.length === 0 && playthroughs && playthroughs.length > 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            No playthroughs match your selected filters.
          </p>
        </div>
      ) : playthroughs && playthroughs.length > 0 ? (
        <div className="space-y-3">
          {filteredPlaythroughs.map((playthrough) => (
            <PlaythroughCard
              key={playthrough.id}
              playthrough={playthrough}
              onEdit={onEdit}
              onDelete={onDelete}
              activeArchetypeFilters={filters.selectedArchetypes}
            />
          ))}
        </div>
      ) : null}
    </>
  )
}
