import { ArchetypeBadge } from '@/components/ArchetypeBadge'
import { CampaignSvgIcon } from '@/components/CampaignSvgIcon'
import type { StatsListItem } from '@/components/StatsListCard'
import { ALL_CAMPAIGNS, campaignTypeLabel } from '@/lib/campaign-data'
import { hasDedicatedCampaignIcon } from '@/lib/campaign-icon-map'
import { completeClassPopularity } from '@/lib/class-popularity'
import type { CommunityStats } from '@/lib/community-stats'

function campaignSetKey(name: string): string {
  if (hasDedicatedCampaignIcon(name)) return name
  const campaign = ALL_CAMPAIGNS.find(entry => entry.name === name)
  // Scenario Pack is a shared set; its artwork is keyed by scenario name.
  return campaign?.type === 'Scenario Pack' ? name : campaign?.set ?? name
}

function standaloneIconKey({ name, set }: CommunityStats['topStandalones'][number]): string {
  if (hasDedicatedCampaignIcon(name)) return name
  // Older aggregates may identify the artwork by set rather than title.
  return set && hasDedicatedCampaignIcon(set) ? set : name
}

function RankedName({ name, iconKey }: { name: string; iconKey: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <CampaignSvgIcon
        campaignSet={iconKey}
        size={14}
        aria-hidden="true"
        className="flex-shrink-0 text-primary/60"
      />
      <span className="font-medium text-foreground">{name}</span>
    </span>
  )
}

function playCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'play' : 'plays'}`
}

export function communityCampaignItem(campaign: CommunityStats['topCampaigns'][number]): StatsListItem {
  const typeLabel = campaignTypeLabel(campaign.name)
  return {
    key: campaign.name,
    countLabel: playCountLabel(campaign.count),
    renderContent: () => (
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <RankedName name={campaign.name} iconKey={campaignSetKey(campaign.name)} />
        {typeLabel && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
            {typeLabel}
          </span>
        )}
      </div>
    ),
  }
}

export function communityStandaloneItem(scenario: CommunityStats['topStandalones'][number]): StatsListItem {
  return {
    key: scenario.name,
    countLabel: playCountLabel(scenario.count),
    renderContent: () => (
      <div>
        <RankedName name={scenario.name} iconKey={standaloneIconKey(scenario)} />
        {scenario.breakdown && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {scenario.breakdown.asStandalone} standalone · {scenario.breakdown.asSideStory} side story
          </p>
        )}
      </div>
    ),
  }
}

export function communityClassItems(classes: CommunityStats['topClasses'] | undefined): StatsListItem[] {
  if (!classes?.length) return []
  const completeClasses = completeClassPopularity(classes)
  const total = completeClasses.reduce((sum, entry) => sum + entry.count, 0)
  return completeClasses.map(({ archetype, count }) => ({
    key: archetype,
    countLabel: `${count} plays (${total > 0 ? Math.round((count / total) * 100) : 0}%)`,
    renderContent: () => <ArchetypeBadge archetype={archetype} />,
  }))
}
