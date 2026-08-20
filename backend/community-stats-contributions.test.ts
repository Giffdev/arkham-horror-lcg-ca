import { describe, expect, it } from 'vitest'

import {
  buildCommunityStatsContribution,
  COMMUNITY_STATS_SCHEMA_VERSION,
  mergeCommunityStatsContributions,
} from './community-stats-contributions'
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
    expect(contribution.schemaVersion).toBe(4)
    expect(contribution.schemaVersion).toBe(COMMUNITY_STATS_SCHEMA_VERSION)
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

  it.each([
    ['Roland Banks'],
    ['PRIVATE FREEFORM INVESTIGATOR'],
  ])('keeps stable custom investigator "%s" out of public investigator dimensions', (investigatorName) => {
    const contribution = buildCommunityStatsContribution({
      playthroughs: [{
        id: 'custom-investigator',
        date: '2026-08-01',
        campaignName: 'The Path to Carcosa',
        campaignType: 'Full Campaign',
        investigators: [{
          playerName: 'Player',
          investigatorName,
          investigatorId: 'stable-custom-id',
          isCustom: true,
          archetype: 'Guardian',
        }],
      }],
      campaignRuns: [],
      generatedAt: 1,
    })

    expect(contribution.investigators).toEqual([])
    expect(contribution.pairings).toEqual([])
    expect(contribution.classes).toContainEqual({ archetype: 'Guardian', count: 1 })
    expect(JSON.stringify({
      investigators: contribution.investigators,
      pairings: contribution.pairings,
    })).not.toContain(investigatorName)
  })

  it('emits campaign-grain investigator, class, and pairing contributions', () => {
    const daisy = {
      playerName: 'Player 2',
      investigatorName: 'Daisy Walker',
      investigatorId: '01002',
      archetype: 'Seeker' as const,
    }
    const campaignRun: CampaignRun = {
      id: 'run-campaign-grain',
      version: 2,
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      startedAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
      status: 'active',
      setupSnapshot: {
        date: '2026-08-01',
        investigators: [investigator, daisy],
      },
      scenarioLogs: [
        {
          id: 'one',
          date: '2026-08-01',
          scenarioName: 'Curtain Call',
          investigators: [investigator, daisy],
        },
        {
          id: 'two',
          date: '2026-08-02',
          scenarioName: 'The Last King',
          investigators: [investigator, daisy],
        },
      ],
    }

    const contribution = buildCommunityStatsContribution({
      playthroughs: [],
      campaignRuns: [campaignRun],
      generatedAt: 1,
    })

    expect(contribution.investigators).toEqual(expect.arrayContaining([
      expect.objectContaining({ investigatorId: 'roland-banks', count: 1 }),
      expect.objectContaining({ investigatorId: 'daisy-walker', count: 1 }),
    ]))
    expect(contribution.classes).toEqual(expect.arrayContaining([
      { archetype: 'Guardian', count: 1 },
      { archetype: 'Seeker', count: 1 },
    ]))
    expect(contribution.pairings).toEqual([
      { investigator1: 'Daisy Walker', investigator2: 'Roland Banks', count: 1 },
    ])
  })

  it('marks owners without source records as non-contributing', () => {
    const contribution = buildCommunityStatsContribution({
      playthroughs: [],
      campaignRuns: [],
      generatedAt: 1,
    })

    expect(contribution.hasSourceRecords).toBe(false)
  })

  it('counts an empty registered owner and preserves that count across contribution replacement', () => {
    const empty = buildCommunityStatsContribution({
      playthroughs: [],
      campaignRuns: [],
      generatedAt: 1,
    })
    const aggregate = mergeCommunityStatsContributions([empty], 2)

    expect(aggregate).toMatchObject({
      registeredUsers: 1,
      totalGames: 0,
    })

    const withGame = buildCommunityStatsContribution({
      playthroughs: [{
        id: 'game-1',
        date: '2026-08-01',
        campaignName: 'The Path to Carcosa',
        campaignType: 'Full Campaign',
        investigators: [investigator],
      }],
      campaignRuns: [],
      generatedAt: 3,
    })

    expect(mergeCommunityStatsContributions([withGame], 4)).toMatchObject({
      registeredUsers: 1,
      totalGames: 1,
    })
    expect(mergeCommunityStatsContributions([empty], 5)).toMatchObject({
      registeredUsers: 1,
      totalGames: 0,
    })
  })

  it('refuses to publish mixed contribution schemas until the trusted bootstrap rebuilds every owner', () => {
    const current = buildCommunityStatsContribution({
      playthroughs: [],
      campaignRuns: [],
      generatedAt: 1,
    })
    const legacy = {
      ...current,
      schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION - 1,
    }

    expect(() => mergeCommunityStatsContributions([legacy, current], 2))
      .toThrow(/incompatible schema versions: 3/i)
  })
})
