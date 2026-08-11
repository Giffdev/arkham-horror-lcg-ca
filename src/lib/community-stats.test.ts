import { rebuildCommunityStats, getCommunityStats } from './community-stats'
import { Playthrough, InvestigatorAssignment } from './types'
import { getAllPlaythroughs, saveCommunityStats, getCommunityStatsFromFirestore } from './firestore'

vi.mock('./firestore', () => ({
  getAllPlaythroughs: vi.fn(),
  saveCommunityStats: vi.fn(() => Promise.resolve()),
  getCommunityStatsFromFirestore: vi.fn(),
}))

const mockGetAllPlaythroughs = vi.mocked(getAllPlaythroughs)
const mockSaveCommunityStats = vi.mocked(saveCommunityStats)
const mockGetCommunityStatsFromFirestore = vi.mocked(getCommunityStatsFromFirestore)

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

describe('rebuildCommunityStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps dual-chapter investigators distinct in community pairings and leaves single-chapter names plain', async () => {
    mockGetAllPlaythroughs.mockResolvedValue({
      userCount: 2,
      playthroughs: [
        makePlaythrough('pt-1', [
          makeInvestigator('Daniela Reyes', { chapter: 1 }),
          makeInvestigator('Roland Banks'),
        ]),
        makePlaythrough('pt-2', [
          makeInvestigator('Daniela Reyes', { chapter: 2 }),
          makeInvestigator('Roland Banks'),
        ]),
      ],
    })

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
    mockGetAllPlaythroughs.mockResolvedValue({
      userCount: 1,
      playthroughs: [
        makePlaythrough('pt-1', [
          makeInvestigator('Daniela Reyes', { investigatorId: 'daniela-reyes-ch2' }),
          makeInvestigator('Roland Banks'),
        ]),
      ],
    })

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
    mockGetAllPlaythroughs.mockResolvedValue({
      userCount: 1,
      playthroughs: [
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
      ],
    })
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
    mockGetAllPlaythroughs.mockResolvedValue({
      userCount: 1,
      playthroughs: [
        {
          id: 'fc-1', date: '2026-01-01',
          campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign',
          sideStories: ['Curse of the Rougarou', 'Carnevale of Horrors'],
          investigators: [makeInvestigator('Roland Banks')],
        },
      ],
    })
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    const entry = stats.topStandalones.find((e: { name: string }) => e.name === 'Curse of the Rougarou')
    expect(entry.count).toBe(1)
    expect(entry.breakdown.asStandalone).toBe(0)
    expect(entry.breakdown.asSideStory).toBe(1)
  })

  it('combines asStandalone + asSideStory into a single total count', async () => {
    mockGetAllPlaythroughs.mockResolvedValue({
      userCount: 1,
      playthroughs: [
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
      ],
    })
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    const entry = stats.topStandalones.find((e: { name: string }) => e.name === 'Curse of the Rougarou')
    expect(entry.count).toBe(2)
    expect(entry.breakdown.asStandalone).toBe(1)
    expect(entry.breakdown.asSideStory).toBe(1)
  })

  it('normalizes side-story keys (case/whitespace) but preserves canonical display name', async () => {
    mockGetAllPlaythroughs.mockResolvedValue({
      userCount: 1,
      playthroughs: [
        {
          id: 'fc-1', date: '2026-01-01',
          campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign',
          sideStories: ['  curse of the rougarou  '],
          investigators: [makeInvestigator('Roland Banks')],
        },
      ],
    })
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

  it('includes custom side-story entries that are not canonical scenario packs', async () => {
    mockGetAllPlaythroughs.mockResolvedValue({
      userCount: 1,
      playthroughs: [
        {
          id: 'fc-1', date: '2026-01-01',
          campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign',
          sideStories: ['My Custom Scenario'],
          investigators: [makeInvestigator('Roland Banks')],
        },
        {
          id: 'fc-2', date: '2026-01-02',
          campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign',
          sideStories: ['my custom scenario'],
          investigators: [makeInvestigator('Roland Banks')],
        },
      ],
    })
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    // Custom entry uses first-seen casing
    const sideEntry = stats.topSideScenarios.find((e: { name: string }) => e.name === 'My Custom Scenario')
    expect(sideEntry).toBeDefined()
    expect(sideEntry.count).toBe(2)
    // Should NOT appear in topStandalones
    const standaloneEntry = stats.topStandalones.find((e: { name: string }) => e.name === 'My Custom Scenario')
    expect(standaloneEntry).toBeUndefined()
  })

  it('excludes Scenario Pack playthroughs from topCampaigns', async () => {
    mockGetAllPlaythroughs.mockResolvedValue({
      userCount: 1,
      playthroughs: [
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
      ],
    })
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    const campaignNames = stats.topCampaigns.map((c: { name: string }) => c.name)
    expect(campaignNames).not.toContain('Curse of the Rougarou')
    expect(campaignNames).toContain('The Dunwich Legacy')
  })

  it('includes Full, Small, Return To, and Fan-Made in topCampaigns', async () => {
    mockGetAllPlaythroughs.mockResolvedValue({
      userCount: 1,
      playthroughs: [
        { id: 'a', date: '2026-01-01', campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign', investigators: [makeInvestigator('Roland Banks')] },
        { id: 'b', date: '2026-01-01', campaignName: 'The Night of the Zealot', campaignType: 'Small Campaign', investigators: [makeInvestigator('Roland Banks')] },
        { id: 'c', date: '2026-01-01', campaignName: 'Return to The Dunwich Legacy', campaignType: 'Full Campaign', investigators: [makeInvestigator('Roland Banks')] },
        { id: 'd', date: '2026-01-01', campaignName: 'My Fan Campaign', campaignType: 'Fan-Made', investigators: [makeInvestigator('Roland Banks')] },
      ],
    })
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    const names = stats.topCampaigns.map((c: { name: string }) => c.name)
    expect(names).toContain('The Dunwich Legacy')
    expect(names).toContain('The Night of the Zealot')
    expect(names).toContain('Return to The Dunwich Legacy')
    expect(names).toContain('My Fan Campaign')
  })

  it('caps topCampaigns, topInvestigators, topStandalones, topSideScenarios at 25', async () => {
    // Build 30 unique campaigns to test cap
    const playthroughs: Playthrough[] = Array.from({ length: 30 }, (_, i) => ({
      id: `p-${i}`, date: '2026-01-01',
      campaignName: `Campaign ${i}`, campaignType: 'Full Campaign' as const,
      investigators: [makeInvestigator('Roland Banks')],
    }))
    mockGetAllPlaythroughs.mockResolvedValue({ userCount: 1, playthroughs })
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    expect(stats.topCampaigns.length).toBeLessThanOrEqual(25)
    expect(stats.topInvestigators.length).toBeLessThanOrEqual(25)
  })

  it('caps topPairings at 200', async () => {
    // Create many unique investigators to generate many pairs
    const investigators = Array.from({ length: 30 }, (_, i) => makeInvestigator(`Investigator ${i}`))
    mockGetAllPlaythroughs.mockResolvedValue({
      userCount: 1,
      playthroughs: [
        { id: 'big', date: '2026-01-01', campaignName: 'Test', campaignType: 'Full Campaign', investigators },
      ],
    })
    await rebuildCommunityStats()
    const stats = mockSaveCommunityStats.mock.calls[0][0]
    // 30 investigators produce C(30,2) = 435 pairs; cap should be 200
    expect(stats.topPairings.length).toBeLessThanOrEqual(200)
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
