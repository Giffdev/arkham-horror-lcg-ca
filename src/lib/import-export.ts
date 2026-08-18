import { assertValidNewCampaignRun } from './campaign-runs'
import type { CampaignRun, ExportEnvelopeV2, Playthrough } from './types'
import {
  isCampaignRun,
  isCampaignScenarioAdjustment,
  isCampaignScenarioInvestigatorOutcome,
  isCampaignScenarioResolution,
  isCampaignScenarioRosterChange,
  isCampaignScenarioRosterEntry,
  isCampaignScenarioType,
  isCampaignType,
  isInvestigatorAssignment,
  isPlaythrough,
} from './types'

export interface NormalizedImportPayload {
  version: 1 | 2
  playthroughs: Playthrough[]
  campaignRuns: CampaignRun[]
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const FIRESTORE_RESERVED_ID_PATTERN = /^__.*__$/
const MAX_FIRESTORE_DOCUMENT_ID_BYTES = 1_500
const MAX_FIRESTORE_DOCUMENT_BYTES = 900_000
const MAX_IMPORT_JSON_BYTES = 5 * 1024 * 1024
const MAX_IMPORT_NESTING_DEPTH = 12
const MAX_IMPORT_STRING_BYTES = 100_000
const MAX_IMPORT_OBJECT_KEYS = 128

const INVESTIGATOR_ASSIGNMENT_KEYS = new Set([
  'playerName',
  'investigatorName',
  'investigatorId',
  'chapter',
  'archetype',
  'archetypes',
  'investigatorSet',
  'isUnknown',
  'isCustom',
  'customInvestigatorName',
  'dreamEatersPath',
])

const CAMPAIGN_SCENARIO_RESOLUTION_KEYS = new Set(['type', 'value'])
const CAMPAIGN_SCENARIO_ROSTER_ENTRY_KEYS = new Set([
  'seatId',
  'slotId',
  'playerName',
  'investigator',
  'seatStatus',
  'joinedAtScenarioIndex',
  'startedAtScenarioIndex',
  'endedAtScenarioIndex',
  'endReason',
  'xpTotal',
  'xpSpent',
  'physicalTrauma',
  'mentalTrauma',
])
const CAMPAIGN_SCENARIO_INVESTIGATOR_OUTCOME_KEYS = new Set([
  'seatId',
  'slotId',
  'playerName',
  'investigatorName',
  'status',
  'xpEarned',
  'traumaGainedPhysical',
  'traumaGainedMental',
  'wasLeadInvestigator',
])
const CAMPAIGN_SCENARIO_ADJUSTMENT_KEYS = new Set([
  'type',
  'slotId',
  'amount',
  'note',
])
const CAMPAIGN_SCENARIO_ROSTER_CHANGE_KEYS = new Set([
  'type',
  'seatId',
  'previousSlotId',
  'reason',
  'newEntry',
])
const PLAYTHROUGH_KEYS = new Set([
  'id',
  'date',
  'campaignSet',
  'campaignName',
  'campaignType',
  'campaignLineageId',
  'scenarioName',
  'customCampaignName',
  'sideStories',
  'investigators',
  'notes',
  'scenarioType',
  'resolution',
  'rosterBefore',
  'investigatorOutcomes',
  'preScenarioAdjustments',
  'rosterChanges',
  'rosterAfter',
  'promotedToCampaignRunId',
  'xpEarned',
  'victoryDisplayTotal',
  'xpBonusPenalty',
  'physicalTrauma',
  'traumaGainedPhysical',
  'mentalTrauma',
  'traumaGainedMental',
])
const CAMPAIGN_SCENARIO_LOG_KEYS = new Set([
  'id',
  'date',
  'scenarioName',
  'investigators',
  'sideStories',
  'notes',
  'legacySourcePlaythroughId',
  'scenarioType',
  'resolution',
  'rosterBefore',
  'investigatorOutcomes',
  'preScenarioAdjustments',
  'rosterChanges',
  'rosterAfter',
  'xpEarned',
  'victoryDisplayTotal',
  'xpBonusPenalty',
  'physicalTrauma',
  'mentalTrauma',
])
const CAMPAIGN_RUN_SETUP_KEYS = new Set(['date', 'investigators', 'notes'])
const CAMPAIGN_RUN_KEYS = new Set([
  'id',
  'version',
  'campaignLineageId',
  'campaignName',
  'campaignSet',
  'campaignType',
  'customCampaignName',
  'startedAt',
  'updatedAt',
  'status',
  'sourcePlaythroughId',
  'setupSnapshot',
  'currentRoster',
  'scenarioLogs',
])
const EXPORT_ENVELOPE_KEYS = new Set(['version', 'playthroughs', 'campaignRuns'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function isValidCalendarDate(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false
  const normalized = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(normalized.getTime()) && normalized.toISOString().slice(0, 10) === value
}

function isValidTimestamp(value: string): boolean {
  return value.includes('T') && !Number.isNaN(Date.parse(value))
}

function isValidImportDate(value: string): boolean {
  return isValidCalendarDate(value) || isValidTimestamp(value)
}

function assertNonEmptyString(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`${label} must be a non-empty string.`)
  }
}

function assertPlainRecord(
  value: unknown,
  label: string,
  allowedKeys?: ReadonlySet<string>,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`)
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain JSON object.`)
  }
  if (!allowedKeys) {
    return
  }

  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.has(key))
  if (unknownKeys.length > 0) {
    throw new Error(
      `${label} contains unknown propert${unknownKeys.length === 1 ? 'y' : 'ies'}: ${unknownKeys.join(', ')}.`,
    )
  }
}

