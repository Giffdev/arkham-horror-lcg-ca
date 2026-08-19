import { randomUUID, timingSafeEqual } from 'node:crypto'

import { getAuth } from 'firebase-admin/auth'
import {
  FieldPath,
  FieldValue,
  getFirestore,
  Timestamp,
} from 'firebase-admin/firestore'

import {
  COMMUNITY_STATS_OUTBOX_COLLECTION,
  rebuildUserContribution,
  type ContributionProcessResult,
} from './community-stats-contributions.js'
import { ensureFirebaseAdminApp } from './firebase-admin.js'

export type CommunityStatsProcessRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

export type CommunityStatsProcessResponse = {
  status(code: number): CommunityStatsProcessResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
}

const MAX_RECOVERY_OWNERS_PER_INVOCATION = 3
const MAX_RECOVERY_CANDIDATE_EVENTS = 50
const RECOVERY_CURSOR_DOC_PATH = 'community-stats-internal/recovery-cursor'
const RECOVERY_CURSOR_LEASE_MS = 75_000

type RecoveryLease = {
  leaseId: string
  afterPath: string | null
}

function headerValue(
  headers: CommunityStatsProcessRequest['headers'],
  name: string,
): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function bearerToken(request: CommunityStatsProcessRequest): string | null {
  const authorization = headerValue(request.headers, 'authorization')
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function backendEnabled(): boolean {
  return process.env.COMMUNITY_STATS_BACKEND_ENABLED === 'true'
}

async function authorizeOwnerWake(request: CommunityStatsProcessRequest): Promise<string | null> {
  const token = bearerToken(request)
  if (!token) return null

  const decoded = await getAuth().verifyIdToken(token, true)
  const pending = await getFirestore()
    .collection(`users/${decoded.uid}/${COMMUNITY_STATS_OUTBOX_COLLECTION}`)
    .limit(1)
    .get()
  return pending.empty ? null : decoded.uid
}

function authorizeRecoveryWake(request: CommunityStatsProcessRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim()
  const provided = bearerToken(request)
  if (!expected || !provided) return false
  const expectedBytes = Buffer.from(expected)
  const providedBytes = Buffer.from(provided)
  return expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
}

async function claimRecoveryLease(): Promise<RecoveryLease | ContributionProcessResult> {
  const db = getFirestore()
  const cursorRef = db.doc(RECOVERY_CURSOR_DOC_PATH)
  const nowMs = Date.now()

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(cursorRef)
    const state = snapshot.data() ?? {}
    const leaseExpiresAt = state.leaseExpiresAt instanceof Timestamp
      ? state.leaseExpiresAt.toMillis()
      : 0
    if (typeof state.leaseId === 'string' && leaseExpiresAt > nowMs) {
      return {
        status: 'skipped',
        skipReason: 'lease-active',
        shouldRetry: true,
      } satisfies ContributionProcessResult
    }

    const lease: RecoveryLease = {
      leaseId: randomUUID(),
      afterPath: typeof state.afterPath === 'string' ? state.afterPath : null,
    }
    transaction.set(cursorRef, {
      leaseId: lease.leaseId,
      leaseExpiresAt: Timestamp.fromMillis(nowMs + RECOVERY_CURSOR_LEASE_MS),
      lastStartedAt: Timestamp.fromMillis(nowMs),
    }, { merge: true })
    return lease
  })
}

async function finishRecoveryLease(
  lease: RecoveryLease,
  afterPath: string | null,
): Promise<void> {
  const db = getFirestore()
  const cursorRef = db.doc(RECOVERY_CURSOR_DOC_PATH)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(cursorRef)
    if (snapshot.data()?.leaseId !== lease.leaseId) return
    transaction.set(cursorRef, {
      afterPath: afterPath ?? FieldValue.delete(),
      leaseId: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
      lastCompletedAt: Timestamp.fromMillis(Date.now()),
    }, { merge: true })
  })
}

