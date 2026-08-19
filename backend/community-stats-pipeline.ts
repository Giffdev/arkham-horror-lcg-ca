import { randomUUID } from 'node:crypto'
import { getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'

import {
  buildEmptyCommunityStats,
  COMMUNITY_STATS_SCHEMA_VERSION,
  computeCommunityStats,
  type CommunityStats,
  type CommunityStatsRefreshState,
  type CommunityStatsSourceInput,
} from '../src/lib/community-stats-core'
import { flattenGameLogs } from '../src/lib/campaign-runs'
import type { CampaignRun, Playthrough } from '../src/lib/types'

export const COMMUNITY_STATS_DOC_PATH = 'community-stats/global'
export const COMMUNITY_STATS_STATE_DOC_PATH = 'community-stats-internal/state'
export const COMMUNITY_STATS_OUTBOX_COLLECTION = 'communityStatsOutbox'
export const COMMUNITY_STATS_SYSTEM_OUTBOX_PARENT_PATH = 'community-stats-system/system'
export const COMMUNITY_STATS_LEASE_MS = 75_000
export const COMMUNITY_STATS_BOOTSTRAP_TIMEOUT_MAX_MS = 15 * 60_000
export const COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS =
  COMMUNITY_STATS_BOOTSTRAP_TIMEOUT_MAX_MS +
  COMMUNITY_STATS_LEASE_MS +
  (10 * 60_000)
export const COMMUNITY_STATS_BOOTSTRAP_MARKER_COMPLETION_CLOCK_SKEW_MS = 5 * 60_000
export const COMMUNITY_STATS_BOOTSTRAP_MARKER_ID_MAX_CHARS = 64
export const COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS = 1_024
export const COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_SERIALIZED_BYTES = 110 * 1_024

const MAX_ERROR_MESSAGE_LENGTH = 512
const MIN_OUTBOX_REQUESTED_AT_MS = Date.UTC(2020, 0, 1)
const MAX_OUTBOX_REQUESTED_AT_MS = Date.UTC(2100, 0, 1)
const MAX_OUTBOX_AFFECTED_DOCUMENTS = 499
const COMMUNITY_STATS_PUBLISH_FIXED_WRITES = 2
const COMMUNITY_STATS_OUTBOX_DELETE_BATCH_LIMIT = 500 - COMMUNITY_STATS_PUBLISH_FIXED_WRITES
const COMMUNITY_STATS_QUARANTINE_FIXED_WRITES = 3
const COMMUNITY_STATS_OUTBOX_QUARANTINE_DELETE_BATCH_LIMIT = 500 - COMMUNITY_STATS_QUARANTINE_FIXED_WRITES
const MAX_PROCESS_PASSES_PER_INVOCATION = 2
const CLIENT_OUTBOX_KEYS = [
  'mutationId',
  'requestedAtMs',
  'requestedBy',
  'reason',
  'affectedDocuments',
] as const
const SYSTEM_OUTBOX_KEYS = [
  'mutationId',
  'requestedAtMs',
  'requestedBy',
  'reason',
  'affectedDocuments',
] as const
const BOOTSTRAP_OUTBOX_KEYS = [
  'mutationId',
  'requestedAtMs',
  'requestedBy',
  'reason',
  'affectedDocuments',
  'bootstrapMarkerId',
] as const
const BOOTSTRAP_MARKER_ID_PATTERN = /^bootstrap-[a-z0-9]+(?:-[a-z0-9]+)*$/
const MANUAL_WAKE_ID_PATTERN = /^manual-[a-z0-9]+(?:-[a-z0-9]+)*$/

type ClientCommunityStatsOutboxReason =
  | 'user-create'
  | 'playthrough-write'
  | 'playthrough-delete'
  | 'campaign-run-write'
  | 'campaign-run-delete'
  | 'campaign-run-promotion'
  | 'campaign-run-restoration'
  | 'import'

type SystemCommunityStatsOutboxReason = 'bootstrap' | 'manual'
type CommunityStatsOutboxReason = ClientCommunityStatsOutboxReason | SystemCommunityStatsOutboxReason
type CommunityStatsOutboxRequestedBy = 'bootstrap' | 'client' | 'system'

type SnapshotLike = {
  exists: boolean | (() => boolean)
  data: () => Record<string, unknown> | undefined
}

type QuerySnapshotLike = {
  size: number
  readTime?: unknown
  docs: Array<{
    id: string
    ref: { path: string }
    data: () => Record<string, unknown>
  }>
}

type CommunityStatsWorkerState = {
  completedBootstrapMarkers?: unknown
  lastCompletedBootstrapMarkerId?: unknown
  leaseId?: unknown
  leaseExpiresAt?: unknown
  pendingBootstrapMarkers?: unknown
  pipelineGeneration?: unknown
}

type BootstrapMarkerState = {
  markerId: string
  requestedAtMs: number
}

type CompletedBootstrapMarkerState = BootstrapMarkerState & {
  completedAtMs: number
}

type NormalizedCompletedBootstrapMarkerState = CompletedBootstrapMarkerState & {
  hasTrustedCompletionTime: boolean
}

type BootstrapMarkerQueueEntry = {
  path: string
  marker: BootstrapMarkerState
}

type CommunityStatsOutboxEntry = {
  id: string
  path: string
  requestedAtMs: number
  requestedBy: CommunityStatsOutboxRequestedBy
  reason: CommunityStatsOutboxReason
  affectedDocuments: number
  bootstrapMarkerId?: string
}

export interface CommunityStatsSourceSnapshot {
  outbox: CommunityStatsOutboxEntry[]
  source: CommunityStatsSourceInput
  snapshotReadAtMs: number
}

export interface CommunityStatsRebuildClaim {
  leaseId: string
  claimedAtMs: number
}

export interface CommunityStatsRebuildResult {
  status: 'published' | 'failed' | 'lease-lost' | 'skipped'
  refreshState?: CommunityStatsRefreshState
  pipelineGeneration?: number
  processedOutboxCount?: number
  pendingOutboxCount?: number
  snapshotReadAtMs?: number
  bootstrapMarkerId?: string
  failureKind?: 'poison' | 'transient'
  shouldRetry?: boolean
  skipReason?: 'lease-active' | 'no-pending-work'
}

class CommunityStatsOutboxSchemaError extends Error {
  invalidEntries: Array<{ path: string; message: string }>

  constructor(invalidEntries: Array<{ path: string; message: string }>) {
    super(
      `Invalid community stats outbox entr${invalidEntries.length === 1 ? 'y' : 'ies'}: ` +
      invalidEntries.map((entry) => `${entry.path} (${entry.message})`).join('; '),
    )
    this.name = 'CommunityStatsOutboxSchemaError'
    this.invalidEntries = invalidEntries
  }
}

class CommunityStatsBootstrapMarkerCapacityError extends Error {
  overflowOutboxPaths: string[]

  constructor(message: string, overflowOutboxPaths: string[] = []) {
    super(message)
    this.name = 'CommunityStatsBootstrapMarkerCapacityError'
    this.overflowOutboxPaths = overflowOutboxPaths
  }
}

function isBootstrapMarkerCapacityError(error: unknown): error is CommunityStatsBootstrapMarkerCapacityError {
  return (
    error instanceof CommunityStatsBootstrapMarkerCapacityError ||
    (
      error instanceof Error &&
      error.name === 'CommunityStatsBootstrapMarkerCapacityError' &&
      Array.isArray((error as { overflowOutboxPaths?: unknown }).overflowOutboxPaths)
    )
  )
}

function getDb() {
  if (!getApps().length) {
    initializeApp()
  }
  return getFirestore()
}

function snapshotExists(snapshot: SnapshotLike): boolean {
  return typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.exists
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function timestampToMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis()
  }
  return null
}

