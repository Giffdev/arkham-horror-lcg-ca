export interface Campaign {
  name: string
  set: string
  type: 'Full Campaign' | 'Small Campaign' | 'Scenario Pack'
}

export const FULL_CAMPAIGNS: Campaign[] = [
  { name: 'The Dunwich Legacy', set: 'The Dunwich Legacy', type: 'Full Campaign' },
  { name: 'The Path to Carcosa', set: 'The Path to Carcosa', type: 'Full Campaign' },
  { name: 'The Forgotten Age', set: 'The Forgotten Age', type: 'Full Campaign' },
  { name: 'The Circle Undone', set: 'The Circle Undone', type: 'Full Campaign' },
  { name: 'The Dream-Eaters', set: 'The Dream-Eaters', type: 'Full Campaign' },
  { name: 'The Innsmouth Conspiracy', set: 'The Innsmouth Conspiracy', type: 'Full Campaign' },
  { name: 'Edge of the Earth', set: 'Edge of the Earth', type: 'Full Campaign' },
  { name: 'The Scarlet Keys', set: 'The Scarlet Keys', type: 'Full Campaign' },
  { name: 'The Feast of Hemlock Vale', set: 'The Feast of Hemlock Vale', type: 'Full Campaign' },
  { name: 'The Drowned City', set: 'The Drowned City', type: 'Full Campaign' },
  { name: 'Return to The Dunwich Legacy', set: 'Return to The Dunwich Legacy', type: 'Full Campaign' },
  { name: 'Return to The Path to Carcosa', set: 'Return to The Path to Carcosa', type: 'Full Campaign' },
  { name: 'Return to The Forgotten Age', set: 'Return to The Forgotten Age', type: 'Full Campaign' },
  { name: 'Return to The Circle Undone', set: 'Return to The Circle Undone', type: 'Full Campaign' },
]

export const SMALL_CAMPAIGNS: Campaign[] = [
  { name: 'The Night of the Zealot', set: 'Core', type: 'Small Campaign' },
  { name: 'Return to The Night of the Zealot', set: 'Return to The Night of the Zealot', type: 'Small Campaign' },
  { name: 'Children of Blood', set: 'Children of Blood', type: 'Small Campaign' },
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
  { name: 'The Midwinter Gala', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'Film Fatale', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'Traces To Nowhere', set: 'Scenario Pack', type: 'Scenario Pack' },
  { name: 'Barkham Horror: The Meddling of Meowlathotep', set: 'Barkham Horror', type: 'Scenario Pack' },
]

export const ALL_CAMPAIGNS = [...FULL_CAMPAIGNS, ...SMALL_CAMPAIGNS, ...SCENARIO_PACK_SCENARIOS]

const RELEASE_ORDER = [
  'The Night of the Zealot',
  'Curse of the Rougarou',
  'The Dunwich Legacy',
  'Carnevale of Horrors',
  'The Path to Carcosa',
  'The Labyrinths of Lunacy',
  'The Forgotten Age',
  'The Circle Undone',
  'The Dream-Eaters',
  'Murder at the Excelsior Hotel',
  'The Innsmouth Conspiracy',
  'The Blob That Ate Everything',
  'Edge of the Earth',
  'The Scarlet Keys',
  'War of the Outer Gods',
  'Machinations Through Time',
  'The Feast of Hemlock Vale',
  'Fortune and Folly',
  'The Midwinter Gala',
  'The Drowned City',
  'Film Fatale',
  'Guardians of the Abyss',
  'Return to The Night of the Zealot',
  'Return to The Dunwich Legacy',
  'Return to The Path to Carcosa',
  'Return to The Forgotten Age',
  'Return to The Circle Undone',
  'Barkham Horror: The Meddling of Meowlathotep',
]

export function getFullCampaignNames(): string[] {
  return FULL_CAMPAIGNS.sort((a, b) => {
    const indexA = RELEASE_ORDER.indexOf(a.name)
    const indexB = RELEASE_ORDER.indexOf(b.name)
    
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    
    return indexA - indexB
  }).map(c => c.name)
}

export function getSmallCampaignNames(): string[] {
  return SMALL_CAMPAIGNS.sort((a, b) => {
    const indexA = RELEASE_ORDER.indexOf(a.name)
    const indexB = RELEASE_ORDER.indexOf(b.name)
    
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    
    return indexA - indexB
  }).map(c => c.name)
}

export function getScenarioPackCampaignNames(): string[] {
  return SCENARIO_PACK_SCENARIOS.sort((a, b) => {
    const indexA = RELEASE_ORDER.indexOf(a.name)
    const indexB = RELEASE_ORDER.indexOf(b.name)
    
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    
    return indexA - indexB
  }).map(c => c.name)
}

export function getCampaignSet(campaignName: string): string {
  const campaign = ALL_CAMPAIGNS.find(c => c.name === campaignName)
  return campaign ? campaign.set : 'Scenario Pack'
}
