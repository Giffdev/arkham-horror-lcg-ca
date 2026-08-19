export type Archetype = 'Guardian' | 'Survivor' | 'Seeker' | 'Rogue' | 'Mystic' | 'Neutral' | 'Unknown'

export type CampaignType = 'Full Campaign' | 'Small Campaign' | 'Scenario Pack' | 'Fan-Made' | 'Unknown'
export type CampaignRunStatus = 'active' | 'completed'
export type CampaignRunVersion = 1 | 2
export type ExportEnvelopeVersion = 2

export type DreamEatersCampaignPath= 'A: The Dream-Quest' | 'B: The Web of Dreams'
export type CampaignScenarioType = 'standard' | 'interlude' | 'side_scenario'
export type CampaignScenarioInvestigatorStatus =
  | 'survived'
  | 'resigned'
  | 'defeated_physical'
  | 'defeated_mental'
  | 'killed'
  | 'driven_insane'
  | 'devoured'
export type CampaignScenarioSlotEndReason = 'killed' | 'driven_insane' | 'devoured'
export type CampaignRosterSummaryPlayerKeySource = 'seat-id' | 'normalized-player-name'
export type CampaignRosterSummaryInvestigatorState =
  | 'current'
  | 'former'
  | 'killed'
  | 'driven_insane'
  | 'devoured'
  | 'retired'
  | 'unknown_former'

export interface InvestigatorAssignment {
  playerName: string
  investigatorName: string
  investigatorId?: string
  chapter?: 1 | 2
  archetype: Archetype
  archetypes?: Archetype[]
  investigatorSet?: string
  isUnknown?: boolean
  isCustom?: boolean
  customInvestigatorName?: string
  dreamEatersPath?: DreamEatersCampaignPath
}

export interface LegacyGroupScenarioOutcomeFields {
  xpEarned?: number
  victoryDisplayTotal?: number
  xpBonusPenalty?: number
  physicalTrauma?: number
  mentalTrauma?: number
}

export interface LegacyRichScenarioFields extends LegacyGroupScenarioOutcomeFields {
  scenarioType?: CampaignScenarioType
  resolution?: CampaignScenarioResolution
  rosterBefore?: CampaignScenarioRosterEntry[]
  investigatorOutcomes?: CampaignScenarioInvestigatorOutcome[]
  preScenarioAdjustments?: CampaignScenarioAdjustment[]
  rosterChanges?: CampaignScenarioRosterChange[]
  rosterAfter?: CampaignScenarioRosterEntry[]
}

export interface Playthrough extends LegacyRichScenarioFields {
  id: string
  date: string
  campaignSet?: string
  campaignName: string
  campaignType: CampaignType
  campaignLineageId?: string
  scenarioName?: string
  customCampaignName?: string
  sideStories?: string[]
  investigators: InvestigatorAssignment[]
  notes?: string
  scenarioType?: CampaignScenarioType
  resolution?: CampaignScenarioResolution
  investigatorOutcomes?: CampaignScenarioInvestigatorOutcome[]
  promotedToCampaignRunId?: string
}

export interface CampaignScenarioResolution {
  type: 'numbered' | 'named' | 'no_resolution' | 'custom'
  value?: string
}

export interface CampaignScenarioRosterEntry {
  seatId: string
  slotId: string
  playerName: string
  investigator: InvestigatorAssignment
  seatStatus: 'active' | 'left' | 'eliminated'
  joinedAtScenarioIndex: number
  startedAtScenarioIndex: number
  endedAtScenarioIndex?: number
  endReason?: CampaignScenarioSlotEndReason
  xpTotal: number
  xpSpent: number
  physicalTrauma: number
  mentalTrauma: number
}

export interface CampaignScenarioInvestigatorOutcome {
  seatId: string
  slotId: string
  playerName: string
  investigatorName: string
  status: CampaignScenarioInvestigatorStatus
  xpEarned: number
  traumaGainedPhysical: number
  traumaGainedMental: number
  wasLeadInvestigator?: boolean
}

