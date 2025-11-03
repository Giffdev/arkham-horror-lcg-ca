import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, SignIn, Users, ChartBar, Sparkle, Trophy, GameController } from '@phosphor-icons/react'
import { AuthDialog } from '@/components/AuthDialog'
import { User } from '@/lib/auth'
import { getCommunityStats, CommunityStats } from '@/lib/community-stats'
import { ArchetypeBadge } from '@/components/ArchetypeBadge'

interface PublicHomepageProps {
  onAuthSuccess: (user: User) => void
}

export function PublicHomepage({ onAuthSuccess }: PublicHomepageProps) {
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null)
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

  const handleLogin = () => {
    setAuthDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 md:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              <BookOpen size={24} className="md:w-8 md:h-8 text-primary" weight="duotone" />
              <h1 className="text-lg md:text-3xl font-bold text-foreground">Arkham Horror LCG Tracker</h1>
            </div>
            <Button onClick={handleLogin} className="gap-2">
              <SignIn size={18} weight="bold" />
              Sign In
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">
              Track Your Arkham Horror Adventures
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join the community tracking their Arkham Horror LCG campaigns. Log your playthroughs, discover what others are playing, and explore your gaming history.
            </p>
            <div className="pt-4">
              <Button onClick={handleLogin} size="lg" className="gap-2">
                <SignIn size={20} weight="bold" />
                Sign In to Get Started
              </Button>
            </div>
          </div>

          {!isLoadingStats && communityStats && communityStats.totalGames > 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-foreground mb-2">Community Stats</h3>
                <p className="text-muted-foreground">See what the community is playing</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      {communityStats.topInvestigators.slice(0, 5).map((investigator, index) => (
                        <div key={investigator.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="text-2xl font-bold text-muted-foreground/40 w-6 text-right flex-shrink-0">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-foreground">{investigator.name}</span>
                                <div className="flex gap-1">
                                  {investigator.archetypes.map((archetype) => (
                                    <ArchetypeBadge key={archetype} archetype={archetype} />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground ml-2 flex-shrink-0">
                            {investigator.count} {investigator.count === 1 ? 'play' : 'plays'}
                          </span>
                        </div>
                      ))}
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
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen size={24} className="text-primary" weight="duotone" />
                </div>
                <CardTitle className="text-foreground">Log Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Record your full campaigns, standalone scenarios, and custom fan-made adventures with complete investigator details.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users size={24} className="text-primary" weight="duotone" />
                </div>
                <CardTitle className="text-foreground">Track Players</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  View detailed statistics for each player including campaigns played, favorite investigators, and most-used classes.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ChartBar size={24} className="text-primary" weight="duotone" />
                </div>
                <CardTitle className="text-foreground">Analyze History</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Filter by archetype or campaign type, and discover patterns in your gaming sessions over time.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button onClick={handleLogin} size="lg" className="gap-2">
              <SignIn size={20} weight="bold" />
              Create Account or Sign In
            </Button>
          </div>
        </div>
      </main>

      <AuthDialog 
        open={authDialogOpen} 
        onOpenChange={setAuthDialogOpen} 
        onSuccess={onAuthSuccess}
      />
    </div>
  )
}
