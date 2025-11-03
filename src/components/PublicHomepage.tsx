import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, TrendUp, SignIn } from '@phosphor-icons/react'
import { CampaignIcon } from '@/components/CampaignIcon'
import { ArchetypeBadge } from '@/components/ArchetypeBadge'
import { Archetype } from '@/lib/types'
import { AuthDialog } from '@/components/AuthDialog'
import { User } from '@/lib/auth'

interface PublicStats {
  totalGames: number
  topCampaigns: { name: string; count: number; set?: string }[]
  topInvestigators: { name: string; count: number; archetypes: Archetype[] }[]
  totalInvestigatorsPlayed: number
}

interface PublicHomepageProps {
  onAuthSuccess: (user: User) => void
}

export function PublicHomepage({ onAuthSuccess }: PublicHomepageProps) {
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)

  useEffect(() => {
    async function loadPublicStats() {
      try {
        const allKeys = await spark.kv.keys()
        const playthroughKeys = allKeys.filter((key: string) => key.startsWith('user_') && key.endsWith('_playthroughs'))
        
        const campaignCounts = new Map<string, { count: number; set?: string }>()
        const investigatorCounts = new Map<string, { count: number; archetypes: Archetype[] }>()
        let totalGames = 0

        for (const key of playthroughKeys) {
          const playthroughs = await spark.kv.get(key) as any[]
          if (!playthroughs) continue

          totalGames += playthroughs.length

          for (const playthrough of playthroughs) {
            if (playthrough.campaignName && playthrough.campaignName !== 'Unknown') {
              const existing = campaignCounts.get(playthrough.campaignName) || { count: 0, set: playthrough.campaignSet }
              campaignCounts.set(playthrough.campaignName, {
                count: existing.count + 1,
                set: existing.set || playthrough.campaignSet
              })
            }

            for (const inv of playthrough.investigators || []) {
              if (inv.investigatorName && inv.investigatorName !== 'Unknown' && !inv.isCustom) {
                const existing = investigatorCounts.get(inv.investigatorName) || { 
                  count: 0, 
                  archetypes: inv.archetypes || [inv.archetype] 
                }
                investigatorCounts.set(inv.investigatorName, {
                  count: existing.count + 1,
                  archetypes: existing.archetypes
                })
              }
            }
          }
        }

        const topCampaigns = Array.from(campaignCounts.entries())
          .map(([name, data]) => ({ name, count: data.count, set: data.set }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        const topInvestigators = Array.from(investigatorCounts.entries())
          .map(([name, data]) => ({ name, count: data.count, archetypes: data.archetypes }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        setStats({
          totalGames,
          topCampaigns,
          topInvestigators,
          totalInvestigatorsPlayed: investigatorCounts.size
        })
      } catch (error) {
        console.error('Error loading public stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPublicStats()
  }, [])

  const handleLogin = () => {
    setAuthDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BookOpen size={48} className="text-primary mx-auto mb-4" weight="duotone" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
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
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">
              Track Your Arkham Horror Adventures
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Log your campaign playthroughs, track investigators and players, and explore your gaming history.
              Create an account to get started.
            </p>
          </div>

          {stats && stats.totalGames > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <TrendUp size={24} className="text-primary" weight="duotone" />
                <h3 className="text-2xl font-bold text-foreground">Community Stats</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground">Total Games Logged</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-foreground">{stats.totalGames}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground">Unique Investigators</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-foreground">{stats.totalInvestigatorsPlayed}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground">Top Campaigns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-foreground">{stats.topCampaigns.length}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-foreground">Most Played Campaigns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.topCampaigns.map((campaign, index) => (
                        <div key={campaign.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-muted-foreground font-mono text-sm flex-shrink-0">
                              #{index + 1}
                            </span>
                            {campaign.set && <CampaignIcon campaignSet={campaign.set} />}
                            <span className="font-medium text-foreground truncate">{campaign.name}</span>
                          </div>
                          <span className="text-muted-foreground ml-2 flex-shrink-0">
                            {campaign.count} {campaign.count === 1 ? 'play' : 'plays'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-foreground">Most Played Investigators</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.topInvestigators.map((investigator, index) => (
                        <div key={investigator.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-muted-foreground font-mono text-sm flex-shrink-0">
                              #{index + 1}
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {investigator.archetypes.map((archetype) => (
                                <ArchetypeBadge key={archetype} archetype={archetype} />
                              ))}
                            </div>
                            <span className="font-medium text-foreground truncate">{investigator.name}</span>
                          </div>
                          <span className="text-muted-foreground ml-2 flex-shrink-0">
                            {investigator.count} {investigator.count === 1 ? 'play' : 'plays'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center pt-6">
                <Button onClick={handleLogin} size="lg" className="gap-2">
                  <SignIn size={20} weight="bold" />
                  Sign In to Start Tracking
                </Button>
              </div>
            </div>
          )}

          {stats && stats.totalGames === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-6">
                Be the first to log your Arkham Horror adventures!
              </p>
              <Button onClick={handleLogin} size="lg" className="gap-2">
                <SignIn size={20} weight="bold" />
                Sign In to Get Started
              </Button>
            </div>
          )}
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
