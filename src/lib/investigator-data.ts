import { Archetype } from './types'

export interface Investigator {
  id: string
  name: string
  chapter: 1 | 2
  archetypes: Archetype[]
  set: string
  arkhamDbCode: string | Record<string, string> | null
}

export const INVESTIGATORS: Investigator[] = [
  // Core
  { id: 'roland-banks', name: 'Roland Banks', chapter: 1, archetypes: ['Guardian'], set: 'Core', arkhamDbCode: '01001' },
  { id: 'daisy-walker', name: 'Daisy Walker', chapter: 1, archetypes: ['Seeker'], set: 'Core', arkhamDbCode: '01002' },
  { id: 'skids-otoole', name: '"Skids" O\'Toole', chapter: 1, archetypes: ['Rogue'], set: 'Core', arkhamDbCode: '01003' },
  { id: 'agnes-baker', name: 'Agnes Baker', chapter: 1, archetypes: ['Mystic'], set: 'Core', arkhamDbCode: '01004' },
  { id: 'wendy-adams', name: 'Wendy Adams', chapter: 1, archetypes: ['Survivor'], set: 'Core', arkhamDbCode: '01005' },

  // The Dunwich Legacy
  { id: 'zoey-samaras', name: 'Zoey Samaras', chapter: 1, archetypes: ['Guardian'], set: 'The Dunwich Legacy', arkhamDbCode: '02001' },
  { id: 'rex-murphy', name: 'Rex Murphy', chapter: 1, archetypes: ['Seeker'], set: 'The Dunwich Legacy', arkhamDbCode: '02002' },
  { id: 'jenny-barnes', name: 'Jenny Barnes', chapter: 1, archetypes: ['Rogue'], set: 'The Dunwich Legacy', arkhamDbCode: '02003' },
  { id: 'jim-culver', name: 'Jim Culver', chapter: 1, archetypes: ['Mystic'], set: 'The Dunwich Legacy', arkhamDbCode: '02004' },
  { id: 'ashcan-pete', name: '"Ashcan" Pete', chapter: 1, archetypes: ['Survivor'], set: 'The Dunwich Legacy', arkhamDbCode: '02005' },

  // The Path to Carcosa
  { id: 'mark-harrigan', name: 'Mark Harrigan', chapter: 1, archetypes: ['Guardian'], set: 'The Path to Carcosa', arkhamDbCode: '03001' },
  { id: 'minh-thi-phan', name: 'Minh Thi Phan', chapter: 1, archetypes: ['Seeker'], set: 'The Path to Carcosa', arkhamDbCode: '03002' },
  { id: 'sefina-rousseau', name: 'Sefina Rousseau', chapter: 1, archetypes: ['Rogue'], set: 'The Path to Carcosa', arkhamDbCode: '03003' },
  { id: 'akachi-onyele', name: 'Akachi Onyele', chapter: 1, archetypes: ['Mystic'], set: 'The Path to Carcosa', arkhamDbCode: '03004' },
  { id: 'william-yorick', name: 'William Yorick', chapter: 1, archetypes: ['Survivor'], set: 'The Path to Carcosa', arkhamDbCode: '03005' },
  { id: 'lola-hayes', name: 'Lola Hayes', chapter: 1, archetypes: ['Neutral'], set: 'The Path to Carcosa', arkhamDbCode: '03006' },

  // The Forgotten Age
  { id: 'leo-anderson', name: 'Leo Anderson', chapter: 1, archetypes: ['Guardian'], set: 'The Forgotten Age', arkhamDbCode: '04001' },
  { id: 'ursula-downs', name: 'Ursula Downs', chapter: 1, archetypes: ['Seeker'], set: 'The Forgotten Age', arkhamDbCode: '04002' },
  { id: 'finn-edwards', name: 'Finn Edwards', chapter: 1, archetypes: ['Rogue'], set: 'The Forgotten Age', arkhamDbCode: '04003' },
  { id: 'father-mateo', name: 'Father Mateo', chapter: 1, archetypes: ['Mystic'], set: 'The Forgotten Age', arkhamDbCode: '04004' },
  { id: 'calvin-wright', name: 'Calvin Wright', chapter: 1, archetypes: ['Survivor'], set: 'The Forgotten Age', arkhamDbCode: '04005' },

  // The Circle Undone
  { id: 'carolyn-fern', name: 'Carolyn Fern', chapter: 1, archetypes: ['Guardian'], set: 'The Circle Undone', arkhamDbCode: '05001' },
  { id: 'joe-diamond', name: 'Joe Diamond', chapter: 1, archetypes: ['Seeker'], set: 'The Circle Undone', arkhamDbCode: '05002' },
  { id: 'preston-fairmont', name: 'Preston Fairmont', chapter: 1, archetypes: ['Rogue'], set: 'The Circle Undone', arkhamDbCode: '05003' },
  { id: 'diana-stanley', name: 'Diana Stanley', chapter: 1, archetypes: ['Mystic'], set: 'The Circle Undone', arkhamDbCode: '05004' },
  { id: 'marie-lambeau', name: 'Marie Lambeau', chapter: 1, archetypes: ['Mystic'], set: 'The Circle Undone', arkhamDbCode: '05006' },
  { id: 'rita-young', name: 'Rita Young', chapter: 1, archetypes: ['Survivor'], set: 'The Circle Undone', arkhamDbCode: '05005' },

  // The Dream-Eaters
  { id: 'tommy-muldoon', name: 'Tommy Muldoon', chapter: 1, archetypes: ['Guardian'], set: 'The Dream-Eaters', arkhamDbCode: '06001' },
  { id: 'mandy-thompson', name: 'Mandy Thompson', chapter: 1, archetypes: ['Seeker'], set: 'The Dream-Eaters', arkhamDbCode: '06002' },
  { id: 'tony-morgan', name: 'Tony Morgan', chapter: 1, archetypes: ['Rogue'], set: 'The Dream-Eaters', arkhamDbCode: '06003' },
  { id: 'luke-robinson', name: 'Luke Robinson', chapter: 1, archetypes: ['Mystic'], set: 'The Dream-Eaters', arkhamDbCode: '06004' },
  { id: 'patrice-hathaway', name: 'Patrice Hathaway', chapter: 1, archetypes: ['Survivor'], set: 'The Dream-Eaters', arkhamDbCode: '06005' },

  // The Innsmouth Conspiracy
  { id: 'sister-mary', name: 'Sister Mary', chapter: 1, archetypes: ['Guardian'], set: 'The Innsmouth Conspiracy', arkhamDbCode: '07001' },
  { id: 'amanda-sharpe', name: 'Amanda Sharpe', chapter: 1, archetypes: ['Seeker'], set: 'The Innsmouth Conspiracy', arkhamDbCode: '07002' },
  { id: 'trish-scarborough', name: 'Trish Scarborough', chapter: 1, archetypes: ['Rogue'], set: 'The Innsmouth Conspiracy', arkhamDbCode: '07003' },
  { id: 'dexter-drake', name: 'Dexter Drake', chapter: 1, archetypes: ['Mystic'], set: 'The Innsmouth Conspiracy', arkhamDbCode: '07004' },
  { id: 'silas-marsh', name: 'Silas Marsh', chapter: 1, archetypes: ['Survivor'], set: 'The Innsmouth Conspiracy', arkhamDbCode: '07005' },

  // Edge of the Earth
  { id: 'daniela-reyes', name: 'Daniela Reyes', chapter: 1, archetypes: ['Guardian'], set: 'Edge of the Earth', arkhamDbCode: '08001' },
  { id: 'norman-withers', name: 'Norman Withers', chapter: 1, archetypes: ['Seeker'], set: 'Edge of the Earth', arkhamDbCode: '08004' },
  { id: 'monterey-jack', name: 'Monterey Jack', chapter: 1, archetypes: ['Rogue'], set: 'Edge of the Earth', arkhamDbCode: '08007' },
  { id: 'lily-chen', name: 'Lily Chen', chapter: 1, archetypes: ['Mystic'], set: 'Edge of the Earth', arkhamDbCode: '08010' },
  { id: 'bob-jenkins', name: 'Bob Jenkins', chapter: 1, archetypes: ['Survivor'], set: 'Edge of the Earth', arkhamDbCode: '08016' },

  // The Scarlet Keys
  { id: 'carson-sinclair', name: 'Carson Sinclair', chapter: 1, archetypes: ['Guardian'], set: 'The Scarlet Keys', arkhamDbCode: '09001' },
  { id: 'vincent-lee', name: 'Vincent Lee', chapter: 1, archetypes: ['Seeker'], set: 'The Scarlet Keys', arkhamDbCode: '09004' },
  { id: 'kymani-jones', name: 'Kymani Jones', chapter: 1, archetypes: ['Rogue'], set: 'The Scarlet Keys', arkhamDbCode: '09008' },
  { id: 'amina-zidane', name: 'Amina Zidane', chapter: 1, archetypes: ['Mystic'], set: 'The Scarlet Keys', arkhamDbCode: '09011' },
  { id: 'darrell-simmons', name: 'Darrell Simmons', chapter: 1, archetypes: ['Survivor'], set: 'The Scarlet Keys', arkhamDbCode: '09015' },
  { id: 'charlie-kane', name: 'Charlie Kane', chapter: 1, archetypes: ['Neutral'], set: 'The Scarlet Keys', arkhamDbCode: '09018' },

  // The Feast of Hemlock Vale
  { id: 'wilson-richards', name: 'Wilson Richards', chapter: 1, archetypes: ['Guardian'], set: 'The Feast of Hemlock Vale', arkhamDbCode: '10001' },
  { id: 'kate-winthrop', name: 'Kate Winthrop', chapter: 1, archetypes: ['Seeker'], set: 'The Feast of Hemlock Vale', arkhamDbCode: '10004' },
  { id: 'alessandra-zorzi', name: 'Alessandra Zorzi', chapter: 1, archetypes: ['Rogue'], set: 'The Feast of Hemlock Vale', arkhamDbCode: '10009' },
  { id: 'kohaku-narukami', name: 'Kohaku Narukami', chapter: 1, archetypes: ['Mystic'], set: 'The Feast of Hemlock Vale', arkhamDbCode: '10012' },
  { id: 'hank-samson', name: 'Hank Samson', chapter: 1, archetypes: ['Survivor'], set: 'The Feast of Hemlock Vale', arkhamDbCode: '10015' },

  // The Drowned City
  { id: 'marion-tavares', name: 'Marion Tavares', chapter: 1, archetypes: ['Guardian'], set: 'The Drowned City', arkhamDbCode: '11001' },
  { id: 'lucius-galloway', name: 'Lucius Galloway', chapter: 1, archetypes: ['Seeker'], set: 'The Drowned City', arkhamDbCode: '11004' },
  { id: 'agatha-crane', name: 'Agatha Crane', chapter: 1, archetypes: ['Seeker', 'Mystic'], set: 'The Drowned City', arkhamDbCode: { 'Seeker': '11007', 'Mystic': '11008' } },
  { id: 'michael-mcglen', name: 'Michael McGlen', chapter: 1, archetypes: ['Rogue'], set: 'The Drowned City', arkhamDbCode: '11011' },
  { id: 'gloria-goldberg', name: 'Gloria Goldberg', chapter: 1, archetypes: ['Mystic'], set: 'The Drowned City', arkhamDbCode: '11014' },
  { id: 'george-barnaby', name: 'George Barnaby', chapter: 1, archetypes: ['Survivor'], set: 'The Drowned City', arkhamDbCode: '11017' },

  // Investigator Starter Decks (Ch. 1)
  { id: 'nathaniel-cho', name: 'Nathaniel Cho', chapter: 1, archetypes: ['Guardian'], set: 'Evergreen Starters (Ch. 1)', arkhamDbCode: '60101' },
  { id: 'harvey-walters', name: 'Harvey Walters', chapter: 1, archetypes: ['Seeker'], set: 'Evergreen Starters (Ch. 1)', arkhamDbCode: '60201' },
  { id: 'winifred-habbamock', name: 'Winifred Habbamock', chapter: 1, archetypes: ['Rogue'], set: 'Evergreen Starters (Ch. 1)', arkhamDbCode: '60301' },
  { id: 'jacqueline-fine', name: 'Jacqueline Fine', chapter: 1, archetypes: ['Mystic'], set: 'Evergreen Starters (Ch. 1)', arkhamDbCode: '60401' },
  { id: 'stella-clark', name: 'Stella Clark', chapter: 1, archetypes: ['Survivor'], set: 'Evergreen Starters (Ch. 1)', arkhamDbCode: '60501' },

  // Special sets
  { id: 'subject-5u-21', name: 'Subject 5U-21 (Suzi)', chapter: 1, archetypes: ['Neutral'], set: 'The Blob That Ate Everything', arkhamDbCode: '89001' },

  // Barkham Horror
  { id: 'bark-harrigan', name: 'Bark Harrigan', chapter: 1, archetypes: ['Guardian'], set: 'Barkham Horror', arkhamDbCode: null },
  { id: 'kate-winthpup', name: 'Kate Winthpup', chapter: 1, archetypes: ['Seeker'], set: 'Barkham Horror', arkhamDbCode: null },
  { id: 'skids-odrool', name: '"Skids" O\'Drool', chapter: 1, archetypes: ['Rogue'], set: 'Barkham Horror', arkhamDbCode: null },
  { id: 'jacqueline-canine', name: 'Jacqueline Canine', chapter: 1, archetypes: ['Mystic'], set: 'Barkham Horror', arkhamDbCode: null },
  { id: 'duke', name: 'Duke', chapter: 1, archetypes: ['Survivor'], set: 'Barkham Horror', arkhamDbCode: null },

  // Parallel investigators
  { id: 'roland-banks-parallel', name: 'Roland Banks (Parallel)', chapter: 1, archetypes: ['Guardian'], set: 'Parallel', arkhamDbCode: '90024' },
  { id: 'zoey-samaras-parallel', name: 'Zoey Samaras (Parallel)', chapter: 1, archetypes: ['Guardian'], set: 'Parallel', arkhamDbCode: '90059' },
  { id: 'daisy-walker-parallel', name: 'Daisy Walker (Parallel)', chapter: 1, archetypes: ['Seeker'], set: 'Parallel', arkhamDbCode: '90001' },
  { id: 'rex-murphy-parallel', name: 'Rex Murphy (Parallel)', chapter: 1, archetypes: ['Seeker'], set: 'Parallel', arkhamDbCode: '90078' },
  { id: 'skids-otoole-parallel', name: '"Skids" O\'Toole (Parallel)', chapter: 1, archetypes: ['Rogue'], set: 'Parallel', arkhamDbCode: '90008' },
  { id: 'jenny-barnes-parallel', name: 'Jenny Barnes (Parallel)', chapter: 1, archetypes: ['Rogue'], set: 'Parallel', arkhamDbCode: '90084' },
  { id: 'monterey-jack-parallel', name: 'Monterey Jack (Parallel)', chapter: 1, archetypes: ['Rogue'], set: 'Parallel', arkhamDbCode: '90062' },
  { id: 'agnes-baker-parallel', name: 'Agnes Baker (Parallel)', chapter: 1, archetypes: ['Mystic'], set: 'Parallel', arkhamDbCode: '90017' },
  { id: 'father-mateo-parallel', name: 'Father Mateo (Parallel)', chapter: 1, archetypes: ['Mystic'], set: 'Parallel', arkhamDbCode: '90081' },
  { id: 'jim-culver-parallel', name: 'Jim Culver (Parallel)', chapter: 1, archetypes: ['Mystic'], set: 'Parallel', arkhamDbCode: '90049' },
  { id: 'ashcan-pete-parallel', name: '"Ashcan" Pete (Parallel)', chapter: 1, archetypes: ['Survivor'], set: 'Parallel', arkhamDbCode: '90046' },
  { id: 'wendy-adams-parallel', name: 'Wendy Adams (Parallel)', chapter: 1, archetypes: ['Survivor'], set: 'Parallel', arkhamDbCode: '90037' },

  // Chapter 2 — Core 2026
  { id: 'daniela-reyes-ch2', name: 'Daniela Reyes', chapter: 2, archetypes: ['Guardian'], set: 'Core 2026', arkhamDbCode: '12001' },
  { id: 'joe-diamond-ch2', name: 'Joe Diamond', chapter: 2, archetypes: ['Seeker'], set: 'Core 2026', arkhamDbCode: '12004' },
  { id: 'trish-scarborough-ch2', name: 'Trish Scarborough', chapter: 2, archetypes: ['Rogue'], set: 'Core 2026', arkhamDbCode: '12007' },
  { id: 'dexter-drake-ch2', name: 'Dexter Drake', chapter: 2, archetypes: ['Mystic'], set: 'Core 2026', arkhamDbCode: '12010' },
  { id: 'isabelle-barnes', name: 'Isabelle Barnes', chapter: 2, archetypes: ['Survivor'], set: 'Core 2026', arkhamDbCode: '12013' },

  // Chapter 2 — Evergreen Starter Decks
  { id: 'tommy-muldoon-ch2', name: 'Tommy Muldoon', chapter: 2, archetypes: ['Guardian'], set: 'Evergreen Starters (Ch. 2)', arkhamDbCode: '60151' },
  { id: 'carolyn-fern-ch2', name: 'Carolyn Fern', chapter: 2, archetypes: ['Seeker'], set: 'Evergreen Starters (Ch. 2)', arkhamDbCode: '60251' },
  { id: 'andre-patel', name: 'André Patel', chapter: 2, archetypes: ['Rogue'], set: 'Evergreen Starters (Ch. 2)', arkhamDbCode: '60351' },
  { id: 'marie-lambeau-ch2', name: 'Marie Lambeau', chapter: 2, archetypes: ['Mystic'], set: 'Evergreen Starters (Ch. 2)', arkhamDbCode: '60451' },
  { id: 'miguel-de-la-cruz', name: 'Miguel de la Cruz', chapter: 2, archetypes: ['Survivor'], set: 'Evergreen Starters (Ch. 2)', arkhamDbCode: '60551' },
]

