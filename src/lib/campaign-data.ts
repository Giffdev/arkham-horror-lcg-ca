export interface Campaign {
  name: string
  set: string
}

export const CAMPAIGNS: Campaign[] = [
  { name: 'The Night of the Zealot', set: 'Core' },
  { name: 'The Dunwich Legacy', set: 'The Dunwich Legacy' },
  { name: 'The Path to Carcosa', set: 'The Path to Carcosa' },
  { name: 'The Forgotten Age', set: 'The Forgotten Age' },
  { name: 'The Circle Undone', set: 'The Circle Undone' },
  { name: 'The Dream-Eaters', set: 'The Dream-Eaters' },
  { name: 'The Innsmouth Conspiracy', set: 'The Innsmouth Conspiracy' },
  { name: 'Edge of the Earth', set: 'Edge of the Earth' },
  { name: 'The Scarlet Keys', set: 'The Scarlet Keys' },
  { name: 'The Feast of Hemlock Vale', set: 'The Feast of Hemlock Vale' },
  { name: 'The Drowned City', set: 'The Drowned City' },
  { name: 'Barkham Horror: The Meddling of Meowlathotep', set: 'Barkham Horror' },
  { name: 'Return to The Night of the Zealot', set: 'Return to The Night of the Zealot' },
  { name: 'Return to The Dunwich Legacy', set: 'Return to The Dunwich Legacy' },
  { name: 'Return to The Path to Carcosa', set: 'Return to The Path to Carcosa' },
  { name: 'Return to The Forgotten Age', set: 'Return to The Forgotten Age' },
  { name: 'Return to The Circle Undone', set: 'Return to The Circle Undone' },
  { name: 'Curse of the Rougarou', set: 'Stand-Alone' },
  { name: 'Carnevale of Horrors', set: 'Stand-Alone' },
  { name: 'The Labyrinths of Lunacy', set: 'Stand-Alone' },
  { name: 'Guardians of the Abyss', set: 'Stand-Alone' },
  { name: 'Murder at the Excelsior Hotel', set: 'Stand-Alone' },
  { name: 'The Blob That Ate Everything', set: 'Stand-Alone' },
  { name: 'War of the Outer Gods', set: 'Stand-Alone' },
  { name: 'Machinations Through Time', set: 'Stand-Alone' },
  { name: 'Fortune and Folly', set: 'Stand-Alone' },
  { name: 'The Midwinter Gala', set: 'Stand-Alone' },
  { name: 'Film Fatale', set: 'Stand-Alone' },
  { name: 'Against the Wendigo', set: 'Fan-Made' },
]

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

export function getAllCampaignNames(): string[] {
  const officialCampaigns = CAMPAIGNS.filter(c => c.set !== 'Fan-Made')
  
  return officialCampaigns.sort((a, b) => {
    const indexA = RELEASE_ORDER.indexOf(a.name)
    const indexB = RELEASE_ORDER.indexOf(b.name)
    
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    
    return indexA - indexB
  }).map(c => c.name)
}

export function getCampaignSet(campaignName: string): string {
  const campaign = CAMPAIGNS.find(c => c.name === campaignName)
  return campaign ? campaign.set : 'Stand-Alone'
}
