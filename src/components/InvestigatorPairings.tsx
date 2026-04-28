import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UsersThree } from '@phosphor-icons/react'
import { Playthrough } from '@/lib/types'
import { useInvestigatorPairings, InvestigatorPairing } from '@/hooks/useInvestigatorPairings'
import { CommunityPairing } from '@/lib/community-stats'

interface InvestigatorPairingsProps {
  playthroughs: Playthrough[] | undefined
  communityPairings?: CommunityPairing[]
}

function PairList({ pairs, emptyMessage }: { pairs: InvestigatorPairing[]; emptyMessage: string }) {
  if (pairs.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3">
      {pairs.slice(0, 7).map((pair, index) => (
        <div key={`${pair.investigators[0]}-${pair.investigators[1]}`} className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-2xl font-bold text-muted-foreground/40 w-6 text-right flex-shrink-0">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <span className="font-medium text-foreground text-sm">
                {pair.investigators[0]}
              </span>
              <span className="text-muted-foreground mx-1.5">&amp;</span>
              <span className="font-medium text-foreground text-sm">
                {pair.investigators[1]}
              </span>
            </div>
          </div>
          <span className="text-sm text-muted-foreground ml-2 flex-shrink-0">
            {pair.count} {pair.count === 1 ? 'game' : 'games'}
          </span>
        </div>
      ))}
    </div>
  )
}

export function InvestigatorPairingsPanel({ playthroughs, communityPairings }: InvestigatorPairingsProps) {
  const { personal } = useInvestigatorPairings(playthroughs)

  const hasPersonal = playthroughs && playthroughs.length > 0 && personal.length > 0
  const communityAsPairs: InvestigatorPairing[] | null = communityPairings?.length
    ? communityPairings.map(cp => ({ investigators: [cp.investigator1, cp.investigator2] as [string, string], count: cp.count }))
    : null

  if (!hasPersonal && !communityAsPairs) {
    return null
  }

  return (
    <section aria-label="Investigator Pairing Analysis" className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground mb-1">Investigator Pairings</h3>
        <p className="text-sm text-muted-foreground">Which investigators team up most often</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UsersThree size={20} className="text-primary" weight="duotone" />
              <CardTitle>Your Top Pairings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PairList pairs={personal} emptyMessage="Log more multiplayer games to see your pairings!" />
          </CardContent>
        </Card>

        {communityAsPairs && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UsersThree size={20} className="text-primary" weight="duotone" />
                <CardTitle>Community Top Pairings</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <PairList pairs={communityAsPairs} emptyMessage="No community pairing data yet." />
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}
