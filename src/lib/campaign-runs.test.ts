import { describe, expect, it } from 'vitest'

import {
  assertValidNewCampaignRun,
  appendCampaignScenarioLog,
  buildCampaignRunFromSourcePlaythrough,
  buildFlattenedScenarioLogId,
  CampaignRunMutationError,
  computeCampaignCountSummary,
  deleteCampaignScenarioLog,
  deriveCampaignRunRosterSummary,
  editCampaignRun,
  editCampaignScenarioLog,
  flattenGameLogs,
  getLegacyGroupScenarioOutcome,
  shouldSuppressPromotedPlaythrough,
} from './campaign-runs'
import type { CampaignRun, CampaignScenarioRosterEntry, Playthrough } from './types'

function makePlaythrough(overrides: Partial<Playthrough> = {}): Playthrough {
  return {
    id: 'playthrough-1',
    date: '2026-08-10',
    campaignName: 'The Dunwich Legacy',
    campaignSet: 'The Dunwich Legacy',
    campaignType: 'Full Campaign',
    campaignLineageId: 'campaign:the-dunwich-legacy',
    scenarioName: 'Extracurricular Activity',
    investigators: [
      {
        playerName: 'Alice',
        investigatorName: 'Roland Banks',
        archetype: 'Guardian',
      },
    ],
    notes: 'Seed log',
    ...overrides,
  }
}

function makeRunRosterEntry(overrides: Partial<CampaignScenarioRosterEntry> = {}): CampaignScenarioRosterEntry {
  return {
    seatId: 'seat:alice:1',
    slotId: 'seat:alice:1:slot:1',
    playerName: 'Alice',
    investigator: {
      playerName: 'Alice',
      investigatorName: 'Roland Banks',
      archetype: 'Guardian',
    },
    seatStatus: 'active',
    joinedAtScenarioIndex: 0,
    startedAtScenarioIndex: 0,
    xpTotal: 0,
    xpSpent: 0,
    physicalTrauma: 0,
    mentalTrauma: 0,
    ...overrides,
  }
}

function makeCampaignRun(overrides: Partial<CampaignRun> = {}): CampaignRun {
  return {
    id: 'run-1',
    version: 2,
    campaignLineageId: 'campaign:the-dunwich-legacy',
    campaignName: 'The Dunwich Legacy',
    campaignSet: 'The Dunwich Legacy',
    campaignType: 'Full Campaign',
    startedAt: '2026-08-10',
    updatedAt: '2026-08-10T00:00:00.000Z',
    status: 'active',
    sourcePlaythroughId: 'playthrough-1',
    setupSnapshot: {
      date: '2026-08-10',
      investigators: [
        {
          playerName: 'Alice',
          investigatorName: 'Roland Banks',
          archetype: 'Guardian',
        },
      ],
      notes: 'Seed setup',
    },
    currentRoster: [makeRunRosterEntry()],
    scenarioLogs: [],
    ...overrides,
  }
}

