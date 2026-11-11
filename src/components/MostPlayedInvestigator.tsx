import { ArchetypeBadge } from '@/components/ArchetypeBadge'
import type { CommunityStats } from '@/lib/community-stats'
import {
  getArkhamDBUrl,
  getArkhamDBUrlById,
  getChapterBadgeLabel,
  isChapterBadgeSpecial,
  resolveInvestigator,
} from '@/lib/investigator-data'

interface MostPlayedInvestigatorProps {
  investigator: CommunityStats['topInvestigators'][number]
  linked?: boolean
}

export function mostPlayedInvestigatorItem(investigator: MostPlayedInvestigatorProps['investigator'], linked = false) {
  return {
    key: investigator.investigatorId ?? `${investigator.name}__${investigator.investigatorSet ?? `ch${investigator.chapter ?? 1}`}`,
    countLabel: `${investigator.count} ${investigator.count === 1 ? 'campaign' : 'campaigns'}`,
    renderContent: () => <MostPlayedInvestigator investigator={investigator} linked={linked} />,
  }
}

function MostPlayedInvestigator({ investigator, linked = false }: MostPlayedInvestigatorProps) {
  const resolved = resolveInvestigator({
    investigatorId: investigator.investigatorId,
    investigatorName: investigator.name,
    chapter: investigator.chapter,
    investigatorSet: investigator.investigatorSet,
  })
  const url = linked
    ? resolved
      ? getArkhamDBUrlById(resolved.id, investigator.archetypes[0])
      : getArkhamDBUrl(investigator.name, investigator.archetypes[0], investigator.chapter)
    : null
  // Name-only legacy aggregates can combine chapters; the resolver's Ch. 1
  // fallback is not evidence that the aggregate belongs to that chapter.
  const chapterInfo = resolved && (
    resolved.id === investigator.investigatorId ||
    resolved.set === investigator.investigatorSet ||
    investigator.chapter !== undefined
  )
    ? resolved
    : investigator.chapter ? { chapter: investigator.chapter } : null
  const chapterLabel = chapterInfo ? getChapterBadgeLabel(chapterInfo) : null

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
      <div data-badge className="flex flex-wrap gap-1 max-w-full items-center">
        {investigator.archetypes.map(archetype => (
          <ArchetypeBadge key={archetype} archetype={archetype} />
        ))}
      </div>
      <div data-name className="flex flex-wrap flex-1 basis-32 items-center gap-x-2 gap-y-0.5 min-w-0">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:text-primary transition-colors underline decoration-transparent hover:decoration-primary min-w-0 break-words"
          >
            {investigator.name}
          </a>
        ) : (
          <span className="font-medium text-foreground min-w-0 break-words">{investigator.name}</span>
        )}
        {chapterInfo && (
          <span
            data-chapter
            className={`text-xs font-medium flex-shrink-0 whitespace-nowrap ${
              isChapterBadgeSpecial(chapterInfo) ? 'text-violet-400' : 'text-muted-foreground opacity-60'
            }`}
          >
            <span aria-hidden="true">· {chapterLabel}</span>
            <span className="sr-only">{chapterLabel === 'Parallel' ? chapterLabel : `Chapter ${chapterInfo.chapter}`}</span>
          </span>
        )}
      </div>
    </div>
  )
}
