import { ArchetypeBadge } from '@/components/ArchetypeBadge'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date-utils'
import { getArkhamDBUrlById, getChapterBadgeLabel, resolveInvestigator } from '@/lib/investigator-data'
import type { InvestigatorAssignment } from '@/lib/types'

interface PlayerHistoryRecordProps {
  name: string
  type: string
  set?: string
  date: string
  scenarioName?: string
  investigators: InvestigatorAssignment[]
  showPlayers?: boolean
}

export function PlayerHistoryRecord({ name, type, set, date, scenarioName, investigators, showPlayers }: PlayerHistoryRecordProps) {
  return (
    <Card className="p-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium">{name}</h4>
          {scenarioName && scenarioName !== name && <p className="text-sm mt-1">{scenarioName}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
            <span>{formatDate(date)}</span>
            <Badge variant="secondary" className="text-xs">{type}</Badge>
            {set && <Badge variant="outline" className="text-xs">{set}</Badge>}
          </div>
        </div>
        <div className="space-y-2">
          {investigators.map((inv, index) => {
            const investigatorName = inv.isUnknown || inv.investigatorName === 'Unknown' ? 'Unknown' : inv.investigatorName
            const resolved = !inv.isUnknown && !inv.isCustom && investigatorName !== 'Unknown' ? resolveInvestigator(inv) : undefined
            const url = resolved ? getArkhamDBUrlById(resolved.id) : null
            return (
              <div key={index} className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  {showPlayers && <span className="text-sm text-muted-foreground">{inv.playerName || 'Unnamed player'} ·</span>}
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline hover:text-accent transition-colors">
                      {investigatorName}
                    </a>
                  ) : <span className="text-sm font-medium">{investigatorName}</span>}
                  {resolved && <span className="text-xs text-muted-foreground opacity-60">· {getChapterBadgeLabel(resolved)}</span>}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {(inv.archetypes || [inv.archetype]).map((archetype, archetypeIndex) => (
                    <ArchetypeBadge key={archetypeIndex} archetype={archetype} className="w-20 justify-center" />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
