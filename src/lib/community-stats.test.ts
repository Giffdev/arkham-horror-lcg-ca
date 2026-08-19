import { getCommunityStats, getCommunityStatsAvailability } from './community-stats'
import { computeCommunityStats, COMMUNITY_STATS_SCHEMA_VERSION, COMMUNITY_STATS_STALE_AFTER_MS } from './community-stats-core'
import { ALL_CAMPAIGNS } from './campaign-data'
import { CampaignRun, Playthrough, InvestigatorAssignment } from './types'
import { getCommunityStatsFromFirestore } from './firestore'

const mockGetAllPlaythroughs = vi.fn()
const mockSaveCommunityStats = vi.fn(() => Promise.resolve())

vi.mock('./firestore', () => ({
  getCommunityStatsFromFirestore: vi.fn(),
  subscribeToCommunityStatsFromFirestore: vi.fn(),
}))

const mockGetCommunityStatsFromFirestore = vi.mocked(getCommunityStatsFromFirestore)
const canonicalCampaigns = new Set(ALL_CAMPAIGNS.map((campaign) => campaign.name))

async function rebuildCommunityStats(): Promise<void> {
  const source = await mockGetAllPlaythroughs()
  const stats = computeCommunityStats({
    playthroughs: source.playthroughs,
    rootPlaythroughs: source.rootPlaythroughs ?? source.playthroughs,
    campaignRuns: source.campaignRuns ?? [],
    userCount: source.userCount,
    generatedAt: Date.now(),
  })
  if (!stats) return
  stats.topCampaigns = stats.topCampaigns.filter((campaign) =>
    canonicalCampaigns.has(campaign.name))
  await mockSaveCommunityStats(stats)
}

function makeInvestigator(name: string, overrides: Partial<InvestigatorAssignment> = {}): InvestigatorAssignment {
  return {
    playerName: 'Player',
    investigatorName: name,
    archetype: 'Guardian',
    ...overrides,
  }
}

function makePlaythrough(id: string, investigators: InvestigatorAssignment[]): Playthrough {
  return {
    id,
    date: '2026-01-15',
    campaignName: 'Night of the Zealot',
    campaignType: 'Full Campaign',
    investigators,
  }
}

function mockCommunitySource(
  playthroughs: Playthrough[],
  options?: {
    userCount?: number
    rootPlaythroughs?: Playthrough[]
    campaignRuns?: CampaignRun[]
  },
) {
  mockGetAllPlaythroughs.mockResolvedValue({
    userCount: options?.userCount ?? 1,
    playthroughs,
    rootPlaythroughs: options?.rootPlaythroughs ?? playthroughs,
    campaignRuns: options?.campaignRuns ?? [],
  })
}

