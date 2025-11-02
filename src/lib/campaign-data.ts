export interface CampaignSet {
  name: string
  campaigns: string[]
}

export const CAMPAIGN_SETS: CampaignSet[] = [
  {
    name: 'Core',
    campaigns: ['The Night of the Zealot']
  },
  {
    name: 'The Dunwich Legacy',
    campaigns: ['The Dunwich Legacy']
  },
  {
    name: 'The Path to Carcosa',
    campaigns: ['The Path to Carcosa']
  },
  {
    name: 'The Forgotten Age',
    campaigns: ['The Forgotten Age']
  },
  {
    name: 'The Circle Undone',
    campaigns: ['The Circle Undone']
  },
  {
    name: 'The Dream-Eaters',
    campaigns: ['The Dream-Eaters']
  },
  {
    name: 'The Innsmouth Conspiracy',
    campaigns: ['The Innsmouth Conspiracy']
  },
  {
    name: 'Edge of the Earth',
    campaigns: ['Edge of the Earth']
  },
  {
    name: 'The Scarlet Keys',
    campaigns: ['The Scarlet Keys']
  },
  {
    name: 'The Feast of Hemlock Vale',
    campaigns: ['The Feast of Hemlock Vale']
  },
  {
    name: 'The Drowned City',
    campaigns: ['The Drowned City']
  },
  {
    name: 'Stand-Alone',
    campaigns: [
      'Nathaniel Cho',
      'Harvey Walters',
      'Winifred Habbamock',
      'Jacqueline Fine',
      'Stella Clark',
      'Subject 5U-21 (Suzi)'
    ]
  },
  {
    name: 'Barkham Horror',
    campaigns: ['Barkham Horror: The Meddling of Meowlathotep']
  },
  {
    name: 'Return to The Night of the Zealot',
    campaigns: ['Return to The Night of the Zealot']
  },
  {
    name: 'Return to The Dunwich Legacy',
    campaigns: ['Return to The Dunwich Legacy']
  },
  {
    name: 'Return to The Path to Carcosa',
    campaigns: ['Return to The Path to Carcosa']
  },
  {
    name: 'Return to The Forgotten Age',
    campaigns: ['Return to The Forgotten Age']
  },
  {
    name: 'Return to The Circle Undone',
    campaigns: [
      'Return to The Circle Undone',
      'Curse of the Rougarou',
      'Carnevale of Horrors',
      'The Labyrinths of Lunacy',
      'Guardians of the Abyss',
      'Murder at the Excelsior Hotel',
      'The Blob That Ate Everything',
      'War of the Outer Gods',
      'Machinations Through Time',
      'Fortune and Folly',
      'The Midwinter Gala',
      'Film Fatale'
    ]
  }
]

export const SET_NAMES = CAMPAIGN_SETS.map(set => set.name)

export function getCampaignsForSet(setName: string): string[] {
  const set = CAMPAIGN_SETS.find(s => s.name === setName)
  return set ? set.campaigns : []
}
