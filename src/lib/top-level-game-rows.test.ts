import { describe, expect, it } from 'vitest'

import { buildTopLevelGameRows } from './top-level-game-rows'
import type { CampaignRun, Playthrough } from './types'

function makePlaythrough(id: string, overrides: Partial<Playthrough> = {}): Playthrough {
  return {
    id,
    date: '2026-08-17',
    campaignName: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    investigators: [
      {
        playerName: 'Alice',
        investigatorName: 'Roland Banks',
        archetype: 'Guardian',
      },
    ],
    ...overrides,
  }
}

function makeRun(id: string, overrides: Partial<CampaignRun> = {}): CampaignRun {
  return {
    id,
    version: 1,
    campaignLineageId: 'campaign:path-to-carcosa',
    campaignName: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    startedAt: '2026-08-15',
    updatedAt: '2026-08-18T00:00:00.000Z',
    status: 'active',
    setupSnapshot: {
      date: '2026-08-15',
      investigators: makePlaythrough('seed').investigators,
    },
    scenarioLogs: [
      {
        id: 's1',
        date: '2026-08-16',
        scenarioName: 'Curtain Call',
        investigators: makePlaythrough('seed').investigators,
      },
    ],
    ...overrides,
  }
}

describe('buildTopLevelGameRows', () => {
  it('keeps same-name campaign runs as distinct top-level rows and suppresses promoted duplicates', () => {
    const promoted = makePlaythrough('legacy-1', {
      promotedToCampaignRunId: 'run-a',
      scenarioName: 'Curtain Call',
    })
    const standalone = makePlaythrough('standalone-1', {
      campaignName: 'Curse of the Rougarou',
      campaignType: 'Scenario Pack',
      scenarioName: 'Curse of the Rougarou',
    })

    const runA = makeRun('run-a', { startedAt: '2026-08-10' })
    const runB = makeRun('run-b', { startedAt: '2026-08-11' })

    const rows = buildTopLevelGameRows([promoted, standalone], [runA, runB])
    const runRows = rows.filter((row) => row.kind === 'campaign-run')
    const standaloneRows = rows.filter((row) => row.kind === 'playthrough')

    expect(runRows).toHaveLength(2)
    expect(runRows.map((row) => row.campaignRun.id)).toEqual(expect.arrayContaining(['run-a', 'run-b']))
    expect(standaloneRows).toHaveLength(1)
    expect(standaloneRows[0].playthrough.id).toBe('standalone-1')
  })

  it('uses exactly one filter record per top-level row', () => {
    const run = makeRun('run-z')
    const standalone = makePlaythrough('standalone-z', {
      campaignName: 'Machinations Through Time',
      campaignType: 'Scenario Pack',
    })

    const rows = buildTopLevelGameRows([standalone], [run])
    const filterIds = rows.map((row) => row.filterPlaythrough.id)

    expect(filterIds).toHaveLength(2)
    expect(new Set(filterIds).size).toBe(2)
    expect(filterIds).toContain(`run:${run.id}`)
    expect(filterIds).toContain('standalone-z')
  })

  it('orders campaigns started on the same day by their full start timestamps', () => {
    const earlier = makeRun('run-earlier', {
      startedAt: '2026-08-15T09:00:00.000Z',
      scenarioLogs: [],
    })
    const later = makeRun('run-later', {
      startedAt: '2026-08-15T18:00:00.000Z',
      scenarioLogs: [],
    })

    const rows = buildTopLevelGameRows([], [earlier, later])

    expect(rows.map((row) => row.key)).toEqual(['run:run-later', 'run:run-earlier'])
  })
})
