import { Archetype } from './types'

export interface Investigator {
  name: string
  archetypes: Archetype[]
  set: string
}

export const INVESTIGATORS: Investigator[] = [
  { name: 'Roland Banks', archetypes: ['Guardian'], set: 'Core' },
  { name: 'Daisy Walker', archetypes: ['Seeker'], set: 'Core' },
  { name: '"Skids" O\'Toole', archetypes: ['Rogue'], set: 'Core' },
  { name: 'Agnes Baker', archetypes: ['Mystic'], set: 'Core' },
  { name: 'Wendy Adams', archetypes: ['Survivor'], set: 'Core' },
  
  { name: 'Zoey Samaras', archetypes: ['Guardian'], set: 'The Dunwich Legacy' },
  { name: 'Rex Murphy', archetypes: ['Seeker'], set: 'The Dunwich Legacy' },
  { name: 'Jenny Barnes', archetypes: ['Rogue'], set: 'The Dunwich Legacy' },
  { name: 'Jim Culver', archetypes: ['Mystic'], set: 'The Dunwich Legacy' },
  { name: '"Ashcan" Pete', archetypes: ['Survivor'], set: 'The Dunwich Legacy' },
  
  { name: 'Mark Harrigan', archetypes: ['Guardian'], set: 'The Path to Carcosa' },
  { name: 'Minh Thi Phan', archetypes: ['Seeker'], set: 'The Path to Carcosa' },
  { name: 'Sefina Rousseau', archetypes: ['Rogue'], set: 'The Path to Carcosa' },
  { name: 'Akachi Onyele', archetypes: ['Mystic'], set: 'The Path to Carcosa' },
  { name: 'William Yorick', archetypes: ['Survivor'], set: 'The Path to Carcosa' },
  { name: 'Lola Hayes', archetypes: ['Neutral'], set: 'The Path to Carcosa' },
  
  { name: 'Leo Anderson', archetypes: ['Guardian'], set: 'The Forgotten Age' },
  { name: 'Ursula Downs', archetypes: ['Seeker'], set: 'The Forgotten Age' },
  { name: 'Finn Edwards', archetypes: ['Rogue'], set: 'The Forgotten Age' },
  { name: 'Father Mateo', archetypes: ['Mystic'], set: 'The Forgotten Age' },
  { name: 'Calvin Wright', archetypes: ['Survivor'], set: 'The Forgotten Age' },
  
  { name: 'Carolyn Fern', archetypes: ['Guardian'], set: 'The Circle Undone' },
  { name: 'Joe Diamond', archetypes: ['Seeker'], set: 'The Circle Undone' },
  { name: 'Preston Fairmont', archetypes: ['Rogue'], set: 'The Circle Undone' },
  { name: 'Diana Stanley', archetypes: ['Mystic'], set: 'The Circle Undone' },
  { name: 'Marie Lambeau', archetypes: ['Mystic'], set: 'The Circle Undone' },
  { name: 'Rita Young', archetypes: ['Survivor'], set: 'The Circle Undone' },
  
  { name: 'Tommy Muldoon', archetypes: ['Guardian'], set: 'The Dream-Eaters' },
  { name: 'Mandy Thompson', archetypes: ['Seeker'], set: 'The Dream-Eaters' },
  { name: 'Tony Morgan', archetypes: ['Rogue'], set: 'The Dream-Eaters' },
  { name: 'Luke Robinson', archetypes: ['Mystic'], set: 'The Dream-Eaters' },
  { name: 'Patrice Hathaway', archetypes: ['Survivor'], set: 'The Dream-Eaters' },
  
  { name: 'Sister Mary', archetypes: ['Guardian'], set: 'The Innsmouth Conspiracy' },
  { name: 'Amanda Sharpe', archetypes: ['Seeker'], set: 'The Innsmouth Conspiracy' },
  { name: 'Trish Scarborough', archetypes: ['Rogue'], set: 'The Innsmouth Conspiracy' },
  { name: 'Dexter Drake', archetypes: ['Mystic'], set: 'The Innsmouth Conspiracy' },
  { name: 'Silas Marsh', archetypes: ['Survivor'], set: 'The Innsmouth Conspiracy' },
  
  { name: 'Daniela Reyes', archetypes: ['Guardian'], set: 'Edge of the Earth' },
  { name: 'Norman Withers', archetypes: ['Seeker'], set: 'Edge of the Earth' },
  { name: 'Monterey Jack', archetypes: ['Rogue'], set: 'Edge of the Earth' },
  { name: 'Lily Chen', archetypes: ['Mystic'], set: 'Edge of the Earth' },
  { name: 'Bob Jenkins', archetypes: ['Survivor'], set: 'Edge of the Earth' },
  
  { name: 'Carson Sinclair', archetypes: ['Guardian'], set: 'The Scarlet Keys' },
  { name: 'Vincent Lee', archetypes: ['Seeker'], set: 'The Scarlet Keys' },
  { name: 'Kymani Jones', archetypes: ['Rogue'], set: 'The Scarlet Keys' },
  { name: 'Amina Zidane', archetypes: ['Mystic'], set: 'The Scarlet Keys' },
  { name: 'Darrell Simmons', archetypes: ['Survivor'], set: 'The Scarlet Keys' },
  { name: 'Charlie Kane', archetypes: ['Neutral'], set: 'The Scarlet Keys' },
  
  { name: 'Wilson Richards', archetypes: ['Guardian'], set: 'The Feast of Hemlock Vale' },
  { name: 'Kate Winthrop', archetypes: ['Seeker'], set: 'The Feast of Hemlock Vale' },
  { name: 'Alessandra Zorzi', archetypes: ['Rogue'], set: 'The Feast of Hemlock Vale' },
  { name: 'Kohaku Narukami', archetypes: ['Mystic'], set: 'The Feast of Hemlock Vale' },
  { name: 'Hank Samson', archetypes: ['Survivor'], set: 'The Feast of Hemlock Vale' },
  
  { name: 'Marion Tavares', archetypes: ['Guardian'], set: 'The Drowned City' },
  { name: 'Lucius Galloway', archetypes: ['Seeker'], set: 'The Drowned City' },
  { name: 'Agatha Crane', archetypes: ['Seeker', 'Mystic'], set: 'The Drowned City' },
  { name: 'Michael McGlen', archetypes: ['Rogue'], set: 'The Drowned City' },
  { name: 'Gloria Goldberg', archetypes: ['Mystic'], set: 'The Drowned City' },
  { name: 'George Barnaby', archetypes: ['Survivor'], set: 'The Drowned City' },
  
  { name: 'Nathaniel Cho', archetypes: ['Guardian'], set: 'Nathaniel Cho' },
  { name: 'Harvey Walters', archetypes: ['Seeker'], set: 'Harvey Walters' },
  { name: 'Winifred Habbamock', archetypes: ['Rogue'], set: 'Winifred Habbamock' },
  { name: 'Jacqueline Fine', archetypes: ['Mystic'], set: 'Jacqueline Fine' },
  { name: 'Stella Clark', archetypes: ['Survivor'], set: 'Stella Clark' },
  { name: 'Subject 5U-21 (Suzi)', archetypes: ['Neutral'], set: 'The Blob That Ate Everything' },
  
  { name: 'Bark Harrigan', archetypes: ['Guardian'], set: 'Barkham Horror' },
  { name: 'Kate Winthpup', archetypes: ['Seeker'], set: 'Barkham Horror' },
  { name: '"Skids" O\'Drool', archetypes: ['Rogue'], set: 'Barkham Horror' },
  { name: 'Jacqueline Canine', archetypes: ['Mystic'], set: 'Barkham Horror' },
  { name: 'Duke', archetypes: ['Survivor'], set: 'Barkham Horror' },
]

