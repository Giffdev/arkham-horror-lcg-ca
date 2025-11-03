import { Playthrough } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { ArchetypeBadge } from './ArchetypeBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PencilSimple, Trash, Clock, UsersThree, Sparkle } from '@phosphor-icons/react'
import { formatDate } from '@/lib/date-utils'

interface PlaythroughCardProps {
  playthrough: Playthrough
  onEdit: (playthrough: Playthrough) => void
  onDelete: (id: string) => void
}

export function PlaythroughCard({ playthrough, onEdit, onDelete }: PlaythroughCardProps) {
  const displayName = playthrough.campaignType === 'Fan-Made' 
    ? playthrough.customCampaignName || playthrough.campaignName
    : playthrough.campaignType === 'Unknown'
      ? 'Unknown Campaign'
      : playthrough.campaignName

  return (
    <Card className="p-6 hover:border-accent transition-all duration-200 hover:shadow-lg group">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-semibold mb-1 truncate">
              {displayName || 'Untitled Campaign'}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock size={16} weight="duotone" />
                <span>{formatDate(playthrough.date)}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {playthrough.campaignType}
              </Badge>
              {playthrough.campaignSet && (
                <Badge variant="outline" className="text-xs">
                  {playthrough.campaignSet}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(playthrough)}
              className="h-8 w-8"
            >
              <PencilSimple size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(playthrough.id)}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash size={18} />
            </Button>
          </div>
        </div>

        {playthrough.sideStories && playthrough.sideStories.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <Sparkle size={16} weight="duotone" />
              <span>Side Stories</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {playthrough.sideStories.map((story) => (
                <Badge key={story} variant="outline" className="text-xs">
                  {story}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {playthrough.investigators.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <UsersThree size={16} weight="duotone" />
              <span>Investigators</span>
            </div>
            <div className="space-y-2">
              {playthrough.investigators.map((inv, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <ArchetypeBadge archetype={inv.archetype} />
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {inv.isUnknown || inv.investigatorName === 'Unknown' ? 'Unknown' : inv.investigatorName}
                    </span>
                    {inv.investigatorSet && (
                      <Badge variant="outline" className="text-xs">
                        {inv.investigatorSet}
                      </Badge>
                    )}
                    {inv.playerName && (
                      <span className="text-muted-foreground">
                        ({inv.playerName})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
