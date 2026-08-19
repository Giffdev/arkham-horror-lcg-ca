import {
  FULL_CAMPAIGNS,
  SMALL_CAMPAIGNS,
  type CampaignLookupInput,
  resolveCampaignMetadata,
} from './campaign-data.js'

export type CampaignProgressionTopology = 'linear' | 'branching' | 'parallel' | 'open'
export type CampaignProgressionStepMode = 'automatic' | 'manual'
export type CampaignProgressionAuditStatus = 'verified' | 'gap'

export interface CampaignGuideEvidence {
  guideFile: string
  pages: string
  section: string
  excerpt: string
}

export interface CampaignProgressionStep {
  id: string
  name: string
  aliases?: string[]
  branch?: string
  mode?: CampaignProgressionStepMode
  requires?: string[]
  notes?: string[]
}

export interface CampaignProgressionBranchRoute {
  id: string
  label: string
  entryStepId: string
  successors: Record<string, string[]>
}

export interface CampaignProgressionContract {
  canonicalCampaignId: string
  canonicalCampaignName: string
  catalogCampaignNames: string[]
  aliases?: string[]
  returnToCampaignNames?: string[]
  topology: CampaignProgressionTopology
  steps: CampaignProgressionStep[]
  branchRoutes?: CampaignProgressionBranchRoute[]
  evidence: CampaignGuideEvidence[]
  notes?: string[]
}

export interface CampaignProgressionGap {
  canonicalCampaignId: string
  canonicalCampaignName: string
  catalogCampaignNames: string[]
  aliases?: string[]
  returnToCampaignNames?: string[]
  reason: string
  notes?: string[]
}

export interface CampaignProgressionAuditEntry {
  campaignName: string
  campaignType: 'Full Campaign' | 'Small Campaign' | 'Scenario Pack'
  canonicalCampaignId: string
  canonicalCampaignName: string
  status: CampaignProgressionAuditStatus
  topology?: CampaignProgressionTopology
  sourceGuides: string[]
  notes: string[]
}

export interface NextCampaignScenarioResolution {
  status: 'unavailable' | 'single' | 'choice' | 'manual' | 'complete'
  canonicalCampaignId?: string
  contract: CampaignProgressionContract | null
  gap: CampaignProgressionGap | null
  candidates: CampaignProgressionStep[]
  automaticCandidates: CampaignProgressionStep[]
  manualCandidates: CampaignProgressionStep[]
  completedStepIds: string[]
  notes: string[]
}

const NORMALIZED_WORDS_TO_DROP = new Set(['the', 'of'])

function normalizeProgressionValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token && !NORMALIZED_WORDS_TO_DROP.has(token))
    .join(' ')
}

function collectPrioritizedLookupKeys(input: CampaignLookupInput): string[][] {
  const resolved = resolveCampaignMetadata(input)

  return [
    [
      input.customCampaignName,
      input.campaignName,
    ],
    [
      resolved?.name,
    ],
    [
      input.campaignSet,
      resolved?.set,
    ],
  ].map(group => Array.from(new Set(
    group
      .filter((value): value is string => Boolean(value?.trim()))
      .map(value => normalizeProgressionValue(value))
      .filter(Boolean),
  ))).filter(group => group.length > 0)
}

function contractLookupNames(definition: Pick<CampaignProgressionContract, 'canonicalCampaignName' | 'catalogCampaignNames' | 'aliases' | 'returnToCampaignNames'>): string[] {
  return [
    definition.canonicalCampaignName,
    ...definition.catalogCampaignNames,
    ...(definition.aliases ?? []),
    ...(definition.returnToCampaignNames ?? []),
  ].map(normalizeProgressionValue)
}

function gapLookupNames(definition: Pick<CampaignProgressionGap, 'canonicalCampaignName' | 'catalogCampaignNames' | 'aliases' | 'returnToCampaignNames'>): string[] {
  return [
    definition.canonicalCampaignName,
    ...definition.catalogCampaignNames,
    ...(definition.aliases ?? []),
    ...(definition.returnToCampaignNames ?? []),
  ].map(normalizeProgressionValue)
}

function hasLookupIntersection(candidates: string[], lookupNames: string[]): boolean {
  return candidates.some(candidate => lookupNames.includes(candidate))
}

