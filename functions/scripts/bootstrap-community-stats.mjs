import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { GoogleAuth } from 'google-auth-library'
import { getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const COMMUNITY_STATS_STATE_DOC_PATH = 'community-stats-internal/state'
const COMMUNITY_STATS_DOC_PATH = 'community-stats/global'
const COMMUNITY_STATS_OUTBOX_COLLECTION = 'communityStatsOutbox'
const COMMUNITY_STATS_SYSTEM_OUTBOX_PARENT_PATH = 'community-stats-system/system'
const COMMUNITY_STATS_SCHEMA_VERSION = 3
const DEFAULT_TIMEOUT_MS = 10 * 60_000
export const BOOTSTRAP_TIMEOUT_MAX_MS = 15 * 60_000
export const BOOTSTRAP_MARKER_RETENTION_MS = BOOTSTRAP_TIMEOUT_MAX_MS + (15 * 60_000)
export const BOOTSTRAP_MARKER_COMPLETION_CLOCK_SKEW_MS = 5 * 60_000
export const BOOTSTRAP_MARKER_ID_MAX_CHARS = 64
export const BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS = 1_024
export const BOOTSTRAP_MARKER_STATE_MAX_SERIALIZED_BYTES = 110 * 1_024
const POLL_INTERVAL_MS = 2_000
const GENERATED_AT_RECENCY_MS = 10 * 60_000
const BOOTSTRAP_MARKER_ID_PATTERN = /^bootstrap-[a-z0-9]+(?:-[a-z0-9]+)*$/

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function timestampToMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  ) {
    return value.toMillis()
  }
  return null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function validateBootstrapMarkerId(markerId, label = 'bootstrap marker id') {
  if (typeof markerId !== 'string') {
    throw new Error(`${label} must be a string.`)
  }
  if (!BOOTSTRAP_MARKER_ID_PATTERN.test(markerId)) {
    throw new Error(
      `${label} must start with "bootstrap-" and use only lowercase ASCII letters, digits, and single hyphen separators.`,
    )
  }
  if (markerId.length > BOOTSTRAP_MARKER_ID_MAX_CHARS) {
    throw new Error(`${label} must be at most ${BOOTSTRAP_MARKER_ID_MAX_CHARS} characters long.`)
  }
  if (Buffer.byteLength(markerId, 'utf8') > BOOTSTRAP_MARKER_ID_MAX_CHARS) {
    throw new Error(`${label} must be at most ${BOOTSTRAP_MARKER_ID_MAX_CHARS} UTF-8 bytes long.`)
  }
  return markerId
}

function compareBootstrapMarkers(left, right) {
  const requestedAtDiff = left.requestedAtMs - right.requestedAtMs
  if (requestedAtDiff !== 0) {
    return requestedAtDiff
  }
  return left.markerId.localeCompare(right.markerId)
}

function mergeBootstrapMarkers(...groups) {
  const deduped = new Map()

  for (const marker of groups.flat()) {
    const existing = deduped.get(marker.markerId)
    if (!existing || compareBootstrapMarkers(marker, existing) < 0) {
      deduped.set(marker.markerId, marker)
    }
  }

  return Array.from(deduped.values()).sort(compareBootstrapMarkers)
}

