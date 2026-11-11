import { ALL_CAMPAIGNS, MULTIPART_SCENARIO_PACKS, SCENARIO_PACK_SCENARIOS, STANDALONE_SCENARIO_GUIDES, resolveCampaignMetadata } from './campaign-data'
import { shouldSuppressPromotedPlaythrough } from './campaign-runs'
import { isActualCampaignScenarioNight } from './scenario-night-utils'
import type { CampaignRun, CampaignScenarioLog, CampaignType, Playthrough } from './types'

type ScenarioIdentity = Pick<Playthrough, 'campaignName' | 'campaignType' | 'customCampaignName' | 'scenarioName' | 'sideStories'>

export function getScenarioPackNames(record: ScenarioIdentity): string[] {
  return resolveScenarioPackNames(record, true)
}

function resolveScenarioPackNames(record: ScenarioIdentity, includeMultipartParents: boolean): string[] {
  // A package used as a run's container is not evidence that every part was played.
  const isMultipartChild = MULTIPART_SCENARIO_PACKS.get(record.campaignName)?.includes(record.scenarioName ?? '')
  const identities = new Set([
    ...(record.campaignType === 'Scenario Pack' && (includeMultipartParents || !isMultipartChild) ? [record.campaignName] : []),
    record.scenarioName,
    ...(record.sideStories ?? []),
  ])
  const names = new Set(SCENARIO_PACK_SCENARIOS.filter(pack => identities.has(pack.name)).map(pack => pack.name))
  for (const guide of STANDALONE_SCENARIO_GUIDES) {
    if (guide.scenarioNames.some(name => identities.has(name))) {
      guide.campaignNames.forEach(name => {
        if (includeMultipartParents || !MULTIPART_SCENARIO_PACKS.has(name)) names.add(name)
      })
    }
  }
  return [...names]
}

export function getRecordCampaignNames(record: ScenarioIdentity): string[] {
  return [...new Set([record.customCampaignName || record.campaignName, ...getScenarioPackNames(record)])]
}

export function getRecordCampaignTypes(record: ScenarioIdentity): CampaignType[] {
  return [...new Set([record.campaignType, ...(getScenarioPackNames(record).length ? ['Scenario Pack' as const] : [])])]
}

export function getCampaignScenarioPackNames(run: CampaignRun, log: CampaignScenarioLog): string[] {
  if (log.scenarioType === 'interlude') return []
  const actualScenario = isActualCampaignScenarioNight(run, log)
  return getScenarioPackNames({
    ...run,
    campaignName: actualScenario ? run.campaignName : '',
    scenarioName: actualScenario ? log.scenarioName : undefined,
    sideStories: log.sideStories,
  })
}

function playerParticipated(record: Pick<Playthrough, 'investigators' | 'investigatorOutcomes'>, playerName: string): boolean {
  const participants = record.investigatorOutcomes ?? record.investigators
  return participants.some(participant => participant.playerName.trim() === playerName.trim())
}

export function getPlayerPlayedCampaignNames(
  playerName: string,
  playthroughs: Playthrough[],
  campaignRuns: CampaignRun[],
): Set<string> {
  const played = new Set<string>()
  const recordPlay = (root: ScenarioIdentity, scenario: Playthrough | CampaignScenarioLog, actualScenario = true) => {
    if (scenario.scenarioType === 'interlude' || !playerParticipated(scenario, playerName)) return
    const identity = {
      ...root,
      campaignName: actualScenario ? root.campaignName : '',
      scenarioName: actualScenario ? scenario.scenarioName : undefined,
      sideStories: scenario.sideStories,
    }
    resolveScenarioPackNames(identity, false).forEach(name => played.add(name))
    if (actualScenario && scenario.scenarioType !== 'side_scenario' &&
      root.campaignType !== 'Fan-Made' && root.campaignType !== 'Unknown') {
      const campaign = resolveCampaignMetadata({ campaignName: root.campaignName })
      if (campaign && !MULTIPART_SCENARIO_PACKS.get(campaign.name)?.includes(scenario.scenarioName ?? '')) {
        played.add(campaign.name)
      }
    }
  }

  const runIds = new Set(campaignRuns.map(run => run.id))
  for (const playthrough of playthroughs) {
    // Promotion suppresses root credit, but explicit source side stories remain play evidence.
    recordPlay(playthrough, playthrough, !shouldSuppressPromotedPlaythrough(playthrough, runIds))
  }
  for (const run of campaignRuns) {
    for (const log of run.scenarioLogs) {
      recordPlay(run, log, isActualCampaignScenarioNight(run, log))
    }
  }
  for (const [parent, children] of MULTIPART_SCENARIO_PACKS) {
    if (played.has(parent) || children.every(name => played.has(name))) {
      played.add(parent)
      children.forEach(name => played.add(name))
    }
  }
  return new Set(ALL_CAMPAIGNS.filter(campaign => played.has(campaign.name)).map(campaign => campaign.name))
}