describe('campaign-runs helpers', () => {
  it('builds deterministic promotion seed runs and initializes currentRoster', () => {
    const source = makePlaythrough()
    const run = buildCampaignRunFromSourcePlaythrough(source, {
      campaignRunId: source.id,
      now: '2026-08-17T01:00:00.000Z',
    })

    expect(run.id).toBe(source.id)
    expect(run.version).toBe(2)
    expect(run.sourcePlaythroughId).toBe(source.id)
    expect(run.startedAt).toBe('2026-08-10T01:00:00.000Z')
    expect(run.scenarioLogs).toHaveLength(1)
    expect(run.scenarioLogs[0].legacySourcePlaythroughId).toBe(source.id)
    expect(run.scenarioLogs[0].scenarioName).toBe('Extracurricular Activity')
    expect(run.currentRoster?.[0].investigator.investigatorName).toBe('Roland Banks')
  })

  it('preserves a campaign start time when editing only its calendar date', () => {
    const run = makeCampaignRun({ startedAt: '2026-08-10T14:30:45.123Z' })

    const edited = editCampaignRun(run, { startedAt: '2026-08-12' }, '2026-08-18T00:00:00.000Z')

    expect(edited.startedAt).toBe('2026-08-12T14:30:45.123Z')
  })

  it('copies recognized legacy rich fields from source records without fabricating missing data', () => {
    const legacy = {
      ...makePlaythrough(),
      scenarioType: 'side_scenario',
      resolution: { type: 'named', value: 'The investigators escaped.' },
      xpEarned: 6,
      victoryDisplayTotal: 2,
      xpBonusPenalty: -1,
      physicalTrauma: 1,
      mentalTrauma: 2,
      rosterAfter: [makeRunRosterEntry()],
      investigatorOutcomes: [
        {
          seatId: 'seat:alice:1',
          slotId: 'seat:alice:1:slot:1',
          playerName: 'Alice',
          investigatorName: 'Roland Banks',
          status: 'survived',
          xpEarned: 2,
          traumaGainedPhysical: 0,
          traumaGainedMental: 0,
        },
      ],
      randomField: 'ignore me',
    } as unknown as Playthrough
    const run = buildCampaignRunFromSourcePlaythrough(legacy, { campaignRunId: 'legacy' })
    const seed = run.scenarioLogs[0]

    expect(seed.scenarioType).toBe('side_scenario')
    expect(seed.resolution).toEqual({ type: 'named', value: 'The investigators escaped.' })
    expect(seed.xpEarned).toBe(6)
    expect(seed.victoryDisplayTotal).toBe(2)
    expect(seed.xpBonusPenalty).toBe(-1)
    expect(seed.physicalTrauma).toBe(1)
    expect(seed.mentalTrauma).toBe(2)
    expect(seed.investigatorOutcomes?.[0].xpEarned).toBe(2)
    expect((seed as Record<string, unknown>).randomField).toBeUndefined()
    expect(seed.rosterBefore).toBeUndefined()
  })

  it('appends scenario logs and rolls currentRoster forward from latest child', () => {
    const base = makeCampaignRun({ currentRoster: [makeRunRosterEntry()] })
    const withFirst = appendCampaignScenarioLog(
      base,
      {
        id: 's1',
        date: '2026-08-11',
        scenarioName: 'Extracurricular Activity',
        investigators: base.setupSnapshot.investigators,
        rosterAfter: [makeRunRosterEntry({ xpTotal: 3, xpSpent: 1 })],
      },
      { now: '2026-08-11T00:00:00.000Z' },
    )

    expect(withFirst.scenarioLogs).toHaveLength(1)
    expect(withFirst.currentRoster?.[0].xpTotal).toBe(3)
    expect(withFirst.scenarioLogs[0].rosterBefore?.[0].investigator.investigatorName).toBe('Roland Banks')
    expect(base.currentRoster?.[0].xpTotal).toBe(0)
  })

  it('allows one rich primary result for a standalone Scenario Pack, then blocks further nights', () => {
    const standalone = makeCampaignRun({
      campaignName: 'Curse of the Rougarou',
      campaignSet: 'Scenario Pack',
      campaignType: 'Scenario Pack',
    })
    const withResult = appendCampaignScenarioLog(standalone, {
      id: 'standalone-result',
      date: '2026-08-18',
      scenarioName: 'Curse of the Rougarou',
      scenarioType: 'standard',
      resolution: { type: 'named', value: 'Success' },
      investigators: standalone.setupSnapshot.investigators,
      investigatorOutcomes: [{
        seatId: 'seat:alice:1',
        slotId: 'seat:alice:1:slot:1',
        playerName: 'Alice',
        investigatorName: 'Roland Banks',
        status: 'survived',
        xpEarned: 3,
        traumaGainedPhysical: 1,
        traumaGainedMental: 0,
      }],
    })

    expect(withResult.scenarioLogs[0]).toMatchObject({
      resolution: { type: 'named', value: 'Success' },
      investigatorOutcomes: [expect.objectContaining({ xpEarned: 3, traumaGainedPhysical: 1 })],
    })
    expect(() => appendCampaignScenarioLog(withResult, {
      date: '2026-08-19',
      scenarioName: 'Another Night',
      investigators: standalone.setupSnapshot.investigators,
    })).toThrowError(/only one scenario result/i)
  })

  it('blocks side-scenario children and side-scenario edits for standalone Scenario Packs', () => {
    const standalone = makeCampaignRun({
      campaignName: 'Curse of the Rougarou',
      campaignType: 'Scenario Pack',
    })
    expect(() => appendCampaignScenarioLog(standalone, {
      date: '2026-08-18',
      scenarioName: 'Machinations Through Time',
      scenarioType: 'side_scenario',
      investigators: standalone.setupSnapshot.investigators,
    })).toThrowError(/cannot contain side-scenario logs/i)

    const imported = makeCampaignRun({
      campaignName: 'Curse of the Rougarou',
      campaignType: 'Scenario Pack',
      scenarioLogs: [{
        id: 'legacy-result',
        date: '2026-08-18',
        scenarioName: 'Curse of the Rougarou',
        investigators: standalone.setupSnapshot.investigators,
      }],
    })
    expect(() => editCampaignScenarioLog(imported, 'legacy-result', {
      scenarioType: 'side_scenario',
    })).toThrowError(/cannot contain side-scenario logs/i)
  })

  it('rejects invalid newly-created standalone run shapes without normalizing imported data', () => {
    const invalid = makeCampaignRun({
      campaignName: 'Curse of the Rougarou',
      campaignType: 'Scenario Pack',
      scenarioLogs: [
        {
          id: 'result-1',
          date: '2026-08-18',
          scenarioName: 'Curse of the Rougarou',
          investigators: makeCampaignRun().setupSnapshot.investigators,
        },
        {
          id: 'result-2',
          date: '2026-08-19',
          scenarioName: 'Another Night',
          investigators: makeCampaignRun().setupSnapshot.investigators,
        },
      ],
    })

    expect(() => assertValidNewCampaignRun(invalid)).toThrowError(/single primary scenario result/i)
    expect(invalid.scenarioLogs).toHaveLength(2)
  })

  it('appends trimmed fan-made campaign scenarios in logged order without catalog membership', () => {
    const fanRun = makeCampaignRun({
      campaignLineageId: 'name:the-custom-mystery',
      campaignName: 'The Custom Mystery',
      campaignSet: undefined,
      campaignType: 'Fan-Made',
      customCampaignName: 'The Custom Mystery',
    })
    const afterFirst = appendCampaignScenarioLog(fanRun, {
      id: 'fan-1',
      date: '2026-08-18',
      scenarioName: '  The House Beyond  ',
      investigators: fanRun.setupSnapshot.investigators,
    })
    const afterSecond = appendCampaignScenarioLog(afterFirst, {
      id: 'fan-2',
      date: '2026-08-19',
      scenarioName: 'A Debt Repaid',
      investigators: fanRun.setupSnapshot.investigators,
    })
    const withSideStory = appendCampaignScenarioLog(afterSecond, {
      id: 'fan-side',
      date: '2026-08-20',
      scenarioName: 'My Custom Detour',
      scenarioType: 'side_scenario',
      investigators: fanRun.setupSnapshot.investigators,
    })

    expect(withSideStory.scenarioLogs.map(log => log.scenarioName)).toEqual([
      'The House Beyond',
      'A Debt Repaid',
      'My Custom Detour',
    ])
    expect(withSideStory.scenarioLogs[2].scenarioType).toBe('side_scenario')
  })

  it('rejects crafted non-canonical campaign scenarios for official campaigns while allowing custom side scenarios', () => {
    const officialRun = makeCampaignRun({
      campaignName: 'The Path to Carcosa',
      campaignSet: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
    })

    expect(() => appendCampaignScenarioLog(officialRun, {
      date: '2026-08-18',
      scenarioName: 'Invented Campaign Scenario',
      investigators: officialRun.setupSnapshot.investigators,
    })).toThrowError(/guide-backed scenario selection/i)

    const withCustomSideStory = appendCampaignScenarioLog(officialRun, {
      date: '2026-08-18',
      scenarioName: 'Invented Side Scenario',
      scenarioType: 'side_scenario',
      investigators: officialRun.setupSnapshot.investigators,
    })
    expect(withCustomSideStory.scenarioLogs[0]).toMatchObject({
      scenarioName: 'Invented Side Scenario',
      scenarioType: 'side_scenario',
    })
  })

  it('rejects invalid Drowned City branch appends while side scenarios leave route history unchanged', () => {
    const drownedRun = makeCampaignRun({
      campaignLineageId: 'campaign:the-drowned-city',
      campaignName: 'The Drowned City',
      campaignSet: 'The Drowned City',
      campaignType: 'Full Campaign',
    })
    const append = (run: CampaignRun, scenarioName: string, scenarioType?: 'standard' | 'side_scenario') =>
      appendCampaignScenarioLog(run, {
        date: '2026-08-18',
        scenarioName,
        scenarioType,
        investigators: run.setupSnapshot.investigators,
      })
    const afterOpening = append(drownedRun, 'One Last Job')
    const afterSideScenario = append(afterOpening, 'Murder at the Excelsior Hotel', 'side_scenario')
    const afterWestChoice = append(afterSideScenario, 'The Western Wall')

    expect(() => append(afterWestChoice, 'Court of the Ancients')).toThrowError(
      /not a valid next step for the campaign route/i,
    )
    expect(append(afterWestChoice, 'The Apiary').scenarioLogs.map(log => log.scenarioName)).toEqual([
      'One Last Job',
      'Murder at the Excelsior Hotel',
      'The Western Wall',
      'The Apiary',
    ])
    expect(() => append(drownedRun, 'Obsidian Canyons')).toThrowError(
      /not a valid next step for the campaign route/i,
    )
    expect(() => appendCampaignScenarioLog(drownedRun, {
      date: '2026-08-18',
      scenarioName: 'A Manual Guess',
      investigators: drownedRun.setupSnapshot.investigators,
    })).toThrowError(/guide-backed scenario selection/i)
  })

  it('allows full latest-child edits and re-rolls currentRoster', () => {
    const base = makeCampaignRun({
      scenarioLogs: [
        {
          id: 's1',
          date: '2026-08-11',
          scenarioName: 'Extracurricular Activity',
          investigators: makePlaythrough().investigators,
          preScenarioAdjustments: [
            {
              type: 'xp_spend',
              slotId: 'seat:alice:1:slot:1',
              amount: 2,
            },
          ],
          rosterAfter: [makeRunRosterEntry({ xpTotal: 2 })],
        },
      ],
      currentRoster: [makeRunRosterEntry({ xpTotal: 2 })],
    })
    const edited = editCampaignScenarioLog(
      base,
      's1',
      {
        notes: 'Updated',
        investigatorOutcomes: [
          {
            seatId: 'seat:alice:1',
            slotId: 'seat:alice:1:slot:1',
            playerName: 'Alice',
            investigatorName: 'Roland Banks',
            status: 'survived',
            xpEarned: 3,
            traumaGainedPhysical: 0,
            traumaGainedMental: 0,
          },
        ],
        rosterAfter: [makeRunRosterEntry({ xpTotal: 5 })],
      },
      '2026-08-12T00:00:00.000Z',
    )

    expect(edited.currentRoster?.[0].xpTotal).toBe(5)
    expect(edited.scenarioLogs[0].investigatorOutcomes?.[0].xpEarned).toBe(3)
    expect(edited.scenarioLogs[0].preScenarioAdjustments).toEqual([
      {
        type: 'xp_spend',
        slotId: 'seat:alice:1:slot:1',
        amount: 2,
      },
    ])
  })

  it('blocks non-latest stateful edits with explicit domain error', () => {
    const run = makeCampaignRun({
      scenarioLogs: [
        {
          id: 's1',
          date: '2026-08-11',
          scenarioName: 'Extracurricular Activity',
          investigators: makePlaythrough().investigators,
        },
        {
          id: 's2',
          date: '2026-08-12',
          scenarioName: 'The House Always Wins',
          investigators: makePlaythrough().investigators,
        },
      ],
    })

    expect(() =>
      editCampaignScenarioLog(run, 's1', { investigators: [] }),
    ).toThrowError(CampaignRunMutationError)

    try {
      editCampaignScenarioLog(run, 's1', { investigators: [] })
    } catch (error) {
      expect((error as CampaignRunMutationError).code).toBe('CAMPAIGN_SCENARIO_LOG_STATEFUL_EDIT_BLOCKED')
    }
  })

  it('allows non-latest cosmetic edits and blocks non-latest deletes', () => {
    const run = makeCampaignRun({
      scenarioLogs: [
        {
          id: 's1',
          date: '2026-08-11',
          scenarioName: 'Extracurricular Activity',
          investigators: makePlaythrough().investigators,
        },
        {
          id: 's2',
          date: '2026-08-12',
          scenarioName: 'The House Always Wins',
          investigators: makePlaythrough().investigators,
        },
      ],
    })

    const cosmeticEdit = editCampaignScenarioLog(run, 's1', { scenarioType: 'interlude', notes: 'retitle only' })
    expect(cosmeticEdit.scenarioLogs[0].scenarioType).toBe('interlude')

    expect(() => deleteCampaignScenarioLog(run, 's1')).toThrowError(CampaignRunMutationError)
    try {
      deleteCampaignScenarioLog(run, 's1')
    } catch (error) {
      expect((error as CampaignRunMutationError).code).toBe('CAMPAIGN_SCENARIO_LOG_DELETE_BLOCKED')
    }
  })

  it('deleting latest child rolls currentRoster back to previous child', () => {
    const run = makeCampaignRun({
      scenarioLogs: [
        {
          id: 's1',
          date: '2026-08-11',
          scenarioName: 'Scenario 1',
          investigators: makePlaythrough().investigators,
          rosterAfter: [makeRunRosterEntry({ xpTotal: 2 })],
        },
        {
          id: 's2',
          date: '2026-08-12',
          scenarioName: 'Scenario 2',
          investigators: makePlaythrough().investigators,
          rosterAfter: [makeRunRosterEntry({ xpTotal: 6 })],
        },
      ],
      currentRoster: [makeRunRosterEntry({ xpTotal: 6 })],
    })

    const afterDelete = deleteCampaignScenarioLog(run, 's2')
    expect(afterDelete.scenarioLogs.map((log) => log.id)).toEqual(['s1'])
    expect(afterDelete.currentRoster?.[0].xpTotal).toBe(2)
  })

  it('blocks parent setup investigator edits after child history exists', () => {
    const run = makeCampaignRun({
      scenarioLogs: [
        {
          id: 's1',
          date: '2026-08-11',
          scenarioName: 'Scenario 1',
          investigators: makePlaythrough().investigators,
        },
      ],
    })

    expect(() =>
      editCampaignRun(run, {
        setupSnapshot: {
          investigators: [
            {
              playerName: 'Alice',
              investigatorName: 'Jenny Barnes',
              archetype: 'Rogue',
            },
          ],
        },
      }),
    ).toThrowError(CampaignRunMutationError)
  })

  it('suppresses only promoted sources whose parent run exists and avoids double counting', () => {
    const promotedSource = makePlaythrough({
      id: 'source-1',
      promotedToCampaignRunId: 'run-1',
      scenarioName: 'Curtain Call',
    })
    const standalone = makePlaythrough({
      id: 'standalone-1',
      campaignName: 'Curse of the Rougarou',
      campaignType: 'Scenario Pack',
      scenarioName: 'Curse of the Rougarou',
      promotedToCampaignRunId: 'missing-run',
    })
    const run = makeCampaignRun({
      id: 'run-1',
      scenarioLogs: [
        {
          id: 'scenario-a',
          date: '2026-08-11',
          scenarioName: 'Curtain Call',
          investigators: promotedSource.investigators,
          notes: 'nested row',
        },
      ],
    })

    const flattened = flattenGameLogs({
      playthroughs: [promotedSource, standalone],
      campaignRuns: [run],
    })

    expect(shouldSuppressPromotedPlaythrough(promotedSource, new Set(['run-1']))).toBe(true)
    expect(flattened.some((log) => log.id === promotedSource.id)).toBe(false)
    expect(flattened.some((log) => log.id === standalone.id)).toBe(true)
    expect(flattened.some((log) => log.id === buildFlattenedScenarioLogId('run-1', 'scenario-a'))).toBe(true)
  })
})

