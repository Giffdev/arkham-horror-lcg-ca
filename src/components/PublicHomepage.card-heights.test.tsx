import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicHomepage } from './PublicHomepage'

vi.mock('@/lib/community-stats', () => ({
  getCommunityStats: vi.fn(),
  getCommunityStatsAvailability: vi.fn((stats: unknown) => (stats ? 'ready' : 'unavailable')),
}))

vi.mock('@/components/AuthDialog', () => ({
  AuthDialog: () => null,
}))

import { getCommunityStats } from '@/lib/community-stats'

const mockGetCommunityStats = vi.mocked(getCommunityStats)

const statsWithVariableKpiContent = {
  totalGames: 7,
  registeredUsers: 1234,
  totalInvestigatorsPlayed: 56,
  topCampaigns: [
    { name: 'A Campaign With A Deliberately Long Name', count: 3 },
    { name: 'Short Name', count: 2 },
  ],
  topInvestigators: [],
  topClasses: [],
  topStandalones: [],
  topSideScenarios: [],
  lastUpdated: Date.now(),
}

describe('PublicHomepage desktop campaign-stat card heights', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('stretches every KPI card only at the desktop breakpoint', async () => {
    mockGetCommunityStats.mockResolvedValueOnce(
      statsWithVariableKpiContent as Awaited<ReturnType<typeof getCommunityStats>>,
    )

    render(<PublicHomepage onAuthSuccess={vi.fn()} />)

    await waitFor(() =>
      expect(screen.getByText('Total Games Logged')).toBeInTheDocument(),
    )

    const totalCampaignsCard = screen
      .getByText('Total Games Logged')
      .closest('[data-slot="card"]')
    const kpiGrid = totalCampaignsCard?.parentElement

    expect(kpiGrid).toBeInTheDocument()
    expect(kpiGrid?.classList.contains('items-start')).toBe(true)
    expect(kpiGrid?.classList.contains('items-stretch')).toBe(false)
    expect(kpiGrid?.classList.contains('md:items-stretch')).toBe(true)

    const cards = Array.from(kpiGrid?.children ?? [])
    expect(cards).toHaveLength(4)
    for (const card of cards) {
      expect(card.classList.contains('h-full')).toBe(false)
      expect(card.classList.contains('md:h-full')).toBe(true)
    }
  })
})
