import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapTrifold, Users, Sparkle, Trophy, BookOpen, UserFocus, Detective, Shield } from '@phosphor-icons/react'
import {
  getCommunityStats,
  getCommunityStatsAvailability,
  type CommunityStats as CommunityStatsType,
  type CommunityStatsAvailability,
} from '@/lib/community-stats'
import { communityCampaignItem, communityClassItems, communityStandaloneItem } from '@/components/CommunityRankingItems'
import { mostPlayedInvestigatorItem } from '@/components/MostPlayedInvestigator'
import { StatsListCard } from '@/components/StatsListCard'

function formatLastUpdated(lastUpdated?: number): string | null {
  if (typeof lastUpdated !== 'number' || !Number.isFinite(lastUpdated)) return null
  return new Date(lastUpdated).toLocaleString()
}

export function CommunityStats() {
  const [communityStats, setCommunityStats] = useState<CommunityStatsType | null>(null)
  const [communityStatsAvailability, setCommunityStatsAvailability] = useState<CommunityStatsAvailability>('ready')
  const [isLoadingStats, setIsLoadingStats] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await getCommunityStats()
        setCommunityStats(stats)
        setCommunityStatsAvailability(getCommunityStatsAvailability(stats))
      } catch (error) {
        console.error('Failed to load community stats:', error)
        setCommunityStatsAvailability('unavailable')
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

  if (communityStatsAvailability === 'unavailable') {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">
          Community stats are unavailable right now. The trusted aggregate has not been published yet.
        </p>
      </Card>
    )
  }

  if (communityStatsAvailability === 'old-schema') {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">
          Community stats are refreshing after a backend upgrade. Please check back in a moment.
        </p>
      </Card>
    )
  }

  const lastUpdatedLabel = formatLastUpdated(communityStats?.generatedAt ?? communityStats?.lastUpdated)
  const aggregateWarning = communityStatsAvailability === 'failed'
    ? (
        <Card className="border-red-400/40 bg-red-500/10">
          <CardContent className="py-3 text-sm text-red-100">
            Community stats updates are blocked. Showing the last trusted aggregate{lastUpdatedLabel ? ` from ${lastUpdatedLabel}` : ''}.
          </CardContent>
        </Card>
      )
    : communityStatsAvailability === 'stale'
    ? (
        <Card className="border-amber-400/40 bg-amber-500/10">
          <CardContent className="py-3 text-sm text-amber-100">
            Community stats are refreshing. Showing the last trusted aggregate{lastUpdatedLabel ? ` from ${lastUpdatedLabel}` : ''}.
          </CardContent>
        </Card>
      )
    : null

  if (!communityStats || communityStats.totalGames === 0) {
    return (
      <div className="space-y-4">
        {aggregateWarning}
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            No community data available yet. Be the first to log a playthrough!
          </p>
        </Card>
      </div>
    )
  }

  const campaignItems = (communityStats.topCampaigns ?? []).map(communityCampaignItem)
  const investigatorItems = (communityStats.topInvestigators ?? []).map(investigator => mostPlayedInvestigatorItem(investigator, true))
  const classItems = communityClassItems(communityStats.topClasses)
  const standaloneItems = (communityStats.topStandalones ?? []).map(communityStandaloneItem)

  return (
    <div className="space-y-6">
      {aggregateWarning}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-foreground mb-2">Community Stats</h3>
        <p className="text-muted-foreground">See what the community is playing</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-start">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-primary" weight="duotone" />
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
              <UserFocus size={20} className="text-primary" weight="duotone" />
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
              <MapTrifold size={20} className="text-primary" weight="duotone" />
              <CardTitle className="text-sm text-muted-foreground">Unique Campaigns</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{communityStats.topCampaigns.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
        <StatsListCard
          icon={Trophy}
          title="Most Popular Campaigns"
          subtitle="Full & short campaigns"
          items={campaignItems}
          className="h-full"
        />

        <StatsListCard
          icon={Detective}
          title="Most Played Investigators"
          items={investigatorItems}
          totalCount={communityStats.totalInvestigatorsPlayed}
          className="h-full"
        />

        {classItems.length > 0 && (
          <StatsListCard
            icon={Shield}
            title="Class Popularity"
            items={classItems}
            collapseAfter={6}
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
  )
}