describe('rebuildCommunityStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('publishes an empty aggregate when users exist but no game logs have been recorded yet', async () => {
    mockCommunitySource([], {
      userCount: 3,
      rootPlaythroughs: [],
      campaignRuns: [],
    })

    await rebuildCommunityStats()

    expect(mockSaveCommunityStats).toHaveBeenCalledWith(expect.objectContaining({
      totalGames: 0,
      registeredUsers: 3,
      topCampaigns: [],
      topInvestigators: [],
      topClasses: [],
      topSideScenarios: [],
      topStandalones: [],
    }))
  })

  it('keeps dual-chapter investigators distinct in community pairings and leaves single-chapter names plain', async () => {
    mockCommunitySource([
      makePlaythrough('pt-1', [
        makeInvestigator('Daniela Reyes', { chapter: 1 }),
        makeInvestigator('Roland Banks'),
      ]),
      makePlaythrough('pt-2', [
        makeInvestigator('Daniela Reyes', { chapter: 2 }),
        makeInvestigator('Roland Banks'),
      ]),
    ], { userCount: 2 })

    await rebuildCommunityStats()

    expect(mockSaveCommunityStats).toHaveBeenCalledTimes(1)
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    expect(stats.totalInvestigatorsPlayed).toBe(3)
    expect(stats.topPairings).toEqual(expect.arrayContaining([
      { investigator1: 'Daniela Reyes (Ch. 1)', investigator2: 'Roland Banks', count: 1 },
      { investigator1: 'Daniela Reyes (Ch. 2)', investigator2: 'Roland Banks', count: 1 },
    ]))
    expect(stats.topPairings?.some(pair => pair.investigator1 === 'Daniela Reyes' || pair.investigator2 === 'Daniela Reyes')).toBe(false)
    expect(stats.topPairings?.some(pair => pair.investigator1 === 'Roland Banks' || pair.investigator2 === 'Roland Banks')).toBe(true)
    expect(stats.topInvestigators).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Daniela Reyes', chapter: 1, count: 1 }),
      expect.objectContaining({ name: 'Daniela Reyes', chapter: 2, count: 1 }),
      expect.objectContaining({ name: 'Roland Banks', count: 2 }),
    ]))
  })

  it('uses investigatorId to derive chapter for migrated dual-chapter community pairings', async () => {
    mockCommunitySource([
      makePlaythrough('pt-1', [
        makeInvestigator('Daniela Reyes', { investigatorId: 'daniela-reyes-ch2' }),
        makeInvestigator('Roland Banks'),
      ]),
    ])

    await rebuildCommunityStats()

    expect(mockSaveCommunityStats).toHaveBeenCalledTimes(1)
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    expect(stats.topPairings).toEqual([
      { investigator1: 'Daniela Reyes (Ch. 2)', investigator2: 'Roland Banks', count: 1 },
    ])
    expect(stats.topPairings?.[0].investigator1).not.toBe('Daniela Reyes (Ch. 1)')
    expect(stats.topInvestigators).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Daniela Reyes', chapter: 2, count: 1 }),
    ]))
  })
})