function assertImportShapeLimits(value: unknown, label: string, depth = 0): void {
  if (depth > MAX_IMPORT_NESTING_DEPTH) {
    throw new Error(`${label} exceeds the maximum supported nesting depth of ${MAX_IMPORT_NESTING_DEPTH}.`)
  }
  if (value === undefined || value === null || typeof value === 'boolean') return

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} contains a non-finite number.`)
    }
    return
  }

  if (typeof value === 'string') {
    if (utf8ByteLength(value) > MAX_IMPORT_STRING_BYTES) {
      throw new Error(`${label} exceeds the maximum supported string size of ${MAX_IMPORT_STRING_BYTES} bytes.`)
    }
    return
  }

  if (Array.isArray(value)) {
    if (value.some(Array.isArray)) {
      throw new Error(`${label} contains a nested array, which Firestore cannot store.`)
    }
    value.forEach((entry, index) => assertImportShapeLimits(entry, `${label}[${index}]`, depth + 1))
    return
  }

  assertPlainRecord(value, label)
  const keys = Object.keys(value)
  if (keys.length > MAX_IMPORT_OBJECT_KEYS) {
    throw new Error(`${label} exceeds the maximum supported object size of ${MAX_IMPORT_OBJECT_KEYS} properties.`)
  }
  for (const [key, nested] of Object.entries(value)) {
    assertImportShapeLimits(nested, `${label}.${key}`, depth + 1)
  }
}

function assertValidFirestoreDocumentId(id: string, label: string): void {
  if (!id.trim()) {
    throw new Error(`${label} must be a non-empty Firestore document id.`)
  }
  if (id !== id.trim()) {
    throw new Error(`${label} must not include leading or trailing whitespace.`)
  }
  if (id.includes('/')) {
    throw new Error(`${label} must not contain '/'.`)
  }
  if (id === '.' || id === '..') {
    throw new Error(`${label} must not be '.' or '..'.`)
  }
  if (FIRESTORE_RESERVED_ID_PATTERN.test(id)) {
    throw new Error(`${label} uses Firestore's reserved document id format.`)
  }
  if (utf8ByteLength(id) > MAX_FIRESTORE_DOCUMENT_ID_BYTES) {
    throw new Error(`${label} exceeds Firestore's 1,500-byte document id limit.`)
  }
}

function assertValidImportDate(value: string, label: string): void {
  if (!isValidImportDate(value)) {
    throw new Error(`${label} must be a valid ISO timestamp or YYYY-MM-DD date.`)
  }
}

