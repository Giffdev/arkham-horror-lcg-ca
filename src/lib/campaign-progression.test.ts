import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import {
  FULL_CAMPAIGNS,
  NON_CAMPAIGN_GUIDE_FILES,
  SMALL_CAMPAIGNS,
  STANDALONE_SCENARIO_GUIDES,
  getScenarioPackCampaignNames,
} from './campaign-data'
import {
  CAMPAIGN_PROGRESSION_CONTRACTS,
  getCampaignProgressionScenarioNames,
  getContinuableCampaignProgressionAudit,
  getNextCampaignScenarioResolution,
  resolveCampaignProgressionContract,
  resolveCampaignProgressionGap,
} from './campaign-progression'

describe('campaign-progression — coverage audit', () => {
  it('covers every continuable catalog campaign with either a verified contract or an explicit gap', () => {
    const continuableCatalog = [...FULL_CAMPAIGNS, ...SMALL_CAMPAIGNS]
    const audit = getContinuableCampaignProgressionAudit()

    expect(audit).toHaveLength(continuableCatalog.length)
    expect(audit.filter(entry => entry.status === 'verified')).toHaveLength(18)
    expect(audit.filter(entry => entry.status === 'gap')).toHaveLength(0)

    for (const campaign of continuableCatalog) {
      expect(audit.some(entry => entry.campaignName === campaign.name)).toBe(true)
    }
  })

  it('maps every checked-in campaign guide to progression, standalone selection, or explicit rules-only scope', () => {
    const repoRoot = resolve(process.cwd())
    const campaignRoot = join(repoRoot, 'campaign')
    const collectPdfFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
      .flatMap(entry => {
        const path = join(directory, entry.name)
        return entry.isDirectory() ? collectPdfFiles(path) : [path]
      })
      .filter(path => path.toLowerCase().endsWith('.pdf'))
      .map(path => relative(repoRoot, path).replaceAll('\\', '/'))

    const checkedInGuides = collectPdfFiles(campaignRoot).sort()
    const mappedGuides = Array.from(new Set([
      ...CAMPAIGN_PROGRESSION_CONTRACTS.flatMap(contract => contract.evidence.map(item => item.guideFile)),
      ...STANDALONE_SCENARIO_GUIDES.map(item => item.guideFile),
      ...NON_CAMPAIGN_GUIDE_FILES,
    ])).sort()

    expect(checkedInGuides).toHaveLength(32)
    expect(mappedGuides).toEqual(checkedInGuides)
  })

  it('keeps every guide-backed standalone selection available in campaign and side-scenario dropdowns', () => {
    const dropdownNames = new Set(getScenarioPackCampaignNames())
    for (const guide of STANDALONE_SCENARIO_GUIDES) {
      for (const selectionName of guide.selectionNames) {
        expect(dropdownNames.has(selectionName), `${guide.guideFile}: ${selectionName}`).toBe(true)
      }
    }
  })

  it('keeps verified scenario sequences deterministic and free of campaign-title fallbacks', () => {
    for (const contract of CAMPAIGN_PROGRESSION_CONTRACTS) {
      const firstRead = contract.steps.map(step => step.name)
      const secondRead = contract.steps.map(step => step.name)

      expect(secondRead).toEqual(firstRead)
      expect(firstRead).not.toContain(contract.canonicalCampaignName)
      for (const returnToName of contract.returnToCampaignNames ?? []) {
        expect(firstRead).not.toContain(returnToName)
      }
      expect(new Set(firstRead).size).toBe(firstRead.length)
    }
  })
})

