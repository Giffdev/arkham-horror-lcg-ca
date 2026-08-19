import { timingSafeEqual } from 'node:crypto'

import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

import {
  COMMUNITY_STATS_OUTBOX_COLLECTION,
  rebuildUserContribution,
  type ContributionProcessResult,
} from './community-stats-contributions'
import { ensureFirebaseAdminApp } from './firebase-admin'

export type CommunityStatsProcessRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

export type CommunityStatsProcessResponse = {
  status(code: number): CommunityStatsProcessResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
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

async function findRecoveryOwner(): Promise<string | null> {
  const pending = await getFirestore()
    .collectionGroup(COMMUNITY_STATS_OUTBOX_COLLECTION)
    .limit(1)
    .get()
  const path = pending.docs[0]?.ref.path
  const match = path?.match(/^users\/([^/]+)\/communityStatsOutbox\/[^/]+$/)
  return match?.[1] ?? null
}

function responseStatus(result: ContributionProcessResult): number {
  if (result.status === 'failed') return result.shouldRetry ? 503 : 422
  if (result.skipReason === 'lease-active') return 202
  return 200
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
    const ownerUid = request.method === 'GET'
      ? authorizeRecoveryWake(request) ? await findRecoveryOwner() : null
      : await authorizeOwnerWake(request)
    if (!ownerUid) {
      if (request.method === 'GET' && authorizeRecoveryWake(request)) {
        response.status(200).json({ status: 'skipped', skipReason: 'no-pending-work' })
        return
      }
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
