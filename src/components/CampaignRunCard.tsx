import { memo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArchetypeBadge } from '@/components/ArchetypeBadge'
import { CampaignSvgIcon } from '@/components/CampaignSvgIcon'
import { CampaignScenarioRow } from '@/components/CampaignScenarioRow'
import { CardActionArea } from '@/components/CardActionArea'
import { deriveCampaignRunRosterSummary } from '@/lib/campaign-runs'
import { formatDate } from '@/lib/date-utils'
import { getCampaignProgressionScenarioNames, getNextCampaignScenarioResolution } from '@/lib/campaign-progression'
import { getChapterBadgeLabel, getDisplaySetName, isChapterBadgeSpecial, resolveInvestigator } from '@/lib/investigator-data'
import { getActualCampaignScenarioLogs } from '@/lib/scenario-night-utils'
import type { CampaignRun, CampaignScenarioLog } from '@/lib/types'
import { CaretDown, CaretUp, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface CampaignRunCardProps {
  campaignRun: CampaignRun
  isExpanded: boolean
  onToggleExpanded: (campaignRunId: string) => void
  onContinue: (campaignRun: CampaignRun) => void
  onEditRun: (campaignRun: CampaignRun) => void
  onDeleteRun: (campaignRun: CampaignRun) => void
  onEditScenario: (campaignRun: CampaignRun, scenarioLog: CampaignScenarioLog) => void
  onDeleteScenario: (campaignRun: CampaignRun, scenarioLog: CampaignScenarioLog) => void
}

type SummaryInvestigator = ReturnType<typeof deriveCampaignRunRosterSummary>[number]['investigators'][number]

function statusLabel(state: SummaryInvestigator['state']): string | null {
  switch (state) {
    case 'killed':
      return 'Killed'
    case 'driven_insane':
      return 'Driven insane'
    case 'devoured':
      return 'Devoured'
    case 'retired':
      return null
    case 'former':
      return null
    case 'unknown_former':
      return null
    default:
      return null
  }
}

function statusBadgeClasses(state: SummaryInvestigator['state']): string {
  switch (state) {
    case 'killed':
      return 'border-destructive/40 text-destructive'
    case 'driven_insane':
    case 'devoured':
      return 'border-amber-300/40 text-amber-200'
    case 'retired':
      return 'border-blue-300/40 text-blue-200'
    case 'former':
    case 'unknown_former':
      return 'border-muted-foreground/30 text-muted-foreground'
    default:
      return 'border-muted-foreground/30 text-muted-foreground'
  }
}

function getLastPlayedDate(campaignRun: CampaignRun, actualScenarioLogs: CampaignScenarioLog[]): string {
  if (actualScenarioLogs.length === 0) return campaignRun.startedAt
  return actualScenarioLogs[actualScenarioLogs.length - 1].date
}

function getNextScenarioLabel(campaignRun: CampaignRun, actualScenarioLogs: CampaignScenarioLog[]): string | null {
  const resolution = getNextCampaignScenarioResolution(
    {
      campaignName: campaignRun.campaignName,
      campaignSet: campaignRun.campaignSet,
      campaignType: campaignRun.campaignType,
      customCampaignName: campaignRun.customCampaignName,
    },
    actualScenarioLogs
      .filter((log) => log.scenarioType !== 'side_scenario')
      .map((log) => log.scenarioName),
  )

  if (resolution.candidates.length === 0) {
    return null
  }

  if (resolution.candidates.length > 1) {
    return `Choose next (${resolution.candidates.length} options)`
  }

  const [candidate] = resolution.candidates
  return candidate.mode === 'manual' ? `${candidate.name} (manual)` : candidate.name
}

export const CampaignRunCard = memo(function CampaignRunCard({
  campaignRun,
  isExpanded,
  onToggleExpanded,
  onContinue,
  onEditRun,
  onDeleteRun,
  onEditScenario,
  onDeleteScenario,
}: CampaignRunCardProps) {
  const isStandaloneScenario = campaignRun.campaignType === 'Scenario Pack'
  const isFanMadeCampaign = campaignRun.campaignType === 'Fan-Made'
  const actualScenarioLogs = getActualCampaignScenarioLogs(campaignRun)
  const rosterSummary = deriveCampaignRunRosterSummary(campaignRun)
  const scenarioRegionId = `campaign-run-scenarios-${campaignRun.id}`
  const canonicalScenarioNames = getCampaignProgressionScenarioNames({
    campaignName: campaignRun.campaignName,
    campaignSet: campaignRun.campaignSet,
    campaignType: campaignRun.campaignType,
    customCampaignName: campaignRun.customCampaignName,
  })
  const loggedCount = actualScenarioLogs.filter((log) => log.scenarioType !== 'side_scenario').length
  const totalGameNightsLogged = actualScenarioLogs.length
  const showTotalGameNightsBadge = totalGameNightsLogged !== loggedCount
  const progressLabel = canonicalScenarioNames.length > 0
    ? `${loggedCount} of ${canonicalScenarioNames.length}`
    : `${loggedCount} logged`
  const nextScenarioLabel = !isStandaloneScenario && !isFanMadeCampaign
    ? getNextScenarioLabel(campaignRun, actualScenarioLogs)
    : null

  return (
    <Card className="p-4 md:p-6 border-border/80 bg-card text-foreground">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0 flex-1 space-y-4 md:grid md:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] md:gap-6 md:space-y-0">
            <div className="min-w-0 space-y-2">
              <h3 className="flex items-center gap-2 text-lg font-semibold leading-snug text-foreground md:text-xl">
                <span aria-hidden="true" className="flex-shrink-0">
                  <CampaignSvgIcon
                    campaignSet={campaignRun.campaignSet ?? campaignRun.campaignName}
                    size={18}
                    className="text-primary/80"
                  />
                </span>
                <span className="min-w-0 truncate">{campaignRun.customCampaignName || campaignRun.campaignName}</span>
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-xs">{campaignRun.campaignType}</Badge>
                <span>Started {formatDate(campaignRun.startedAt)}</span>
                <span aria-hidden="true">•</span>
                <span>Last played {formatDate(getLastPlayedDate(campaignRun, actualScenarioLogs))}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="text-foreground">
                  {isFanMadeCampaign ? `Scenarios: ${loggedCount} logged` : `Progress: ${progressLabel}`}
                </Badge>
                {showTotalGameNightsBadge && (
                  <Badge variant="outline" className="text-foreground">
                    Game nights: {totalGameNightsLogged} logged
                  </Badge>
                )}
                {nextScenarioLabel && (
                  <Badge variant="outline" className="text-foreground">
                    Next: {nextScenarioLabel}
                  </Badge>
                )}
              </div>
            </div>
            <div className="min-w-0 text-sm text-foreground/90 md:self-center" data-testid="campaign-roster-column">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Roster</p>
              {rosterSummary.length === 0 ? (
                <p className="mt-0.5 text-sm text-foreground">No players recorded</p>
              ) : (
                <ul className="space-y-3" aria-label="Campaign roster summary">
                  {rosterSummary.map((seat) => {
                    const primaryInvestigator = (
                      seat.investigators.find((investigator) => investigator.isCurrent) ??
                      seat.investigators[seat.investigators.length - 1]
                    )
                    if (!primaryInvestigator) return null
                    const history = seat.investigators.filter((investigator) => investigator.key !== primaryInvestigator.key)
                    const investigator = primaryInvestigator
                    const resolved = resolveInvestigator({
                      investigatorId: investigator.investigatorId,
                      investigatorName: investigator.investigatorName,
                      chapter: investigator.chapter,
                    })
                    const chapter = resolved?.chapter ?? investigator.chapter
                    const chapterLabel = chapter ? getChapterBadgeLabel({ set: resolved?.set, chapter }) : null
                    const sourceSet = resolved?.set
                    const sourceLabel = sourceSet ? getDisplaySetName(investigator.investigatorName, sourceSet) : null
                    const status = statusLabel(investigator.state)

                    return (
                      <li
                        key={seat.playerKey}
                        className="grid grid-cols-1 items-start gap-x-3 gap-y-1.5 text-sm text-foreground sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-y-2.5"
                        data-testid={`campaign-roster-seat-${seat.playerKey}`}
                        aria-label={[
                          `Player seat ${seat.playerName || 'Unknown player'}`,
                          investigator.investigatorName,
                          investigator.archetype,
                          chapterLabel,
                          sourceLabel,
                          seat.playerName || 'Unknown player',
                          investigator.hasTallyEvidence
                            ? `${investigator.xpTotal} XP earned, ${investigator.xpSpent} XP spent, ${investigator.physicalTrauma} physical trauma, ${investigator.mentalTrauma} mental trauma`
                            : null,
                          status && !investigator.isCurrent ? `status ${status}` : null,
                        ].filter(Boolean).join(', ')}
                      >
                        <div className="flex w-fit items-center pt-0.5 sm:w-28">
                          <ArchetypeBadge
                            archetype={investigator.archetype}
                            investigatorId={resolved?.id ?? investigator.investigatorId}
                            investigatorName={investigator.investigatorName}
                            investigatorSet={sourceSet}
                            chapter={chapter}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="min-w-0 break-words font-medium text-foreground [overflow-wrap:anywhere]">
                              {investigator.investigatorName}
                            </span>
                            {chapterLabel && (
                              <span
                                className={cn(
                                  'text-xs font-medium',
                                  isChapterBadgeSpecial({ set: resolved?.set, chapter })
                                    ? 'text-violet-400'
                                    : 'text-muted-foreground opacity-60',
                                )}
                              >
                                · {chapterLabel}
                              </span>
                            )}
                            {sourceLabel && (
                              <Badge variant="outline" className="text-xs whitespace-nowrap">
                                {sourceLabel}
                              </Badge>
                            )}
                            <span className="basis-full text-muted-foreground sm:basis-auto sm:truncate">
                              {seat.playerName || 'Unknown player'}
                            </span>
                            {!investigator.isCurrent && status && (
                              <span className={cn('whitespace-nowrap text-xs', statusBadgeClasses(investigator.state))}>
                                {status}
                              </span>
                            )}
                          </div>
                          {investigator.hasTallyEvidence && (
                            <div
                              className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground"
                              data-slot="campaign-roster-tallies"
                            >
                              <span className="whitespace-nowrap">
                                XP {investigator.xpTotal}
                                {investigator.xpSpent > 0 && ` (${investigator.xpSpent} spent)`}
                              </span>
                              <span className="whitespace-nowrap">
                                · Trauma P{investigator.physicalTrauma}/M{investigator.mentalTrauma}
                              </span>
                            </div>
                          )}
                        </div>
                        {history.length > 0 && (
                          <div className="space-y-2 sm:col-span-2" data-testid={`campaign-roster-history-${seat.playerKey}`}>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">History:</p>
                            {history.map((historical) => {
                              const historicalStatus = statusLabel(historical.state)
                              const historicalResolved = resolveInvestigator({
                                investigatorId: historical.investigatorId,
                                investigatorName: historical.investigatorName,
                                chapter: historical.chapter,
                              })
                              const historicalChapter = historicalResolved?.chapter ?? historical.chapter
                              const historicalSourceSet = historicalResolved?.set
                              const historicalSourceLabel = historicalSourceSet
                                ? getDisplaySetName(historical.investigatorName, historicalSourceSet)
                                : null

                              return (
                                <div
                                  key={historical.key}
                                  className="grid grid-cols-1 items-start gap-x-3 gap-y-1.5 sm:grid-cols-[7rem_minmax(0,1fr)]"
                                  data-testid={`campaign-roster-history-row-${historical.key}`}
                                >
                                  <div className="flex w-fit items-center pt-0.5 sm:w-28">
                                    <ArchetypeBadge
                                      archetype={historical.archetype}
                                      investigatorId={historicalResolved?.id ?? historical.investigatorId}
                                      investigatorName={historical.investigatorName}
                                      investigatorSet={historicalSourceSet}
                                      chapter={historicalChapter}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <span className="min-w-0 break-words font-medium text-foreground/85 [overflow-wrap:anywhere]">
                                        {historical.investigatorName}
                                      </span>
                                      {historicalSourceLabel && (
                                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                                          {historicalSourceLabel}
                                        </Badge>
                                      )}
                                      {historicalStatus && (
                                        <span className={cn('whitespace-nowrap text-xs', statusBadgeClasses(historical.state))}>
                                          {historicalStatus}
                                        </span>
                                      )}
                                    </div>
                                    {historical.hasTallyEvidence && (
                                      <div
                                        className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground"
                                        data-slot="campaign-roster-tallies"
                                      >
                                        <span className="whitespace-nowrap">
                                          XP {historical.xpTotal}
                                          {historical.xpSpent > 0 && ` (${historical.xpSpent} spent)`}
                                        </span>
                                        <span className="whitespace-nowrap">
                                          · Trauma P{historical.physicalTrauma}/M{historical.mentalTrauma}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          <CardActionArea className="col-start-2 row-start-1 max-w-44 gap-2 sm:max-w-none">
            {(!isStandaloneScenario || totalGameNightsLogged === 0) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onContinue(campaignRun)}
                className="gap-2"
              >
                <Plus size={16} weight="bold" />
                {isStandaloneScenario
                  ? 'Log Scenario Result'
                  : (totalGameNightsLogged === 0 ? 'Log First Scenario' : 'Continue Campaign')}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEditRun(campaignRun)}
              aria-label={`Edit campaign setup for ${campaignRun.campaignName}`}
            >
              <PencilSimple size={16} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDeleteRun(campaignRun)}
              aria-label={`Delete campaign run ${campaignRun.campaignName}`}
            >
              <Trash size={16} />
            </Button>
          </CardActionArea>
        </div>

        <div
          className="flex items-center justify-start border-t border-border/50 pt-3"
          data-slot="scenario-disclosure-area"
        >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-w-36 justify-start gap-2 text-foreground"
              aria-expanded={isExpanded}
              aria-controls={scenarioRegionId}
              onClick={() => onToggleExpanded(campaignRun.id)}
            >
              {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
              {isExpanded ? 'Hide scenarios' : 'Show scenarios'}
            </Button>
        </div>

        <div id={scenarioRegionId}>
          {isExpanded && totalGameNightsLogged === 0 && (
            <div className="rounded-md border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              No scenario nights yet.
            </div>
          )}

          {isExpanded && totalGameNightsLogged > 0 && (
            <ol className="space-y-2" aria-label={`${campaignRun.campaignName} scenario nights`}>
              {actualScenarioLogs.map((scenarioLog, index) => (
                <li key={scenarioLog.id}>
                  <CampaignScenarioRow
                    campaignRun={campaignRun}
                    scenarioLog={scenarioLog}
                    index={index}
                    isLatestScenario={index === actualScenarioLogs.length - 1}
                    onEdit={onEditScenario}
                    onDelete={onDeleteScenario}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Card>
  )
})