function withDocId<T>(id: string, data: Record<string, unknown>): T {
  return {
    id,
    ...data,
  } as T
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, MAX_ERROR_MESSAGE_LENGTH)
  }
  return String(error).slice(0, MAX_ERROR_MESSAGE_LENGTH)
}

function exactKeySet(label: string, data: Record<string, unknown>, expectedKeys: readonly string[]): void {
  const actualKeys = Object.keys(data).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()
  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new Error(
      `${label} must contain exactly these fields: ${sortedExpectedKeys.join(', ')}.`,
    )
  }
}

function assertOutboxMutationId(value: unknown, expectedId: string, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}.mutationId must be a non-empty string.`)
  }
  if (value !== expectedId) {
    throw new Error(`${label}.mutationId must match the outbox document id.`)
  }
  return value
}

function assertSystemOutboxId(
  value: unknown,
  label: string,
  kind: 'bootstrap' | 'manual',
): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`)
  }

  const pattern = kind === 'bootstrap' ? BOOTSTRAP_MARKER_ID_PATTERN : MANUAL_WAKE_ID_PATTERN
  const prefix = kind === 'bootstrap' ? 'bootstrap-' : 'manual-'
  if (!pattern.test(value)) {
    throw new Error(
      `${label} must start with "${prefix}" and use only lowercase ASCII letters, digits, and single hyphen separators.`,
    )
  }

  const serializedBytes = Buffer.byteLength(value, 'utf8')
  if (value.length > COMMUNITY_STATS_BOOTSTRAP_MARKER_ID_MAX_CHARS) {
    throw new Error(
      `${label} must be at most ${COMMUNITY_STATS_BOOTSTRAP_MARKER_ID_MAX_CHARS} characters long.`,
    )
  }
  if (serializedBytes > COMMUNITY_STATS_BOOTSTRAP_MARKER_ID_MAX_CHARS) {
    throw new Error(
      `${label} must be at most ${COMMUNITY_STATS_BOOTSTRAP_MARKER_ID_MAX_CHARS} UTF-8 bytes long.`,
    )
  }

  return value
}

function assertBootstrapMarkerId(value: unknown, label: string): string {
  return assertSystemOutboxId(value, label, 'bootstrap')
}

function assertOutboxRequestedAtMs(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${label}.requestedAtMs must be a safe integer millisecond timestamp.`)
  }
  if (value < MIN_OUTBOX_REQUESTED_AT_MS || value > MAX_OUTBOX_REQUESTED_AT_MS) {
    throw new Error(
      `${label}.requestedAtMs must be between ${MIN_OUTBOX_REQUESTED_AT_MS} and ${MAX_OUTBOX_REQUESTED_AT_MS}.`,
    )
  }
  return value
}

function assertOutboxAffectedDocuments(
  value: unknown,
  label: string,
  options: { allowZero: boolean },
): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${label}.affectedDocuments must be a safe integer.`)
  }
  const minimum = options.allowZero ? 0 : 1
  if (value < minimum || value > MAX_OUTBOX_AFFECTED_DOCUMENTS) {
    throw new Error(
      `${label}.affectedDocuments must be between ${minimum} and ${MAX_OUTBOX_AFFECTED_DOCUMENTS}.`,
    )
  }
  return value
}

function assertClientOutboxReason(value: unknown, label: string): ClientCommunityStatsOutboxReason {
  if (
    value === 'user-create' ||
    value === 'playthrough-write' ||
    value === 'playthrough-delete' ||
    value === 'campaign-run-write' ||
    value === 'campaign-run-delete' ||
    value === 'campaign-run-promotion' ||
    value === 'campaign-run-restoration' ||
    value === 'import'
  ) {
    return value
  }
  throw new Error(`${label}.reason is not an approved client mutation reason.`)
}

function assertSystemOutboxReason(value: unknown, label: string): SystemCommunityStatsOutboxReason {
  if (value === 'bootstrap' || value === 'manual') {
    return value
  }
  throw new Error(`${label}.reason is not an approved system outbox reason.`)
}

function releaseLeasePatch(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    ...extra,
    leaseExpiresAt: FieldValue.delete(),
    leaseId: FieldValue.delete(),
  }
}

function validateClientOutboxEntry(path: string, id: string, data: Record<string, unknown>): CommunityStatsOutboxEntry {
  const label = `Community stats client outbox entry ${path}`
  exactKeySet(label, data, CLIENT_OUTBOX_KEYS)
  assertOutboxMutationId(data.mutationId, id, label)
  const requestedAtMs = assertOutboxRequestedAtMs(data.requestedAtMs, label)
  const reason = assertClientOutboxReason(data.reason, label)
  const affectedDocuments = assertOutboxAffectedDocuments(data.affectedDocuments, label, { allowZero: false })

  if (data.requestedBy !== 'client') {
    throw new Error(`${label}.requestedBy must be "client".`)
  }

  return {
    id,
    path,
    requestedAtMs,
    requestedBy: 'client',
    reason,
    affectedDocuments,
  }
}

function validateSystemOutboxEntry(path: string, id: string, data: Record<string, unknown>): CommunityStatsOutboxEntry {
  const label = `Community stats system outbox entry ${path}`
  const reason = assertSystemOutboxReason(data.reason, label)
  const expectedKeys = reason === 'bootstrap' ? BOOTSTRAP_OUTBOX_KEYS : SYSTEM_OUTBOX_KEYS
  exactKeySet(label, data, expectedKeys)
  const mutationId = assertOutboxMutationId(data.mutationId, id, label)
  const requestedAtMs = assertOutboxRequestedAtMs(data.requestedAtMs, label)
  const affectedDocuments = assertOutboxAffectedDocuments(data.affectedDocuments, label, { allowZero: true })

  if (reason === 'bootstrap') {
    assertBootstrapMarkerId(mutationId, `${label}.mutationId`)
    if (data.requestedBy !== 'bootstrap') {
      throw new Error(`${label}.requestedBy must be "bootstrap" when reason is bootstrap.`)
    }
    if (affectedDocuments !== 0) {
      throw new Error(`${label}.bootstrap markers must not report affected source documents.`)
    }
    const bootstrapMarkerId = assertBootstrapMarkerId(data.bootstrapMarkerId, `${label}.bootstrapMarkerId`)
    if (bootstrapMarkerId !== id) {
      throw new Error(`${label}.bootstrapMarkerId must exactly match the document id.`)
    }
    return {
      id,
      path,
      requestedAtMs,
      requestedBy: 'bootstrap',
      reason,
      affectedDocuments,
      bootstrapMarkerId,
    }
  }

  assertSystemOutboxId(mutationId, `${label}.mutationId`, 'manual')
  if (data.requestedBy !== 'system') {
    throw new Error(`${label}.requestedBy must be "system" when reason is manual.`)
  }
  if (affectedDocuments !== 0) {
    throw new Error(`${label}.manual system wake events must set affectedDocuments to 0.`)
  }

  return {
    id,
    path,
    requestedAtMs,
    requestedBy: 'system',
    reason,
    affectedDocuments,
  }
}