function readBootstrapMarkerArray(value, label) {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`)
  }

  return mergeBootstrapMarkers(
    value.map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        throw new Error(`${label}[${index}] must be a plain object.`)
      }
      return {
        markerId: validateBootstrapMarkerId(entry.markerId, `${label}[${index}].markerId`),
        requestedAtMs: (() => {
          if (typeof entry.requestedAtMs !== 'number' || !Number.isSafeInteger(entry.requestedAtMs)) {
            throw new Error(`${label}[${index}].requestedAtMs must be a safe integer millisecond timestamp.`)
          }
          return entry.requestedAtMs
        })(),
      }
    }),
  )
}

function mergeCompletedBootstrapMarkers(...groups) {
  const deduped = new Map()

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

function mergeNormalizedCompletedBootstrapMarkers(...groups) {
  const deduped = new Map()

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

function normalizeCompletedBootstrapMarkerCompletedAtMs(value, nowMs) {
  const completedAtMs = timestampToMillis(value)
  if (completedAtMs === null || !Number.isSafeInteger(completedAtMs) || completedAtMs < 0) {
    return {
      completedAtMs: nowMs,
      hasTrustedCompletionTime: false,
    }
  }

  const maxTrustedCompletionAtMs = nowMs + BOOTSTRAP_MARKER_COMPLETION_CLOCK_SKEW_MS
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

function readCompletedBootstrapMarkerArray(value, label, nowMs) {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`)
  }

  return mergeNormalizedCompletedBootstrapMarkers(
    value.map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        throw new Error(`${label}[${index}] must be a plain object.`)
      }
      const marker = {
        markerId: validateBootstrapMarkerId(entry.markerId, `${label}[${index}].markerId`),
        requestedAtMs: (() => {
          if (typeof entry.requestedAtMs !== 'number' || !Number.isSafeInteger(entry.requestedAtMs)) {
            throw new Error(`${label}[${index}].requestedAtMs must be a safe integer millisecond timestamp.`)
          }
          return entry.requestedAtMs
        })(),
      }
      const completion = normalizeCompletedBootstrapMarkerCompletedAtMs(entry.completedAtMs, nowMs)
      return {
        ...marker,
        completedAtMs: completion.completedAtMs,
        hasTrustedCompletionTime: completion.hasTrustedCompletionTime,
      }
    }),
  )
}

function pruneCompletedBootstrapMarkers(markers, nowMs) {
  return markers.filter((marker) => nowMs - Math.min(marker.completedAtMs, nowMs) <= BOOTSTRAP_MARKER_RETENTION_MS)
}