export interface CampaignScenarioAdjustment {
  type: 'xp_spend'
  slotId: string
  amount: number
  note?: string
}

export interface CampaignScenarioRosterChange {
  type: 'replacement'
  seatId: string
  previousSlotId: string
  reason: CampaignScenarioSlotEndReason
  newEntry: CampaignScenarioRosterEntry
}

export interface CampaignScenarioLog extends LegacyGroupScenarioOutcomeFields {
  id: string
  date: string
  scenarioName: string
  investigators: InvestigatorAssignment[]
  sideStories?: string[]
  notes?: string
  legacySourcePlaythroughId?: string
  scenarioType?: CampaignScenarioType
  resolution?: CampaignScenarioResolution
  rosterBefore?: CampaignScenarioRosterEntry[]
  investigatorOutcomes?: CampaignScenarioInvestigatorOutcome[]
  preScenarioAdjustments?: CampaignScenarioAdjustment[]
  rosterChanges?: CampaignScenarioRosterChange[]
  rosterAfter?: CampaignScenarioRosterEntry[]
}

export interface CampaignRun {
  id: string
  version: CampaignRunVersion
  campaignLineageId: string
  campaignName: string
  campaignSet?: string
  campaignType: CampaignType
  customCampaignName?: string
  startedAt: string
  updatedAt: string
  status: CampaignRunStatus
  sourcePlaythroughId?: string
  setupSnapshot: {
    date: string
    investigators: InvestigatorAssignment[]
    notes?: string
  }
  currentRoster?: CampaignScenarioRosterEntry[]
  scenarioLogs: CampaignScenarioLog[]
}

export interface CampaignRosterSummaryInvestigatorItem {
  key: string
  investigatorName: string
  investigatorId?: string
  chapter?: 1 | 2
  archetype: Archetype
  firstUsedScenarioIndex: number
  state: CampaignRosterSummaryInvestigatorState
  isCurrent: boolean
  hasTallyEvidence: boolean
  xpTotal: number
  xpSpent: number
  physicalTrauma: number
  mentalTrauma: number
}

export interface CampaignRosterSummaryPlayerItem {
  playerKey: string
  playerName: string
  keySource: CampaignRosterSummaryPlayerKeySource
  investigators: CampaignRosterSummaryInvestigatorItem[]
}

export interface FlattenedGameLog extends Playthrough {
  sourceKind: 'playthrough' | 'campaign-run-scenario'
  campaignRunId?: string
  sourcePlaythroughId?: string
  sourceCampaignScenarioLogId?: string
}

export interface ExportEnvelopeV2 {
  version: ExportEnvelopeVersion
  playthroughs: Playthrough[]
  campaignRuns: CampaignRun[]
}

export const ARCHETYPES: Archetype[] = ['Guardian', 'Survivor', 'Seeker', 'Rogue', 'Mystic', 'Neutral', 'Unknown']

export const CAMPAIGN_TYPES: CampaignType[] = ['Full Campaign', 'Small Campaign', 'Scenario Pack', 'Fan-Made', 'Unknown']