// Names that appear in both Chapter 1 and Chapter 2
export const DUAL_CHAPTER_NAMES = new Set(
  INVESTIGATORS
    .filter(inv => inv.chapter === 2)
    .map(inv => inv.name)
    .filter(name => INVESTIGATORS.some(inv => inv.chapter === 1 && inv.name === name))
)

// Map from investigator ID to Investigator for fast lookups
const INVESTIGATOR_BY_ID = new Map<string, Investigator>(
  INVESTIGATORS.map(inv => [inv.id, inv])
)

export const INVESTIGATOR_SETS: string[] = [
  'Core',
  'The Dunwich Legacy',
  'The Path to Carcosa',
  'The Forgotten Age',
  'The Circle Undone',
  'The Dream-Eaters',
  'The Innsmouth Conspiracy',
  'Edge of the Earth',
  'The Scarlet Keys',
  'The Feast of Hemlock Vale',
  'The Drowned City',
  'Evergreen Starters (Ch. 1)',
  'The Blob That Ate Everything',
  'Barkham Horror',
  'Parallel',
  'Core 2026',
  'Evergreen Starters (Ch. 2)',
]

export function getInvestigatorById(id: string): Investigator | undefined {
  return INVESTIGATOR_BY_ID.get(id)
}

/** Returns badge label for an investigator: "Parallel", "Ch. 1", or "Ch. 2" */
export function getChapterBadgeLabel(inv: { set?: string; chapter?: number }): string {
  if (inv.set === 'Parallel') return 'Parallel'
  return `Ch. ${inv.chapter || 1}`
}

