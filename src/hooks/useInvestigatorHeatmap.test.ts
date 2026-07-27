import { renderHook } from '@testing-library/react'
import { useInvestigatorHeatmap, buildHeatmapFromPairings, HeatmapData } from './useInvestigatorHeatmap'
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

describe('buildHeatmapFromPairings', () => {
  it('returns empty structure for empty input', () => {
    const result = buildHeatmapFromPairings([])
    expect(result).toEqual({ investigators: [], matrix: [], maxCount: 0 })
  })

  it('builds a 2x2 matrix from a single pair', () => {
    const result = buildHeatmapFromPairings([
      { name1: 'Agnes Baker', name2: 'Roland Banks', count: 3 },
    ])
    expect(result.investigators).toEqual(['Agnes Baker', 'Roland Banks'])
    expect(result.matrix).toEqual([
      [0, 3],
      [3, 0],
    ])
    expect(result.maxCount).toBe(3)
  })

  it('builds a symmetric matrix from multiple pairs', () => {
    const result = buildHeatmapFromPairings([
      { name1: 'Agnes Baker', name2: 'Daisy Walker', count: 2 },
      { name1: 'Agnes Baker', name2: 'Roland Banks', count: 1 },
      { name1: 'Daisy Walker', name2: 'Roland Banks', count: 4 },
    ])
    expect(result.investigators).toEqual(['Agnes Baker', 'Daisy Walker', 'Roland Banks'])
    // Symmetry check
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(result.matrix[i][j]).toBe(result.matrix[j][i])
      }
    }
    expect(result.matrix[0][1]).toBe(2) // Agnes-Daisy
    expect(result.matrix[0][2]).toBe(1) // Agnes-Roland
    expect(result.matrix[1][2]).toBe(4) // Daisy-Roland
    expect(result.maxCount).toBe(4)
  })

  it('sorts investigators alphabetically', () => {
    const result = buildHeatmapFromPairings([
      { name1: 'Zoey Samaras', name2: 'Agnes Baker', count: 1 },
    ])
    expect(result.investigators).toEqual(['Agnes Baker', 'Zoey Samaras'])
  })

  it('diagonal is always zero (no self-pairing)', () => {
    const result = buildHeatmapFromPairings([
      { name1: 'Agnes Baker', name2: 'Daisy Walker', count: 5 },
      { name1: 'Daisy Walker', name2: 'Roland Banks', count: 3 },
    ])
    for (let i = 0; i < result.investigators.length; i++) {
      expect(result.matrix[i][i]).toBe(0)
    }
  })
})

