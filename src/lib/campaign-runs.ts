import { getCampaignLineageId, resolveCampaignType } from './campaign-data.js'
import {
  getCampaignProgressionScenarioNames,
  getNextCampaignScenarioResolution,
  resolveCampaignProgressionContract,
} from './campaign-progression.js'
import type {
  CampaignRosterSummaryInvestigatorItem,
  CampaignRosterSummaryInvestigatorState,
  CampaignRosterSummaryPlayerItem,
  CampaignRun,
  CampaignScenarioAdjustment,
  CampaignScenarioInvestigatorOutcome,
  CampaignScenarioLog,
  CampaignScenarioResolution,
  CampaignScenarioRosterChange,
  CampaignScenarioRosterEntry,
  CampaignScenarioType,
  FlattenedGameLog,
  InvestigatorAssignment,
  LegacyGroupScenarioOutcomeFields,
  Playthrough,
} from './types.js'
import {
  isCampaignScenarioAdjustment,
  isCampaignScenarioInvestigatorOutcome,
  isCampaignScenarioResolution,
  isCampaignScenarioRosterChange,
  isCampaignScenarioRosterEntry,
  isCampaignScenarioType,
} from './types.js'

export interface FlattenGameLogsInput {
  playthroughs: Playthrough[]
  campaignRuns: CampaignRun[]
}

export interface CampaignRunEditInput {
  campaignName?: string
  campaignSet?: string
  campaignType?: CampaignRun['campaignType']
  customCampaignName?: string
  startedAt?: string
  status?: CampaignRun['status']
  setupSnapshot?: Partial<CampaignRun['setupSnapshot']>
}

export interface CampaignScenarioLogEditInput {
  date?: string
  scenarioName?: string
  investigators?: InvestigatorAssignment[]
  sideStories?: string[]
  notes?: string
  scenarioType?: CampaignScenarioType
  resolution?: CampaignScenarioResolution
  rosterBefore?: CampaignScenarioRosterEntry[]
  investigatorOutcomes?: CampaignScenarioInvestigatorOutcome[]
  preScenarioAdjustments?: CampaignScenarioAdjustment[]
  rosterChanges?: CampaignScenarioRosterChange[]
  rosterAfter?: CampaignScenarioRosterEntry[]
}

export interface NewCampaignScenarioLogInput extends CampaignScenarioLogEditInput {
  id?: string
  date: string
  scenarioName: string
  investigators: InvestigatorAssignment[]
  legacySourcePlaythroughId?: string
}

type ScenarioStatefulEditKey =
  | 'investigators'
  | 'rosterBefore'
  | 'investigatorOutcomes'
  | 'preScenarioAdjustments'
  | 'rosterChanges'
  | 'rosterAfter'

const SCENARIO_STATEFUL_EDIT_KEYS: ScenarioStatefulEditKey[] = [
  'investigators',
  'rosterBefore',
  'investigatorOutcomes',
  'preScenarioAdjustments',
  'rosterChanges',
  'rosterAfter',
]

const COSMETIC_SCENARIO_KEYS: Array<keyof CampaignScenarioLogEditInput> = [
  'date',
  'scenarioName',
  'scenarioType',
  'resolution',
  'sideStories',
  'notes',
]

const DEFAULT_VERSION = 2 as const

export type CampaignRunMutationErrorCode =
  | 'CAMPAIGN_RUN_SETUP_INVESTIGATORS_LOCKED'
  | 'STANDALONE_SCENARIO_APPEND_BLOCKED'
  | 'STANDALONE_SIDE_SCENARIO_BLOCKED'
  | 'STANDALONE_CAMPAIGN_SHAPE_INVALID'
  | 'CAMPAIGN_SCENARIO_NAME_REQUIRED'
  | 'OFFICIAL_CAMPAIGN_SCENARIO_INVALID'
  | 'CAMPAIGN_SCENARIO_BRANCH_INVALID'
  | 'CAMPAIGN_SCENARIO_LOG_DUPLICATE_ID'
  | 'CAMPAIGN_SCENARIO_LOG_NOT_FOUND'
  | 'CAMPAIGN_SCENARIO_LOG_STATEFUL_EDIT_BLOCKED'
  | 'CAMPAIGN_SCENARIO_LOG_DELETE_BLOCKED'

export class CampaignRunMutationError extends Error {
  code: CampaignRunMutationErrorCode

  constructor(code: CampaignRunMutationErrorCode, message: string) {
    super(message)
    this.name = 'CampaignRunMutationError'
    this.code = code
  }
}

export function assertValidNewCampaignRun(run: Omit<CampaignRun, 'id'> | CampaignRun): void {
  if (run.campaignType !== 'Scenario Pack') return
  if (run.scenarioLogs.length > 1 || run.scenarioLogs.some(log => log.scenarioType === 'side_scenario')) {
    throw new CampaignRunMutationError(
      'STANDALONE_CAMPAIGN_SHAPE_INVALID',
      'A standalone Scenario Pack can contain only its single primary scenario result.',
    )
  }
}