/** Returns true if the badge should use the "special" (violet) styling */
export function isChapterBadgeSpecial(inv: { set?: string; chapter?: number }): boolean {
  return inv.set === 'Parallel' || inv.chapter === 2
}

export function getInvestigatorsByArchetype(archetype: Archetype): Investigator[] {
  return INVESTIGATORS.filter(inv => inv.archetypes.includes(archetype))
}

/** Finds investigator by name. If duplicates exist (Ch.1/Ch.2), returns Ch.1 by default. Use chapter param to disambiguate. */
export function getInvestigatorByName(name: string, chapter?: 1 | 2): Investigator | undefined {
  if (chapter) {
    return INVESTIGATORS.find(inv => inv.name === name && inv.chapter === chapter)
  }
  // Default to Ch.1 for backward compatibility
  return INVESTIGATORS.find(inv => inv.name === name && inv.chapter === 1) 
    || INVESTIGATORS.find(inv => inv.name === name)
}

/** Resolve an InvestigatorAssignment to its canonical Investigator, handling legacy data */
export function resolveInvestigator(assignment: { investigatorId?: string; investigatorName: string; chapter?: 1 | 2 }): Investigator | undefined {
  if (assignment.investigatorId) {
    return getInvestigatorById(assignment.investigatorId)
  }
  return getInvestigatorByName(assignment.investigatorName, assignment.chapter || 1)
}

