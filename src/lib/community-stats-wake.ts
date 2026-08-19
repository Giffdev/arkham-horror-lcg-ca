import { auth } from './firebase'

const RETRY_DELAYS_MS = [5_000, 90_000] as const

function apiEnabled(): boolean {
  return import.meta.env.VITE_COMMUNITY_STATS_API_ENABLED === 'true'
}

async function sendWake(uid?: string): Promise<boolean> {
  if (!apiEnabled()) return false

  const user = auth.currentUser
  if (!user || (uid && user.uid !== uid)) return false

  const token = await user.getIdToken()
  const response = await fetch('/api/community-stats/process', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (response.ok) return true
  if ([202, 409, 503].includes(response.status)) return false
  throw new Error(`Community stats refresh request failed with status ${response.status}.`)
}

function scheduleRetry(uid: string, retryIndex: number): void {
  if (retryIndex >= RETRY_DELAYS_MS.length) return
  window.setTimeout(() => {
    void sendWake(uid)
      .then((completed) => {
        if (!completed) scheduleRetry(uid, retryIndex + 1)
      })
      .catch((error) => {
        console.error('Failed to request a community stats refresh:', error)
      })
  }, RETRY_DELAYS_MS[retryIndex])
}

export async function requestCommunityStatsRefresh(uid?: string): Promise<void> {
  try {
    const activeUid = uid ?? auth.currentUser?.uid
    if (!activeUid) return
    const completed = await sendWake(activeUid)
    if (!completed) scheduleRetry(activeUid, 0)
  } catch (error) {
    console.error('Failed to request a community stats refresh:', error)
  }
}
