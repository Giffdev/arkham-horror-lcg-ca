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
  
  { name: 'Nathaniel Cho', archetypes: ['Guardian'], set: 'Stand-Alone' },
  { name: 'Harvey Walters', archetypes: ['Seeker'], set: 'Stand-Alone' },
  { name: 'Winifred Habbamock', archetypes: ['Rogue'], set: 'Stand-Alone' },
  { name: 'Jacqueline Fine', archetypes: ['Mystic'], set: 'Stand-Alone' },
  { name: 'Stella Clark', archetypes: ['Survivor'], set: 'Stand-Alone' },
  { name: 'Subject 5U-21 (Suzi)', archetypes: ['Neutral'], set: 'Stand-Alone' },
  
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