describe('useInvestigatorHeatmap', () => {
  it('returns empty heatmap when playthroughs is undefined', () => {
    const { result } = renderHook(() => useInvestigatorHeatmap(undefined))
    expect(result.current).toEqual({ investigators: [], matrix: [], maxCount: 0 })
  })

  it('returns empty heatmap when playthroughs is empty', () => {
    const { result } = renderHook(() => useInvestigatorHeatmap([]))
    expect(result.current).toEqual({ investigators: [], matrix: [], maxCount: 0 })
  })

  it('builds a 2x2 matrix from a single 2-player game', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Roland Banks'),
        makeInvestigator('Daisy Walker'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorHeatmap(playthroughs))
    expect(result.current.investigators).toEqual(['Daisy Walker', 'Roland Banks'])
    expect(result.current.matrix).toEqual([
      [0, 1],
      [1, 0],
    ])
    expect(result.current.maxCount).toBe(1)
  })

  it('accumulates counts across multiple playthroughs', () => {
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
    const { result } = renderHook(() => useInvestigatorHeatmap(playthroughs))
    expect(result.current.investigators).toEqual(['Agnes Baker', 'Daisy Walker', 'Roland Banks'])
    // Agnes-Daisy: 1, Daisy-Roland: 2
    expect(result.current.matrix[0][1]).toBe(1) // Agnes-Daisy
    expect(result.current.matrix[1][2]).toBe(2) // Daisy-Roland
    expect(result.current.maxCount).toBe(2)
  })

  it('matrix is symmetric', () => {
    const playthroughs = [
      makePlaythrough({ id: '1', investigators: [
        makeInvestigator('Agnes Baker'),
        makeInvestigator('Daisy Walker'),
        makeInvestigator('Roland Banks'),
      ]}),
      makePlaythrough({ id: '2', investigators: [
        makeInvestigator('Agnes Baker'),
        makeInvestigator('Roland Banks'),
      ]}),
    ]
    const { result } = renderHook(() => useInvestigatorHeatmap(playthroughs))
    const { matrix } = result.current
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix.length; j++) {
        expect(matrix[i][j]).toBe(matrix[j][i])
      }
    }
  })

  it('maxCount is accurate', () => {
    const playthroughs = [
      makePlaythrough({ id: '1', investigators: [
        makeInvestigator('Agnes Baker'),
        makeInvestigator('Daisy Walker'),
      ]}),
      makePlaythrough({ id: '2', investigators: [
        makeInvestigator('Agnes Baker'),
        makeInvestigator('Daisy Walker'),
      ]}),
      makePlaythrough({ id: '3', investigators: [
        makeInvestigator('Agnes Baker'),
        makeInvestigator('Daisy Walker'),
      ]}),
    ]
    const { result } = renderHook(() => useInvestigatorHeatmap(playthroughs))
    expect(result.current.maxCount).toBe(3)
  })

  it('filters out isUnknown, empty, and "Unknown" investigators', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Roland Banks'),
        makeInvestigator('', {}),
        makeInvestigator('Unknown'),
        makeInvestigator('Mystery', { isUnknown: true }),
        makeInvestigator('Daisy Walker'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorHeatmap(playthroughs))
    expect(result.current.investigators).toEqual(['Daisy Walker', 'Roland Banks'])
    expect(result.current.matrix).toEqual([
      [0, 1],
      [1, 0],
    ])
  })

  it('keeps dual-chapter investigators as distinct heatmap entries', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Daniela Reyes', { chapter: 1 }),
        makeInvestigator('Daniela Reyes', { chapter: 2 }),
        makeInvestigator('Roland Banks'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorHeatmap(playthroughs))
    expect(result.current.investigators).toEqual([
      'Daniela Reyes (Ch. 1)',
      'Daniela Reyes (Ch. 2)',
      'Roland Banks',
    ])
    expect(result.current.matrix[0][1]).toBe(1)
    expect(result.current.matrix[0][2]).toBe(1)
    expect(result.current.matrix[1][2]).toBe(1)
  })

  it('uses investigatorId to derive chapter for migrated dual-chapter records', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Daniela Reyes', { investigatorId: 'daniela-reyes-ch2' }),
        makeInvestigator('Roland Banks'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorHeatmap(playthroughs))
    expect(result.current.investigators).toEqual(['Daniela Reyes (Ch. 2)', 'Roland Banks'])
    expect(result.current.investigators).not.toContain('Daniela Reyes (Ch. 1)')
    expect(result.current.matrix).toEqual([
      [0, 1],
      [1, 0],
    ])
  })

  it('keeps single-chapter investigator labels unsuffixed', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Roland Banks'),
        makeInvestigator('Daisy Walker'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorHeatmap(playthroughs))
    expect(result.current.investigators).toEqual(['Daisy Walker', 'Roland Banks'])
    expect(result.current.investigators.some(name => name.includes('(Ch.'))).toBe(false)
  })

  it('handles 4-player game producing a 4x4 matrix', () => {
    const playthroughs = [makePlaythrough({
      investigators: [
        makeInvestigator('Agnes Baker'),
        makeInvestigator('Daisy Walker'),
        makeInvestigator('Jenny Barnes'),
        makeInvestigator('Roland Banks'),
      ],
    })]
    const { result } = renderHook(() => useInvestigatorHeatmap(playthroughs))
    expect(result.current.investigators).toHaveLength(4)
    expect(result.current.matrix).toHaveLength(4)
    expect(result.current.matrix[0]).toHaveLength(4)
    // All off-diagonal cells should be 1 (everyone paired with everyone once)
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(result.current.matrix[i][j]).toBe(i === j ? 0 : 1)
      }
    }
    expect(result.current.maxCount).toBe(1)
  })
})