function assertFirestoreCompatibleValue(value: unknown, path: string): void {
  if (value === undefined || value === null) return
  if (typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${path} contains a non-finite number that Firestore cannot store.`)
    }
    return
  }
  if (Array.isArray(value)) {
    if (value.some(Array.isArray)) {
      throw new Error(`${path} contains a nested array, which Firestore cannot store.`)
    }
    value.forEach((entry, index) => assertFirestoreCompatibleValue(entry, `${path}[${index}]`))
    return
  }
  if (!isRecord(value)) {
    throw new Error(`${path} contains a Firestore-incompatible value.`)
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${path} contains a non-plain object that Firestore cannot store.`)
  }
  for (const [key, nested] of Object.entries(value)) {
    assertFirestoreCompatibleValue(nested, `${path}.${key}`)
  }
}

function assertFirestoreDocumentSize(value: unknown, label: string): void {
  const byteLength = utf8ByteLength(JSON.stringify(value))
  if (byteLength > MAX_FIRESTORE_DOCUMENT_BYTES) {
    throw new Error(
      `${label} exceeds Firestore's document size safety limit of ${MAX_FIRESTORE_DOCUMENT_BYTES} bytes.`,
    )
  }
}

function assertStringArray(value: unknown, label: string): void {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`${label} must be an array of strings.`)
  }
}

function assertInvestigatorAssignmentShape(value: unknown, label: string): void {
  assertPlainRecord(value, label, INVESTIGATOR_ASSIGNMENT_KEYS)
  if (!isInvestigatorAssignment(value)) {
    throw new Error(`${label} is not a valid investigator assignment.`)
  }
}

function assertCampaignScenarioResolutionShape(value: unknown, label: string): void {
  assertPlainRecord(value, label, CAMPAIGN_SCENARIO_RESOLUTION_KEYS)
  if (!isCampaignScenarioResolution(value)) {
    throw new Error(`${label} is not a valid scenario resolution.`)
  }
}

function assertCampaignScenarioRosterEntryShape(value: unknown, label: string): void {
  assertPlainRecord(value, label, CAMPAIGN_SCENARIO_ROSTER_ENTRY_KEYS)
  if (isRecord(value) && 'investigator' in value) {
    assertInvestigatorAssignmentShape(value.investigator, `${label}.investigator`)
  }
  if (!isCampaignScenarioRosterEntry(value)) {
    throw new Error(`${label} is not a valid roster entry.`)
  }
}

function assertCampaignScenarioInvestigatorOutcomeShape(value: unknown, label: string): void {
  assertPlainRecord(value, label, CAMPAIGN_SCENARIO_INVESTIGATOR_OUTCOME_KEYS)
  if (!isCampaignScenarioInvestigatorOutcome(value)) {
    throw new Error(`${label} is not a valid investigator outcome.`)
  }
}

function assertCampaignScenarioAdjustmentShape(value: unknown, label: string): void {
  assertPlainRecord(value, label, CAMPAIGN_SCENARIO_ADJUSTMENT_KEYS)
  if (!isCampaignScenarioAdjustment(value)) {
    throw new Error(`${label} is not a valid scenario adjustment.`)
  }
}

function assertCampaignScenarioRosterChangeShape(value: unknown, label: string): void {
  assertPlainRecord(value, label, CAMPAIGN_SCENARIO_ROSTER_CHANGE_KEYS)
  if (isRecord(value) && 'newEntry' in value) {
    assertCampaignScenarioRosterEntryShape(value.newEntry, `${label}.newEntry`)
  }
  if (!isCampaignScenarioRosterChange(value)) {
    throw new Error(`${label} is not a valid roster change.`)
  }
}