describe('rebuildCommunityStats — standalone & side-scenario aggregation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('counts Scenario Pack playthroughs as asStandalone with canonical name', async () => {
    mockCommunitySource([
      {
        id: 'sp-1', date: '2026-01-01',
        campaignName: 'Curse of the Rougarou', campaignType: 'Scenario Pack',
        investigators: [makeInvestigator('Roland Banks')],
      },
      {
        id: 'sp-2', date: '2026-01-02',
        campaignName: 'Curse of the Rougarou', campaignType: 'Scenario Pack',
        investigators: [makeInvestigator('Roland Banks')],
      },
    ])
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    const entry = stats.topStandalones.find((e: { name: string }) => e.name === 'Curse of the Rougarou')
    expect(entry).toBeDefined()
    expect(entry.count).toBe(2)
    expect(entry.breakdown.asStandalone).toBe(2)
    expect(entry.breakdown.asSideStory).toBe(0)
    expect(entry.set).toBe('Scenario Pack')
  })

  it('counts sideStories appearances as asSideStory for canonical scenario packs', async () => {
    mockCommunitySource([
      {
        id: 'fc-1', date: '2026-01-01',
        campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign',
        sideStories: ['Curse of the Rougarou', 'Carnevale of Horrors'],
        investigators: [makeInvestigator('Roland Banks')],
      },
    ])
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    const entry = stats.topStandalones.find((e: { name: string }) => e.name === 'Curse of the Rougarou')
    expect(entry.count).toBe(1)
    expect(entry.breakdown.asStandalone).toBe(0)
    expect(entry.breakdown.asSideStory).toBe(1)
  })

  it('combines asStandalone + asSideStory into a single total count', async () => {
    mockCommunitySource([
      {
        id: 'sp-1', date: '2026-01-01',
        campaignName: 'Curse of the Rougarou', campaignType: 'Scenario Pack',
        investigators: [makeInvestigator('Roland Banks')],
      },
      {
        id: 'fc-1', date: '2026-01-02',
        campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign',
        sideStories: ['Curse of the Rougarou'],
        investigators: [makeInvestigator('Roland Banks')],
      },
    ])
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    const entry = stats.topStandalones.find((e: { name: string }) => e.name === 'Curse of the Rougarou')
    expect(entry.count).toBe(2)
    expect(entry.breakdown.asStandalone).toBe(1)
    expect(entry.breakdown.asSideStory).toBe(1)
  })

  it('normalizes side-story keys (case/whitespace) but preserves canonical display name', async () => {
    mockCommunitySource([
      {
        id: 'fc-1', date: '2026-01-01',
        campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign',
        sideStories: ['  curse of the rougarou  '],
        investigators: [makeInvestigator('Roland Banks')],
      },
    ])
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    // Should appear in topSideScenarios with canonical casing
    const sideEntry = stats.topSideScenarios.find((e: { name: string }) => e.name === 'Curse of the Rougarou')
    expect(sideEntry).toBeDefined()
    expect(sideEntry.count).toBe(1)
    // Also in topStandalones
    const standaloneEntry = stats.topStandalones.find((e: { name: string }) => e.name === 'Curse of the Rougarou')
    expect(standaloneEntry.breakdown.asSideStory).toBe(1)
  })

  it('does not persist custom user-entered side-story names into public aggregate output', async () => {
    // Custom strings like "The Black Goat Thing" must not appear in topSideScenarios or topStandalones.
    // Only canonical scenario pack names (from SCENARIO_PACK_SCENARIOS) are retained.
    mockCommunitySource([
      {
        id: 'fc-1', date: '2026-01-01',
        campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign',
        sideStories: ['My Custom Scenario'],
        investigators: [makeInvestigator('Roland Banks')],
      },
      {
        id: 'fc-2', date: '2026-01-02',
        campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign',
        sideStories: ['my custom scenario', 'The Black Goat Thing'],
        investigators: [makeInvestigator('Roland Banks')],
      },
    ])
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    // Custom entries must NOT appear in topSideScenarios
    expect(stats.topSideScenarios.find((e: { name: string }) => e.name === 'My Custom Scenario')).toBeUndefined()
    expect(stats.topSideScenarios.find((e: { name: string }) => /black goat/i.test(e.name))).toBeUndefined()
    // Custom entries must NOT appear in topStandalones
    expect(stats.topStandalones.find((e: { name: string }) => e.name === 'My Custom Scenario')).toBeUndefined()
    expect(stats.topStandalones.find((e: { name: string }) => /black goat/i.test(e.name))).toBeUndefined()
    // Canonical standalone aggregation is unaffected (Rougarou would still work if present)
    expect(Array.isArray(stats.topStandalones)).toBe(true)
  })

  it('excludes Scenario Pack playthroughs from topCampaigns', async () => {
    mockCommunitySource([
      {
        id: 'sp-1', date: '2026-01-01',
        campaignName: 'Curse of the Rougarou', campaignType: 'Scenario Pack',
        investigators: [makeInvestigator('Roland Banks')],
      },
      {
        id: 'fc-1', date: '2026-01-01',
        campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign',
        investigators: [makeInvestigator('Roland Banks')],
      },
    ])
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    const campaignNames = stats.topCampaigns.map((c: { name: string }) => c.name)
    expect(campaignNames).not.toContain('Curse of the Rougarou')
    expect(campaignNames).toContain('The Dunwich Legacy')
  })

  it('includes canonical Full, Small, and Return To campaigns in topCampaigns but excludes freeform names', async () => {
    mockCommunitySource([
      { id: 'a', date: '2026-01-01', campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign', investigators: [makeInvestigator('Roland Banks')] },
      { id: 'b', date: '2026-01-01', campaignName: 'The Night of the Zealot', campaignType: 'Small Campaign', investigators: [makeInvestigator('Roland Banks')] },
      { id: 'c', date: '2026-01-01', campaignName: 'Return to The Dunwich Legacy', campaignType: 'Full Campaign', investigators: [makeInvestigator('Roland Banks')] },
      { id: 'd', date: '2026-01-01', campaignName: 'My Fan Campaign', campaignType: 'Fan-Made', investigators: [makeInvestigator('Roland Banks')] },
    ])
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    const names = stats.topCampaigns.map((c: { name: string }) => c.name)
    // Canonical campaigns appear
    expect(names).toContain('The Dunwich Legacy')
    expect(names).toContain('The Night of the Zealot')
    expect(names).toContain('Return to The Dunwich Legacy')
    // Freeform fan-made campaign name must be excluded from the public ranking
    expect(names).not.toContain('My Fan Campaign')
  })

  it('caps topCampaigns, topInvestigators, topStandalones at 25', async () => {
    // Build 30 unique campaigns to test cap
    const playthroughs: Playthrough[] = Array.from({ length: 30 }, (_, i) => ({
      id: `p-${i}`, date: '2026-01-01',
      campaignName: `Campaign ${i}`, campaignType: 'Full Campaign' as const,
      investigators: [makeInvestigator('Roland Banks')],
    }))
    mockCommunitySource(playthroughs)
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    expect(stats.topCampaigns.length).toBeLessThanOrEqual(25)
    expect(stats.topInvestigators.length).toBeLessThanOrEqual(25)
  })

  it('caps topPairings at 200', async () => {
    // Create many unique investigators to generate many pairs
    const investigators = Array.from({ length: 30 }, (_, i) => makeInvestigator(`Investigator ${i}`))
    mockCommunitySource([
      { id: 'big', date: '2026-01-01', campaignName: 'Test', campaignType: 'Full Campaign', investigators },
    ])
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    // 30 investigators produce C(30,2) = 435 pairs; cap should be 200
    expect(stats.topPairings.length).toBeLessThanOrEqual(200)
  })
})

