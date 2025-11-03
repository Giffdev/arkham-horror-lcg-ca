import { useMemo } from 'react'
import { Playthrough } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArchetypeBadge } from './ArchetypeBadge'
import { User, Briefcase, UsersThree } from '@phosphor-icons/react'
import { formatDate } from '@/lib/date-utils'
import { getDisplaySetName } from '@/lib/investigator-data'

interface PlayerStatsProps {
  playerName: string
  playthroughs: Playthrough[]
}

export function PlayerStats({ playerName, playthroughs }: PlayerStatsProps) {
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

    const investigators = Array.from(
      new Set(
        playerGames.flatMap(p =>
          p.investigators
            .filter(inv => inv.playerName === playerName)
            .map(inv => inv.isUnknown || inv.investigatorName === 'Unknown' ? 'Unknown' : inv.investigatorName)
        )
      )
    )

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

    return {
      totalGames: playerGames.length,
      campaigns,
      investigators,
      archetypeCounts
    }
  }, [playerName, playthroughs])

  const topArchetypes = Object.entries(playerData.archetypeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Briefcase size={20} weight="duotone" className="text-primary" />
            <h3 className="font-semibold">Total Games</h3>
          </div>
          <p className="text-3xl font-bold">{playerData.totalGames}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <UsersThree size={20} weight="duotone" className="text-primary" />
            <h3 className="font-semibold">Investigators Used</h3>
          </div>
          <p className="text-3xl font-bold">{playerData.investigators.length}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center text-xs font-bold">
              #1
            </div>
            <h3 className="font-semibold">Favorite Class</h3>
          </div>
          {topArchetypes.length > 0 ? (
            <div className="flex items-center gap-2">
              <ArchetypeBadge archetype={topArchetypes[0][0] as any} />
              <span className="text-sm text-muted-foreground">
                ({topArchetypes[0][1]} {topArchetypes[0][1] === 1 ? 'time' : 'times'})
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground">N/A</p>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Investigators Played</h3>
        {playerData.investigators.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">No investigators recorded yet</p>
          </Card>
        ) : (
          <div className="flex flex-wrap gap-2">
            {playerData.investigators.map((investigator) => (
              <Badge key={investigator} variant="secondary" className="text-sm">
                {investigator}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Campaign History</h3>
        {playerData.campaigns.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">No campaigns recorded yet</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {playerData.campaigns.map((campaign, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
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
                    <div className="w-24 flex justify-start">
                      <ArchetypeBadge archetype={campaign.investigator.archetype} className="w-20 justify-center" />
                    </div>
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
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
