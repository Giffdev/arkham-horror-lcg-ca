import { renderHook } from '@testing-library/react'
import { useCompletionStats } from './useCompletionStats'
import { CampaignRun, Playthrough } from '@/lib/types'

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
  function expectBaseCounts(result: { total: number; campaignRunsPlayedCount: number; uniqueCampaignFamilyCount: number }) {
    expect(result.campaignRunsPlayedCount).toBe(result.total)
    expect(typeof result.uniqueCampaignFamilyCount).toBe('number')
  }

  it('returns zero stats when playthroughs is undefined', () => {
    const { result } = renderHook(() => useCompletionStats(undefined))
    expect(result.current.personal).toEqual({
      total: 0,
      campaignRunsPlayedCount: 0,
      uniqueCampaignFamilyCount: 0,
      breakdown: { fullCampaigns: 0, smallCampaigns: 0, scenarioPacks: 0, fanMade: 0 },
    })
  })

  it('returns zero stats when playthroughs is empty', () => {
    const { result } = renderHook(() => useCompletionStats([]))
    expect(result.current.personal).toEqual({
      total: 0,
      campaignRunsPlayedCount: 0,
      uniqueCampaignFamilyCount: 0,
      breakdown: { fullCampaigns: 0, smallCampaigns: 0, scenarioPacks: 0, fanMade: 0 },
    })
  })

  it('counts a single Full Campaign correctly', () => {
    const playthroughs = [makePlaythrough({ campaignType: 'Full Campaign' })]
    const { result } = renderHook(() => useCompletionStats(playthroughs))
    expect(result.current.personal.total).toBe(1)
    expectBaseCounts(result.current.personal)
    expect(result.current.personal.breakdown.fullCampaigns).toBe(1)
  })

  it('counts a single Small Campaign correctly', () => {
    const playthroughs = [makePlaythrough({ campaignType: 'Small Campaign' })]
    const { result } = renderHook(() => useCompletionStats(playthroughs))
    expect(result.current.personal.total).toBe(1)
    expectBaseCounts(result.current.personal)
    expect(result.current.personal.breakdown.smallCampaigns).toBe(1)
  })

  it('counts a single Scenario Pack correctly', () => {
    const playthroughs = [makePlaythrough({ campaignType: 'Scenario Pack' })]
    const { result } = renderHook(() => useCompletionStats(playthroughs))
    expect(result.current.personal.total).toBe(1)
    expectBaseCounts(result.current.personal)
    expect(result.current.personal.breakdown.scenarioPacks).toBe(1)
  })

  it('counts a single Fan-Made correctly', () => {
    const playthroughs = [makePlaythrough({ campaignType: 'Fan-Made' })]
    const { result } = renderHook(() => useCompletionStats(playthroughs))
    expect(result.current.personal.total).toBe(1)
    expectBaseCounts(result.current.personal)
    expect(result.current.personal.breakdown.fanMade).toBe(1)
  })

  it('counts Unknown in total but not in any breakdown bucket', () => {
    const playthroughs = [makePlaythrough({ campaignType: 'Unknown' })]
    const { result } = renderHook(() => useCompletionStats(playthroughs))
    expect(result.current.personal.total).toBe(1)
    expectBaseCounts(result.current.personal)
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
    expectBaseCounts(result.current.personal)
    expect(result.current.personal.breakdown).toEqual({
      fullCampaigns: 2,
      smallCampaigns: 1,
      scenarioPacks: 1,
      fanMade: 2,
    })
  })

  it('uses run roots + unsuppressed legacy roots for campaign counts when runs are provided', () => {
    const promotedSource = makePlaythrough({
      id: 'legacy-source',
      campaignType: 'Full Campaign',
      promotedToCampaignRunId: 'run-1',
      scenarioName: 'Curtain Call',
    })
    const standalone = makePlaythrough({
      id: 'standalone',
      campaignType: 'Scenario Pack',
      campaignName: 'Curse of the Rougarou',
      scenarioName: 'Curse of the Rougarou',
    })
    const run: CampaignRun = {
      id: 'run-1',
      version: 1,
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      startedAt: '2026-08-10',
      updatedAt: '2026-08-12T00:00:00.000Z',
      status: 'active',
      sourcePlaythroughId: 'legacy-source',
      setupSnapshot: {
        date: '2026-08-10',
        investigators: promotedSource.investigators,
      },
      scenarioLogs: [
        {
          id: 'scenario-1',
          date: '2026-08-11',
          scenarioName: 'Curtain Call',
          investigators: promotedSource.investigators,
        },
      ],
    }

    const { result } = renderHook(() =>
      useCompletionStats([promotedSource, standalone], [run]),
    )

    expect(result.current.personal.total).toBe(2)
    expect(result.current.personal.campaignRunsPlayedCount).toBe(2)
    expect(result.current.personal.uniqueCampaignFamilyCount).toBe(2)
    expect(result.current.personal.breakdown).toEqual({
      fullCampaigns: 1,
      smallCampaigns: 0,
      scenarioPacks: 1,
      fanMade: 0,
    })
  })

  it('does not inflate campaign counts when adding child scenarios to an existing run', () => {
    const source = makePlaythrough({
      id: 'legacy-source',
      campaignType: 'Full Campaign',
      promotedToCampaignRunId: 'run-1',
      scenarioName: 'Curtain Call',
    })
    const runWithOneScenario: CampaignRun = {
      id: 'run-1',
      version: 2,
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      startedAt: '2026-08-10',
      updatedAt: '2026-08-12T00:00:00.000Z',
      status: 'active',
      sourcePlaythroughId: source.id,
      setupSnapshot: { date: '2026-08-10', investigators: source.investigators },
      currentRoster: [],
      scenarioLogs: [
        { id: 'scenario-1', date: '2026-08-11', scenarioName: 'Curtain Call', investigators: source.investigators },
      ],
    }
    const runWithTwoScenarios: CampaignRun = {
      ...runWithOneScenario,
      scenarioLogs: [
        ...runWithOneScenario.scenarioLogs,
        { id: 'scenario-2', date: '2026-08-12', scenarioName: 'The Last King', investigators: source.investigators },
      ],
    }

    const oneScenario = renderHook(() => useCompletionStats([source], [runWithOneScenario]))
    const twoScenarios = renderHook(() => useCompletionStats([source], [runWithTwoScenarios]))

    expect(oneScenario.result.current.personal.campaignRunsPlayedCount).toBe(1)
    expect(twoScenarios.result.current.personal.campaignRunsPlayedCount).toBe(1)
    expect(oneScenario.result.current.personal.uniqueCampaignFamilyCount).toBe(1)
    expect(twoScenarios.result.current.personal.uniqueCampaignFamilyCount).toBe(1)
  })

  it('counts two same-name runs as two runs while unique campaign family remains deduped', () => {
    const runA: CampaignRun = {
      id: 'run-a',
      version: 2,
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      startedAt: '2026-08-01',
      updatedAt: '2026-08-02T00:00:00.000Z',
      status: 'active',
      setupSnapshot: { date: '2026-08-01', investigators: makePlaythrough().investigators },
      scenarioLogs: [],
    }
    const runB: CampaignRun = {
      ...runA,
      id: 'run-b',
      startedAt: '2026-09-01',
      updatedAt: '2026-09-02T00:00:00.000Z',
    }

    const { result } = renderHook(() => useCompletionStats([], [runA, runB]))
    expect(result.current.personal.campaignRunsPlayedCount).toBe(2)
    expect(result.current.personal.uniqueCampaignFamilyCount).toBe(1)
  })
})
