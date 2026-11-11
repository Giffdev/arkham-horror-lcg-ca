import { ALL_CAMPAIGNS, MULTIPART_SCENARIO_PACKS, SCENARIO_PACK_SCENARIOS, STANDALONE_SCENARIO_GUIDES, resolveCampaignMetadata } from './campaign-data'
import { shouldSuppressPromotedPlaythrough } from './campaign-runs'
import { isActualCampaignScenarioNight, isActualLegacyScenarioNight, isLegacyCampaignParticipationLog } from './scenario-night-utils'
import { INVESTIGATORS, resolveInvestigator } from './investigator-data'
import type { CampaignRun, CampaignScenarioInvestigatorOutcome, CampaignScenarioLog, CampaignType, InvestigatorAssignment, Playthrough } from './types'

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

export interface PlayerCampaignHistoryRecord {
  id: string
  name: string
  type: CampaignType
  set?: string
  date: string
  scenarioName?: string
  investigators: InvestigatorAssignment[]
}

function getHistoricalOutcomeInvestigator(
  scenario: Playthrough | CampaignScenarioLog,
  outcome: CampaignScenarioInvestigatorOutcome,
): InvestigatorAssignment {
  let assignment: InvestigatorAssignment | undefined
  let ambiguous = false
  // Slots belong to historical snapshots, never to the run's current/replacement roster.
  for (const roster of [scenario.rosterBefore, scenario.rosterAfter]) {
    const matches = roster?.filter(entry => entry.slotId === outcome.slotId && entry.seatId === outcome.seatId) ?? []
    if (!matches.length) continue
    ambiguous = matches.length > 1
    assignment = matches.length === 1 ? matches[0].investigator : undefined
    break
  }
  if (!assignment && !ambiguous) {
    const matches = scenario.investigators.filter(inv =>
      inv.playerName.trim() === outcome.playerName.trim() && inv.investigatorName === outcome.investigatorName)
    ambiguous = matches.length > 1
    assignment = matches.length === 1 ? matches[0] : undefined
  }
  const identity = assignment ?? outcome
  const canonicalCandidates = INVESTIGATORS.filter(inv =>
    inv.name === identity.investigatorName &&
    (!assignment?.chapter || inv.chapter === assignment.chapter) &&
    (!assignment?.investigatorSet || inv.set === assignment.investigatorSet))
  const hasCanonicalId = INVESTIGATORS.some(inv => inv.id === assignment?.investigatorId)
  const resolved = !ambiguous && !assignment?.isCustom && !assignment?.isUnknown &&
    (hasCanonicalId || canonicalCandidates.length === 1) ? resolveInvestigator(identity) : undefined
  if (ambiguous || (!assignment?.isCustom && !assignment?.isUnknown && !resolved)) {
    return {
      playerName: outcome.playerName, investigatorName: outcome.investigatorName,
      archetype: 'Unknown', isUnknown: true,
    }
  }
  return {
    ...assignment,
    playerName: outcome.playerName,
    investigatorName: identity.investigatorName,
    archetype: assignment?.archetype ?? resolved?.archetypes[0] ?? 'Unknown',
    archetypes: assignment?.archetypes ?? resolved?.archetypes,
  }
}

export function getPlayerPlayedCampaignNames(
  playerName: string,
  playthroughs: Playthrough[],
  campaignRuns: CampaignRun[],
): Set<string> {
  return new Set(getPlayerCampaignHistory(playerName, playthroughs, campaignRuns).keys())
}

/** Catalog credit and history share the same participant and multipart evidence. */
export function getPlayerCampaignHistory(
  playerName: string | null,
  playthroughs: Playthrough[],
  campaignRuns: CampaignRun[],
): Map<string, PlayerCampaignHistoryRecord[]> {
  const history = new Map<string, Map<string, PlayerCampaignHistoryRecord>>()
  const addRecord = (name: string, record: PlayerCampaignHistoryRecord) => {
    if (!history.has(name)) history.set(name, new Map())
    history.get(name)!.set(record.id, record)
  }
  const recordPlay = (
    root: ScenarioIdentity & { campaignSet?: string },
    scenario: Playthrough | CampaignScenarioLog,
    id: string,
    actualScenario = true,
    wholeCampaign = false,
  ) => {
    if (scenario.scenarioType === 'interlude') return
    const participants = scenario.investigatorOutcomes == null
      ? scenario.investigators
      : scenario.investigatorOutcomes.map(outcome => getHistoricalOutcomeInvestigator(scenario, outcome))
    const investigators = participants.filter(participant =>
      playerName === null || participant.playerName.trim() === playerName.trim())
    if (investigators.length === 0) return
    const identity = {
      ...root,
      campaignName: actualScenario || wholeCampaign ? root.campaignName : '',
      scenarioName: actualScenario ? scenario.scenarioName : undefined,
      sideStories: scenario.sideStories,
    }
    const record: PlayerCampaignHistoryRecord = {
      id, name: root.customCampaignName || root.campaignName, type: root.campaignType,
      set: root.campaignSet, date: scenario.date,
      scenarioName: actualScenario ? scenario.scenarioName : undefined, investigators,
    }
    resolveScenarioPackNames(identity, false).forEach(name => addRecord(name, record))
    if ((actualScenario || wholeCampaign) && scenario.scenarioType !== 'side_scenario' &&
      root.campaignType !== 'Fan-Made' && root.campaignType !== 'Unknown') {
      const campaign = resolveCampaignMetadata({ campaignName: root.campaignName })
      if (campaign && !MULTIPART_SCENARIO_PACKS.get(campaign.name)?.includes(scenario.scenarioName ?? '')) {
        addRecord(campaign.name, record)
      }
    }
  }

  const runIds = new Set(campaignRuns.map(run => run.id))
  const sourceIds = new Set(playthroughs.map(playthrough => playthrough.id))
  for (const playthrough of playthroughs) {
    // Suppress copied scenarios, not historical whole-campaign participation or explicit side stories.
    const promoted = shouldSuppressPromotedPlaythrough(playthrough, runIds)
    const actualScenario = isActualLegacyScenarioNight(playthrough)
    const wholeCampaign = !actualScenario && playthrough.scenarioType !== 'side_scenario'
    recordPlay(playthrough, playthrough, `legacy:${playthrough.id}`, !promoted && actualScenario, wholeCampaign)
  }
  for (const run of campaignRuns) {
    for (const log of run.scenarioLogs) {
      const id = log.legacySourcePlaythroughId ? `legacy:${log.legacySourcePlaythroughId}` : `run:${run.id}:${log.id}`
      // The source supplies root credit; copied logs still retain their explicit side-story evidence.
      const wholeCampaign = isLegacyCampaignParticipationLog(run, log) &&
        !sourceIds.has(log.legacySourcePlaythroughId ?? '')
      recordPlay(run, log, id, isActualCampaignScenarioNight(run, log), wholeCampaign)
    }
  }
  for (const [parent, children] of MULTIPART_SCENARIO_PACKS) {
    const explicitParent = [...(history.get(parent)?.values() ?? [])]
    if (explicitParent.length || children.every(name => history.has(name))) {
      // Reuse real records, never synthesize a parent/child play session.
      children.forEach(name => explicitParent.forEach(record => addRecord(name, record)))
      children.forEach(name => history.get(name)?.forEach(record => addRecord(parent, record)))
    }
  }
  return new Map(ALL_CAMPAIGNS.filter(campaign => history.has(campaign.name)).map(campaign => [
    campaign.name,
    [...history.get(campaign.name)!.values()].sort((a, b) => b.date.localeCompare(a.date)),
  ]))
}