function trackedBootstrapMarkerStateBytes(input) {
  const reservedCompletedBootstrapMarkers = mergeCompletedBootstrapMarkers(
    input.completedBootstrapMarkers,
    input.pendingBootstrapMarkers.map((marker) => ({
      ...marker,
      completedAtMs: Number.MAX_SAFE_INTEGER,
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

function assertTrackedBootstrapMarkerCapacity(input, label) {
  const trackedMarkerCount = input.completedBootstrapMarkers.length + input.pendingBootstrapMarkers.length
  if (trackedMarkerCount > BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS) {
    throw new Error(
      `${label} exceeds the ${BOOTSTRAP_MARKER_STATE_MAX_TRACKED_MARKERS}-marker retention cap ` +
      `(${trackedMarkerCount} tracked).`,
    )
  }

  const serializedBytes = trackedBootstrapMarkerStateBytes(input)
  if (serializedBytes > BOOTSTRAP_MARKER_STATE_MAX_SERIALIZED_BYTES) {
    throw new Error(
      `${label} exceeds the ${BOOTSTRAP_MARKER_STATE_MAX_SERIALIZED_BYTES}-byte serialized cap ` +
      `(${serializedBytes} bytes).`,
    )
  }
}

function trackedBootstrapMarkerStatePatch(input) {
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

function trackedBootstrapMarkerStateFromWorkerState(state, nowMs) {
  const normalizedPendingBootstrapMarkers = readBootstrapMarkerArray(
    state?.pendingBootstrapMarkers,
    'pendingBootstrapMarkers',
  )
  const completedBootstrapMarkers = pruneCompletedBootstrapMarkers(
    readCompletedBootstrapMarkerArray(state?.completedBootstrapMarkers, 'completedBootstrapMarkers', nowMs),
    nowMs,
  )

  while (true) {
    try {
      assertTrackedBootstrapMarkerCapacity({
        completedBootstrapMarkers: completedBootstrapMarkers.map((marker) => ({
          markerId: marker.markerId,
          requestedAtMs: marker.requestedAtMs,
          completedAtMs: marker.completedAtMs,
        })),
        pendingBootstrapMarkers: normalizedPendingBootstrapMarkers,
      }, 'Tracked bootstrap marker state')
      break
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Tracked bootstrap marker state exceeds')) {
        throw error
      }

      const syntheticIndex = completedBootstrapMarkers.findIndex((marker) => !marker.hasTrustedCompletionTime)
      if (syntheticIndex === -1) {
        throw error
      }

      completedBootstrapMarkers.splice(syntheticIndex, 1)
    }
  }

  const completedBootstrapMarkerIds = new Set(completedBootstrapMarkers.map((marker) => marker.markerId))
  const pendingBootstrapMarkers = normalizedPendingBootstrapMarkers
    .filter((marker) => !completedBootstrapMarkerIds.has(marker.markerId))
  const normalizedCompletedBootstrapMarkers = completedBootstrapMarkers.map((marker) => ({
    markerId: marker.markerId,
    requestedAtMs: marker.requestedAtMs,
    completedAtMs: marker.completedAtMs,
  }))

  assertTrackedBootstrapMarkerCapacity({
    completedBootstrapMarkers: normalizedCompletedBootstrapMarkers,
    pendingBootstrapMarkers,
  }, 'Tracked bootstrap marker state')

  return {
    completedBootstrapMarkers: normalizedCompletedBootstrapMarkers,
    pendingBootstrapMarkers,
  }
}

function trackedBootstrapMarkerQueueEntries(outboxSnapshot) {
  const deduped = new Map()

  for (const doc of outboxSnapshot.docs) {
    const data = doc.data()
    const path = doc.ref.path
    const segments = path.split('/')
    if (
      segments.length !== 4 ||
      segments[0] !== 'community-stats-system' ||
      segments[1] !== 'system' ||
      segments[2] !== COMMUNITY_STATS_OUTBOX_COLLECTION
    ) {
      continue
    }
    if (!data || typeof data !== 'object' || data.reason !== 'bootstrap') {
      continue
    }
    if (data.requestedBy !== 'bootstrap') {
      throw new Error(`Bootstrap outbox entry ${path}.requestedBy must be "bootstrap".`)
    }
    if (data.affectedDocuments !== 0) {
      throw new Error(`Bootstrap outbox entry ${path}.affectedDocuments must be 0.`)
    }
    if (data.mutationId !== doc.id || data.bootstrapMarkerId !== doc.id) {
      throw new Error(`Bootstrap outbox entry ${path} must use a mutationId/bootstrapMarkerId equal to the document id.`)
    }
    const markerEntry = {
      path,
      marker: {
        markerId: validateBootstrapMarkerId(doc.id, `bootstrap outbox entry ${path}.mutationId`),
        requestedAtMs: (() => {
          if (typeof data.requestedAtMs !== 'number' || !Number.isSafeInteger(data.requestedAtMs)) {
            throw new Error(`Bootstrap outbox entry ${path}.requestedAtMs must be a safe integer millisecond timestamp.`)
          }
          return data.requestedAtMs
        })(),
      },
    }
    const existing = deduped.get(markerEntry.marker.markerId)
    if (!existing || compareBootstrapMarkers(markerEntry.marker, existing.marker) < 0) {
      deduped.set(markerEntry.marker.markerId, markerEntry)
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const markerDiff = compareBootstrapMarkers(left.marker, right.marker)
    if (markerDiff !== 0) {
      return markerDiff
    }
    return left.path.localeCompare(right.path)
  })
}

function planAdditionalBootstrapMarker(state, outboxSnapshot, candidateMarker) {
  const trackedState = trackedBootstrapMarkerStateFromWorkerState(state, candidateMarker.requestedAtMs)
  const occupiedMarkerIds = new Set([
    ...trackedState.completedBootstrapMarkers.map((marker) => marker.markerId),
    ...trackedState.pendingBootstrapMarkers.map((marker) => marker.markerId),
  ])
  const acceptedOutboxMarkers = []
  const overflowOutboxPaths = []
  let rejectionReason

  for (const outboxMarker of [
    ...trackedBootstrapMarkerQueueEntries(outboxSnapshot),
    {
      path: communityStatsSystemOutboxPath(candidateMarker.markerId),
      marker: candidateMarker,
    },
  ].sort((left, right) => {
    const markerDiff = compareBootstrapMarkers(left.marker, right.marker)
    if (markerDiff !== 0) {
      return markerDiff
    }
    return left.path.localeCompare(right.path)
  })) {
    if (occupiedMarkerIds.has(outboxMarker.marker.markerId)) {
      overflowOutboxPaths.push(outboxMarker.path)
      if (outboxMarker.marker.markerId === candidateMarker.markerId) {
        rejectionReason = 'duplicate'
      }
      continue
    }

    const candidatePendingBootstrapMarkers = mergeBootstrapMarkers(
      trackedState.pendingBootstrapMarkers,
      acceptedOutboxMarkers.map((entry) => entry.marker),
      [outboxMarker.marker],
    )
    try {
      assertTrackedBootstrapMarkerCapacity({
        completedBootstrapMarkers: trackedState.completedBootstrapMarkers,
        pendingBootstrapMarkers: candidatePendingBootstrapMarkers,
      }, 'Tracked bootstrap marker state')
      acceptedOutboxMarkers.push(outboxMarker)
      occupiedMarkerIds.add(outboxMarker.marker.markerId)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Tracked bootstrap marker state exceeds')) {
        overflowOutboxPaths.push(outboxMarker.path)
        if (outboxMarker.marker.markerId === candidateMarker.markerId) {
          rejectionReason = 'capacity'
        }
        continue
      }
      throw error
    }
  }

  return {
    trackedState,
    overflowOutboxPaths,
    rejectionReason: rejectionReason ?? (overflowOutboxPaths.length > 0 ? 'overflow-existing' : undefined),
  }
}

export function parseArgs(argv) {
  let projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT
  let timeoutMs = DEFAULT_TIMEOUT_MS

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--project') {
      projectId = argv[index + 1]
      index++
      continue
    }
    if (arg === '--timeout-ms') {
      timeoutMs = Number.parseInt(argv[index + 1] ?? '', 10)
      index++
    }
  }

  if (!projectId?.trim()) {
    throw new Error(
      'Community stats bootstrap requires an explicit Firebase project id. ' +
      'Pass --project <firebase-project-id> or set FIREBASE_PROJECT_ID.',
    )
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Bootstrap timeout must be a positive integer number of milliseconds.')
  }
  if (timeoutMs > BOOTSTRAP_TIMEOUT_MAX_MS) {
    throw new Error(
      `Bootstrap timeout must be no greater than ${BOOTSTRAP_TIMEOUT_MAX_MS}ms ` +
      `so completed markers remain queryable for the full wait window.`,
    )
  }

  return {
    projectId: projectId.trim(),
    timeoutMs,
  }
}

async function resolveAuthenticatedProjectId() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  return auth.getProjectId()
}

function communityStatsSystemOutboxPath(markerId) {
  return `${COMMUNITY_STATS_SYSTEM_OUTBOX_PARENT_PATH}/${COMMUNITY_STATS_OUTBOX_COLLECTION}/${markerId}`
}

function completedBootstrapMarkers(state, nowMs = Date.now()) {
  return trackedBootstrapMarkerStateFromWorkerState(state ?? {}, nowMs).completedBootstrapMarkers
}

export function hasCompletedBootstrapMarker(state, markerId, nowMs = Date.now()) {
  validateBootstrapMarkerId(markerId)
  return completedBootstrapMarkers(state, nowMs).some((entry) => entry.markerId === markerId)
}

async function main() {
  const { projectId, timeoutMs } = parseArgs(process.argv.slice(2))
  const authenticatedProjectId = await resolveAuthenticatedProjectId()

  if (!authenticatedProjectId?.trim()) {
    throw new Error(
      'Unable to resolve the authenticated Admin SDK project from Application Default Credentials. ' +
      'Refusing to run bootstrap against an ambiguous target.',
    )
  }
  if (authenticatedProjectId !== projectId) {
    throw new Error(
      `Refusing community stats bootstrap. Requested project "${projectId}" ` +
      `does not match authenticated Admin SDK project "${authenticatedProjectId}".`,
    )
  }

  if (!getApps().length) {
    initializeApp({ projectId })
  }

  const db = getFirestore()
  const stateRef = db.doc(COMMUNITY_STATS_STATE_DOC_PATH)
  const aggregateRef = db.doc(COMMUNITY_STATS_DOC_PATH)
  const queuedAtMs = Date.now()
  const markerId = validateBootstrapMarkerId(`bootstrap-${queuedAtMs}-${randomUUID()}`, 'generated bootstrap marker id')

  const queueAttempt = await db.runTransaction(async (transaction) => {
    const outboxQuery = db.collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION)
    const [stateSnapshot, outboxSnapshot] = await Promise.all([
      transaction.get(stateRef),
      transaction.get(outboxQuery),
    ])
    const state = stateSnapshot.data() ?? {}
    const plan = planAdditionalBootstrapMarker(state, outboxSnapshot, {
      markerId,
      requestedAtMs: queuedAtMs,
    })
    const trackedState = plan.trackedState

    if (
      state.completedBootstrapMarkers !== undefined ||
      state.pendingBootstrapMarkers !== undefined ||
      trackedState.completedBootstrapMarkers.length > 0 ||
      trackedState.pendingBootstrapMarkers.length > 0
    ) {
      transaction.set(stateRef, trackedBootstrapMarkerStatePatch(trackedState), { merge: true })
    }

    if (plan.rejectionReason) {
      return {
        accepted: false,
        rejectionReason: plan.rejectionReason,
      }
    }

    transaction.set(db.doc(communityStatsSystemOutboxPath(markerId)), {
      mutationId: markerId,
      requestedAtMs: queuedAtMs,
      requestedBy: 'bootstrap',
      reason: 'bootstrap',
      affectedDocuments: 0,
      bootstrapMarkerId: markerId,
    })

    return {
      accepted: true,
    }
  })

  if (!queueAttempt.accepted) {
    if (queueAttempt.rejectionReason === 'duplicate') {
      throw new Error(`Bootstrap marker ${markerId} is already queued or retained.`)
    }
    if (queueAttempt.rejectionReason === 'capacity') {
      throw new Error('Bootstrap marker queue is at capacity; retry after older markers expire or prune.')
    }
    throw new Error('Bootstrap marker queue already contains overflow markers awaiting quarantine.')
  }

  console.log(`Queued community stats bootstrap marker ${markerId} for project ${projectId}. Waiting for durable publish...`)

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const [stateSnapshot, aggregateSnapshot, outboxSnapshot] = await Promise.all([
      stateRef.get(),
      aggregateRef.get(),
      db.collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION).get(),
    ])

    const state = stateSnapshot.data() ?? {}
    const aggregate = aggregateSnapshot.data() ?? {}
    const generatedAt = numeric(aggregate.generatedAt ?? aggregate.lastUpdated)
    const leaseExpiresAt = timestampToMillis(state.leaseExpiresAt)
    const leaseActive =
      typeof state.leaseId === 'string' &&
      leaseExpiresAt !== null &&
      leaseExpiresAt > Date.now()

    const ready =
      aggregateSnapshot.exists &&
      aggregate.schemaVersion === COMMUNITY_STATS_SCHEMA_VERSION &&
      aggregate.refreshState === 'ready' &&
      hasCompletedBootstrapMarker(state, markerId) &&
      outboxSnapshot.size === 0 &&
      !leaseActive &&
      generatedAt > 0 &&
      Date.now() - generatedAt <= GENERATED_AT_RECENCY_MS

    if (ready) {
      console.log(
        `Community stats bootstrap complete at pipeline generation ` +
        `${aggregate.pipelineGeneration ?? aggregate.sourceGeneration ?? 'n/a'} ` +
        `(generatedAt=${generatedAt}, marker=${markerId}).`,
      )
      return
    }

    await sleep(POLL_INTERVAL_MS)
  }

  const [finalStateSnapshot, finalAggregateSnapshot, finalOutboxSnapshot] = await Promise.all([
    stateRef.get(),
    aggregateRef.get(),
    db.collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION).get(),
  ])
  const finalState = finalStateSnapshot.data() ?? {}
  const finalAggregate = finalAggregateSnapshot.data() ?? {}

  throw new Error(
    `Timed out waiting ${timeoutMs}ms for community stats bootstrap marker ${markerId}. ` +
    `pendingOutbox=${finalOutboxSnapshot.size}, ` +
    `lastCompletedBootstrapMarkerId=${finalState.lastCompletedBootstrapMarkerId ?? 'none'}, ` +
    `completedBootstrapMarkerCount=${completedBootstrapMarkers(finalState).length}, ` +
    `completedBootstrapMarkersTail=${completedBootstrapMarkers(finalState).slice(-10).map((entry) => entry.markerId).join(',') || 'none'}, ` +
    `refreshState=${finalAggregate.refreshState ?? 'missing'}, ` +
    `schemaVersion=${finalAggregate.schemaVersion ?? 'missing'}.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  })
}