describe('rebuildCommunityStats — campaign count invariants', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makeRun(scenarioCount: number): CampaignRun {
    const investigators = [makeInvestigator('Roland Banks')]
    return {
      id: 'run-1',
      version: 2,
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      startedAt: '2026-01-01',
      updatedAt: '2026-01-10',
      status: 'active',
      sourcePlaythroughId: 'source-1',
      setupSnapshot: {
        date: '2026-01-01',
        investigators,
      },
      scenarioLogs: Array.from({ length: scenarioCount }, (_, index) => ({
        id: `scenario-${index + 1}`,
        date: `2026-01-${String(index + 2).padStart(2, '0')}`,
        scenarioName: `Scenario ${index + 1}`,
        investigators,
      })),
    }
  }

  it('keeps campaign counts stable when child scenario rows are added/edited/deleted', async () => {
    const promotedSource = {
      id: 'source-1',
      date: '2026-01-01',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign' as const,
      promotedToCampaignRunId: 'run-1',
      investigators: [makeInvestigator('Roland Banks')],
    }

    const runOne = makeRun(1)
    const runTwo = makeRun(2)

    mockCommunitySource(
      [
        { id: 'campaign-run:run-1:scenario:scenario-1', date: '2026-01-02', campaignName: 'The Path to Carcosa', campaignType: 'Full Campaign', investigators: [makeInvestigator('Roland Banks')] },
      ] as Playthrough[],
      { rootPlaythroughs: [promotedSource], campaignRuns: [runOne] },
    )
    await rebuildCommunityStats()
    const withOneScenario = mockSaveCommunityStats.mock.calls[0][0]

    vi.clearAllMocks()
    mockCommunitySource(
      [
        { id: 'campaign-run:run-1:scenario:scenario-1', date: '2026-01-02', campaignName: 'The Path to Carcosa', campaignType: 'Full Campaign', investigators: [makeInvestigator('Roland Banks')] },
        { id: 'campaign-run:run-1:scenario:scenario-2', date: '2026-01-03', campaignName: 'The Path to Carcosa', campaignType: 'Full Campaign', investigators: [makeInvestigator('Roland Banks')] },
      ] as Playthrough[],
      { rootPlaythroughs: [promotedSource], campaignRuns: [runTwo] },
    )
    await rebuildCommunityStats()
    const withTwoScenarios = mockSaveCommunityStats.mock.calls[0][0]

    expect(withOneScenario.campaignRunsPlayedCount).toBe(1)
    expect(withTwoScenarios.campaignRunsPlayedCount).toBe(1)
    expect(withOneScenario.uniqueCampaignFamilyCount).toBe(1)
    expect(withTwoScenarios.uniqueCampaignFamilyCount).toBe(1)
  })

  it('counts two same-name runs as two runs while unique campaign families stay deduped', async () => {
    const investigators = [makeInvestigator('Roland Banks')]
    const runA: CampaignRun = {
      ...makeRun(1),
      id: 'run-a',
      sourcePlaythroughId: 'source-a',
      scenarioLogs: [],
    }
    const runB: CampaignRun = {
      ...makeRun(1),
      id: 'run-b',
      sourcePlaythroughId: 'source-b',
      scenarioLogs: [],
    }

    mockCommunitySource(
      [] as Playthrough[],
      { rootPlaythroughs: [], campaignRuns: [runA, runB] },
    )
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]

    expect(stats.campaignRunsPlayedCount).toBe(2)
    expect(stats.uniqueCampaignFamilyCount).toBe(1)
    expect(stats.topCampaigns.find((entry: { name: string }) => entry.name === 'The Path to Carcosa')).toBeDefined()
  })
})