function compareOutboxEntries(left: CommunityStatsOutboxEntry, right: CommunityStatsOutboxEntry): number {
  const requestedAtDiff = left.requestedAtMs - right.requestedAtMs
  if (requestedAtDiff !== 0) {
    return requestedAtDiff
  }
  return left.path.localeCompare(right.path)
}

function parseOutboxSnapshot(snapshot: QuerySnapshotLike): CommunityStatsOutboxEntry[] {
  const invalidEntries: Array<{ path: string; message: string }> = []
  const outbox = snapshot.docs
    .map((entry) => {
      const path = entry.ref.path
      const data = entry.data()
      try {
        if (!isRecord(data)) {
          throw new Error('Outbox data must be a plain object.')
        }
        const segments = path.split('/')
        if (
          segments.length === 4 &&
          segments[0] === 'users' &&
          segments[2] === COMMUNITY_STATS_OUTBOX_COLLECTION
        ) {
          return validateClientOutboxEntry(path, entry.id, data)
        }
        if (
          segments.length === 4 &&
          segments[0] === 'community-stats-system' &&
          segments[1] === 'system' &&
          segments[2] === COMMUNITY_STATS_OUTBOX_COLLECTION
        ) {
          return validateSystemOutboxEntry(path, entry.id, data)
        }
        throw new Error('Outbox path is not an approved user or system community stats path.')
      } catch (error) {
        invalidEntries.push({
          path,
          message: error instanceof Error ? error.message : String(error),
        })
        return null
      }
    })
    .filter((entry): entry is CommunityStatsOutboxEntry => entry !== null)
    .sort(compareOutboxEntries)

  if (invalidEntries.length > 0) {
    throw new CommunityStatsOutboxSchemaError(invalidEntries)
  }

  return outbox
}

function compareBootstrapMarkers(left: BootstrapMarkerState, right: BootstrapMarkerState): number {
  const requestedAtDiff = left.requestedAtMs - right.requestedAtMs
  if (requestedAtDiff !== 0) {
    return requestedAtDiff
  }
  return left.markerId.localeCompare(right.markerId)
}

function compareBootstrapMarkerQueueEntries(left: BootstrapMarkerQueueEntry, right: BootstrapMarkerQueueEntry): number {
  const markerDiff = compareBootstrapMarkers(left.marker, right.marker)
  if (markerDiff !== 0) {
    return markerDiff
  }
  return left.path.localeCompare(right.path)
}

function assertBootstrapMarkerStateEntry(value: unknown, label: string): BootstrapMarkerState {
  if (!isRecord(value)) {
    throw new Error(`${label} must be a plain object.`)
  }

  return {
    markerId: assertBootstrapMarkerId(value.markerId, `${label}.markerId`),
    requestedAtMs: assertOutboxRequestedAtMs(value.requestedAtMs, label),
  }
}

function mergeBootstrapMarkers(...groups: BootstrapMarkerState[][]): BootstrapMarkerState[] {
  const deduped = new Map<string, BootstrapMarkerState>()

  for (const marker of groups.flat()) {
    const existing = deduped.get(marker.markerId)
    if (!existing || compareBootstrapMarkers(marker, existing) < 0) {
      deduped.set(marker.markerId, marker)
    }
  }

  return Array.from(deduped.values()).sort(compareBootstrapMarkers)
}

function normalizeBootstrapMarkers(value: unknown, label: string): BootstrapMarkerState[] {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`)
  }

  return mergeBootstrapMarkers(
    value.map((entry, index) => assertBootstrapMarkerStateEntry(entry, `${label}[${index}]`)),
  )
}

function pruneCompletedBootstrapMarkers<T extends CompletedBootstrapMarkerState>(
  markers: T[],
  nowMs: number,
): T[] {
  return markers.filter((marker) => (
    nowMs - Math.min(marker.completedAtMs, nowMs) <= COMMUNITY_STATS_BOOTSTRAP_MARKER_RETENTION_MS
  ))
}

function trackedBootstrapMarkerStateBytes(input: {
  completedBootstrapMarkers: CompletedBootstrapMarkerState[]
  pendingBootstrapMarkers: BootstrapMarkerState[]
}): number {
  const reservedCompletedBootstrapMarkers = mergeCompletedBootstrapMarkers(
    input.completedBootstrapMarkers,
    input.pendingBootstrapMarkers.map((marker) => ({
      ...marker,
      completedAtMs: MAX_OUTBOX_REQUESTED_AT_MS,
    })),
  )
  const currentState = {
    ...(input.completedBootstrapMarkers.length > 0
      ? {
          completedBootstrapMarkers: input.completedBootstrapMarkers,
          lastCompletedBootstrapMarkerId: input.completedBootstrapMarkers.at(-1)?.markerId,
        }
      : {}),
    ...(input.pendingBootstrapMarkers.length > 0
      ? { pendingBootstrapMarkers: input.pendingBootstrapMarkers }
      : {}),
  }
  const completedStateBudget = {
    ...(reservedCompletedBootstrapMarkers.length > 0
      ? {
          completedBootstrapMarkers: reservedCompletedBootstrapMarkers,
          lastCompletedBootstrapMarkerId: reservedCompletedBootstrapMarkers.at(-1)?.markerId,
        }
      : {}),
  }

  return Math.max(
    Buffer.byteLength(JSON.stringify(currentState), 'utf8'),
    Buffer.byteLength(JSON.stringify(completedStateBudget), 'utf8'),
  )
}

function assertTrackedBootstrapMarkerStateCapacity(
  input: {
    completedBootstrapMarkers: CompletedBootstrapMarkerState[]
    pendingBootstrapMarkers: BootstrapMarkerState[]
  },
  label: string,
): void {
  const trackedMarkerCount = input.completedBootstrapMarkers.length + input.pendingBootstrapMarkers.length
  if (trackedMarkerCount > COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS) {
    throw new CommunityStatsBootstrapMarkerCapacityError(
      `${label} exceeds the ${COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS}-marker retention cap ` +
      `(${trackedMarkerCount} tracked).`,
    )
  }

  const serializedBytes = trackedBootstrapMarkerStateBytes(input)
  if (serializedBytes > COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_SERIALIZED_BYTES) {
    throw new CommunityStatsBootstrapMarkerCapacityError(
      `${label} exceeds the ${COMMUNITY_STATS_BOOTSTRAP_MARKER_STATE_MAX_SERIALIZED_BYTES}-byte serialized cap ` +
      `(${serializedBytes} bytes).`,
    )
  }
}

function trackedBootstrapMarkerStatePatch(input: {
  completedBootstrapMarkers: CompletedBootstrapMarkerState[]
  pendingBootstrapMarkers: BootstrapMarkerState[]
}): Record<string, unknown> {
  return {
    ...(input.pendingBootstrapMarkers.length > 0
      ? { pendingBootstrapMarkers: input.pendingBootstrapMarkers }
      : { pendingBootstrapMarkers: FieldValue.delete() }),
    ...(input.completedBootstrapMarkers.length > 0
      ? {
          completedBootstrapMarkers: input.completedBootstrapMarkers,
          lastCompletedBootstrapMarkerId: input.completedBootstrapMarkers.at(-1)?.markerId,
        }
      : {
          completedBootstrapMarkers: FieldValue.delete(),
          lastCompletedBootstrapMarkerId: FieldValue.delete(),
        }),
  }
}

function mergeCompletedBootstrapMarkers(
  ...groups: CompletedBootstrapMarkerState[][]
): CompletedBootstrapMarkerState[] {
  const deduped = new Map<string, CompletedBootstrapMarkerState>()

  for (const marker of groups.flat()) {
    const existing = deduped.get(marker.markerId)
    if (!existing) {
      deduped.set(marker.markerId, marker)
      continue
    }

    deduped.set(marker.markerId, {
      markerId: marker.markerId,
      requestedAtMs: Math.min(existing.requestedAtMs, marker.requestedAtMs),
      completedAtMs: Math.min(existing.completedAtMs, marker.completedAtMs),
    })
  }

  return Array.from(deduped.values()).sort(compareBootstrapMarkers)
}

function mergeNormalizedCompletedBootstrapMarkers(
  ...groups: NormalizedCompletedBootstrapMarkerState[][]
): NormalizedCompletedBootstrapMarkerState[] {
  const deduped = new Map<string, NormalizedCompletedBootstrapMarkerState>()

  for (const marker of groups.flat()) {
    const existing = deduped.get(marker.markerId)
    if (!existing) {
      deduped.set(marker.markerId, marker)
      continue
    }

    deduped.set(marker.markerId, {
      markerId: marker.markerId,
      requestedAtMs: Math.min(existing.requestedAtMs, marker.requestedAtMs),
      completedAtMs: Math.min(existing.completedAtMs, marker.completedAtMs),
      hasTrustedCompletionTime: existing.hasTrustedCompletionTime || marker.hasTrustedCompletionTime,
    })
  }

  return Array.from(deduped.values()).sort(compareBootstrapMarkers)
}

function normalizeCompletedBootstrapMarkerCompletedAtMs(
  value: unknown,
  nowMs: number,
): {
  completedAtMs: number
  hasTrustedCompletionTime: boolean
} {
  const completedAtMs = timestampToMillis(value)
  if (completedAtMs === null || !Number.isSafeInteger(completedAtMs) || completedAtMs < MIN_OUTBOX_REQUESTED_AT_MS) {
    return {
      completedAtMs: nowMs,
      hasTrustedCompletionTime: false,
    }
  }

  const maxTrustedCompletionAtMs = nowMs + COMMUNITY_STATS_BOOTSTRAP_MARKER_COMPLETION_CLOCK_SKEW_MS
  if (completedAtMs > maxTrustedCompletionAtMs) {
    return {
      completedAtMs: maxTrustedCompletionAtMs,
      hasTrustedCompletionTime: false,
    }
  }

  return {
    completedAtMs,
    hasTrustedCompletionTime: true,
  }
}

function normalizeCompletedBootstrapMarkers(
  value: unknown,
  label: string,
  nowMs: number,
): NormalizedCompletedBootstrapMarkerState[] {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`)
  }

  return mergeNormalizedCompletedBootstrapMarkers(
    value.map((entry, index) => {
      const normalizedEntry = assertBootstrapMarkerStateEntry(entry, `${label}[${index}]`)
      const completion = normalizeCompletedBootstrapMarkerCompletedAtMs(
        isRecord(entry) ? entry.completedAtMs : undefined,
        nowMs,
      )

      return {
        ...normalizedEntry,
        completedAtMs: completion.completedAtMs,
        hasTrustedCompletionTime: completion.hasTrustedCompletionTime,
      }
    }),
  )
}