export const CAMPAIGN_PROGRESSION_CONTRACTS: CampaignProgressionContract[] = [
  {
    canonicalCampaignId: 'the-night-of-the-zealot',
    canonicalCampaignName: 'The Night of the Zealot',
    catalogCampaignNames: ['The Night of the Zealot'],
    returnToCampaignNames: ['Return to The Night of the Zealot'],
    topology: 'linear',
    steps: [
      { id: 'the-gathering', name: 'The Gathering' },
      { id: 'the-midnight-masks', name: 'The Midnight Masks', requires: ['the-gathering'] },
      { id: 'the-devourer-below', name: 'The Devourer Below', requires: ['the-midnight-masks'] },
    ],
    evidence: [
      {
        guideFile: 'campaign/small campaigns/night of the zealot campaign guide.pdf',
        pages: '2, 4, 6',
        section: 'Scenario headings',
        excerpt: 'The Gathering; The Midnight Masks; The Devourer Below.',
      },
      {
        guideFile: 'campaign/return to campaigns/return to night of the zealot campaign guide.pdf',
        pages: '1',
        section: 'Return To scenario headings',
        excerpt: 'The Gathering; The Midnight Masks; The Devourer Below.',
      },
    ],
  },
  {
    canonicalCampaignId: 'the-dunwich-legacy',
    canonicalCampaignName: 'The Dunwich Legacy',
    catalogCampaignNames: ['The Dunwich Legacy'],
    returnToCampaignNames: ['Return to The Dunwich Legacy'],
    topology: 'branching',
    steps: [
      {
        id: 'extracurricular-activity',
        name: 'Extracurricular Activity',
        notes: ['Opening branch: may be played first or second.'],
      },
      {
        id: 'the-house-always-wins',
        name: 'The House Always Wins',
        notes: ['Opening branch: may be played first or second.'],
      },
      {
        id: 'the-miskatonic-museum',
        name: 'The Miskatonic Museum',
        requires: ['extracurricular-activity', 'the-house-always-wins'],
      },
      { id: 'the-essex-county-express', name: 'The Essex County Express', requires: ['the-miskatonic-museum'] },
      { id: 'blood-on-the-altar', name: 'Blood on the Altar', requires: ['the-essex-county-express'] },
      { id: 'undimensioned-and-unseen', name: 'Undimensioned and Unseen', requires: ['blood-on-the-altar'] },
      { id: 'where-doom-awaits', name: 'Where Doom Awaits', requires: ['undimensioned-and-unseen'] },
      { id: 'lost-in-time-and-space', name: 'Lost in Time and Space', requires: ['where-doom-awaits'] },
    ],
    evidence: [
      {
        guideFile: 'campaign/full campaigns/the dunwich legacy campaign guide.pdf',
        pages: '2',
        section: 'Campaign Setup / Contents',
        excerpt: 'The Dunwich Legacy contains eight scenarios: “Extracurricular Activity,” “The House Always Wins,” “The Miskatonic Museum,” “The Essex County Express,” “Blood on the Altar,” “Undimensioned and Unseen,” “Where Doom Awaits,” and “Lost in Time and Space.”',
      },
      {
        guideFile: 'campaign/full campaigns/the dunwich legacy campaign guide.pdf',
        pages: '5',
        section: 'Extracurricular Activity resolutions',
        excerpt: 'If this is the first scenario of the campaign, proceed to Scenario I–B: The House Always Wins. Otherwise, proceed to Interlude I: Armitage’s Fate.',
      },
      {
        guideFile: 'campaign/full campaigns/the dunwich legacy campaign guide.pdf',
        pages: '7',
        section: 'The House Always Wins resolutions',
        excerpt: 'If this is the first scenario of the campaign, proceed to Scenario I–A: Extracurricular Activity. Otherwise, proceed to Interlude I: Armitage’s Fate.',
      },
      {
        guideFile: 'campaign/return to campaigns/return to dunwich legacy campaign guide.pdf',
        pages: '1',
        section: 'How to Use This Expansion',
        excerpt: 'In order to use this expansion, begin a campaign of The Dunwich Legacy ... Return to Extracurricular Activities ... Return to The House Always Wins ... Return to Lost in Time and Space.',
      },
    ],
  },
  {
    canonicalCampaignId: 'path-to-carcosa',
    canonicalCampaignName: 'The Path to Carcosa',
    catalogCampaignNames: ['The Path to Carcosa'],
    returnToCampaignNames: ['Return to The Path to Carcosa'],
    topology: 'linear',
    steps: [
      { id: 'curtain-call', name: 'Curtain Call' },
      { id: 'the-last-king', name: 'The Last King', requires: ['curtain-call'] },
      { id: 'echoes-of-the-past', name: 'Echoes of the Past', requires: ['the-last-king'] },
      { id: 'the-unspeakable-oath', name: 'The Unspeakable Oath', requires: ['echoes-of-the-past'] },
      { id: 'a-phantom-of-truth', name: 'A Phantom of Truth', requires: ['the-unspeakable-oath'] },
      { id: 'the-pallid-mask', name: 'The Pallid Mask', requires: ['a-phantom-of-truth'] },
      { id: 'black-stars-rise', name: 'Black Stars Rise', requires: ['the-pallid-mask'] },
      { id: 'dim-carcosa', name: 'Dim Carcosa', requires: ['black-stars-rise'] },
    ],
    evidence: [
      {
        guideFile: 'campaign/full campaigns/the path to carcosa campaign guide.pdf',
        pages: '1',
        section: 'Campaign Guide intro',
        excerpt: '“Curtain Call” and “The Last King” can be found in The Path to Carcosa deluxe expansion. “Echoes of the Past,” “The Unspeakable Oath,” “A Phantom of Truth,” “The Pallid Mask,” “Black Stars Rise,” and “Dim Carcosa” can be found in the six Mythos Packs of the same titles within The Path to Carcosa cycle.',
      },
      {
        guideFile: 'campaign/full campaigns/the path to carcosa campaign guide.pdf',
        pages: '2',
        section: 'Prologue',
        excerpt: 'Proceed to Scenario I: Curtain Call.',
      },
      {
        guideFile: 'campaign/return to campaigns/return to the path to carcosa campaign guide.pdf',
        pages: '1',
        section: 'How to Use This Expansion',
        excerpt: 'In order to use this expansion, begin a campaign of The Path to Carcosa ... Return to Curtain Call ... Return to The Last King ... Return to Dim Carcosa.',
      },
    ],
  },
  {
    canonicalCampaignId: 'the-forgotten-age',
    canonicalCampaignName: 'The Forgotten Age',
    catalogCampaignNames: ['The Forgotten Age'],
    returnToCampaignNames: ['Return to The Forgotten Age'],
    topology: 'branching',
    steps: [
      { id: 'the-untamed-wilds', name: 'The Untamed Wilds' },
      { id: 'the-doom-of-eztli', name: 'The Doom of Eztli', requires: ['the-untamed-wilds'] },
      { id: 'threads-of-fate', name: 'Threads of Fate', requires: ['the-doom-of-eztli'] },
      { id: 'the-boundary-beyond', name: 'The Boundary Beyond', requires: ['threads-of-fate'] },
      { id: 'heart-of-the-elders-part-1', name: 'Heart of the Elders, Part 1', requires: ['the-boundary-beyond'] },
      {
        id: 'heart-of-the-elders-part-2',
        name: 'Heart of the Elders, Part 2',
        mode: 'manual',
        requires: ['heart-of-the-elders-part-1'],
        notes: ['If Part 1 reached no resolution, the guide replays Part 1 instead of advancing immediately.'],
      },
      { id: 'the-city-of-archives', name: 'The City of Archives', requires: ['heart-of-the-elders-part-2'] },
      { id: 'the-depths-of-yoth', name: 'The Depths of Yoth', requires: ['the-city-of-archives'] },
      { id: 'shattered-aeons', name: 'Shattered Aeons', requires: ['the-depths-of-yoth'] },
    ],
    evidence: [
      {
        guideFile: 'campaign/full campaigns/the forgotten age campaign guide.pdf',
        pages: '2',
        section: 'Contents',
        excerpt: 'Scenario V–A: Heart of the Elders, Part 1 ... Scenario V–B: Heart of the Elders, Part 2 ... Scenario VI: The City of Archives ... Scenario VII: The Depths of Yoth ... Scenario VIII: Shattered Aeons.',
      },
      {
        guideFile: 'campaign/full campaigns/the forgotten age campaign guide.pdf',
        pages: '20',
        section: 'Interlude III: The Jungle Beckons',
        excerpt: 'Then, proceed to Scenario V–A: Heart of the Elders, Part 1.',
      },
      {
        guideFile: 'campaign/full campaigns/the forgotten age campaign guide.pdf',
        pages: '23',
        section: 'Heart of the Elders resolutions',
        excerpt: 'The investigators must replay Scenario V–A: Heart of the Elders, Part 1 ... Proceed immediately to Scenario V–B: Heart of the Elders, Part 2.',
      },
      {
        guideFile: 'campaign/return to campaigns/return to the forgotten age campaign guide.pdf',
        pages: '1',
        section: 'How to Use This Expansion',
        excerpt: 'In order to use this expansion, begin a campaign of The Forgotten Age ... Return to The Untamed Wilds ... Return to Shattered Aeons.',
      },
    ],
    notes: [
      'Return to The Forgotten Age also unlocks a bonus Scenario IX path, but the checked-in insert does not provide a durable, non-spoiler structural name+trigger pair that fits this lightweight contract.',
    ],
  },
  {
    canonicalCampaignId: 'the-circle-undone',
    canonicalCampaignName: 'The Circle Undone',
    catalogCampaignNames: ['The Circle Undone'],
    aliases: ['Return to the Circle Undone'],
    returnToCampaignNames: ['Return to The Circle Undone'],
    topology: 'linear',
    steps: [
      { id: 'the-witching-hour', name: 'The Witching Hour' },
      { id: 'at-deaths-doorstep', name: "At Death's Doorstep", requires: ['the-witching-hour'] },
      { id: 'the-secret-name', name: 'The Secret Name', requires: ['at-deaths-doorstep'] },
      { id: 'the-wages-of-sin', name: 'The Wages of Sin', requires: ['the-secret-name'] },
      { id: 'for-the-greater-good', name: 'For the Greater Good', requires: ['the-wages-of-sin'] },
      { id: 'union-and-disillusion', name: 'Union and Disillusion', requires: ['for-the-greater-good'] },
      { id: 'in-the-clutches-of-chaos', name: 'In the Clutches of Chaos', requires: ['union-and-disillusion'] },
      { id: 'before-the-black-throne', name: 'Before the Black Throne', requires: ['in-the-clutches-of-chaos'] },
    ],
    evidence: [
      {
        guideFile: 'campaign/full campaigns/the circle undone campaign guide.pdf',
        pages: '2',
        section: 'Contents — scenario headings',
        excerpt: "The Witching Hour; At Death's Doorstep; The Secret Name; The Wages of Sin; For the Greater Good; Union and Disillusion; In the Clutches of Chaos; Before the Black Throne.",
      },
      {
        guideFile: 'campaign/return to campaigns/return to the circle undone additional campaign rules.pdf',
        pages: '1',
        section: 'How to Use This Expansion — encounter-set scenario headings',
        excerpt: "The Witching Hour; At Death's Doorstep; The Secret Name; The Wages of Sin; For the Greater Good; Union and Disillusion; In the Clutches of Chaos; Before the Black Throne.",
      },
    ],
    notes: [
      'The non-playable Disappearance at the Twilight Estate prologue is intentionally excluded from scenario logging progression.',
    ],
  },
  {
    canonicalCampaignId: 'the-dream-eaters',
    canonicalCampaignName: 'The Dream-Eaters',
    catalogCampaignNames: ['The Dream-Eaters'],
    aliases: ['The Dream-Quest', 'The Web of Dreams'],
    topology: 'parallel',
    steps: [
      { id: 'beyond-the-gates-of-sleep', name: 'Beyond the Gates of Sleep', branch: 'A' },
      { id: 'waking-nightmare', name: 'Waking Nightmare', branch: 'B' },
      {
        id: 'the-search-for-kadath',
        name: 'The Search for Kadath',
        branch: 'A',
        requires: ['beyond-the-gates-of-sleep', 'waking-nightmare'],
      },
      {
        id: 'a-thousand-shapes-of-horror',
        name: 'A Thousand Shapes of Horror',
        branch: 'B',
        requires: ['beyond-the-gates-of-sleep', 'waking-nightmare'],
      },
      {
        id: 'dark-side-of-the-moon',
        name: 'Dark Side of the Moon',
        branch: 'A',
        requires: ['the-search-for-kadath', 'a-thousand-shapes-of-horror'],
      },
      {
        id: 'point-of-no-return',
        name: 'Point of No Return',
        branch: 'B',
        requires: ['the-search-for-kadath', 'a-thousand-shapes-of-horror'],
      },
      {
        id: 'where-the-gods-dwell',
        name: 'Where the Gods Dwell',
        branch: 'A',
        requires: ['dark-side-of-the-moon', 'point-of-no-return'],
      },
      {
        id: 'weaver-of-the-cosmos',
        name: 'Weaver of the Cosmos',
        branch: 'B',
        requires: ['dark-side-of-the-moon', 'point-of-no-return'],
      },
    ],
    evidence: [
      {
        guideFile: 'campaign/full campaigns/the dream eaters campaign guide.pdf',
        pages: '3-4',
        section: 'Campaign setup overview',
        excerpt: 'If you are playing The Dream-Eaters as an eight-part campaign ... From there, you can proceed to either Scenario 1–A: Beyond the Gates of Sleep on page 5, or Scenario 1–B: Waking Nightmare on page 10 (your choice).',
      },
      {
        guideFile: 'campaign/full campaigns/the dream eaters campaign guide.pdf',
        pages: '17',
        section: 'Interlude guidance',
        excerpt: 'If you are playing both The Dream-Quest and The Web of Dreams as interconnected campaigns: Proceed to either Scenario 2–A: The Search for Kadath, or Scenario 2–B: A Thousand Shapes of Horror.',
      },
      {
        guideFile: 'campaign/full campaigns/the dream eaters campaign guide.pdf',
        pages: '52',
        section: 'Campaign log structure',
        excerpt: 'Beyond the Gates of Sleep The Search for Kadath Dark Side of the Moon Where Gods Dwell ... Waking Nightmare A Thousand Shapes of Horror Point of No Return Weaver of the Cosmos',
      },
      {
        guideFile: 'campaign/full campaigns/the dream eaters campaign A rules.pdf',
        pages: '2',
        section: 'Contents — Dream-Quest scenario headings',
        excerpt: 'Beyond the Gates of Sleep; The Search for Kadath; Dark Side of the Moon; Where the Gods Dwell.',
      },
      {
        guideFile: 'campaign/full campaigns/the dream eaters campaign b rules.pdf',
        pages: '2',
        section: 'Contents — Web of Dreams scenario headings',
        excerpt: 'Waking Nightmare; A Thousand Shapes of Horror; Point of No Return; Weaver of the Cosmos.',
      },
    ],
    notes: [
      'The current app catalog has one shared Dream-Eaters entry, so this contract models the interconnected eight-part structure. Separate four-part A/B products would need separate catalog entries before the UI can disambiguate them.',
    ],
  },
  {
    canonicalCampaignId: 'the-innsmouth-conspiracy',
    canonicalCampaignName: 'The Innsmouth Conspiracy',
    catalogCampaignNames: ['The Innsmouth Conspiracy'],
    topology: 'linear',
    steps: [
      { id: 'the-pit-of-despair', name: 'The Pit of Despair' },
      { id: 'the-vanishing-of-elina-harper', name: 'The Vanishing of Elina Harper', requires: ['the-pit-of-despair'] },
      { id: 'in-too-deep', name: 'In Too Deep', requires: ['the-vanishing-of-elina-harper'] },
      { id: 'devil-reef', name: 'Devil Reef', requires: ['in-too-deep'] },
      { id: 'horror-in-high-gear', name: 'Horror in High Gear', requires: ['devil-reef'] },
      { id: 'a-light-in-the-fog', name: 'A Light in the Fog', requires: ['horror-in-high-gear'] },
      { id: 'the-lair-of-dagon', name: 'The Lair of Dagon', requires: ['a-light-in-the-fog'] },
      { id: 'into-the-maelstrom', name: 'Into the Maelstrom', requires: ['the-lair-of-dagon'] },
    ],
    evidence: [
      {
        guideFile: 'campaign/full campaigns/the innsmouth conspiracy campaign guide.pdf',
        pages: '2',
        section: 'Campaign intro / Contents',
        excerpt: 'The Innsmouth Conspiracy contains the following 8 scenarios: “The Pit of Despair,” “The Vanishing of Elina Harper,” “In Too Deep,” “Devil Reef,” “Horror in High Gear,” “A Light in the Fog,” “The Lair of Dagon,” and “Into the Maelstrom.”',
      },
      {
        guideFile: 'campaign/full campaigns/the innsmouth conspiracy campaign guide.pdf',
        pages: '8',
        section: 'Scenario I resolution',
        excerpt: 'Proceed to Scenario II: The Vanishing of Elina Harper.',
      },
    ],
  },
  {
    canonicalCampaignId: 'edge-of-the-earth',
    canonicalCampaignName: 'Edge of the Earth',
    catalogCampaignNames: ['Edge of the Earth'],
    topology: 'branching',
    steps: [
      { id: 'ice-and-death-part-i', name: 'Ice and Death, Part I' },
      { id: 'ice-and-death-part-ii', name: 'Ice and Death, Part II', requires: ['ice-and-death-part-i'] },
      {
        id: 'ice-and-death-part-iii',
        name: 'Ice and Death, Part III',
        mode: 'manual',
        requires: ['ice-and-death-part-ii'],
        notes: ['Some Part II outcomes skip Part III entirely.'],
      },
      {
        id: 'fatal-mirage',
        name: 'Fatal Mirage',
        mode: 'manual',
        requires: ['ice-and-death-part-ii'],
        notes: ['Optional mirage scenario. The guide can offer it after multiple interludes, but this lightweight contract does not auto-repeat it.'],
      },
      {
        id: 'to-the-forbidden-peaks',
        name: 'To the Forbidden Peaks',
        mode: 'manual',
        requires: ['ice-and-death-part-ii'],
        notes: ['Restful Night can send investigators either here or into Fatal Mirage.'],
      },
      {
        id: 'city-of-the-elder-things',
        name: 'City of the Elder Things',
        mode: 'manual',
        requires: ['to-the-forbidden-peaks'],
        notes: ['Endless Night can offer Fatal Mirage again before continuing to Scenario III.'],
      },
      {
        id: 'the-heart-of-madness-part-i',
        name: 'The Heart of Madness, Part I',
        mode: 'manual',
        requires: ['city-of-the-elder-things'],
        notes: ['Final Night can offer Fatal Mirage before advancing to Scenario IV.'],
      },
      { id: 'the-heart-of-madness-part-ii', name: 'The Heart of Madness, Part II', requires: ['the-heart-of-madness-part-i'] },
    ],
    evidence: [
      {
        guideFile: 'campaign/full campaigns/edge of the earth campaign guide.pdf',
        pages: '2',
        section: 'Contents / Additional Rules and Clarifications',
        excerpt: 'Ice and Death, Part II ... Ice and Death, Part III ... Scenario ???: Fatal Mirage ... Scenario II: To the Forbidden Peaks ... Scenario III: City of the Elder Things ... The Heart of Madness, Part I ... The Heart of Madness, Part II.',
      },
      {
        guideFile: 'campaign/full campaigns/edge of the earth campaign guide.pdf',
        pages: '15',
        section: 'Checkpoint II outcomes',
        excerpt: 'Skip Ice and Death, Part III in its entirety ... Proceed to Interlude I: Restful Night ... Proceed to Ice and Death, Part III.',
      },
      {
        guideFile: 'campaign/full campaigns/edge of the earth campaign guide.pdf',
        pages: '22',
        section: 'Restful Night choice',
        excerpt: 'Open the door and venture into the mirage. Proceed to Scenario ???: Fatal Mirage. Ignore the door and allow it to vanish. Proceed to Scenario II: To the Forbidden Peaks.',
      },
      {
        guideFile: 'campaign/full campaigns/edge of the earth campaign guide.pdf',
        pages: '26',
        section: 'Fatal Mirage resolution',
        excerpt: 'If the last scenario you played before this one was Ice and Death, proceed to Scenario II: To the Forbidden Peaks. If the last scenario you played before this one was To the Forbidden Peaks, proceed to Scenario III: City of the Elder Things. If the last scenario you played before this one was City of the Elder Things, proceed to Scenario IV: The Heart of Madness.',
      },
    ],
  },
  {
    canonicalCampaignId: 'the-scarlet-keys',
    canonicalCampaignName: 'The Scarlet Keys',
    catalogCampaignNames: ['The Scarlet Keys'],
    topology: 'open',
    steps: [
      { id: 'riddles-and-rain', name: 'Riddles and Rain' },
      { id: 'dancing-mad', name: 'Dancing Mad', mode: 'manual', requires: ['riddles-and-rain'] },
      { id: 'dead-heat', name: 'Dead Heat', mode: 'manual', requires: ['riddles-and-rain'] },
      { id: 'dealings-in-the-dark', name: 'Dealings in the Dark', mode: 'manual', requires: ['riddles-and-rain'] },
      { id: 'dogs-of-war', name: 'Dogs of War', mode: 'manual', requires: ['riddles-and-rain'] },
      { id: 'on-thin-ice', name: 'On Thin Ice', mode: 'manual', requires: ['riddles-and-rain'] },
      { id: 'sanguine-shadows', name: 'Sanguine Shadows', mode: 'manual', requires: ['riddles-and-rain'] },
      { id: 'shades-of-suffering', name: 'Shades of Suffering', mode: 'manual', requires: ['riddles-and-rain'] },
      { id: 'without-a-trace', name: 'Without a Trace', mode: 'manual', requires: ['riddles-and-rain'] },
      {
        id: 'congress-of-the-keys',
        name: 'Congress of the Keys',
        mode: 'manual',
        requires: [
          'dancing-mad',
          'dead-heat',
          'dealings-in-the-dark',
          'dogs-of-war',
          'on-thin-ice',
          'sanguine-shadows',
          'shades-of-suffering',
          'without-a-trace',
        ],
        notes: ['Conservative finale rule: the guide can also force this finale via status reports/time, so the UI should still allow manual override when needed.'],
      },
    ],
    evidence: [
      {
        guideFile: 'campaign/full campaigns/the scarlet keys campaign guide.pdf',
        pages: '2',
        section: 'Campaign intro',
        excerpt: 'The Scarlet Keys contains the following ten scenarios: “Riddles and Rain,” “Dancing Mad,” “Dead Heat,” “Dealings in the Dark,” “Dogs of War,” “On Thin Ice,” “Sanguine Shadows,” “Shades of Suffering,” “Without a Trace,” and “Congress of the Keys.”',
      },
      {
        guideFile: 'campaign/full campaigns/the scarlet keys campaign guide.pdf',
        pages: '2',
        section: 'Around the World',
        excerpt: 'Following the “Riddles and Rain” prologue, investigators are provided with a map of the world, and from there they may choose to embark to various locations. The order in which the locations are chosen determines the order in which these scenarios are played ... before culminating in an epic finale.',
      },
      {
        guideFile: 'campaign/full campaigns/the scarlet keys campaign guide.pdf',
        pages: '59',
        section: 'File #59–Z (Finale)',
        excerpt: 'File #59–Z (Finale): Congress of the Keys',
      },
      {
        guideFile: 'campaign/full campaigns/the scarlet keys campaign guide.pdf',
        pages: '69',
        section: 'Status Reports',
        excerpt: 'You are out of time. Immediately travel directly to Tunguska and proceed to Finale Scenario: Congress of the Keys.',
      },
    ],
  },
  {
    canonicalCampaignId: 'the-feast-of-hemlock-vale',
    canonicalCampaignName: 'The Feast of Hemlock Vale',
    catalogCampaignNames: ['The Feast of Hemlock Vale'],
    topology: 'open',
    steps: [
      { id: 'written-in-rock', name: 'Written in Rock', mode: 'manual' },
      { id: 'hemlock-house', name: 'Hemlock House', mode: 'manual' },
      { id: 'the-silent-heath', name: 'The Silent Heath', mode: 'manual' },
      { id: 'the-lost-sister', name: 'The Lost Sister', mode: 'manual' },
      { id: 'the-thing-in-the-depths', name: 'The Thing in the Depths', mode: 'manual' },
      { id: 'the-twisted-hollow', name: 'The Twisted Hollow' },
      { id: 'the-longest-night', name: 'The Longest Night' },
      { id: 'fate-of-the-vale', name: 'Fate of the Vale' },
    ],
    evidence: [
      {
        guideFile: 'campaign/full campaigns/the feast of hemlock vale campaign guide.pdf',
        pages: '10, 14, 19, 23, 27, 34, 46, 61',
        section: 'Scenario headings and three-day structure',
        excerpt: 'Written in Rock; Hemlock House; The Silent Heath; The Lost Sister; The Thing in the Depths; The Twisted Hollow; The Longest Night; Fate of the Vale.',
      },
    ],
    notes: [
      'The first five scenarios form the daytime choice pool. The Twisted Hollow, The Longest Night, and Fate of the Vale are fixed night checkpoints.',
    ],
  },
  {
    canonicalCampaignId: 'the-drowned-city',
    canonicalCampaignName: 'The Drowned City',
    catalogCampaignNames: ['The Drowned City'],
    aliases: ['Drowned City'],
    topology: 'branching',
    steps: [
      { id: 'one-last-job', name: 'One Last Job' },
      { id: 'the-western-wall', name: 'The Western Wall', branch: 'west' },
      { id: 'the-drowned-quarter', name: 'The Drowned Quarter', branch: 'island' },
      { id: 'the-apiary', name: 'The Apiary', branch: 'island' },
      { id: 'the-grand-vault', name: 'The Grand Vault', branch: 'island' },
      { id: 'court-of-the-ancients', name: 'Court of the Ancients', branch: 'island' },
      { id: 'obsidian-canyons', name: 'Obsidian Canyons', branch: 'east' },
      { id: 'sepulchre-of-the-sleeper', name: 'Sepulchre of the Sleeper' },
      { id: 'the-doom-of-arkham-part-i', name: 'The Doom of Arkham Part I' },
      {
        id: 'the-doom-of-arkham-part-ii',
        name: 'The Doom of Arkham Part II',
        aliases: ['The Doom of Arkham'],
        notes: ['Legacy combined-finale logs are treated as completing both parts.'],
      },
    ],
    branchRoutes: [
      {
        id: 'west',
        label: 'Head west',
        entryStepId: 'the-western-wall',
        successors: {
          'one-last-job': ['the-western-wall'],
          'the-western-wall': ['sepulchre-of-the-sleeper', 'the-drowned-quarter', 'the-apiary'],
          'the-drowned-quarter': ['the-apiary'],
          'the-apiary': ['the-grand-vault'],
          'the-grand-vault': ['court-of-the-ancients'],
          'court-of-the-ancients': ['obsidian-canyons'],
          'obsidian-canyons': ['sepulchre-of-the-sleeper'],
          'sepulchre-of-the-sleeper': ['the-doom-of-arkham-part-i'],
          'the-doom-of-arkham-part-i': ['the-doom-of-arkham-part-ii'],
          'the-doom-of-arkham-part-ii': [],
        },
      },
      {
        id: 'east',
        label: 'Head east',
        entryStepId: 'obsidian-canyons',
        successors: {
          'one-last-job': ['obsidian-canyons'],
          'obsidian-canyons': ['sepulchre-of-the-sleeper', 'court-of-the-ancients'],
          'court-of-the-ancients': ['the-grand-vault'],
          'the-grand-vault': ['the-apiary'],
          'the-apiary': ['the-drowned-quarter', 'the-western-wall'],
          'the-drowned-quarter': ['the-western-wall'],
          'the-western-wall': ['sepulchre-of-the-sleeper'],
          'sepulchre-of-the-sleeper': ['the-doom-of-arkham-part-i'],
          'the-doom-of-arkham-part-i': ['the-doom-of-arkham-part-ii'],
          'the-doom-of-arkham-part-ii': [],
        },
      },
    ],
    evidence: [
      {
        guideFile: 'campaign/full campaigns/the drowned city campaign guide.pdf',
        pages: '2, 4, 10–11, 12–40, 44–47',
        section: 'Scenario headings and east/west expedition transitions',
        excerpt: 'One Last Job; west entry: The Western Wall; east entry: Obsidian Canyons; island route successors; Sepulchre of the Sleeper; The Doom of Arkham Parts I–II.',
      },
    ],
    notes: [
      'The east/west expedition choice is reconstructed from standard scenario history; side scenarios do not affect it.',
      'Interludes between scenarios are not separate scenario logs.',
    ],
  },
  {
    canonicalCampaignId: 'children-of-blood',
    canonicalCampaignName: 'Children of Blood',
    catalogCampaignNames: ['Children of Blood'],
    topology: 'linear',
    steps: [
      { id: 'river-of-blood', name: 'River of Blood' },
      { id: 'new-horizons', name: 'New Horizons', requires: ['river-of-blood'] },
      { id: 'blood-money', name: 'Blood Money', requires: ['new-horizons'] },
    ],
    evidence: [
      {
        guideFile: 'campaign/small campaigns/children of blood campaign guide.pdf',
        pages: '7, 12, 21',
        section: 'Scenario headings',
        excerpt: 'River of Blood; New Horizons; Blood Money.',
      },
    ],
  },
  {
    canonicalCampaignId: 'brethren-of-ash',
    canonicalCampaignName: 'Brethren of Ash',
    catalogCampaignNames: ['Brethren of Ash'],
    aliases: ['The Brethren of the Ash', 'Bretheren of Ash'],
    topology: 'linear',
    steps: [
      { id: 'spreading-flames', name: 'Spreading Flames' },
      { id: 'smoke-and-mirrors', name: 'Smoke and Mirrors', requires: ['spreading-flames'] },
      { id: 'queen-of-ash', name: 'Queen of Ash', requires: ['smoke-and-mirrors'] },
    ],
    evidence: [
      {
        guideFile: 'campaign/small campaigns/bretheren of ash campaign guide.pdf',
        pages: '3, 6, 11',
        section: 'Scenario headings',
        excerpt: 'Spreading Flames; Smoke and Mirrors; Queen of Ash.',
      },
    ],
  },
]

