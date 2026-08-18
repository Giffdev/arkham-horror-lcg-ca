import { describe, it, expect } from 'vitest'
import {
  FULL_CAMPAIGNS,
  SMALL_CAMPAIGNS,
  SCENARIO_PACK_SCENARIOS,
  ALL_CAMPAIGNS,
  getCampaignChapter,
  getCampaignSet,
  getFullCampaignNames,
  orderCampaignsForDisplay,
  getSmallCampaignNames,
  getScenarioPackCampaignNames,
  campaignTypeLabel,
  getCampaignLineageId,
  getCampaignProgressionEntries,
  isContinuableCampaignLog,
  resolveCampaignMetadata,
  resolveCampaignType,
} from './campaign-data'

describe('campaign-data — Traces To Nowhere chapter annotation', () => {
  it('Traces To Nowhere has chapter 2', () => {
    const entry = SCENARIO_PACK_SCENARIOS.find(c => c.name === 'Traces To Nowhere')
    expect(entry).toBeDefined()
    expect(entry!.chapter).toBe(2)
  })

  it('getCampaignChapter returns 2 for Traces To Nowhere', () => {
    expect(getCampaignChapter('Traces To Nowhere')).toBe(2)
  })

  it('getCampaignSet for Traces To Nowhere remains Scenario Pack', () => {
    expect(getCampaignSet('Traces To Nowhere')).toBe('Scenario Pack')
  })

  it('type for Traces To Nowhere remains Scenario Pack', () => {
    const entry = SCENARIO_PACK_SCENARIOS.find(c => c.name === 'Traces To Nowhere')
    expect(entry!.type).toBe('Scenario Pack')
  })
})

describe('campaign-data — returnTo markers', () => {
  it('marks all four Full Campaign Return To entries as returnTo: true', () => {
    const returnTos = FULL_CAMPAIGNS.filter(c => c.name.startsWith('Return to'))
    expect(returnTos).toHaveLength(4)
    for (const c of returnTos) {
      expect(c.returnTo).toBe(true)
    }
  })

  it('marks the Small Campaign Return To entry as returnTo: true', () => {
    const entry = SMALL_CAMPAIGNS.find(c => c.name === 'Return to The Night of the Zealot')
    expect(entry).toBeDefined()
    expect(entry!.returnTo).toBe(true)
  })

  it('does not mark non-Return To campaigns as returnTo', () => {
    const standard = FULL_CAMPAIGNS.filter(c => !c.name.startsWith('Return to'))
    for (const c of standard) {
      expect(c.returnTo).toBeUndefined()
    }
  })

  it('total returnTo entries across ALL_CAMPAIGNS is exactly 5', () => {
    const count = ALL_CAMPAIGNS.filter(c => c.returnTo).length
    expect(count).toBe(5)
  })
})

describe('campaign-data — ordering stability (pinning current sort output)', () => {
  it('getFullCampaignNames returns Dunwich Legacy before Path to Carcosa', () => {
    const names = getFullCampaignNames()
    const idxDunwich = names.indexOf('The Dunwich Legacy')
    const idxCarcosa = names.indexOf('The Path to Carcosa')
    expect(idxDunwich).toBeGreaterThanOrEqual(0)
    expect(idxCarcosa).toBeGreaterThanOrEqual(0)
    expect(idxDunwich).toBeLessThan(idxCarcosa)
  })

  it('getSmallCampaignNames preserves explicit progression ordering within structured series', () => {
    const names = getSmallCampaignNames()
    expect(names).toEqual([
      'Children of Blood',
      'Brethren of Ash',
      'Return to The Night of the Zealot',
      'The Night of the Zealot',
    ])
  })

  it('getScenarioPackCampaignNames includes Traces To Nowhere', () => {
    const names = getScenarioPackCampaignNames()
    expect(names).toContain('Traces To Nowhere')
  })
})

describe('campaign-data — explicit progression metadata precedence', () => {
  it('preserves progression order for entries that share explicit series metadata', () => {
    const ordered = orderCampaignsForDisplay([
      {
        name: 'Scenario Two',
        set: 'Mini Campaign',
        type: 'Small Campaign',
        progressionSeriesId: 'mini-campaign',
        progressionOrder: 2,
      },
      {
        name: 'Scenario One',
        set: 'Mini Campaign',
        type: 'Small Campaign',
        progressionSeriesId: 'mini-campaign',
        progressionOrder: 1,
      },
      {
        name: 'Alpha Side Story',
        set: 'Scenario Pack',
        type: 'Scenario Pack',
      },
    ])

    expect(ordered.map(c => c.name)).toEqual([
      'Alpha Side Story',
      'Scenario One',
      'Scenario Two',
    ])
  })
})

describe('campaign-data — completeness', () => {
  it('ALL_CAMPAIGNS contains every entry from FULL, SMALL, and SCENARIO_PACK arrays', () => {
    const allNames = ALL_CAMPAIGNS.map(c => c.name)
    for (const c of [...FULL_CAMPAIGNS, ...SMALL_CAMPAIGNS, ...SCENARIO_PACK_SCENARIOS]) {
      expect(allNames).toContain(c.name)
    }
  })
})