function fitCompletedBootstrapMarkersToCapacity(input: {
  completedBootstrapMarkers: NormalizedCompletedBootstrapMarkerState[]
  pendingBootstrapMarkers: BootstrapMarkerState[]
}): CompletedBootstrapMarkerState[] {
  let completedBootstrapMarkers = [...input.completedBootstrapMarkers]

  while (true) {
    const normalizedCompletedBootstrapMarkers = completedBootstrapMarkers.map((marker) => ({
      markerId: marker.markerId,
      requestedAtMs: marker.requestedAtMs,
      completedAtMs: marker.completedAtMs,
    }))

    try {
      assertTrackedBootstrapMarkerStateCapacity({
        completedBootstrapMarkers: normalizedCompletedBootstrapMarkers,
        pendingBootstrapMarkers: input.pendingBootstrapMarkers,
      }, 'Tracked community stats bootstrap marker state')
      return normalizedCompletedBootstrapMarkers
    } catch (error) {
      if (!(error instanceof CommunityStatsBootstrapMarkerCapacityError)) {
        throw error
      }

      const oldestSyntheticMarkerIndex = completedBootstrapMarkers.findIndex((marker) => !marker.hasTrustedCompletionTime)
      if (oldestSyntheticMarkerIndex === -1) {
        throw error
      }

      completedBootstrapMarkers.splice(oldestSyntheticMarkerIndex, 1)
    }
  }
}

function acknowledgeCompletedBootstrapMarkers(input: {
  completedBootstrapMarkers: CompletedBootstrapMarkerState[]
  markersToComplete: BootstrapMarkerState[]
  completedAtMs: number
}): CompletedBootstrapMarkerState[] {
  const existingCompletedBootstrapMarkerIds = new Set(
    input.completedBootstrapMarkers.map((marker) => marker.markerId),
  )

  return mergeCompletedBootstrapMarkers(
    input.completedBootstrapMarkers,
    input.markersToComplete
      .filter((marker) => !existingCompletedBootstrapMarkerIds.has(marker.markerId))
      .map((marker) => ({
        ...marker,
        completedAtMs: input.completedAtMs,
      })),
  )
}

function trackedBootstrapMarkerStateFromWorker(
  state: CommunityStatsWorkerState,
  nowMs: number,
): {
  completedBootstrapMarkers: CompletedBootstrapMarkerState[]
  pendingBootstrapMarkers: BootstrapMarkerState[]
} {
  const normalizedPendingBootstrapMarkers = normalizeBootstrapMarkers(
    state.pendingBootstrapMarkers,
    'Community stats worker state.pendingBootstrapMarkers',
  )
  const completedBootstrapMarkers = fitCompletedBootstrapMarkersToCapacity({
    completedBootstrapMarkers: pruneCompletedBootstrapMarkers(
      normalizeCompletedBootstrapMarkers(
        state.completedBootstrapMarkers,
        'Community stats worker state.completedBootstrapMarkers',
        nowMs,
      ),
      nowMs,
    ),
    pendingBootstrapMarkers: normalizedPendingBootstrapMarkers,
  })
  const completedBootstrapMarkerIds = new Set(completedBootstrapMarkers.map((marker) => marker.markerId))
  const pendingBootstrapMarkers = normalizedPendingBootstrapMarkers
    .filter((marker) => !completedBootstrapMarkerIds.has(marker.markerId))

  assertTrackedBootstrapMarkerStateCapacity({
    completedBootstrapMarkers,
    pendingBootstrapMarkers,
  }, 'Tracked community stats bootstrap marker state')

  return {
    completedBootstrapMarkers,
    pendingBootstrapMarkers,
  }
}

type BootstrapMarkerQueuePlan = {
  completedBootstrapMarkers: CompletedBootstrapMarkerState[]
  pendingBootstrapMarkers: BootstrapMarkerState[]
  acceptedOutboxBootstrapMarkers: BootstrapMarkerQueueEntry[]
  overflowOutboxPaths: string[]
}

