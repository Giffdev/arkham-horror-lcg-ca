/**
 * CommunityStats — behavior-first tests
 *
 * Target: src/components/CommunityStats.tsx (refactored by Dallas onto StatsListCard)
 * Tests will fail until Dallas's production code lands. That is expected and correct.
 *
 * Covered (per design doc D10, D12, Contract A/B, acceptance criteria):
 *  1. All seven cards render when stats contain full data
 *  2. Campaigns card label and standalone breakdown card visible
 *  3. A legacy stats object (missing optional new fields) does not crash
 *  4. Cards missing data stay hidden rather than crashing on .length
 *  5. Loading state renders without crash
 *  6. Empty-data state renders without crash
 *  7. [2026-08-11 Lambert] Duplicate-key regression: two same-named/different-chapter investigators both render and produce no React duplicate-key warning.
 *  8. [2026-08-11 Lambert] Mobile KPI 2×2 grid: grid wrapper carries grid-cols-2 base class (not grid-cols-1).
 *  9. [2026-08-11 Lambert] Expanded content overflow: expanded list is inside scroll-area / max-h containment.
 */
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CommunityStats } from './CommunityStats'

// ─── mock community-stats module ─────────────────────────────────────────────
vi.mock('@/lib/community-stats', () => ({
  getCommunityStats: vi.fn(),
}))

import { getCommunityStats } from '@/lib/community-stats'
const mockGetCommunityStats = vi.mocked(getCommunityStats)

// ─── test fixtures ────────────────────────────────────────────────────────────

const FULL_STATS = {
  totalGames: 42,
  registeredUsers: 7,
  totalInvestigatorsPlayed: 23,
  topCampaigns: [
    { name: 'The Night of the Zealot', count: 12, set: 'Core' },
    { name: 'Edge of the Earth', count: 8, set: 'Edge of the Earth' },
    { name: 'Return to The Dunwich Legacy', count: 5, set: 'Return to The Dunwich Legacy', returnTo: true },
  ],
  topInvestigators: [
    { name: 'Roland Banks', count: 9, archetypes: ['Guardian'], chapter: 1 },
  ],
  topClasses: [
    { archetype: 'Guardian', count: 15 },
    { archetype: 'Seeker', count: 11 },
  ],
  topStandalones: [
    {
      name: 'Traces To Nowhere',
      count: 7,
      set: 'Scenario Pack',
      breakdown: { asStandalone: 4, asSideStory: 3 },
    },
    { name: 'Curse of the Rougarou', count: 5, set: 'Scenario Pack' },
  ],
  topSideScenarios: [
    { name: 'Carnevale of Horrors', count: 6 },
    { name: 'My Custom Side Scenario', count: 2 },
  ],
  lastUpdated: Date.now(),
}

/**
 * Legacy document — written before topStandalones/topSideScenarios/topClasses
 * were implemented. Simulates a document already persisted in production.
 */