function assertLegacyRichScenarioFieldsShape(value: Record<string, unknown>, label: string): void {
  if (value.scenarioType !== undefined && !isCampaignScenarioType(value.scenarioType)) {
    throw new Error(`${label}.scenarioType is invalid.`)
  }
  if (value.resolution !== undefined) {
    assertCampaignScenarioResolutionShape(value.resolution, `${label}.resolution`)
  }
  if (value.rosterBefore !== undefined) {
    if (!Array.isArray(value.rosterBefore)) {
      throw new Error(`${label}.rosterBefore must be an array.`)
    }
    value.rosterBefore.forEach((entry, index) =>
      assertCampaignScenarioRosterEntryShape(entry, `${label}.rosterBefore[${index}]`),
    )
  }
  if (value.investigatorOutcomes !== undefined) {
    if (!Array.isArray(value.investigatorOutcomes)) {
      throw new Error(`${label}.investigatorOutcomes must be an array.`)
    }
    value.investigatorOutcomes.forEach((entry, index) =>
      assertCampaignScenarioInvestigatorOutcomeShape(entry, `${label}.investigatorOutcomes[${index}]`),
    )
  }
  if (value.preScenarioAdjustments !== undefined) {
    if (!Array.isArray(value.preScenarioAdjustments)) {
      throw new Error(`${label}.preScenarioAdjustments must be an array.`)
    }
    value.preScenarioAdjustments.forEach((entry, index) =>
      assertCampaignScenarioAdjustmentShape(entry, `${label}.preScenarioAdjustments[${index}]`),
    )
  }
  if (value.rosterChanges !== undefined) {
    if (!Array.isArray(value.rosterChanges)) {
      throw new Error(`${label}.rosterChanges must be an array.`)
    }
    value.rosterChanges.forEach((entry, index) =>
      assertCampaignScenarioRosterChangeShape(entry, `${label}.rosterChanges[${index}]`),
    )
  }
  if (value.rosterAfter !== undefined) {
    if (!Array.isArray(value.rosterAfter)) {
      throw new Error(`${label}.rosterAfter must be an array.`)
    }
    value.rosterAfter.forEach((entry, index) =>
      assertCampaignScenarioRosterEntryShape(entry, `${label}.rosterAfter[${index}]`),
    )
  }
}

function assertPlaythroughShape(value: unknown, label: string): asserts value is Record<string, unknown> {
  assertPlainRecord(value, label, PLAYTHROUGH_KEYS)
  if (typeof value.id !== 'string') throw new Error(`${label}.id must be a string.`)
  if (typeof value.date !== 'string') throw new Error(`${label}.date must be a string.`)
  if (typeof value.campaignName !== 'string') throw new Error(`${label}.campaignName must be a string.`)
  if (!Array.isArray(value.investigators)) throw new Error(`${label}.investigators must be an array.`)
  value.investigators.forEach((entry, index) =>
    assertInvestigatorAssignmentShape(entry, `${label}.investigators[${index}]`),
  )
  if (value.campaignSet !== undefined && typeof value.campaignSet !== 'string') {
    throw new Error(`${label}.campaignSet must be a string.`)
  }
  if (value.campaignLineageId !== undefined && typeof value.campaignLineageId !== 'string') {
    throw new Error(`${label}.campaignLineageId must be a string.`)
  }
  if (value.campaignType !== undefined && typeof value.campaignType !== 'string') {
    throw new Error(`${label}.campaignType must be a string.`)
  }
  if (value.scenarioName !== undefined && typeof value.scenarioName !== 'string') {
    throw new Error(`${label}.scenarioName must be a string.`)
  }
  if (value.customCampaignName !== undefined && typeof value.customCampaignName !== 'string') {
    throw new Error(`${label}.customCampaignName must be a string.`)
  }
  if (value.sideStories !== undefined) {
    assertStringArray(value.sideStories, `${label}.sideStories`)
  }
  if (value.notes !== undefined && typeof value.notes !== 'string') {
    throw new Error(`${label}.notes must be a string.`)
  }
  if (value.promotedToCampaignRunId !== undefined && typeof value.promotedToCampaignRunId !== 'string') {
    throw new Error(`${label}.promotedToCampaignRunId must be a string.`)
  }
  if (value.xpEarned !== undefined && !isFiniteNumber(value.xpEarned)) {
    throw new Error(`${label}.xpEarned must be a finite number.`)
  }
  if (value.victoryDisplayTotal !== undefined && !isFiniteNumber(value.victoryDisplayTotal)) {
    throw new Error(`${label}.victoryDisplayTotal must be a finite number.`)
  }
  if (value.xpBonusPenalty !== undefined && !isFiniteNumber(value.xpBonusPenalty)) {
    throw new Error(`${label}.xpBonusPenalty must be a finite number.`)
  }
  if (value.physicalTrauma !== undefined && !isFiniteNumber(value.physicalTrauma)) {
    throw new Error(`${label}.physicalTrauma must be a finite number.`)
  }
  if (value.traumaGainedPhysical !== undefined && !isFiniteNumber(value.traumaGainedPhysical)) {
    throw new Error(`${label}.traumaGainedPhysical must be a finite number.`)
  }
  if (value.mentalTrauma !== undefined && !isFiniteNumber(value.mentalTrauma)) {
    throw new Error(`${label}.mentalTrauma must be a finite number.`)
  }
  if (value.traumaGainedMental !== undefined && !isFiniteNumber(value.traumaGainedMental)) {
    throw new Error(`${label}.traumaGainedMental must be a finite number.`)
  }
  assertLegacyRichScenarioFieldsShape(value, label)
}

