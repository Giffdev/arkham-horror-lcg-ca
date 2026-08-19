import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapTrifold, Users, Sparkle, Trophy, BookOpen, UserFocus, Detective, Shield } from '@phosphor-icons/react'
import {
  getCommunityStats,
  getCommunityStatsAvailability,
  type CommunityStats as CommunityStatsType,
  type CommunityStatsAvailability,
} from '@/lib/community-stats'
import { ArchetypeBadge } from '@/components/ArchetypeBadge'
import { getArkhamDBUrl, getArkhamDBUrlById, getChapterBadgeLabel, isChapterBadgeSpecial, resolveInvestigator } from '@/lib/investigator-data'
import { StatsListCard } from '@/components/StatsListCard'
import { ALL_CAMPAIGNS, campaignTypeLabel } from '@/lib/campaign-data'
import { CampaignSvgIcon } from '@/components/CampaignSvgIcon'
import { hasDedicatedCampaignIcon } from '@/lib/campaign-icon-map'

/**
 * Resolve the key passed to getCampaignSvgRaw for a campaign name.
 * Scenario Packs all share set='Scenario Pack', so pass the scenario name
 * directly — the asset registry's standalone map is keyed by name.
 */
function campaignSetKey(name: string): string {
  const c = ALL_CAMPAIGNS.find(x => x.name === name)
  if (c?.type === 'Scenario Pack') return name
  return c?.set ?? name
}

/**
 * Resolve the icon key for a standalone scenario entry from community stats.
 *
 * Firestore data may carry the canonical scenario name (full title) or, for
 * older cached documents, just the campaign set name.  We prefer the scenario
 * name because the standalone registry is keyed that way, but fall back to the
 * set field so that any Barkham-labeled label always reaches barkham_horror.svg
 * before the Elder Sign fallback.
 */
function standaloneIconKey(s: { name: string; set?: string }): string {
  if (hasDedicatedCampaignIcon(s.name)) return s.name
  if (s.set && hasDedicatedCampaignIcon(s.set)) return s.set
  return s.name
}

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
  const staleBanner = communityStatsAvailability === 'stale'
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
        {staleBanner}
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            No community data available yet. Be the first to log a playthrough!
          </p>
        </Card>
      </div>
    )
  }

  const campaignItems = (communityStats.topCampaigns ?? []).map(campaign => {
    const typeLabel = campaignTypeLabel(campaign.name)
    return {
      key: campaign.name,
      countLabel: `${campaign.count} ${campaign.count === 1 ? 'play' : 'plays'}`,
      renderContent: () => (
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Icon + name are atomic — they stay together as a unit */}
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

  const investigatorItems = (communityStats.topInvestigators ?? []).map(investigator => {
    const resolved = resolveInvestigator({
      investigatorId: investigator.investigatorId,
      investigatorName: investigator.name,
      chapter: investigator.chapter,
      investigatorSet: investigator.investigatorSet,
    })
    const arkhamDBUrl = resolved
      ? getArkhamDBUrlById(resolved.id, investigator.archetypes[0])
      : getArkhamDBUrl(investigator.name, investigator.archetypes[0], investigator.chapter)
    const chapterInfo = resolved || { set: undefined, chapter: investigator.chapter || 1 }

    return {
      key: investigator.investigatorId ?? `${investigator.name}__ch${investigator.chapter ?? 1}`,
      countLabel: `${investigator.count} ${investigator.count === 1 ? 'play' : 'plays'}`,
      renderContent: () => (
        <div
          className="grid items-center gap-x-2 min-w-0"
          style={{ gridTemplateColumns: 'max-content 1fr' }}
        >
          {/* col 1: badge(s) — max-content column matches PlaythroughCard InvestigatorGrid */}
          <div data-badge className="flex gap-1 flex-shrink-0 items-center">
            {investigator.archetypes.map((archetype) => (
              <ArchetypeBadge key={archetype} archetype={archetype} />
            ))}
          </div>
          {/* col 2: name + chapter — takes remaining width; wraps text without truncation */}
          <div data-name className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            {arkhamDBUrl ? (
              <a
                href={arkhamDBUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:text-primary transition-colors underline decoration-transparent hover:decoration-primary min-w-0"
              >
                {investigator.name}
              </a>
            ) : (
              <span className="font-medium text-foreground min-w-0">{investigator.name}</span>
            )}
            <span className={`text-xs font-medium flex-shrink-0 ${
              isChapterBadgeSpecial(chapterInfo) ? 'text-violet-400' : 'text-muted-foreground opacity-60'
            }`}>
              · {getChapterBadgeLabel(chapterInfo)}
            </span>
          </div>
        </div>
      ),
    }
  })

  const classTotal = (communityStats.topClasses ?? []).reduce((s, c) => s + c.count, 0)
  const classItems = (communityStats.topClasses ?? []).map(cls => ({
    key: cls.archetype,
    countLabel: `${cls.count} plays (${classTotal > 0 ? Math.round((cls.count / classTotal) * 100) : 0}%)`,
    renderContent: () => <ArchetypeBadge archetype={cls.archetype} />,
  }))

  const standaloneItems = (communityStats.topStandalones ?? []).map(s => ({
    key: s.name,
    countLabel: `${s.count} ${s.count === 1 ? 'play' : 'plays'}`,
    renderContent: () => (
      <div>
        {/* Icon + name atomic unit; fallback (Elder Sign) allowed for unconfirmed scenarios */}
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <CampaignSvgIcon
            campaignSet={standaloneIconKey(s)}
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
    <div className="space-y-6">
      {staleBanner}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-foreground mb-2">Community Stats</h3>
        <p className="text-muted-foreground">See what the community is playing</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-start">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-primary" weight="duotone" />
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
