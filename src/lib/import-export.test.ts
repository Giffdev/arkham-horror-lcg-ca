import { describe, expect, it } from 'vitest'

import { normalizeImportPayload, parseImportJson, stringifyExportEnvelopeV2, toExportEnvelopeV2 } from './import-export'
import { buildCampaignRunFromSourcePlaythrough, flattenGameLogs } from './campaign-runs'
import { getNextCampaignScenarioResolution } from './campaign-progression'
import type { CampaignRun, Playthrough } from './types'

function makePlaythrough(id: string): Playthrough {
  return {
    id,
    date: '2026-08-17',
    campaignName: 'The Night of the Zealot',
    campaignType: 'Small Campaign',
    investigators: [
      {
        playerName: 'Alice',
        investigatorName: 'Roland Banks',
        archetype: 'Guardian',
      },
    ],
  }
}

function makeCampaignRun(id: string): CampaignRun {
  return {
    id,
    version: 2,
    campaignLineageId: 'campaign:night-of-the-zealot',
    campaignName: 'The Night of the Zealot',
    campaignType: 'Small Campaign',
    startedAt: '2026-08-17',
    updatedAt: '2026-08-17T00:00:00.000Z',
    status: 'active',
    sourcePlaythroughId: 'seed',
    setupSnapshot: {
      date: '2026-08-17',
      investigators: makePlaythrough('x').investigators,
    },
    scenarioLogs: [
      {
        id: 's1',
        date: '2026-08-17',
        scenarioName: 'The Gathering',
        investigators: makePlaythrough('x').investigators,
      },
    ],
  }
}

