import { useMemo, useState } from 'react'
import { ALL_CAMPAIGNS, orderCampaignsForDisplay } from '@/lib/campaign-data'
import { getPlayerPlayedCampaignNames } from '@/lib/campaign-play-history'
import { hasDedicatedCampaignIcon } from '@/lib/campaign-icon-map'
import type { CampaignRun, Playthrough } from '@/lib/types'
import { CampaignSvgIcon } from '@/components/CampaignSvgIcon'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PlayerCampaignsProps {
  playerName: string
  playthroughs: Playthrough[]
  campaignRuns: CampaignRun[]
}

export function PlayerCampaigns({ playerName, playthroughs, campaignRuns }: PlayerCampaignsProps) {
  const [view, setView] = useState('played')
  const [scope, setScope] = useState('all')
  const [search, setSearch] = useState('')
  const played = useMemo(
    () => getPlayerPlayedCampaignNames(playerName, playthroughs, campaignRuns),
    [playerName, playthroughs, campaignRuns],
  )
  const campaigns = orderCampaignsForDisplay(ALL_CAMPAIGNS).filter(campaign =>
    (scope === 'all' || campaign.type === scope) &&
    campaign.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  )
  const playedCampaigns = campaigns.filter(campaign => played.has(campaign.name))
  const notPlayedCampaigns = campaigns.filter(campaign => !played.has(campaign.name))

  return (
    <section aria-label={`${playerName}'s campaigns`} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Campaigns &amp; Scenario Packs</h2>
        <p className="text-sm text-muted-foreground">
          Played means at least one logged scenario, not campaign completion. Multipart scenario packs require both parts or an explicit whole-pack record, which also counts both parts as played. Includes legacy play records and side scenarios played alone or within campaigns.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="player-campaign-search">Search campaigns and scenario packs</Label>
        <Input id="player-campaign-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name..." />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Campaign scope">
        {(['all', 'Full Campaign', 'Small Campaign', 'Scenario Pack'] as const).map(type => (
          <Button key={type} size="sm" variant={scope === type ? 'default' : 'outline'} aria-pressed={scope === type} onClick={() => setScope(type)}>
            {type === 'all' ? 'All' : type}
          </Button>
        ))}
      </div>
      <Tabs value={view} onValueChange={setView}>
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
