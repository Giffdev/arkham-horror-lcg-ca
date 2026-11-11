import { describe, expect, it } from 'vitest'
import { getPlayerCampaignHistory, getPlayerPlayedCampaignNames, getScenarioPackNames } from './campaign-play-history'
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
  it.each(['run', 'legacy'] as const)('preserves distinct historical slot identities for %s outcomes', sourceKind => {
    const assignments: Playthrough['investigators'] = [
      { playerName: 'Alice', investigatorName: 'Joe Diamond', investigatorId: 'joe-diamond',
        chapter: 1, investigatorSet: 'The Circle Undone', archetype: 'Seeker', archetypes: ['Seeker'] },
      { playerName: 'Alice', investigatorName: 'Joe Diamond', investigatorId: 'joe-diamond-ch2',
        chapter: 2, investigatorSet: 'Core 2026', archetype: 'Seeker', archetypes: ['Seeker'] },
      { playerName: 'Alice', investigatorName: 'Joe Diamond', investigatorId: 'custom-joe',
        isCustom: true, customInvestigatorName: 'Joe Diamond', archetype: 'Mystic' },
    ]
    const source = legacy({ scenarioName: 'Extracurricular Activity', investigators: assignments })
    const campaign = buildCampaignRunFromSourcePlaythrough(source)
    const log = campaign.scenarioLogs[0]
    log.rosterBefore = structuredClone(campaign.currentRoster!)
    log.rosterBefore[1].seatId = log.rosterBefore[0].seatId
    log.investigators = [...assignments].reverse()
    log.investigatorOutcomes = log.rosterBefore.map(entry => ({
      seatId: entry.seatId, slotId: entry.slotId, playerName: entry.playerName,
      investigatorName: entry.investigator.investigatorName,
      status: 'survived', xpEarned: 0, traumaGainedPhysical: 0, traumaGainedMental: 0,
    }))
    log.rosterBefore.unshift({
      ...log.rosterBefore[1], seatId: 'different-seat', investigator: assignments[0],
    })
    // Neither a later replacement nor list position identifies the historical participant.
    campaign.currentRoster = campaign.currentRoster!.map(entry => ({
      ...entry, slotId: `${entry.slotId}:replacement`, investigator: investigators[0],
    }))
    const playthroughs = sourceKind === 'legacy' ? [{ ...source, ...log }] : []
    const runs = sourceKind === 'run' ? [campaign] : []
    const before = JSON.stringify([playthroughs, runs])
    for (const player of [null, 'Alice']) {
      expect(getPlayerCampaignHistory(player, playthroughs, runs)
        .get('The Dunwich Legacy')?.[0].investigators).toEqual(assignments)
    }
    expect(JSON.stringify([playthroughs, runs])).toBe(before)
  })

  it('uses the exact historical after-snapshot slot when before-snapshot identity is unavailable', () => {
    const chapterTwo: Playthrough['investigators'][number] = {
      playerName: 'Alice', investigatorName: 'Joe Diamond', investigatorId: 'joe-diamond',
      chapter: 2, investigatorSet: 'Core 2026', archetype: 'Seeker',
    }
    const campaign = buildCampaignRunFromSourcePlaythrough(legacy({
      scenarioName: 'Extracurricular Activity', investigators: [chapterTwo],
    }))
    const log = campaign.scenarioLogs[0]
    log.rosterAfter = structuredClone(campaign.currentRoster!)
    log.investigators = []
    const entry = log.rosterAfter[0]
    log.investigatorOutcomes = [{
      seatId: entry.seatId, slotId: entry.slotId, playerName: entry.playerName,
      investigatorName: chapterTwo.investigatorName,
      status: 'survived', xpEarned: 0, traumaGainedPhysical: 0, traumaGainedMental: 0,
    }]
    expect(getPlayerCampaignHistory('Alice', [], [campaign])
      .get('The Dunwich Legacy')?.[0].investigators).toEqual([
      { ...chapterTwo, archetypes: ['Seeker'] },
    ])
  })

  it('uses name-only outcome fallback only for unambiguous historical identities', () => {
    const joe = { playerName: 'Alice', investigatorName: 'Joe Diamond', archetype: 'Seeker' as const }
    const outcome = {
      seatId: 'alice', slotId: 'missing', playerName: 'Alice', investigatorName: 'Joe Diamond',
      status: 'survived' as const, xpEarned: 0, traumaGainedPhysical: 0, traumaGainedMental: 0,
    }
    for (const assignments of [
      [{ ...joe, chapter: 1 as const }, { ...joe, chapter: 2 as const }],
      [joe],
      [],
    ]) {
      const history = getPlayerCampaignHistory(null, [legacy({
        investigators: assignments, investigatorOutcomes: [outcome],
      })], [])
      expect(history.get('The Dunwich Legacy')?.[0].investigators[0]).toMatchObject({
        playerName: 'Alice', isUnknown: true, archetype: 'Unknown',
      })
    }
    const chapterTwo = { ...joe, chapter: 2 as const, investigatorSet: 'Core 2026' }
    expect(getPlayerCampaignHistory('Alice', [legacy({
      investigators: [chapterTwo], investigatorOutcomes: [outcome],
    })], []).get('The Dunwich Legacy')?.[0].investigators).toEqual([
      { ...chapterTwo, archetypes: ['Seeker'] },
    ])
  })

  it('uses the same real history rows for multipart closure without fabricating sessions or pooling individual players', () => {
    const first = 'The Eternal Slumber'
    const second = "The Night's Usurper"
    const parent = 'Guardians of the Abyss'
    const records = [legacy({
      campaignName: first, campaignType: 'Scenario Pack', investigators: [investigators[0]],
    }), legacy({
      id: 'bob', campaignName: second, campaignType: 'Scenario Pack', investigators: [investigators[1]],
    })]
    const all = getPlayerCampaignHistory(null, records, [])
    expect(all.get(parent)?.map(row => row.id)).toEqual(['legacy:legacy', 'legacy:bob'])
    expect(all.get(first)).toHaveLength(1)
    expect(all.get(second)).toHaveLength(1)
    expect(getPlayerCampaignHistory('Alice', records, []).has(parent)).toBe(false)
    expect(getPlayerCampaignHistory('Bob', records, []).has(parent)).toBe(false)
    const explicit = getPlayerCampaignHistory('Alice', [legacy({
      campaignName: parent, campaignType: 'Scenario Pack',
    })], [])
    for (const name of [parent, first, second]) {
      expect(explicit.get(name)?.map(row => row.id)).toEqual(['legacy:legacy'])
    }
  })

  it.each([undefined, '', 'The Dunwich Legacy', 'Extracurricular Activity'])(
    'retains promoted side-story history for source scenario %s, deduplicating copied log evidence',
    scenarioName => {
      const source = legacy({ scenarioName, sideStories: ['Curse of the Rougarou', 'Curse of the Rougarou'] })
      const promoted = buildCampaignRunFromSourcePlaythrough(source, { campaignRunId: 'promoted' })
      const records = [{ ...source, promotedToCampaignRunId: promoted.id }]
      const before = JSON.stringify([records, promoted])
      const history = getPlayerCampaignHistory('Alice', records, [promoted])
      expect(history.get('Curse of the Rougarou')).toHaveLength(1)
      expect(history.get('Curse of the Rougarou')?.[0].investigators.map(inv => inv.playerName)).toEqual(['Alice'])
      expect(history.has('The Dunwich Legacy')).toBe(scenarioName === 'Extracurricular Activity')
      expect(JSON.stringify([records, promoted])).toBe(before)
    },
  )

  it('keeps global empty-outcome and setup-only histories empty', () => {
    expect(getPlayerCampaignHistory(null, [legacy({ investigatorOutcomes: [] })], [
      run({ scenarioLogs: [] }),
      run({ id: 'empty', scenarioLogs: [scenario({ investigatorOutcomes: [] })] }),
    ])).toEqual(new Map())
  })

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
