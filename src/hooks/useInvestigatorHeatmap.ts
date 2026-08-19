import { useMemo } from 'react'
import { flattenGameLogs } from '@/lib/campaign-runs'
import { CampaignRun, Playthrough } from '@/lib/types'
import { getInvestigatorPairKey, resolveInvestigator } from '@/lib/investigator-data'

export interface HeatmapData {
  investigators: string[]   // sorted list of all unique investigator names
  matrix: number[][]        // matrix[i][j] = co-occurrence count
  maxCount: number          // max value in the matrix (for color scaling)
}

/**
 * Build a full co-occurrence matrix from a flat list of pairings.
 * Works for both personal (from playthroughs) and community (from CommunityPairing[]) data.
 */
export function buildHeatmapFromPairings(
  pairings: { name1: string; name2: string; count: number }[]
): HeatmapData {
  if (pairings.length === 0) {
    return { investigators: [], matrix: [], maxCount: 0 }
  }

  // Collect all unique investigators
  const nameSet = new Set<string>()
  for (const p of pairings) {
    nameSet.add(p.name1)
    nameSet.add(p.name2)
  }
  const investigators = Array.from(nameSet).sort()

  // Build index lookup
  const indexMap = new Map<string, number>()
  for (let i = 0; i < investigators.length; i++) {
    indexMap.set(investigators[i], i)
  }

  // Initialize matrix with zeros
  const n = investigators.length
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  // Fill symmetric matrix
  let maxCount = 0
  for (const p of pairings) {
    const i = indexMap.get(p.name1)!
    const j = indexMap.get(p.name2)!
    matrix[i][j] = p.count
    matrix[j][i] = p.count
    if (p.count > maxCount) maxCount = p.count
  }

  return { investigators, matrix, maxCount }
}

/**
 * Extract all C(N,2) investigator pairs from playthroughs as a flat list.
 * This is the raw pair data before matrix construction.
 */
function extractPairings(playthroughs: Playthrough[]): { name1: string; name2: string; count: number }[] {
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
        const a = names[i] < names[j] ? names[i] : names[j]
        const b = names[i] < names[j] ? names[j] : names[i]
        const key = `${a}|||${b}`
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1)
      }
    }
  }

  return Array.from(pairCounts.entries()).map(([key, count]) => {
    const [name1, name2] = key.split('|||')
    return { name1, name2, count }
  })
}

/**
 * Computes a full co-occurrence heatmap matrix from playthroughs.
 * Use for personal data where raw playthroughs are available.
 */
export function useInvestigatorHeatmap(
  playthroughs: Playthrough[] | undefined,
  campaignRuns: CampaignRun[] = [],
): HeatmapData {
  return useMemo(() => {
    if (!playthroughs || playthroughs.length === 0) {
      return { investigators: [], matrix: [], maxCount: 0 }
    }
    const flattened = campaignRuns.length > 0
      ? flattenGameLogs({ playthroughs, campaignRuns })
      : playthroughs
    const pairings = extractPairings(flattened)
    return buildHeatmapFromPairings(pairings)
  }, [campaignRuns, playthroughs])
}
