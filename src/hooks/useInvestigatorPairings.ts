import { useMemo } from 'react'
import { Playthrough } from '@/lib/types'
import { getInvestigatorPairKey, resolveInvestigator } from '@/lib/investigator-data'

export interface InvestigatorPairing {
  investigators: [string, string]
  count: number
}

/**
 * Generate a stable key for a pair of investigators (alphabetical order).
 */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|||${b}` : `${b}|||${a}`
}

/**
 * Extract all C(N,2) investigator pairs from a set of playthroughs
 * and return top N by frequency, with deterministic tie-breaking.
 */
function computePairings(playthroughs: Playthrough[], topN: number): InvestigatorPairing[] {
  const pairCounts = new Map<string, number>()

  for (const p of playthroughs) {
    const names: string[] = []
    for (const inv of p.investigators) {
      if (inv.isUnknown || !inv.investigatorName || inv.investigatorName === 'Unknown') continue
      const chapter = resolveInvestigator(inv)?.chapter ?? inv.chapter
      const name = getInvestigatorPairKey({ investigatorName: inv.investigatorName, chapter })
      if (!names.includes(name)) {
        names.push(name)
      }
    }

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = pairKey(names[i], names[j])
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1)
      }
    }
  }

  return Array.from(pairCounts.entries())
    .map(([key, count]) => {
      const [a, b] = key.split('|||')
      return { investigators: [a, b] as [string, string], count }
    })
    .sort((a, b) => b.count - a.count || a.investigators[0].localeCompare(b.investigators[0]))
    .slice(0, topN)
}

/**
 * Computes investigator pairing frequency analysis from the user's playthroughs.
 * Returns the top N most common pairs.
 */
export function useInvestigatorPairings(
  personalPlaythroughs: Playthrough[] | undefined,
  topN: number = 10
): { personal: InvestigatorPairing[] } {
  const personal = useMemo(() => {
    if (!personalPlaythroughs || personalPlaythroughs.length === 0) return []
    return computePairings(personalPlaythroughs, topN)
  }, [personalPlaythroughs, topN])

  return { personal }
}
