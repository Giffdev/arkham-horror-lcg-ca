import { describe, expect, it } from 'vitest'
import { getSideScenarioEntryGuidance } from './side-scenario-entry'
import type { CampaignRun, CampaignScenarioLog } from './types'

const campaign: Pick<CampaignRun, 'campaignName' | 'campaignType'> = {
  campaignName: 'The Path to Carcosa',
  campaignType: 'Full Campaign',
}

function sideScenario(scenarioName: string): Pick<CampaignScenarioLog, 'scenarioName' | 'scenarioType'> {
  return { scenarioName, scenarioType: 'side_scenario' }
}

describe('campaign side-scenario entry guidance', () => {
  it.each([
    ['Curse of the Rougarou', 1],
    ['Carnevale of Horrors', 3],
    ['Murder at the Excelsior Hotel', 3],
    ['The Blob That Ate Everything', 2],
    ['War of the Outer Gods', 3],
    ['Machinations Through Time', 2],
    ['The Midwinter Gala', 2],
    ['Film Fatale', 3],
    ['Traces To Nowhere', 2],
    ['The Eternal Slumber', 2],
    ["The Night's Usurper", 2],
  ])('shows the published per-investigator cost for %s', (name, xp) => {
    expect(getSideScenarioEntryGuidance(campaign, sideScenario(String(name)))?.summary)
      .toBe(`Entry cost: -${xp} XP per investigator.`)
  })

  it('does not turn custom, missing, or similar-but-unknown prices into zero', () => {
    for (const name of ['My Custom Side Story', 'Fortune and Folly, Part III', 'The Blob That Ate Everything ELSE']) {
      expect(getSideScenarioEntryGuidance(campaign, sideScenario(name))?.summary)
        .toBe('Entry XP cost unknown / unverified.')
    }
    expect(getSideScenarioEntryGuidance(campaign, sideScenario(''))).toBeNull()
  })

  it('suppresses entry guidance for standalone runs and ordinary campaign scenarios', () => {
    expect(getSideScenarioEntryGuidance({ ...campaign, campaignType: 'Scenario Pack' }, sideScenario('Traces To Nowhere'))).toBeNull()
    expect(getSideScenarioEntryGuidance(campaign, { scenarioName: 'Curtain Call', scenarioType: 'standard' })).toBeNull()
    expect(getSideScenarioEntryGuidance({ ...campaign, campaignType: 'Fan-Made' }, { scenarioName: 'Traces To Nowhere' })).toBeNull()
    expect(getSideScenarioEntryGuidance(campaign, { scenarioName: 'My Custom Scenario' })).toBeNull()
  })

  it.each(['Fortune and Folly', 'Fortune and Folly, Part I'])('shows one shared entry fee for %s', (name) => {
    const guidance = getSideScenarioEntryGuidance(campaign, sideScenario(name))
    expect(guidance?.summary).toBe('Entry cost: -3 XP per investigator, once for both parts.')
    expect(guidance?.detail).toContain('Part II may be played directly')
  })

  it('shows no additional Part II fee after an explicit Part I without claiming payment', () => {
    const guidance = getSideScenarioEntryGuidance(campaign, sideScenario('Fortune and Folly, Part II'), [
      sideScenario('Fortune and Folly, Part I'),
    ])
    expect(guidance?.summary).toBe('No additional entry XP for Part II when continuing Part I.')
    expect(guidance?.detail).toContain('-3 XP per investigator')
    expect(guidance?.detail).toContain('not evidence that entry XP was paid')
  })

  it.each([
    { history: [] },
    { history: [sideScenario('Fortune and Folly')] },
    { history: [{ scenarioName: 'Fortune and Folly, Part I' }] },
  ])('keeps direct Part II entry conditional when earlier history is ambiguous: $history', ({ history }) => {
    const guidance = getSideScenarioEntryGuidance(campaign, sideScenario('Fortune and Folly, Part II'), history)
    expect(guidance?.summary).toBe('Entry cost: -3 XP per investigator if starting directly with Part II.')
    expect(guidance?.detail).toContain('If continuing Part I, there is no additional entry cost')
    expect(guidance?.detail).not.toContain('already paid')
  })

  it('explains Guardians costs separately and preserves the published direct-start/order rule', () => {
    const pack = getSideScenarioEntryGuidance(campaign, sideScenario('Guardians of the Abyss'))
    expect(pack?.summary).toBe('Guardians of the Abyss has two separately priced scenarios.')
    expect(pack?.detail).toContain('each cost -2 XP per investigator')
    expect(pack?.detail).toContain('cannot identify which entry cost applies')
    for (const name of ['The Eternal Slumber', "The Night's Usurper"]) {
      expect(getSideScenarioEntryGuidance(campaign, sideScenario(name))?.detail)
        .toContain("The Night's Usurper may be played directly; The Eternal Slumber cannot be played afterwards")
    }
  })

  it.each(['The Labyrinths of Lunacy', 'Barkham Horror: The Meddling of Meowlathotep'])('does not invent a free campaign price for %s', (name) => {
    const guidance = getSideScenarioEntryGuidance(campaign, sideScenario(name))
    expect(guidance?.summary).toBe('Campaign integration is not supported by the published rules.')
    expect(guidance?.detail).toContain('standalone')
    expect(guidance?.campaignRule).toBeUndefined()
  })

  it.each(['Traces To Nowhere', 'Fortune and Folly, Part II', 'Guardians of the Abyss', 'My Custom Side Story'])(
    'explains Scarlet Keys time substitution without asserting map access for %s',
    (name) => {
      const guidance = getSideScenarioEntryGuidance({ ...campaign, campaignName: 'The Scarlet Keys' }, sideScenario(name))
      expect(guidance?.campaignRule).toContain('at a supported green-bordered map location')
      expect(guidance?.campaignRule).toContain('instead of XP')
      expect(guidance?.campaignRule).toContain('availability is not verified here')
    },
  )
})
