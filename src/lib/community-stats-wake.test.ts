import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  currentUser: {
    uid: 'owner-1',
    getIdToken: vi.fn(async () => 'firebase-id-token'),
  } as { uid: string; getIdToken: () => Promise<string> } | null,
}))

vi.mock('./firebase', () => ({
  auth: authMock,
}))

import {
  requestCommunityStatsRefresh,
  resetCommunityStatsWakeForTests,
} from './community-stats-wake'

describe('requestCommunityStatsRefresh', () => {
  beforeEach(() => {
    resetCommunityStatsWakeForTests()
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.stubEnv('VITE_COMMUNITY_STATS_API_ENABLED', 'true')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    authMock.currentUser = {
      uid: 'owner-1',
      getIdToken: vi.fn(async () => 'firebase-id-token'),
    }
  })

  afterEach(() => {
    resetCommunityStatsWakeForTests()
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('sends a Firebase ID token to the same-origin Vercel worker', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 }),
    )

    await requestCommunityStatsRefresh('owner-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/community-stats/process',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer firebase-id-token',
        },
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('does not wake for a different owner or while the rollout flag is disabled', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await requestCommunityStatsRefresh('owner-2')
    vi.stubEnv('VITE_COMMUNITY_STATS_API_ENABLED', 'false')
    await requestCommunityStatsRefresh('owner-1')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retries a fetch network rejection once and stops after success', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValue(new Response('{}', { status: 200 }))

    await requestCommunityStatsRefresh('owner-1')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)

    await requestCommunityStatsRefresh('owner-1')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries a token acquisition rejection once and stops after success', async () => {
    vi.useFakeTimers()
    const getIdToken = vi.fn()
      .mockRejectedValueOnce(new Error('token network failure'))
      .mockResolvedValueOnce('firebase-id-token')
    authMock.currentUser = { uid: 'owner-1', getIdToken }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 }),
    )

    await requestCommunityStatsRefresh('owner-1')

    expect(getIdToken).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(getIdToken).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not retry permanent authorization failures', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 401 }),
    )

    await requestCommunityStatsRefresh('owner-1')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds repeated network failures without duplicate timers', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('network unavailable'),
    )

    await requestCommunityStatsRefresh('owner-1')
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(90_000)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('coalesces simultaneous offline wakes into one bounded retry chain', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('network unavailable'),
    )

    await Promise.all([
      requestCommunityStatsRefresh('owner-1'),
      requestCommunityStatsRefresh('owner-1'),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(1)

    await vi.advanceTimersByTimeAsync(90_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels a pending retry when the user logs out', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('network unavailable'),
    )

    await requestCommunityStatsRefresh('owner-1')
    expect(vi.getTimerCount()).toBe(1)

    authMock.currentUser = null
    await requestCommunityStatsRefresh()

    expect(vi.getTimerCount()).toBe(0)
    await vi.runAllTimersAsync()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('cancels the previous UID chain before waking the new user', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValue(new Response('{}', { status: 200 }))

    await requestCommunityStatsRefresh('owner-1')
    expect(vi.getTimerCount()).toBe(1)

    authMock.currentUser = {
      uid: 'owner-2',
      getIdToken: vi.fn(async () => 'firebase-id-token-2'),
    }
    await requestCommunityStatsRefresh('owner-2')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    await vi.runAllTimersAsync()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale in-flight completion after a UID change', async () => {
    vi.useFakeTimers()
    let resolveOldRequest!: (response: Response) => void
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveOldRequest = resolve
      }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const oldWake = requestCommunityStatsRefresh('owner-1')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    authMock.currentUser = {
      uid: 'owner-2',
      getIdToken: vi.fn(async () => 'firebase-id-token-2'),
    }
    await requestCommunityStatsRefresh('owner-2')

    resolveOldRequest(new Response('{}', { status: 503 }))
    await oldWake

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([202, 503])('retries transient HTTP %s responses', async (status) => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    await requestCommunityStatsRefresh('owner-1')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })
})
