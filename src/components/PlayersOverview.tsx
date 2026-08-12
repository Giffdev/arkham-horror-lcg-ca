import { useMemo, useState } from 'react'
import { Playthrough, Archetype } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { INVESTIGATORS, Investigator, getArkhamDBUrlById, getChapterBadgeLabel, INVESTIGATOR_SETS, resolveInvestigator } from '@/lib/investigator-data'
import { Check, ArrowSquareOut, Funnel, CaretDown, CaretUp } from '@phosphor-icons/react'
import { ArchetypeBadge } from '@/components/ArchetypeBadge'
import { CampaignSvgIcon } from '@/components/CampaignSvgIcon'
import { hasDedicatedCampaignIcon } from '@/lib/campaign-icon-map'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface PlayersOverviewProps {
  playthroughs: Playthrough[]
}

export function PlayersOverview({ playthroughs }: PlayersOverviewProps) {
  const [selectedArchetypes, setSelectedArchetypes] = useState<Archetype[]>([])
  const [selectedSets, setSelectedSets] = useState<string[]>([])
  const [selectedChapter, setSelectedChapter] = useState<'all' | 1 | 2>('all')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'played' | 'never-played'>('played')

  const { investigatorsPlayed, investigatorsNeverPlayed } = useMemo(() => {
    const investigatorPlayCount = new Map<string, { investigator: Investigator; timesPlayed: number }>()

    playthroughs.forEach(playthrough => {
      playthrough.investigators.forEach(inv => {
        if (!inv.isUnknown && inv.investigatorName !== 'Unknown') {
          const resolved = resolveInvestigator(inv)
          if (resolved) {
            const key = resolved.id
            if (!investigatorPlayCount.has(key)) {
              investigatorPlayCount.set(key, { investigator: resolved, timesPlayed: 0 })
            }
            investigatorPlayCount.get(key)!.timesPlayed++
          }
        }
      })
    })

    const playedArray = Array.from(investigatorPlayCount.values())
      .sort((a, b) => b.timesPlayed - a.timesPlayed || a.investigator.name.localeCompare(b.investigator.name))

    const playedInvestigatorIds = new Set(investigatorPlayCount.keys())
    const neverPlayed = INVESTIGATORS
      .filter(inv => !playedInvestigatorIds.has(inv.id))
      .sort((a, b) => a.name.localeCompare(b.name))

    const filteredPlayed = playedArray.filter(({ investigator }) => {
      if (selectedChapter !== 'all' && investigator.chapter !== selectedChapter) return false
      if (selectedArchetypes.length > 0 && !investigator.archetypes.some(a => selectedArchetypes.includes(a))) return false
      if (selectedSets.length > 0 && !selectedSets.includes(investigator.set)) return false
      return true
    })

    const filteredNeverPlayed = neverPlayed.filter(investigator => {
      if (selectedChapter !== 'all' && investigator.chapter !== selectedChapter) return false
      if (selectedArchetypes.length > 0 && !investigator.archetypes.some(a => selectedArchetypes.includes(a))) return false
      if (selectedSets.length > 0 && !selectedSets.includes(investigator.set)) return false
      return true
    })

    return { investigatorsPlayed: filteredPlayed, investigatorsNeverPlayed: filteredNeverPlayed }
  }, [playthroughs, selectedArchetypes, selectedSets, selectedChapter])

  const handleArchetypeToggle = (archetype: Archetype) => {
    setSelectedArchetypes(current =>
      current.includes(archetype) ? current.filter(a => a !== archetype) : [...current, archetype]
    )
  }

  const handleSetToggle = (set: string) => {
    setSelectedSets(current =>
      current.includes(set) ? current.filter(s => s !== set) : [...current, set]
    )
  }

  const archetypes: Archetype[] = ['Guardian', 'Seeker', 'Rogue', 'Mystic', 'Survivor', 'Neutral']
  const hasActiveFilters = selectedArchetypes.length > 0 || selectedSets.length > 0 || selectedChapter !== 'all'

  const filteredSets = useMemo(() => {
    const chapterFiltered = selectedChapter === 'all'
      ? INVESTIGATORS
      : INVESTIGATORS.filter(inv => inv.chapter === selectedChapter)
    const sets = new Set(chapterFiltered.map(inv => inv.set))
    return INVESTIGATOR_SETS.filter(set => sets.has(set))
  }, [selectedChapter])

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <button
          className="flex items-center gap-2 w-full rounded-md border border-border bg-card/50 px-3 py-2"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
        >
          <Funnel size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              {(selectedChapter !== 'all' ? 1 : 0) + (selectedArchetypes.length > 0 ? 1 : 0) + (selectedSets.length > 0 ? 1 : 0)} active
            </Badge>
          )}
          <span className="ml-auto">
            {filtersExpanded ? <CaretUp size={14} className="text-muted-foreground" /> : <CaretDown size={14} className="text-muted-foreground" />}
          </span>
        </button>

        <div className={cn("space-y-3", filtersExpanded ? "block" : "hidden")}>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Chapter</p>
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              {([['all', 'All'], [1, 'Chapter 1'], [2, 'Chapter 2']] as const).map(([value, label]) => (
                <button
                  key={String(value)}
                  onClick={() => { setSelectedChapter(value); setSelectedSets([]) }}
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
                <Button variant="ghost" size="sm" onClick={() => setSelectedArchetypes([])} className="h-6 text-xs px-2">Clear</Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {archetypes.map(archetype => (
                <Button
                  key={archetype}
                  variant={selectedArchetypes.includes(archetype) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleArchetypeToggle(archetype)}
                  className="gap-1.5"
                >
                  {hasDedicatedCampaignIcon(archetype) && (
                    <CampaignSvgIcon
                      campaignSet={archetype}
                      size={13}
                      aria-hidden="true"
                      className="flex-shrink-0 opacity-80"
                    />
                  )}
                  {archetype}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Set</p>
              {selectedSets.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedSets([])} className="h-6 text-xs px-2">Clear</Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredSets.map(set => (
                <Button
                  key={set}
                  variant={selectedSets.includes(set) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSetToggle(set)}
                >
                  {set}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'played' | 'never-played')}>
        <TabsList aria-label="Investigator view" className="w-fit">
          <TabsTrigger value="played">Played ({investigatorsPlayed.length})</TabsTrigger>
          <TabsTrigger value="never-played">Never Played ({investigatorsNeverPlayed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="played" className="mt-4">
          {investigatorsPlayed.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No investigators played yet. Log games to see statistics.</p>
            </Card>
          ) : (
            <>
              <p className="text-sm text-foreground mb-4">
                {investigatorsPlayed.length} of {investigatorsPlayed.length + investigatorsNeverPlayed.length} investigators have been played
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {investigatorsPlayed.map(({ investigator, timesPlayed }) => {
                  const arkhamDBUrl = getArkhamDBUrlById(investigator.id)
                  return (
                    <Card key={investigator.id} className={cn("p-4 group relative", arkhamDBUrl && "hover:border-accent transition-colors")}>
                      {arkhamDBUrl && (
                        <a href={arkhamDBUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10" aria-label={`View ${investigator.name} on ArkhamDB`} />
                      )}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Archetype badge(s) first in DOM order per D14 reading-order contract */}
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {investigator.archetypes.map(archetype => (
                              <ArchetypeBadge key={archetype} archetype={archetype} className="text-xs" />
                            ))}
                          </div>
                          <div className="flex items-start gap-2">
                            <h3 className="font-semibold truncate flex-1">{investigator.name}</h3>
                            {arkhamDBUrl && <ArrowSquareOut size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {investigator.set} <span className="opacity-60">· {getChapterBadgeLabel(investigator)}</span>
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right relative z-20">
                          <div className="text-2xl font-bold text-primary">{timesPlayed}</div>
                          <div className="text-xs text-muted-foreground">{timesPlayed === 1 ? 'time' : 'times'}</div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="never-played" className="mt-4">
          {investigatorsNeverPlayed.length === 0 ? (
            <Card className="p-12 text-center">
              <Check size={48} weight="duotone" className="mx-auto mb-4 text-accent" />
              <p className="text-lg font-medium mb-2">Every investigator has made it to the table!</p>
              <p className="text-muted-foreground">
                All {investigatorsPlayed.length + investigatorsNeverPlayed.length} investigators have been played at least once.
              </p>
            </Card>
          ) : (
            <>
              <p className="text-sm text-foreground mb-4">
                {investigatorsNeverPlayed.length} of {investigatorsPlayed.length + investigatorsNeverPlayed.length} investigators haven't been played yet
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {investigatorsNeverPlayed.map(investigator => {
                  const arkhamDBUrl = getArkhamDBUrlById(investigator.id)
                  return (
                    <Card key={investigator.id} className={cn("p-3 group relative", arkhamDBUrl && "hover:border-accent transition-colors")}>
                      {arkhamDBUrl && (
                        <a href={arkhamDBUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10" aria-label={`View ${investigator.name} on ArkhamDB`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <h4 className="font-medium text-sm truncate flex-1">{investigator.name}</h4>
                          {arkhamDBUrl && <ArrowSquareOut size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {investigator.archetypes.map(archetype => (
                            <ArchetypeBadge key={archetype} archetype={archetype} className="text-xs px-1.5 py-0" />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {investigator.set} <span className="opacity-60">· {getChapterBadgeLabel(investigator)}</span>
                        </p>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
