export type Archetype = 'Guardian' | 'Survivor' | 'Seeker' | 'Rogue' | 'Mystic' | 'Neutral' | 'Unknown'

export type CampaignType = 'Full Campaign' | 'Standalone' | 'Fan-Made'

export interface InvestigatorAssignment {
  playerName: string
  investigatorName: string
  archetype: Archetype
  isUnknown?: boolean
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

export const ARCHETYPES: Archetype[] = ['Guardian', 'Survivor', 'Seeker', 'Rogue', 'Mystic', 'Neutral', 'Unknown']

export const CAMPAIGN_TYPES: CampaignType[] = ['Full Campaign', 'Standalone', 'Fan-Made']

export const ARCHETYPE_COLORS: Record<Archetype, string> = {
  'Guardian': 'bg-guardian-bg text-guardian-text border-guardian-border',
  'Seeker': 'bg-seeker-bg text-seeker-text border-seeker-border',
  'Rogue': 'bg-rogue-bg text-rogue-text border-rogue-border',
  'Mystic': 'bg-mystic-bg text-mystic-text border-mystic-border',
  'Survivor': 'bg-survivor-bg text-survivor-text border-survivor-border',
  'Neutral': 'bg-neutral-bg text-neutral-text border-neutral-border',
  'Unknown': 'bg-muted text-muted-foreground border-border',
}
