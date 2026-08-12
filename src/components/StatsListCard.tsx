import { useId, useRef, useState, useEffect } from 'react'
import type { Icon } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export interface StatsListItem {
  key: string
  countLabel: string
  renderContent: () => React.ReactNode
}

export interface StatsListCardProps {
  icon: Icon
  title: string
  subtitle?: string
  items: StatsListItem[]
  collapseAfter?: number
  className?: string
}

export function StatsListCard({
  icon: IconComponent,
  title,
  subtitle,
  items,
  collapseAfter = 5,
  className,
}: StatsListCardProps) {
  const [expanded, setExpanded] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const hasMore = items.length > collapseAfter

  // When the card expands, make the scroll region keyboard-reachable (Blocker 1).
  // Radix ScrollArea viewport carries tabIndex=-1 by default, so sighted
  // keyboard-only users can't reach overflow content. After expansion we
  // focus the scrollable div directly so Tab → arrow/page keys work natively.
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.focus({ preventScroll: true })
    }
  }, [expanded])

  function handleToggle() {
    if (expanded) {
      setExpanded(false)
      // Return focus to toggle on collapse (D11)
      requestAnimationFrame(() => toggleRef.current?.focus())
    } else {
      setExpanded(true)
    }
  }

  const listContent = (
    <div id={listId} className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.key}
          hidden={!expanded && index >= collapseAfter}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-2xl font-bold text-muted-foreground/40 w-6 text-right flex-shrink-0">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">{item.renderContent()}</div>
          </div>
          <span className="text-sm text-muted-foreground ml-2 flex-shrink-0">
            {item.countLabel}
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <IconComponent size={20} className="text-primary" weight="duotone" />
          <div>
            <CardTitle>{title}</CardTitle>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {expanded ? (
          // Expanded: use a focusable, scrollable div so keyboard users can
          // Tab into it and use Arrow/Page keys. tabIndex=0 puts it in tab
          // order; overflow-y-auto enables native keyboard scrolling.
          // aria-label announces purpose without overclaiming a landmark role.
          <div
            ref={scrollRef}
            data-expanded-scroll-region
            tabIndex={0}
            aria-label={`${title} — scrollable list`}
            className="max-h-[420px] overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded"
          >
            {listContent}
          </div>
        ) : (
          <ScrollArea>
            {listContent}
          </ScrollArea>
        )}

        {hasMore && (
          <button
            ref={toggleRef}
            type="button"
            onClick={handleToggle}
            aria-expanded={expanded}
            aria-controls={listId}
            className="mt-3 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded"
          >
            {expanded
              ? 'Show less'
              : `Show all ${items.length}`}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
