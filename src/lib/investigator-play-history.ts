import type {
  CampaignRun,
  CampaignScenarioRosterEntry,
  FlattenedGameLog,
  InvestigatorAssignment,
  Playthrough,
} from './types'
import { resolveInvestigator } from './investigator-data'

interface CollapsedPlay {
  playthrough: Playthrough
  latestTimestamp: number
  investigators: Map<string, InvestigatorAssignment>
}

function normalizeIdentity(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase() ?? ''
}

function getPlayRootKey(playthrough: Playthrough): string {
  const flattened = playthrough as Partial<FlattenedGameLog>
  if (flattened.sourceKind === 'campaign-run-scenario' && flattened.campaignRunId?.trim()) {
    return `campaign-run:${flattened.campaignRunId.trim()}`
  }

  return `playthrough:${flattened.sourcePlaythroughId?.trim() || playthrough.id}`
}

function getInvestigatorPlayKey(investigator: InvestigatorAssignment): string {
  if (investigator.isCustom) {
    const customId = normalizeIdentity(investigator.investigatorId)
    return customId
      ? `custom-id:${customId}`
      : [
          'custom-name',
          normalizeIdentity(investigator.customInvestigatorName || investigator.investigatorName),
          investigator.chapter ?? '',
          normalizeIdentity(investigator.investigatorSet),
        ].join('|')
  }

  const resolved = resolveInvestigator(investigator)
  const officialId = normalizeIdentity(resolved?.id || investigator.investigatorId)
  return officialId
    ? `official-id:${officialId}`
    : [
        'official-name',
        normalizeIdentity(investigator.investigatorName),
        investigator.chapter ?? '',
        normalizeIdentity(investigator.investigatorSet),
      ].join('|')
}

function toTimestamp(date: string): number {
  const timestamp = Date.parse(date)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function getRosterInvestigator(entry: CampaignScenarioRosterEntry): InvestigatorAssignment {
  return {
    ...entry.investigator,
    playerName: entry.playerName,
  }
}

function collectCampaignInvestigatorEvidence(campaignRun: CampaignRun): InvestigatorAssignment[] {
  const investigators = new Map<string, InvestigatorAssignment>()
  const recordParticipation = (evidence: InvestigatorAssignment[]) => {
    for (const investigator of evidence) {
      investigators.set(getInvestigatorPlayKey(investigator), { ...investigator })
    }
  }

  recordParticipation(campaignRun.setupSnapshot.investigators)
  for (const scenarioLog of campaignRun.scenarioLogs) {
    recordParticipation((scenarioLog.rosterBefore ?? []).map(getRosterInvestigator))
    recordParticipation(scenarioLog.investigators)
    recordParticipation((scenarioLog.rosterChanges ?? []).map(change => getRosterInvestigator(change.newEntry)))
    recordParticipation((scenarioLog.rosterAfter ?? []).map(getRosterInvestigator))
  }

  // Current roster is metadata-authoritative, but only historical evidence establishes participation.
  for (const entry of campaignRun.currentRoster ?? []) {
    const investigator = getRosterInvestigator(entry)
    const key = getInvestigatorPlayKey(investigator)
    if (investigators.has(key)) {
      investigators.set(key, investigator)
    }
  }

  return Array.from(investigators.values())
}

export function collapseInvestigatorPlaysByRoot(playthroughs: Playthrough[]): Playthrough[] {
  const roots = new Map<string, CollapsedPlay>()

  const mergePlay = (rootKey: string, playthrough: Playthrough) => {
    const timestamp = toTimestamp(playthrough.date)
    let root = roots.get(rootKey)

    if (!root) {
      root = {
        playthrough: { ...playthrough, investigators: [] },
        latestTimestamp: timestamp,
        investigators: new Map(),
      }
      roots.set(rootKey, root)
    } else if (timestamp >= root.latestTimestamp) {
      root.playthrough = { ...playthrough, investigators: [] }
      root.latestTimestamp = timestamp
    }

    for (const investigator of playthrough.investigators) {
      root.investigators.set(getInvestigatorPlayKey(investigator), { ...investigator })
    }
  }

  for (const playthrough of playthroughs) {
    mergePlay(getPlayRootKey(playthrough), playthrough)
  }

  return Array.from(roots.values(), ({ playthrough, investigators }) => ({
    ...playthrough,
    investigators: Array.from(investigators.values()),
  }))
}

export function collapseCampaignInvestigatorPlays(
  playthroughs: Playthrough[],
  campaignRuns: CampaignRun[],
): Playthrough[] {
  const campaignEvidencePlays: FlattenedGameLog[] = campaignRuns.map((campaignRun) => {
    return {
      id: `campaign-run:${campaignRun.id}:evidence`,
      date: campaignRun.setupSnapshot.date,
      campaignName: campaignRun.campaignName,
      campaignSet: campaignRun.campaignSet,
      campaignType: campaignRun.campaignType,
      campaignLineageId: campaignRun.campaignLineageId,
      customCampaignName: campaignRun.customCampaignName,
      investigators: collectCampaignInvestigatorEvidence(campaignRun),
      notes: campaignRun.setupSnapshot.notes,
      sourceKind: 'campaign-run-scenario',
      campaignRunId: campaignRun.id,
    }
  })

  return collapseInvestigatorPlaysByRoot([...playthroughs, ...campaignEvidencePlays])
}
