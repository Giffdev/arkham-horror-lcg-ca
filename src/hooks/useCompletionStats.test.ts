import { renderHook } from '@testing-library/react'
import { useCompletionStats } from './useCompletionStats'
import { Playthrough } from '@/lib/types'

function makePlaythrough(overrides: Partial<Playthrough> = {}): Playthrough {
  return {
    id: 'pt-1',
    date: '2026-01-15',
    campaignName: 'Night of the Zealot',
    campaignType: 'Full Campaign',
    investigators: [
      { playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' },
    ],
    ...overrides,
  }
}

describe('useCompletionStats', () => {
  it('returns zero stats when playthroughs is undefined', () => {
    const { result } = renderHook(() => useCompletionStats(undefined))
    expect(result.current.personal).toEqual({
      total: 0,
      breakdown: { fullCampaigns: 0, smallCampaigns: 0, scenarioPacks: 0, fanMade: 0 },
    })
  })

  it('returns zero stats when playthroughs is empty', () => {
    const { result } = renderHook(() => useCompletionStats([]))
    expect(result.current.personal).toEqual({
      total: 0,
      breakdown: { fullCampaigns: 0, smallCampaigns: 0, scenarioPacks: 0, fanMade: 0 },
    })
  })

  it('counts a single Full Campaign correctly', () => {
    const playthroughs = [makePlaythrough({ campaignType: 'Full Campaign' })]
    const { result } = renderHook(() => useCompletionStats(playthroughs))
    expect(result.current.personal.total).toBe(1)
    expect(result.current.personal.breakdown.fullCampaigns).toBe(1)
  })

  it('counts a single Small Campaign correctly', () => {
    const playthroughs = [makePlaythrough({ campaignType: 'Small Campaign' })]
    const { result } = renderHook(() => useCompletionStats(playthroughs))
    expect(result.current.personal.total).toBe(1)
    expect(result.current.personal.breakdown.smallCampaigns).toBe(1)
  })

  it('counts a single Scenario Pack correctly', () => {
    const playthroughs = [makePlaythrough({ campaignType: 'Scenario Pack' })]
    const { result } = renderHook(() => useCompletionStats(playthroughs))
    expect(result.current.personal.total).toBe(1)
    expect(result.current.personal.breakdown.scenarioPacks).toBe(1)
  })

  it('counts a single Fan-Made correctly', () => {
    const playthroughs = [makePlaythrough({ campaignType: 'Fan-Made' })]
    const { result } = renderHook(() => useCompletionStats(playthroughs))
    expect(result.current.personal.total).toBe(1)
    expect(result.current.personal.breakdown.fanMade).toBe(1)
  })

  it('counts Unknown in total but not in any breakdown bucket', () => {
    const playthroughs = [makePlaythrough({ campaignType: 'Unknown' })]
    const { result } = renderHook(() => useCompletionStats(playthroughs))
    expect(result.current.personal.total).toBe(1)
    expect(result.current.personal.breakdown).toEqual({
      fullCampaigns: 0,
      smallCampaigns: 0,
      scenarioPacks: 0,
      fanMade: 0,
    })
  })

  it('handles a mix of campaign types', () => {
    const playthroughs = [
      makePlaythrough({ id: '1', campaignType: 'Full Campaign' }),
      makePlaythrough({ id: '2', campaignType: 'Full Campaign' }),
      makePlaythrough({ id: '3', campaignType: 'Small Campaign' }),
      makePlaythrough({ id: '4', campaignType: 'Scenario Pack' }),
      makePlaythrough({ id: '5', campaignType: 'Fan-Made' }),
      makePlaythrough({ id: '6', campaignType: 'Fan-Made' }),
      makePlaythrough({ id: '7', campaignType: 'Unknown' }),
    ]
    const { result } = renderHook(() => useCompletionStats(playthroughs))
    expect(result.current.personal.total).toBe(7)
    expect(result.current.personal.breakdown).toEqual({
      fullCampaigns: 2,
      smallCampaigns: 1,
      scenarioPacks: 1,
      fanMade: 2,
    })
  })
})