function assertCampaignScenarioLogShape(value: unknown, label: string): void {
  assertPlainRecord(value, label, CAMPAIGN_SCENARIO_LOG_KEYS)
  if (typeof value.id !== 'string') throw new Error(`${label}.id must be a string.`)
  if (typeof value.date !== 'string') throw new Error(`${label}.date must be a string.`)
  if (typeof value.scenarioName !== 'string') throw new Error(`${label}.scenarioName must be a string.`)
  if (!Array.isArray(value.investigators)) throw new Error(`${label}.investigators must be an array.`)
  value.investigators.forEach((entry, index) =>
    assertInvestigatorAssignmentShape(entry, `${label}.investigators[${index}]`),
  )
  if (value.sideStories !== undefined) {
    assertStringArray(value.sideStories, `${label}.sideStories`)
  }
  if (value.notes !== undefined && typeof value.notes !== 'string') {
    throw new Error(`${label}.notes must be a string.`)
  }
  if (value.legacySourcePlaythroughId !== undefined && typeof value.legacySourcePlaythroughId !== 'string') {
    throw new Error(`${label}.legacySourcePlaythroughId must be a string.`)
  }
  if (!isFiniteNumberOrUndefined(value.xpEarned, `${label}.xpEarned`)) return
  if (!isFiniteNumberOrUndefined(value.victoryDisplayTotal, `${label}.victoryDisplayTotal`)) return
  if (!isFiniteNumberOrUndefined(value.xpBonusPenalty, `${label}.xpBonusPenalty`)) return
  if (!isFiniteNumberOrUndefined(value.physicalTrauma, `${label}.physicalTrauma`)) return
  if (!isFiniteNumberOrUndefined(value.mentalTrauma, `${label}.mentalTrauma`)) return
  assertLegacyRichScenarioFieldsShape(value, label)
}

function isFiniteNumberOrUndefined(value: unknown, label: string): boolean {
  if (value === undefined) return true
  if (!isFiniteNumber(value)) {
    throw new Error(`${label} must be a finite number.`)
  }
  return true
}

function assertCampaignRunShape(value: unknown, label: string): asserts value is CampaignRun {
  assertPlainRecord(value, label, CAMPAIGN_RUN_KEYS)
  if (typeof value.id !== 'string') throw new Error(`${label}.id must be a string.`)
  if (!isRecord(value.setupSnapshot)) throw new Error(`${label}.setupSnapshot must be an object.`)
  assertPlainRecord(value.setupSnapshot, `${label}.setupSnapshot`, CAMPAIGN_RUN_SETUP_KEYS)
  if (typeof value.setupSnapshot.date !== 'string') {
    throw new Error(`${label}.setupSnapshot.date must be a string.`)
  }
  if (!Array.isArray(value.setupSnapshot.investigators)) {
    throw new Error(`${label}.setupSnapshot.investigators must be an array.`)
  }
  value.setupSnapshot.investigators.forEach((entry, index) =>
    assertInvestigatorAssignmentShape(entry, `${label}.setupSnapshot.investigators[${index}]`),
  )
  if (value.setupSnapshot.notes !== undefined && typeof value.setupSnapshot.notes !== 'string') {
    throw new Error(`${label}.setupSnapshot.notes must be a string.`)
  }
  if (value.currentRoster !== undefined) {
    if (!Array.isArray(value.currentRoster)) {
      throw new Error(`${label}.currentRoster must be an array.`)
    }
    value.currentRoster.forEach((entry, index) =>
      assertCampaignScenarioRosterEntryShape(entry, `${label}.currentRoster[${index}]`),
    )
  }
  if (!Array.isArray(value.scenarioLogs)) {
    throw new Error(`${label}.scenarioLogs must be an array.`)
  }
  value.scenarioLogs.forEach((entry, index) =>
    assertCampaignScenarioLogShape(entry, `${label}.scenarioLogs[${index}]`),
  )
  if (!isCampaignRun(value)) {
    throw new Error(`${label} is not a valid campaign run record.`)
  }
}

