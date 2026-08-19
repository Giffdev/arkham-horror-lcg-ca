import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PencilSimple, Trash } from '@phosphor-icons/react'
import { formatDate } from '@/lib/date-utils'
import { getLegacyGroupScenarioOutcome } from '@/lib/campaign-runs'
import type {
  CampaignRun,
  CampaignScenarioInvestigatorOutcome,
  CampaignScenarioLog,
} from '@/lib/types'

interface CampaignScenarioRowProps {
  campaignRun: CampaignRun
  scenarioLog: CampaignScenarioLog
  index: number
  isLatestScenario: boolean
  onEdit: (campaignRun: CampaignRun, scenarioLog: CampaignScenarioLog) => void
  onDelete: (campaignRun: CampaignRun, scenarioLog: CampaignScenarioLog) => void
}

function summarizePlayers(scenarioLog: CampaignScenarioLog): Array<{
  playerName: string
  investigatorName: string
  outcome?: CampaignScenarioInvestigatorOutcome
}> {
  const bySlot = new Map<string, {
    playerName: string
    investigatorName: string
    outcome: CampaignScenarioInvestigatorOutcome
  }>()

  scenarioLog.investigatorOutcomes?.forEach((outcome) => {
    bySlot.set(outcome.slotId, {
      playerName: outcome.playerName || 'Unknown player',
      investigatorName: outcome.investigatorName,
      outcome,
    })
  })

  if (bySlot.size > 0) {
    return Array.from(bySlot.values())
  }

  return scenarioLog.investigators.map((investigator) => ({
    playerName: investigator.playerName || 'Unknown player',
    investigatorName: investigator.investigatorName,
  }))
}

function renderStatusLabel(status: string): string {
  if (status === 'defeated_physical') return 'Defeated (Physical)'
  if (status === 'defeated_mental') return 'Defeated (Mental)'
  if (status === 'driven_insane') return 'Driven Insane'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function CampaignScenarioRow({
  campaignRun,
  scenarioLog,
  index,
  isLatestScenario,
  onEdit,
  onDelete,
}: CampaignScenarioRowProps) {
  const playerPairs = summarizePlayers(scenarioLog)
  const legacyGroupOutcome = getLegacyGroupScenarioOutcome(scenarioLog)
  const resolutionLabel = scenarioLog.resolution?.type && scenarioLog.resolution.type !== 'no_resolution'
    ? scenarioLog.resolution.value
      ? `${scenarioLog.resolution.type}: ${scenarioLog.resolution.value}`
      : scenarioLog.resolution.type
    : null
  const typeBadgeLabel = scenarioLog.scenarioType === 'side_scenario'
    ? 'Side Scenario'
    : scenarioLog.scenarioType === 'interlude'
      ? 'Interlude'
      : null

  return (
    <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-foreground">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <div className="min-w-0 md:min-w-[320px] md:flex-shrink-0">
          <p className="text-sm font-semibold text-foreground">
            Scenario {index + 1}: {scenarioLog.scenarioName}
          </p>
          {typeBadgeLabel && (
            <div className="mt-1">
              <Badge variant="outline" className="text-[11px]">
                {typeBadgeLabel}
              </Badge>
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(scenarioLog.date)}</span>
            {resolutionLabel && (
              <>
                <span aria-hidden="true">•</span>
                <span>{resolutionLabel}</span>
              </>
            )}
          </div>
          {legacyGroupOutcome && (
            <p className="mt-2 text-xs text-amber-300">
              Legacy group totals (unallocated):
              {legacyGroupOutcome.xpEarned !== undefined && ` ${legacyGroupOutcome.xpEarned} XP`}
              {legacyGroupOutcome.victoryDisplayTotal !== undefined && ` victory ${legacyGroupOutcome.victoryDisplayTotal}`}
              {legacyGroupOutcome.xpBonusPenalty !== undefined && ` adjustment ${legacyGroupOutcome.xpBonusPenalty}`}
              {(legacyGroupOutcome.physicalTrauma !== undefined || legacyGroupOutcome.mentalTrauma !== undefined) &&
                ` trauma P${legacyGroupOutcome.physicalTrauma ?? 0}/M${legacyGroupOutcome.mentalTrauma ?? 0}`}
            </p>
          )}
          {scenarioLog.sideStories && scenarioLog.sideStories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {scenarioLog.sideStories.map((story) => (
                <Badge key={story} variant="outline" className="text-xs">
                  {story}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {playerPairs.length > 0 && (
          <ul
            className="min-w-0 flex-1 space-y-2.5 text-sm text-muted-foreground md:self-center"
            aria-label={`${scenarioLog.scenarioName} players`}
          >
            {playerPairs.slice(0, 4).map((pair, pairIndex) => (
              <li key={`${pair.playerName}-${pair.investigatorName}-${pairIndex}`}>
                <div
                  className="flex min-w-0 flex-col items-start gap-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1"
                  data-slot="scenario-player-heading"
                >
                  <span className="min-w-0 break-words font-medium text-foreground [overflow-wrap:anywhere]">
                    {pair.investigatorName}
                  </span>
                  <span className="text-muted-foreground">{pair.playerName}</span>
                </div>
                {pair.outcome && (
                  <div
                    className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground"
                    data-slot="scenario-player-outcome"
                  >
                    <span className="whitespace-nowrap">{pair.outcome.xpEarned} XP</span>
                    <span className="whitespace-nowrap">
                      · Trauma P{pair.outcome.traumaGainedPhysical}/M{pair.outcome.traumaGainedMental}
                    </span>
                    {pair.outcome.status !== 'survived' && (
                      <span className="whitespace-nowrap">· {renderStatusLabel(pair.outcome.status)}</span>
                    )}
                  </div>
                )}
              </li>
            ))}
            {playerPairs.length > 4 && <li>+{playerPairs.length - 4} more</li>}
          </ul>
        )}

        <div className="flex flex-shrink-0 items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(campaignRun, scenarioLog)}
            aria-label={`Edit scenario log ${scenarioLog.scenarioName}`}
          >
            <PencilSimple size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(campaignRun, scenarioLog)}
            aria-label={`Delete scenario log ${scenarioLog.scenarioName}`}
            disabled={!isLatestScenario}
            title={isLatestScenario ? undefined : 'Only the latest scenario log can be deleted.'}
          >
            <Trash size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