describe('campaign-progression — canonical identity and gap resolution', () => {
  it('maps Return To Carcosa and base Carcosa onto the same canonical contract', () => {
    const base = resolveCampaignProgressionContract({
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
    })
    const returnTo = resolveCampaignProgressionContract({
      campaignName: 'Return to The Path to Carcosa',
      campaignSet: 'Return to The Path to Carcosa',
      campaignType: 'Full Campaign',
    })

    expect(base?.canonicalCampaignId).toBe('path-to-carcosa')
    expect(returnTo?.canonicalCampaignId).toBe('path-to-carcosa')
    expect(getCampaignProgressionScenarioNames({
      campaignName: 'Return to The Path to Carcosa',
      campaignSet: 'Return to The Path to Carcosa',
      campaignType: 'Full Campaign',
    })).toEqual(getCampaignProgressionScenarioNames({
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
    }))
  })

  it('maps the exact Return to the Circle Undone alias to the complete canonical order', () => {
    const input = {
      campaignName: 'Return to the Circle Undone',
      campaignSet: 'Return to The Circle Undone',
      campaignType: 'Full Campaign' as const,
    }

    const contract = resolveCampaignProgressionContract(input)
    expect(contract?.canonicalCampaignId).toBe('the-circle-undone')
    expect(contract?.evidence).toContainEqual(expect.objectContaining({
      guideFile: 'campaign/return to campaigns/return to the circle undone additional campaign rules.pdf',
      pages: '1',
    }))
    expect(getCampaignProgressionScenarioNames(input)).toEqual([
      'The Witching Hour',
      "At Death's Doorstep",
      'The Secret Name',
      'The Wages of Sin',
      'For the Greater Good',
      'Union and Disillusion',
      'In the Clutches of Chaos',
      'Before the Black Throne',
    ])
  })

  it('resolves the exact Drowned City name and alias to its checked-in guide contract', () => {
    expect(resolveCampaignProgressionGap({
      campaignName: 'The Drowned City',
      campaignType: 'Full Campaign',
    })).toBeNull()
    expect(resolveCampaignProgressionContract({
      campaignName: 'Drowned City',
      campaignType: 'Full Campaign',
    })).toEqual(expect.objectContaining({
      canonicalCampaignId: 'the-drowned-city',
      evidence: [expect.objectContaining({
        guideFile: 'campaign/full campaigns/the drowned city campaign guide.pdf',
        pages: '2, 4, 10–11, 12–40, 44–47',
      })],
    }))
    expect(getCampaignProgressionScenarioNames({
      campaignName: 'The Drowned City',
      campaignType: 'Full Campaign',
    })).toEqual([
      'One Last Job',
      'The Western Wall',
      'The Drowned Quarter',
      'The Apiary',
      'The Grand Vault',
      'Court of the Ancients',
      'Obsidian Canyons',
      'Sepulchre of the Sleeper',
      'The Doom of Arkham Part I',
      'The Doom of Arkham Part II',
    ])

    expect(resolveCampaignProgressionContract({
      campaignName: 'The Brethren of the Ash',
      campaignSet: 'Core 2026',
      campaignType: 'Small Campaign',
    })?.canonicalCampaignId).toBe('brethren-of-ash')
  })

  it('prioritizes explicit normalized campaign names over shared Core 2026 set fallbacks', () => {
    expect(resolveCampaignProgressionContract({
      campaignName: 'Children of Blood',
      campaignSet: 'Core 2026',
      campaignType: 'Small Campaign',
    })?.canonicalCampaignId).toBe('children-of-blood')
    expect(resolveCampaignProgressionContract({
      campaignName: 'The Brethren of the Ash',
      campaignSet: 'Core 2026',
      campaignType: 'Small Campaign',
    })?.canonicalCampaignId).toBe('brethren-of-ash')
  })

  it('uses the guide-backed canonical order for both Core 2026 mini-campaigns', () => {
    expect(getCampaignProgressionScenarioNames({
      campaignName: 'Children of Blood',
      campaignSet: 'Core 2026',
      campaignType: 'Small Campaign',
    })).toEqual(['River of Blood', 'New Horizons', 'Blood Money'])

    for (const campaignName of ['Brethren of Ash', 'Bretheren of Ash', 'The Brethren of the Ash']) {
      expect(getCampaignProgressionScenarioNames({
        campaignName,
        campaignSet: 'Core 2026',
        campaignType: 'Small Campaign',
      })).toEqual(['Spreading Flames', 'Smoke and Mirrors', 'Queen of Ash'])
    }
  })
})

