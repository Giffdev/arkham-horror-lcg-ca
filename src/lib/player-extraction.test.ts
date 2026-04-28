import { Playthrough } from '@/lib/types'

/**
 * Tests for the player extraction logic used in App.tsx.
 * The logic extracts unique, non-empty player names from playthroughs.
 * We replicate the exact algorithm here to validate edge cases.
 */
function extractUniquePlayers(playthroughs: Playthrough[] | undefined): string[] {
  if (!playthroughs) return []
  const playerSet = new Set<string>()
  playthroughs.forEach(playthrough => {
    playthrough.investigators.forEach(inv => {
      if (inv.playerName.trim()) {
        playerSet.add(inv.playerName)
      }
    })
  })
  return Array.from(playerSet).sort((a, b) => a.localeCompare(b))
}

function makePlaythrough(id: string, investigators: { playerName: string; investigatorName: string }[]): Playthrough {
  return {
    id,
    date: '2026-01-15',
    campaignName: 'Night of the Zealot',
    campaignType: 'Full Campaign',
    investigators: investigators.map(inv => ({
      ...inv,
      archetype: 'Guardian' as const,
    })),
  }
}

describe('player extraction logic', () => {
  it('returns empty array for undefined playthroughs', () => {
    expect(extractUniquePlayers(undefined)).toEqual([])
  })

  it('returns empty array for empty playthroughs', () => {
    expect(extractUniquePlayers([])).toEqual([])
  })

  it('extracts unique player names across playthroughs', () => {
    const playthroughs = [
      makePlaythrough('p1', [
        { playerName: 'Alice', investigatorName: 'Roland Banks' },
        { playerName: 'Bob', investigatorName: 'Daisy Walker' },
      ]),
      makePlaythrough('p2', [
        { playerName: 'Alice', investigatorName: 'Jenny Barnes' },
        { playerName: 'Charlie', investigatorName: 'Stella Clark' },
      ]),
    ]
    expect(extractUniquePlayers(playthroughs)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('excludes empty string player names', () => {
    const playthroughs = [
      makePlaythrough('p1', [
        { playerName: '', investigatorName: 'Roland Banks' },
        { playerName: 'Alice', investigatorName: 'Daisy Walker' },
      ]),
    ]
    expect(extractUniquePlayers(playthroughs)).toEqual(['Alice'])
  })

  it('excludes whitespace-only player names', () => {
    const playthroughs = [
      makePlaythrough('p1', [
        { playerName: '   ', investigatorName: 'Roland Banks' },
        { playerName: '  \t  ', investigatorName: 'Agnes Baker' },
        { playerName: 'Bob', investigatorName: 'Daisy Walker' },
      ]),
    ]
    expect(extractUniquePlayers(playthroughs)).toEqual(['Bob'])
  })

  it('preserves original casing and does not dedupe case variants', () => {
    const playthroughs = [
      makePlaythrough('p1', [
        { playerName: 'alice', investigatorName: 'Roland Banks' },
        { playerName: 'Alice', investigatorName: 'Daisy Walker' },
      ]),
    ]
    // Set treats them as different entries; localeCompare sorts lowercase 'a' after 'A'
    const result = extractUniquePlayers(playthroughs)
    expect(result).toHaveLength(2)
    expect(result).toContain('Alice')
    expect(result).toContain('alice')
  })

  it('returns sorted player names', () => {
    const playthroughs = [
      makePlaythrough('p1', [
        { playerName: 'Zoe', investigatorName: 'Roland Banks' },
        { playerName: 'Alice', investigatorName: 'Daisy Walker' },
        { playerName: 'Mike', investigatorName: 'Agnes Baker' },
      ]),
    ]
    expect(extractUniquePlayers(playthroughs)).toEqual(['Alice', 'Mike', 'Zoe'])
  })

  it('handles single playthrough with single investigator', () => {
    const playthroughs = [
      makePlaythrough('p1', [
        { playerName: 'Solo Player', investigatorName: 'Roland Banks' },
      ]),
    ]
    expect(extractUniquePlayers(playthroughs)).toEqual(['Solo Player'])
  })

  it('handles many playthroughs with duplicate players efficiently', () => {
    const playthroughs = Array.from({ length: 100 }, (_, i) =>
      makePlaythrough(`p${i}`, [
        { playerName: 'Alice', investigatorName: 'Roland Banks' },
        { playerName: 'Bob', investigatorName: 'Daisy Walker' },
      ])
    )
    const result = extractUniquePlayers(playthroughs)
    expect(result).toEqual(['Alice', 'Bob'])
  })
})