function planTrackedBootstrapMarkerQueue(input: {
  nowMs: number
  outbox: CommunityStatsOutboxEntry[]
  state: CommunityStatsWorkerState
}): BootstrapMarkerQueuePlan {
  const {
    completedBootstrapMarkers,
    pendingBootstrapMarkers,
  } = trackedBootstrapMarkerStateFromWorker(input.state, input.nowMs)
  const acceptedOutboxBootstrapMarkers: BootstrapMarkerQueueEntry[] = []
  const overflowOutboxPaths: string[] = []
  const occupiedMarkerIds = new Set<string>([
    ...completedBootstrapMarkers.map((marker) => marker.markerId),
    ...pendingBootstrapMarkers.map((marker) => marker.markerId),
  ])

  for (const outboxMarker of trackedBootstrapMarkerQueueEntries(input.outbox)) {
    if (occupiedMarkerIds.has(outboxMarker.marker.markerId)) {
      overflowOutboxPaths.push(outboxMarker.path)
      continue
    }
    const candidatePendingBootstrapMarkers = mergeBootstrapMarkers(
      pendingBootstrapMarkers,
      acceptedOutboxBootstrapMarkers.map((entry) => entry.marker),
      [outboxMarker.marker],
    )
    try {
      assertTrackedBootstrapMarkerStateCapacity({
        completedBootstrapMarkers,
        pendingBootstrapMarkers: candidatePendingBootstrapMarkers,
      }, 'Tracked community stats bootstrap marker state')
      acceptedOutboxBootstrapMarkers.push(outboxMarker)
      occupiedMarkerIds.add(outboxMarker.marker.markerId)
    } catch (error) {
      if (error instanceof CommunityStatsBootstrapMarkerCapacityError) {
        overflowOutboxPaths.push(outboxMarker.path)
        continue
      }
      throw error
    }
  }

  return {
    completedBootstrapMarkers,
    pendingBootstrapMarkers,
    acceptedOutboxBootstrapMarkers,
    overflowOutboxPaths,
  }
}

function trackedBootstrapMarkerQueueEntries(outbox: CommunityStatsOutboxEntry[]): BootstrapMarkerQueueEntry[] {
  const deduped = new Map<string, BootstrapMarkerQueueEntry>()

  for (const entry of outbox) {
    if (
      entry.requestedBy !== 'bootstrap' ||
      entry.reason !== 'bootstrap' ||
      typeof entry.bootstrapMarkerId !== 'string'
    ) {
      continue
    }

    const markerEntry: BootstrapMarkerQueueEntry = {
      path: entry.path,
      marker: {
        markerId: entry.bootstrapMarkerId,
        requestedAtMs: entry.requestedAtMs,
      },
    }
    const existing = deduped.get(markerEntry.marker.markerId)
    if (!existing || compareBootstrapMarkers(markerEntry.marker, existing.marker) < 0) {
      deduped.set(markerEntry.marker.markerId, markerEntry)
    }
  }

  return Array.from(deduped.values()).sort(compareBootstrapMarkerQueueEntries)
}

function latestBootstrapMarkerId(markers: BootstrapMarkerState[]): string | undefined {
  return markers.at(-1)?.markerId
}

function buildPublishedCommunityStats(input: {
  source: CommunityStatsSourceInput
  nowMs: number
  snapshotReadAtMs: number
  pipelineGeneration: number
  refreshState: CommunityStatsRefreshState
}): CommunityStats {
  const payload = {
    ...input.source,
    generatedAt: input.nowMs,
    snapshotReadAt: input.snapshotReadAtMs,
    pipelineGeneration: input.pipelineGeneration,
    sourceGeneration: input.pipelineGeneration,
    schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION,
    refreshState: input.refreshState,
  }

  return computeCommunityStats(payload) ?? buildEmptyCommunityStats({
    userCount: input.source.userCount,
    generatedAt: input.nowMs,
    snapshotReadAt: input.snapshotReadAtMs,
    pipelineGeneration: input.pipelineGeneration,
    sourceGeneration: input.pipelineGeneration,
    schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION,
    refreshState: input.refreshState,
  })
}

export async function queueCommunityStatsRebuild(metadata?: {
  ownerUid?: string
  mutationId?: string
  requestedBy?: 'bootstrap' | 'system'
  reason?: CommunityStatsOutboxReason
  affectedDocuments?: number
  bootstrapMarkerId?: string
}): Promise<string> {
  const requestedAtMs = Date.now()
  const requestedBy = metadata?.requestedBy ?? 'system'
  const mutationId = metadata?.mutationId ?? (
    metadata?.ownerUid
      ? randomUUID()
      : requestedBy === 'bootstrap'
        ? `bootstrap-${requestedAtMs}-${randomUUID()}`
        : `manual-${randomUUID()}`
  )

  if (metadata?.ownerUid) {
    const reason = assertClientOutboxReason(metadata.reason ?? 'playthrough-write', 'queueCommunityStatsRebuild')
    const affectedDocuments = assertOutboxAffectedDocuments(
      metadata.affectedDocuments ?? 1,
      'queueCommunityStatsRebuild',
      { allowZero: false },
    )

    await getDb().doc(`users/${metadata.ownerUid}/${COMMUNITY_STATS_OUTBOX_COLLECTION}/${mutationId}`).set({
      mutationId,
      requestedAtMs,
      requestedBy: 'client',
      reason,
      affectedDocuments,
    })
    return mutationId
  }

  if (requestedBy === 'bootstrap') {
    const bootstrapMarkerId = metadata?.bootstrapMarkerId ?? mutationId
    if (bootstrapMarkerId !== mutationId) {
      throw new Error('Bootstrap outbox markers must use a bootstrapMarkerId that matches the document id.')
    }
    assertBootstrapMarkerId(mutationId, 'queueCommunityStatsRebuild.mutationId')
    assertBootstrapMarkerId(bootstrapMarkerId, 'queueCommunityStatsRebuild.bootstrapMarkerId')
    const reason = assertSystemOutboxReason(metadata?.reason ?? 'bootstrap', 'queueCommunityStatsRebuild')
    if (reason !== 'bootstrap') {
      throw new Error('Bootstrap outbox markers must use reason "bootstrap".')
    }

    const db = getDb()
    const stateRef = db.doc(COMMUNITY_STATS_STATE_DOC_PATH)
    const outboxQuery = db.collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION)
    const markerPath = `${COMMUNITY_STATS_SYSTEM_OUTBOX_PARENT_PATH}/${COMMUNITY_STATS_OUTBOX_COLLECTION}/${mutationId}`

    const queueAttempt = await db.runTransaction(async (transaction) => {
      const [stateSnapshot, currentOutboxSnapshot] = await Promise.all([
        transaction.get(stateRef) as Promise<SnapshotLike>,
        transaction.get(outboxQuery) as Promise<QuerySnapshotLike>,
      ])
      const state = (stateSnapshot.data() ?? {}) as CommunityStatsWorkerState
      const currentOutbox = parseOutboxSnapshot(currentOutboxSnapshot)
      const capacityPlan = planTrackedBootstrapMarkerQueue({
        nowMs: requestedAtMs,
        outbox: [
          ...currentOutbox,
          {
            id: mutationId,
            path: markerPath,
            requestedAtMs,
            requestedBy: 'bootstrap',
            reason,
            affectedDocuments: 0,
            bootstrapMarkerId,
          },
        ],
        state,
      })

      if (
        state.completedBootstrapMarkers !== undefined ||
        state.pendingBootstrapMarkers !== undefined ||
        capacityPlan.completedBootstrapMarkers.length > 0 ||
        capacityPlan.pendingBootstrapMarkers.length > 0
      ) {
        transaction.set(stateRef, trackedBootstrapMarkerStatePatch({
          completedBootstrapMarkers: capacityPlan.completedBootstrapMarkers,
          pendingBootstrapMarkers: capacityPlan.pendingBootstrapMarkers,
        }), { merge: true })
      }

      if (capacityPlan.overflowOutboxPaths.length > 0) {
        return {
          accepted: false as const,
          candidateRejected: capacityPlan.overflowOutboxPaths.includes(markerPath),
          overflowOutboxPaths: capacityPlan.overflowOutboxPaths,
        }
      }

      transaction.set(db.doc(markerPath), {
        mutationId,
        requestedAtMs,
        requestedBy: 'bootstrap',
        reason,
        affectedDocuments: 0,
        bootstrapMarkerId,
      })

      return {
        accepted: true as const,
      }
    })

    if (!queueAttempt.accepted) {
      throw new CommunityStatsBootstrapMarkerCapacityError(
        queueAttempt.candidateRejected
          ? 'Bootstrap marker queue is at capacity; retry after older markers expire or prune.'
          : 'Bootstrap marker queue already contains overflow markers awaiting quarantine.',
        queueAttempt.overflowOutboxPaths,
      )
    }

    return mutationId
  }

  const reason = assertSystemOutboxReason(metadata?.reason ?? 'manual', 'queueCommunityStatsRebuild')
  if (reason !== 'manual') {
    throw new Error('System wake events must use reason "manual".')
  }
  assertSystemOutboxId(mutationId, 'queueCommunityStatsRebuild.mutationId', 'manual')

  await getDb().doc(`${COMMUNITY_STATS_SYSTEM_OUTBOX_PARENT_PATH}/${COMMUNITY_STATS_OUTBOX_COLLECTION}/${mutationId}`).set({
    mutationId,
    requestedAtMs,
    requestedBy: 'system',
    reason,
    affectedDocuments: 0,
  })

  return mutationId
}