export const CAMPAIGN_PROGRESSION_GAPS: CampaignProgressionGap[] = []

export function resolveCampaignProgressionContract(input: CampaignLookupInput): CampaignProgressionContract | null {
  const lookupGroups = collectPrioritizedLookupKeys(input)
  for (const lookupKeys of lookupGroups) {
    const match = CAMPAIGN_PROGRESSION_CONTRACTS.find(contract =>
      hasLookupIntersection(lookupKeys, contractLookupNames(contract)),
    )
    if (match) return match
  }
  return null
}

export function resolveCampaignProgressionGap(input: CampaignLookupInput): CampaignProgressionGap | null {
  const lookupGroups = collectPrioritizedLookupKeys(input)
  for (const lookupKeys of lookupGroups) {
    const match = CAMPAIGN_PROGRESSION_GAPS.find(gap =>
      hasLookupIntersection(lookupKeys, gapLookupNames(gap)),
    )
    if (match) return match
  }
  return null
}

export function getCampaignProgressionScenarioNames(input: CampaignLookupInput): string[] {
  const contract = resolveCampaignProgressionContract(input)
  return contract ? contract.steps.map(step => step.name) : []
}

function normalizeScenarioName(name: string): string {
  return normalizeProgressionValue(name)
}

function getCompletedStepIds(contract: CampaignProgressionContract, completedScenarioNames: string[]): string[] {
  const remaining = new Set(
    completedScenarioNames
      .map(name => name.trim())
      .filter(Boolean)
      .map(normalizeScenarioName),
  )

  const completed: string[] = []

  for (const step of contract.steps) {
    const matchedName = [step.name, ...(step.aliases ?? [])]
      .map(normalizeScenarioName)
      .find(name => remaining.has(name))
    if (matchedName) {
      completed.push(step.id)
      remaining.delete(matchedName)
    }
  }

  return completed
}

