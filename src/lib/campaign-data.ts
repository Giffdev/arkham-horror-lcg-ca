export interface Campaign {
  name: string
  set: string
  type: 'Full Campaign' | 'Standalone'
}

export const FULL_CAMPAIGNS: Campaign[] = [
  { name: 'The Night of the Zealot', set: 'Core', type: 'Full Campaign' },
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
  { name: 'Return to The Night of the Zealot', set: 'Return to The Night of the Zealot', type: 'Full Campaign' },
  { name: 'Return to The Dunwich Legacy', set: 'Return to The Dunwich Legacy', type: 'Full Campaign' },
  { name: 'Return to The Path to Carcosa', set: 'Return to The Path to Carcosa', type: 'Full Campaign' },
  { name: 'Return to The Forgotten Age', set: 'Return to The Forgotten Age', type: 'Full Campaign' },
  { name: 'Return to The Circle Undone', set: 'Return to The Circle Undone', type: 'Full Campaign' },
  { name: 'Barkham Horror: The Meddling of Meowlathotep', set: 'Barkham Horror', type: 'Full Campaign' },
]

export const STANDALONE_SCENARIOS: Campaign[] = [
  { name: 'Curse of the Rougarou', set: 'Standalone', type: 'Standalone' },
  { name: 'Carnevale of Horrors', set: 'Standalone', type: 'Standalone' },
  { name: 'The Labyrinths of Lunacy', set: 'Standalone', type: 'Standalone' },
  { name: 'Guardians of the Abyss', set: 'Standalone', type: 'Standalone' },
  { name: 'Murder at the Excelsior Hotel', set: 'Standalone', type: 'Standalone' },
  { name: 'The Blob That Ate Everything', set: 'Standalone', type: 'Standalone' },
  { name: 'War of the Outer Gods', set: 'Standalone', type: 'Standalone' },
  { name: 'Machinations Through Time', set: 'Standalone', type: 'Standalone' },
  { name: 'Fortune and Folly', set: 'Standalone', type: 'Standalone' },
  { name: 'The Midwinter Gala', set: 'Standalone', type: 'Standalone' },
  { name: 'Film Fatale', set: 'Standalone', type: 'Standalone' },
]

export const ALL_CAMPAIGNS = [...FULL_CAMPAIGNS, ...STANDALONE_SCENARIOS]

const RELEASE_ORDER = [
  'The Night of the Zealot',
  'Curse of the Rougarou',
  'The Dunwich Legacy',
  'Carnevale of Horrors',
  'The Path to Carcosa',
  'The Labyrinths of Lunacy',
  'The Forgotten Age',
  'The Circle Undone',
  'Return to The Night of the Zealot',
  'Return to The Dunwich Legacy',
  'The Dream-Eaters',
  'Murder at the Excelsior Hotel',
  'Return to The Path to Carcosa',
  'The Innsmouth Conspiracy',
  'Return to The Forgotten Age',
  'The Blob That Ate Everything',
  'Edge of the Earth',
  'Return to The Circle Undone',
  'The Scarlet Keys',
  'War of the Outer Gods',
  'Machinations Through Time',
  'The Feast of Hemlock Vale',
  'Fortune and Folly',
  'The Midwinter Gala',
  'The Drowned City',
  'Film Fatale',
  'Guardians of the Abyss',
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

export function getStandaloneCampaignNames(): string[] {
  return STANDALONE_SCENARIOS.sort((a, b) => {
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
  return campaign ? campaign.set : 'Standalone'
}
