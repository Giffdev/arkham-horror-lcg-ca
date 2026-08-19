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
})
