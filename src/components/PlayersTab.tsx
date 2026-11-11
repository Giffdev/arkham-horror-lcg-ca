import { useState } from 'react'
import { CampaignRun, Playthrough } from '@/lib/types'
import { cn } from '@/lib/utils'
import { BookOpen, User, UsersThree } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PlayerStats } from '@/components/PlayerStats'
import { PlayersOverview } from '@/components/PlayersOverview'
import { PlayerCampaigns, type PlayerCampaignFilters } from '@/components/PlayerCampaigns'
import { PlayerDrilldowns } from '@/components/PlayerDrilldowns'

interface PlayersTabProps {
  isLoading: boolean
  playthroughs: Playthrough[] | undefined
  allPlayers: string[]
  selectedPlayer: string | null
  onSelectPlayer: (player: string | null) => void
  campaignPlaythroughs?: Playthrough[]
  campaignRuns?: CampaignRun[]
}

export function PlayersTab({ isLoading, playthroughs, allPlayers, selectedPlayer, onSelectPlayer, campaignPlaythroughs, campaignRuns = [] }: PlayersTabProps) {
  const [drilldownView, setDrilldownView] = useState('investigators')
  const [campaignFilters, setCampaignFilters] = useState<PlayerCampaignFilters>({ view: 'played', scope: 'all', search: '' })
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <BookOpen size={48} className="text-primary mb-4 animate-pulse" weight="duotone" />
        <p className="text-muted-foreground">Loading playthroughs...</p>
      </div>
    )
  }

  if (!playthroughs) return null

  const campaigns = <PlayerCampaigns playerName={selectedPlayer} playthroughs={campaignPlaythroughs ?? playthroughs}
    campaignRuns={campaignRuns} filters={campaignFilters} onFiltersChange={setCampaignFilters} />

  return (
    <div>
      {/* Mobile: 2-column player grid */}
      <div className="lg:hidden mb-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={selectedPlayer === null ? 'default' : 'outline'}
            className={cn("h-11 gap-2", selectedPlayer === null && "text-white")}
            onClick={() => onSelectPlayer(null)}
          >
            <UsersThree size={18} weight={selectedPlayer === null ? 'fill' : 'regular'} />
            All Players
          </Button>
          {allPlayers.map((player) => (
            <Button
              key={player}
              variant={selectedPlayer === player ? 'default' : 'outline'}
              className={cn("h-11 gap-2", selectedPlayer === player && "text-white")}
              onClick={() => onSelectPlayer(selectedPlayer === player ? null : player)}
            >
              <User size={18} weight={selectedPlayer === player ? 'fill' : 'regular'} />
              {player}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Desktop: sidebar player list */}
        <div className="hidden lg:block lg:col-span-1">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Players ({allPlayers.length})</h3>
            <div className="space-y-2">
              {allPlayers.map((player) => (
                <Button
                  key={player}
                  variant={selectedPlayer === player ? 'default' : 'ghost'}
                  className={cn("w-full justify-start gap-2", selectedPlayer === player && "text-white")}
                  onClick={() => {
                    onSelectPlayer(selectedPlayer === player ? null : player)
                  }}
                >
                  <User size={16} weight={selectedPlayer === player ? 'fill' : 'regular'} />
                  {player}
                </Button>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {selectedPlayer ? (
            <PlayerStats playerName={selectedPlayer} playthroughs={playthroughs} campaigns={campaigns}
              drilldownView={drilldownView} onDrilldownChange={setDrilldownView} />
          ) : (
            <PlayerDrilldowns campaigns={campaigns} view={drilldownView} onViewChange={setDrilldownView}>
              <PlayersOverview playthroughs={playthroughs} />
            </PlayerDrilldowns>
          )}
        </div>
      </div>
    </div>
  )
}
