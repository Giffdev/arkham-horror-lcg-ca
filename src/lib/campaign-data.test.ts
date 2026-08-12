import { describe, it, expect } from 'vitest'
import {
  FULL_CAMPAIGNS,
  SMALL_CAMPAIGNS,
  SCENARIO_PACK_SCENARIOS,
  ALL_CAMPAIGNS,
  getCampaignChapter,
  getCampaignSet,
  getFullCampaignNames,
  getSmallCampaignNames,
  getScenarioPackCampaignNames,
  campaignTypeLabel,
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

  it('getSmallCampaignNames starts with The Night of the Zealot', () => {
    const names = getSmallCampaignNames()
    expect(names[0]).toBe('The Night of the Zealot')
  })

  it('getScenarioPackCampaignNames includes Traces To Nowhere', () => {
    const names = getScenarioPackCampaignNames()
    expect(names).toContain('Traces To Nowhere')
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
  /**
   * Return To campaigns (returnTo: true) have a real type field.
   * The badge must reflect the LENGTH of the campaign, not the release flavour.
   * Previously a local `if (c.returnTo) return 'Return To'` branch in both
   * CommunityStats.tsx and PublicHomepage.tsx caused ALL Return To campaigns
   * to badge as "Return To" regardless of their actual type.
   */

  it('Return To Full Campaign badges as "Full", not "Return To"', () => {
    // Return to The Dunwich Legacy is the canonical regression case
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
    // Return to The Night of the Zealot: type=Small Campaign, returnTo=true
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
