import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UsersThree, MagnifyingGlass, ArrowSquareOut } from '@phosphor-icons/react'
import { Playthrough } from '@/lib/types'
import { CommunityPairing } from '@/lib/community-stats'
import { HeatmapData, buildHeatmapFromPairings, useInvestigatorHeatmap } from '@/hooks/useInvestigatorHeatmap'
import { getArkhamDBUrl } from '@/lib/investigator-data'

/** Get ArkhamDB link for an investigator, falling back to search URL */
function getInvestigatorLink(name: string): string {
  return getArkhamDBUrl(name) ?? `https://arkhamdb.com/find?q=${encodeURIComponent(name)}`
}

interface InvestigatorHeatmapProps {
  playthroughs: Playthrough[] | undefined
  communityPairings?: CommunityPairing[]
}

type ViewMode = 'community' | 'personal'

/** Color scale: transparent → primary purple based on intensity 0–1 */
function getCellColor(value: number, max: number): string {
  if (value === 0 || max === 0) return 'transparent'
  const intensity = value / max
  // oklch purple matching --primary, fade from near-transparent to full
  return `oklch(0.55 0.25 290 / ${Math.max(0.1, intensity)})`
}

function getCellTextColor(value: number, max: number): string {
  if (value === 0 || max === 0) return ''
  const intensity = value / max
  return intensity > 0.5 ? 'text-white' : 'text-foreground'
}

// ---------- Desktop Heatmap Grid ----------

interface DesktopHeatmapProps {
  data: HeatmapData
}

