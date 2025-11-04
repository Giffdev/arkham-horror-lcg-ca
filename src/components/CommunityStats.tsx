import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Users, ChartBar, Sparkle, Trophy, GameController } from '@phosphor-icons/react'
import { getCommunityStats, CommunityStats as CommunityStatsType } from '@/lib/community-stats'
import { ArchetypeBadge } from '@/components/ArchetypeBadge'
import { getArkhamDBUrl } from '@/lib/investigator-data'

export function CommunityStats() {
  const [communityStats, setCommunityStats] = useState<CommunityStatsType | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await getCommunityStats()
        setCommunityStats(stats)
      } catch (error) {
        console.error('Failed to load community stats:', error)
      } finally {
        setIsLoadingStats(false)
      }
    }
    loadStats()
  }, [])

  if (isLoadingStats) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <BookOpen size={48} className="text-primary mb-4 animate-pulse" weight="duotone" />
        <p className="text-muted-foreground">Loading community stats...</p>
      </div>
    )
  }

  if (!communityStats || communityStats.totalGames === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">
          No community data available yet. Be the first to log a playthrough!
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-foreground mb-2">Community Stats</h3>
        <p className="text-muted-foreground">See what the community is playing</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <GameController size={20} className="text-primary" weight="duotone" />
              <CardTitle className="text-sm text-muted-foreground">Total Games Logged</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{communityStats.totalGames}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-primary" weight="duotone" />
              <CardTitle className="text-sm text-muted-foreground">Community Members</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{communityStats.registeredUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-primary" weight="duotone" />
              <CardTitle className="text-sm text-muted-foreground">Investigators Played</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{communityStats.totalInvestigatorsPlayed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-primary" weight="duotone" />
              <CardTitle className="text-sm text-muted-foreground">Unique Campaigns</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{communityStats.topCampaigns.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy size={20} className="text-primary" weight="duotone" />
              <CardTitle>Most Popular Campaigns</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {communityStats.topCampaigns.slice(0, 5).map((campaign, index) => (
                <div key={campaign.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-2xl font-bold text-muted-foreground/40 w-6 text-right flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{campaign.name}</span>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground ml-2 flex-shrink-0">
                    {campaign.count} {campaign.count === 1 ? 'play' : 'plays'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users size={20} className="text-primary" weight="duotone" />
              <CardTitle>Most Played Investigators</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {communityStats.topInvestigators.slice(0, 5).map((investigator, index) => {
                const arkhamDBUrl = getArkhamDBUrl(investigator.name, investigator.archetypes[0])
                
                return (
                  <div key={investigator.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-2xl font-bold text-muted-foreground/40 w-6 text-right flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex gap-1">
                            {investigator.archetypes.map((archetype) => (
                              <ArchetypeBadge key={archetype} archetype={archetype} />
                            ))}
                          </div>
                          {arkhamDBUrl ? (
                            <a
                              href={arkhamDBUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-foreground hover:text-primary transition-colors underline decoration-transparent hover:decoration-primary"
                            >
                              {investigator.name}
                            </a>
                          ) : (
                            <span className="font-medium text-foreground">{investigator.name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground ml-2 flex-shrink-0">
                      {investigator.count} {investigator.count === 1 ? 'play' : 'plays'}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {communityStats.topStandalones.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkle size={20} className="text-primary" weight="duotone" />
                <CardTitle>Popular Standalone Scenarios</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {communityStats.topStandalones.slice(0, 5).map((standalone, index) => (
                  <div key={standalone.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-2xl font-bold text-muted-foreground/40 w-6 text-right flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">{standalone.name}</span>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground ml-2 flex-shrink-0">
                      {standalone.count} {standalone.count === 1 ? 'play' : 'plays'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {communityStats.topSideScenarios.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ChartBar size={20} className="text-primary" weight="duotone" />
                <CardTitle>Popular Side Stories</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {communityStats.topSideScenarios.slice(0, 5).map((sideScenario, index) => (
                  <div key={sideScenario.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-2xl font-bold text-muted-foreground/40 w-6 text-right flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="font-medium text-foreground truncate">{sideScenario.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground ml-2 flex-shrink-0">
                      {sideScenario.count} {sideScenario.count === 1 ? 'play' : 'plays'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
