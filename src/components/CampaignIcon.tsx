import { Star, Ghost, Skull, Sword, Infinity, Cat, Eye, Snowflake, Buildings, Compass, Key, Grains, Waves, Flask, Church, Moon, Mountains } from '@phosphor-icons/react'

interface CampaignIconProps {
  campaignSet: string
  size?: number
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
  className?: string
}

export function getCampaignIcon(campaignSet: string): React.ComponentType<any> {
  const setLower = campaignSet.toLowerCase()
  
  if (setLower.includes('core')) return Star
  if (setLower.includes('dunwich')) return Buildings
  if (setLower.includes('carcosa')) return Moon
  if (setLower.includes('forgotten age')) return Mountains
  if (setLower.includes('circle undone')) return Church
  if (setLower.includes('dream-eaters')) return Eye
  if (setLower.includes('innsmouth')) return Waves
  if (setLower.includes('edge of the earth')) return Snowflake
  if (setLower.includes('scarlet keys')) return Key
  if (setLower.includes('hemlock vale')) return Grains
  if (setLower.includes('drowned city')) return Compass
  if (setLower.includes('barkham')) return Cat
  if (setLower.includes('standalone')) return Skull
  
  return Ghost
}

export function CampaignIcon({ campaignSet, size = 16, weight = 'duotone', className = '' }: CampaignIconProps) {
  const IconComponent = getCampaignIcon(campaignSet)
  
  return <IconComponent size={size} weight={weight} className={className} />
}
