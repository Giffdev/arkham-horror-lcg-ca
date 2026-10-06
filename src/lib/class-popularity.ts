import type { Archetype } from '@/lib/types'

type DisplayArchetype = Exclude<Archetype, 'Unknown'>

const DISPLAY_ARCHETYPES: readonly DisplayArchetype[] = [
  'Guardian',
  'Seeker',
  'Rogue',
  'Mystic',
  'Survivor',
  'Neutral',
]

export function completeClassPopularity(
  classes: readonly { archetype: Archetype; count: number }[] = [],
): Array<{ archetype: DisplayArchetype; count: number }> {
  const counts = new Map<DisplayArchetype, number>(
    DISPLAY_ARCHETYPES.map(archetype => [archetype, 0]),
  )

  for (const entry of classes) {
    if (entry.archetype === 'Unknown') continue
    counts.set(entry.archetype, entry.count)
  }

  return DISPLAY_ARCHETYPES
    .map(archetype => ({ archetype, count: counts.get(archetype) ?? 0 }))
    .sort((left, right) => {
      const countDifference = right.count - left.count
      if (countDifference !== 0) return countDifference
      return DISPLAY_ARCHETYPES.indexOf(left.archetype) - DISPLAY_ARCHETYPES.indexOf(right.archetype)
    })
}
