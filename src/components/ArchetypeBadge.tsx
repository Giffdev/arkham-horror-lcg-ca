import { Archetype, ARCHETYPE_COLORS } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getArkhamDBUrl } from '@/lib/investigator-data'

interface ArchetypeBadgeProps {
  archetype: Archetype
  className?: string
  investigatorName?: string
}

export function ArchetypeBadge({ archetype, className, investigatorName }: ArchetypeBadgeProps) {
  const url = investigatorName ? getArkhamDBUrl(investigatorName, archetype) : null
  
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