async function loadRecoveryCandidates(afterPath: string | null): Promise<{
  candidates: Array<{ ownerUid: string; afterPath: string }>
}> {
  const ordered = getFirestore()
    .collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION)
    .orderBy(FieldPath.documentId())
  const loadPage = (cursor: string | null) => cursor
    ? ordered.startAfter(cursor).limit(MAX_RECOVERY_CANDIDATE_EVENTS).get()
    : ordered.limit(MAX_RECOVERY_CANDIDATE_EVENTS).get()

  let pending = await loadPage(afterPath)
  if (pending.empty && afterPath) pending = await loadPage(null)

  const candidates: Array<{ ownerUid: string; afterPath: string }> = []
  let scannedAfterPath: string | null = null
  for (const entry of pending.docs) {
    scannedAfterPath = entry.ref.path
    const match = entry.ref.path.match(/^users\/([^/]+)\/communityStatsOutbox\/[^/]+$/)
    const ownerUid = match?.[1]
    if (ownerUid && !candidates.some((candidate) => candidate.ownerUid === ownerUid)) {
      candidates.push({ ownerUid, afterPath: scannedAfterPath })
      if (candidates.length >= MAX_RECOVERY_OWNERS_PER_INVOCATION) break
    }
  }
  if (
    scannedAfterPath &&
    candidates.length > 0 &&
    candidates.length < MAX_RECOVERY_OWNERS_PER_INVOCATION
  ) {
    candidates[candidates.length - 1].afterPath = scannedAfterPath
  }
  return { candidates }
}

function responseStatus(result: ContributionProcessResult): number {
  if (result.status === 'failed') return result.shouldRetry ? 503 : 422
  if (result.skipReason === 'lease-active') return 202
  return 200
}

async function processRecoveryWake(): Promise<
  ContributionProcessResult | {
    status: 'recovered'
    results: Array<ContributionProcessResult & { ownerUid: string }>
  }
> {
  const claim = await claimRecoveryLease()
  if (!('leaseId' in claim)) return claim

  const results: Array<ContributionProcessResult & { ownerUid: string }> = []
  let nextAfterPath = claim.afterPath

  try {
    const { candidates } = await loadRecoveryCandidates(claim.afterPath)
    for (const { ownerUid, afterPath } of candidates) {
      const result = await rebuildUserContribution(ownerUid)
      results.push({ ownerUid, ...result })

      if (
        (result.status === 'failed' && result.failureKind === 'transient') ||
        result.skipReason === 'lease-active'
      ) {
        nextAfterPath = claim.afterPath
        return result
      }
      nextAfterPath = afterPath
      if (!(result.status === 'failed' && result.failureKind === 'poison')) break
    }
  } finally {
    await finishRecoveryLease(claim, nextAfterPath)
  }

  if (results.length === 0) return { status: 'skipped', skipReason: 'no-pending-work' }
  return results.length === 1 && results[0].status !== 'failed'
    ? results[0]
    : { status: 'recovered', results }
}

export async function handleCommunityStatsProcess(
  request: CommunityStatsProcessRequest,
  response: CommunityStatsProcessResponse,
): Promise<void> {
  response.setHeader('Cache-Control', 'no-store')

  if (request.method !== 'POST' && request.method !== 'GET') {
    response.setHeader('Allow', 'GET, POST')
    response.status(405).json({ error: 'method-not-allowed' })
    return
  }
  if (!backendEnabled()) {
    response.status(503).json({ error: 'backend-not-enabled' })
    return
  }

  try {
    ensureFirebaseAdminApp()
    if (request.method === 'GET') {
      if (!authorizeRecoveryWake(request)) {
        response.status(401).json({ error: 'unauthorized' })
        return
      }
      const result = await processRecoveryWake()
      response.status(responseStatus(result.status === 'recovered'
        ? { status: 'published' }
        : result)).json(result)
      return
    }

    const ownerUid = await authorizeOwnerWake(request)
    if (!ownerUid) {
      response.status(401).json({ error: 'unauthorized' })
      return
    }

    const result = await rebuildUserContribution(ownerUid)
    response.status(responseStatus(result)).json(result)
  } catch (error) {
    console.error('Community stats Vercel worker failed.', error)
    response.status(503).json({
      error: 'worker-failed',
      retryable: true,
    })
  }
}