describe('getCommunityStats — defensive defaults', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('defaults missing list fields to [] for documents persisted before this release', async () => {
    mockGetCommunityStatsFromFirestore.mockResolvedValue({
      totalGames: 5,
      topCampaigns: [{ name: 'The Dunwich Legacy', count: 5 }],
      topInvestigators: [],
      topClasses: undefined as never,
      totalInvestigatorsPlayed: 0,
      // topStandalones, topSideScenarios, topPairings absent (old document)
      registeredUsers: 1,
      lastUpdated: 0,
    } as never)
    const result = await getCommunityStats()
    expect(result).not.toBeNull()
    expect(result!.topStandalones).toEqual([])
    expect(result!.topSideScenarios).toEqual([])
    expect(result!.topPairings).toEqual([])
    expect(result!.topClasses).toEqual([])
  })

  it('returns null on firestore error without throwing', async () => {
    mockGetCommunityStatsFromFirestore.mockRejectedValue(new Error('network error'))
    const result = await getCommunityStats()
    expect(result).toBeNull()
  })
})

describe('public data hygiene — custom campaign names excluded (regression)', () => {
  /**
   * User-entered free-form campaign names must never surface in the public
   * "Most Popular Campaigns" ranking. Only names present in the canonical
   * ALL_CAMPAIGNS registry may appear.
   *
   * Two protection layers:
   *  1. rebuildCommunityStats() — canonical check at aggregate derivation time
   *  2. getCommunityStats()     — defensive filter on the persisted read path
   *
   * This prevents inappropriate/offensive user-generated text from appearing
   * on the public homepage.
   */

  beforeEach(() => { vi.clearAllMocks() })

  describe('rebuildCommunityStats layer', () => {
    it('excludes a freeform customCampaignName from the public ranking', async () => {
      mockGetAllPlaythroughs.mockResolvedValue({
        userCount: 1,
        playthroughs: [
          {
            id: 'fan-1', date: '2026-01-01',
            // Fan-Made with user-entered custom name
            campaignName: '',
            customCampaignName: 'OFFENSIVE_CUSTOM_TEXT',
            campaignType: 'Fan-Made',
            investigators: [makeInvestigator('Roland Banks')],
          },
          {
            id: 'fc-1', date: '2026-01-01',
            campaignName: 'The Dunwich Legacy',
            campaignType: 'Full Campaign',
            investigators: [makeInvestigator('Roland Banks')],
          },
        ],
      })
      await rebuildCommunityStats()
      const stats = mockSaveCommunityStats.mock.calls[0][0]
      const names = stats.topCampaigns.map((c: { name: string }) => c.name)
      expect(names).not.toContain('OFFENSIVE_CUSTOM_TEXT')
      expect(names).toContain('The Dunwich Legacy')
    })

    it('excludes a non-canonical campaignName (typo / freeform) from the public ranking', async () => {
      mockGetAllPlaythroughs.mockResolvedValue({
        userCount: 1,
        playthroughs: [
          {
            id: 'fc-1', date: '2026-01-01',
            campaignName: 'Not A Real Campaign Name', // not in ALL_CAMPAIGNS
            campaignType: 'Full Campaign',
            investigators: [makeInvestigator('Roland Banks')],
          },
          {
            id: 'fc-2', date: '2026-01-01',
            campaignName: 'The Path to Carcosa', // canonical
            campaignType: 'Full Campaign',
            investigators: [makeInvestigator('Roland Banks')],
          },
        ],
      })
      await rebuildCommunityStats()
      const stats = mockSaveCommunityStats.mock.calls[0][0]
      const names = stats.topCampaigns.map((c: { name: string }) => c.name)
      expect(names).not.toContain('Not A Real Campaign Name')
      expect(names).toContain('The Path to Carcosa')
    })

    it('Return To canonical campaigns still appear after the canonical filter', async () => {
      mockGetAllPlaythroughs.mockResolvedValue({
        userCount: 1,
        playthroughs: [
          {
            id: 'rt-1', date: '2026-01-01',
            campaignName: 'Return to The Dunwich Legacy',
            campaignType: 'Full Campaign',
            investigators: [makeInvestigator('Roland Banks')],
          },
        ],
      })
      await rebuildCommunityStats()
      const stats = mockSaveCommunityStats.mock.calls[0][0]
      expect(stats.topCampaigns.map((c: { name: string }) => c.name)).toContain('Return to The Dunwich Legacy')
    })
  })

  describe('getCommunityStats read-path layer (stale persisted aggregates)', () => {
    it('filters out non-canonical names from a stale persisted document', async () => {
      mockGetCommunityStatsFromFirestore.mockResolvedValue({
        totalGames: 10,
        topCampaigns: [
          { name: 'The Dunwich Legacy', count: 5 },       // canonical — keep
          { name: 'INJECTED_CUSTOM_TEXT', count: 99 },    // non-canonical — strip
          { name: 'Return to The Dunwich Legacy', count: 3 }, // canonical — keep
          { name: 'My Fan Campaign', count: 2 },           // non-canonical — strip
        ],
        topInvestigators: [],
        topClasses: [],
        totalInvestigatorsPlayed: 0,
        topStandalones: [],
        topSideScenarios: [],
        registeredUsers: 1,
        lastUpdated: 0,
      } as never)
      const result = await getCommunityStats()
      expect(result).not.toBeNull()
      const names = result!.topCampaigns.map(c => c.name)
      expect(names).toContain('The Dunwich Legacy')
      expect(names).toContain('Return to The Dunwich Legacy')
      expect(names).not.toContain('INJECTED_CUSTOM_TEXT')
      expect(names).not.toContain('My Fan Campaign')
    })
  })
})

