import { describe, expect, it } from 'vitest'
import {
  MAX_PLAYERS_PER_PLAYTHROUGH,
  assertPlayerLimit,
  getPlayerLimitError,
} from './playthrough-validation'
import type { InvestigatorAssignment } from './types'

function makePlayers(count: number): InvestigatorAssignment[] {
  return Array.from({ length: count }, (_, index) => ({
    playerName: `Player ${index + 1}`,
    investigatorName: `Investigator ${index + 1}`,
    archetype: 'Unknown',
  }))
}

describe('playthrough player limit', () => {
  it('accepts a playthrough with four players', () => {
    const playthrough = { investigators: makePlayers(MAX_PLAYERS_PER_PLAYTHROUGH) }

    expect(getPlayerLimitError(playthrough)).toBeNull()
    expect(() => assertPlayerLimit(playthrough)).not.toThrow()
  })

  it('rejects a playthrough with five players', () => {
    const playthrough = { investigators: makePlayers(MAX_PLAYERS_PER_PLAYTHROUGH + 1) }

    expect(getPlayerLimitError(playthrough)).toBe('A playthrough can have at most 4 players')
    expect(() => assertPlayerLimit(playthrough)).toThrow('A playthrough can have at most 4 players')
  })
})