function assertUniqueIds(ids: string[], kind: 'playthrough' | 'campaign run'): void {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length === 0) return
  const uniqueDuplicates = Array.from(new Set(duplicates)).sort()
  throw new Error(
    `Import contains duplicate ${kind} ids: ${uniqueDuplicates.join(', ')}. ` +
    'Remove the duplicates before retrying the atomic import.',
  )
}

function assertScenarioLogIdsAreUnique(run: CampaignRun, label: string): void {
  const scenarioLogIds = run.scenarioLogs.map((scenarioLog) => scenarioLog.id)
  const duplicates = scenarioLogIds.filter((id, index) => scenarioLogIds.indexOf(id) !== index)
  if (duplicates.length === 0) return
  const uniqueDuplicates = Array.from(new Set(duplicates)).sort()
  throw new Error(`${label} contains duplicate scenario log ids: ${uniqueDuplicates.join(', ')}.`)
}

function assertValidPlaythroughImport(playthrough: Playthrough, label: string): void {
  if (!isPlaythrough(playthrough)) {
    throw new Error(`${label} is not a valid playthrough record.`)
  }
  assertFirestoreCompatibleValue(playthrough, label)
  assertFirestoreDocumentSize(playthrough, label)
  assertValidFirestoreDocumentId(playthrough.id, `${label} id`)
  assertValidImportDate(playthrough.date, `${label} date`)
  assertNonEmptyString(playthrough.campaignName, `${label} campaignName`)
  if (playthrough.scenarioName !== undefined) {
    assertNonEmptyString(playthrough.scenarioName, `${label} scenarioName`)
  }
  if (playthrough.promotedToCampaignRunId !== undefined) {
    assertValidFirestoreDocumentId(playthrough.promotedToCampaignRunId, `${label} promotedToCampaignRunId`)
  }
}

function assertValidCampaignRunImport(run: CampaignRun, label: string): void {
  if (!isCampaignRun(run)) {
    throw new Error(`${label} is not a valid campaign run record.`)
  }
  assertFirestoreCompatibleValue(run, label)
  assertFirestoreDocumentSize(run, label)
  assertValidFirestoreDocumentId(run.id, `${label} id`)
  assertValidImportDate(run.startedAt, `${label} startedAt`)
  assertValidImportDate(run.updatedAt, `${label} updatedAt`)
  assertValidImportDate(run.setupSnapshot.date, `${label} setupSnapshot.date`)
  assertNonEmptyString(run.campaignLineageId, `${label} campaignLineageId`)
  assertNonEmptyString(run.campaignName, `${label} campaignName`)
  if (run.sourcePlaythroughId !== undefined) {
    assertValidFirestoreDocumentId(run.sourcePlaythroughId, `${label} sourcePlaythroughId`)
  }
  for (const [index, scenarioLog] of run.scenarioLogs.entries()) {
    assertNonEmptyString(scenarioLog.id, `${label} scenarioLogs[${index}].id`)
    assertValidImportDate(scenarioLog.date, `${label} scenarioLogs[${index}].date`)
    assertNonEmptyString(scenarioLog.scenarioName, `${label} scenarioLogs[${index}].scenarioName`)
    if (scenarioLog.legacySourcePlaythroughId !== undefined) {
      assertValidFirestoreDocumentId(
        scenarioLog.legacySourcePlaythroughId,
        `${label} scenarioLogs[${index}].legacySourcePlaythroughId`,
      )
    }
  }
  assertScenarioLogIdsAreUnique(run, label)
  assertValidNewCampaignRun(run)
}

