import { auth } from './firebase'

const RETRY_DELAYS_MS = [5_000, 90_000] as const

class PermanentWakeError extends Error {}

interface WakeState {
  uid: string
  inFlight: Promise<void> | null
  retryTimer: ReturnType<typeof globalThis.setTimeout> | null
  abortController: AbortController | null
}

const wakeStates = new Map<string, WakeState>()

function apiEnabled(): boolean {
  return import.meta.env.VITE_COMMUNITY_STATS_API_ENABLED === 'true'
}

function isCurrentState(state: WakeState): boolean {
  return wakeStates.get(state.uid) === state
}

function cancelState(state: WakeState): void {
  if (state.retryTimer !== null) {
    globalThis.clearTimeout(state.retryTimer)
    state.retryTimer = null
  }
  state.abortController?.abort()
  state.abortController = null
  if (isCurrentState(state)) wakeStates.delete(state.uid)
}

function cancelStatesExcept(uid?: string): void {
  for (const state of wakeStates.values()) {
    if (state.uid !== uid) cancelState(state)
  }
}

async function sendWake(
  uid: string,
  signal: AbortSignal,
): Promise<'completed' | 'retry' | 'stop'> {
  if (!apiEnabled()) return 'stop'

  const user = auth.currentUser
  if (!user || user.uid !== uid) return 'stop'

  const token = await user.getIdToken()
  if (signal.aborted || auth.currentUser?.uid !== uid) return 'stop'

  const response = await fetch('/api/community-stats/process', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  })

  if ([202, 409, 503].includes(response.status)) return 'retry'
  if (response.ok) return 'completed'
  throw new PermanentWakeError(
    `Community stats refresh request failed with status ${response.status}.`,
  )
}

function finishState(state: WakeState): void {
  if (!isCurrentState(state)) return
  state.abortController = null
  wakeStates.delete(state.uid)
}

function scheduleRetry(state: WakeState, retryIndex: number): void {
  if (!isCurrentState(state)) return
  if (typeof window === 'undefined' || retryIndex >= RETRY_DELAYS_MS.length) {
    finishState(state)
    return
  }

  state.retryTimer = globalThis.setTimeout(() => {
    state.retryTimer = null
    if (!isCurrentState(state) || auth.currentUser?.uid !== state.uid) {
      cancelState(state)
      return
    }
    void startAttempt(state, retryIndex + 1)
  }, RETRY_DELAYS_MS[retryIndex])
}

async function runAttempt(state: WakeState, retryIndex: number): Promise<void> {
  const abortController = new AbortController()
  state.abortController = abortController

  try {
    const outcome = await sendWake(state.uid, abortController.signal)
    if (!isCurrentState(state)) return
    if (outcome === 'retry') {
      scheduleRetry(state, retryIndex)
    } else {
      finishState(state)
    }
  } catch (error) {
    if (!isCurrentState(state)) return
    if (error instanceof PermanentWakeError) {
      finishState(state)
      return
    }

    console.error('Failed to request a community stats refresh:', error)
    scheduleRetry(state, retryIndex)
  } finally {
    if (state.abortController === abortController) state.abortController = null
  }
}

function startAttempt(state: WakeState, retryIndex: number): Promise<void> {
  if (state.inFlight) return state.inFlight

  const attempt = runAttempt(state, retryIndex).finally(() => {
    if (state.inFlight === attempt) state.inFlight = null
  })
  state.inFlight = attempt
  return attempt
}

export async function requestCommunityStatsRefresh(uid?: string): Promise<void> {
  const currentUid = auth.currentUser?.uid
  cancelStatesExcept(currentUid)

  const activeUid = uid ?? currentUid
  if (!activeUid || activeUid !== currentUid || !apiEnabled()) {
    if (!currentUid || !apiEnabled()) cancelStatesExcept()
    return
  }

  const existingState = wakeStates.get(activeUid)
  if (existingState) {
    if (existingState.inFlight) await existingState.inFlight
    return
  }

  const state: WakeState = {
    uid: activeUid,
    inFlight: null,
    retryTimer: null,
    abortController: null,
  }
  wakeStates.set(activeUid, state)
  await startAttempt(state, 0)
}

export function resetCommunityStatsWakeForTests(): void {
  cancelStatesExcept()
}
