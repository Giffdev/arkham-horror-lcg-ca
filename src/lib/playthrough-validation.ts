import type { Playthrough } from './types'

export const MAX_PLAYERS_PER_PLAYTHROUGH = 4

type PlaythroughWithPlayers = Pick<Playthrough, 'investigators'>

export function getPlayerLimitError(playthrough: PlaythroughWithPlayers): string | null {
  if (playthrough.investigators.length > MAX_PLAYERS_PER_PLAYTHROUGH) {
    return `A playthrough can have at most ${MAX_PLAYERS_PER_PLAYTHROUGH} players`
  }

  return null
}

export function assertPlayerLimit(playthrough: PlaythroughWithPlayers): void {
  const error = getPlayerLimitError(playthrough)
  if (error) throw new Error(error)
}
