import { describe, expect, it } from 'vitest'

import { buildCommunityStatsContribution } from './community-stats-contributions'
import type { CampaignRun, Playthrough } from '../src/lib/types'

const investigator = {
  playerName: 'Player',
  investigatorName: 'Roland Banks',
  investigatorId: '01001',
  archetype: 'Guardian' as const,
}

describe('community stats per-user contributions', () => {
  it('counts nested side scenarios as game nights but not additional campaigns', () => {
    const campaignRun: CampaignRun = {
      id: 'run-1',
      version: 2,
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      startedAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
      status: 'active',
      setupSnapshot: {
        date: '2026-08-01',
        investigators: [investigator],
      },
      scenarioLogs: [
        {
          id: 'main',
          date: '2026-08-01',
          scenarioName: 'Curtain Call',
          scenarioType: 'standard',
          investigators: [investigator],
        },
        {
          id: 'side',
          date: '2026-08-02',
          scenarioName: 'Curse of the Rougarou',
          scenarioType: 'side_scenario',
          investigators: [investigator],
        },
      ],
    }

    const contribution = buildCommunityStatsContribution({
      playthroughs: [],
      campaignRuns: [campaignRun],
      generatedAt: 1,
    })

    expect(contribution.totalGames).toBe(2)
    expect(contribution.campaignRunsPlayedCount).toBe(1)
    expect(contribution.campaigns).toEqual([
      expect.objectContaining({ name: 'The Path to Carcosa', count: 1 }),
    ])
    expect(contribution.standalones).toEqual([
      expect.objectContaining({
        name: 'Curse of the Rougarou',
        count: 1,
        breakdown: { asStandalone: 0, asSideStory: 1 },
      }),
    ])
    expect(contribution.sideScenarios).toEqual([
      { name: 'Curse of the Rougarou', count: 1 },
    ])
  })

  it('stores only canonical public dimensions, not freeform source text', () => {
    const playthrough: Playthrough = {
      id: 'custom',
      date: '2026-08-01',
      campaignName: 'PRIVATE CUSTOM CAMPAIGN',
      campaignType: 'Fan-Made',
      investigators: [{
        playerName: 'PRIVATE PLAYER',
        investigatorName: 'PRIVATE INVESTIGATOR',
        archetype: 'Guardian',
      }],
      sideStories: ['PRIVATE SIDE STORY'],
      notes: 'PRIVATE NOTES',
    }

    const contribution = buildCommunityStatsContribution({
      playthroughs: [playthrough],
      campaignRuns: [],
      generatedAt: 1,
    })
    const serialized = JSON.stringify(contribution)

    expect(serialized).not.toContain('PRIVATE')
    expect(contribution.totalGames).toBe(1)
    expect(contribution.completionBreakdown.fanMade).toBe(1)
  })

  it('marks owners without source records as non-contributing', () => {
    const contribution = buildCommunityStatsContribution({
      playthroughs: [],
      campaignRuns: [],
      generatedAt: 1,
    })

    expect(contribution.hasSourceRecords).toBe(false)
  })
})
