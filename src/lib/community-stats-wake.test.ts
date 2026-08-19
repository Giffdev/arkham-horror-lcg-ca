import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  currentUser: {
    uid: 'owner-1',
    getIdToken: vi.fn(async () => 'firebase-id-token'),
  } as { uid: string; getIdToken: () => Promise<string> } | null,
}))

vi.mock('./firebase', () => ({
  auth: authMock,
}))

import { requestCommunityStatsRefresh } from './community-stats-wake'

describe('requestCommunityStatsRefresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.stubEnv('VITE_COMMUNITY_STATS_API_ENABLED', 'true')
    authMock.currentUser = {
      uid: 'owner-1',
      getIdToken: vi.fn(async () => 'firebase-id-token'),
    }
  })

  it('sends a Firebase ID token to the same-origin Vercel worker', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 }),
    )

    await requestCommunityStatsRefresh('owner-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/community-stats/process', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer firebase-id-token',
      },
    })
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
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    await requestCommunityStatsRefresh('owner-1')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
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
})