export const ARCHETYPE_COLORS: Record<Archetype, string> = {
  'Guardian': 'bg-guardian-bg text-guardian-text border-guardian-border',
  'Seeker': 'bg-seeker-bg text-seeker-text border-seeker-border',
  'Rogue': 'bg-rogue-bg text-rogue-text border-rogue-border',
  'Mystic': 'bg-mystic-bg text-mystic-text border-mystic-border',
  'Survivor': 'bg-survivor-bg text-survivor-text border-survivor-border',
  'Neutral': 'bg-neutral-bg text-neutral-text border-neutral-border',
  'Unknown': 'bg-muted text-muted-foreground border-border',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

export function isArchetype(value: unknown): value is Archetype {
  return typeof value === 'string' && ARCHETYPES.includes(value as Archetype)
}

export function isCampaignType(value: unknown): value is CampaignType {
  return typeof value === 'string' && CAMPAIGN_TYPES.includes(value as CampaignType)
}

export function isCampaignRunStatus(value: unknown): value is CampaignRunStatus {
  return value === 'active' || value === 'completed'
}

export function isDreamEatersCampaignPath(value: unknown): value is DreamEatersCampaignPath {
  return value === 'A: The Dream-Quest' || value === 'B: The Web of Dreams'
}

export function isInvestigatorAssignment(value: unknown): value is InvestigatorAssignment {
  if (!isRecord(value)) return false
  if (typeof value.playerName !== 'string') return false
  if (typeof value.investigatorName !== 'string') return false
  if (!isArchetype(value.archetype)) return false
  if (value.investigatorId !== undefined && typeof value.investigatorId !== 'string') return false
  if (value.chapter !== undefined && value.chapter !== 1 && value.chapter !== 2) return false
  if (value.archetypes !== undefined && (!Array.isArray(value.archetypes) || !value.archetypes.every(isArchetype))) return false
  if (value.investigatorSet !== undefined && typeof value.investigatorSet !== 'string') return false
  if (value.isUnknown !== undefined && typeof value.isUnknown !== 'boolean') return false
  if (value.isCustom !== undefined && typeof value.isCustom !== 'boolean') return false
  if (value.customInvestigatorName !== undefined && typeof value.customInvestigatorName !== 'string') return false
  if (value.dreamEatersPath !== undefined && !isDreamEatersCampaignPath(value.dreamEatersPath)) return false
  return true
}

export function isCampaignScenarioType(value: unknown): value is CampaignScenarioType {
  return value === 'standard' || value === 'interlude' || value === 'side_scenario'
}

export function isCampaignScenarioInvestigatorStatus(value: unknown): value is CampaignScenarioInvestigatorStatus {
  return (
    value === 'survived' ||
    value === 'resigned' ||
    value === 'defeated_physical' ||
    value === 'defeated_mental' ||
    value === 'killed' ||
    value === 'driven_insane' ||
    value === 'devoured'
  )
}

export function isCampaignScenarioSlotEndReason(value: unknown): value is CampaignScenarioSlotEndReason {
  return value === 'killed' || value === 'driven_insane' || value === 'devoured'
}

export function isCampaignScenarioResolution(value: unknown): value is CampaignScenarioResolution {
  if (!isRecord(value)) return false
  const type = value.type
  if (type !== 'numbered' && type !== 'named' && type !== 'no_resolution' && type !== 'custom') return false
  if (value.value !== undefined && typeof value.value !== 'string') return false
  return true
}

export function isCampaignScenarioRosterEntry(value: unknown): value is CampaignScenarioRosterEntry {
  if (!isRecord(value)) return false
  if (typeof value.seatId !== 'string') return false
  if (typeof value.slotId !== 'string') return false
  if (typeof value.playerName !== 'string') return false
  if (!isInvestigatorAssignment(value.investigator)) return false
  if (value.seatStatus !== 'active' && value.seatStatus !== 'left' && value.seatStatus !== 'eliminated') return false
  if (!isFiniteNumber(value.joinedAtScenarioIndex)) return false
  if (!isFiniteNumber(value.startedAtScenarioIndex)) return false
  if (value.endedAtScenarioIndex !== undefined && !isFiniteNumber(value.endedAtScenarioIndex)) return false
  if (value.endReason !== undefined && !isCampaignScenarioSlotEndReason(value.endReason)) return false
  if (!isFiniteNumber(value.xpTotal)) return false
  if (!isFiniteNumber(value.xpSpent)) return false
  if (!isFiniteNumber(value.physicalTrauma)) return false
  if (!isFiniteNumber(value.mentalTrauma)) return false
  return true
}

export function isCampaignScenarioInvestigatorOutcome(value: unknown): value is CampaignScenarioInvestigatorOutcome {
  if (!isRecord(value)) return false
  if (typeof value.seatId !== 'string') return false
  if (typeof value.slotId !== 'string') return false
  if (typeof value.playerName !== 'string') return false
  if (typeof value.investigatorName !== 'string') return false
  if (!isCampaignScenarioInvestigatorStatus(value.status)) return false
  if (!isFiniteNumber(value.xpEarned)) return false
  if (!isFiniteNumber(value.traumaGainedPhysical)) return false
  if (!isFiniteNumber(value.traumaGainedMental)) return false
  if (value.wasLeadInvestigator !== undefined && typeof value.wasLeadInvestigator !== 'boolean') return false
  return true
}

export function isCampaignScenarioAdjustment(value: unknown): value is CampaignScenarioAdjustment {
  if (!isRecord(value)) return false
  if (value.type !== 'xp_spend') return false
  if (typeof value.slotId !== 'string') return false
  if (!isFiniteNumber(value.amount)) return false
  if (value.note !== undefined && typeof value.note !== 'string') return false
  return true
}

export function isCampaignScenarioRosterChange(value: unknown): value is CampaignScenarioRosterChange {
  if (!isRecord(value)) return false
  if (value.type !== 'replacement') return false
  if (typeof value.seatId !== 'string') return false
  if (typeof value.previousSlotId !== 'string') return false
  if (!isCampaignScenarioSlotEndReason(value.reason)) return false
  if (!isCampaignScenarioRosterEntry(value.newEntry)) return false
  return true
}

function hasValidLegacyGroupScenarioOutcomeFields(value: Record<string, unknown>): boolean {
  if (value.xpEarned !== undefined && !isFiniteNumber(value.xpEarned)) return false
  if (value.victoryDisplayTotal !== undefined && !isFiniteNumber(value.victoryDisplayTotal)) return false
  if (value.xpBonusPenalty !== undefined && !isFiniteNumber(value.xpBonusPenalty)) return false
  if (value.physicalTrauma !== undefined && !isFiniteNumber(value.physicalTrauma)) return false
  if (value.mentalTrauma !== undefined && !isFiniteNumber(value.mentalTrauma)) return false
  return true
}

function hasValidLegacyRichScenarioFields(value: Record<string, unknown>): boolean {
  if (!hasValidLegacyGroupScenarioOutcomeFields(value)) return false
  if (value.scenarioType !== undefined && !isCampaignScenarioType(value.scenarioType)) return false
  if (value.resolution !== undefined && !isCampaignScenarioResolution(value.resolution)) return false
  if (value.rosterBefore !== undefined && (!Array.isArray(value.rosterBefore) || !value.rosterBefore.every(isCampaignScenarioRosterEntry))) return false
  if (value.investigatorOutcomes !== undefined && (!Array.isArray(value.investigatorOutcomes) || !value.investigatorOutcomes.every(isCampaignScenarioInvestigatorOutcome))) return false
  if (value.preScenarioAdjustments !== undefined && (!Array.isArray(value.preScenarioAdjustments) || !value.preScenarioAdjustments.every(isCampaignScenarioAdjustment))) return false
  if (value.rosterChanges !== undefined && (!Array.isArray(value.rosterChanges) || !value.rosterChanges.every(isCampaignScenarioRosterChange))) return false
  if (value.rosterAfter !== undefined && (!Array.isArray(value.rosterAfter) || !value.rosterAfter.every(isCampaignScenarioRosterEntry))) return false
  return true
}

export function isPlaythrough(value: unknown): value is Playthrough {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.date !== 'string') return false
  if (typeof value.campaignName !== 'string') return false
  if (!isCampaignType(value.campaignType)) return false
  if (value.campaignSet !== undefined && typeof value.campaignSet !== 'string') return false
  if (value.campaignLineageId !== undefined && typeof value.campaignLineageId !== 'string') return false
  if (value.scenarioName !== undefined && typeof value.scenarioName !== 'string') return false
  if (value.customCampaignName !== undefined && typeof value.customCampaignName !== 'string') return false
  if (value.sideStories !== undefined && !isStringArray(value.sideStories)) return false
  if (!Array.isArray(value.investigators)) return false
  if (!value.investigators.every(isInvestigatorAssignment)) return false
  if (value.notes !== undefined && typeof value.notes !== 'string') return false
  if (value.promotedToCampaignRunId !== undefined && typeof value.promotedToCampaignRunId !== 'string') return false
  if (!hasValidLegacyRichScenarioFields(value)) return false
  return true
}