describe('campaign-progression — next scenario resolution', () => {
  it('handles Dunwich opening branches and then rejoins the main sequence', () => {
    const opening = getNextCampaignScenarioResolution({
      campaignName: 'The Dunwich Legacy',
      campaignType: 'Full Campaign',
    })
    expect(opening.status).toBe('choice')
    expect(opening.automaticCandidates.map(step => step.name)).toEqual([
      'Extracurricular Activity',
      'The House Always Wins',
    ])

    const afterExtracurricular = getNextCampaignScenarioResolution(
      {
        campaignName: 'The Dunwich Legacy',
        campaignType: 'Full Campaign',
      },
      ['Extracurricular Activity'],
    )
    expect(afterExtracurricular.status).toBe('single')
    expect(afterExtracurricular.automaticCandidates.map(step => step.name)).toEqual(['The House Always Wins'])

    const afterBothOpeners = getNextCampaignScenarioResolution(
      {
        campaignName: 'The Dunwich Legacy',
        campaignType: 'Full Campaign',
      },
      ['Extracurricular Activity', 'The House Always Wins'],
    )
    expect(afterBothOpeners.status).toBe('single')
    expect(afterBothOpeners.automaticCandidates.map(step => step.name)).toEqual(['The Miskatonic Museum'])
  })

  it('provides linear next-scenario defaults for Carcosa and Return To Carcosa', () => {
    const carcosaStart = getNextCampaignScenarioResolution({
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
    })
    expect(carcosaStart.status).toBe('single')
    expect(carcosaStart.automaticCandidates.map(step => step.name)).toEqual(['Curtain Call'])

    const carcosaNext = getNextCampaignScenarioResolution(
      {
        campaignName: 'Return to The Path to Carcosa',
        campaignSet: 'Return to The Path to Carcosa',
        campaignType: 'Full Campaign',
      },
      ['Curtain Call'],
    )
    expect(carcosaNext.status).toBe('single')
    expect(carcosaNext.automaticCandidates.map(step => step.name)).toEqual(['The Last King'])
  })

  it('continues Return to the Circle Undone in canonical order', () => {
    const opening = getNextCampaignScenarioResolution({
      campaignName: 'Return to the Circle Undone',
      campaignSet: 'Return to The Circle Undone',
      campaignType: 'Full Campaign',
    })
    expect(opening.status).toBe('single')
    expect(opening.automaticCandidates.map(step => step.name)).toEqual(['The Witching Hour'])

    const next = getNextCampaignScenarioResolution(
      {
        campaignName: 'Return to the Circle Undone',
        campaignSet: 'Return to The Circle Undone',
        campaignType: 'Full Campaign',
      },
      ['The Witching Hour'],
    )
    expect(next.status).toBe('single')
    expect(next.automaticCandidates.map(step => step.name)).toEqual(["At Death's Doorstep"])
  })

  it('models Dream-Eaters as two synchronized branches', () => {
    const opening = getNextCampaignScenarioResolution({
      campaignName: 'The Dream-Eaters',
      campaignType: 'Full Campaign',
    })
    expect(opening.status).toBe('choice')
    expect(opening.automaticCandidates.map(step => step.name)).toEqual([
      'Beyond the Gates of Sleep',
      'Waking Nightmare',
    ])

    const secondPair = getNextCampaignScenarioResolution(
      {
        campaignName: 'The Dream-Eaters',
        campaignType: 'Full Campaign',
      },
      ['Beyond the Gates of Sleep', 'Waking Nightmare'],
    )
    expect(secondPair.status).toBe('choice')
    expect(secondPair.automaticCandidates.map(step => step.name)).toEqual([
      'The Search for Kadath',
      'A Thousand Shapes of Horror',
    ])
  })

  it('keeps Forgotten Age part transitions manual when scenario history alone is insufficient', () => {
    const resolution = getNextCampaignScenarioResolution(
      {
        campaignName: 'The Forgotten Age',
        campaignType: 'Full Campaign',
      },
      [
        'The Untamed Wilds',
        'The Doom of Eztli',
        'Threads of Fate',
        'The Boundary Beyond',
        'Heart of the Elders, Part 1',
      ],
    )

    expect(resolution.status).toBe('manual')
    expect(resolution.manualCandidates.map(step => step.name)).toEqual(['Heart of the Elders, Part 2'])
  })

  it('surfaces Edge of the Earth checkpoint choices without guessing', () => {
    const afterPartOne = getNextCampaignScenarioResolution(
      {
        campaignName: 'Edge of the Earth',
        campaignType: 'Full Campaign',
      },
      ['Ice and Death, Part I'],
    )
    expect(afterPartOne.status).toBe('single')
    expect(afterPartOne.automaticCandidates.map(step => step.name)).toEqual(['Ice and Death, Part II'])

    const afterPartTwo = getNextCampaignScenarioResolution(
      {
        campaignName: 'Edge of the Earth',
        campaignType: 'Full Campaign',
      },
      ['Ice and Death, Part I', 'Ice and Death, Part II'],
    )
    expect(afterPartTwo.status).toBe('manual')
    expect(afterPartTwo.manualCandidates.map(step => step.name)).toEqual([
      'Ice and Death, Part III',
      'Fatal Mirage',
      'To the Forbidden Peaks',
    ])
  })

  it('keeps Scarlet Keys open-world travel manual and does not prematurely suggest the finale', () => {
    const opener = getNextCampaignScenarioResolution({
      campaignName: 'The Scarlet Keys',
      campaignType: 'Full Campaign',
    })
    expect(opener.status).toBe('single')
    expect(opener.automaticCandidates.map(step => step.name)).toEqual(['Riddles and Rain'])

    const afterOpener = getNextCampaignScenarioResolution(
      {
        campaignName: 'The Scarlet Keys',
        campaignType: 'Full Campaign',
      },
      ['Riddles and Rain'],
    )
    expect(afterOpener.status).toBe('manual')
    expect(afterOpener.candidates.map(step => step.name)).not.toContain('Congress of the Keys')
    expect(afterOpener.manualCandidates.map(step => step.name)).toEqual([
      'Dancing Mad',
      'Dead Heat',
      'Dealings in the Dark',
      'Dogs of War',
      'On Thin Ice',
      'Sanguine Shadows',
      'Shades of Suffering',
      'Without a Trace',
    ])
  })

  it('alternates Hemlock Vale daytime choices with its fixed night checkpoints', () => {
    const input = {
      campaignName: 'The Feast of Hemlock Vale',
      campaignType: 'Full Campaign' as const,
    }
    const daytime = [
      'Written in Rock',
      'Hemlock House',
      'The Silent Heath',
      'The Lost Sister',
      'The Thing in the Depths',
    ]

    expect(getNextCampaignScenarioResolution(input).manualCandidates.map(step => step.name)).toEqual(daytime)
    expect(getNextCampaignScenarioResolution(input, ['Written in Rock']).automaticCandidates.map(step => step.name))
      .toEqual(['The Twisted Hollow'])
    expect(getNextCampaignScenarioResolution(input, ['Written in Rock', 'The Twisted Hollow']).manualCandidates.map(step => step.name))
      .toEqual(daytime.slice(1))
    expect(getNextCampaignScenarioResolution(input, [
      'Written in Rock',
      'The Twisted Hollow',
      'Hemlock House',
    ]).automaticCandidates.map(step => step.name)).toEqual(['The Longest Night'])
    expect(getNextCampaignScenarioResolution(input, [
      'Written in Rock',
      'The Twisted Hollow',
      'Hemlock House',
      'The Longest Night',
    ]).manualCandidates.map(step => step.name)).toEqual(daytime.slice(2))
    expect(getNextCampaignScenarioResolution(input, [
      'Written in Rock',
      'The Twisted Hollow',
      'Hemlock House',
      'The Longest Night',
      'The Silent Heath',
    ]).automaticCandidates.map(step => step.name)).toEqual(['Fate of the Vale'])
  })

  it('follows both Drowned City island routes, convergence, and finale from scenario history', () => {
    const input = {
      campaignName: 'The Drowned City',
      campaignType: 'Full Campaign' as const,
    }
    const next = (history: string[]) =>
      getNextCampaignScenarioResolution(input, history).candidates.map(step => step.name)

    expect(next([])).toEqual(['One Last Job'])
    expect(next(['One Last Job'])).toEqual(['The Western Wall', 'Obsidian Canyons'])

    expect(next(['One Last Job', 'The Western Wall'])).toEqual([
      'Sepulchre of the Sleeper',
      'The Drowned Quarter',
      'The Apiary',
    ])
    expect(next(['One Last Job', 'The Western Wall', 'The Drowned Quarter'])).toEqual(['The Apiary'])
    expect(next(['One Last Job', 'The Western Wall', 'The Apiary'])).toEqual(['The Grand Vault'])
    expect(next(['One Last Job', 'The Western Wall', 'The Apiary', 'The Grand Vault']))
      .toEqual(['Court of the Ancients'])
    expect(next(['One Last Job', 'The Western Wall', 'The Apiary', 'The Grand Vault', 'Court of the Ancients']))
      .toEqual(['Obsidian Canyons'])

    expect(next(['One Last Job', 'Obsidian Canyons'])).toEqual([
      'Sepulchre of the Sleeper',
      'Court of the Ancients',
    ])
    expect(next(['One Last Job', 'Obsidian Canyons', 'Court of the Ancients']))
      .toEqual(['The Grand Vault'])
    expect(next(['One Last Job', 'Obsidian Canyons', 'Court of the Ancients', 'The Grand Vault']))
      .toEqual(['The Apiary'])
    expect(next(['One Last Job', 'Obsidian Canyons', 'Court of the Ancients', 'The Grand Vault', 'The Apiary']))
      .toEqual(['The Drowned Quarter', 'The Western Wall'])
    expect(next([
      'One Last Job',
      'Obsidian Canyons',
      'Court of the Ancients',
      'The Grand Vault',
      'The Apiary',
      'The Drowned Quarter',
    ])).toEqual(['The Western Wall'])

    expect(next(['One Last Job', 'The Western Wall', 'Sepulchre of the Sleeper']))
      .toEqual(['The Doom of Arkham Part I'])
    expect(next(['One Last Job', 'The Western Wall', 'Sepulchre of the Sleeper', 'The Doom of Arkham Part I']))
      .toEqual(['The Doom of Arkham Part II'])
    expect(next([
      'One Last Job',
      'The Western Wall',
      'Sepulchre of the Sleeper',
      'The Doom of Arkham Part I',
      'The Doom of Arkham Part II',
    ])).toEqual([])
  })

  it('ignores side-scenario names and returns safe choices for ambiguous legacy Drowned City history', () => {
    const input = {
      campaignName: 'The Drowned City',
      campaignType: 'Full Campaign' as const,
    }

    expect(getNextCampaignScenarioResolution(input, [
      'One Last Job',
      'Murder at the Excelsior Hotel',
      'Obsidian Canyons',
    ]).candidates.map(step => step.name)).toEqual([
      'Sepulchre of the Sleeper',
      'Court of the Ancients',
    ])
    expect(getNextCampaignScenarioResolution(input, ['Court of the Ancients'])
      .candidates.map(step => step.name)).toEqual([
        'Obsidian Canyons',
        'The Grand Vault',
      ])
    expect(getNextCampaignScenarioResolution(input, [
      'One Last Job',
      'The Western Wall',
      'Sepulchre of the Sleeper',
      'The Doom of Arkham',
    ]).status).toBe('complete')
  })
})
