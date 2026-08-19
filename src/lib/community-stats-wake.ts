import { auth } from './firebase'

const RETRY_DELAYS_MS = [5_000, 90_000] as const

class PermanentWakeError extends Error {}

function apiEnabled(): boolean {
  return import.meta.env.VITE_COMMUNITY_STATS_API_ENABLED === 'true'
}

async function sendWake(uid?: string): Promise<'completed' | 'retry' | 'stop'> {
  if (!apiEnabled()) return 'stop'

  const user = auth.currentUser
  if (!user || (uid && user.uid !== uid)) return 'stop'

  const token = await user.getIdToken()
  const response = await fetch('/api/community-stats/process', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (response.ok) return 'completed'
  if ([202, 409, 503].includes(response.status)) return 'retry'
  throw new PermanentWakeError(
    `Community stats refresh request failed with status ${response.status}.`,
  )
}

function scheduleRetry(uid: string, retryIndex: number): void {
  if (typeof window === 'undefined') return
  if (retryIndex >= RETRY_DELAYS_MS.length) return
  globalThis.setTimeout(() => {
    void attemptWake(uid, retryIndex + 1)
  }, RETRY_DELAYS_MS[retryIndex])
}

async function attemptWake(uid: string, retryIndex: number): Promise<void> {
  try {
    const outcome = await sendWake(uid)
    if (outcome === 'retry') scheduleRetry(uid, retryIndex)
  } catch (error) {
    console.error('Failed to request a community stats refresh:', error)
    if (!(error instanceof PermanentWakeError)) scheduleRetry(uid, retryIndex)
  }
}

export async function requestCommunityStatsRefresh(uid?: string): Promise<void> {
  const activeUid = uid ?? auth.currentUser?.uid
  if (!activeUid) return
  await attemptWake(activeUid, 0)
}