type CommunityStatsClaimAttempt =
  | {
      claim: CommunityStatsRebuildClaim
      pendingOutboxCount: number
      skipReason?: never
    }
  | {
      claim: null
      pendingOutboxCount: number
      skipReason: 'lease-active' | 'no-pending-work'
    }

async function claimCommunityStatsRebuildAttempt(
  nowMs = Date.now(),
): Promise<CommunityStatsClaimAttempt> {
  const db = getDb()
  const stateRef = db.doc(COMMUNITY_STATS_STATE_DOC_PATH)
  const aggregateRef = db.doc(COMMUNITY_STATS_DOC_PATH)
  const pendingOutboxQuery = db.collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION).limit(1)

  return await db.runTransaction(async (transaction) => {
    const [stateSnapshot, aggregateSnapshot, pendingOutboxSnapshot] = await Promise.all([
      transaction.get(stateRef) as Promise<SnapshotLike>,
      transaction.get(aggregateRef) as Promise<SnapshotLike>,
      transaction.get(pendingOutboxQuery) as Promise<QuerySnapshotLike>,
    ])

    if (pendingOutboxSnapshot.size === 0) {
      return {
        claim: null,
        pendingOutboxCount: 0,
        skipReason: 'no-pending-work',
      } satisfies CommunityStatsClaimAttempt
    }

    const state = (stateSnapshot.data() ?? {}) as CommunityStatsWorkerState
    const leaseExpiresAt = timestampToMillis(state.leaseExpiresAt)
    if (
      typeof state.leaseId === 'string' &&
      leaseExpiresAt !== null &&
      leaseExpiresAt > nowMs
    ) {
      return {
        claim: null,
        pendingOutboxCount: pendingOutboxSnapshot.size,
        skipReason: 'lease-active',
      } satisfies CommunityStatsClaimAttempt
    }

    const claim: CommunityStatsRebuildClaim = {
      leaseId: randomUUID(),
      claimedAtMs: nowMs,
    }

    transaction.set(stateRef, {
      leaseExpiresAt: Timestamp.fromMillis(nowMs + COMMUNITY_STATS_LEASE_MS),
      leaseId: claim.leaseId,
      lastStartedAt: Timestamp.fromMillis(nowMs),
    }, { merge: true })

    if (snapshotExists(aggregateSnapshot)) {
      const aggregate = aggregateSnapshot.data() as unknown as CommunityStats
      if (aggregate.refreshState !== 'failed') {
        transaction.set(aggregateRef, { refreshState: 'stale' }, { merge: true })
      }
    }

    return {
      claim,
      pendingOutboxCount: pendingOutboxSnapshot.size,
    } satisfies CommunityStatsClaimAttempt
  })
}

export async function claimCommunityStatsRebuild(
  nowMs = Date.now(),
): Promise<CommunityStatsRebuildClaim | null> {
  const attempt = await claimCommunityStatsRebuildAttempt(nowMs)
  return attempt.claim
}

export async function loadCommunityStatsSnapshot(): Promise<CommunityStatsSourceSnapshot> {
  const db = getDb()

  return await db.runTransaction(async (transaction) => {
    const [outboxSnapshot, playthroughSnapshot, campaignRunSnapshot, userSnapshot] = await Promise.all([
      transaction.get(db.collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION)) as Promise<QuerySnapshotLike>,
      transaction.get(db.collectionGroup('playthroughs')) as Promise<QuerySnapshotLike>,
      transaction.get(db.collectionGroup('campaignRuns')) as Promise<QuerySnapshotLike>,
      transaction.get(db.collection('users')) as Promise<QuerySnapshotLike>,
    ])

    const outbox = parseOutboxSnapshot(outboxSnapshot)
    const perUserPlaythroughs = new Map<string, Playthrough[]>()
    const perUserCampaignRuns = new Map<string, CampaignRun[]>()
    const userIds = new Set<string>()

    for (const entry of playthroughSnapshot.docs) {
      const pathParts = entry.ref.path.split('/')
      if (pathParts.length < 2) continue
      const userId = pathParts[1]
      userIds.add(userId)
      const existing = perUserPlaythroughs.get(userId) ?? []
      existing.push(withDocId<Playthrough>(entry.id, entry.data()))
      perUserPlaythroughs.set(userId, existing)
    }

    for (const entry of campaignRunSnapshot.docs) {
      const pathParts = entry.ref.path.split('/')
      if (pathParts.length < 2) continue
      const userId = pathParts[1]
      userIds.add(userId)
      const existing = perUserCampaignRuns.get(userId) ?? []
      existing.push(withDocId<CampaignRun>(entry.id, entry.data()))
      perUserCampaignRuns.set(userId, existing)
    }

    const rootPlaythroughs: Playthrough[] = []
    const campaignRuns: CampaignRun[] = []
    const playthroughs: Playthrough[] = []

    for (const userId of userIds) {
      const userPlaythroughs = perUserPlaythroughs.get(userId) ?? []
      const userCampaignRuns = perUserCampaignRuns.get(userId) ?? []
      rootPlaythroughs.push(...userPlaythroughs)
      campaignRuns.push(...userCampaignRuns)
      playthroughs.push(
        ...flattenGameLogs({
          playthroughs: userPlaythroughs,
          campaignRuns: userCampaignRuns,
        }),
      )
    }

    return {
      outbox,
      source: {
        playthroughs,
        rootPlaythroughs,
        campaignRuns,
        userCount: Math.max(userSnapshot.size, userIds.size),
      },
      snapshotReadAtMs:
        timestampToMillis(outboxSnapshot.readTime) ??
        timestampToMillis(playthroughSnapshot.readTime) ??
        timestampToMillis(campaignRunSnapshot.readTime) ??
        timestampToMillis(userSnapshot.readTime) ??
        Date.now(),
    }
  }, { readOnly: true })
}

