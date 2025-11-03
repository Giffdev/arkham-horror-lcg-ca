import { useMemo, useState } from 'react'
import { Playthrough, Archetype } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { INVESTIGATORS, Investigator, getArkhamDBUrl, INVESTIGATOR_SETS } from '@/lib/investigator-data'
import { Check, ArrowSquareOut, Funnel } from '@phosphor-icons/react'
import { ArchetypeBadge } from '@/components/ArchetypeBadge'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface PlayersOverviewProps {
  playthroughs: Playthrough[]
}

export function PlayersOverview({ playthroughs }: PlayersOverviewProps) {
  const [selectedArchetypes, setSelectedArchetypes] = useState<Archetype[]>([])
  const [selectedSets, setSelectedSets] = useState<string[]>([])

  const { investigatorsPlayed, investigatorsNeverPlayed } = useMemo(() => {
    const investigatorPlayCount = new Map<string, {
      investigator: Investigator
      timesPlayed: number
    }>()

    playthroughs.forEach(playthrough => {
      playthrough.investigators.forEach(inv => {
        if (!inv.isUnknown && inv.investigatorName !== 'Unknown') {
          const investigatorData = INVESTIGATORS.find(i => i.name === inv.investigatorName)
          if (investigatorData) {
            if (!investigatorPlayCount.has(inv.investigatorName)) {
              investigatorPlayCount.set(inv.investigatorName, {
                investigator: investigatorData,
                timesPlayed: 0
              })
            }
            investigatorPlayCount.get(inv.investigatorName)!.timesPlayed++
          }
        }
      })
    })

    const playedArray = Array.from(investigatorPlayCount.values())
      .sort((a, b) => b.timesPlayed - a.timesPlayed || a.investigator.name.localeCompare(b.investigator.name))

    const playedInvestigatorNames = new Set(investigatorPlayCount.keys())
    const neverPlayed = INVESTIGATORS
      .filter(inv => !playedInvestigatorNames.has(inv.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    const filteredPlayed = playedArray.filter(({ investigator }) => {
      if (selectedArchetypes.length > 0) {
        const hasMatchingArchetype = investigator.archetypes.some(archetype => 
          selectedArchetypes.includes(archetype)
        )
        if (!hasMatchingArchetype) return false
      }

      if (selectedSets.length > 0) {
        if (!selectedSets.includes(investigator.set)) return false
      }

      return true
    })

    const filteredNeverPlayed = neverPlayed.filter(investigator => {
      if (selectedArchetypes.length > 0) {
        const hasMatchingArchetype = investigator.archetypes.some(archetype => 
          selectedArchetypes.includes(archetype)
        )
        if (!hasMatchingArchetype) return false
      }

      if (selectedSets.length > 0) {
        if (!selectedSets.includes(investigator.set)) return false
      }

      return true
    })

    return {
      investigatorsPlayed: filteredPlayed,
      investigatorsNeverPlayed: filteredNeverPlayed
    }
  }, [playthroughs, selectedArchetypes, selectedSets])

  const handleArchetypeToggle = (archetype: Archetype) => {
    setSelectedArchetypes(current =>
      current.includes(archetype)
        ? current.filter(a => a !== archetype)
        : [...current, archetype]
    )
  }

  const handleSetToggle = (set: string) => {
    setSelectedSets(current =>
      current.includes(set)
        ? current.filter(s => s !== set)
        : [...current, set]
    )
  }

  const handleClearArchetypes = () => {
    setSelectedArchetypes([])
  }

  const handleClearSets = () => {
    setSelectedSets([])
  }

  const archetypes: Archetype[] = ['Guardian', 'Seeker', 'Rogue', 'Mystic', 'Survivor', 'Neutral']
  const hasActiveFilters = selectedArchetypes.length > 0 || selectedSets.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Funnel size={16} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter by:</span>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Class</p>
              {selectedArchetypes.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearArchetypes}
                  className="h-6 text-xs px-2"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {archetypes.map(archetype => (
                <Button
                  key={archetype}
                  variant={selectedArchetypes.includes(archetype) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleArchetypeToggle(archetype)}
                >
                  {archetype}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Set</p>
              {selectedSets.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSets}
                  className="h-6 text-xs px-2"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {INVESTIGATOR_SETS.map(set => (
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

      <div>
        <h2 className="text-2xl font-semibold mb-4">Investigators Played</h2>
        {investigatorsPlayed.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              No investigators played yet. Log games to see statistics.
            </p>
          </Card>
        ) : (
          <>
            <p className="text-sm text-foreground mb-4">
              {investigatorsPlayed.length} of {INVESTIGATORS.length} investigators have been played
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {investigatorsPlayed.map(({ investigator, timesPlayed }) => {
                const arkhamDBUrl = getArkhamDBUrl(investigator.name)
                return (
                  <Card key={investigator.name} className={cn("p-4 group relative", arkhamDBUrl && "hover:border-accent transition-colors")}>
                    {arkhamDBUrl && (
                      <a 
                        href={arkhamDBUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 z-10"
                        aria-label={`View ${investigator.name} on ArkhamDB`}
                      />
                    )}
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <h3 className="font-semibold truncate flex-1">{investigator.name}</h3>
                          {arkhamDBUrl && (
                            <ArrowSquareOut size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex flex-wrap gap-1">
                            {investigator.archetypes.map(archetype => (
                              <ArchetypeBadge key={archetype} archetype={archetype} className="text-xs" />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{investigator.set}</p>
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
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Investigators Never Played</h2>
        {investigatorsNeverPlayed.length === 0 ? (
          <Card className="p-12 text-center">
            <Check size={48} weight="duotone" className="mx-auto mb-4 text-accent" />
            <p className="text-lg font-medium mb-2">Every investigator has made it to the table!</p>
            <p className="text-muted-foreground">
              All {INVESTIGATORS.length} investigators have been played at least once.
            </p>
          </Card>
        ) : (
          <>
            <p className="text-sm text-foreground mb-4">
              {investigatorsNeverPlayed.length} of {INVESTIGATORS.length} investigators haven't been played yet
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {investigatorsNeverPlayed.map(investigator => {
                const arkhamDBUrl = getArkhamDBUrl(investigator.name)
                return (
                  <Card key={investigator.name} className={cn("p-3 group relative", arkhamDBUrl && "hover:border-accent transition-colors")}>
                    {arkhamDBUrl && (
                      <a 
                        href={arkhamDBUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 z-10"
                        aria-label={`View ${investigator.name} on ArkhamDB`}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <h4 className="font-medium text-sm truncate flex-1">{investigator.name}</h4>
                        {arkhamDBUrl && (
                          <ArrowSquareOut size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {investigator.archetypes.map(archetype => (
                          <ArchetypeBadge key={archetype} archetype={archetype} className="text-xs px-1.5 py-0" />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{investigator.set}</p>
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
