import { useId, useMemo, useState } from 'react'
import { ALL_CAMPAIGNS, orderCampaignsForDisplay } from '@/lib/campaign-data'
import { getPlayerCampaignHistory } from '@/lib/campaign-play-history'
import { hasDedicatedCampaignIcon } from '@/lib/campaign-icon-map'
import type { CampaignRun, Playthrough } from '@/lib/types'
import { CampaignSvgIcon } from '@/components/CampaignSvgIcon'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlayerHistoryRecord } from '@/components/PlayerHistoryRecord'

export interface PlayerCampaignFilters {
  view: string
  scope: string
  search: string
}

interface PlayerCampaignsProps {
  playerName: string | null
  playthroughs: Playthrough[]
  campaignRuns: CampaignRun[]
  filters: PlayerCampaignFilters
  onFiltersChange: (filters: PlayerCampaignFilters) => void
}

export function PlayerCampaigns({ playerName, playthroughs, campaignRuns, filters, onFiltersChange }: PlayerCampaignsProps) {
  const historyId = useId()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const { view, scope, search } = filters
  const history = useMemo(
    () => getPlayerCampaignHistory(playerName, playthroughs, campaignRuns),
    [playerName, playthroughs, campaignRuns],
  )
  const campaigns = orderCampaignsForDisplay(ALL_CAMPAIGNS).filter(campaign =>
    (scope === 'all' || campaign.type === scope) &&
    campaign.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  )
  const playedCampaigns = campaigns.filter(campaign => history.has(campaign.name))
  const notPlayedCampaigns = campaigns.filter(campaign => !history.has(campaign.name))

  return (
    <section aria-label={playerName === null ? 'All players’ campaigns' : `${playerName}'s campaigns`} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="player-campaign-search">Search campaigns and scenario packs</Label>
        <Input id="player-campaign-search" value={search} onChange={event => onFiltersChange({ ...filters, search: event.target.value })} placeholder="Search by name..." />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Campaign scope">
        {(['all', 'Full Campaign', 'Small Campaign', 'Scenario Pack'] as const).map(type => (
          <Button key={type} size="sm" variant={scope === type ? 'default' : 'outline'} aria-pressed={scope === type} onClick={() => onFiltersChange({ ...filters, scope: type })}>
            {type === 'all' ? 'All' : type}
          </Button>
        ))}
      </div>
      <Tabs value={view} onValueChange={view => onFiltersChange({ ...filters, view })}>
        <TabsList aria-label="Campaign play status">
          <TabsTrigger value="played">Played ({playedCampaigns.length})</TabsTrigger>
          <TabsTrigger value="not-played">Not Played ({notPlayedCampaigns.length})</TabsTrigger>
        </TabsList>
        {([
          ['played', playedCampaigns, 'No campaigns or scenario packs played match this view.'],
          ['not-played', notPlayedCampaigns, 'No unplayed campaigns or scenario packs match this view.'],
        ] as const).map(([status, entries, emptyMessage]) => (
          <TabsContent key={status} value={status} className="mt-4">
            {entries.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">{emptyMessage}</Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {entries.map(campaign => (
                  <Card key={campaign.name} className="p-4">
                    <h3 className="flex items-center gap-2 font-semibold">
                      <CampaignSvgIcon
                        campaignSet={hasDedicatedCampaignIcon(campaign.name) ? campaign.name : campaign.set}
                        size={18}
                        className="text-primary/80"
                        aria-hidden="true"
                      />
                      <span>{campaign.name}</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{campaign.type} · {campaign.set}</p>
                    {status === 'played' && (
                      <div className="mt-3">
                        <button
                          className="text-sm font-medium text-primary hover:underline"
                          aria-expanded={expanded.has(campaign.name)}
                          aria-controls={`${historyId}-${encodeURIComponent(campaign.name)}`}
                          onClick={() => setExpanded(current => {
                            const next = new Set(current)
                            if (next.has(campaign.name)) next.delete(campaign.name)
                            else next.add(campaign.name)
                            return next
                          })}
                        >
                          History for {campaign.name} ({history.get(campaign.name)!.length})
                        </button>
                        <div id={`${historyId}-${encodeURIComponent(campaign.name)}`} hidden={!expanded.has(campaign.name)} className="space-y-3 mt-3">
                          {expanded.has(campaign.name) && history.get(campaign.name)!.map(record => (
                            <PlayerHistoryRecord key={`${playerName}:${record.id}`} {...record} showPlayers={playerName === null} />
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}