function assertCrossTypeIdConsistency(
  playthroughs: Playthrough[],
  campaignRuns: CampaignRun[],
): void {
  const playthroughById = new Map(playthroughs.map((playthrough) => [playthrough.id, playthrough]))
  const invalidOverlaps: string[] = []

  for (const campaignRun of campaignRuns) {
    const overlappingPlaythrough = playthroughById.get(campaignRun.id)
    if (!overlappingPlaythrough) continue

    const isPromotedSourcePair =
      overlappingPlaythrough.promotedToCampaignRunId === campaignRun.id &&
      (campaignRun.sourcePlaythroughId ?? campaignRun.id) === overlappingPlaythrough.id

    if (!isPromotedSourcePair) {
      invalidOverlaps.push(campaignRun.id)
    }
  }

  if (invalidOverlaps.length > 0) {
    const overlapList = Array.from(new Set(invalidOverlaps)).sort()
    throw new Error(
      `Import reuses the same id across playthroughs and campaign runs without a matching promotion pair: ` +
      `${overlapList.join(', ')}.`,
    )
  }
}

export function assertValidNormalizedImportPayload(payload: NormalizedImportPayload): void {
  if (!payload || (payload.version !== 1 && payload.version !== 2)) {
    throw new Error('Import payload must declare version 1 or 2.')
  }
  if (!Array.isArray(payload.playthroughs) || !Array.isArray(payload.campaignRuns)) {
    throw new Error('Import payload must contain playthrough and campaign-run arrays.')
  }

  assertImportShapeLimits(payload, 'Import payload')
  payload.playthroughs.forEach((playthrough, index) => {
    assertPlaythroughShape(playthrough, `Imported playthrough[${index}]`)
    assertValidPlaythroughImport(playthrough, `Imported playthrough[${index}]`)
  })
  payload.campaignRuns.forEach((campaignRun, index) => {
    assertCampaignRunShape(campaignRun, `Imported campaignRuns[${index}]`)
    assertValidCampaignRunImport(campaignRun, `Imported campaignRuns[${index}]`)
  })

  assertUniqueIds(payload.playthroughs.map((playthrough) => playthrough.id), 'playthrough')
  assertUniqueIds(payload.campaignRuns.map((campaignRun) => campaignRun.id), 'campaign run')
  assertCrossTypeIdConsistency(payload.playthroughs, payload.campaignRuns)
}

function normalizePlaythrough(value: unknown, label: string): Playthrough {
  assertPlaythroughShape(value, label)
  const record = value as Record<string, unknown> & {
    id: string
    date: string
    campaignName: string
    investigators: Playthrough['investigators']
    campaignType?: unknown
  }

  const campaignType = isCampaignType(record.campaignType) ? record.campaignType : 'Unknown'
  const normalized: Playthrough = {
    id: record.id,
    date: record.date,
    campaignName: record.campaignName,
    campaignType,
    investigators: record.investigators,
    ...(typeof record.campaignSet === 'string' ? { campaignSet: record.campaignSet } : {}),
    ...(typeof record.campaignLineageId === 'string' ? { campaignLineageId: record.campaignLineageId } : {}),
    ...(typeof record.scenarioName === 'string' ? { scenarioName: record.scenarioName } : {}),
    ...(typeof record.customCampaignName === 'string' ? { customCampaignName: record.customCampaignName } : {}),
    ...(Array.isArray(record.sideStories) ? { sideStories: [...record.sideStories] } : {}),
    ...(typeof record.notes === 'string' ? { notes: record.notes } : {}),
    ...(typeof record.promotedToCampaignRunId === 'string'
      ? { promotedToCampaignRunId: record.promotedToCampaignRunId }
      : {}),
    ...(isFiniteNumber(record.xpEarned) ? { xpEarned: record.xpEarned } : {}),
    ...(isFiniteNumber(record.victoryDisplayTotal) ? { victoryDisplayTotal: record.victoryDisplayTotal } : {}),
    ...(isFiniteNumber(record.xpBonusPenalty) ? { xpBonusPenalty: record.xpBonusPenalty } : {}),
    ...(isFiniteNumber(record.physicalTrauma)
      ? { physicalTrauma: record.physicalTrauma }
      : isFiniteNumber(record.traumaGainedPhysical)
        ? { physicalTrauma: record.traumaGainedPhysical }
        : {}),
    ...(isFiniteNumber(record.mentalTrauma)
      ? { mentalTrauma: record.mentalTrauma }
      : isFiniteNumber(record.traumaGainedMental)
        ? { mentalTrauma: record.traumaGainedMental }
        : {}),
  }

  if (isCampaignScenarioType(record.scenarioType)) normalized.scenarioType = record.scenarioType
  if (record.resolution !== undefined) normalized.resolution = record.resolution as Playthrough['resolution']
  if (Array.isArray(record.rosterBefore)) {
    normalized.rosterBefore = record.rosterBefore as Playthrough['rosterBefore']
  }
  if (Array.isArray(record.investigatorOutcomes)) {
    normalized.investigatorOutcomes = record.investigatorOutcomes as Playthrough['investigatorOutcomes']
  }
  if (Array.isArray(record.preScenarioAdjustments)) {
    normalized.preScenarioAdjustments = record.preScenarioAdjustments as Playthrough['preScenarioAdjustments']
  }
  if (Array.isArray(record.rosterChanges)) {
    normalized.rosterChanges = record.rosterChanges as Playthrough['rosterChanges']
  }
  if (Array.isArray(record.rosterAfter)) {
    normalized.rosterAfter = record.rosterAfter as Playthrough['rosterAfter']
  }

  if (!isPlaythrough(normalized)) {
    throw new Error(`${label} is not a valid playthrough record.`)
  }

  return normalized
}

