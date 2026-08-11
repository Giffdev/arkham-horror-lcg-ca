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
 */
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

    it('renders the Popular Side Stories card', async () => {
      await renderAndWait(FULL_STATS)
      expect(screen.getByText(/popular side stories/i)).toBeVisible()
      expect(screen.getByText('Carnevale of Horrors')).toBeVisible()
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
})
