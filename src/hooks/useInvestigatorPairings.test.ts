import { renderHook } from '@testing-library/react'
import { useInvestigatorPairings } from './useInvestigatorPairings'
import { Playthrough, InvestigatorAssignment } from '@/lib/types'

function makeInvestigator(name: string, overrides: Partial<InvestigatorAssignment> = {}): InvestigatorAssignment {
  return {
    playerName: 'Player',
    investigatorName: name,
    archetype: 'Guardian',
    ...overrides,
  }
}

function makePlaythrough(overrides: Partial<Playthrough> = {}): Playthrough {
  return {
    id: 'pt-1',
    date: '2026-01-15',
    campaignName: 'Night of the Zealot',
    campaignType: 'Full Campaign',
    investigators: [],
    ...overrides,
  }
}

describe('useInvestigatorPairings', () => {
  it('returns empty array when playthroughs is undefined', () => {
    const { result } = renderHook(() => useInvestigatorPairings(undefined))
    expect(result.current.personal).toEqual([])
  })

  it('returns empty array when playthroughs is empty', () => {
    const { result } = renderHook(() => useInvestigatorPairings([]))
    expect(result.current.personal).toEqual([])
  })

  it('produces no pairs for a solo (1 investigator) playthrough', () => {
    const playthroughs = [makePlaythrough({
      investigators: [makeInvestigator('Roland Banks')],
    })]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    expect(result.current.personal).toEqual([])
  })

  it('produces 1 pair for a 2-player game', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Roland Banks'),
        makeInvestigator('Daisy Walker'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    expect(result.current.personal).toHaveLength(1)
    expect(result.current.personal[0]).toEqual({
      investigators: ['Daisy Walker', 'Roland Banks'],
      count: 1,
    })
  })

  it('produces 3 pairs (C(3,2)) for a 3-player game', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Agnes Baker'),
        makeInvestigator('Daisy Walker'),
        makeInvestigator('Roland Banks'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    expect(result.current.personal).toHaveLength(3)
  })

  it('produces 6 pairs (C(4,2)) for a 4-player game', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Agnes Baker'),
        makeInvestigator('Daisy Walker'),
        makeInvestigator('Jenny Barnes'),
        makeInvestigator('Roland Banks'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    expect(result.current.personal).toHaveLength(6)
  })

  it('deduplicates investigators within the same playthrough', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Roland Banks'),
        makeInvestigator('Daisy Walker'),
        makeInvestigator('Roland Banks'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    expect(result.current.personal).toHaveLength(1)
    expect(result.current.personal[0].count).toBe(1)
  })

  it('filters out isUnknown investigators', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Roland Banks'),
        makeInvestigator('Mystery', { isUnknown: true }),
        makeInvestigator('Daisy Walker'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    expect(result.current.personal).toHaveLength(1)
    expect(result.current.personal[0].investigators).toEqual(['Daisy Walker', 'Roland Banks'])
  })

  it('filters out investigators with empty name', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Roland Banks'),
        makeInvestigator(''),
        makeInvestigator('Daisy Walker'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    expect(result.current.personal).toHaveLength(1)
    expect(result.current.personal[0].investigators).toEqual(['Daisy Walker', 'Roland Banks'])
  })

  it('filters out investigators named "Unknown"', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Roland Banks'),
        makeInvestigator('Unknown'),
        makeInvestigator('Daisy Walker'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    expect(result.current.personal).toHaveLength(1)
    expect(result.current.personal[0].investigators).toEqual(['Daisy Walker', 'Roland Banks'])
  })

  it('pair order is alphabetical (deterministic)', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Zoey Samaras'),
        makeInvestigator('Agnes Baker'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    expect(result.current.personal[0].investigators).toEqual(['Agnes Baker', 'Zoey Samaras'])
  })

  it('tie-breaking sorts alphabetically by first investigator', () => {
    const playthroughs = [
      makePlaythrough({ id: '1', investigators: [
        makeInvestigator('Zoey Samaras'),
        makeInvestigator('Agnes Baker'),
      ]}),
      makePlaythrough({ id: '2', investigators: [
        makeInvestigator('Daisy Walker'),
        makeInvestigator('Roland Banks'),
      ]}),
    ]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    // Both have count 1, so alphabetical by first investigator name
    expect(result.current.personal[0].investigators[0]).toBe('Agnes Baker')
    expect(result.current.personal[1].investigators[0]).toBe('Daisy Walker')
  })

  it('topN parameter limits results', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Agnes Baker'),
        makeInvestigator('Daisy Walker'),
        makeInvestigator('Jenny Barnes'),
        makeInvestigator('Roland Banks'),
      ],
    })]
    // 4 investigators = 6 pairs, limit to 2
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs, 2))
    expect(result.current.personal).toHaveLength(2)
  })

  it('keeps dual-chapter investigators distinct in personal pairings', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Daniela Reyes', { chapter: 1 }),
        makeInvestigator('Daniela Reyes', { chapter: 2 }),
        makeInvestigator('Roland Banks'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    expect(result.current.personal).toEqual(expect.arrayContaining([
      { investigators: ['Daniela Reyes (Ch. 1)', 'Daniela Reyes (Ch. 2)'], count: 1 },
      { investigators: ['Daniela Reyes (Ch. 1)', 'Roland Banks'], count: 1 },
      { investigators: ['Daniela Reyes (Ch. 2)', 'Roland Banks'], count: 1 },
    ]))
  })

  it('uses investigatorId to derive chapter for migrated dual-chapter pairings', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Daniela Reyes', { investigatorId: 'daniela-reyes-ch2' }),
        makeInvestigator('Roland Banks'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    expect(result.current.personal).toEqual([
      { investigators: ['Daniela Reyes (Ch. 2)', 'Roland Banks'], count: 1 },
    ])
  })

  it('multiple playthroughs accumulate pair counts', () => {
    const playthroughs = [
      makePlaythrough({ id: '1', investigators: [
        makeInvestigator('Roland Banks'),
        makeInvestigator('Daisy Walker'),
      ]}),
      makePlaythrough({ id: '2', investigators: [
        makeInvestigator('Roland Banks'),
        makeInvestigator('Daisy Walker'),
      ]}),
      makePlaythrough({ id: '3', investigators: [
        makeInvestigator('Agnes Baker'),
        makeInvestigator('Daisy Walker'),
      ]}),
    ]
    const { result } = renderHook(() => useInvestigatorPairings(playthroughs))
    // Roland+Daisy appears twice, Agnes+Daisy once
    expect(result.current.personal[0]).toEqual({
      investigators: ['Daisy Walker', 'Roland Banks'],
      count: 2,
    })
    expect(result.current.personal[1]).toEqual({
      investigators: ['Agnes Baker', 'Daisy Walker'],
      count: 1,
    })
  })
})