function parsePlaythroughArray(value: unknown): Playthrough[] {
  if (!Array.isArray(value)) {
    throw new Error('Import payload must be a playthrough array or a versioned export envelope.')
  }

  return value.map((entry, index) => normalizePlaythrough(entry, `Import payload playthrough[${index}]`))
}

function parseCampaignRuns(value: unknown): CampaignRun[] {
  if (!Array.isArray(value)) {
    throw new Error('Export envelope campaignRuns must be an array.')
  }

  return value.map((entry, index) => {
    assertCampaignRunShape(entry, `Export envelope campaignRuns[${index}]`)
    return entry
  })
}

export function normalizeImportPayload(raw: unknown): NormalizedImportPayload {
  assertImportShapeLimits(raw, 'Import payload')

  if (Array.isArray(raw)) {
    const normalized: NormalizedImportPayload = {
      version: 1,
      playthroughs: parsePlaythroughArray(raw),
      campaignRuns: [],
    }
    assertValidNormalizedImportPayload(normalized)
    return normalized
  }

  assertPlainRecord(raw, 'Import payload', EXPORT_ENVELOPE_KEYS)

  if (raw.version !== 2) {
    throw new Error('Unsupported export version. Expected version 2 envelope or legacy v1 array.')
  }

  const normalized: NormalizedImportPayload = {
    version: 2,
    playthroughs: parsePlaythroughArray(raw.playthroughs),
    campaignRuns: parseCampaignRuns(raw.campaignRuns),
  }

  assertValidNormalizedImportPayload(normalized)
  return normalized
}

export function parseImportJson(json: string): NormalizedImportPayload {
  if (utf8ByteLength(json) > MAX_IMPORT_JSON_BYTES) {
    throw new Error(`Import payload exceeds the maximum supported size of ${MAX_IMPORT_JSON_BYTES} bytes.`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Import payload must be valid JSON.')
  }

  return normalizeImportPayload(parsed)
}

export function toExportEnvelopeV2(input: {
  playthroughs: Playthrough[]
  campaignRuns: CampaignRun[]
}): ExportEnvelopeV2 {
  return {
    version: 2,
    playthroughs: [...input.playthroughs],
    campaignRuns: [...input.campaignRuns],
  }
}

export function stringifyExportEnvelopeV2(input: {
  playthroughs: Playthrough[]
  campaignRuns: CampaignRun[]
}): string {
  return JSON.stringify(toExportEnvelopeV2(input), null, 2)
}
