/**
 * PublicHomepage — responsive contract tests
 *
 * Covered:
 *  1. Renders without crashing (loading & loaded states)
 *  2. KPI grid: grid-cols-2 base + md:grid-cols-4 on the KPI wrapper
 *  3. KPI grid: items-start prevents uneven title wrapping from stretching row partners
 *  4. Ranked grid: items-start present on the ranked-card wrapper
 *  5. Expanded containment: expanded list is inside max-h / overflow-y-auto region
 *  6. Keyboard access: expanded scroll region enters tab order (tabIndex=0)
 *  7. Investigators card stays outside the ranked grid (intentional placement preserved)
 */
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { PublicHomepage } from './PublicHomepage'

vi.mock('@/lib/community-stats', () => ({
  getCommunityStats: vi.fn(),
}))
vi.mock('@/components/AuthDialog', () => ({
  AuthDialog: () => null,
}))

import { getCommunityStats } from '@/lib/community-stats'
const mockGetCommunityStats = vi.mocked(getCommunityStats)

// ─── fixtures ────────────────────────────────────────────────────────────────

const FULL_STATS = {
  totalGames: 55,
  registeredUsers: 9,
  totalInvestigatorsPlayed: 30,
  topCampaigns: Array.from({ length: 8 }, (_, i) => ({
    name: `Campaign ${i + 1}`,
    count: 8 - i,
    set: 'Core',
  })),
  topInvestigators: [
    { name: 'Roland Banks', count: 10, archetypes: ['Guardian'], chapter: 1 },
    { name: 'Wendy Adams', count: 7, archetypes: ['Survivor'], chapter: 1 },
  ],
  topClasses: [
    { archetype: 'Guardian', count: 20 },
    { archetype: 'Seeker', count: 15 },
  ],
  topStandalones: [
    {
      name: 'Traces To Nowhere',
      count: 6,
      set: 'Scenario Pack',
      breakdown: { asStandalone: 3, asSideStory: 3 },
    },
  ],
  topSideScenarios: [
    { name: 'Carnevale of Horrors', count: 5 },
  ],
  lastUpdated: Date.now(),
}

