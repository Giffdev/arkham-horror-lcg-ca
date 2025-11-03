import { useMemo } from 'react'
import { Playthrough } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { INVESTIGATORS } from '@/lib/investigator-data'
import { User, Check, X } from '@phosphor-icons/react'

interface PlayersOverviewProps {
  playthroughs: Playthrough[]
}

export function PlayersOverview({ playthroughs }: PlayersOverviewProps) {
  const { playersWithGames, investigatorsNeverPlayed } = useMemo(() => {
    const playerMap = new Map<string, {
      name: string
      gamesPlayed: number
      investigatorsPlayed: Set<string>
    }>()

    playthroughs.forEach(playthrough => {
      playthrough.investigators.forEach(inv => {
        const playerName = inv.playerName.trim()
        if (!playerName) return

        if (!playerMap.has(playerName)) {
          playerMap.set(playerName, {
            name: playerName,
            gamesPlayed: 0,
            investigatorsPlayed: new Set()
          })
        }

        const player = playerMap.get(playerName)!
        player.gamesPlayed++
        
        if (!inv.isUnknown && inv.investigatorName !== 'Unknown') {
          player.investigatorsPlayed.add(inv.investigatorName)
        }
      })
    })

    const playersArray = Array.from(playerMap.values())
      .sort((a, b) => b.gamesPlayed - a.gamesPlayed)

    const playedInvestigatorNames = new Set<string>()
    playthroughs.forEach(p => {
      p.investigators.forEach(inv => {
        if (!inv.isUnknown && inv.investigatorName !== 'Unknown') {
          playedInvestigatorNames.add(inv.investigatorName)
        }
      })
    })

    const neverPlayed = INVESTIGATORS
      .filter(inv => !playedInvestigatorNames.has(inv.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      playersWithGames: playersArray,
      investigatorsNeverPlayed: neverPlayed
    }
  }, [playthroughs])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">All Players</h2>
        {playersWithGames.length === 0 ? (
          <Card className="p-12 text-center">
            <User size={48} weight="duotone" className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No players found. Add player names when logging games.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {playersWithGames.map(player => (
              <Card key={player.name} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User size={20} weight="duotone" className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{player.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span>{player.gamesPlayed} {player.gamesPlayed === 1 ? 'game' : 'games'}</span>
                      <span>•</span>
                      <span>{player.investigatorsPlayed.size} {player.investigatorsPlayed.size === 1 ? 'investigator' : 'investigators'}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
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
                <Card key={investigator.name} className="p-3">
                  <div className="flex items-start gap-2">
                    <X size={16} weight="bold" className="text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{investigator.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{investigator.set}</p>
                    </div>
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