function getHemlockValeEligibleSteps(
  contract: CampaignProgressionContract,
  completedSet: Set<string>,
): CampaignProgressionStep[] {
  const daytimeIds = [
    'written-in-rock',
    'hemlock-house',
    'the-silent-heath',
    'the-lost-sister',
    'the-thing-in-the-depths',
  ]
  const completedDaytimeCount = daytimeIds.filter(id => completedSet.has(id)).length
  const remainingDaytime = contract.steps.filter(step =>
    daytimeIds.includes(step.id) && !completedSet.has(step.id),
  )

  if (!completedSet.has('the-twisted-hollow')) {
    return completedDaytimeCount === 0
      ? remainingDaytime
      : contract.steps.filter(step => step.id === 'the-twisted-hollow')
  }
  if (!completedSet.has('the-longest-night')) {
    return completedDaytimeCount < 2
      ? remainingDaytime
      : contract.steps.filter(step => step.id === 'the-longest-night')
  }
  if (!completedSet.has('fate-of-the-vale')) {
    return completedDaytimeCount < 3
      ? remainingDaytime
      : contract.steps.filter(step => step.id === 'fate-of-the-vale')
  }
  return []
}

function getBranchRouteEligibleSteps(
  contract: CampaignProgressionContract,
  completedScenarioNames: string[],
  completedSet: Set<string>,
): CampaignProgressionStep[] {
  const routes = contract.branchRoutes ?? []
  if (routes.length === 0) return []

  const stepById = new Map(contract.steps.map(step => [step.id, step]))
  const stepIdByName = new Map(contract.steps.flatMap(step =>
    [step.name, ...(step.aliases ?? [])].map(name => [normalizeScenarioName(name), step.id] as const)
  ))
  const history = completedScenarioNames
    .map(name => stepIdByName.get(normalizeScenarioName(name)))
    .filter((id): id is string => Boolean(id))

  if (history.length === 0) {
    return contract.steps.filter(step => step.id === 'one-last-job')
  }

  const lastStepId = history[history.length - 1]
  if (!lastStepId) return []

  let compatibleRoutes = routes.filter(route => {
    for (let index = 1; index < history.length; index += 1) {
      const previous = history[index - 1]
      const current = history[index]
      if (!(route.successors[previous] ?? []).includes(current)) return false
    }
    return true
  })

  const firstRouteEntry = routes
    .map(route => ({ route, index: history.indexOf(route.entryStepId) }))
    .filter(entry => entry.index >= 0)
    .sort((left, right) => left.index - right.index)[0]
  if (firstRouteEntry) {
    compatibleRoutes = compatibleRoutes.filter(route => route.id === firstRouteEntry.route.id)
  }

  if (compatibleRoutes.length === 0) {
    compatibleRoutes = routes
  }

  const candidateIds = Array.from(new Set(
    compatibleRoutes.flatMap(route => route.successors[lastStepId] ?? []),
  ))

  return candidateIds
    .filter(id => !completedSet.has(id))
    .map(id => stepById.get(id))
    .filter((step): step is CampaignProgressionStep => Boolean(step))
}

