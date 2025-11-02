import { Archetype, ARCHETYPE_COLORS } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ArchetypeBadgeProps {
  archetype: Archetype
  className?: string
}

export function ArchetypeBadge({ archetype, className }: ArchetypeBadgeProps) {
  return (
    <Badge 
      variant="outline" 
      className={cn(ARCHETYPE_COLORS[archetype], className)}
    >
      {archetype}
    </Badge>
  )
}
