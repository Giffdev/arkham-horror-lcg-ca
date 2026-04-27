import { useMemo, useState } from 'react'
import { Playthrough, Archetype } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArchetypeBadge } from './ArchetypeBadge'
import { User, UsersThree, Check, X, Funnel, Book, ClockCounterClockwise } from '@phosphor-icons/react'
import { formatDate } from '@/lib/date-utils'
import { getDisplaySetName, INVESTIGATORS, getArkhamDBUrl, resolveInvestigator, getInvestigatorDisplayName, getArkhamDBUrlById, getChapterBadgeLabel } from '@/lib/investigator-data'
import { ALL_CAMPAIGNS, getCampaignChapter } from '@/lib/campaign-data'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface PlayerStatsProps {
  playerName: string
  playthroughs: Playthrough[]
}

export function PlayerStats({ playerName, playthroughs }: PlayerStatsProps) {
  const [selectedArchetypes, setSelectedArchetypes] = useState<Archetype[]>([])
  const [selectedSets, setSelectedSets] = useState<string[]>([])
  const [selectedChapter, setSelectedChapter] = useState<'all' | 1 | 2>('all')
  const [activeTab, setActiveTab] = useState<string>('played')

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
          .map(inv => {
            const resolved = resolveInvestigator(inv)
            return {
              id: resolved?.id || inv.investigatorName || 'unknown',
              name: inv.isUnknown || inv.investigatorName === 'Unknown' ? 'Unknown' : inv.investigatorName,
              archetype: inv.archetype,
              chapter: resolved?.chapter,
              set: resolved?.set
            }
          })
      )
      .reduce((acc, { id, name, archetype, chapter, set }) => {
        if (!acc[id]) {
          acc[id] = { count: 0, archetype, name, chapter, set }
        }
        acc[id].count++
        return acc
      }, {} as Record<string, { count: number, archetype: Archetype, name: string, chapter?: 1 | 2, set?: string }>)

    const archetypeCounts = playerGames
      .flatMap(p =>
        p.investigators
          .filter(inv => inv.playerName === playerName)
          .filter(inv => inv.archetype !== 'Unknown')
          .flatMap(inv => {
            const investigatorArchetypes = inv.archetypes || [inv.archetype]
            return investigatorArchetypes.filter(archetype => archetype !== 'Unknown')
          })
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

    const coPlayerCounts = playerGames
      .flatMap(p =>
        p.investigators
          .filter(inv => inv.playerName !== playerName && inv.playerName.trim() !== '')
          .map(inv => inv.playerName)
      )
      .reduce((acc, name) => {
        acc[name] = (acc[name] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    return {
      totalGames: playerGames.length,
      campaigns,
      investigatorCounts,
      archetypeCounts,
      campaignCounts,
      coPlayerCounts
    }
  }, [playerName, playthroughs])

  const allArchetypes: Archetype[] = ['Guardian', 'Seeker', 'Rogue', 'Mystic', 'Survivor', 'Neutral']

  const allSets = useMemo(() => {
    if (activeTab === 'history') {
      // Show campaign sets for history tab
      const campaignSetsFromData = ALL_CAMPAIGNS
        .filter(c => selectedChapter === 'all' || (c.chapter || 1) === selectedChapter)
        .map(c => c.set)
      return Array.from(new Set(campaignSetsFromData)).sort()
    }
    // Show investigator sets for played/unplayed tabs
    const chapterFiltered = selectedChapter === 'all' 
      ? INVESTIGATORS 
      : INVESTIGATORS.filter(inv => inv.chapter === selectedChapter)
    const sets = new Set(chapterFiltered.map(inv => inv.set))
    
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
      'Barkham Horror',
      'Parallel',
      'Core 2026',
      'Evergreen Starters (Ch. 1)',
      'Evergreen Starters (Ch. 2)',
    ]
    
    return Array.from(sets).sort((a, b) => {
      const indexA = setOrder.indexOf(a)
      const indexB = setOrder.indexOf(b)
      
      if (indexA === -1 && indexB === -1) return a.localeCompare(b)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      
      return indexA - indexB
    })
  }, [selectedChapter, activeTab])

  const filteredCampaigns = useMemo(() => {
    if (!playerData) return []
    return playerData.campaigns.filter(campaign => {
      // Filter by campaign set
      if (selectedSets.length > 0 && !selectedSets.includes(campaign.set || '')) {
        return false
      }
      // Filter by chapter (based on campaign's chapter)
      if (selectedChapter !== 'all') {
        const campaignChapter = getCampaignChapter(campaign.name)
        if (campaignChapter !== selectedChapter) return false
      }
      // Filter by archetype (based on the investigator used)
      if (selectedArchetypes.length > 0) {
        const inv = campaign.investigator
        const archetypes = inv.archetypes || [inv.archetype]
        if (!archetypes.some(a => selectedArchetypes.includes(a))) return false
      }
      return true
    })
  }, [playerData, selectedSets, selectedChapter, selectedArchetypes])

  const { playedInvestigators, unplayedInvestigators } = useMemo(() => {
    const playedInvestigatorArchetypes = playthroughs
      .flatMap(p =>
        p.investigators
          .filter(inv => inv.playerName === playerName)
          .filter(inv => !inv.isUnknown && inv.investigatorName !== 'Unknown')
          .map(inv => {
            const resolved = resolveInvestigator(inv)
            return {
              id: resolved?.id || inv.investigatorName,
              name: inv.investigatorName,
              archetype: inv.archetype
            }
          })
      )
    
    let filteredInvestigators = selectedChapter === 'all'
      ? INVESTIGATORS
      : INVESTIGATORS.filter(inv => inv.chapter === selectedChapter)

    if (selectedArchetypes.length > 0) {
      filteredInvestigators = filteredInvestigators.filter(inv => 
        inv.archetypes.some(archetype => selectedArchetypes.includes(archetype))
      )
    }

    if (selectedSets.length > 0) {
      filteredInvestigators = filteredInvestigators.filter(inv => selectedSets.includes(inv.set))
    }

    const playedList = filteredInvestigators
      .filter(inv => {
        if (inv.archetypes.length === 1) {
          return playedInvestigatorArchetypes.some(played => played.id === inv.id)
        } else {
          if (selectedArchetypes.length > 0) {
            return selectedArchetypes.some(selectedArchetype =>
              inv.archetypes.includes(selectedArchetype) &&
              playedInvestigatorArchetypes.some(played => 
                played.id === inv.id && played.archetype === selectedArchetype
              )
            )
          } else {
            return playedInvestigatorArchetypes.some(played => played.id === inv.id)
          }
        }
      })
      .map(inv => {
        const playedArchetypes = inv.archetypes.filter(archetype =>
          playedInvestigatorArchetypes.some(played => 
            played.id === inv.id && played.archetype === archetype
          )
        )
        
        const displayArchetypes = selectedArchetypes.length > 0
          ? inv.archetypes.filter(archetype => selectedArchetypes.includes(archetype))
          : playedArchetypes
        
        return {
          ...inv,
          archetypes: displayArchetypes,
          count: playerData.investigatorCounts[inv.id]?.count || 0
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    const unplayedList = filteredInvestigators
      .filter(inv => {
        if (inv.archetypes.length === 1) {
          return !playedInvestigatorArchetypes.some(played => played.id === inv.id)
        } else {
          if (selectedArchetypes.length > 0) {
            return !selectedArchetypes.some(selectedArchetype =>
              inv.archetypes.includes(selectedArchetype) &&
              playedInvestigatorArchetypes.some(played => 
                played.id === inv.id && played.archetype === selectedArchetype
              )
            )
          } else {
            return !playedInvestigatorArchetypes.some(played => played.id === inv.id)
          }
        }
      })
      .map(inv => {
        const displayArchetypes = selectedArchetypes.length > 0
          ? inv.archetypes.filter(archetype => selectedArchetypes.includes(archetype))
          : inv.archetypes
        
        return {
          ...inv,
          archetypes: displayArchetypes
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    return { playedInvestigators: playedList, unplayedInvestigators: unplayedList }
  }, [playerData.investigatorCounts, selectedArchetypes, selectedSets, selectedChapter, playthroughs, playerName])

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
            <h3 className="font-semibold">Top Players</h3>
          </div>
          <div className="space-y-2 mt-3">
            {Object.entries(playerData.coPlayerCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([name, count]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{name}</span>
                  <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                    ×{count}
                  </Badge>
                </div>
              ))}
            {Object.keys(playerData.coPlayerCounts).length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <User size={20} weight="duotone" className="text-primary" />
            <h3 className="font-semibold">Top Investigators</h3>
          </div>
          <div className="space-y-2 mt-3">
            {Object.entries(playerData.investigatorCounts)
              .filter(([name]) => name !== 'Unknown')
              .sort(([, a], [, b]) => b.count - a.count)
              .slice(0, 5)
              .map(([id, data]) => {
                const url = getArkhamDBUrlById(id)
                return (
                <div key={id} className="flex items-start justify-between text-sm gap-2">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline hover:text-accent transition-colors">
                          {data.name}
                        </a>
                      ) : (
                        <span className="font-medium">{data.name}</span>
                      )}
                      {data.chapter && (
                        <span className="text-xs text-muted-foreground opacity-60">· {getChapterBadgeLabel(data)}</span>
                      )}
                    </div>
                    <ArchetypeBadge archetype={data.archetype} className="text-xs h-5 w-fit" />
                  </div>
                  <span className="ml-2 shrink-0 text-xs font-medium text-muted-foreground">
                    ×{data.count}
                  </span>
                </div>
              )})}
            {Object.keys(playerData.investigatorCounts).filter(n => n !== 'Unknown').length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Check size={20} weight="duotone" className="text-primary" />
            <h3 className="font-semibold">Class Ranking</h3>
          </div>
          <div className="space-y-2 mt-3">
            {allArchetypes
              .map((archetype) => ({
                archetype,
                count: playerData.archetypeCounts[archetype] || 0
              }))
              .sort((a, b) => b.count - a.count)
              .map(({ archetype, count }) => (
                <div key={archetype} className="flex items-center justify-between">
                  <ArchetypeBadge archetype={archetype} />
                  <span className="text-xs font-medium text-muted-foreground">
                    ×{count}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="played" className="space-y-4" onValueChange={(v) => {
        setActiveTab(v)
        setSelectedSets([])
      }}>
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
            <ClockCounterClockwise size={16} weight="bold" />
            History
          </TabsTrigger>
        </TabsList>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Funnel size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filter by:</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Chapter</p>
              <div className="inline-flex rounded-lg border border-border overflow-hidden">
                {([['all', 'All'], [1, 'Chapter 1'], [2, 'Chapter 2']] as const).map(([value, label]) => (
                  <button
                    key={String(value)}
                    onClick={() => {
                      setSelectedChapter(value)
                      setSelectedSets([])
                    }}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium transition-colors',
                      selectedChapter === value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Class</p>
                {selectedArchetypes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedArchetypes([])}
                    className="h-6 text-xs px-2"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allArchetypes.map(archetype => (
                  <Button
                    key={archetype}
                    size="sm"
                    variant={selectedArchetypes.includes(archetype) ? 'default' : 'outline'}
                    onClick={() => {
                      setSelectedArchetypes(current =>
                        current.includes(archetype)
                          ? current.filter(a => a !== archetype)
                          : [...current, archetype]
                      )
                    }}
                  >
                    {archetype}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{activeTab === 'history' ? 'Campaign' : 'Set'}</p>
                {selectedSets.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSets([])}
                    className="h-6 text-xs px-2"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allSets.map(set => (
                  <Button
                    key={set}
                    size="sm"
                    variant={selectedSets.includes(set) ? 'default' : 'outline'}
                    onClick={() => {
                      setSelectedSets(current =>
                        current.includes(set)
                          ? current.filter(s => s !== set)
                          : [...current, set]
                      )
                    }}
                  >
                    {set}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <TabsContent value="played" className="space-y-4">
          {playedInvestigators.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No investigators match the selected filters</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {playedInvestigators.map((investigator) => {
                const arkhamDBUrl = getArkhamDBUrlById(investigator.id)
                const chapterLabel = getChapterBadgeLabel(investigator)
                return arkhamDBUrl ? (
                  <a
                    key={investigator.id}
                    href={arkhamDBUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Card className="p-3 group hover:border-accent transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate group-hover:text-accent transition-colors">
                            {investigator.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {investigator.set} <span className="opacity-60">· {chapterLabel}</span>
                          </p>
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
                  </a>
                ) : (
                  <Card key={investigator.id} className="p-3 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{investigator.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {investigator.set} <span className="opacity-60">· {chapterLabel}</span>
                        </p>
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
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="unplayed" className="space-y-4">
          {unplayedInvestigators.length === 0 ? (
            <Card className="p-6 text-center">
              <Check size={48} weight="duotone" className="mx-auto mb-4 text-accent" />
              <p className="text-muted-foreground">
                {selectedArchetypes.length === 0 && selectedSets.length === 0
                  ? 'You\'ve played all investigators!'
                  : 'All investigators in this category have been played!'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unplayedInvestigators.map((investigator) => {
                const arkhamDBUrl = getArkhamDBUrlById(investigator.id)
                const chapterLabel = getChapterBadgeLabel(investigator)
                return arkhamDBUrl ? (
                  <a
                    key={investigator.id}
                    href={arkhamDBUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Card className="p-3 group hover:border-accent transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate group-hover:text-accent transition-colors">
                          {investigator.name}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {investigator.set} <span className="opacity-60">· {chapterLabel}</span>
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {investigator.archetypes.map(archetype => (
                            <ArchetypeBadge key={archetype} archetype={archetype} className="text-xs h-5" />
                          ))}
                        </div>
                      </div>
                    </Card>
                  </a>
                ) : (
                  <Card key={investigator.id} className="p-3 group">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{investigator.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {investigator.set} <span className="opacity-60">· {chapterLabel}</span>
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {investigator.archetypes.map(archetype => (
                          <ArchetypeBadge key={archetype} archetype={archetype} className="text-xs h-5" />
                        ))}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {filteredCampaigns.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">
                {playerData.campaigns.length === 0 ? 'No campaigns recorded yet' : 'No campaigns match the selected filters'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredCampaigns.map((campaign, idx) => {
                const inv = campaign.investigator
                const investigatorName = inv.isUnknown || inv.investigatorName === 'Unknown' 
                  ? 'Unknown' 
                  : inv.investigatorName
                const investigatorArchetypes = inv.archetypes || [inv.archetype]
                const resolved = !inv.isUnknown && !inv.isCustom && investigatorName !== 'Unknown'
                  ? resolveInvestigator({ investigatorId: inv.investigatorId, investigatorName: inv.investigatorName, chapter: inv.chapter })
                  : null
                const arkhamDBUrl = resolved ? getArkhamDBUrlById(resolved.id) : null
                const chapterLabel = resolved ? getChapterBadgeLabel(resolved) : null
                
                return (
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
                            <Badge variant="outline" className="text-xs">
                              {campaign.set}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 lg:flex-shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {arkhamDBUrl ? (
                            <a
                              href={arkhamDBUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium whitespace-nowrap hover:underline hover:text-accent transition-colors"
                            >
                              {investigatorName}
                            </a>
                          ) : (
                            <span className="text-sm font-medium whitespace-nowrap">
                              {investigatorName}
                            </span>
                          )}
                          {chapterLabel && (
                            <span className="text-xs text-muted-foreground opacity-60">· {chapterLabel}</span>
                          )}
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {investigatorArchetypes.map((archetype, aIdx) => (
                            <ArchetypeBadge key={aIdx} archetype={archetype} className="w-20 justify-center" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
