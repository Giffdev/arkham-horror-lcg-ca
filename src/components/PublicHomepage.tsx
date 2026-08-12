import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SignIn, Users, ChartBar, Sparkle, Trophy, GameController, Shield } from '@phosphor-icons/react'
import { AuthDialog } from '@/components/AuthDialog'
import { User } from '@/lib/auth'
import { getCommunityStats, CommunityStats } from '@/lib/community-stats'
import { ArchetypeBadge } from '@/components/ArchetypeBadge'
import { StatsListCard } from '@/components/StatsListCard'
import { ALL_CAMPAIGNS, campaignTypeLabel } from '@/lib/campaign-data'
import { CampaignSvgIcon } from '@/components/CampaignSvgIcon'
import { getBrandSvgRaw } from '@/lib/campaign-icon-map'
import { cn } from '@/lib/utils'

function injectSize(svgString: string, size: number): string {
  return svgString.replace(
    /<svg\b([^>]*)>/,
    (_, attrs: string) => `<svg${attrs.replace(/\s*(width|height)="[^"]*"/g, '')} width="${size}" height="${size}">`,
  )
}

function BrandSvg({ brandKey, size = 24, className }: { brandKey: 'codex' | 'log'; size?: number; className?: string }) {
  const raw = useMemo(() => injectSize(getBrandSvgRaw(brandKey), size), [brandKey, size])
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex flex-shrink-0', className)}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: raw }}
    />
  )
}

interface PublicHomepageProps {
  onAuthSuccess: (user: User) => void
}

function campaignSetKey(name: string): string {
  const c = ALL_CAMPAIGNS.find(x => x.name === name)
  if (c?.type === 'Scenario Pack') return name
  return c?.set ?? name
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

  // Build StatsListCard items from community stats (with safety defaults for missing fields)
  const investigatorItems = (communityStats?.topInvestigators ?? []).map(investigator => ({
    key: investigator.investigatorId ?? `${investigator.name}__ch${investigator.chapter ?? 1}`,
    countLabel: `${investigator.count} ${investigator.count === 1 ? 'play' : 'plays'}`,
    renderContent: () => (
      <div
        className="grid items-center gap-x-2 min-w-0"
        style={{ gridTemplateColumns: 'max-content 1fr' }}
      >
        <div data-badge className="flex gap-1 flex-shrink-0 items-center">
          {investigator.archetypes.map((archetype) => (
            <ArchetypeBadge key={archetype} archetype={archetype} />
          ))}
        </div>
        <div data-name className="min-w-0">
          <span className="font-medium text-foreground min-w-0">{investigator.name}</span>
        </div>
      </div>
    ),
  }))

  const campaignItems = (communityStats?.topCampaigns ?? []).map(campaign => {
    const typeLabel = campaignTypeLabel(campaign.name)
    return {
      key: campaign.name,
      countLabel: `${campaign.count} ${campaign.count === 1 ? 'play' : 'plays'}`,
      renderContent: () => (
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <CampaignSvgIcon
              campaignSet={campaignSetKey(campaign.name)}
              size={14}
              aria-hidden="true"
              className="flex-shrink-0 text-primary/60"
            />
            <span className="font-medium text-foreground">{campaign.name}</span>
          </span>
          {typeLabel && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
              {typeLabel}
            </span>
          )}
        </div>
      ),
    }
  })

  const classTotal = (communityStats?.topClasses ?? []).reduce((s, c) => s + c.count, 0)
  const classItems = (communityStats?.topClasses ?? []).map(cls => ({
    key: cls.archetype,
    countLabel: `${cls.count} plays (${classTotal > 0 ? Math.round((cls.count / classTotal) * 100) : 0}%)`,
    renderContent: () => <ArchetypeBadge archetype={cls.archetype} />,
  }))

  const standaloneItems = (communityStats?.topStandalones ?? []).map(s => ({
    key: s.name,
    countLabel: `${s.count} ${s.count === 1 ? 'play' : 'plays'}`,
    renderContent: () => (
      <div>
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <CampaignSvgIcon
            campaignSet={s.name}
            size={14}
            aria-hidden="true"
            className="flex-shrink-0 text-primary/60"
          />
          <span className="font-medium text-foreground">{s.name}</span>
        </span>
        {s.breakdown && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {s.breakdown.asStandalone} standalone · {s.breakdown.asSideStory} side story
          </p>
        )}
      </div>
    ),
  }))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 md:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              <BrandSvg brandKey="codex" size={24} className="md:w-8 md:h-8 text-primary" />
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-start">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <GameController size={20} className="text-primary" weight="duotone" />
                      <CardTitle className="text-sm text-muted-foreground">Total Campaigns Logged</CardTitle>
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
                      <BrandSvg brandKey="log" size={20} className="text-primary" />
                      <CardTitle className="text-sm text-muted-foreground">Unique Campaigns</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{communityStats.topCampaigns.length}</div>
                  </CardContent>
                </Card>
              </div>

              <StatsListCard
                icon={Users}
                title="Most Played Investigators"
                items={investigatorItems}
                totalCount={communityStats.totalInvestigatorsPlayed}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
                <StatsListCard
                  icon={Trophy}
                  title="Most Popular Campaigns"
                  subtitle="Full & short campaigns"
                  items={campaignItems}
                  className="h-full"
                />

                {classItems.length > 0 && (
                  <StatsListCard
                    icon={Shield}
                    title="Class Ranking"
                    items={classItems}
                    className="h-full"
                  />
                )}

                {standaloneItems.length > 0 && (
                  <StatsListCard
                    icon={Sparkle}
                    title="Popular Standalone Scenarios"
                    subtitle="Includes plays as standalone and side story"
                    items={standaloneItems}
                    className="h-full"
                  />
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BrandSvg brandKey="log" size={24} className="text-primary" />
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