describe('deriveCampaignRunRosterSummary', () => {
  it('uses setup snapshot fallback for empty runs', () => {
    const run = makeCampaignRun({ scenarioLogs: [] })
    const summary = deriveCampaignRunRosterSummary(run)
    expect(summary).toHaveLength(1)
    expect(summary[0].investigators[0].state).toBe('current')
    expect(summary[0].investigators[0].investigatorName).toBe('Roland Banks')
  })

  it('keeps duplicate player names as distinct simultaneous seats', () => {
    const run = makeCampaignRun({
      setupSnapshot: {
        date: '2026-08-10',
        investigators: [
          {
            playerName: 'Alice',
            investigatorName: 'Roland Banks',
            archetype: 'Guardian',
          },
          {
            playerName: 'Alice',
            investigatorName: 'Daisy Walker',
            archetype: 'Seeker',
          },
        ],
      },
      scenarioLogs: [],
      currentRoster: undefined,
    })

    const summary = deriveCampaignRunRosterSummary(run)

    expect(summary).toHaveLength(2)
    expect(summary.map((seat) => seat.playerName)).toEqual(['Alice', 'Alice'])
    expect(new Set(summary.map((seat) => seat.playerKey)).size).toBe(2)
    expect(summary.map((seat) => seat.investigators[0].investigatorName)).toEqual([
      'Roland Banks',
      'Daisy Walker',
    ])
  })

  it('groups by seatId, de-dupes investigators, and preserves first-used order', () => {
    const run = makeCampaignRun({
      scenarioLogs: [
        {
          id: 's1',
          date: '2026-08-10',
          scenarioName: 'Scenario 1',
          investigators: makePlaythrough().investigators,
          rosterBefore: [makeRunRosterEntry()],
          rosterAfter: [
            makeRunRosterEntry({
              endReason: 'killed',
              seatStatus: 'eliminated',
              endedAtScenarioIndex: 0,
            }),
          ],
        },
        {
          id: 's2',
          date: '2026-08-11',
          scenarioName: 'Scenario 2',
          investigators: [
            {
              playerName: ' ALICE ',
              investigatorName: 'Stella Clark',
              archetype: 'Survivor',
            },
          ],
          rosterBefore: [
            makeRunRosterEntry({
              playerName: 'ALICE',
              investigator: {
                playerName: 'ALICE',
                investigatorName: 'Roland Banks',
                archetype: 'Guardian',
              },
              seatStatus: 'eliminated',
              endReason: 'killed',
              endedAtScenarioIndex: 0,
            }),
          ],
          rosterAfter: [
            makeRunRosterEntry({
              slotId: 'seat:alice:1:slot:2',
              playerName: 'Alice',
              investigator: {
                playerName: 'Alice',
                investigatorName: 'Stella Clark',
                archetype: 'Survivor',
              },
              startedAtScenarioIndex: 1,
              joinedAtScenarioIndex: 1,
            }),
          ],
        },
      ],
      currentRoster: [
        makeRunRosterEntry({
          slotId: 'seat:alice:1:slot:2',
          playerName: 'Alice',
          investigator: {
            playerName: 'Alice',
            investigatorName: 'Stella Clark',
            archetype: 'Survivor',
          },
          startedAtScenarioIndex: 1,
          joinedAtScenarioIndex: 1,
        }),
      ],
    })

    const summary = deriveCampaignRunRosterSummary(run)
    expect(summary).toHaveLength(1)
    expect(summary[0].keySource).toBe('seat-id')
    expect(summary[0].investigators.map((item) => item.investigatorName)).toEqual([
      'Roland Banks',
      'Stella Clark',
    ])
    expect(summary[0].investigators[0].state).toBe('killed')
    expect(summary[0].investigators[1].state).toBe('current')
    expect(summary[0].investigators[1].isCurrent).toBe(true)
  })

  it('prefers normalized currentRoster over latest raw rosterAfter and keeps killed replacements historical', () => {
    const run = makeCampaignRun({
      scenarioLogs: [
        {
          id: 's1',
          date: '2026-08-10',
          scenarioName: 'Scenario 1',
          investigators: makePlaythrough().investigators,
          rosterAfter: [
            makeRunRosterEntry({
              endReason: 'killed',
              seatStatus: 'eliminated',
              endedAtScenarioIndex: 0,
            }),
            makeRunRosterEntry({
              slotId: 'seat:alice:1:slot:2',
              playerName: 'Alice',
              investigator: {
                playerName: 'Alice',
                investigatorName: 'Stella Clark',
                archetype: 'Survivor',
              },
              startedAtScenarioIndex: 0,
              joinedAtScenarioIndex: 0,
            }),
          ],
        },
        {
          id: 's2',
          date: '2026-08-11',
          scenarioName: 'Scenario 2',
          investigators: [
            {
              playerName: 'Alice',
              investigatorName: 'Stella Clark',
              archetype: 'Survivor',
            },
          ],
          rosterAfter: [
            makeRunRosterEntry({
              endReason: 'killed',
              seatStatus: 'eliminated',
              endedAtScenarioIndex: 0,
            }),
          ],
        },
      ],
      currentRoster: [
        makeRunRosterEntry({
          slotId: 'seat:alice:1:slot:2',
          playerName: 'Alice',
          investigator: {
            playerName: 'Alice',
            investigatorName: 'Stella Clark',
            archetype: 'Survivor',
          },
          startedAtScenarioIndex: 0,
          joinedAtScenarioIndex: 0,
        }),
      ],
    })

    const summary = deriveCampaignRunRosterSummary(run)
    expect(summary).toHaveLength(1)
    expect(summary[0].investigators.map((item) => item.investigatorName)).toEqual([
      'Roland Banks',
      'Stella Clark',
    ])
    expect(summary[0].investigators[0].state).toBe('killed')
    expect(summary[0].investigators[0].isCurrent).toBe(false)
    expect(summary[0].investigators[1].state).toBe('current')
    expect(summary[0].investigators[1].isCurrent).toBe(true)
  })

  it('keeps scenario resignations current while preserving terminal historical states', () => {
    const run = makeCampaignRun({
      setupSnapshot: {
        date: '2026-08-10',
        investigators: [
          {
            playerName: 'Alice',
            investigatorName: 'Roland Banks',
            archetype: 'Guardian',
          },
          {
            playerName: 'Bob',
            investigatorName: 'Wendy Adams',
            archetype: 'Survivor',
          },
          {
            playerName: 'Cara',
            investigatorName: 'Agnes Baker',
            archetype: 'Mystic',
          },
        ],
      },
      scenarioLogs: [
        {
          id: 's1',
          date: '2026-08-10',
          scenarioName: 'Scenario 1',
          investigators: [
            {
              playerName: 'Alice',
              investigatorName: 'Stella Clark',
              archetype: 'Survivor',
            },
          ],
          investigatorOutcomes: [
            {
              seatId: 'seat:bob:1',
              slotId: 'seat:bob:1:slot:1',
              playerName: 'Bob',
              investigatorName: 'Wendy Adams',
              status: 'resigned',
              xpEarned: 1,
              traumaGainedPhysical: 0,
              traumaGainedMental: 0,
            },
          ],
          rosterAfter: [
            makeRunRosterEntry({
              seatId: 'seat:alice:1',
              slotId: 'seat:alice:1:slot:1',
              playerName: 'Alice',
              endReason: 'killed',
              seatStatus: 'eliminated',
              endedAtScenarioIndex: 0,
            }),
            makeRunRosterEntry({
              seatId: 'seat:alice:1',
              slotId: 'seat:alice:1:slot:2',
              playerName: 'Alice',
              investigator: {
                playerName: 'Alice',
                investigatorName: 'Stella Clark',
                archetype: 'Survivor',
              },
              joinedAtScenarioIndex: 0,
              startedAtScenarioIndex: 0,
            }),
            makeRunRosterEntry({
              seatId: 'seat:bob:1',
              slotId: 'seat:bob:1:slot:1',
              playerName: 'Bob',
              investigator: {
                playerName: 'Bob',
                investigatorName: 'Wendy Adams',
                archetype: 'Survivor',
              },
              seatStatus: 'left',
              endedAtScenarioIndex: 0,
            }),
            makeRunRosterEntry({
              seatId: 'seat:cara:1',
              slotId: 'seat:cara:1:slot:1',
              playerName: 'Cara',
              investigator: {
                playerName: 'Cara',
                investigatorName: 'Agnes Baker',
                archetype: 'Mystic',
              },
              seatStatus: 'eliminated',
              endReason: 'devoured',
              endedAtScenarioIndex: 0,
            }),
          ],
        },
      ],
      currentRoster: [
        makeRunRosterEntry({
          seatId: 'seat:alice:1',
          slotId: 'seat:alice:1:slot:2',
          playerName: 'Alice',
          investigator: {
            playerName: 'Alice',
            investigatorName: 'Stella Clark',
            archetype: 'Survivor',
          },
          joinedAtScenarioIndex: 0,
          startedAtScenarioIndex: 0,
        }),
        makeRunRosterEntry({
          seatId: 'seat:bob:1',
          slotId: 'seat:bob:1:slot:1',
          playerName: 'Bob',
          investigator: {
            playerName: 'Bob',
            investigatorName: 'Wendy Adams',
            archetype: 'Survivor',
          },
          seatStatus: 'left',
          endedAtScenarioIndex: 0,
        }),
      ],
    })

    const summary = deriveCampaignRunRosterSummary(run)
    const byPlayer = Object.fromEntries(summary.map((player) => [player.playerName, player]))

    expect(byPlayer.Alice.investigators.map((item) => `${item.investigatorName}:${item.state}`)).toEqual([
      'Roland Banks:killed',
      'Stella Clark:current',
    ])
    expect(byPlayer.Bob.investigators[0].state).toBe('current')
    expect(byPlayer.Bob.investigators[0].isCurrent).toBe(true)
    expect(byPlayer.Cara.investigators[0].state).toBe('devoured')
    expect(byPlayer.Cara.investigators[0].isCurrent).toBe(false)
  })

  it('falls back to normalized player names for legacy minimal logs and marks unknown_former when needed', () => {
    const run = makeCampaignRun({
      currentRoster: undefined,
      scenarioLogs: [
        {
          id: 's1',
          date: '2026-08-10',
          scenarioName: 'Scenario 1',
          investigators: [
            {
              playerName: ' Alice  ',
              investigatorName: 'Roland Banks',
              archetype: 'Guardian',
            },
          ],
        },
        {
          id: 's2',
          date: '2026-08-11',
          scenarioName: 'Scenario 2',
          investigators: [
            {
              playerName: 'alice',
              investigatorName: 'Daisy Walker',
              archetype: 'Seeker',
            },
          ],
        },
      ],
    })

    const summary = deriveCampaignRunRosterSummary(run)
    expect(summary).toHaveLength(1)
    expect(summary[0].keySource).toBe('normalized-player-name')
    expect(summary[0].investigators.map((item) => item.investigatorName)).toEqual(['Roland Banks', 'Daisy Walker'])
    expect(summary[0].investigators[0].state).toBe('unknown_former')
    expect(summary[0].investigators[1].state).toBe('current')
  })
})