export function getInvestigatorsByArchetype(archetype: Archetype): Investigator[] {
  return INVESTIGATORS.filter(inv => inv.archetypes.includes(archetype))
}

export function getInvestigatorByName(name: string): Investigator | undefined {
  return INVESTIGATORS.find(inv => inv.name === name)
}

export function getAllInvestigatorNames(): string[] {
  return INVESTIGATORS.map(inv => inv.name).sort()
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

export function getDisplaySetName(investigatorName: string, setName: string): string {
  if (STARTER_DECK_INVESTIGATORS.includes(investigatorName)) {
    return 'Investigator Starter Deck'
  }
  return setName
}

export function getArkhamDBUrl(investigatorName: string, archetype?: Archetype): string | null {
  const investigator = getInvestigatorByName(investigatorName)
  if (investigator?.set === 'Barkham Horror') {
    return null
  }

  const slugMap: Record<string, string | Record<string, string>> = {
    'Roland Banks': '01001',
    'Daisy Walker': '01002',
    '"Skids" O\'Toole': '01003',
    'Agnes Baker': '01004',
    'Wendy Adams': '01005',
    'Zoey Samaras': '02001',
    'Rex Murphy': '02002',
    'Jenny Barnes': '02003',
    'Jim Culver': '02004',
    '"Ashcan" Pete': '02005',
    'Mark Harrigan': '03001',
    'Minh Thi Phan': '03002',
    'Sefina Rousseau': '03003',
    'Akachi Onyele': '03004',
    'William Yorick': '03005',
    'Lola Hayes': '03006',
    'Leo Anderson': '04001',
    'Ursula Downs': '04002',
    'Finn Edwards': '04003',
    'Father Mateo': '04004',
    'Calvin Wright': '04005',
    'Carolyn Fern': '05001',
    'Joe Diamond': '05002',
    'Preston Fairmont': '05003',
    'Diana Stanley': '05004',
    'Marie Lambeau': '05006',
    'Rita Young': '05005',
    'Tommy Muldoon': '06001',
    'Mandy Thompson': '06002',
    'Tony Morgan': '06003',
    'Luke Robinson': '06004',
    'Patrice Hathaway': '06005',
    'Sister Mary': '07001',
    'Amanda Sharpe': '07002',
    'Trish Scarborough': '07003',
    'Dexter Drake': '07004',
    'Silas Marsh': '07005',
    'Daniela Reyes': '08001',
    'Norman Withers': '08004',
    'Monterey Jack': '08007',
    'Lily Chen': '08010',
    'Bob Jenkins': '08016',
    'Carson Sinclair': '09001',
    'Vincent Lee': '09002',
    'Kymani Jones': '09008',
    'Amina Zidane': '09011',
    'Darrell Simmons': '09015',
    'Charlie Kane': '09018',
    'Wilson Richards': '10001',
    'Kate Winthrop': '10004',
    'Alessandra Zorzi': '10009',
    'Kohaku Narukami': '10012',
    'Hank Samson': '08007',
    'Marion Tavares': '11001',
    'Lucius Galloway': '11004',
    'Agatha Crane': {
      'Seeker': '11007',
      'Mystic': '11008'
    },
    'Michael McGlen': '11011',
    'Gloria Goldberg': '11014',
    'George Barnaby': '11017',
    'Nathaniel Cho': '60101',
    'Harvey Walters': '60201',
    'Winifred Habbamock': '60301',
    'Jacqueline Fine': '60401',
    'Stella Clark': '60501',
    'Subject 5U-21 (Suzi)': '89001'
  }
  
  const mapping = slugMap[investigatorName]
  if (!mapping) return null
  
  if (typeof mapping === 'object') {
    if (archetype && mapping[archetype]) {
      return `https://arkhamdb.com/card/${mapping[archetype]}`
    }
    if (investigatorName === 'Agatha Crane') {
      return `https://arkhamdb.com/card/${mapping['Seeker']}`
    }
    const firstCode = Object.values(mapping)[0]
    return `https://arkhamdb.com/card/${firstCode}`
  }
  
  if (typeof mapping === 'string') {
    return `https://arkhamdb.com/card/${mapping}`
  }
  
  return null
}
