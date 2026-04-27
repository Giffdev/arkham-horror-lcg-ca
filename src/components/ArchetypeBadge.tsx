import { Archetype, ARCHETYPE_COLORS } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getArkhamDBUrl, getArkhamDBUrlById } from '@/lib/investigator-data'

interface ArchetypeBadgeProps {
  archetype: Archetype
  className?: string
  investigatorName?: string
  investigatorId?: string
  chapter?: 1 | 2
}

export function ArchetypeBadge({ archetype, className, investigatorName, investigatorId, chapter }: ArchetypeBadgeProps) {
  const url = investigatorId 
    ? getArkhamDBUrlById(investigatorId, archetype)
    : investigatorName 
      ? getArkhamDBUrl(investigatorName, archetype, chapter) 
      : null
  
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
          className={cn(ARCHETYPE_COLORS[archetype], 'cursor-pointer hover:opacity-80 transition-opacity', className)}
        >
          {archetype}
        </Badge>
      </a>
    )
  }
  
  return (
    <Badge 
      variant="outline" 
      className={cn(ARCHETYPE_COLORS[archetype], className)}
    >
      {archetype}
    </Badge>
  )
}
