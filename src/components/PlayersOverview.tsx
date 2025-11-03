import { useMemo } from 'react'
import { Playthrough } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { INVESTIGATORS, Investigator, getArkhamDBUrl } from '@/lib/investigator-data'
import { Check, ArrowSquareOut } from '@phosphor-icons/react'
import { ArchetypeBadge } from '@/components/ArchetypeBadge'

interface PlayersOverviewProps {
  playthroughs: Playthrough[]
}

export function PlayersOverview({ playthroughs }: PlayersOverviewProps) {
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

    return {
      investigatorsPlayed: playedArray,
      investigatorsNeverPlayed: neverPlayed
    }
  }, [playthroughs])

  return (
    <div className="space-y-6">
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
            <p className="text-sm text-muted-foreground mb-4">
              {investigatorsPlayed.length} of {INVESTIGATORS.length} investigators have been played
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {investigatorsPlayed.map(({ investigator, timesPlayed }) => (
                <Card key={investigator.name} className="p-4 group relative hover:border-accent transition-colors">
                  <a 
                    href={getArkhamDBUrl(investigator.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 z-10"
                    aria-label={`View ${investigator.name} on ArkhamDB`}
                  />
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <h3 className="font-semibold truncate flex-1">{investigator.name}</h3>
                        <ArrowSquareOut size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
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
              ))}
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
            <p className="text-sm text-muted-foreground mb-4">
              {investigatorsNeverPlayed.length} of {INVESTIGATORS.length} investigators haven't been played yet
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {investigatorsNeverPlayed.map(investigator => (
                <Card key={investigator.name} className="p-3 group relative hover:border-accent transition-colors">
                  <a 
                    href={getArkhamDBUrl(investigator.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 z-10"
                    aria-label={`View ${investigator.name} on ArkhamDB`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <h4 className="font-medium text-sm truncate flex-1">{investigator.name}</h4>
                      <ArrowSquareOut size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {investigator.archetypes.map(archetype => (
                        <ArchetypeBadge key={archetype} archetype={archetype} className="text-xs px-1.5 py-0" />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{investigator.set}</p>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