export function isCampaignScenarioLog(value: unknown): value is CampaignScenarioLog {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.date !== 'string') return false
  if (typeof value.scenarioName !== 'string') return false
  if (!Array.isArray(value.investigators)) return false
  if (!value.investigators.every(isInvestigatorAssignment)) return false
  if (value.sideStories !== undefined && !isStringArray(value.sideStories)) return false
  if (value.notes !== undefined && typeof value.notes !== 'string') return false
  if (value.legacySourcePlaythroughId !== undefined && typeof value.legacySourcePlaythroughId !== 'string') return false
  if (value.scenarioType !== undefined && !isCampaignScenarioType(value.scenarioType)) return false
  if (value.resolution !== undefined && !isCampaignScenarioResolution(value.resolution)) return false
  if (value.rosterBefore !== undefined && (!Array.isArray(value.rosterBefore) || !value.rosterBefore.every(isCampaignScenarioRosterEntry))) return false
  if (value.investigatorOutcomes !== undefined && (!Array.isArray(value.investigatorOutcomes) || !value.investigatorOutcomes.every(isCampaignScenarioInvestigatorOutcome))) return false
  if (value.preScenarioAdjustments !== undefined && (!Array.isArray(value.preScenarioAdjustments) || !value.preScenarioAdjustments.every(isCampaignScenarioAdjustment))) return false
  if (value.rosterChanges !== undefined && (!Array.isArray(value.rosterChanges) || !value.rosterChanges.every(isCampaignScenarioRosterChange))) return false
  if (value.rosterAfter !== undefined && (!Array.isArray(value.rosterAfter) || !value.rosterAfter.every(isCampaignScenarioRosterEntry))) return false
  if (!hasValidLegacyGroupScenarioOutcomeFields(value)) return false
  return true
}

