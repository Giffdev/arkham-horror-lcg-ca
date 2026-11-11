import { getSideScenarioEntryGuidance } from '@/lib/side-scenario-entry'
import type { CampaignRun, CampaignScenarioLog } from '@/lib/types'

interface SideScenarioEntryGuidanceProps {
  campaignRun: Pick<CampaignRun, 'campaignName' | 'campaignType'>
  scenario: Pick<CampaignScenarioLog, 'scenarioName' | 'scenarioType'>
  previousScenarioLogs: readonly Pick<CampaignScenarioLog, 'scenarioName' | 'scenarioType'>[]
}

export function SideScenarioEntryGuidance({
  campaignRun,
  scenario,
  previousScenarioLogs,
}: SideScenarioEntryGuidanceProps) {
  const guidance = getSideScenarioEntryGuidance(campaignRun, scenario, previousScenarioLogs)
  if (!guidance) return null

  return (
    <div
      role="note"
      aria-label="Campaign entry guidance"
      className="mt-2 space-y-1 rounded-md border border-border/80 bg-muted/20 p-2 text-xs text-muted-foreground"
      title={`Rule source: ${guidance.source}`}
    >
      {guidance.campaignRule && <p className="font-medium text-foreground">{guidance.campaignRule}</p>}
      <p className="font-medium text-foreground">
        {guidance.campaignRule && 'Normal entry rule: '}{guidance.summary}
      </p>
      <p>{guidance.detail}</p>
      <p>Guidance only; XP and balances are unchanged. Payment is not tracked.</p>
    </div>
  )
}
