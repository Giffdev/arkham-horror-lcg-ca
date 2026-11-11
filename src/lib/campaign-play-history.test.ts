import { describe, expect, it } from 'vitest'
import { getPlayerPlayedCampaignNames, getScenarioPackNames } from './campaign-play-history'
import { buildCampaignRunFromSourcePlaythrough } from './campaign-runs'
import { getActualCampaignScenarioLogs } from './scenario-night-utils'
import type { CampaignRun, CampaignScenarioLog, Playthrough } from './types'

const investigators: Playthrough['investigators'] = [
  { playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' },
  { playerName: 'Bob', investigatorName: 'Daisy Walker', archetype: 'Seeker' },
]

function legacy(overrides: Partial<Playthrough> = {}): Playthrough {
  return {
    id: 'legacy', date: '2026-01-01', campaignName: 'The Dunwich Legacy',
    campaignType: 'Full Campaign', investigators, ...overrides,
  }
}

function scenario(overrides: Partial<CampaignScenarioLog> = {}): CampaignScenarioLog {
  return { id: 'scenario', date: '2026-01-01', scenarioName: 'Extracurricular Activity', investigators, ...overrides }
}

function run(overrides: Partial<CampaignRun> = {}): CampaignRun {
  return {
    id: 'run', version: 2, campaignLineageId: 'dunwich', campaignName: 'The Dunwich Legacy',
    campaignType: 'Full Campaign', startedAt: '2026-01-01', updatedAt: '2026-01-01',
    status: 'active', setupSnapshot: { date: '2026-01-01', investigators },
    scenarioLogs: [scenario()], ...overrides,
  }
}

describe('player campaign play evidence', () => {
  it('credits one scenario in an active full or small campaign, without requiring completion', () => {
    const runs = [run(), run({
      id: 'small', campaignName: 'Children of Blood', campaignType: 'Small Campaign',
      scenarioLogs: [scenario({ scenarioName: 'By the Book' })],
    })]
    expect([...getPlayerPlayedCampaignNames('Alice', [], runs)]).toEqual(['The Dunwich Legacy', 'Children of Blood'])
  })

  it('credits standalone legacy records and legacy campaign-level records without rewriting them', () => {
    const records = [
      legacy(),
      legacy({ id: 'small', campaignName: 'The Night of the Zealot', campaignType: 'Small Campaign' }),
      legacy({ id: 'pack', campaignName: 'Carnevale of Horrors', campaignType: 'Scenario Pack' }),
    ]
    const before = JSON.stringify(records)
    expect([...getPlayerPlayedCampaignNames('Alice', records, [])]).toEqual([
      'The Dunwich Legacy', 'The Night of the Zealot', 'Carnevale of Horrors',
    ])
    expect(JSON.stringify(records)).toBe(before)
  })

  it('preserves legacy campaign-name metadata matching for independent standalones', () => {
    expect(getPlayerPlayedCampaignNames('Alice', [legacy({
      campaignName: ' Carnevale of Horrors ', campaignType: 'Scenario Pack',
    })], [])).toEqual(new Set(['Carnevale of Horrors']))
  })

  it('credits standalone campaign-run logs and uses legacy outcome participants for side stories', () => {
    const outcome: NonNullable<Playthrough['investigatorOutcomes']>[number] = {
      seatId: 'alice', slotId: 'roland', playerName: 'Alice', investigatorName: 'Roland Banks',
      status: 'survived', xpEarned: 0, traumaGainedPhysical: 0, traumaGainedMental: 0,
    }
    const standalone = run({
      campaignName: 'Carnevale of Horrors', campaignType: 'Scenario Pack',
      scenarioLogs: [scenario({ scenarioName: 'Carnevale of Horrors', investigators: [investigators[0]] })],
    })
    const records = [legacy({ sideStories: ['Curse of the Rougarou'], investigatorOutcomes: [outcome] })]
    expect([...getPlayerPlayedCampaignNames('Alice', records, [standalone])]).toEqual([
      'The Dunwich Legacy', 'Curse of the Rougarou', 'Carnevale of Horrors',
    ])
    expect([...getPlayerPlayedCampaignNames('Bob', records, [standalone])]).toEqual([])
  })

  it('uses actual outcomes instead of the run roster or the broad investigator list', () => {
    const side = scenario({
      scenarioName: 'Curse of the Rougarou', scenarioType: 'side_scenario',
      investigatorOutcomes: [{
        seatId: 'alice', slotId: 'roland', playerName: 'Alice', investigatorName: 'Roland Banks',
        status: 'survived', xpEarned: 0, traumaGainedPhysical: 0, traumaGainedMental: 0,
      }],
    })
    const campaign = run({ scenarioLogs: [side] })
    expect([...getPlayerPlayedCampaignNames(' Alice ', [], [campaign])]).toEqual(['Curse of the Rougarou'])
    expect([...getPlayerPlayedCampaignNames('Bob', [], [campaign])]).toEqual([])
    expect([...getPlayerPlayedCampaignNames('Ali', [], [campaign])]).toEqual([])
  })

  it('distinguishes explicit empty outcomes from absent legacy outcomes', () => {
    const standalone = legacy({
      campaignName: 'Carnevale of Horrors', campaignType: 'Scenario Pack',
    })
    const campaign = run({ scenarioLogs: [scenario({
      scenarioName: 'Carnevale of Horrors', scenarioType: 'side_scenario',
    })] })
    expect([...getPlayerPlayedCampaignNames('Alice', [standalone], [])]).toEqual(['Carnevale of Horrors'])
    expect([...getPlayerPlayedCampaignNames('Alice', [], [campaign])]).toEqual(['Carnevale of Horrors'])
    expect([...getPlayerPlayedCampaignNames('Alice', [{ ...standalone, investigatorOutcomes: [] }], [])]).toEqual([])
    campaign.scenarioLogs[0].investigatorOutcomes = []
    expect([...getPlayerPlayedCampaignNames('Alice', [], [campaign])]).toEqual([])
  })

  it.each([
    { outcomes: undefined, alice: true, bob: true },
    { outcomes: [], alice: false, bob: false },
    { outcomes: [{
      seatId: 'alice', slotId: 'roland', playerName: 'Alice', investigatorName: 'Roland Banks',
      status: 'survived' as const, xpEarned: 0, traumaGainedPhysical: 0, traumaGainedMental: 0,
    }], alice: true, bob: false },
  ])('preserves explicit shell side stories through promotion with strict participants: $outcomes', ({ outcomes, alice, bob }) => {
    const source = legacy({
      scenarioName: 'The Dunwich Legacy', sideStories: ['Curse of the Rougarou'],
      investigatorOutcomes: outcomes,
    })
    const promoted = buildCampaignRunFromSourcePlaythrough(source, { campaignRunId: 'run' })
    const suppressedSource = { ...source, promotedToCampaignRunId: promoted.id }
    expect(getActualCampaignScenarioLogs(promoted)).toEqual([])
    for (const [player, expected] of [['Alice', alice], ['Bob', bob], ['Ali', false]] as const) {
      const before = getPlayerPlayedCampaignNames(player, [source], [])
      const after = getPlayerPlayedCampaignNames(player, [suppressedSource], [promoted])
      expect(before.has('Curse of the Rougarou')).toBe(expected)
      expect(after.has('Curse of the Rougarou')).toBe(expected)
      expect(after.has('The Dunwich Legacy')).toBe(false)
    }
  })

  it('falls back to scenario assignments for older logs, never setup or later participants', () => {
    const campaign = run({
      scenarioLogs: [
        scenario({ investigators: [investigators[0]], scenarioName: 'Carnevale of Horrors', scenarioType: 'side_scenario' }),
        scenario({ id: 'later', investigators: [investigators[1]] }),
      ],
    })
    expect([...getPlayerPlayedCampaignNames('Alice', [], [campaign])]).toEqual(['Carnevale of Horrors'])
    expect([...getPlayerPlayedCampaignNames('Bob', [], [campaign])]).toEqual(['The Dunwich Legacy'])
  })

  it('matches sideStories on legacy and campaign logs and does not credit other players', () => {
    const records = [legacy({
      investigators: [investigators[0]], sideStories: ['Curse of the Rougarou', 'Not a real pack'],
    })]
    const campaign = run({ scenarioLogs: [scenario({
      investigators: [investigators[1]], sideStories: ['Carnevale of Horrors'],
    })] })
    expect([...getPlayerPlayedCampaignNames('Alice', records, [campaign])]).toEqual(['The Dunwich Legacy', 'Curse of the Rougarou'])
    expect([...getPlayerPlayedCampaignNames('Bob', records, [campaign])]).toEqual(['The Dunwich Legacy', 'Carnevale of Horrors'])
  })

  it('does not count run setup, interludes, promoted root shells, or suppressed legacy rosters', () => {
    const campaign = run({ scenarioLogs: [
      scenario({ scenarioName: 'The Dunwich Legacy', legacySourcePlaythroughId: 'legacy' }),
      scenario({ id: 'interlude', scenarioName: 'Interlude I', scenarioType: 'interlude' }),
    ] })
    expect([...getPlayerPlayedCampaignNames('Alice', [
      legacy({ promotedToCampaignRunId: 'run' }),
    ], [campaign, run({ id: 'setup', scenarioLogs: [] })])]).toEqual([])
  })

  it('ignores unknown/custom campaign identity and does not guess ambiguous sets', () => {
    expect([...getPlayerPlayedCampaignNames('Alice', [
      legacy({ campaignName: 'Fan-Made', customCampaignName: 'The Dunwich Legacy', campaignType: 'Fan-Made' }),
      legacy({ id: 'unknown', campaignName: 'Unlisted', campaignSet: 'Core 2026', campaignType: 'Small Campaign' }),
    ], [])]).toEqual([])
  })

  it('does not credit a multipart parent or sibling from one in-campaign child', () => {
    const played = getPlayerPlayedCampaignNames('Alice', [], [
      run({ scenarioLogs: [scenario({ scenarioName: 'The Eternal Slumber', scenarioType: 'side_scenario' })] }),
    ])
    expect([...played]).toEqual(['The Eternal Slumber'])
    expect(played.has("The Night's Usurper")).toBe(false)
  })

  describe.each([
    ['Guardians of the Abyss', 'The Eternal Slumber', "The Night's Usurper"],
    ['Fortune and Folly', 'Fortune and Folly, Part I', 'Fortune and Folly, Part II'],
  ])('%s multipart history', (parent, first, second) => {
    const pack = (name: string, overrides: Partial<Playthrough> = {}) => legacy({
      campaignName: name, campaignType: 'Scenario Pack', ...overrides,
    })

    it('expands explicit legacy and standalone-run parent records to both children without mutating history', () => {
      const record = pack(parent)
      const campaign = run({
        campaignName: parent, campaignType: 'Scenario Pack',
        scenarioLogs: [scenario({ scenarioName: parent })],
      })
      const before = JSON.stringify([record, campaign])
      for (const played of [
        getPlayerPlayedCampaignNames('Alice', [record], []),
        getPlayerPlayedCampaignNames('Alice', [pack(` ${parent} `)], []),
        getPlayerPlayedCampaignNames('Alice', [], [campaign]),
      ]) {
        expect(played).toEqual(new Set([parent, first, second]))
      }
      expect(JSON.stringify([record, campaign])).toBe(before)
    })

    it('combines both children across standalone records and different campaign runs for the same player', () => {
      const campaigns = [first, second].map((name, index) => run({
        id: `run-${index}`,
        scenarioLogs: [scenario({ scenarioName: name, scenarioType: 'side_scenario' })],
      }))
      expect(getPlayerPlayedCampaignNames('Alice', [pack(first), pack(second, { id: 'second' })], []))
        .toEqual(new Set([parent, first, second]))
      expect(getPlayerPlayedCampaignNames('Alice', [], campaigns))
        .toEqual(new Set([parent, first, second]))
    })

    it('does not treat a standalone parent container with only one logged child as the whole package', () => {
      const campaign = run({
        campaignName: parent, campaignType: 'Scenario Pack',
        scenarioLogs: [scenario({ scenarioName: first })],
      })
      expect(getPlayerPlayedCampaignNames('Alice', [pack(parent, { scenarioName: first })], []))
        .toEqual(new Set([first]))
      expect(getPlayerPlayedCampaignNames('Alice', [], [campaign])).toEqual(new Set([first]))
      campaign.scenarioLogs.push(scenario({ id: 'second', scenarioName: second }))
      expect(getPlayerPlayedCampaignNames('Alice', [], [campaign])).toEqual(new Set([parent, first, second]))
    })

    it('does not pool different players or count duplicate logs of one child as both children', () => {
      const records = [
        pack(first, { investigators: [investigators[0]] }),
        pack(first, { id: 'duplicate', investigators: [investigators[0]] }),
        pack(second, { id: 'bob', investigators: [investigators[1]] }),
      ]
      expect(getPlayerPlayedCampaignNames('Alice', records, [])).toEqual(new Set([first]))
      expect(getPlayerPlayedCampaignNames('Bob', records, [])).toEqual(new Set([second]))
      expect(getPlayerPlayedCampaignNames('Ali', records, [])).toEqual(new Set())
    })

    it('uses each standalone-run log’s outcomes instead of pooling the package roster', () => {
      const campaign = run({
        campaignName: parent, campaignType: 'Scenario Pack',
        scenarioLogs: [first, first, second].map((name, index) => {
          const participant = investigators[index === 2 ? 1 : 0]
          return scenario({
            id: `part-${index}`, scenarioName: name,
            investigatorOutcomes: [{
              seatId: participant.playerName, slotId: participant.investigatorName,
              playerName: participant.playerName, investigatorName: participant.investigatorName,
              status: 'survived', xpEarned: 0, traumaGainedPhysical: 0, traumaGainedMental: 0,
            }],
          })
        }),
      })
      expect(getPlayerPlayedCampaignNames('Alice', [], [campaign])).toEqual(new Set([first]))
      expect(getPlayerPlayedCampaignNames('Bob', [], [campaign])).toEqual(new Set([second]))
    })

    it('combines legacy side stories and in-campaign logs, retaining side-story evidence after promotion', () => {
      const source = legacy({ scenarioName: 'The Dunwich Legacy', sideStories: [first] })
      const promoted = buildCampaignRunFromSourcePlaythrough(source, { campaignRunId: 'promoted' })
      const campaign = run({
        id: 'other-run', scenarioLogs: [scenario({ scenarioName: second, scenarioType: 'side_scenario' })],
      })
      expect(getPlayerPlayedCampaignNames('Alice', [source], [])).toEqual(new Set([first, 'The Dunwich Legacy']))
      expect(getPlayerPlayedCampaignNames('Alice', [{ ...source, promotedToCampaignRunId: promoted.id }], [promoted]))
        .toEqual(new Set([first]))
      expect(getPlayerPlayedCampaignNames('Alice', [source], [campaign]))
        .toEqual(new Set(['The Dunwich Legacy', parent, first, second]))
      expect(getPlayerPlayedCampaignNames('Alice', [{ ...source, promotedToCampaignRunId: promoted.id }], [promoted, campaign]))
        .toEqual(new Set([parent, first, second]))
    })

    describe.each([undefined, ''])('promoted source with scenarioName %s', scenarioName => {
      it.each([
        { evidence: 'absent outcomes', participants: undefined, alice: true, bob: true },
        { evidence: 'empty outcomes', participants: [], alice: false, bob: false },
        { evidence: 'Alice-only outcomes', participants: [investigators[0]], alice: true, bob: false },
      ])('retains explicit side stories with $evidence without crediting the root', ({ participants, alice, bob }) => {
        const source = legacy({
          scenarioName, sideStories: [first, first], xpEarned: 4,
          investigatorOutcomes: participants?.map(participant => ({
            seatId: participant.playerName, slotId: participant.investigatorName,
            playerName: participant.playerName, investigatorName: participant.investigatorName,
            status: 'survived', xpEarned: 4, traumaGainedPhysical: 0, traumaGainedMental: 0,
          })),
        })
        const promoted = buildCampaignRunFromSourcePlaythrough(source, { campaignRunId: 'promoted' })
        const suppressedSource = { ...source, promotedToCampaignRunId: promoted.id }
        const other = run({
          id: 'other-run', scenarioLogs: [scenario({
            scenarioName: second, scenarioType: 'side_scenario',
            investigators: [investigators[0]], xpEarned: 3,
          })],
        })
        const before = JSON.stringify([source, suppressedSource, promoted, other])
        expect(promoted.scenarioLogs).toEqual([])
        for (const [player, participated] of [['Alice', alice], ['Bob', bob], ['Ali', false]] as const) {
          expect(getPlayerPlayedCampaignNames(player, [suppressedSource], [promoted]))
            .toEqual(new Set(participated ? [first] : []))
          const expected = player === 'Alice'
            ? participated ? [parent, first, second] : [second]
            : participated ? [first] : []
          expect(getPlayerPlayedCampaignNames(player, [suppressedSource], [promoted, other]))
            .toEqual(new Set(expected))
        }
        expect(JSON.stringify([source, suppressedSource, promoted, other])).toBe(before)
      })
    })

    it('does not complete from explicitly empty outcomes, interludes, or inexact identities', () => {
      const campaign = run({ scenarioLogs: [
        scenario({ scenarioName: first, scenarioType: 'side_scenario' }),
        scenario({ id: 'empty', scenarioName: second, investigatorOutcomes: [], scenarioType: 'side_scenario' }),
        scenario({ id: 'interlude', scenarioName: parent, scenarioType: 'interlude' }),
      ] })
      expect(getPlayerPlayedCampaignNames('Alice', [
        pack(parent, { investigatorOutcomes: [] }),
        legacy({ sideStories: [second], investigatorOutcomes: [] }),
        pack(`${second} remix`),
      ], [campaign])).toEqual(new Set([first]))
    })

    it('expands explicit parent side stories but retains broad parent matching only for catalog filters', () => {
      const source = legacy({ scenarioName: 'The Dunwich Legacy', sideStories: [parent] })
      const promoted = buildCampaignRunFromSourcePlaythrough(source, { campaignRunId: 'promoted' })
      expect(getPlayerPlayedCampaignNames('Alice', [{ ...source, promotedToCampaignRunId: promoted.id }], [promoted]))
        .toEqual(new Set([parent, first, second]))
      expect(getPlayerPlayedCampaignNames('Alice', [], [run({
        scenarioLogs: [scenario({ scenarioName: parent, scenarioType: 'side_scenario' })],
      })])).toEqual(new Set([parent, first, second]))
      expect(getScenarioPackNames(pack(first))).toEqual(expect.arrayContaining([parent, first]))
    })
  })

  it('requires exact side-scenario catalog identities, not note text or substring matches', () => {
    expect(getScenarioPackNames(legacy({
      notes: 'Carnevale of Horrors', sideStories: ['Curse of the Rougarou remix'],
    }))).toEqual([])
  })
})