export function getAllInvestigatorNames(): string[] {
  return [...new Set(INVESTIGATORS.map(inv => inv.name))].sort()
}

export function getInvestigatorPairKey(inv: { investigatorName: string; chapter?: 1 | 2 }): string {
  if (DUAL_CHAPTER_NAMES.has(inv.investigatorName)) {
    return `${inv.investigatorName} (Ch. ${inv.chapter ?? 1})`
  }
  return inv.investigatorName
}

export function getAllInvestigatorPairKeys(): string[] {
  return [...new Set(INVESTIGATORS.map(inv => getInvestigatorDisplayName(inv)))].sort()
}

export function isDualClassInvestigator(name: string): boolean {
  const investigator = getInvestigatorByName(name)
  return investigator ? investigator.archetypes.length > 1 : false
}

const STARTER_DECK_INVESTIGATORS = [
  'Nathaniel Cho',
  'Harvey Walters',
  'Winifred Habbamock',
  'Jacqueline Fine',
  'Stella Clark'
]

const STARTER_DECK_CH2_INVESTIGATORS = [
  'Tommy Muldoon (Ch. 2)',
  'Carolyn Fern (Ch. 2)',
  'André Patel',
  'Marie Lambeau (Ch. 2)',
  'Miguel de la Cruz',
]