function DesktopHeatmap({ data }: DesktopHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [highlightedInvestigator, setHighlightedInvestigator] = useState<number | null>(null)

  const { investigators, matrix, maxCount } = data

  if (investigators.length === 0) return null

  const isHighlighted = (row: number, col: number) => {
    if (highlightedInvestigator !== null) {
      return row === highlightedInvestigator || col === highlightedInvestigator
    }
    return false
  }

  const count = investigators.length
  // When fewer than 25 investigators, cells expand to fill width; otherwise use fixed min size with scroll
  const useFluid = count < 25
  const labelSize = count > 30 ? 'text-[9px]' : 'text-[11px]'
  const cellFontSize = count > 30 ? 'text-[9px]' : 'text-xs'

  const gridStyle: React.CSSProperties = useFluid
    ? { display: 'grid', gridTemplateColumns: `6rem repeat(${count}, 1fr)`, width: '100%' }
    : { display: 'grid', gridTemplateColumns: `6rem repeat(${count}, minmax(1.5rem, 2rem))`, width: 'max-content' }

  return (
    <div className="w-full overflow-auto">
      {/* Header row */}
      <div style={gridStyle}>
        <div /> {/* Corner spacer */}
        {investigators.map((name, colIdx) => (
          <div
            key={`col-${colIdx}`}
            className="flex items-end justify-center pb-0.5 cursor-pointer select-none aspect-square"
            onMouseEnter={() => setHighlightedInvestigator(colIdx)}
            onMouseLeave={() => setHighlightedInvestigator(null)}
            title={name}
          >
            <a
              href={getInvestigatorLink(name)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`${labelSize} text-muted-foreground truncate origin-bottom-left rotate-[-55deg] translate-x-1 block max-w-[60px] hover:underline hover:text-primary/80 transition-colors ${
                highlightedInvestigator === colIdx ? 'text-primary font-bold' : ''
              }`}
            >
              {name.length > 8 ? name.slice(0, 7) + '…' : name}
            </a>
          </div>
        ))}
      </div>

      {/* Matrix rows */}
      {investigators.map((rowName, rowIdx) => (
        <div key={`row-${rowIdx}`} style={gridStyle}>
          {/* Row label */}
          <div
            className={`pr-2 text-right ${labelSize} text-muted-foreground truncate cursor-pointer select-none flex items-center justify-end ${
              highlightedInvestigator === rowIdx ? 'text-primary font-bold' : ''
            }`}
            onMouseEnter={() => setHighlightedInvestigator(rowIdx)}
            onMouseLeave={() => setHighlightedInvestigator(null)}
            title={rowName}
          >
            <a
              href={getInvestigatorLink(rowName)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:underline hover:text-primary/80 transition-colors"
            >
              {rowName.length > 12 ? rowName.slice(0, 11) + '…' : rowName}
            </a>
          </div>

          {/* Cells */}
          {matrix[rowIdx].map((value, colIdx) => {
            const isDiagonal = rowIdx === colIdx
            const highlighted = isHighlighted(rowIdx, colIdx)

            return (
              <div
                key={`cell-${rowIdx}-${colIdx}`}
                className={`aspect-square flex items-center justify-center border border-border/30 relative transition-all duration-100 ${cellFontSize} ${
                  isDiagonal ? 'bg-muted/30' : ''
                } ${highlighted ? 'ring-1 ring-primary/60' : ''} ${
                  value > 0 && !isDiagonal ? 'cursor-pointer' : ''
                } ${getCellTextColor(value, maxCount)}`}
                style={{
                  backgroundColor: isDiagonal ? undefined : getCellColor(value, maxCount),
                }}
                onMouseEnter={(e) => {
                  if (!isDiagonal && value > 0) {
                    setHoveredCell({ row: rowIdx, col: colIdx })
                    setTooltipPos({ x: e.clientX, y: e.clientY })
                  }
                }}
                onMouseMove={(e) => {
                  if (hoveredCell) setTooltipPos({ x: e.clientX, y: e.clientY })
                }}
                onMouseLeave={() => setHoveredCell(null)}
                aria-label={
                  isDiagonal
                    ? `${rowName} (self)`
                    : `${rowName} & ${investigators[colIdx]}: ${value} games`
                }
                role="gridcell"
              >
                {value > 0 && !isDiagonal && (
                  <span className="font-medium">{value}</span>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* Tooltip */}
      {hoveredCell && (
        <div className="fixed pointer-events-none z-50 px-3 py-2 rounded-lg bg-popover text-popover-foreground shadow-lg border text-sm"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y,
            transform: 'translateY(-50%)',
          }}
        >
          <TooltipContent
            name1={data.investigators[hoveredCell.row]}
            name2={data.investigators[hoveredCell.col]}
            count={data.matrix[hoveredCell.row][hoveredCell.col]}
          />
        </div>
      )}
    </div>
  )
}

// Separate tooltip for the desktop hover - we'll use a simpler approach
function TooltipContent({ name1, name2, count }: { name1: string; name2: string; count: number }) {
  return (
    <span>
      <strong>{name1}</strong> &amp; <strong>{name2}</strong>: played together{' '}
      <strong>{count}</strong> {count === 1 ? 'time' : 'times'}
    </span>
  )
}

// ---------- Mobile Experience ----------

interface MobileHeatmapProps {
  data: HeatmapData
}

function MobileHeatmap({ data }: MobileHeatmapProps) {
  const [selectedInvestigator, setSelectedInvestigator] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  const { investigators, matrix, maxCount } = data

  // Filter investigators based on search
  const filteredInvestigators = useMemo(() => {
    if (!searchQuery.trim()) return investigators
    const q = searchQuery.toLowerCase()
    return investigators.filter(name => name.toLowerCase().includes(q))
  }, [investigators, searchQuery])

  // Get pairings for selected investigator, sorted by count descending
  const selectedPairings = useMemo(() => {
    if (!selectedInvestigator) return []
    const idx = investigators.indexOf(selectedInvestigator)
    if (idx === -1) return []

    const pairs: { name: string; count: number }[] = []
    for (let j = 0; j < investigators.length; j++) {
      if (j === idx) continue
      const count = matrix[idx][j]
      if (count > 0) {
        pairs.push({ name: investigators[j], count })
      }
    }
    pairs.sort((a, b) => b.count - a.count)
    return pairs
  }, [selectedInvestigator, investigators, matrix])

  if (investigators.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Search/select investigator */}
      <div className="relative">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search investigators…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Search investigators"
        />
      </div>

      {/* Investigator chips / select list */}
      {!selectedInvestigator ? (
        <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
          {filteredInvestigators.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">No matching investigators</p>
          ) : (
            filteredInvestigators.map(name => {
              const idx = investigators.indexOf(name)
              const totalPairings = matrix[idx].reduce((sum, v, j) => j !== idx ? sum + v : sum, 0)
              return (
                <div key={name} className="flex items-center">
                  <button
                    onClick={() => { setSelectedInvestigator(name); setSearchQuery('') }}
                    className="flex-1 text-left px-3 py-2 rounded-md hover:bg-primary/10 transition-colors flex items-center justify-between"
                    aria-label={`Select ${name}`}
                  >
                    <span className="text-sm font-medium text-foreground">{name}</span>
                    <span className="text-xs text-muted-foreground">{totalPairings} co-plays</span>
                  </button>
                  <a
                    href={getInvestigatorLink(name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                    aria-label={`View ${name} on ArkhamDB`}
                  >
                    <ArrowSquareOut size={14} />
                  </a>
                </div>
              )
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Selected investigator header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <a
                href={getInvestigatorLink(selectedInvestigator)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold text-primary hover:underline transition-colors"
              >
                {selectedInvestigator}
              </a>
              <span className="text-xs text-muted-foreground">paired with</span>
            </div>
            <button
              onClick={() => setSelectedInvestigator('')}
              className="text-xs text-muted-foreground hover:text-foreground underline"
              aria-label="Clear selection"
            >
              ← Back
            </button>
          </div>

          {/* Pairing list */}
          {selectedPairings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pairings found for {selectedInvestigator}
            </p>
          ) : (
            <div className="space-y-2">
              {selectedPairings.map((pair, idx) => {
                const intensity = maxCount > 0 ? pair.count / maxCount : 0
                return (
                  <div
                    key={pair.name}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50"
                  >
                    <span className="text-lg font-bold text-muted-foreground/40 w-6 text-right flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">{pair.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: getCellColor(pair.count, maxCount) }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {pair.count} {pair.count === 1 ? 'game' : 'games'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- Color Legend ----------

function ColorLegend({ maxCount }: { maxCount: number }) {
  if (maxCount === 0) return null

  const steps = 5
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>0</span>
      <div className="flex gap-0.5">
        {Array.from({ length: steps }, (_, i) => {
          const value = ((i + 1) / steps) * maxCount
          return (
            <div
              key={i}
              className="w-5 h-3 rounded-sm border border-border/30"
              style={{ backgroundColor: getCellColor(value, maxCount) }}
            />
          )
        })}
      </div>
      <span>{maxCount}</span>
    </div>
  )
}

// ---------- Main Component ----------

export function InvestigatorHeatmap({ playthroughs, communityPairings }: InvestigatorHeatmapProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('community')

  const personalData = useInvestigatorHeatmap(playthroughs)

  const communityData: HeatmapData = useMemo(() => {
    if (!communityPairings || communityPairings.length === 0) {
      return { investigators: [], matrix: [], maxCount: 0 }
    }
    return buildHeatmapFromPairings(
      communityPairings.map(p => ({ name1: p.investigator1, name2: p.investigator2, count: p.count }))
    )
  }, [communityPairings])

  const activeData = viewMode === 'community' ? communityData : personalData
  const hasCommunity = communityData.investigators.length > 0
  const hasPersonal = personalData.investigators.length > 0

  // If no data at all, show nothing
  if (!hasCommunity && !hasPersonal) {
    return null
  }

  return (
    <section aria-label="Investigator Co-occurrence Heatmap" className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground mb-1">Investigator Pairings</h3>
        <p className="text-sm text-muted-foreground">Who teams up with whom across all campaigns</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <UsersThree size={20} className="text-primary" weight="duotone" />
              <CardTitle>Co-occurrence Heatmap</CardTitle>
            </div>

            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-border p-0.5 text-sm" role="tablist" aria-label="Data source">
              <button
                role="tab"
                aria-selected={viewMode === 'community'}
                onClick={() => setViewMode('community')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  viewMode === 'community'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Community
              </button>
              <button
                role="tab"
                aria-selected={viewMode === 'personal'}
                onClick={() => setViewMode('personal')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  viewMode === 'personal'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Your Games
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Empty states */}
          {viewMode === 'community' && !hasCommunity && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No community data yet. Games from all players will appear here as they log sessions.
            </p>
          )}
          {viewMode === 'personal' && !hasPersonal && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Log some multiplayer games to see your investigator pairings!
            </p>
          )}

          {/* Heatmap content */}
          {activeData.investigators.length > 0 && (
            <div className="space-y-4">
              {/* Color legend */}
              <div className="flex justify-end">
                <ColorLegend maxCount={activeData.maxCount} />
              </div>

              {/* Desktop: Full grid heatmap */}
              <div className="hidden md:block" role="grid" aria-label="Investigator pairing heatmap grid">
                <DesktopHeatmap data={activeData} />
              </div>

              {/* Mobile: Searchable investigator list */}
              <div className="md:hidden">
                <MobileHeatmap data={activeData} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
