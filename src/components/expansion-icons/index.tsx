import { CoreIcon } from './CoreIcon'
import { DunwichIcon } from './DunwichIcon'
import { CarcosaIcon } from './CarcosaIcon'
import { ForgottenAgeIcon } from './ForgottenAgeIcon'
import { CircleUndoneIcon } from './CircleUndoneIcon'
import { DreamEatersIcon } from './DreamEatersIcon'
import { InnsmouthIcon } from './InnsmouthIcon'
import { EdgeOfEarthIcon } from './EdgeOfEarthIcon'
import { ScarletKeysIcon } from './ScarletKeysIcon'
import { HemlockValeIcon } from './HemlockValeIcon'
import { DrownedCityIcon } from './DrownedCityIcon'
import { BarkhamIcon } from './BarkhamIcon'
import { StandaloneIcon } from './StandaloneIcon'

interface ExpansionIconProps {
  campaignSet: string
  size?: number
  className?: string
}

export function getExpansionIcon(campaignSet: string): React.ComponentType<{ size?: number; className?: string }> {
  const setLower = campaignSet.toLowerCase()
  
  if (setLower.includes('core')) return CoreIcon
  if (setLower.includes('dunwich')) return DunwichIcon
  if (setLower.includes('carcosa')) return CarcosaIcon
  if (setLower.includes('forgotten age')) return ForgottenAgeIcon
  if (setLower.includes('circle undone')) return CircleUndoneIcon
  if (setLower.includes('dream-eaters') || setLower.includes('dream eaters')) return DreamEatersIcon
  if (setLower.includes('innsmouth')) return InnsmouthIcon
  if (setLower.includes('edge of the earth')) return EdgeOfEarthIcon
  if (setLower.includes('scarlet keys')) return ScarletKeysIcon
  if (setLower.includes('hemlock vale')) return HemlockValeIcon
  if (setLower.includes('drowned city')) return DrownedCityIcon
  if (setLower.includes('barkham')) return BarkhamIcon
  
  return StandaloneIcon
}

export function ExpansionIcon({ campaignSet, size = 24, className = '' }: ExpansionIconProps) {
  const IconComponent = getExpansionIcon(campaignSet)
  
  return <IconComponent size={size} className={className} />
}

export {
  CoreIcon,
  DunwichIcon,
  CarcosaIcon,
  ForgottenAgeIcon,
  CircleUndoneIcon,
  DreamEatersIcon,
  InnsmouthIcon,
  EdgeOfEarthIcon,
  ScarletKeysIcon,
  HemlockValeIcon,
  DrownedCityIcon,
  BarkhamIcon,
  StandaloneIcon,
}