export function getDisplaySetName(investigatorName: string, setName: string): string {
  if (STARTER_DECK_INVESTIGATORS.includes(investigatorName)) {
    return 'Investigator Starter Deck'
  }
  if (STARTER_DECK_CH2_INVESTIGATORS.includes(setName)) {
    return 'Investigator Starter Deck (Ch. 2)'
  }
  return setName
}

export function getArkhamDBUrl(investigatorName: string, archetype?: Archetype, chapter?: 1 | 2): string | null {
  const investigator = getInvestigatorByName(investigatorName, chapter)
  if (!investigator || investigator.arkhamDbCode === null) return null

  const code = investigator.arkhamDbCode
  if (typeof code === 'object') {
    if (archetype && code[archetype]) {
      return `https://arkhamdb.com/card/${code[archetype]}`
    }
    const firstCode = Object.values(code)[0]
    return `https://arkhamdb.com/card/${firstCode}`
  }

  return `https://arkhamdb.com/card/${code}`
}

export function getArkhamDBUrlById(id: string, archetype?: Archetype): string | null {
  const investigator = getInvestigatorById(id)
  if (!investigator || investigator.arkhamDbCode === null) return null

  const code = investigator.arkhamDbCode
  if (typeof code === 'object') {
    if (archetype && code[archetype]) {
      return `https://arkhamdb.com/card/${code[archetype]}`
    }
    const firstCode = Object.values(code)[0]
    return `https://arkhamdb.com/card/${firstCode}`
  }

  return `https://arkhamdb.com/card/${code}`
}

/** Returns display name with chapter suffix for investigators that exist in both chapters */
export function getInvestigatorDisplayName(inv: Investigator): string {
  if (DUAL_CHAPTER_NAMES.has(inv.name)) {
    return `${inv.name} (Ch. ${inv.chapter})`
  }
  return inv.name
}