describe('campaignTypeLabel — Return To badge taxonomy (regression)', () => {
  it('Return To Full Campaign badges as "Full", not "Return To"', () => {
    expect(campaignTypeLabel('Return to The Dunwich Legacy')).toBe('Full')
  })

  it('all four Full Campaign Return To entries badge as "Full"', () => {
    const returnToFull = FULL_CAMPAIGNS.filter(c => c.returnTo)
    expect(returnToFull).toHaveLength(4)
    for (const c of returnToFull) {
      expect(
        campaignTypeLabel(c.name),
        `expected "${c.name}" to badge as "Full"`,
      ).toBe('Full')
    }
  })

  it('Return To Small Campaign badges as "Short", not "Return To"', () => {
    expect(campaignTypeLabel('Return to The Night of the Zealot')).toBe('Short')
  })

  it('no campaign ever produces "Return To" badge', () => {
    for (const c of ALL_CAMPAIGNS) {
      expect(
        campaignTypeLabel(c.name),
        `"Return To" must never be a badge label; got it for "${c.name}"`,
      ).not.toBe('Return To')
    }
  })

  it('standard Full Campaign still badges as "Full"', () => {
    expect(campaignTypeLabel('The Dunwich Legacy')).toBe('Full')
  })

  it('standard Small Campaign still badges as "Short"', () => {
    expect(campaignTypeLabel('The Night of the Zealot')).toBe('Short')
  })

  it('unknown campaign name returns empty string', () => {
    expect(campaignTypeLabel('__nonexistent__')).toBe('')
  })
})

describe('campaign-data — canonical lookup for legacy/variant campaign records', () => {
  it('prioritizes normalized campaign aliases over shared campaign-set fallback', () => {
    const resolved = resolveCampaignMetadata({
      campaignName: 'The Brethren of the Ash',
      campaignSet: 'Core 2026',
      campaignType: 'Unknown',
    })

    expect(resolved).toMatchObject({
      name: 'Brethren of Ash',
      type: 'Small Campaign',
      set: 'Core 2026',
    })
  })

  it('resolves a normalized campaign-name variant to Brethren of Ash metadata', () => {
    const resolved = resolveCampaignMetadata({
      campaignName: 'The Brethren of the Ash',
      campaignType: 'Unknown',
    })
    expect(resolved).toMatchObject({
      name: 'Brethren of Ash',
      type: 'Small Campaign',
      set: 'Core 2026',
    })
  })

  it('keeps canonical/alias campaign-name resolution even when campaignSet is stale', () => {
    expect(resolveCampaignMetadata({
      campaignName: 'Brethren of Ash',
      campaignSet: 'Core',
      campaignType: 'Small Campaign',
    })?.name).toBe('Brethren of Ash')

    expect(resolveCampaignMetadata({
      campaignName: 'The Brethren of the Ash',
      campaignSet: 'Core',
      campaignType: 'Unknown',
    })?.name).toBe('Brethren of Ash')
  })

  it('falls back to campaignSet when campaignName is blank and set is usable', () => {
    const resolved = resolveCampaignMetadata({
      campaignName: '   ',
      campaignSet: 'Return to The Path to Carcosa',
      campaignType: 'Full Campaign',
    })

    expect(resolved).toMatchObject({
      name: 'Return to The Path to Carcosa',
      type: 'Full Campaign',
      set: 'Return to The Path to Carcosa',
    })
  })

  it('provides deterministic progression entries and lineage ids for chapter-series campaigns', () => {
    const entries = getCampaignProgressionEntries({
      campaignName: 'The Brethren of the Ash',
      campaignType: 'Unknown',
    })
    expect(entries.map(entry => entry.name)).toEqual(['Children of Blood', 'Brethren of Ash'])

    const lineageId = getCampaignLineageId({
      campaignName: 'The Brethren of the Ash',
      campaignType: 'Unknown',
    })
    expect(lineageId).toBe('series:core-2026-mini-campaign')
  })

  it('resolveCampaignType favors canonical metadata over stale campaignType values', () => {
    const resolvedType = resolveCampaignType({
      campaignName: 'The Brethren of the Ash',
      campaignType: 'Fan-Made',
    })
    expect(resolvedType).toBe('Small Campaign')
  })

  it('isContinuableCampaignLog is true for Full/Small/Return To/Fan-Made and false for standalone Scenario Packs', () => {
    expect(isContinuableCampaignLog({
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
    })).toBe(true)
    expect(isContinuableCampaignLog({
      campaignName: 'Return to The Night of the Zealot',
      campaignType: 'Small Campaign',
    })).toBe(true)
    expect(isContinuableCampaignLog({
      campaignName: 'Traces To Nowhere',
      campaignType: 'Scenario Pack',
    })).toBe(false)
    expect(isContinuableCampaignLog({
      campaignName: 'The Custom Mystery',
      campaignType: 'Fan-Made',
      customCampaignName: 'The Custom Mystery',
    })).toBe(true)
  })
})
