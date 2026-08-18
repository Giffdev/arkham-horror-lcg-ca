import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, MapTrifold, Sparkle, Scroll, PaintBrush } from '@phosphor-icons/react'
import { Playthrough } from '@/lib/types'
import { useCompletionStats, CompletionStats as CompletionStatsType } from '@/hooks/useCompletionStats'
import { CompletionBreakdown } from '@/lib/community-stats'

interface CompletionStatsProps {
  playthroughs: Playthrough[] | undefined
  communityBreakdown?: CompletionBreakdown
  communityTotal?: number
}

function StatRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={16} weight="duotone" className="text-primary" />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-lg font-bold text-foreground">{value}</span>
    </div>
  )
}

function CompletionCard({ title, stats }: { title: string; stats: CompletionStatsType }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        <StatRow icon={BookOpen} label="Total Logged" value={stats.total} />
        <StatRow icon={MapTrifold} label="Full Campaigns" value={stats.breakdown.fullCampaigns} />
        <StatRow icon={Sparkle} label="Small Campaigns" value={stats.breakdown.smallCampaigns} />
        <StatRow icon={Scroll} label="Scenario Packs" value={stats.breakdown.scenarioPacks} />
        <StatRow icon={PaintBrush} label="Fan-Made" value={stats.breakdown.fanMade} />
      </CardContent>
    </Card>
  )
}

export function CompletionStatsPanel({ playthroughs, communityBreakdown, communityTotal }: CompletionStatsProps) {
  const { personal } = useCompletionStats(playthroughs)

  const hasPersonal = playthroughs && playthroughs.length > 0
  const hasCommunity = !!communityBreakdown

  if (!hasPersonal && !hasCommunity) {
    return null
  }

  const communityStats: CompletionStatsType | null = communityBreakdown
    ? {
        total: communityTotal ?? 0,
        campaignRunsPlayedCount: communityTotal ?? 0,
        uniqueCampaignFamilyCount: 0,
        breakdown: communityBreakdown,
      }
    : null

  return (
    <section aria-label="Campaign Completion Stats" className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground mb-1">Campaign Completion</h3>
        <p className="text-sm text-muted-foreground">How many adventures have been completed</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hasPersonal && <CompletionCard title="Your Stats" stats={personal} />}
        {communityStats && <CompletionCard title="Community Stats" stats={communityStats} />}
      </div>
    </section>
  )
}
