export interface Campaign {
  name: string
  set: string
  type: 'Full Campaign' | 'Small Campaign' | 'Scenario Pack'
  chapter?: 1 | 2
  returnTo?: boolean
  progressionSeriesId?: string
  progressionOrder?: number
}

type PlaythroughCampaignType = Campaign['type'] | 'Fan-Made' | 'Unknown'

export interface CampaignLookupInput {
  campaignName: string
  campaignSet?: string
  campaignType?: PlaythroughCampaignType
  customCampaignName?: string
}

export const FULL_CAMPAIGNS: Campaign[] = [
  { name: 'The Dunwich Legacy', set: 'The Dunwich Legacy', type: 'Full Campaign', chapter: 1 },
  {
    name: 'The Path to Carcosa',
    set: 'The Path to Carcosa',
    type: 'Full Campaign',
    chapter: 1,
  },
  { name: 'The Forgotten Age', set: 'The Forgotten Age', type: 'Full Campaign', chapter: 1 },
  { name: 'The Circle Undone', set: 'The Circle Undone', type: 'Full Campaign', chapter: 1 },
  { name: 'The Dream-Eaters', set: 'The Dream-Eaters', type: 'Full Campaign', chapter: 1 },
  { name: 'The Innsmouth Conspiracy', set: 'The Innsmouth Conspiracy', type: 'Full Campaign', chapter: 1 },
  { name: 'Edge of the Earth', set: 'Edge of the Earth', type: 'Full Campaign', chapter: 1 },
  { name: 'The Scarlet Keys', set: 'The Scarlet Keys', type: 'Full Campaign', chapter: 1 },
  { name: 'The Feast of Hemlock Vale', set: 'The Feast of Hemlock Vale', type: 'Full Campaign', chapter: 1 },
  { name: 'The Drowned City', set: 'The Drowned City', type: 'Full Campaign', chapter: 1 },
  { name: 'Return to The Dunwich Legacy', set: 'Return to The Dunwich Legacy', type: 'Full Campaign', chapter: 1, returnTo: true },
  {
    name: 'Return to The Path to Carcosa',
    set: 'Return to The Path to Carcosa',
    type: 'Full Campaign',
    chapter: 1,
    returnTo: true,
  },
  { name: 'Return to The Forgotten Age', set: 'Return to The Forgotten Age', type: 'Full Campaign', chapter: 1, returnTo: true },
  { name: 'Return to The Circle Undone', set: 'Return to The Circle Undone', type: 'Full Campaign', chapter: 1, returnTo: true },
]

export const SMALL_CAMPAIGNS: Campaign[] = [
  { name: 'The Night of the Zealot', set: 'Core', type: 'Small Campaign', chapter: 1 },
  { name: 'Return to The Night of the Zealot', set: 'Return to The Night of the Zealot', type: 'Small Campaign', chapter: 1, returnTo: true },
  {
    name: 'Children of Blood',
    set: 'Core 2026',
    type: 'Small Campaign',
    chapter: 2,
    progressionSeriesId: 'core-2026-mini-campaign',
    progressionOrder: 1,
  },
  {
    name: 'Brethren of Ash',
    set: 'Core 2026',
    type: 'Small Campaign',
    chapter: 2,
    progressionSeriesId: 'core-2026-mini-campaign',
    progressionOrder: 2,
  },
]

export const SCENARIO_PACK_SCENARIOS: Campaign[] = [
  { name: 'Curse of the Rougarou', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'Carnevale of Horrors', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'The Labyrinths of Lunacy', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'Guardians of the Abyss', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'Murder at the Excelsior Hotel', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'The Blob That Ate Everything', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'War of the Outer Gods', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'Machinations Through Time', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'Fortune and Folly', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'Fortune and Folly, Part I', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'Fortune and Folly, Part II', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'The Eternal Slumber', set: 'Guardians of the Abyss', type: 'Scenario Pack' },
  { name: "The Night's Usurper", set: 'Guardians of the Abyss', type: 'Scenario Pack' },
  { name: 'The Midwinter Gala', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'Film Fatale', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'Traces To Nowhere', set: 'Scenario Pack', type: 'Scenario Pack', chapter: 2 },
  { name: 'Barkham Horror: The Meddling of Meowlathotep', set: 'Barkham Horror', type: 'Scenario Pack' },
]

export interface StandaloneScenarioGuideEvidence {
  guideFile: string
  pages: string
  campaignNames: string[]
  scenarioNames: string[]
  selectionNames: string[]
}