describe('campaign count summary', () => {
  it('keeps campaign counts stable across child append/edit/delete and promotion', () => {
    const promotedSource = makePlaythrough({
      id: 'source-1',
      promotedToCampaignRunId: 'run-1',
      scenarioName: 'Curtain Call',
    })
    const runOne = makeCampaignRun({
      id: 'run-1',
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
      scenarioLogs: [
        {
          id: 's1',
          date: '2026-08-11',
          scenarioName: 'Curtain Call',
          investigators: promotedSource.investigators,
        },
      ],
    })
    const runTwo = {
      ...runOne,
      scenarioLogs: [
        ...runOne.scenarioLogs,
        {
          id: 's2',
          date: '2026-08-12',
          scenarioName: 'The Last King',
          investigators: promotedSource.investigators,
        },
      ],
    }

    const withOne = computeCampaignCountSummary([promotedSource], [runOne])
    const withTwo = computeCampaignCountSummary([promotedSource], [runTwo])

    expect(withOne.campaignRunsPlayedCount).toBe(1)
    expect(withTwo.campaignRunsPlayedCount).toBe(1)
    expect(withOne.uniqueCampaignFamilyCount).toBe(1)
    expect(withTwo.uniqueCampaignFamilyCount).toBe(1)
  })

  it('counts two same-name runs as two runs while deduping unique campaign family', () => {
    const runA = makeCampaignRun({
      id: 'run-a',
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
    })
    const runB = makeCampaignRun({
      id: 'run-b',
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
    })

    const summary = computeCampaignCountSummary([], [runA, runB])
    expect(summary.campaignRunsPlayedCount).toBe(2)
    expect(summary.uniqueCampaignFamilyCount).toBe(1)
  })

  it('keeps campaign counters stable when appending side scenarios while game-night rows increase', () => {
    const runWithCampaignOnly = makeCampaignRun({
      id: 'run-side-check',
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
      scenarioLogs: [
        {
          id: 's1',
          date: '2026-08-11',
          scenarioName: 'Curtain Call',
          scenarioType: 'standard',
          investigators: makePlaythrough().investigators,
        },
      ],
    })
    const runWithSideScenario = {
      ...runWithCampaignOnly,
      scenarioLogs: [
        ...runWithCampaignOnly.scenarioLogs,
        {
          id: 's2',
          date: '2026-08-12',
          scenarioName: 'Curse of the Rougarou',
          scenarioType: 'side_scenario' as const,
          investigators: makePlaythrough().investigators,
        },
      ],
    }

    const summaryWithoutSide = computeCampaignCountSummary([], [runWithCampaignOnly])
    const summaryWithSide = computeCampaignCountSummary([], [runWithSideScenario])

    expect(summaryWithoutSide.campaignRunsPlayedCount).toBe(1)
    expect(summaryWithSide.campaignRunsPlayedCount).toBe(1)
    expect(summaryWithoutSide.uniqueCampaignFamilyCount).toBe(1)
    expect(summaryWithSide.uniqueCampaignFamilyCount).toBe(1)

    const flattenedWithoutSide = flattenGameLogs({ playthroughs: [], campaignRuns: [runWithCampaignOnly] })
    const flattenedWithSide = flattenGameLogs({ playthroughs: [], campaignRuns: [runWithSideScenario] })

    expect(flattenedWithoutSide).toHaveLength(1)
    expect(flattenedWithSide).toHaveLength(2)
  })
})