function normalizeScenarioIdentity(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function assertValidScenarioIdentity(
  run: CampaignRun,
  scenario: Pick<CampaignScenarioLog, 'scenarioName' | 'scenarioType'>,
  completedScenarioNames: string[] = run.scenarioLogs
    .filter(log => log.scenarioType !== 'side_scenario')
    .map(log => log.scenarioName),
): void {
  const scenarioName = scenario.scenarioName.trim()
  if (!scenarioName) {
    throw new CampaignRunMutationError(
      'CAMPAIGN_SCENARIO_NAME_REQUIRED',
      'Scenario name is required.',
    )
  }

  if (scenario.scenarioType === 'side_scenario') return

  const campaignType = resolveCampaignType({
    campaignName: run.campaignName,
    campaignSet: run.campaignSet,
    campaignType: run.campaignType,
    customCampaignName: run.customCampaignName,
  })
  if (campaignType === 'Fan-Made') return

  if (campaignType === 'Scenario Pack') {
    if (normalizeScenarioIdentity(scenarioName) === normalizeScenarioIdentity(run.campaignName)) return
    throw new CampaignRunMutationError(
      'OFFICIAL_CAMPAIGN_SCENARIO_INVALID',
      'A standalone Scenario Pack result must use its selected scenario name.',
    )
  }

  const canonicalScenarios = getCampaignProgressionScenarioNames({
    campaignName: run.campaignName,
    campaignSet: run.campaignSet,
    campaignType: run.campaignType,
    customCampaignName: run.customCampaignName,
  })
  const normalizedScenarioName = normalizeScenarioIdentity(scenarioName)
  if (canonicalScenarios.some(name => normalizeScenarioIdentity(name) === normalizedScenarioName)) {
    const contract = resolveCampaignProgressionContract({
      campaignName: run.campaignName,
      campaignSet: run.campaignSet,
      campaignType: run.campaignType,
      customCampaignName: run.customCampaignName,
    })
    if (contract?.branchRoutes) {
      const resolution = getNextCampaignScenarioResolution({
        campaignName: run.campaignName,
        campaignSet: run.campaignSet,
        campaignType: run.campaignType,
        customCampaignName: run.customCampaignName,
      }, completedScenarioNames)
      if (!resolution.candidates.some(candidate =>
        normalizeScenarioIdentity(candidate.name) === normalizedScenarioName
      )) {
        throw new CampaignRunMutationError(
          'CAMPAIGN_SCENARIO_BRANCH_INVALID',
          'This scenario is not a valid next step for the campaign route recorded in scenario history.',
        )
      }
    }
    return
  }

  throw new CampaignRunMutationError(
    'OFFICIAL_CAMPAIGN_SCENARIO_INVALID',
    canonicalScenarios.length > 0
      ? 'Official campaign scenarios must use a guide-backed scenario selection.'
      : 'Campaign scenario logging is unavailable until guide-backed progression metadata exists.',
  )
}

export interface CampaignCountRoot {
  source: 'campaign-run' | 'playthrough'
  runId?: string
  playthroughId?: string
  campaignName: string
  campaignSet?: string
  campaignType: Playthrough['campaignType']
  campaignLineageId: string
}

export interface CompletionBreakdown {
  fullCampaigns: number
  smallCampaigns: number
  scenarioPacks: number
  fanMade: number
}

export interface CampaignCountSummary {
  roots: CampaignCountRoot[]
  campaignRunsPlayedCount: number
  uniqueCampaignFamilyCount: number
  breakdown: CompletionBreakdown
}

function cloneInvestigators(investigators: InvestigatorAssignment[]): InvestigatorAssignment[] {
  return investigators.map((investigator) => ({ ...investigator }))
}

function cloneRosterEntries(entries: CampaignScenarioRosterEntry[]): CampaignScenarioRosterEntry[] {
  return entries.map((entry) => ({
    ...entry,
    investigator: { ...entry.investigator },
  }))
}

function cloneOutcomes(entries: CampaignScenarioInvestigatorOutcome[]): CampaignScenarioInvestigatorOutcome[] {
  return entries.map((entry) => ({ ...entry }))
}

function cloneAdjustments(entries: CampaignScenarioAdjustment[]): CampaignScenarioAdjustment[] {
  return entries.map((entry) => ({ ...entry }))
}

function cloneRosterChanges(entries: CampaignScenarioRosterChange[]): CampaignScenarioRosterChange[] {
  return entries.map((entry) => ({
    ...entry,
    newEntry: {
      ...entry.newEntry,
      investigator: { ...entry.newEntry.investigator },
    },
  }))
}

function copyLegacyGroupScenarioOutcomeFields(
  source: LegacyGroupScenarioOutcomeFields & Record<string, unknown>,
): LegacyGroupScenarioOutcomeFields {
  const next: LegacyGroupScenarioOutcomeFields = {}
  if (typeof source.xpEarned === 'number' && Number.isFinite(source.xpEarned)) {
    next.xpEarned = source.xpEarned
  }
  if (typeof source.victoryDisplayTotal === 'number' && Number.isFinite(source.victoryDisplayTotal)) {
    next.victoryDisplayTotal = source.victoryDisplayTotal
  }
  if (typeof source.xpBonusPenalty === 'number' && Number.isFinite(source.xpBonusPenalty)) {
    next.xpBonusPenalty = source.xpBonusPenalty
  }
  if (typeof source.physicalTrauma === 'number' && Number.isFinite(source.physicalTrauma)) {
    next.physicalTrauma = source.physicalTrauma
  } else if (typeof source.traumaGainedPhysical === 'number' && Number.isFinite(source.traumaGainedPhysical)) {
    next.physicalTrauma = source.traumaGainedPhysical
  }
  if (typeof source.mentalTrauma === 'number' && Number.isFinite(source.mentalTrauma)) {
    next.mentalTrauma = source.mentalTrauma
  } else if (typeof source.traumaGainedMental === 'number' && Number.isFinite(source.traumaGainedMental)) {
    next.mentalTrauma = source.traumaGainedMental
  }
  return next
}

function normalizeStringArray(values?: string[]): string[] | undefined {
  if (!Array.isArray(values)) return undefined
  const normalized = values.filter((entry): entry is string => typeof entry === 'string')
  return normalized.length > 0 ? [...normalized] : []
}

function cloneScenarioLog(log: CampaignScenarioLog): CampaignScenarioLog {
  return {
    ...log,
    ...copyLegacyGroupScenarioOutcomeFields(log as CampaignScenarioLog & Record<string, unknown>),
    investigators: cloneInvestigators(log.investigators),
    sideStories: normalizeStringArray(log.sideStories),
    rosterBefore: log.rosterBefore ? cloneRosterEntries(log.rosterBefore) : undefined,
    investigatorOutcomes: log.investigatorOutcomes ? cloneOutcomes(log.investigatorOutcomes) : undefined,
    preScenarioAdjustments: log.preScenarioAdjustments
      ? cloneAdjustments(log.preScenarioAdjustments)
      : undefined,
    rosterChanges: log.rosterChanges ? cloneRosterChanges(log.rosterChanges) : undefined,
    rosterAfter: log.rosterAfter ? cloneRosterEntries(log.rosterAfter) : undefined,
  }
}

function cloneRun(run: CampaignRun): CampaignRun {
  return {
    ...run,
    setupSnapshot: {
      ...run.setupSnapshot,
      investigators: cloneInvestigators(run.setupSnapshot.investigators),
    },
    currentRoster: run.currentRoster ? cloneRosterEntries(run.currentRoster) : undefined,
    scenarioLogs: run.scenarioLogs.map(cloneScenarioLog),
  }
}

function resolveNow(now?: string | (() => string)): string {
  if (typeof now === 'function') return now()
  if (typeof now === 'string') return now
  return new Date().toISOString()
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function toCampaignStartTimestamp(startedAt: string, now?: string | (() => string)): string {
  if (!DATE_ONLY_PATTERN.test(startedAt)) return startedAt
  const resolvedNow = resolveNow(now)
  const timeSuffix = resolvedNow.match(/T(.+)$/)?.[1]
  return timeSuffix ? `${startedAt}T${timeSuffix}` : `${startedAt}T00:00:00.000Z`
}

function mergeCampaignStartDate(current: string, replacement: string): string {
  if (!DATE_ONLY_PATTERN.test(replacement) || DATE_ONLY_PATTERN.test(current)) return replacement
  const timeSuffix = current.match(/T(.+)$/)?.[1]
  return timeSuffix ? `${replacement}T${timeSuffix}` : replacement
}

function buildInitialScenarioLogId(sourcePlaythroughId: string): string {
  return `seed:${sourcePlaythroughId}`
}

function normalizePlayerName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function normalizeInvestigatorIdentity(investigator: InvestigatorAssignment): string {
  if (investigator.investigatorId?.trim()) {
    return `investigator-id:${investigator.investigatorId.trim().toLocaleLowerCase()}`
  }
  const chapter = investigator.chapter ?? 0
  return [
    investigator.investigatorName.trim().toLocaleLowerCase(),
    `${chapter}`,
    investigator.isCustom ? 'custom' : 'standard',
  ].join('|')
}

function readSeatSlotOrdinal(slotId: string, seatId: string): number {
  if (!slotId.startsWith(`${seatId}:slot:`)) return 1
  const ordinal = Number.parseInt(slotId.slice(`${seatId}:slot:`.length), 10)
  return Number.isFinite(ordinal) && ordinal >= 1 ? ordinal : 1
}

export function getNextCampaignSeatSlotId(
  entries: CampaignScenarioRosterEntry[],
  seatId: string,
): string {
  const highestOrdinal = entries.reduce((currentHighest, entry) => {
    if (entry.seatId !== seatId) return currentHighest
    return Math.max(currentHighest, readSeatSlotOrdinal(entry.slotId, seatId))
  }, 1)
  return `${seatId}:slot:${highestOrdinal + 1}`
}

function isScenarioStatefulEdit(updates: CampaignScenarioLogEditInput): boolean {
  return SCENARIO_STATEFUL_EDIT_KEYS.some((key) => updates[key] !== undefined)
}

function buildSetupRosterSeed(
  investigators: InvestigatorAssignment[],
  scenarioIndex: number,
): CampaignScenarioRosterEntry[] {
  const seenByName = new Map<string, number>()
  return investigators.map((investigator, index) => {
    const normalizedPlayer = normalizePlayerName(investigator.playerName || `player-${index + 1}`)
    const occurrence = (seenByName.get(normalizedPlayer) ?? 0) + 1
    seenByName.set(normalizedPlayer, occurrence)
    const seatId = `seat:${normalizedPlayer || 'player'}:${occurrence}`
    const slotId = `${seatId}:slot:1`
    return {
      seatId,
      slotId,
      playerName: investigator.playerName,
      investigator: { ...investigator },
      seatStatus: 'active',
      joinedAtScenarioIndex: scenarioIndex,
      startedAtScenarioIndex: scenarioIndex,
      xpTotal: 0,
      xpSpent: 0,
      physicalTrauma: 0,
      mentalTrauma: 0,
    }
  })
}

function deriveRosterFromInvestigators(
  investigators: InvestigatorAssignment[],
  fallback: CampaignScenarioRosterEntry[],
  scenarioIndex: number,
): CampaignScenarioRosterEntry[] {
  if (investigators.length === 0) {
    return cloneRosterEntries(fallback)
  }

  const byPlayer = new Map<string, CampaignScenarioRosterEntry[]>()
  for (const entry of fallback) {
    const key = normalizePlayerName(entry.playerName)
    const values = byPlayer.get(key) ?? []
    values.push(entry)
    byPlayer.set(key, values)
  }

  const usedSlotIds = new Set<string>()
  const next: CampaignScenarioRosterEntry[] = []
  const generatedSeatCounts = new Map<string, number>()

  for (let index = 0; index < investigators.length; index++) {
    const investigator = investigators[index]
    const playerKey = normalizePlayerName(investigator.playerName || `player-${index + 1}`)
    const candidates = byPlayer.get(playerKey) ?? []
    const existing = candidates.find((candidate) => !usedSlotIds.has(candidate.slotId))
    const existingIdentity = existing?.investigator
      ? normalizeInvestigatorIdentity(existing.investigator)
      : null
    const incomingIdentity = normalizeInvestigatorIdentity(investigator)

    if (existing) {
      usedSlotIds.add(existing.slotId)
      if (existingIdentity === incomingIdentity) {
        next.push({
          ...existing,
          playerName: investigator.playerName,
          investigator: { ...investigator },
          seatStatus: 'active',
          endedAtScenarioIndex: undefined,
          endReason: undefined,
        })
        continue
      }

      next.push({
        seatId: existing.seatId,
        slotId: getNextCampaignSeatSlotId(fallback, existing.seatId),
        playerName: investigator.playerName,
        investigator: { ...investigator },
        seatStatus: 'active',
        joinedAtScenarioIndex: scenarioIndex,
        startedAtScenarioIndex: scenarioIndex,
        xpTotal: 0,
        xpSpent: 0,
        physicalTrauma: 0,
        mentalTrauma: 0,
      })
      continue
    }

    const seatOccurrence = (generatedSeatCounts.get(playerKey) ?? 0) + 1
    generatedSeatCounts.set(playerKey, seatOccurrence)
    const seatId = `seat:${playerKey || 'player'}:${seatOccurrence}`
    next.push({
      seatId,
      slotId: `${seatId}:slot:1`,
      playerName: investigator.playerName,
      investigator: { ...investigator },
      seatStatus: 'active',
      joinedAtScenarioIndex: scenarioIndex,
      startedAtScenarioIndex: scenarioIndex,
      xpTotal: 0,
      xpSpent: 0,
      physicalTrauma: 0,
      mentalTrauma: 0,
    })
  }

  return next
}

function deriveScenarioRosterAfter(
  scenarioLog: CampaignScenarioLog,
  scenarioIndex: number,
  fallback: CampaignScenarioRosterEntry[],
): CampaignScenarioRosterEntry[] {
  if (scenarioLog.rosterAfter?.length) {
    return cloneRosterEntries(scenarioLog.rosterAfter)
  }
  return deriveRosterFromInvestigators(scenarioLog.investigators, fallback, scenarioIndex)
}

function deriveRosterUpToScenarioIndex(
  run: CampaignRun,
  scenarioIndexExclusive: number,
): CampaignScenarioRosterEntry[] {
  let currentRoster = buildSetupRosterSeed(run.setupSnapshot.investigators, 0)
  for (let index = 0; index < scenarioIndexExclusive; index++) {
    const scenarioLog = run.scenarioLogs[index]
    currentRoster = deriveScenarioRosterAfter(scenarioLog, index, currentRoster)
  }
  return currentRoster
}

function mergeScenarioLogEdit(
  current: CampaignScenarioLog,
  updates: CampaignScenarioLogEditInput,
): CampaignScenarioLog {
  return {
    ...current,
    date: updates.date ?? current.date,
    scenarioName: updates.scenarioName ?? current.scenarioName,
    investigators: updates.investigators ? cloneInvestigators(updates.investigators) : cloneInvestigators(current.investigators),
    sideStories: updates.sideStories !== undefined
      ? normalizeStringArray(updates.sideStories)
      : normalizeStringArray(current.sideStories),
    notes: updates.notes ?? current.notes,
    scenarioType: updates.scenarioType ?? current.scenarioType,
    resolution: updates.resolution ?? current.resolution,
    rosterBefore: updates.rosterBefore
      ? cloneRosterEntries(updates.rosterBefore)
      : (current.rosterBefore ? cloneRosterEntries(current.rosterBefore) : undefined),
    investigatorOutcomes: updates.investigatorOutcomes
      ? cloneOutcomes(updates.investigatorOutcomes)
      : (current.investigatorOutcomes ? cloneOutcomes(current.investigatorOutcomes) : undefined),
    preScenarioAdjustments: updates.preScenarioAdjustments
      ? cloneAdjustments(updates.preScenarioAdjustments)
      : (current.preScenarioAdjustments ? cloneAdjustments(current.preScenarioAdjustments) : undefined),
    rosterChanges: updates.rosterChanges
      ? cloneRosterChanges(updates.rosterChanges)
      : (current.rosterChanges ? cloneRosterChanges(current.rosterChanges) : undefined),
    rosterAfter: updates.rosterAfter
      ? cloneRosterEntries(updates.rosterAfter)
      : (current.rosterAfter ? cloneRosterEntries(current.rosterAfter) : undefined),
  }
}

function tryReadRichFieldFromLegacySource(
  source: Record<string, unknown>,
): Pick<
  CampaignScenarioLog,
  | 'xpEarned'
  | 'victoryDisplayTotal'
  | 'xpBonusPenalty'
  | 'physicalTrauma'
  | 'mentalTrauma'
  | 'scenarioType'
  | 'resolution'
  | 'rosterBefore'
  | 'investigatorOutcomes'
  | 'preScenarioAdjustments'
  | 'rosterChanges'
  | 'rosterAfter'
> {
  const result: Pick<
    CampaignScenarioLog,
    | 'xpEarned'
    | 'victoryDisplayTotal'
    | 'xpBonusPenalty'
    | 'physicalTrauma'
    | 'mentalTrauma'
    | 'scenarioType'
    | 'resolution'
    | 'rosterBefore'
    | 'investigatorOutcomes'
    | 'preScenarioAdjustments'
    | 'rosterChanges'
    | 'rosterAfter'
  > = {}

  Object.assign(result, copyLegacyGroupScenarioOutcomeFields(source as LegacyGroupScenarioOutcomeFields & Record<string, unknown>))
  if (isCampaignScenarioType(source.scenarioType)) {
    result.scenarioType = source.scenarioType
  }
  if (isCampaignScenarioResolution(source.resolution)) {
    result.resolution = source.resolution
  }
  if (Array.isArray(source.rosterBefore) && source.rosterBefore.every(isCampaignScenarioRosterEntry)) {
    result.rosterBefore = cloneRosterEntries(source.rosterBefore)
  }
  if (Array.isArray(source.investigatorOutcomes) && source.investigatorOutcomes.every(isCampaignScenarioInvestigatorOutcome)) {
    result.investigatorOutcomes = cloneOutcomes(source.investigatorOutcomes)
  }
  if (Array.isArray(source.preScenarioAdjustments) && source.preScenarioAdjustments.every(isCampaignScenarioAdjustment)) {
    result.preScenarioAdjustments = cloneAdjustments(source.preScenarioAdjustments)
  }
  if (Array.isArray(source.rosterChanges) && source.rosterChanges.every(isCampaignScenarioRosterChange)) {
    result.rosterChanges = cloneRosterChanges(source.rosterChanges)
  }
  if (Array.isArray(source.rosterAfter) && source.rosterAfter.every(isCampaignScenarioRosterEntry)) {
    result.rosterAfter = cloneRosterEntries(source.rosterAfter)
  }

  return result
}

function resolveCampaignLineageId(input: {
  campaignLineageId?: string
  campaignName: string
  campaignSet?: string
  campaignType: Playthrough['campaignType']
  customCampaignName?: string
}): string {
  const lineage = input.campaignLineageId?.trim()
  if (lineage) return lineage
  return getCampaignLineageId({
    campaignName: input.campaignName,
    campaignSet: input.campaignSet,
    campaignType: input.campaignType,
    customCampaignName: input.customCampaignName,
  })
}

export function buildCampaignRunFromSourcePlaythrough(
  source: Playthrough,
  options?: {
    campaignRunId?: string
    now?: string | (() => string)
  },
): CampaignRun {
  const campaignRunId = options?.campaignRunId ?? source.id
  const now = resolveNow(options?.now)
  const scenarioName = source.scenarioName?.trim()
  const legacySource = source as Playthrough & Record<string, unknown>
  const initialRich = tryReadRichFieldFromLegacySource(legacySource)
  const scenarioLogs: CampaignScenarioLog[] = scenarioName
    ? [
        {
          id: buildInitialScenarioLogId(source.id),
          date: source.date,
          scenarioName,
          investigators: cloneInvestigators(source.investigators),
          sideStories: normalizeStringArray(source.sideStories),
          notes: source.notes,
          legacySourcePlaythroughId: source.id,
          ...initialRich,
        },
      ]
    : []

  const nextRun: CampaignRun = {
    id: campaignRunId,
    version: DEFAULT_VERSION,
    campaignLineageId: resolveCampaignLineageId(source),
    campaignName: source.campaignName,
    campaignSet: source.campaignSet,
    campaignType: source.campaignType,
    customCampaignName: source.customCampaignName,
    startedAt: toCampaignStartTimestamp(source.date, now),
    updatedAt: now,
    status: 'active',
    sourcePlaythroughId: source.id,
    setupSnapshot: {
      date: source.date,
      investigators: cloneInvestigators(source.investigators),
      notes: source.notes,
    },
    scenarioLogs,
  }

  nextRun.currentRoster = scenarioLogs.length > 0
    ? deriveRosterUpToScenarioIndex(nextRun, scenarioLogs.length)
    : buildSetupRosterSeed(nextRun.setupSnapshot.investigators, 0)

  return nextRun
}

export function editCampaignRun(
  run: CampaignRun,
  updates: CampaignRunEditInput,
  now?: string | (() => string),
): CampaignRun {
  if (updates.campaignType === 'Scenario Pack') {
    assertValidNewCampaignRun({ ...run, campaignType: updates.campaignType })
  }
  if (run.scenarioLogs.length > 0 && updates.setupSnapshot?.investigators) {
    throw new CampaignRunMutationError(
      'CAMPAIGN_RUN_SETUP_INVESTIGATORS_LOCKED',
      'Setup investigators cannot be edited once scenario history exists. Edit the latest scenario state instead.',
    )
  }

  const clone = cloneRun(run)
  const next: CampaignRun = {
    ...clone,
    version: clone.version === 1 ? 2 : clone.version,
    campaignName: updates.campaignName ?? clone.campaignName,
    campaignSet: updates.campaignSet ?? clone.campaignSet,
    campaignType: updates.campaignType ?? clone.campaignType,
    customCampaignName: updates.customCampaignName ?? clone.customCampaignName,
    startedAt: updates.startedAt === undefined
      ? clone.startedAt
      : mergeCampaignStartDate(clone.startedAt, updates.startedAt),
    status: updates.status ?? clone.status,
    setupSnapshot: {
      date: updates.setupSnapshot?.date ?? clone.setupSnapshot.date,
      investigators: updates.setupSnapshot?.investigators
        ? cloneInvestigators(updates.setupSnapshot.investigators)
        : cloneInvestigators(clone.setupSnapshot.investigators),
      notes: updates.setupSnapshot?.notes ?? clone.setupSnapshot.notes,
    },
    updatedAt: resolveNow(now),
  }

  if (next.scenarioLogs.length === 0) {
    next.currentRoster = buildSetupRosterSeed(next.setupSnapshot.investigators, 0)
  }

  return next
}

export function appendCampaignScenarioLog(
  run: CampaignRun,
  scenarioLog: NewCampaignScenarioLogInput,
  options?: {
    now?: string | (() => string)
    idFactory?: () => string
  },
): CampaignRun {
  const nextRun = cloneRun(run)
  if (nextRun.campaignType === 'Scenario Pack') {
    if (scenarioLog.scenarioType === 'side_scenario') {
      throw new CampaignRunMutationError(
        'STANDALONE_SIDE_SCENARIO_BLOCKED',
        'Standalone Scenario Packs cannot contain side-scenario logs.',
      )
    }
    if (nextRun.scenarioLogs.length > 0) {
      throw new CampaignRunMutationError(
        'STANDALONE_SCENARIO_APPEND_BLOCKED',
        'Standalone Scenario Packs can record only one scenario result.',
      )
    }
  }
  assertValidScenarioIdentity(nextRun, {
    scenarioName: scenarioLog.scenarioName,
    scenarioType: scenarioLog.scenarioType,
  }, nextRun.scenarioLogs
    .filter(log => log.scenarioType !== 'side_scenario')
    .map(log => log.scenarioName))
  const id = scenarioLog.id ?? options?.idFactory?.() ?? crypto.randomUUID()
  if (nextRun.scenarioLogs.some((log) => log.id === id)) {
    throw new CampaignRunMutationError(
      'CAMPAIGN_SCENARIO_LOG_DUPLICATE_ID',
      'Scenario log id already exists in this campaign run.',
    )
  }

  const nextLog: CampaignScenarioLog = {
    id,
    date: scenarioLog.date,
    scenarioName: scenarioLog.scenarioName.trim(),
    investigators: cloneInvestigators(scenarioLog.investigators),
    sideStories: normalizeStringArray(scenarioLog.sideStories),
    notes: scenarioLog.notes,
    legacySourcePlaythroughId: scenarioLog.legacySourcePlaythroughId,
    scenarioType: scenarioLog.scenarioType,
    resolution: scenarioLog.resolution,
    rosterBefore: scenarioLog.rosterBefore ? cloneRosterEntries(scenarioLog.rosterBefore) : undefined,
    investigatorOutcomes: scenarioLog.investigatorOutcomes
      ? cloneOutcomes(scenarioLog.investigatorOutcomes)
      : undefined,
    preScenarioAdjustments: scenarioLog.preScenarioAdjustments
      ? cloneAdjustments(scenarioLog.preScenarioAdjustments)
      : undefined,
    rosterChanges: scenarioLog.rosterChanges ? cloneRosterChanges(scenarioLog.rosterChanges) : undefined,
    rosterAfter: scenarioLog.rosterAfter ? cloneRosterEntries(scenarioLog.rosterAfter) : undefined,
  }

  const scenarioIndex = nextRun.scenarioLogs.length
  const rosterSeed = deriveRosterUpToScenarioIndex(nextRun, scenarioIndex)
  if (!nextLog.rosterBefore) {
    nextLog.rosterBefore = cloneRosterEntries(rosterSeed)
  }

  nextRun.scenarioLogs.push(nextLog)
  nextRun.currentRoster = deriveScenarioRosterAfter(nextLog, scenarioIndex, rosterSeed)
  nextRun.version = 2
  nextRun.updatedAt = resolveNow(options?.now)
  return nextRun
}

export function editCampaignScenarioLog(
  run: CampaignRun,
  scenarioLogId: string,
  updates: CampaignScenarioLogEditInput,
  now?: string | (() => string),
): CampaignRun {
  const nextRun = cloneRun(run)
  if (nextRun.campaignType === 'Scenario Pack' && updates.scenarioType === 'side_scenario') {
    throw new CampaignRunMutationError(
      'STANDALONE_SIDE_SCENARIO_BLOCKED',
      'Standalone Scenario Packs cannot contain side-scenario logs.',
    )
  }
  const index = nextRun.scenarioLogs.findIndex((log) => log.id === scenarioLogId)
  if (index === -1) {
    throw new CampaignRunMutationError(
      'CAMPAIGN_SCENARIO_LOG_NOT_FOUND',
      'Scenario log not found in this campaign run.',
    )
  }

  const isLatest = index === nextRun.scenarioLogs.length - 1
  if (!isLatest && isScenarioStatefulEdit(updates)) {
    throw new CampaignRunMutationError(
      'CAMPAIGN_SCENARIO_LOG_STATEFUL_EDIT_BLOCKED',
      `Only ${COSMETIC_SCENARIO_KEYS.join(', ')} can be edited on non-latest scenario logs.`,
    )
  }

  const current = nextRun.scenarioLogs[index]
  const normalizedUpdates = updates.scenarioName === undefined
    ? updates
    : { ...updates, scenarioName: updates.scenarioName.trim() }
  if (updates.scenarioName !== undefined || updates.scenarioType !== undefined) {
    assertValidScenarioIdentity(nextRun, {
      scenarioName: normalizedUpdates.scenarioName ?? current.scenarioName,
      scenarioType: normalizedUpdates.scenarioType ?? current.scenarioType,
    }, nextRun.scenarioLogs
      .slice(0, index)
      .filter(log => log.scenarioType !== 'side_scenario')
      .map(log => log.scenarioName))
  }
  nextRun.scenarioLogs[index] = mergeScenarioLogEdit(current, normalizedUpdates)
  nextRun.version = 2
  nextRun.updatedAt = resolveNow(now)

  if (isLatest) {
    const rosterSeed = deriveRosterUpToScenarioIndex(nextRun, index)
    if (!nextRun.scenarioLogs[index].rosterBefore) {
      nextRun.scenarioLogs[index].rosterBefore = cloneRosterEntries(rosterSeed)
    }
    nextRun.currentRoster = deriveScenarioRosterAfter(nextRun.scenarioLogs[index], index, rosterSeed)
  }

  return nextRun
}

export function deleteCampaignScenarioLog(
  run: CampaignRun,
  scenarioLogId: string,
  now?: string | (() => string),
): CampaignRun {
  const nextRun = cloneRun(run)
  const index = nextRun.scenarioLogs.findIndex((log) => log.id === scenarioLogId)
  if (index === -1) {
    throw new CampaignRunMutationError(
      'CAMPAIGN_SCENARIO_LOG_NOT_FOUND',
      'Scenario log not found in this campaign run.',
    )
  }

  const isLatest = index === nextRun.scenarioLogs.length - 1
  if (!isLatest) {
    throw new CampaignRunMutationError(
      'CAMPAIGN_SCENARIO_LOG_DELETE_BLOCKED',
      'Deleting a non-latest scenario log is blocked to prevent historical corruption.',
    )
  }

  nextRun.scenarioLogs.splice(index, 1)
  nextRun.currentRoster = deriveRosterUpToScenarioIndex(nextRun, nextRun.scenarioLogs.length)
  nextRun.version = 2
  nextRun.updatedAt = resolveNow(now)
  return nextRun
}

export function buildFlattenedScenarioLogId(campaignRunId: string, scenarioLogId: string): string {
  return `campaign-run:${campaignRunId}:scenario:${scenarioLogId}`
}

export function shouldSuppressPromotedPlaythrough(
  playthrough: Playthrough,
  campaignRunIds: ReadonlySet<string>,
): boolean {
  const promotedRunId = playthrough.promotedToCampaignRunId?.trim()
  if (!promotedRunId) return false
  return campaignRunIds.has(promotedRunId)
}

function collectCampaignCountRoots(
  playthroughs: Playthrough[],
  campaignRuns: CampaignRun[],
): CampaignCountRoot[] {
  const campaignRunIds = new Set(campaignRuns.map((campaignRun) => campaignRun.id))
  const runRoots: CampaignCountRoot[] = campaignRuns.map((campaignRun) => ({
    source: 'campaign-run',
    runId: campaignRun.id,
    campaignName: campaignRun.campaignName,
    campaignSet: campaignRun.campaignSet,
    campaignType: campaignRun.campaignType,
    campaignLineageId: resolveCampaignLineageId(campaignRun),
  }))
  const unsuppressedLegacyRoots: CampaignCountRoot[] = playthroughs
    .filter((playthrough) => !shouldSuppressPromotedPlaythrough(playthrough, campaignRunIds))
    .map((playthrough) => ({
      source: 'playthrough',
      playthroughId: playthrough.id,
      campaignName: playthrough.campaignName,
      campaignSet: playthrough.campaignSet,
      campaignType: playthrough.campaignType,
      campaignLineageId: resolveCampaignLineageId(playthrough),
    }))

  return [...runRoots, ...unsuppressedLegacyRoots]
}

function buildCompletionBreakdown(roots: CampaignCountRoot[]): CompletionBreakdown {
  const breakdown: CompletionBreakdown = {
    fullCampaigns: 0,
    smallCampaigns: 0,
    scenarioPacks: 0,
    fanMade: 0,
  }
  for (const root of roots) {
    switch (root.campaignType) {
      case 'Full Campaign':
        breakdown.fullCampaigns++
        break
      case 'Small Campaign':
        breakdown.smallCampaigns++
        break
      case 'Scenario Pack':
        breakdown.scenarioPacks++
        break
      case 'Fan-Made':
        breakdown.fanMade++
        break
    }
  }
  return breakdown
}

export function computeCampaignCountSummary(
  playthroughs: Playthrough[],
  campaignRuns: CampaignRun[],
): CampaignCountSummary {
  const roots = collectCampaignCountRoots(playthroughs, campaignRuns)
  const uniqueFamilies = new Set(roots.map((root) => root.campaignLineageId))
  return {
    roots,
    campaignRunsPlayedCount: roots.length,
    uniqueCampaignFamilyCount: uniqueFamilies.size,
    breakdown: buildCompletionBreakdown(roots),
  }
}

export function flattenGameLogs(input: FlattenGameLogsInput): FlattenedGameLog[] {
  const campaignRunIds = new Set(input.campaignRuns.map((campaignRun) => campaignRun.id))
  const standaloneRows = input.playthroughs
    .filter((playthrough) => !shouldSuppressPromotedPlaythrough(playthrough, campaignRunIds))
    .map((playthrough) => ({
      ...playthrough,
      sourceKind: 'playthrough' as const,
      sourcePlaythroughId: playthrough.id,
    }))

  const scenarioRows: FlattenedGameLog[] = []
  for (const campaignRun of input.campaignRuns) {
    for (const scenarioLog of campaignRun.scenarioLogs) {
      scenarioRows.push({
        id: buildFlattenedScenarioLogId(campaignRun.id, scenarioLog.id),
        date: scenarioLog.date,
        campaignName: campaignRun.campaignName,
        campaignSet: campaignRun.campaignSet,
        campaignType: campaignRun.campaignType,
        campaignLineageId: campaignRun.campaignLineageId,
        customCampaignName: campaignRun.customCampaignName,
        scenarioName: scenarioLog.scenarioName,
        scenarioType: scenarioLog.scenarioType,
        sideStories: scenarioLog.sideStories ? [...scenarioLog.sideStories] : undefined,
        investigators: cloneInvestigators(scenarioLog.investigators),
        notes: scenarioLog.notes,
        sourceKind: 'campaign-run-scenario',
        campaignRunId: campaignRun.id,
        sourcePlaythroughId: scenarioLog.legacySourcePlaythroughId,
        sourceCampaignScenarioLogId: scenarioLog.id,
      })
    }
  }

  return [...standaloneRows, ...scenarioRows]
}

export interface LegacyGroupScenarioOutcome {
  xpEarned?: number
  victoryDisplayTotal?: number
  xpBonusPenalty?: number
  physicalTrauma?: number
  mentalTrauma?: number
}

function readLegacyNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function readLegacyFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function getLegacyGroupScenarioOutcome(
  scenarioLog: CampaignScenarioLog,
): LegacyGroupScenarioOutcome | null {
  const legacy = scenarioLog as CampaignScenarioLog & Record<string, unknown>
  const outcome: LegacyGroupScenarioOutcome = {
    xpEarned: readLegacyNonNegativeNumber(legacy.xpEarned),
    victoryDisplayTotal: readLegacyNonNegativeNumber(legacy.victoryDisplayTotal),
    xpBonusPenalty: readLegacyFiniteNumber(legacy.xpBonusPenalty),
    physicalTrauma: readLegacyNonNegativeNumber(
      legacy.physicalTrauma ?? legacy.traumaGainedPhysical,
    ),
    mentalTrauma: readLegacyNonNegativeNumber(
      legacy.mentalTrauma ?? legacy.traumaGainedMental,
    ),
  }

  return Object.values(outcome).some((value) => value !== undefined) ? outcome : null
}

function mapEndReasonToSummaryState(reason: CampaignScenarioRosterEntry['endReason']): CampaignRosterSummaryInvestigatorState | null {
  if (reason === 'killed') return 'killed'
  if (reason === 'driven_insane') return 'driven_insane'
  if (reason === 'devoured') return 'devoured'
  return null
}

function mapOutcomeToSummaryState(status: CampaignScenarioInvestigatorOutcome['status'] | undefined): CampaignRosterSummaryInvestigatorState | null {
  if (status === 'killed') return 'killed'
  if (status === 'driven_insane') return 'driven_insane'
  if (status === 'devoured') return 'devoured'
  return null
}

function isActiveContinuationSlot(
  entry: Pick<CampaignScenarioRosterEntry, 'seatStatus' | 'endedAtScenarioIndex' | 'endReason'>,
): boolean {
  if (entry.seatStatus === 'active') return true
  if (entry.seatStatus === 'left' || entry.seatStatus === 'eliminated') return false
  return entry.endedAtScenarioIndex === undefined && entry.endReason === undefined
}

function buildRosterSummaryIdentityKey(input: {
  slotId?: string
  investigator: InvestigatorAssignment
}): string {
  if (input.slotId?.trim()) return `slot:${input.slotId.trim()}`
  if (input.investigator.investigatorId?.trim()) {
    return `investigator-id:${input.investigator.investigatorId.trim().toLocaleLowerCase()}`
  }
  return `fallback:${normalizeInvestigatorIdentity(input.investigator)}`
}

interface MutableSummaryInvestigator {
  key: string
  investigatorName: string
  investigatorId?: string
  chapter?: 1 | 2
  archetype: InvestigatorAssignment['archetype']
  firstUsedScenarioIndex: number
  hasRichEvidence: boolean
  terminalState?: CampaignRosterSummaryInvestigatorState
  isCurrent: boolean
  hasTallyEvidence: boolean
  xpTotal: number
  xpSpent: number
  physicalTrauma: number
  mentalTrauma: number
}

interface MutableSummaryPlayer {
  playerKey: string
  playerName: string
  keySource: 'seat-id' | 'normalized-player-name'
  firstSeenScenarioIndex: number
  investigators: Map<string, MutableSummaryInvestigator>
}

export function deriveCampaignRunRosterSummary(
  campaignRun: CampaignRun,
): CampaignRosterSummaryPlayerItem[] {
  const players = new Map<string, MutableSummaryPlayer>()
  const ensurePlayer = (
    playerKey: string,
    keySource: 'seat-id' | 'normalized-player-name',
    playerName: string,
    scenarioIndex: number,
  ): MutableSummaryPlayer => {
    const existing = players.get(playerKey)
    if (existing) {
      if (!existing.playerName.trim() && playerName.trim()) {
        existing.playerName = playerName
      }
      existing.firstSeenScenarioIndex = Math.min(existing.firstSeenScenarioIndex, scenarioIndex)
      return existing
    }
    const created: MutableSummaryPlayer = {
      playerKey,
      playerName,
      keySource,
      firstSeenScenarioIndex: scenarioIndex,
      investigators: new Map(),
    }
    players.set(playerKey, created)
    return created
  }

  const upsertInvestigator = (input: {
    playerName: string
    seatId?: string
    slotId?: string
    investigator: InvestigatorAssignment
    scenarioIndex: number
    hasRichEvidence: boolean
    seatStatus?: CampaignScenarioRosterEntry['seatStatus']
    endReason?: CampaignScenarioRosterEntry['endReason']
    outcomeStatus?: CampaignScenarioInvestigatorOutcome['status']
    tallies?: Pick<CampaignScenarioRosterEntry, 'xpTotal' | 'xpSpent' | 'physicalTrauma' | 'mentalTrauma'>
  }) => {
    const normalizedPlayer = normalizePlayerName(input.playerName || 'unknown-player')
    const hasSeatId = Boolean(input.seatId?.trim())
    const playerKey = hasSeatId
      ? `seat:${input.seatId!.trim()}`
      : `player:${normalizedPlayer || 'unknown-player'}`
    const player = ensurePlayer(
      playerKey,
      hasSeatId ? 'seat-id' : 'normalized-player-name',
      input.playerName,
      input.scenarioIndex,
    )
    const investigatorKey = buildRosterSummaryIdentityKey({
      slotId: input.slotId,
      investigator: input.investigator,
    })
    const existing = player.investigators.get(investigatorKey)
    if (!existing) {
      player.investigators.set(investigatorKey, {
        key: investigatorKey,
        investigatorName: input.investigator.investigatorName,
        investigatorId: input.investigator.investigatorId,
        chapter: input.investigator.chapter,
        archetype: input.investigator.archetype,
        firstUsedScenarioIndex: input.scenarioIndex,
        hasRichEvidence: input.hasRichEvidence,
        isCurrent: false,
        hasTallyEvidence: false,
        xpTotal: 0,
        xpSpent: 0,
        physicalTrauma: 0,
        mentalTrauma: 0,
      })
    } else {
      existing.firstUsedScenarioIndex = Math.min(existing.firstUsedScenarioIndex, input.scenarioIndex)
      existing.hasRichEvidence = existing.hasRichEvidence || input.hasRichEvidence
      if (!existing.investigatorId && input.investigator.investigatorId) {
        existing.investigatorId = input.investigator.investigatorId
      }
      if (!existing.chapter && input.investigator.chapter) {
        existing.chapter = input.investigator.chapter
      }
    }

    const item = player.investigators.get(investigatorKey)!
    if (input.tallies) {
      item.hasTallyEvidence = true
      item.xpTotal = input.tallies.xpTotal
      item.xpSpent = input.tallies.xpSpent
      item.physicalTrauma = input.tallies.physicalTrauma
      item.mentalTrauma = input.tallies.mentalTrauma
    }
    const terminalFromEndReason = mapEndReasonToSummaryState(input.endReason)
    if (terminalFromEndReason) {
      item.terminalState = terminalFromEndReason
    }
    const terminalFromOutcome = mapOutcomeToSummaryState(input.outcomeStatus)
    if (terminalFromOutcome) {
      item.terminalState = terminalFromOutcome
    }
  }

  if (campaignRun.scenarioLogs.length === 0) {
    const setupCurrentRoster = buildSetupRosterSeed(campaignRun.setupSnapshot.investigators, 0)
    for (const entry of setupCurrentRoster) {
      upsertInvestigator({
        playerName: entry.playerName,
        seatId: entry.seatId,
        slotId: entry.slotId,
        investigator: entry.investigator,
        scenarioIndex: 0,
        hasRichEvidence: true,
        tallies: entry,
      })
    }
  } else {
    campaignRun.scenarioLogs.forEach((scenarioLog, scenarioIndex) => {
      const sawRosterBefore = Array.isArray(scenarioLog.rosterBefore) && scenarioLog.rosterBefore.length > 0
      const sawRosterAfter = Array.isArray(scenarioLog.rosterAfter) && scenarioLog.rosterAfter.length > 0

      if (sawRosterBefore) {
        for (const entry of scenarioLog.rosterBefore!) {
          upsertInvestigator({
            playerName: entry.playerName,
            seatId: entry.seatId,
            slotId: entry.slotId,
            investigator: entry.investigator,
            scenarioIndex,
            hasRichEvidence: true,
            tallies: entry,
          })
        }
      }

      if (sawRosterAfter) {
        for (const entry of scenarioLog.rosterAfter!) {
          upsertInvestigator({
            playerName: entry.playerName,
            seatId: entry.seatId,
            slotId: entry.slotId,
            investigator: entry.investigator,
            scenarioIndex,
            hasRichEvidence: true,
            seatStatus: entry.seatStatus,
            endReason: entry.endReason,
            tallies: entry,
          })
        }
      }

      if (!sawRosterBefore && !sawRosterAfter) {
        scenarioLog.investigators.forEach((investigator) => {
          upsertInvestigator({
            playerName: investigator.playerName,
            investigator,
            scenarioIndex,
            hasRichEvidence: false,
          })
        })
      }

      if (scenarioLog.investigatorOutcomes?.length) {
        for (const outcome of scenarioLog.investigatorOutcomes) {
          upsertInvestigator({
            playerName: outcome.playerName,
            seatId: outcome.seatId,
            slotId: outcome.slotId,
            investigator: {
              playerName: outcome.playerName,
              investigatorName: outcome.investigatorName,
              archetype: 'Unknown',
            },
            scenarioIndex,
            hasRichEvidence: true,
            outcomeStatus: outcome.status,
          })
        }
      }
    })
  }

  const fallbackCurrentRoster = campaignRun.scenarioLogs.length > 0
    ? deriveRosterUpToScenarioIndex(campaignRun, campaignRun.scenarioLogs.length)
    : buildSetupRosterSeed(campaignRun.setupSnapshot.investigators, 0)
  const latestCurrentRoster = campaignRun.currentRoster?.length
    ? campaignRun.currentRoster
    : fallbackCurrentRoster
  const latestOutcomeBySlot = new Map<string, CampaignScenarioInvestigatorOutcome['status']>()
  campaignRun.scenarioLogs.forEach((scenarioLog) => {
    scenarioLog.investigatorOutcomes?.forEach((outcome) => {
      latestOutcomeBySlot.set(outcome.slotId, outcome.status)
    })
  })

  for (const entry of latestCurrentRoster) {
    const isScenarioOnlyResignation = (
      entry.seatStatus === 'left' &&
      entry.endReason === undefined &&
      latestOutcomeBySlot.get(entry.slotId) === 'resigned'
    )
    if (!isActiveContinuationSlot(entry) && !isScenarioOnlyResignation) {
      continue
    }
    const normalizedPlayer = normalizePlayerName(entry.playerName || 'unknown-player')
    const seatPlayerKey = entry.seatId?.trim()
      ? `seat:${entry.seatId.trim()}`
      : null
    const fallbackPlayerKey = `player:${normalizedPlayer || 'unknown-player'}`
    const player = (seatPlayerKey ? players.get(seatPlayerKey) : null) ?? players.get(fallbackPlayerKey)
    const investigatorKey = buildRosterSummaryIdentityKey({
      slotId: entry.slotId,
      investigator: entry.investigator,
    })
    const fallbackInvestigatorKey = buildRosterSummaryIdentityKey({
      investigator: entry.investigator,
    })
    const investigator = player?.investigators.get(investigatorKey) ?? player?.investigators.get(fallbackInvestigatorKey)
    if (investigator) {
      investigator.isCurrent = true
      investigator.hasTallyEvidence = true
      investigator.xpTotal = entry.xpTotal
      investigator.xpSpent = entry.xpSpent
      investigator.physicalTrauma = entry.physicalTrauma
      investigator.mentalTrauma = entry.mentalTrauma
    }
  }

  const sortedPlayers = Array.from(players.values())
    .sort((left, right) => left.firstSeenScenarioIndex - right.firstSeenScenarioIndex)

  return sortedPlayers.map((player) => {
    const investigators = Array.from(player.investigators.values())
      .sort((left, right) => {
        if (left.firstUsedScenarioIndex !== right.firstUsedScenarioIndex) {
          return left.firstUsedScenarioIndex - right.firstUsedScenarioIndex
        }
        return left.investigatorName.localeCompare(right.investigatorName)
      })
      .map((investigator): CampaignRosterSummaryInvestigatorItem => {
        let state: CampaignRosterSummaryInvestigatorState
        if (investigator.isCurrent) {
          state = 'current'
        } else if (investigator.terminalState) {
          state = investigator.terminalState
        } else if (investigator.hasRichEvidence) {
          state = 'former'
        } else {
          state = 'unknown_former'
        }

        return {
          key: investigator.key,
          investigatorName: investigator.investigatorName,
          investigatorId: investigator.investigatorId,
          chapter: investigator.chapter,
          archetype: investigator.archetype,
          firstUsedScenarioIndex: investigator.firstUsedScenarioIndex,
          state,
          isCurrent: investigator.isCurrent,
          hasTallyEvidence: investigator.hasTallyEvidence,
          xpTotal: investigator.xpTotal,
          xpSpent: investigator.xpSpent,
          physicalTrauma: investigator.physicalTrauma,
          mentalTrauma: investigator.mentalTrauma,
        }
      })

    return {
      playerKey: player.playerKey,
      playerName: player.playerName,
      keySource: player.keySource,
      investigators,
    }
  })
}