async function markCommunityStatsRebuildFailed(
  claim: CommunityStatsRebuildClaim,
  error: unknown,
  nowMs: number,
): Promise<void> {
  const db = getDb()
  const aggregateRef = db.doc(COMMUNITY_STATS_DOC_PATH)
  const stateRef = db.doc(COMMUNITY_STATS_STATE_DOC_PATH)
  const pendingOutboxQuery = db.collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION)
  const errorMessage = serializeError(error)

  await db.runTransaction(async (transaction) => {
    const [stateSnapshot, aggregateSnapshot, pendingOutboxSnapshot] = await Promise.all([
      transaction.get(stateRef) as Promise<SnapshotLike>,
      transaction.get(aggregateRef) as Promise<SnapshotLike>,
      transaction.get(pendingOutboxQuery) as Promise<QuerySnapshotLike>,
    ])
    const state = (stateSnapshot.data() ?? {}) as CommunityStatsWorkerState

    if (state.leaseId !== claim.leaseId) {
      return
    }

    const failedGeneration = numeric(state.pipelineGeneration) + 1
    transaction.set(stateRef, releaseLeasePatch({
      lastErrorAt: Timestamp.fromMillis(nowMs),
      lastErrorMessage: errorMessage,
      lastFailedGeneration: failedGeneration,
      pendingOutboxCount: pendingOutboxSnapshot.size,
    }), { merge: true })

    if (snapshotExists(aggregateSnapshot)) {
      transaction.set(aggregateRef, {
        lastFailedGeneration: failedGeneration,
        lastFailureAt: nowMs,
        refreshState: 'failed',
      }, { merge: true })
    }
  })
}

async function quarantineOutboxEntries(
  claim: CommunityStatsRebuildClaim,
  input: {
    error: Error
    invalidPaths: string[]
  },
  nowMs: number,
): Promise<CommunityStatsRebuildResult> {
  const db = getDb()
  const aggregateRef = db.doc(COMMUNITY_STATS_DOC_PATH)
  const stateRef = db.doc(COMMUNITY_STATS_STATE_DOC_PATH)
  const pendingOutboxQuery = db.collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION)
  const invalidPaths = Array.from(new Set(input.invalidPaths)).sort()
  const invalidPathsToDelete = invalidPaths.slice(0, COMMUNITY_STATS_OUTBOX_QUARANTINE_DELETE_BATCH_LIMIT)
  const wakeMutationId = `manual-${claim.leaseId}`
  assertSystemOutboxId(wakeMutationId, 'quarantineOutboxEntries.wakeMutationId', 'manual')
  const wakeRef = db.doc(
    `${COMMUNITY_STATS_SYSTEM_OUTBOX_PARENT_PATH}/${COMMUNITY_STATS_OUTBOX_COLLECTION}/${wakeMutationId}`,
  )

  return db.runTransaction(async (transaction) => {
    const [stateSnapshot, aggregateSnapshot, pendingOutboxSnapshot] = await Promise.all([
      transaction.get(stateRef) as Promise<SnapshotLike>,
      transaction.get(aggregateRef) as Promise<SnapshotLike>,
      transaction.get(pendingOutboxQuery) as Promise<QuerySnapshotLike>,
    ])
    const state = (stateSnapshot.data() ?? {}) as CommunityStatsWorkerState

    if (state.leaseId !== claim.leaseId) {
      return { status: 'lease-lost' } satisfies CommunityStatsRebuildResult
    }

    const failedGeneration = numeric(state.pipelineGeneration) + 1
    const wakeAlreadyQueued = pendingOutboxSnapshot.docs.some((entry) => entry.ref.path === wakeRef.path)
    const pendingOutboxCount = Math.max(
      pendingOutboxSnapshot.size - invalidPathsToDelete.length + (wakeAlreadyQueued ? 0 : 1),
      wakeAlreadyQueued ? 0 : 1,
    )

    transaction.set(stateRef, releaseLeasePatch({
      lastErrorAt: Timestamp.fromMillis(nowMs),
      lastErrorMessage: serializeError(input.error),
      lastFailedGeneration: failedGeneration,
      lastQuarantinedOutboxCount: invalidPaths.length,
      lastQuarantinedOutboxPaths: invalidPaths.slice(0, 10),
      pendingOutboxCount,
    }), { merge: true })

    if (snapshotExists(aggregateSnapshot)) {
      transaction.set(aggregateRef, {
        lastFailedGeneration: failedGeneration,
        lastFailureAt: nowMs,
        refreshState: 'stale',
      }, { merge: true })
    }

    for (const path of invalidPathsToDelete) {
      transaction.delete(db.doc(path))
    }

    transaction.set(wakeRef, {
      mutationId: wakeMutationId,
      requestedAtMs: Math.max(nowMs, MIN_OUTBOX_REQUESTED_AT_MS),
      requestedBy: 'system',
      reason: 'manual',
      affectedDocuments: 0,
    })

    return {
      status: 'failed',
      failureKind: 'poison',
      pendingOutboxCount,
      processedOutboxCount: invalidPathsToDelete.length,
      shouldRetry: false,
    } satisfies CommunityStatsRebuildResult
  })
}

async function quarantineMalformedOutboxEntries(
  claim: CommunityStatsRebuildClaim,
  error: CommunityStatsOutboxSchemaError,
  nowMs: number,
): Promise<CommunityStatsRebuildResult> {
  return quarantineOutboxEntries(claim, {
    error,
    invalidPaths: error.invalidEntries.map((entry) => entry.path),
  }, nowMs)
}

async function quarantineOverflowBootstrapMarkers(
  claim: CommunityStatsRebuildClaim,
  error: CommunityStatsBootstrapMarkerCapacityError,
  nowMs: number,
): Promise<CommunityStatsRebuildResult> {
  return quarantineOutboxEntries(claim, {
    error,
    invalidPaths: error.overflowOutboxPaths,
  }, nowMs)
}

