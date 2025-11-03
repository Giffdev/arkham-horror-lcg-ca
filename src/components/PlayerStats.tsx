import { useMemo, useState } from 'react'
import { Playthrough, Archetype } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArchetypeBadge } from './ArchetypeBadge'
import { User, Briefcase, UsersThree, Check, X, Funnel, Book } from '@phosphor-icons/react'
import { formatDate } from '@/lib/date-utils'
import { getDisplaySetName, INVESTIGATORS } from '@/lib/investigator-data'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { CampaignIcon } from './CampaignIcon'

interface PlayerStatsProps {
  playerName: string
  playthroughs: Playthrough[]
}

export function PlayerStats({ playerName, playthroughs }: PlayerStatsProps) {
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype | 'All'>('All')
  const [selectedSet, setSelectedSet] = useState<string>('All')

  const playerData = useMemo(() => {
    const playerGames = playthroughs.filter(p =>
      p.investigators.some(inv => inv.playerName === playerName)
    )

    const campaigns = playerGames.map(p => ({
      name: p.campaignType === 'Fan-Made' 
        ? p.customCampaignName || p.campaignName 
        : p.campaignType === 'Unknown'
          ? 'Unknown Campaign'
          : p.campaignName,
      type: p.campaignType,
      set: p.campaignSet,
      date: p.date,
      investigator: p.investigators.find(inv => inv.playerName === playerName)!
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const investigatorCounts = playerGames
      .flatMap(p =>
        p.investigators
          .filter(inv => inv.playerName === playerName)
          .map(inv => ({
            name: inv.isUnknown || inv.investigatorName === 'Unknown' ? 'Unknown' : inv.investigatorName,
            archetype: inv.archetype
          }))
      )
      .reduce((acc, { name, archetype }) => {
        if (!acc[name]) {
          acc[name] = { count: 0, archetype }
        }
        acc[name].count++
        return acc
      }, {} as Record<string, { count: number, archetype: Archetype }>)

    const archetypeCounts = playerGames
      .flatMap(p =>
        p.investigators
          .filter(inv => inv.playerName === playerName)
          .filter(inv => inv.archetype !== 'Unknown')
          .map(inv => inv.archetype)
      )
      .reduce((acc, archetype) => {
        acc[archetype] = (acc[archetype] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    const campaignCounts = playerGames.reduce((acc, playthrough) => {
      const campaignKey = playthrough.campaignType === 'Fan-Made'
        ? playthrough.customCampaignName || playthrough.campaignName
        : playthrough.campaignType === 'Unknown'
          ? 'Unknown Campaign'
          : playthrough.campaignName
      
      const campaignSet = playthrough.campaignSet || 'Unknown'
      
      if (!acc[campaignKey]) {
        acc[campaignKey] = {
          count: 0,
          type: playthrough.campaignType,
          set: campaignSet
        }
      }
      acc[campaignKey].count++
      return acc
    }, {} as Record<string, { count: number, type: string, set: string }>)

    return {
      totalGames: playerGames.length,
      campaigns,
      investigatorCounts,
      archetypeCounts,
      campaignCounts
    }
  }, [playerName, playthroughs])

  const allArchetypes: Archetype[] = ['Guardian', 'Seeker', 'Rogue', 'Mystic', 'Survivor', 'Neutral']

  const allSets = useMemo(() => {
    const sets = new Set(INVESTIGATORS.map(inv => inv.set))
    
    const setOrder = [
      'Core',
      'The Dunwich Legacy',
      'The Path to Carcosa',
      'The Forgotten Age',
      'The Circle Undone',
      'The Dream-Eaters',
      'The Innsmouth Conspiracy',
      'Edge of the Earth',
      'The Scarlet Keys',
      'The Feast of Hemlock Vale',
      'The Drowned City',
      'Nathaniel Cho',
      'Harvey Walters',
      'Winifred Habbamock',
      'Jacqueline Fine',
      'Stella Clark',
      'The Blob That Ate Everything',
      'Barkham Horror'
    ]
    
    return Array.from(sets).sort((a, b) => {
      const indexA = setOrder.indexOf(a)
      const indexB = setOrder.indexOf(b)
      
      if (indexA === -1 && indexB === -1) return a.localeCompare(b)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      
      return indexA - indexB
    })
  }, [])

  const { playedInvestigators, unplayedInvestigators } = useMemo(() => {
    const played = new Set(Object.keys(playerData.investigatorCounts).filter(name => name !== 'Unknown'))
    
    let filteredInvestigators = INVESTIGATORS

    if (selectedArchetype !== 'All') {
      filteredInvestigators = filteredInvestigators.filter(inv => 
        inv.archetypes.includes(selectedArchetype)
      )
    }

    if (selectedSet !== 'All') {
      filteredInvestigators = filteredInvestigators.filter(inv => inv.set === selectedSet)
    }

    const playedList = filteredInvestigators
      .filter(inv => played.has(inv.name))
      .map(inv => ({
        ...inv,
        count: playerData.investigatorCounts[inv.name]?.count || 0
      }))
      .sort((a, b) => b.count - a.count)

    const unplayedList = filteredInvestigators
      .filter(inv => !played.has(inv.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    return { playedInvestigators: playedList, unplayedInvestigators: unplayedList }
  }, [playerData.investigatorCounts, selectedArchetype, selectedSet])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <User size={24} weight="duotone" className="text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">{playerName}</h2>
          <p className="text-sm text-muted-foreground">
            {playerData.totalGames} {playerData.totalGames === 1 ? 'game' : 'games'} played
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Briefcase size={20} weight="duotone" className="text-primary" />
            <h3 className="font-semibold">Total Games</h3>
          </div>
          <p className="text-3xl font-bold">{playerData.totalGames}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Book size={20} weight="duotone" className="text-primary" />
            <h3 className="font-semibold">Top Campaigns</h3>
          </div>
          <div className="space-y-2 mt-3">
            {Object.entries(playerData.campaignCounts)
              .filter(([name]) => name !== 'Unknown Campaign')
              .sort(([, a], [, b]) => b.count - a.count)
              .slice(0, 5)
              .map(([name, data]) => (
                <div key={name} className="flex items-start justify-between text-sm gap-2">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <span className="truncate font-medium">{name}</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant="outline" className="text-xs h-5">
                        {data.type}
                      </Badge>
                      {data.set && data.set !== 'Unknown' && (
                        <Badge variant="secondary" className="text-xs h-5 flex items-center gap-1">
                          <CampaignIcon campaignSet={data.set} size={12} weight="fill" />
                          {data.set}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge variant="default" className="ml-2 shrink-0 text-xs">
                    ×{data.count}
                  </Badge>
                </div>
              ))}
            {Object.entries(playerData.campaignCounts).filter(([name]) => name !== 'Unknown Campaign').length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <UsersThree size={20} weight="duotone" className="text-primary" />
            <h3 className="font-semibold">Top Investigators</h3>
          </div>
          <div className="space-y-2 mt-3">
            {Object.entries(playerData.investigatorCounts)
              .filter(([name]) => name !== 'Unknown')
              .sort(([, a], [, b]) => b.count - a.count)
              .slice(0, 5)
              .map(([name, data]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="truncate">{name}</span>
                    <ArchetypeBadge archetype={data.archetype} className="text-xs h-5 shrink-0" />
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                    ×{data.count}
                  </Badge>
                </div>
              ))}
            {Object.keys(playerData.investigatorCounts).filter(n => n !== 'Unknown').length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Check size={20} weight="duotone" className="text-primary" />
            <h3 className="font-semibold">Favorite Classes</h3>
          </div>
          <div className="space-y-2 mt-3">
            {Object.entries(playerData.archetypeCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([archetype, count]) => (
                <div key={archetype} className="flex items-center justify-between">
                  <ArchetypeBadge archetype={archetype as Archetype} />
                  <Badge variant="secondary" className="text-xs">
                    ×{count}
                  </Badge>
                </div>
              ))}
            {Object.keys(playerData.archetypeCounts).length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="played" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="played" className="gap-2">
            <Check size={16} weight="bold" />
            Played
          </TabsTrigger>
          <TabsTrigger value="unplayed" className="gap-2">
            <X size={16} weight="bold" />
            Unplayed
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Briefcase size={16} weight="duotone" />
            History
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap gap-2 items-center">
          <Funnel size={16} className="text-muted-foreground" />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selectedArchetype === 'All' ? 'default' : 'outline'}
              onClick={() => setSelectedArchetype('All')}
            >
              All Classes
            </Button>
            {allArchetypes.map(archetype => (
              <Button
                key={archetype}
                size="sm"
                variant={selectedArchetype === archetype ? 'default' : 'outline'}
                onClick={() => setSelectedArchetype(archetype)}
              >
                {archetype}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selectedSet === 'All' ? 'default' : 'outline'}
              onClick={() => setSelectedSet('All')}
            >
              All Sets
            </Button>
            {allSets.map(set => (
              <Button
                key={set}
                size="sm"
                variant={selectedSet === set ? 'default' : 'outline'}
                onClick={() => setSelectedSet(set)}
              >
                {set}
              </Button>
            ))}
          </div>
        </div>

        <TabsContent value="played" className="space-y-4">
          {playedInvestigators.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No investigators match the selected filters</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {playedInvestigators.map((investigator) => (
                <Card key={investigator.name} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{investigator.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{investigator.set}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {investigator.archetypes.map(archetype => (
                          <ArchetypeBadge key={archetype} archetype={archetype} className="text-xs h-5" />
                        ))}
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      ×{investigator.count}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="unplayed" className="space-y-4">
          {unplayedInvestigators.length === 0 ? (
            <Card className="p-6 text-center">
              <Check size={48} weight="duotone" className="mx-auto mb-4 text-accent" />
              <p className="text-muted-foreground">
                {selectedArchetype === 'All' && selectedSet === 'All'
                  ? 'You\'ve played all investigators!'
                  : 'All investigators in this category have been played!'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unplayedInvestigators.map((investigator) => (
                <Card key={investigator.name} className={cn("p-3 opacity-60")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{investigator.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{investigator.set}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {investigator.archetypes.map(archetype => (
                          <ArchetypeBadge key={archetype} archetype={archetype} className="text-xs h-5" />
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {playerData.campaigns.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No campaigns recorded yet</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {playerData.campaigns.map((campaign, idx) => (
                <Card key={idx} className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{campaign.name}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <span>{formatDate(campaign.date)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {campaign.type}
                        </Badge>
                        {campaign.set && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1.5">
                            <CampaignIcon campaignSet={campaign.set} size={12} weight="fill" />
                            {campaign.set}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 lg:flex-shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium whitespace-nowrap">
                          {campaign.investigator.isUnknown || campaign.investigator.investigatorName === 'Unknown' 
                            ? 'Unknown' 
                            : campaign.investigator.investigatorName}
                        </span>
                        {campaign.investigator.investigatorSet && !campaign.investigator.isCustom && (
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {getDisplaySetName(campaign.investigator.investigatorName, campaign.investigator.investigatorSet)}
                          </Badge>
                        )}
                      </div>
                      <div className="w-20 flex justify-end">
                        <ArchetypeBadge archetype={campaign.investigator.archetype} className="w-20 justify-center" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