export const STANDALONE_SCENARIO_GUIDES: StandaloneScenarioGuideEvidence[] = [
  {
    guideFile: 'campaign/standalone campaigns/Fortune and folly campaign guide.pdf',
    pages: '8, 11',
    campaignNames: ['Fortune and Folly'],
    scenarioNames: ['Fortune and Folly, Part I', 'Fortune and Folly, Part II'],
    selectionNames: ['Fortune and Folly, Part I', 'Fortune and Folly, Part II'],
  },
  {
    guideFile: 'campaign/standalone campaigns/barkham horror the meddling of meowlahotep campaign guide.pdf',
    pages: '1, 4',
    campaignNames: ['Barkham Horror: The Meddling of Meowlathotep'],
    scenarioNames: ['The Meddling of Meowlathotep'],
    selectionNames: ['Barkham Horror: The Meddling of Meowlathotep'],
  },
  {
    guideFile: 'campaign/standalone campaigns/film fatale campaign rules.pdf',
    pages: '1, 6',
    campaignNames: ['Film Fatale'],
    scenarioNames: ['Film Fatale'],
    selectionNames: ['Film Fatale'],
  },
  {
    guideFile: 'campaign/standalone campaigns/guardians of the abyss campaign guide.pdf',
    pages: '2',
    campaignNames: ['Guardians of the Abyss'],
    scenarioNames: ['The Eternal Slumber', "The Night's Usurper"],
    selectionNames: ['The Eternal Slumber', "The Night's Usurper"],
  },
  {
    guideFile: 'campaign/standalone campaigns/machinations through time campaign guide.pdf',
    pages: '1, 7',
    campaignNames: ['Machinations Through Time'],
    scenarioNames: ['Machinations Through Time'],
    selectionNames: ['Machinations Through Time'],
  },
  {
    guideFile: 'campaign/standalone campaigns/murder at the excelsior hotel campaign guide.pdf',
    pages: '1, 5',
    campaignNames: ['Murder at the Excelsior Hotel'],
    scenarioNames: ['Murder at the Excelsior Hotel'],
    selectionNames: ['Murder at the Excelsior Hotel'],
  },
  {
    guideFile: 'campaign/standalone campaigns/the blob that ate everything campaign guide.pdf',
    pages: '2, 10',
    campaignNames: ['The Blob That Ate Everything'],
    scenarioNames: ['The Blob That Ate Everything'],
    selectionNames: ['The Blob That Ate Everything'],
  },
  {
    guideFile: 'campaign/standalone campaigns/the blob that ate everything else campaign guide.pdf',
    pages: '1, 5',
    campaignNames: ['The Blob That Ate Everything'],
    scenarioNames: ['The Blob That Ate Everything'],
    selectionNames: ['The Blob That Ate Everything'],
  },
  {
    guideFile: 'campaign/standalone campaigns/the labyrinths of lunacy campaign guide.pdf',
    pages: '1, 2',
    campaignNames: ['The Labyrinths of Lunacy'],
    scenarioNames: ['The Labyrinths of Lunacy'],
    selectionNames: ['The Labyrinths of Lunacy'],
  },
  {
    guideFile: 'campaign/standalone campaigns/the midwinter gala campaign rules.pdf',
    pages: '1, 5',
    campaignNames: ['The Midwinter Gala'],
    scenarioNames: ['The Midwinter Gala'],
    selectionNames: ['The Midwinter Gala'],
  },
  {
    guideFile: 'campaign/standalone campaigns/war of the outer gods campaign guide.pdf',
    pages: '1, 18',
    campaignNames: ['War of the Outer Gods'],
    scenarioNames: ['War of the Outer Gods'],
    selectionNames: ['War of the Outer Gods'],
  },
]

export const NON_CAMPAIGN_GUIDE_FILES = [
  'campaign/grimoire rules and faq/arkham_grimoire_v11_web.pdf',
] as const

export const ALL_CAMPAIGNS = [...FULL_CAMPAIGNS, ...SMALL_CAMPAIGNS, ...SCENARIO_PACK_SCENARIOS]

const CAMPAIGN_NAME_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
})

function compareCampaignNames(a: Campaign, b: Campaign): number {
  return CAMPAIGN_NAME_COLLATOR.compare(a.name, b.name)
}

function hasExplicitSeriesProgression(campaign: Campaign): campaign is Campaign & { progressionSeriesId: string; progressionOrder: number } {
  return Boolean(campaign.progressionSeriesId) && typeof campaign.progressionOrder === 'number'
}

export function orderCampaignsForDisplay(campaigns: Campaign[]): Campaign[] {
  return campaigns
    .map((campaign, index) => ({ campaign, index }))
    .sort((left, right) => {
      const a = left.campaign
      const b = right.campaign

      // Preserve explicit progression only when both entries carry structured series metadata.
      if (
        hasExplicitSeriesProgression(a) &&
        hasExplicitSeriesProgression(b) &&
        a.progressionSeriesId === b.progressionSeriesId
      ) {
        if (a.progressionOrder !== b.progressionOrder) {
          return a.progressionOrder - b.progressionOrder
        }
      }

      const byName = compareCampaignNames(a, b)
      if (byName !== 0) return byName

      // Stable tie-breaker for deterministic output.
      return left.index - right.index
    })
    .map(({ campaign }) => campaign)
}

