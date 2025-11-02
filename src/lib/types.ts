export type Archetype = 'Guardian' | 'Survivor' | 'Seeker' | 'Rogue' | 'Mystic' | 'Neutral'

export type CampaignType = 'Official Campaign' | 'Side Story' | 'Fan-Made'

export interface InvestigatorAssignment {
  playerName: string
  investigatorName: string
  archetype: Archetype
}

export interface Playthrough {
  id: string
  date: string
  campaignName?: string
  campaignType?: CampaignType
  investigators: InvestigatorAssignment[]
}

export const ARCHETYPES: Archetype[] = ['Guardian', 'Survivor', 'Seeker', 'Rogue', 'Mystic', 'Neutral']

export const CAMPAIGN_TYPES: CampaignType[] = ['Official Campaign', 'Side Story', 'Fan-Made']

export const ARCHETYPE_COLORS: Record<Archetype, string> = {
  'Guardian': 'bg-red-100 text-red-800 border-red-300',
  'Seeker': 'bg-orange-100 text-orange-800 border-orange-300',
  'Rogue': 'bg-green-100 text-green-800 border-green-300',
  'Mystic': 'bg-purple-100 text-purple-800 border-purple-300',
  'Survivor': 'bg-blue-100 text-blue-800 border-blue-300',
  'Neutral': 'bg-gray-100 text-gray-800 border-gray-300',
}
