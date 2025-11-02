export type Archetype = 'Guardian' | 'Survivor' | 'Seeker' | 'Rogue' | 'Mystic' | 'Neutral'

export type CampaignType = 'Full Campaign' | 'Standalone' | 'Fan-Made'

export interface InvestigatorAssignment {
  playerName: string
  investigatorName: string
  archetype: Archetype
}

export interface Playthrough {
  id: string
  date: string
  campaignSet?: string
  campaignName: string
  campaignType: CampaignType
  customCampaignName?: string
  investigators: InvestigatorAssignment[]
}

export const ARCHETYPES: Archetype[] = ['Guardian', 'Survivor', 'Seeker', 'Rogue', 'Mystic', 'Neutral']

export const CAMPAIGN_TYPES: CampaignType[] = ['Full Campaign', 'Standalone', 'Fan-Made']

export const ARCHETYPE_COLORS: Record<Archetype, string> = {
  'Guardian': 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  'Seeker': 'bg-orange-500/10 text-orange-700 border-orange-500/30',
  'Rogue': 'bg-green-500/10 text-green-700 border-green-500/30',
  'Mystic': 'bg-purple-500/10 text-purple-700 border-purple-500/30',
  'Survivor': 'bg-red-500/10 text-red-700 border-red-500/30',
  'Neutral': 'bg-gray-500/10 text-gray-700 border-gray-500/30',
}
