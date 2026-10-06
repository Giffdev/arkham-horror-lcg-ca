import { describe, expect, it } from 'vitest'
import { completeClassPopularity } from './class-popularity'

describe('completeClassPopularity', () => {
  it('returns each playable class exactly once and excludes Unknown', () => {
    const result = completeClassPopularity([
      { archetype: 'Unknown', count: 99 },
      { archetype: 'Guardian', count: 6 },
    ])

    expect(result.map(entry => entry.archetype)).toEqual([
      'Guardian',
      'Seeker',
      'Rogue',
      'Mystic',
      'Survivor',
      'Neutral',
    ])
    expect(result).toHaveLength(6)
  })

  it('synthesizes missing classes as zero and sorts by descending count', () => {
    expect(completeClassPopularity([
      { archetype: 'Mystic', count: 2 },
      { archetype: 'Guardian', count: 5 },
      { archetype: 'Neutral', count: 1 },
    ])).toEqual([
      { archetype: 'Guardian', count: 5 },
      { archetype: 'Mystic', count: 2 },
      { archetype: 'Neutral', count: 1 },
      { archetype: 'Seeker', count: 0 },
      { archetype: 'Rogue', count: 0 },
      { archetype: 'Survivor', count: 0 },
    ])
  })

  it('uses canonical class order to break count ties without mutating the input', () => {
    const input = [
      { archetype: 'Neutral' as const, count: 3 },
      { archetype: 'Survivor' as const, count: 3 },
      { archetype: 'Guardian' as const, count: 3 },
    ]
    const original = structuredClone(input)

    expect(completeClassPopularity(input).slice(0, 3)).toEqual([
      { archetype: 'Guardian', count: 3 },
      { archetype: 'Survivor', count: 3 },
      { archetype: 'Neutral', count: 3 },
    ])
    expect(input).toEqual(original)
  })
})