export async function publishClaimedCommunityStats(
  claim: CommunityStatsRebuildClaim,
  options?: {
    loadSnapshot?: () => Promise<CommunityStatsSourceSnapshot>
    nowMs?: number
  },
): Promise<CommunityStatsRebuildResult> {
  const nowMs = options?.nowMs ?? Date.now()

  try {
    const snapshot = await (options?.loadSnapshot ?? loadCommunityStatsSnapshot)()
    if (snapshot.outbox.length === 0) {
      return {
        status: 'skipped',
        skipReason: 'no-pending-work',
      }
    }

    const db = getDb()
    const aggregateRef = db.doc(COMMUNITY_STATS_DOC_PATH)
    const stateRef = db.doc(COMMUNITY_STATS_STATE_DOC_PATH)
    const currentOutboxQuery = db.collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION)

    return await db.runTransaction(async (transaction) => {
      const [stateSnapshot, currentOutboxSnapshot] = await Promise.all([
        transaction.get(stateRef) as Promise<SnapshotLike>,
        transaction.get(currentOutboxQuery) as Promise<QuerySnapshotLike>,
      ])
      const state = (stateSnapshot.data() ?? {}) as CommunityStatsWorkerState

      if (state.leaseId !== claim.leaseId) {
        return { status: 'lease-lost' } satisfies CommunityStatsRebuildResult
      }

      const currentOutbox = parseOutboxSnapshot(currentOutboxSnapshot)
      const currentOutboxPaths = new Set(currentOutbox.map((entry) => entry.path))
      const missingSnapshotEntries = snapshot.outbox.filter((entry) => !currentOutboxPaths.has(entry.path))
      if (missingSnapshotEntries.length > 0) {
        transaction.set(stateRef, releaseLeasePatch({
          lastErrorAt: Timestamp.fromMillis(nowMs),
          lastErrorMessage: `Outbox snapshot drifted before publish; missing ${missingSnapshotEntries.length} queued event(s).`,
          pendingOutboxCount: currentOutbox.length,
        }), { merge: true })
        return {
          status: 'lease-lost',
          pendingOutboxCount: currentOutbox.length,
        } satisfies CommunityStatsRebuildResult
      }

      const trackedBootstrapMarkerQueue = planTrackedBootstrapMarkerQueue({
        nowMs,
        outbox: currentOutbox,
        state,
      })
      if (trackedBootstrapMarkerQueue.overflowOutboxPaths.length > 0) {
        throw new CommunityStatsBootstrapMarkerCapacityError(
          `Tracked bootstrap marker queue exceeds bounds; quarantining ${trackedBootstrapMarkerQueue.overflowOutboxPaths.length} overflow marker(s).`,
          trackedBootstrapMarkerQueue.overflowOutboxPaths,
        )
      }

      const outboxEntriesToDelete = snapshot.outbox.slice(0, COMMUNITY_STATS_OUTBOX_DELETE_BATCH_LIMIT)
      const nextGeneration = numeric(state.pipelineGeneration) + 1
      const pendingOutboxCount = Math.max(currentOutbox.length - outboxEntriesToDelete.length, 0)
      const refreshState: CommunityStatsRefreshState = pendingOutboxCount > 0 ? 'stale' : 'ready'
      const completedBootstrapMarkers = trackedBootstrapMarkerQueue.completedBootstrapMarkers
      const pendingBootstrapMarkers = trackedBootstrapMarkerQueue.pendingBootstrapMarkers
      const completedBootstrapMarkerIds = new Set(completedBootstrapMarkers.map((marker) => marker.markerId))
      const deletedBootstrapMarkers = mergeBootstrapMarkers(
        trackedBootstrapMarkerQueueEntries(outboxEntriesToDelete)
          .map((entry) => entry.marker)
          .filter((marker) => !completedBootstrapMarkerIds.has(marker.markerId)),
      )
      const activeBootstrapMarkers = mergeBootstrapMarkers(
        pendingBootstrapMarkers,
        trackedBootstrapMarkerQueue.acceptedOutboxBootstrapMarkers.map((entry) => entry.marker),
      )
      const bootstrapMarkerId = latestBootstrapMarkerId(activeBootstrapMarkers)
      const trackedCompletedBootstrapMarkers = refreshState === 'ready'
        ? acknowledgeCompletedBootstrapMarkers({
            completedBootstrapMarkers,
            markersToComplete: mergeBootstrapMarkers(pendingBootstrapMarkers, deletedBootstrapMarkers),
            completedAtMs: nowMs,
          })
        : completedBootstrapMarkers
      const nextPendingBootstrapMarkers = refreshState === 'ready'
        ? []
        : mergeBootstrapMarkers(pendingBootstrapMarkers, deletedBootstrapMarkers)
      assertTrackedBootstrapMarkerStateCapacity({
        completedBootstrapMarkers: trackedCompletedBootstrapMarkers,
        pendingBootstrapMarkers: nextPendingBootstrapMarkers,
      }, 'Tracked community stats bootstrap marker state')
      const publishedStats = buildPublishedCommunityStats({
        source: snapshot.source,
        nowMs,
        snapshotReadAtMs: snapshot.snapshotReadAtMs,
        pipelineGeneration: nextGeneration,
        refreshState,
      })

      transaction.set(aggregateRef, publishedStats)
      transaction.set(stateRef, releaseLeasePatch({
        pipelineGeneration: nextGeneration,
        lastCompletedAt: Timestamp.fromMillis(nowMs),
        lastPublishedRefreshState: refreshState,
        lastPublishedSnapshotReadAt: Timestamp.fromMillis(snapshot.snapshotReadAtMs),
        lastCompletedOutboxCount: outboxEntriesToDelete.length,
        pendingOutboxCount,
        lastErrorAt: FieldValue.delete(),
        lastErrorMessage: FieldValue.delete(),
        lastFailedGeneration: FieldValue.delete(),
        ...trackedBootstrapMarkerStatePatch({
          completedBootstrapMarkers: trackedCompletedBootstrapMarkers,
          pendingBootstrapMarkers: nextPendingBootstrapMarkers,
        }),
      }), { merge: true })

      for (const entry of outboxEntriesToDelete) {
        transaction.delete(db.doc(entry.path))
      }

      return {
        status: 'published',
        refreshState,
        pipelineGeneration: nextGeneration,
        processedOutboxCount: outboxEntriesToDelete.length,
        pendingOutboxCount,
        snapshotReadAtMs: snapshot.snapshotReadAtMs,
        ...(bootstrapMarkerId ? { bootstrapMarkerId } : {}),
      } satisfies CommunityStatsRebuildResult
    })
  } catch (error) {
    if (error instanceof CommunityStatsOutboxSchemaError) {
      console.error('Invalid community stats outbox data detected; quarantining malformed entries.', error)
      return quarantineMalformedOutboxEntries(claim, error, nowMs)
    }
    if (isBootstrapMarkerCapacityError(error) && error.overflowOutboxPaths.length > 0) {
      console.error('Bootstrap marker queue exceeded configured bounds; quarantining overflow markers.', error)
      return quarantineOverflowBootstrapMarkers(claim, error, nowMs)
    }

    console.error('Failed to rebuild community stats aggregate.', error)
    await markCommunityStatsRebuildFailed(claim, error, nowMs)
    return {
      status: 'failed',
      failureKind: 'transient',
      shouldRetry: true,
    }
  }
}

export async function processCommunityStatsQueue(options?: {
  loadSnapshot?: () => Promise<CommunityStatsSourceSnapshot>
  nowMs?: number
}): Promise<CommunityStatsRebuildResult> {
  let lastResult: CommunityStatsRebuildResult | null = null

  for (let pass = 0; pass < MAX_PROCESS_PASSES_PER_INVOCATION; pass++) {
    const claimAttempt = await claimCommunityStatsRebuildAttempt(options?.nowMs)
    if (!claimAttempt.claim) {
      return {
        status: 'skipped',
        pendingOutboxCount: claimAttempt.pendingOutboxCount,
        skipReason: claimAttempt.skipReason,
        shouldRetry: claimAttempt.skipReason === 'lease-active',
      }
    }

    const result = await publishClaimedCommunityStats(claimAttempt.claim, options)
    lastResult = result

    if (result.status === 'published' && (result.pendingOutboxCount ?? 0) > 0) {
      continue
    }

    return result
  }

  if (!lastResult) {
    return {
      status: 'skipped',
      skipReason: 'no-pending-work',
    }
  }

  return {
    ...lastResult,
    shouldRetry: (lastResult.pendingOutboxCount ?? 0) > 0 || lastResult.shouldRetry === true,
  }
}

export async function recoverCommunityStatsQueue(options?: {
  loadSnapshot?: () => Promise<CommunityStatsSourceSnapshot>
  nowMs?: number
}): Promise<CommunityStatsRebuildResult> {
  return processCommunityStatsQueue(options)
}