export function isCampaignRun(value: unknown): value is CampaignRun {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (value.version !== 1 && value.version !== 2) return false
  if (typeof value.campaignLineageId !== 'string') return false
  if (typeof value.campaignName !== 'string') return false
  if (!isCampaignType(value.campaignType)) return false
  if (value.campaignSet !== undefined && typeof value.campaignSet !== 'string') return false
  if (value.customCampaignName !== undefined && typeof value.customCampaignName !== 'string') return false
  if (typeof value.startedAt !== 'string') return false
  if (typeof value.updatedAt !== 'string') return false
  if (!isCampaignRunStatus(value.status)) return false
  if (value.sourcePlaythroughId !== undefined && typeof value.sourcePlaythroughId !== 'string') return false
  if (!Array.isArray(value.scenarioLogs) || !value.scenarioLogs.every(isCampaignScenarioLog)) return false
  if (!isRecord(value.setupSnapshot)) return false
  if (typeof value.setupSnapshot.date !== 'string') return false
  if (!Array.isArray(value.setupSnapshot.investigators)) return false
  if (!value.setupSnapshot.investigators.every(isInvestigatorAssignment)) return false
  if (value.setupSnapshot.notes !== undefined && typeof value.setupSnapshot.notes !== 'string') return false
  if (value.currentRoster !== undefined && (!Array.isArray(value.currentRoster) || !value.currentRoster.every(isCampaignScenarioRosterEntry))) return false
  return true
}

export function isExportEnvelopeV2(value: unknown): value is ExportEnvelopeV2 {
  if (!isRecord(value)) return false
  if (value.version !== 2) return false
  if (!Array.isArray(value.playthroughs) || !value.playthroughs.every(isPlaythrough)) return false
  if (!Array.isArray(value.campaignRuns) || !value.campaignRuns.every(isCampaignRun)) return false
  return true
}
