import { ALL_CAMPAIGNS, SCENARIO_PACK_SCENARIOS, STANDALONE_SCENARIO_GUIDES, resolveCampaignMetadata } from './campaign-data'
import { shouldSuppressPromotedPlaythrough } from './campaign-runs'
import { isActualCampaignScenarioNight } from './scenario-night-utils'
import type { CampaignRun, CampaignScenarioLog, CampaignType, Playthrough } from './types'

type ScenarioIdentity = Pick<Playthrough, 'campaignName' | 'campaignType' | 'customCampaignName' | 'scenarioName' | 'sideStories'>

export function getScenarioPackNames(record: ScenarioIdentity): string[] {
  const identities = new Set([
    ...(record.campaignType === 'Scenario Pack' ? [record.campaignName] : []),
    record.scenarioName,
    ...(record.sideStories ?? []),
  ])
  const names = new Set(SCENARIO_PACK_SCENARIOS.filter(pack => identities.has(pack.name)).map(pack => pack.name))
  for (const guide of STANDALONE_SCENARIO_GUIDES) {
    if (guide.scenarioNames.some(name => identities.has(name))) {
      guide.campaignNames.forEach(name => names.add(name))
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
  const recordPlay = (root: ScenarioIdentity, scenario: Playthrough | CampaignScenarioLog) => {
    if (scenario.scenarioType === 'interlude' || !playerParticipated(scenario, playerName)) return
    const identity = { ...root, scenarioName: scenario.scenarioName, sideStories: scenario.sideStories }
    getScenarioPackNames(identity).forEach(name => played.add(name))
    if (scenario.scenarioType !== 'side_scenario' && root.campaignType !== 'Fan-Made' && root.campaignType !== 'Unknown') {
      const campaign = resolveCampaignMetadata({ campaignName: root.campaignName })
      if (campaign) played.add(campaign.name)
    }
  }

  const runIds = new Set(campaignRuns.map(run => run.id))
  for (const playthrough of playthroughs) {
    // Legacy campaign-level records are existing play evidence, unlike a run's setup snapshot.
    if (!shouldSuppressPromotedPlaythrough(playthrough, runIds)) recordPlay(playthrough, playthrough)
  }
  for (const run of campaignRuns) {
    for (const log of run.scenarioLogs) {
      if (isActualCampaignScenarioNight(run, log)) {
        recordPlay(run, log)
      } else if (playerParticipated(log, playerName)) {
        getCampaignScenarioPackNames(run, log).forEach(name => played.add(name))
      }
    }
  }
  return new Set(ALL_CAMPAIGNS.filter(campaign => played.has(campaign.name)).map(campaign => campaign.name))
}