export function getNextCampaignScenarioResolution(
  input: CampaignLookupInput,
  completedScenarioNames: string[] = [],
): NextCampaignScenarioResolution {
  const contract = resolveCampaignProgressionContract(input)
  const gap = resolveCampaignProgressionGap(input)

  if (!contract) {
    return {
      status: 'unavailable',
      canonicalCampaignId: gap?.canonicalCampaignId,
      contract: null,
      gap,
      candidates: [],
      automaticCandidates: [],
      manualCandidates: [],
      completedStepIds: [],
      notes: [
        gap?.reason ?? 'No verified campaign progression contract matches this campaign.',
        ...(gap?.notes ?? []),
      ],
    }
  }

  const completedStepIds = getCompletedStepIds(contract, completedScenarioNames)
  const completedSet = new Set(completedStepIds)

  const eligibleSteps = contract.branchRoutes
    ? getBranchRouteEligibleSteps(contract, completedScenarioNames, completedSet)
    : contract.canonicalCampaignId === 'the-feast-of-hemlock-vale'
      ? getHemlockValeEligibleSteps(contract, completedSet)
      : contract.steps.filter(step => {
        if (completedSet.has(step.id)) return false
        return (step.requires ?? []).every(requirement => completedSet.has(requirement))
      })

  const automaticCandidates = eligibleSteps.filter(step => step.mode !== 'manual')
  const manualCandidates = eligibleSteps.filter(step => step.mode === 'manual')
  const candidates = [...automaticCandidates, ...manualCandidates]

  let status: NextCampaignScenarioResolution['status']
  if (automaticCandidates.length === 1) {
    status = 'single'
  } else if (automaticCandidates.length > 1) {
    status = 'choice'
  } else if (manualCandidates.length > 0) {
    status = 'manual'
  } else {
    status = 'complete'
  }

  const notes = [...(contract.notes ?? [])]
  if (manualCandidates.length > 0) {
    notes.push('At least one next step is guide-backed but not auto-resolvable from scenario history alone.')
  }

  return {
    status,
    canonicalCampaignId: contract.canonicalCampaignId,
    contract,
    gap: null,
    candidates,
    automaticCandidates,
    manualCandidates,
    completedStepIds,
    notes,
  }
}

export function getContinuableCampaignProgressionAudit(): CampaignProgressionAuditEntry[] {
  return [...FULL_CAMPAIGNS, ...SMALL_CAMPAIGNS].map(campaign => {
    const input = {
      campaignName: campaign.name,
      campaignSet: campaign.set,
      campaignType: campaign.type,
    } as const

    const contract = resolveCampaignProgressionContract(input)
    const gap = resolveCampaignProgressionGap(input)

    return {
      campaignName: campaign.name,
      campaignType: campaign.type,
      canonicalCampaignId: contract?.canonicalCampaignId ?? gap?.canonicalCampaignId ?? 'unknown',
      canonicalCampaignName: contract?.canonicalCampaignName ?? gap?.canonicalCampaignName ?? campaign.name,
      status: contract ? 'verified' : 'gap',
      topology: contract?.topology,
      sourceGuides: contract?.evidence.map(source => `${source.guideFile} (${source.pages})`) ?? [],
      notes: contract?.notes ?? gap?.notes ?? (gap ? [gap.reason] : []),
    }
  })
}