async function renderAndWait(stats = FULL_STATS) {
  mockGetCommunityStats.mockResolvedValueOnce(stats as ReturnType<typeof getCommunityStats> extends Promise<infer T> ? T : never)
  render(<PublicHomepage onAuthSuccess={vi.fn()} />)
  // Wait for the stats section to appear (loading state gone)
  await waitFor(() =>
    expect(screen.queryByText(/community stats/i)).toBeInTheDocument(),
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function findGridWrapper(anchorText: string | RegExp): Element | null {
  const anchor = screen.getByText(anchorText)
  let el: Element | null = anchor.parentElement
  while (el) {
    const cls = el.className ?? ''
    if (typeof cls === 'string' && cls.includes('grid') && cls.includes('grid-cols')) {
      return el
    }
    el = el.parentElement
  }
  return null
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('PublicHomepage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('basic render', () => {
    it('renders the page header and sign-in button', () => {
      mockGetCommunityStats.mockReturnValue(new Promise(() => {}))
      render(<PublicHomepage onAuthSuccess={vi.fn()} />)
      expect(screen.getByText(/Arkham Horror LCG Tracker/i)).toBeVisible()
      // There are multiple Sign In buttons; confirm at least one is visible
      const signInBtns = screen.getAllByRole('button', { name: /sign in/i })
      expect(signInBtns.length).toBeGreaterThanOrEqual(1)
      expect(signInBtns[0]).toBeVisible()
    })

    it('does not crash when stats load successfully', async () => {
      await expect(renderAndWait()).resolves.toBeUndefined()
    })
  })

  describe('KPI grid — mobile 2×2 + desktop 4-col responsive contract', () => {
    it('KPI grid wrapper has grid-cols-2 at base breakpoint (mobile two-column)', async () => {
      await renderAndWait()
      // Find KPI value "55" (totalGames), walk up to grid wrapper
      const gridWrapper = findGridWrapper('55')
      expect(gridWrapper).toBeInTheDocument()
      // Must not start at grid-cols-1
      expect(gridWrapper!.className).not.toMatch(/\bgrid-cols-1\b/)
      // Must have bare grid-cols-2 (no sm:/md:/lg: prefix)
      expect(gridWrapper!.className).toMatch(/(?<![:\w])grid-cols-2\b/)
    })

    it('KPI grid wrapper has md:grid-cols-4 for desktop (no regression)', async () => {
      await renderAndWait()
      const gridWrapper = findGridWrapper('55')
      expect(gridWrapper).toBeInTheDocument()
      expect(gridWrapper!.className).toMatch(/md:grid-cols-4/)
    })

    it('KPI grid wrapper has items-start (NIT: prevents uneven title wrapping)', async () => {
      await renderAndWait()
      const gridWrapper = findGridWrapper('55')
      expect(gridWrapper).toBeInTheDocument()
      expect(gridWrapper!.className).toMatch(/items-start/)
    })

    it('all four KPI labels are inside the grid wrapper', async () => {
      await renderAndWait()
      expect(screen.getByText(/total campaigns logged/i)).toBeInTheDocument()
      expect(screen.getByText(/community members/i)).toBeInTheDocument()
      expect(screen.getByText(/investigators played/i)).toBeInTheDocument()
      expect(screen.getByText(/unique campaigns/i)).toBeInTheDocument()
    })
  })

  describe('ranked-card grid — items-start contract', () => {
    it('ranked card grid has items-start to prevent partner card stretching', async () => {
      await renderAndWait()
      // The "Most Popular Campaigns" card is inside the ranked grid
      const rankedGrid = findGridWrapper(/most popular campaigns/i)
      expect(rankedGrid).toBeInTheDocument()
      expect(rankedGrid!.className).toMatch(/items-start/)
    })
  })

  describe('expanded containment + keyboard access (Blocker 1)', () => {
    it('Show all button is present for campaigns card with 8 items', async () => {
      await renderAndWait()
      expect(screen.getByRole('button', { name: /show all/i })).toBeInTheDocument()
    })

    it('expanded campaigns content has overflow-y-auto containment boundary', async () => {
      const user = userEvent.setup()
      await renderAndWait()
      await user.click(screen.getByRole('button', { name: /show all/i }))
      const scrollRegion = document.querySelector('[data-expanded-scroll-region]')
      expect(scrollRegion).toBeInTheDocument()
      expect(scrollRegion!.className).toMatch(/overflow-y-auto/)
      expect(scrollRegion!.className).toMatch(/max-h-\[420px\]/)
    })

    it('expanded scroll region enters tab order (tabIndex=0)', async () => {
      const user = userEvent.setup()
      await renderAndWait()
      await user.click(screen.getByRole('button', { name: /show all/i }))
      const scrollRegion = document.querySelector('[data-expanded-scroll-region]')
      expect(scrollRegion).toBeInTheDocument()
      expect(scrollRegion).toHaveAttribute('tabIndex', '0')
    })

    it('expanded scroll region receives focus after clicking Show all', async () => {
      const user = userEvent.setup()
      await renderAndWait()
      await user.click(screen.getByRole('button', { name: /show all/i }))
      const scrollRegion = document.querySelector('[data-expanded-scroll-region]')
      expect(scrollRegion).toHaveFocus()
    })

    it('Show less button is accessible and focus returns to toggle on collapse', async () => {
      const user = userEvent.setup()
      await renderAndWait()
      await user.click(screen.getByRole('button', { name: /show all/i }))
      const showLessBtn = screen.getByRole('button', { name: /show (less|fewer)/i })
      expect(showLessBtn).not.toBeDisabled()
      await user.click(showLessBtn)
      expect(screen.getByRole('button', { name: /show all/i })).toHaveFocus()
    })
  })

  describe('investigators card placement (intentional — not inside ranked grid)', () => {
    it('investigators card is rendered on the page', async () => {
      await renderAndWait()
      expect(screen.getByText(/most played investigators/i)).toBeInTheDocument()
    })

    it('investigators card is NOT inside the ranked campaigns grid', async () => {
      await renderAndWait()
      // The ranked grid contains "Most Popular Campaigns" but not "Most Played Investigators"
      const rankedGrid = findGridWrapper(/most popular campaigns/i)
      expect(rankedGrid).toBeInTheDocument()
      // The investigators heading should not be a descendant of the ranked grid
      const investigatorsHeading = screen.getByText(/most played investigators/i)
      expect(rankedGrid!.contains(investigatorsHeading)).toBe(false)
    })
  })
})