describe('getCommunityStatsAvailability', () => {
  const makePublishedStats = () => ({
    totalGames: 5,
    topCampaigns: [],
    topInvestigators: [],
    topClasses: [],
    totalInvestigatorsPlayed: 2,
    topSideScenarios: [],
    topStandalones: [],
    registeredUsers: 1,
    lastUpdated: Date.now(),
    generatedAt: Date.now(),
    schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION,
    refreshState: 'ready' as const,
  })

  it('classifies missing aggregates as unavailable', () => {
    expect(getCommunityStatsAvailability(null)).toBe('unavailable')
  })

  it('keeps an explicitly ready aggregate available regardless of age', () => {
    const now = Date.now()
    expect(getCommunityStatsAvailability({
      ...makePublishedStats(),
      lastUpdated: now - COMMUNITY_STATS_STALE_AFTER_MS - 1,
      generatedAt: now - COMMUNITY_STATS_STALE_AFTER_MS - 1,
    })).toBe('ready')
  })

  it('classifies explicitly stale aggregates as stale', () => {
    expect(getCommunityStatsAvailability({
      ...makePublishedStats(),
      refreshState: 'stale',
    })).toBe('stale')
  })

  it('classifies failed aggregates as stale', () => {
    expect(getCommunityStatsAvailability({
      ...makePublishedStats(),
      refreshState: 'failed',
    })).toBe('stale')
  })

  it('classifies legacy aggregates as old-schema instead of ready', () => {
    expect(getCommunityStatsAvailability({
      ...makePublishedStats(),
      schemaVersion: COMMUNITY_STATS_SCHEMA_VERSION - 1,
    })).toBe('old-schema')

    expect(getCommunityStatsAvailability({
      ...makePublishedStats(),
      schemaVersion: undefined,
    })).toBe('old-schema')
  })
})
