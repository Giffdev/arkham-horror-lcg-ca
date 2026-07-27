import { rebuildCommunityStats } from './community-stats'
import { Playthrough, InvestigatorAssignment } from './types'
import { getAllPlaythroughs, saveCommunityStats } from './firestore'

vi.mock('./firestore', () => ({
  getAllPlaythroughs: vi.fn(),
  saveCommunityStats: vi.fn(() => Promise.resolve()),
  getCommunityStatsFromFirestore: vi.fn(),
}))

const mockGetAllPlaythroughs = vi.mocked(getAllPlaythroughs)
const mockSaveCommunityStats = vi.mocked(saveCommunityStats)

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
