import { Archetype, ARCHETYPE_COLORS } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getArkhamDBUrl, getArkhamDBUrlById, resolveInvestigator } from '@/lib/investigator-data'
import { CampaignSvgIcon } from '@/components/CampaignSvgIcon'
import { hasDedicatedCampaignIcon } from '@/lib/campaign-icon-map'

interface ArchetypeBadgeProps {
  archetype: Archetype
  className?: string
  investigatorName?: string
  investigatorId?: string
  investigatorSet?: string
  chapter?: 1 | 2
}

/** Small decorative faction glyph — aria-hidden, uses registry faction icon if confirmed. */
function FactionGlyph({ archetype }: { archetype: Archetype }) {
  if (!hasDedicatedCampaignIcon(archetype)) return null
  return (
    <CampaignSvgIcon
      campaignSet={archetype}
      size={11}
      aria-hidden="true"
      className="inline-flex flex-shrink-0 opacity-80 text-current"
    />
  )
}

export function ArchetypeBadge({ archetype, className, investigatorName, investigatorId, investigatorSet, chapter }: ArchetypeBadgeProps) {
  const resolved = investigatorName
    ? resolveInvestigator({ investigatorId, investigatorName, chapter, investigatorSet })
    : undefined
  const url = resolved
    ? getArkhamDBUrlById(resolved.id, archetype)
    : investigatorId 
      ? getArkhamDBUrlById(investigatorId, archetype)
    : investigatorName 
      ? getArkhamDBUrl(investigatorName, archetype, chapter) 
      : null
  
  const badgeContent = (
    <>
      <FactionGlyph archetype={archetype} />
      {archetype}
    </>
  )

  if (url) {
    return (
      <a 
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-block"
      >
        <Badge 
          variant="outline" 
          className={cn(ARCHETYPE_COLORS[archetype], 'cursor-pointer hover:opacity-80 transition-opacity gap-1', className)}
        >
          {badgeContent}
        </Badge>
      </a>
    )
  }
  
  return (
    <Badge 
      variant="outline" 
      className={cn(ARCHETYPE_COLORS[archetype], 'gap-1', className)}
    >
      {badgeContent}
    </Badge>
  )
}