describe('flattened rows', () => {
  it('keeps same-lineage runs separate by run id and synthetic scenario id', () => {
    const runA = makeCampaignRun({
      id: 'run-a',
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
      scenarioLogs: [
        {
          id: 'scenario-1',
          date: '2026-08-01',
          scenarioName: 'Curtain Call',
          investigators: makePlaythrough().investigators,
        },
      ],
    })
    const runB = makeCampaignRun({
      id: 'run-b',
      campaignLineageId: 'campaign:path-to-carcosa',
      campaignName: 'The Path to Carcosa',
      scenarioLogs: [
        {
          id: 'scenario-1',
          date: '2026-08-02',
          scenarioName: 'Curtain Call',
          investigators: makePlaythrough().investigators,
        },
      ],
    })

    const flattened = flattenGameLogs({
      playthroughs: [],
      campaignRuns: [runA, runB],
    })
    const ids = flattened.map((entry) => entry.id)

    expect(ids).toContain('campaign-run:run-a:scenario:scenario-1')
    expect(ids).toContain('campaign-run:run-b:scenario:scenario-1')
    expect(new Set(ids).size).toBe(ids.length)
    expect(flattened.map((entry) => entry.campaignRunId)).toEqual(['run-a', 'run-b'])
  })

  it('keeps legacy group totals unallocated and out of flattened stats rows', () => {
    const legacyScenario = {
      id: 'legacy-scenario',
      date: '2026-08-03',
      scenarioName: 'Curtain Call',
      investigators: makePlaythrough().investigators,
      xpEarned: 6,
      xpBonusPenalty: -1,
      physicalTrauma: 1,
      mentalTrauma: 2,
    } as unknown as CampaignRun['scenarioLogs'][number]
    const run = makeCampaignRun({ scenarioLogs: [legacyScenario] })

    expect(getLegacyGroupScenarioOutcome(legacyScenario)).toEqual({
      xpEarned: 6,
      victoryDisplayTotal: undefined,
      xpBonusPenalty: -1,
      physicalTrauma: 1,
      mentalTrauma: 2,
    })

    const [flattened] = flattenGameLogs({ playthroughs: [], campaignRuns: [run] })
    expect(flattened).not.toHaveProperty('xpEarned')
    expect(flattened).not.toHaveProperty('physicalTrauma')
    expect(flattened).not.toHaveProperty('mentalTrauma')
  })
})
