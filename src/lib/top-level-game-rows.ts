import { shouldSuppressPromotedPlaythrough } from './campaign-runs'
import type { CampaignRun, InvestigatorAssignment, Playthrough } from './types'

export type TopLevelGameRow =
  | {
      kind: 'campaign-run'
      key: string
      sortDate: string
      filterPlaythrough: Playthrough
      campaignRun: CampaignRun
    }
  | {
      kind: 'playthrough'
      key: string
      sortDate: string
      filterPlaythrough: Playthrough
      playthrough: Playthrough
    }

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function collectRunInvestigators(run: CampaignRun): InvestigatorAssignment[] {
  if (run.scenarioLogs.length === 0) {
    return run.setupSnapshot.investigators
  }

  const latestScenario = [...run.scenarioLogs].sort((left, right) => toTimestamp(right.date) - toTimestamp(left.date))[0]
  return latestScenario?.investigators?.length ? latestScenario.investigators : run.setupSnapshot.investigators
}

function buildRunFilterPlaythrough(run: CampaignRun): Playthrough {
  const lastPlayedDate = run.scenarioLogs.length > 0
    ? [...run.scenarioLogs].sort((left, right) => toTimestamp(right.date) - toTimestamp(left.date))[0]?.date ?? run.startedAt
    : run.startedAt

  return {
    id: `run:${run.id}`,
    date: lastPlayedDate,
    campaignName: run.campaignName,
    campaignSet: run.campaignSet,
    campaignType: run.campaignType,
    campaignLineageId: run.campaignLineageId,
    customCampaignName: run.customCampaignName,
    investigators: collectRunInvestigators(run),
    notes: run.setupSnapshot.notes,
  }
}

export function buildTopLevelGameRows(playthroughs: Playthrough[], campaignRuns: CampaignRun[]): TopLevelGameRow[] {
  const campaignRunIds = new Set(campaignRuns.map((campaignRun) => campaignRun.id))

  const runRows: TopLevelGameRow[] = campaignRuns.map((campaignRun) => {
    const sortDate = campaignRun.scenarioLogs.length > 0
      ? [...campaignRun.scenarioLogs].sort((left, right) => toTimestamp(right.date) - toTimestamp(left.date))[0]?.date ?? campaignRun.startedAt
      : campaignRun.startedAt

    return {
      kind: 'campaign-run',
      key: `run:${campaignRun.id}`,
      sortDate,
      filterPlaythrough: buildRunFilterPlaythrough(campaignRun),
      campaignRun,
    }
  })

  const standaloneRows: TopLevelGameRow[] = playthroughs
    .filter((playthrough) => !shouldSuppressPromotedPlaythrough(playthrough, campaignRunIds))
    .map((playthrough) => ({
      kind: 'playthrough' as const,
      key: `playthrough:${playthrough.id}`,
      sortDate: playthrough.date,
      filterPlaythrough: playthrough,
      playthrough,
    }))

  return [...runRows, ...standaloneRows].sort((left, right) => {
    const activityOrder = toTimestamp(right.sortDate) - toTimestamp(left.sortDate)
    if (activityOrder !== 0) return activityOrder

    if (left.kind === 'campaign-run' && right.kind === 'campaign-run') {
      const startOrder = toTimestamp(right.campaignRun.startedAt) - toTimestamp(left.campaignRun.startedAt)
      if (startOrder !== 0) return startOrder
    }

    return left.key.localeCompare(right.key)
  })
}