export function getFullCampaignNames(): string[] {
  return orderCampaignsForDisplay(FULL_CAMPAIGNS).map(c => c.name)
}

export function getSmallCampaignNames(): string[] {
  return orderCampaignsForDisplay(SMALL_CAMPAIGNS).map(c => c.name)
}

export function getScenarioPackCampaignNames(): string[] {
  return orderCampaignsForDisplay(SCENARIO_PACK_SCENARIOS).map(c => c.name)
}

export function getCampaignSet(campaignName: string): string {
  const campaign = resolveCampaignMetadata({ campaignName })
  return campaign ? campaign.set : 'Scenario Pack'
}

export function getCampaignChapter(campaignName: string): 1 | 2 {
  const campaign = resolveCampaignMetadata({ campaignName })
  return campaign?.chapter || 1
}

export const CAMPAIGN_SETS: string[] = Array.from(new Set(ALL_CAMPAIGNS.map(c => c.set)))

/**
 * Returns the display badge label for a campaign's length/type.
 *
 * The `returnTo` flag is identity metadata (this is a re-release of a prior
 * campaign), not a length category. Return To campaigns keep their real
 * campaign `type`, which is the correct source of truth for the badge.
 */
export function campaignTypeLabel(name: string): string {
  const campaign = ALL_CAMPAIGNS.find(entry => entry.name === name)
  if (!campaign) return ''
  if (campaign.type === 'Full Campaign') return 'Full'
  if (campaign.type === 'Small Campaign') return 'Short'
  return ''
}

const NORMALIZED_WORDS_TO_DROP = new Set(['the', 'of'])

function normalizeCampaignLookupValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token && !NORMALIZED_WORDS_TO_DROP.has(token))
    .join(' ')
}

function toComparableCampaignName(input: CampaignLookupInput): string {
  const preferred = input.customCampaignName?.trim()
  if (preferred) return preferred
  return input.campaignName.trim()
}

function toComparableCampaignSet(input: CampaignLookupInput): string {
  return input.campaignSet?.trim() ?? ''
}

export function resolveCampaignMetadata(input: CampaignLookupInput): Campaign | null {
  const comparableName = toComparableCampaignName(input)
  if (!comparableName && !input.campaignSet) return null

  const exactByName = ALL_CAMPAIGNS.find(c => c.name === comparableName)
  if (exactByName) return exactByName

  const normalizedTarget = normalizeCampaignLookupValue(comparableName)
  if (normalizedTarget) {
    const byNormalizedName = ALL_CAMPAIGNS.find(c => normalizeCampaignLookupValue(c.name) === normalizedTarget)
    if (byNormalizedName) return byNormalizedName
  }

  if (input.campaignSet && input.campaignSet !== 'Scenario Pack') {
    const bySet = ALL_CAMPAIGNS.find(c => c.set === input.campaignSet)
    if (bySet) return bySet
  }

  return null
}

export function resolveCampaignType(input: CampaignLookupInput): PlaythroughCampaignType {
  const resolved = resolveCampaignMetadata(input)
  return resolved?.type ?? input.campaignType ?? 'Unknown'
}

export function isContinuableCampaignLog(input: CampaignLookupInput): boolean {
  const resolvedType = resolveCampaignType(input)
  return resolvedType === 'Full Campaign' || resolvedType === 'Small Campaign' || resolvedType === 'Fan-Made'
}

export function getCampaignLineageId(input: CampaignLookupInput): string {
  const resolved = resolveCampaignMetadata(input)
  if (resolved?.progressionSeriesId) return `series:${resolved.progressionSeriesId}`
  if (resolved) return `campaign:${normalizeCampaignLookupValue(resolved.name)}`

  const comparableSet = toComparableCampaignSet(input)
  if (comparableSet) return `set:${normalizeCampaignLookupValue(comparableSet)}`

  const comparableName = toComparableCampaignName(input)
  if (comparableName) return `name:${normalizeCampaignLookupValue(comparableName)}`

  return 'unknown:campaign-lineage'
}

export function getCampaignProgressionEntries(input: CampaignLookupInput): Campaign[] {
  const resolved = resolveCampaignMetadata(input)
  if (!resolved) return []

  if (!resolved.progressionSeriesId) {
    return [resolved]
  }

  return orderCampaignsForDisplay(
    ALL_CAMPAIGNS.filter(c => c.progressionSeriesId === resolved.progressionSeriesId),
  )
}
