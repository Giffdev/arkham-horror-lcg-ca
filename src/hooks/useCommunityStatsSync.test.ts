import { renderHook } from '@testing-library/react'
import { useCommunityStatsSync } from './useCommunityStatsSync'
import { Playthrough } from '@/lib/types'

// Mock the community-stats module
vi.mock('@/lib/community-stats', () => ({
  rebuildCommunityStats: vi.fn(() => Promise.resolve()),
}))

import { rebuildCommunityStats } from '@/lib/community-stats'
const mockRebuild = vi.mocked(rebuildCommunityStats)

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

describe('useCommunityStatsSync', () => {
  beforeEach(() => {
    mockRebuild.mockClear()
  })

  it('calls rebuildCommunityStats when playthroughs are provided', () => {
    const playthroughs = [makePlaythrough('pt-1')]
    renderHook(() => useCommunityStatsSync(playthroughs))
    expect(mockRebuild).toHaveBeenCalledWith(playthroughs)
  })

  it('does not call rebuildCommunityStats when playthroughs is undefined', () => {
    renderHook(() => useCommunityStatsSync(undefined))
    expect(mockRebuild).not.toHaveBeenCalled()
  })

  it('does not call rebuildCommunityStats when playthroughs is empty', () => {
    renderHook(() => useCommunityStatsSync([]))
    expect(mockRebuild).not.toHaveBeenCalled()
  })

  it('calls rebuildCommunityStats again when playthroughs reference changes', () => {
    const playthroughs1 = [makePlaythrough('pt-1')]
    const playthroughs2 = [makePlaythrough('pt-1'), makePlaythrough('pt-2')]

    const { rerender } = renderHook(
      ({ data }) => useCommunityStatsSync(data),
      { initialProps: { data: playthroughs1 } }
    )
    expect(mockRebuild).toHaveBeenCalledTimes(1)

    rerender({ data: playthroughs2 })
    expect(mockRebuild).toHaveBeenCalledTimes(2)
    expect(mockRebuild).toHaveBeenLastCalledWith(playthroughs2)
  })

  it('handles rebuildCommunityStats rejection gracefully (no throw)', async () => {
    mockRebuild.mockRejectedValueOnce(new Error('network error'))
    const playthroughs = [makePlaythrough('pt-1')]

    // Should not throw — error is caught by .catch(console.error)
    expect(() => {
      renderHook(() => useCommunityStatsSync(playthroughs))
    }).not.toThrow()
  })
})