describe('import-export normalization', () => {
  it('accepts legacy v1 array payloads unchanged', () => {
    const v1 = [makePlaythrough('p1')]
    const parsed = normalizeImportPayload(v1)

    expect(parsed.version).toBe(1)
    expect(parsed.playthroughs).toHaveLength(1)
    expect(parsed.campaignRuns).toEqual([])
  })

  it('keeps recognized rich fields on legacy v1 flat rows without fabricating missing fields', () => {
    const v1 = [{
      ...makePlaythrough('p1'),
      scenarioType: 'side_scenario',
      resolution: { type: 'named', value: 'No Resolution' },
      xpEarned: 6,
      victoryDisplayTotal: 2,
      xpBonusPenalty: -1,
      physicalTrauma: 1,
      mentalTrauma: 2,
      rosterAfter: [
        {
          seatId: 'seat:alice:1',
          slotId: 'seat:alice:1:slot:1',
          playerName: 'Alice',
          investigator: makePlaythrough('seed').investigators[0],
          seatStatus: 'active',
          joinedAtScenarioIndex: 0,
          startedAtScenarioIndex: 0,
          xpTotal: 0,
          xpSpent: 0,
          physicalTrauma: 0,
          mentalTrauma: 0,
        },
      ],
    }]

    const parsed = normalizeImportPayload(v1)
    const legacy = parsed.playthroughs[0]
    expect(legacy.scenarioType).toBe('side_scenario')
    expect(legacy.resolution).toEqual({ type: 'named', value: 'No Resolution' })
    expect(legacy.xpEarned).toBe(6)
    expect(legacy.victoryDisplayTotal).toBe(2)
    expect(legacy.xpBonusPenalty).toBe(-1)
    expect(legacy.physicalTrauma).toBe(1)
    expect(legacy.mentalTrauma).toBe(2)
    expect(Array.isArray(legacy.rosterAfter)).toBe(true)
    expect(legacy.rosterBefore).toBeUndefined()
  })

  it('rejects unknown extra properties instead of silently dropping them', () => {
    expect(() => normalizeImportPayload([{
      ...makePlaythrough('p1'),
      ignored: 'value',
    }])).toThrow(/unknown propert/i)
  })

  it('round-trips legacy v1 rich fields through promotion, suppression, export, and restore without value loss', () => {
    const normalized = normalizeImportPayload([{
      ...makePlaythrough('legacy-seed'),
      promotedToCampaignRunId: 'legacy-seed',
      scenarioName: 'The Gathering',
      scenarioType: 'standard',
      resolution: { type: 'named', value: 'Success' },
      notes: 'Legacy imported notes',
      xpEarned: 6,
      victoryDisplayTotal: 2,
      xpBonusPenalty: -1,
      physicalTrauma: 1,
      mentalTrauma: 2,
    }])
    const source = normalized.playthroughs[0]
    const run = buildCampaignRunFromSourcePlaythrough(source, { campaignRunId: 'legacy-seed' })

    expect(run.scenarioLogs[0]).toMatchObject({
      notes: 'Legacy imported notes',
      scenarioType: 'standard',
      resolution: { type: 'named', value: 'Success' },
      xpEarned: 6,
      victoryDisplayTotal: 2,
      xpBonusPenalty: -1,
      physicalTrauma: 1,
      mentalTrauma: 2,
    })

    const restored = parseImportJson(stringifyExportEnvelopeV2({
      playthroughs: [source],
      campaignRuns: [run],
    }))

    expect(restored.playthroughs[0]).toMatchObject({
      promotedToCampaignRunId: 'legacy-seed',
      notes: 'Legacy imported notes',
      xpEarned: 6,
      victoryDisplayTotal: 2,
      xpBonusPenalty: -1,
      physicalTrauma: 1,
      mentalTrauma: 2,
    })
    expect(restored.campaignRuns[0].scenarioLogs[0]).toMatchObject({
      notes: 'Legacy imported notes',
      xpEarned: 6,
      victoryDisplayTotal: 2,
      xpBonusPenalty: -1,
      physicalTrauma: 1,
      mentalTrauma: 2,
    })
    expect(flattenGameLogs({
      playthroughs: restored.playthroughs,
      campaignRuns: restored.campaignRuns,
    })).toHaveLength(1)
  })

  it('accepts v2 envelopes with campaign runs', () => {
    const payload = {
      version: 2,
      playthroughs: [makePlaythrough('p1')],
      campaignRuns: [makeCampaignRun('run-1')],
    }

    const parsed = normalizeImportPayload(payload)
    expect(parsed.version).toBe(2)
    expect(parsed.playthroughs).toHaveLength(1)
    expect(parsed.campaignRuns).toHaveLength(1)
    expect(parsed.campaignRuns[0].id).toBe('run-1')
  })

  it('preserves date-only start values from legacy campaign-run exports', () => {
    const legacyRun = makeCampaignRun('legacy-run')
    const parsed = normalizeImportPayload({
      version: 2,
      playthroughs: [],
      campaignRuns: [legacyRun],
    })

    expect(parsed.campaignRuns[0].startedAt).toBe('2026-08-17')
  })

  it('round-trips legacy group outcome fields without assigning them to investigators', () => {
    const legacyRun = makeCampaignRun('legacy-outcomes')
    legacyRun.scenarioLogs[0] = {
      ...legacyRun.scenarioLogs[0],
      xpEarned: 6,
      physicalTrauma: 1,
      mentalTrauma: 2,
    } as unknown as CampaignRun['scenarioLogs'][number]

    const parsed = parseImportJson(stringifyExportEnvelopeV2({
      playthroughs: [],
      campaignRuns: [legacyRun],
    }))
    const scenario = parsed.campaignRuns[0].scenarioLogs[0] as unknown as Record<string, unknown>

    expect(scenario.xpEarned).toBe(6)
    expect(scenario.physicalTrauma).toBe(1)
    expect(scenario.mentalTrauma).toBe(2)
    expect(parsed.campaignRuns[0].scenarioLogs[0].investigatorOutcomes).toBeUndefined()
  })

  it('round-trips rich standalone results and preserves legacy Scenario Pack side-story data', () => {
    const standalone: Playthrough = {
      ...makePlaythrough('standalone'),
      campaignName: 'Curse of the Rougarou',
      campaignType: 'Scenario Pack',
      scenarioName: 'Curse of the Rougarou',
      sideStories: ['Legacy imported side story'],
      scenarioType: 'standard',
      resolution: { type: 'named', value: 'Success' },
      investigatorOutcomes: [{
        seatId: 'seat:alice:1',
        slotId: 'seat:alice:1:slot:1',
        playerName: 'Alice',
        investigatorName: 'Roland Banks',
        status: 'survived',
        xpEarned: 4,
        traumaGainedPhysical: 1,
        traumaGainedMental: 0,
      }],
    }

    const parsed = parseImportJson(stringifyExportEnvelopeV2({
      playthroughs: [standalone],
      campaignRuns: [],
    }))

    expect(parsed.playthroughs[0]).toMatchObject({
      sideStories: ['Legacy imported side story'],
      scenarioType: 'standard',
      resolution: { type: 'named', value: 'Success' },
      investigatorOutcomes: [expect.objectContaining({ xpEarned: 4, traumaGainedPhysical: 1 })],
    })
  })

  it('preserves imported fan-made campaign and scenario names verbatim', () => {
    const imported = normalizeImportPayload([{
      ...makePlaythrough('fan-made'),
      campaignName: 'The Custom Mystery',
      customCampaignName: 'The Custom Mystery',
      campaignType: 'Fan-Made',
      scenarioName: 'The House Beyond',
    }])

    expect(imported.playthroughs[0]).toMatchObject({
      campaignName: 'The Custom Mystery',
      customCampaignName: 'The Custom Mystery',
      campaignType: 'Fan-Made',
      scenarioName: 'The House Beyond',
    })
  })

  it('round-trips Drowned City history used to reconstruct the selected route', () => {
    const run = makeCampaignRun('drowned-city-route')
    run.campaignName = 'The Drowned City'
    run.campaignSet = 'The Drowned City'
    run.scenarioLogs = [
      { ...run.scenarioLogs[0], id: 'opening', scenarioName: 'One Last Job' },
      { ...run.scenarioLogs[0], id: 'side', scenarioName: 'Murder at the Excelsior Hotel', scenarioType: 'side_scenario' },
      { ...run.scenarioLogs[0], id: 'route', scenarioName: 'Obsidian Canyons' },
    ]

    const parsed = parseImportJson(stringifyExportEnvelopeV2({
      playthroughs: [],
      campaignRuns: [run],
    }))
    const history = parsed.campaignRuns[0].scenarioLogs
      .filter(log => log.scenarioType !== 'side_scenario')
      .map(log => log.scenarioName)

    expect(getNextCampaignScenarioResolution({
      campaignName: parsed.campaignRuns[0].campaignName,
      campaignSet: parsed.campaignRuns[0].campaignSet,
      campaignType: parsed.campaignRuns[0].campaignType,
    }, history).candidates.map(step => step.name)).toEqual([
      'Sepulchre of the Sleeper',
      'Court of the Ancients',
    ])
  })

  it('rejects malformed investigator entries instead of casting them through import normalization', () => {
    expect(() => normalizeImportPayload([{
      ...makePlaythrough('bad-investigator'),
      investigators: [{}],
    }])).toThrow(/valid investigator assignment/i)
  })

  it('rejects nested arrays before firestore compatibility checks or transaction work', () => {
    expect(() => normalizeImportPayload([{
      ...makePlaythrough('nested-array'),
      sideStories: ['Curse of the Rougarou', ['Nested']] as unknown as string[],
    }])).toThrow(/nested array/i)
  })

  it('rejects excessively deep payload branches', () => {
    const deeplyNestedMetadata: Record<string, unknown> = {}
    let cursor: Record<string, unknown> = deeplyNestedMetadata
    for (let depth = 0; depth < 20; depth++) {
      cursor.child = {}
      cursor = cursor.child as Record<string, unknown>
    }

    expect(() => normalizeImportPayload([{
      ...makePlaythrough('too-deep'),
      metadata: deeplyNestedMetadata,
    }])).toThrow(/maximum supported nesting depth/i)
  })

  it('rejects oversized records before import commit', () => {
    expect(() => normalizeImportPayload([{
      ...makePlaythrough('oversized-record'),
      notes: 'x'.repeat(950_000),
    }])).toThrow(/maximum supported string size|document size safety limit/i)
  })

  it('rejects blank, slash-containing, reserved, and oversized firestore document ids', () => {
    const oversizedId = 'x'.repeat(1_501)
    const invalidCases: Array<[string, RegExp]> = [
      ['   ', /non-empty Firestore document id/i],
      ['bad/id', /must not contain/i],
      ['__bad__', /reserved document id format/i],
      [oversizedId, /1,500-byte document id limit/i],
    ]

    for (const [invalidId, expectedPattern] of invalidCases) {
      expect(() => normalizeImportPayload([{
        ...makePlaythrough('seed'),
        id: invalidId,
      }])).toThrow(expectedPattern)
    }
  })

  it('allows promoted source playthroughs to share ids with their recovered campaign runs', () => {
    expect(() => normalizeImportPayload({
      version: 2,
      playthroughs: [{
        ...makePlaythrough('shared-id'),
        promotedToCampaignRunId: 'shared-id',
      }],
      campaignRuns: [{
        ...makeCampaignRun('shared-id'),
        sourcePlaythroughId: 'shared-id',
      }],
    })).not.toThrow()
  })

  it('rejects cross-type id overlaps that are not valid promotion pairs', () => {
    expect(() => normalizeImportPayload({
      version: 2,
      playthroughs: [makePlaythrough('shared-id')],
      campaignRuns: [{
        ...makeCampaignRun('shared-id'),
        sourcePlaythroughId: 'different-source',
      }],
    })).toThrow(/without a matching promotion pair/i)
  })

  it('rejects malformed v2 envelopes without partial acceptance', () => {
    expect(() => normalizeImportPayload({
      version: 2,
      playthroughs: [makePlaythrough('p1')],
      campaignRuns: [{ id: 'bad-run' }],
    })).toThrow(/campaignRuns\[0\]/i)
  })

  it('parses JSON payloads and emits v2 export JSON', () => {
    const envelope = toExportEnvelopeV2({
      playthroughs: [makePlaythrough('p1')],
      campaignRuns: [makeCampaignRun('run-1')],
    })
    const json = stringifyExportEnvelopeV2({
      playthroughs: envelope.playthroughs,
      campaignRuns: envelope.campaignRuns,
    })
    const parsed = parseImportJson(json)

    expect(parsed.version).toBe(2)
    expect(parsed.playthroughs[0].id).toBe('p1')
    expect(parsed.campaignRuns[0].id).toBe('run-1')
  })
})
