import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCommunityStatsSync } from './useCommunityStatsSync'
import type { CommunityStats } from '@/lib/community-stats'
import type { Playthrough } from '@/lib/types'

const mockSubscribeToCommunityStats = vi.fn()
const mockUnsubscribe = vi.fn()
const mockRequestCommunityStatsRefresh = vi.fn()

vi.mock('@/lib/community-stats', () => ({
  subscribeToCommunityStats: (...args: unknown[]) => mockSubscribeToCommunityStats(...args),
}))

vi.mock('@/lib/community-stats-wake', () => ({
  requestCommunityStatsRefresh: () => mockRequestCommunityStatsRefresh(),
}))

function makePlaythrough(id: string): Playthrough {
  return {
    id,
    date: '2026-01-15',
    campaignName: 'Night of the Zealot',
    campaignType: 'Full Campaign',
    investigators: [
      { playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' },
    ],
  }
}

function makeStats(overrides: Partial<CommunityStats> = {}): CommunityStats {
  return {
    totalGames: 3,
    registeredUsers: 2,
    totalInvestigatorsPlayed: 4,
    topCampaigns: [],
    topInvestigators: [],
    topClasses: [],
    topSideScenarios: [],
    topStandalones: [],
    lastUpdated: 1,
    ...overrides,
  }
}

describe('useCommunityStatsSync', () => {
  beforeEach(() => {
    mockSubscribeToCommunityStats.mockReset()
    mockUnsubscribe.mockReset()
    mockRequestCommunityStatsRefresh.mockReset()
    mockSubscribeToCommunityStats.mockReturnValue(mockUnsubscribe)
  })

  it('subscribes to the published community aggregate on mount', () => {
    const onSync = vi.fn()

    renderHook(() => useCommunityStatsSync([makePlaythrough('pt-1')], onSync))

    expect(mockSubscribeToCommunityStats).toHaveBeenCalledTimes(1)
    expect(mockRequestCommunityStatsRefresh).toHaveBeenCalledTimes(1)
    expect(mockSubscribeToCommunityStats.mock.calls[0][0]).toEqual(expect.any(Function))
    expect(mockSubscribeToCommunityStats.mock.calls[0][1]).toEqual(expect.any(Function))
  })

  it('forwards aggregate updates to the caller callback', () => {
    const onSync = vi.fn()

    renderHook(() => useCommunityStatsSync([makePlaythrough('pt-1')], onSync))

    const handleStats = mockSubscribeToCommunityStats.mock.calls[0][0] as (stats: CommunityStats | null) => void
    handleStats(makeStats({ totalGames: 7 }))

    expect(onSync).toHaveBeenCalledWith(expect.objectContaining({ totalGames: 7 }))
  })

  it('supports unavailable aggregate snapshots', () => {
    const onSync = vi.fn()

    renderHook(() => useCommunityStatsSync(undefined, onSync))

    const handleStats = mockSubscribeToCommunityStats.mock.calls[0][0] as (stats: CommunityStats | null) => void
    handleStats(null)

    expect(onSync).toHaveBeenCalledWith(null)
  })

  it('unsubscribes when the hook unmounts', () => {
    const { unmount } = renderHook(() => useCommunityStatsSync([], vi.fn()))

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
