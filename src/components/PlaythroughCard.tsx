import { memo } from 'react'
import { Playthrough, Archetype } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { ArchetypeBadge } from './ArchetypeBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PencilSimple, Trash, Clock, UsersThree, Sparkle, Notepad } from '@phosphor-icons/react'
import { formatDate } from '@/lib/date-utils'
import { getDisplaySetName, getArkhamDBUrl, getArkhamDBUrlById, resolveInvestigator, getChapterBadgeLabel, isChapterBadgeSpecial } from '@/lib/investigator-data'
import type { InvestigatorAssignment } from '@/lib/types'
import { CampaignSvgIcon } from './CampaignSvgIcon'
import { hasDedicatedCampaignIcon } from '@/lib/campaign-icon-map'

/**
 * InvestigatorDisplay renders two sibling elements so the parent grid
 * (grid-cols-[max-content_1fr]) can align badges and names across all rows.
 * The fragment children flow into col-1 (badge) and col-2 (name/metadata).
 */
function InvestigatorDisplay({ inv }: { inv: InvestigatorAssignment }) {
  const resolved = resolveInvestigator(inv)
  const chosenArchetype = inv.archetype
  const displayChapter = resolved?.chapter ?? inv.chapter ?? 1
  const defaultUrl = resolved
    ? getArkhamDBUrlById(resolved.id, chosenArchetype)
    : getArkhamDBUrl(inv.investigatorName, chosenArchetype, displayChapter)
  const showChapterBadge = !inv.isUnknown && inv.investigatorName !== 'Unknown'

  return (
    <>
      {/* Grid col 1: archetype badge — consistent width across all rows */}
      <div className="flex items-center pt-0.5 flex-shrink-0">
        <ArchetypeBadge
          archetype={chosenArchetype}
          investigatorId={resolved?.id ?? inv.investigatorId}
          investigatorName={inv.investigatorName}
          investigatorSet={resolved?.set ?? inv.investigatorSet}
          chapter={resolved?.chapter ?? inv.chapter}
        />
      </div>
      {/* Grid col 2: name, chapter/set badges, player — takes remaining width */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 text-sm">
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
        {showChapterBadge && (
          <span className={`text-xs font-medium ${
            isChapterBadgeSpecial({ set: resolved?.set, chapter: displayChapter })
              ? 'text-violet-400'
              : 'text-muted-foreground opacity-60'
          }`}>
            · {getChapterBadgeLabel({ set: resolved?.set, chapter: displayChapter })}
          </span>
        )}
        {inv.investigatorSet && !inv.isUnknown && inv.investigatorName !== 'Unknown' && (
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {getDisplaySetName(inv.investigatorName, inv.investigatorSet)}
          </Badge>
        )}
        {inv.playerName && (
          <span className="text-muted-foreground truncate">
            {inv.playerName}
          </span>
        )}
      </div>
    </>
  )
}

/** Shared grid wrapper for investigator rows — aligns badges in col 1, names in col 2. */
function InvestigatorGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid items-start gap-x-3 gap-y-2.5"
      style={{ gridTemplateColumns: 'max-content 1fr' }}
    >
      {children}
    </div>
  )
}

interface PlaythroughCardProps {
  playthrough: Playthrough
  onEdit: (playthrough: Playthrough) => void
  onDelete: (id: string) => void
  activeArchetypeFilters?: Archetype[]
}

export const PlaythroughCard = memo(function PlaythroughCard({ playthrough, onEdit, onDelete, activeArchetypeFilters = [] }: PlaythroughCardProps) {
  const displayName = playthrough.campaignType === 'Fan-Made' 
    ? playthrough.customCampaignName || playthrough.campaignName
    : playthrough.campaignType === 'Unknown'
      ? 'Unknown Campaign'
      : playthrough.campaignName

  const isDreamEaters = playthrough.campaignName === 'The Dream-Eaters'

  // When campaignSet is a generic bucket (e.g. 'Scenario Pack'), it has no dedicated
  // artwork; prefer campaignName when it resolves to a specific standalone icon.
  const campaignIconKey = hasDedicatedCampaignIcon(playthrough.campaignName)
    ? playthrough.campaignName
    : (playthrough.campaignSet ?? playthrough.campaignName)

  return (
    <Card className="p-4 md:p-6 hover:border-accent transition-all duration-200 hover:shadow-lg group overflow-hidden">
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:items-start">
        <div className="flex items-start justify-between gap-4 md:min-w-[320px] md:flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg md:text-xl font-semibold mb-1 truncate flex items-center gap-2">
              <span aria-hidden="true" className="flex-shrink-0">
                <CampaignSvgIcon
                  campaignSet={campaignIconKey}
                  size={18}
                  className="text-primary/70"
                />
              </span>
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
          <div className="flex gap-1 opacity-100 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(playthrough)}
              className="h-8 w-8"
              aria-label="Edit playthrough"
            >
              <PencilSimple size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(playthrough.id)}
              className="h-8 w-8 text-destructive hover:text-destructive"
              aria-label="Delete playthrough"
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
                            <InvestigatorGrid>
                              {pathAInvestigators.map((inv, idx) => (
                                <InvestigatorDisplay key={idx} inv={inv} />
                              ))}
                            </InvestigatorGrid>
                          </div>
                        )}
                        
                        {pathBInvestigators.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs font-semibold">
                                Campaign B: The Web of Dreams
                              </Badge>
                            </div>
                            <InvestigatorGrid>
                              {pathBInvestigators.map((inv, idx) => (
                                <InvestigatorDisplay key={idx} inv={inv} />
                              ))}
                            </InvestigatorGrid>
                          </div>
                        )}

                        {noPathInvestigators.length > 0 && (
                          <InvestigatorGrid>
                            {noPathInvestigators.map((inv, idx) => (
                              <InvestigatorDisplay key={idx} inv={inv} />
                            ))}
                          </InvestigatorGrid>
                        )}
                      </>
                    )
                  })()}
                </div>
              ) : (
                <InvestigatorGrid>
                  {playthrough.investigators.map((inv, idx) => (
                    <InvestigatorDisplay key={idx} inv={inv} />
                  ))}
                </InvestigatorGrid>
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
            aria-label="Edit playthrough"
          >
            <PencilSimple size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(playthrough.id)}
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Delete playthrough"
          >
            <Trash size={18} />
          </Button>
        </div>
      </div>

        {playthrough.notes && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-start gap-2 text-sm">
              <Notepad size={16} weight="duotone" className="mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p className="whitespace-pre-wrap break-words text-muted-foreground leading-relaxed max-w-full overflow-hidden">{playthrough.notes}</p>
            </div>
          </div>
        )}
    </Card>
  )
})
