import { Playthrough, Archetype, CampaignRun, CampaignScenarioLog } from '@/lib/types'
import { PlaythroughCard } from '@/components/PlaythroughCard'
import { PlaythroughCardSkeleton } from '@/components/PlaythroughCardSkeleton'
import { EmptyState } from '@/components/EmptyState'
import { Filters } from '@/components/Filters'
import { CampaignRunCard } from '@/components/CampaignRunCard'
import type { TopLevelGameRow } from '@/lib/top-level-game-rows'

interface GamesTabProps {
  isLoading: boolean
  playthroughs: Playthrough[] | undefined
  campaignRuns: CampaignRun[]
  topLevelRows: TopLevelGameRow[]
  filteredTopLevelRows: TopLevelGameRow[]
  filterPlaythroughs: Playthrough[]
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
  onContinueCampaign?: (playthrough: Playthrough) => void
  onContinueCampaignRun: (campaignRun: CampaignRun) => void
  onEditCampaignRun: (campaignRun: CampaignRun) => void
  onDeleteCampaignRun: (campaignRun: CampaignRun) => void
  onEditCampaignScenario: (campaignRun: CampaignRun, scenarioLog: CampaignScenarioLog) => void
  onDeleteCampaignScenario: (campaignRun: CampaignRun, scenarioLog: CampaignScenarioLog) => void
  expandedCampaignRunIds: Set<string>
  onToggleCampaignRunExpanded: (campaignRunId: string) => void
  onDelete: (id: string) => void
}

export function GamesTab({
  isLoading,
  playthroughs,
  campaignRuns,
  topLevelRows,
  filteredTopLevelRows,
  filterPlaythroughs,
  filters,
  filterHandlers,
  onEdit,
  onContinueCampaign,
  onContinueCampaignRun,
  onEditCampaignRun,
  onDeleteCampaignRun,
  onEditCampaignScenario,
  onDeleteCampaignScenario,
  expandedCampaignRunIds,
  onToggleCampaignRunExpanded,
  onDelete,
}: GamesTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <PlaythroughCardSkeleton key={i} />
        ))}
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
        playthroughs={filterPlaythroughs}
      />
      {topLevelRows.length === 0 ? (
        <EmptyState />
      ) : filteredTopLevelRows.length === 0 && topLevelRows.length > 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            No campaign logs match your filters.
          </p>
        </div>
      ) : topLevelRows.length > 0 ? (
        <div className="space-y-3">
          {filteredTopLevelRows.map((row) => {
            if (row.kind === 'campaign-run') {
              return (
                <CampaignRunCard
                  key={row.key}
                  campaignRun={row.campaignRun}
                  isExpanded={expandedCampaignRunIds.has(row.campaignRun.id)}
                  onToggleExpanded={onToggleCampaignRunExpanded}
                  onContinue={onContinueCampaignRun}
                  onEditRun={onEditCampaignRun}
                  onDeleteRun={onDeleteCampaignRun}
                  onEditScenario={onEditCampaignScenario}
                  onDeleteScenario={onDeleteCampaignScenario}
                />
              )
            }

            return (
              <PlaythroughCard
                key={row.key}
                playthrough={row.playthrough}
                onEdit={onEdit}
                onContinueCampaign={onContinueCampaign}
                onDelete={onDelete}
                activeArchetypeFilters={filters.selectedArchetypes}
              />
            )
          })}
        </div>
      ) : null}
    </>
  )
}