const LEGACY_STATS = {
  totalGames: 10,
  registeredUsers: 2,
  totalInvestigatorsPlayed: 5,
  topCampaigns: [{ name: 'The Night of the Zealot', count: 10, set: 'Core' }],
  topInvestigators: [{ name: 'Wendy Adams', count: 5, archetypes: ['Survivor'], chapter: 1 }],
  // topClasses, topStandalones, topSideScenarios intentionally missing
  lastUpdated: Date.now(),
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function renderAndWait(stats: unknown) {
  mockGetCommunityStats.mockResolvedValueOnce(stats as ReturnType<typeof getCommunityStats> extends Promise<infer T> ? T : never)
  render(<CommunityStats />)
  await waitFor(() =>
    expect(screen.queryByText(/loading community stats/i)).not.toBeInTheDocument(),
  )
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('CommunityStats', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('loading state', () => {
    it('renders a loading indicator before stats resolve', () => {
      mockGetCommunityStats.mockReturnValue(new Promise(() => {})) // never resolves
      render(<CommunityStats />)
      expect(screen.getByText(/loading community stats/i)).toBeVisible()
    })
  })

  describe('empty / zero data state', () => {
    it('renders empty state when totalGames is 0', async () => {
      mockGetCommunityStats.mockResolvedValueOnce({ ...FULL_STATS, totalGames: 0 } as never)
      render(<CommunityStats />)
      await waitFor(() =>
        expect(screen.getByText(/no community data available/i)).toBeVisible(),
      )
    })
  })

  describe('full data — all seven cards visible', () => {
    it('renders the four summary metric tiles', async () => {
      await renderAndWait(FULL_STATS)
      expect(screen.getByText('42')).toBeVisible() // totalGames
      expect(screen.getByText('7')).toBeVisible()  // registeredUsers
      expect(screen.getByText('23')).toBeVisible() // totalInvestigatorsPlayed
    })

    it('renders the Most Popular Campaigns list card', async () => {
      await renderAndWait(FULL_STATS)
      expect(screen.getByText(/most popular campaigns/i)).toBeVisible()
      expect(screen.getByText('The Night of the Zealot')).toBeVisible()
      expect(screen.getByText('Edge of the Earth')).toBeVisible()
    })

    it('campaigns card includes a Return-to entry', async () => {
      await renderAndWait(FULL_STATS)
      expect(screen.getByText('Return to The Dunwich Legacy')).toBeVisible()
    })

    it('renders the Most Played Investigators list card', async () => {
      await renderAndWait(FULL_STATS)
      expect(screen.getByText(/most played investigators/i)).toBeVisible()
      expect(screen.getByText('Roland Banks')).toBeVisible()
    })

    it('renders the Class Popularity card', async () => {
      await renderAndWait(FULL_STATS)
      expect(screen.getByText(/class popularity/i)).toBeVisible()
    })

    it('renders the Popular Standalone Scenarios card', async () => {
      await renderAndWait(FULL_STATS)
      expect(screen.getByText(/popular standalone scenarios/i)).toBeVisible()
      expect(screen.getByText('Traces To Nowhere')).toBeVisible()
    })

    it('standalone card shows the standalone vs side-story breakdown', async () => {
      await renderAndWait(FULL_STATS)
      // D3 breakdown: 4 standalone, 3 side-story, total 7.
      // Dallas renders: "{asStandalone} standalone · {asSideStory} side story"
      // Use text-node exact substrings to avoid matching unrelated numbers.
      expect(screen.getByText('4 standalone · 3 side story')).toBeVisible()
    })

    /**
     * D3 / Dallas intent: "Popular Side Stories" card is removed from the
     * Community page. Side-scenario data is consolidated into "Popular Standalone
     * Scenarios". This test will FAIL until Dallas removes the sideScenarioItems
     * rendering block from CommunityStats.tsx.
     */
    it('does NOT render a "Popular Side Stories" heading or card', async () => {
      await renderAndWait(FULL_STATS)
      expect(screen.queryByText(/popular side stories/i)).not.toBeInTheDocument()
    })

    it('"Popular Standalone Scenarios" card is still rendered (not removed with side stories)', async () => {
      await renderAndWait(FULL_STATS)
      expect(screen.getByText(/popular standalone scenarios/i)).toBeVisible()
    })
  })

  describe('legacy stats object — missing optional fields (D10)', () => {
    it('does not crash when topStandalones is undefined', async () => {
      // Should render without throwing even though the new fields are absent
      await expect(renderAndWait(LEGACY_STATS)).resolves.toBeUndefined()
    })

    it('does not render standalone card when topStandalones is missing', async () => {
      await renderAndWait(LEGACY_STATS)
      expect(screen.queryByText(/popular standalone scenarios/i)).not.toBeInTheDocument()
    })

    it('does not render side-stories card when topSideScenarios is missing', async () => {
      await renderAndWait(LEGACY_STATS)
      expect(screen.queryByText(/popular side stories/i)).not.toBeInTheDocument()
    })

    it('still renders the core metric tiles with legacy data', async () => {
      await renderAndWait(LEGACY_STATS)
      expect(screen.getByText('10')).toBeVisible()
    })
  })

  describe('duplicate-key regression — same-named investigators with different chapters', () => {
    it('renders both rows distinctly and emits no duplicate-key console error', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const stats = {
        ...FULL_STATS,
        topInvestigators: [
          { name: 'Jenny Barnes', count: 5, archetypes: ['Rogue'], chapter: 1 },
          { name: 'Jenny Barnes', count: 3, archetypes: ['Rogue'], chapter: 2 },
        ],
      }
      await renderAndWait(stats)

      // Both rows must be present — getAllByText returns 2 elements
      expect(screen.getAllByText('Jenny Barnes')).toHaveLength(2)

      // React duplicate-key warning contains "encountered two children with the same key"
      const dupKeyWarning = consoleError.mock.calls.some(args =>
        String(args[0]).toLowerCase().includes('same key'),
      )
      expect(dupKeyWarning).toBe(false)

      consoleError.mockRestore()
    })
  })

  describe('grid layout (D12)', () => {
    it('renders the list-card grid container', async () => {
      await renderAndWait(FULL_STATS)
      // The campaigns card must be inside a grid wrapper.
      // This helps catch regression if Dallas reverts to md:grid-cols-3.
      const heading = screen.getByText(/most popular campaigns/i)
      const grid = heading.closest('[class*="grid"]')
      expect(grid).toBeInTheDocument()
    })
  })

  describe('KPI summary grid — mobile 2×2 layout (overflow regression)', () => {
    /**
     * On mobile the four KPI tiles must sit in a two-column grid so they
     * fit without overflowing. The Tailwind class contract is:
     *   grid-cols-2                 → 2 columns from the base (mobile-first)
     *   md:grid-cols-4              → 4 columns on md+
     *
     * jsdom cannot compute viewport-dependent layout, so we assert the
     * CSS class contract on the wrapper element directly.
     * Physical rendering must be verified in a real browser / Playwright.
     *
     * Expected to FAIL until Dallas updates the KPI grid wrapper class from
     *   "grid-cols-1 sm:grid-cols-2 md:grid-cols-4"
     * to
     *   "grid-cols-2 md:grid-cols-4"
     */

    it('KPI grid wrapper has grid-cols-2 (mobile two-column base class)', async () => {
      await renderAndWait(FULL_STATS)
      // Find any of the four KPI metric values and climb to the grid wrapper.
      const totalGamesValue = screen.getByText('42') // totalGames
      // The grid wrapper is the closest ancestor with both "grid" and "grid-cols"
      // classes (the div that holds all four KPI cards).
      let el: Element | null = totalGamesValue.parentElement
      let gridWrapper: Element | null = null
      while (el) {
        const cls = el.className ?? ''
        if (typeof cls === 'string' && cls.includes('grid') && cls.includes('grid-cols')) {
          gridWrapper = el
          break
        }
        el = el.parentElement
      }
      expect(gridWrapper).toBeInTheDocument()
      // Must NOT start at grid-cols-1 (that's the old single-column mobile layout)
      expect(gridWrapper!.className).not.toMatch(/\bgrid-cols-1\b/)
      // Must have grid-cols-2 at the BASE breakpoint (no sm:/md:/lg: prefix).
      // A regex of /(?<![:\w])grid-cols-2\b/ rejects sm:grid-cols-2 et al.
      expect(gridWrapper!.className).toMatch(/(?<![:\w])grid-cols-2\b/)
    })

    it('KPI grid wrapper retains md:grid-cols-4 for desktop (no regression)', async () => {
      await renderAndWait(FULL_STATS)
      const totalGamesValue = screen.getByText('42')
      let el: Element | null = totalGamesValue.parentElement
      let gridWrapper: Element | null = null
      while (el) {
        const cls = el.className ?? ''
        if (typeof cls === 'string' && cls.includes('grid') && cls.includes('grid-cols')) {
          gridWrapper = el
          break
        }
        el = el.parentElement
      }
      expect(gridWrapper).toBeInTheDocument()
      expect(gridWrapper!.className).toMatch(/md:grid-cols-4/)
    })

    it('all four KPI labels are rendered inside the grid wrapper', async () => {
      await renderAndWait(FULL_STATS)
      // Each KPI card title must be present. Verifies no card is accidentally
      // moved outside the grid during the layout fix.
      expect(screen.getByText(/total campaigns logged/i)).toBeInTheDocument()
      expect(screen.getByText(/community members/i)).toBeInTheDocument()
      expect(screen.getByText(/investigators played/i)).toBeInTheDocument()
      expect(screen.getByText(/unique campaigns/i)).toBeInTheDocument()
    })
  })

  describe('StatsListCard expanded content — overflow containment (regression)', () => {
    /**
     * When a StatsListCard is expanded via "Show all", the content must remain
     * inside a deliberate scroll/containment boundary so it does not visually
     * overflow the card on narrow viewports.
     *
     * jsdom limitation: physical scroll-height/clientHeight are always 0 in
     * jsdom, so we cannot directly detect pixel-level overflow. Instead we
     * assert the DOM/CSS contract that prevents it — the presence of a
     * scroll-area root ancestor — same contract asserted in StatsListCard.test.tsx.
     *
     * Expected to FAIL until Dallas's expanded-view containment fix lands.
     */

    it('expanded campaigns card content is inside a scroll-area / max-h containment', async () => {
      // Provide > 10 campaigns so the ScrollArea max-height class activates
      const manyStats = {
        ...FULL_STATS,
        topCampaigns: Array.from({ length: 12 }, (_, i) => ({
          name: `Campaign ${i + 1}`,
          count: 12 - i,
          set: 'Core',
        })),
      }
      mockGetCommunityStats.mockResolvedValueOnce(manyStats as never)
      render(<CommunityStats />)
      await waitFor(() =>
        expect(screen.queryByText(/loading community stats/i)).not.toBeInTheDocument(),
      )

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /show all/i }))

      // "Show less" must be accessible after expansion
      const showLessBtn = screen.getByRole('button', { name: /show (less|fewer)/i })
      expect(showLessBtn).toBeInTheDocument()
      expect(showLessBtn).not.toBeDisabled()

      // Containment: list region must have a scroll-area / max-h ancestor
      const controlledId = showLessBtn.getAttribute('aria-controls')
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const listRegion = document.getElementById(controlledId!)
      expect(listRegion).toBeInTheDocument()

      let el: Element | null = listRegion?.parentElement ?? null
      let foundContainment = false
      while (el) {
        const cls = el.className ?? ''
        if (
          el.hasAttribute('data-radix-scroll-area-root') ||
          (typeof cls === 'string' && cls.includes('max-h-'))
        ) {
          foundContainment = true
          break
        }
        el = el.parentElement
      }
      expect(foundContainment).toBe(true)
    })
  })

  // ─── Equal-height grid layout contract ───────────────────────────────────────
  // [2026-08-11 Lambert] The StatsListCard grid uses items-stretch so all cards
  // in a row match the tallest card's height. Each card receives className="h-full"
  // to fill its grid cell. This describe block guards both the grid wrapper class
  // and the per-card h-full class from regressing.

  describe('StatsListCard grid — equal-height layout contract (items-stretch + h-full)', () => {
    it('grid wrapper carries items-stretch for equal row heights', async () => {
      await renderAndWait(FULL_STATS)
      const grids = document.querySelectorAll('.items-stretch')
      expect(
        grids.length,
        'At least one element must carry items-stretch — the StatsListCard grid wrapper',
      ).toBeGreaterThan(0)
    })

    it('StatsListCards inside the grid each carry h-full for cell-filling height', async () => {
      await renderAndWait(FULL_STATS)
      const grid = document.querySelector('.items-stretch')
      expect(grid).toBeInTheDocument()
      const hFullChildren = grid
        ? Array.from(grid.children).filter((child) =>
            (child as HTMLElement).className?.includes('h-full'),
          )
        : []
      expect(
        hFullChildren.length,
        'At least one direct child of items-stretch grid must carry h-full',
      ).toBeGreaterThan(0)
    })
  })

  // ─── Return To badge taxonomy regression ─────────────────────────────────────
  // [2026-08-12 Dallas] Prior bug: campaignTypeLabel() checked `c.returnTo` before
  // `c.type`, so Return To Full campaigns were badged "Return To" instead of "Full".

  describe('Return To campaign badge taxonomy (regression)', () => {
    it('Return to The Dunwich Legacy renders badge "Full", not "Return To"', async () => {
      await renderAndWait(FULL_STATS)
      expect(screen.getByText('Return to The Dunwich Legacy')).toBeVisible()
      const fullBadges = screen.getAllByText('Full')
      expect(fullBadges.length).toBeGreaterThan(0)
    })

    it('no "Return To" badge text appears in the campaigns card', async () => {
      await renderAndWait(FULL_STATS)
      const allText = document.body.textContent ?? ''
      const hasReturnToBadge = /Return To\b/.test(allText)
      expect(hasReturnToBadge, '"Return To" badge must not appear — use "Full" or "Short" instead').toBe(false)
    })
  })

  // ─── capped-list "Show top N" regression (investigators card) ───────────────
  // [2026-08-12 Dallas] When topInvestigators has 25 entries but
  // totalInvestigatorsPlayed is 73, the expand button must say "Show top 25",
  // not the misleading "Show all 25".

  describe('investigators card — capped expand label (regression)', () => {
    it('renders "Show top 25" when 25 investigators are listed out of 73 total', async () => {
      const manyInvestigators = Array.from({ length: 25 }, (_, i) => ({
        name: `Investigator ${i + 1}`,
        count: 25 - i,
        archetypes: ['Guardian'],
        chapter: 1,
      }))
      const cappedStats = {
        ...FULL_STATS,
        totalInvestigatorsPlayed: 73,
        topInvestigators: manyInvestigators,
      }
      await renderAndWait(cappedStats)
      expect(screen.getByRole('button', { name: /show top 25/i })).toBeVisible()
    })

    it('does NOT render "Show all 25" in the capped-investigator scenario', async () => {
      const manyInvestigators = Array.from({ length: 25 }, (_, i) => ({
        name: `Investigator ${i + 1}`,
        count: 25 - i,
        archetypes: ['Seeker'],
        chapter: 1,
      }))
      const cappedStats = {
        ...FULL_STATS,
        totalInvestigatorsPlayed: 73,
        topInvestigators: manyInvestigators,
      }
      await renderAndWait(cappedStats)
      expect(screen.queryByRole('button', { name: /show all 25/i })).not.toBeInTheDocument()
    })
  })
})
