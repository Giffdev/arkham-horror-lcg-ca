import { Playthrough, Archetype } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { ArchetypeBadge } from './ArchetypeBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PencilSimple, Trash, Clock, UsersThree, Sparkle } from '@phosphor-icons/react'
import { formatDate } from '@/lib/date-utils'
import { getDisplaySetName, getArkhamDBUrl } from '@/lib/investigator-data'

interface PlaythroughCardProps {
  playthrough: Playthrough
  onEdit: (playthrough: Playthrough) => void
  onDelete: (id: string) => void
  activeArchetypeFilters?: Archetype[]
}

export function PlaythroughCard({ playthrough, onEdit, onDelete, activeArchetypeFilters = [] }: PlaythroughCardProps) {
  const displayName = playthrough.campaignType === 'Fan-Made' 
    ? playthrough.customCampaignName || playthrough.campaignName
    : playthrough.campaignType === 'Unknown'
      ? 'Unknown Campaign'
      : playthrough.campaignName

  const displaySetName = playthrough.campaignType === 'Standalone'
    ? playthrough.campaignName
    : playthrough.campaignSet

  const isDreamEaters = playthrough.campaignName === 'The Dream-Eaters'

  return (
    <Card className="p-4 md:p-6 hover:border-accent transition-all duration-200 hover:shadow-lg group">
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:items-start">
        <div className="flex items-start justify-between gap-4 md:min-w-[320px] md:flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg md:text-xl font-semibold mb-1 truncate">
              {displayName || 'Untitled Campaign'}
            </h3>
            <div className="flex md:hidden flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock size={16} weight="duotone" />
                <span>{formatDate(playthrough.date)}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {playthrough.campaignType}
              </Badge>
              {displaySetName && (
                <Badge variant="outline" className="text-xs">
                  {displaySetName}
                </Badge>
              )}
            </div>
            {playthrough.sideStories && playthrough.sideStories.length > 0 && (
              <div className="mt-2 md:hidden flex items-start gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide flex-shrink-0">
                  <Sparkle size={14} weight="duotone" />
                  <span>Side Stories:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {playthrough.sideStories.map((story) => (
                    <Badge key={story} variant="outline" className="text-xs">
                      {story}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="hidden md:flex flex-wrap items-center gap-2 text-sm mb-1">
              <Badge variant="secondary" className="text-xs">
                {playthrough.campaignType}
              </Badge>
              {displaySetName && (
                <Badge variant="outline" className="text-xs">
                  {displaySetName}
                </Badge>
              )}
            </div>
            <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
              <Clock size={16} weight="duotone" />
              <span>{formatDate(playthrough.date)}</span>
            </div>
            {playthrough.sideStories && playthrough.sideStories.length > 0 && (
              <div className="mt-3 hidden md:flex items-start gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide flex-shrink-0">
                  <Sparkle size={14} weight="duotone" />
                  <span>Side Stories:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {playthrough.sideStories.map((story) => (
                    <Badge key={story} variant="outline" className="text-xs">
                      {story}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity md:hidden">
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

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {playthrough.investigators.length > 0 && (
            <>
              {isDreamEaters ? (
                <div className="space-y-4">
                  {(() => {
                    const pathAInvestigators = playthrough.investigators.filter(
                      inv => inv.dreamEatersPath === 'A: The Dream-Quest'
                    )
                    const pathBInvestigators = playthrough.investigators.filter(
                      inv => inv.dreamEatersPath === 'B: The Web of Dreams'
                    )
                    const noPathInvestigators = playthrough.investigators.filter(
                      inv => !inv.dreamEatersPath
                    )

                    return (
                      <>
                        {pathAInvestigators.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs font-semibold">
                                Campaign A: The Dream-Quest
                              </Badge>
                            </div>
                            <div className="space-y-2.5">
                              {pathAInvestigators.map((inv, idx) => {
                                const chosenArchetype = inv.archetype
                                const defaultUrl = getArkhamDBUrl(inv.investigatorName)
                                
                                return (
                                  <div key={idx} className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3 text-sm">
                                    <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-1.5 md:gap-2 min-w-0 md:min-w-[280px]">
                                      <div className="flex items-center gap-2">
                                        <ArchetypeBadge 
                                          archetype={chosenArchetype}
                                          investigatorName={inv.investigatorName}
                                        />
                                        {defaultUrl && !inv.isUnknown && inv.investigatorName !== 'Unknown' ? (
                                          <a 
                                            href={defaultUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium hover:underline hover:text-accent transition-colors"
                                          >
                                            {inv.investigatorName}
                                          </a>
                                        ) : (
                                          <span className="font-medium">
                                            {inv.isUnknown || inv.investigatorName === 'Unknown' ? 'Unknown' : inv.investigatorName}
                                          </span>
                                        )}
                                      </div>
                                      {inv.investigatorSet && !inv.isUnknown && inv.investigatorName !== 'Unknown' && (
                                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                                          {getDisplaySetName(inv.investigatorName, inv.investigatorSet)}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 md:ml-auto">
                                      {inv.playerName && (
                                        <span className="text-muted-foreground whitespace-nowrap">
                                          {inv.playerName}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        
                        {pathBInvestigators.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs font-semibold">
                                Campaign B: The Web of Dreams
                              </Badge>
                            </div>
                            <div className="space-y-2.5">
                              {pathBInvestigators.map((inv, idx) => {
                                const chosenArchetype = inv.archetype
                                const defaultUrl = getArkhamDBUrl(inv.investigatorName)
                                
                                return (
                                  <div key={idx} className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3 text-sm">
                                    <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-1.5 md:gap-2 min-w-0 md:min-w-[280px]">
                                      <div className="flex items-center gap-2">
                                        <ArchetypeBadge 
                                          archetype={chosenArchetype}
                                          investigatorName={inv.investigatorName}
                                        />
                                        {defaultUrl && !inv.isUnknown && inv.investigatorName !== 'Unknown' ? (
                                          <a 
                                            href={defaultUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium hover:underline hover:text-accent transition-colors"
                                          >
                                            {inv.investigatorName}
                                          </a>
                                        ) : (
                                          <span className="font-medium">
                                            {inv.isUnknown || inv.investigatorName === 'Unknown' ? 'Unknown' : inv.investigatorName}
                                          </span>
                                        )}
                                      </div>
                                      {inv.investigatorSet && !inv.isUnknown && inv.investigatorName !== 'Unknown' && (
                                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                                          {getDisplaySetName(inv.investigatorName, inv.investigatorSet)}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 md:ml-auto">
                                      {inv.playerName && (
                                        <span className="text-muted-foreground whitespace-nowrap">
                                          {inv.playerName}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {noPathInvestigators.length > 0 && (
                          <div className="space-y-2.5">
                            {noPathInvestigators.map((inv, idx) => {
                              const chosenArchetype = inv.archetype
                              const defaultUrl = getArkhamDBUrl(inv.investigatorName)
                              
                              return (
                                <div key={idx} className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3 text-sm">
                                  <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-1.5 md:gap-2 min-w-0 md:min-w-[280px]">
                                    <div className="flex items-center gap-2">
                                      <ArchetypeBadge 
                                        archetype={chosenArchetype}
                                        investigatorName={inv.investigatorName}
                                      />
                                      {defaultUrl && !inv.isUnknown && inv.investigatorName !== 'Unknown' ? (
                                        <a 
                                          href={defaultUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-medium hover:underline hover:text-accent transition-colors"
                                        >
                                          {inv.investigatorName}
                                        </a>
                                      ) : (
                                        <span className="font-medium">
                                          {inv.isUnknown || inv.investigatorName === 'Unknown' ? 'Unknown' : inv.investigatorName}
                                        </span>
                                      )}
                                    </div>
                                    {inv.investigatorSet && !inv.isUnknown && inv.investigatorName !== 'Unknown' && (
                                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                                        {getDisplaySetName(inv.investigatorName, inv.investigatorSet)}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0 md:ml-auto">
                                    {inv.playerName && (
                                      <span className="text-muted-foreground whitespace-nowrap">
                                        {inv.playerName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {playthrough.investigators.map((inv, idx) => {
                    const chosenArchetype = inv.archetype
                    const defaultUrl = getArkhamDBUrl(inv.investigatorName)
                    
                    return (
                      <div key={idx} className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3 text-sm">
                        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-1.5 md:gap-2 min-w-0 md:min-w-[280px]">
                          <div className="flex items-center gap-2">
                            <ArchetypeBadge 
                              archetype={chosenArchetype}
                              investigatorName={inv.investigatorName}
                            />
                            {defaultUrl && !inv.isUnknown && inv.investigatorName !== 'Unknown' ? (
                              <a 
                                href={defaultUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium hover:underline hover:text-accent transition-colors"
                              >
                                {inv.investigatorName}
                              </a>
                            ) : (
                              <span className="font-medium">
                                {inv.isUnknown || inv.investigatorName === 'Unknown' ? 'Unknown' : inv.investigatorName}
                              </span>
                            )}
                          </div>
                          {inv.investigatorSet && !inv.isUnknown && inv.investigatorName !== 'Unknown' && (
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {getDisplaySetName(inv.investigatorName, inv.investigatorSet)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 md:ml-auto">
                          {inv.playerName && (
                            <span className="text-muted-foreground whitespace-nowrap">
                              {inv.playerName}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="hidden md:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
    </Card>
  )
}
