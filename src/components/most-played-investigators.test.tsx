import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommunityStats } from './CommunityStats'
import { PublicHomepage } from './PublicHomepage'
import { getCommunityStats, type CommunityStats as Stats } from '@/lib/community-stats'

vi.mock('@/lib/community-stats', () => ({
  getCommunityStats: vi.fn(),
  getCommunityStatsAvailability: vi.fn(() => 'ready'),
}))
vi.mock('@/components/AuthDialog', () => ({
  AuthDialog: () => null,
}))

function mockInvestigators(topInvestigators: Stats['topInvestigators']) {
  vi.mocked(getCommunityStats).mockResolvedValue({
    totalGames: 20,
    registeredUsers: 4,
    totalInvestigatorsPlayed: topInvestigators.length,
    topCampaigns: [],
    topInvestigators,
    topClasses: [],
    topSideScenarios: [],
    topStandalones: [],
    lastUpdated: Date.now(),
  })
}

describe.each([
  ['public homepage', () => <PublicHomepage onAuthSuccess={vi.fn()} />, false],
  ['community stats', () => <CommunityStats />, true],
] as const)('Most Played Investigators — %s', (_surface, renderSurface, linked) => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('distinguishes canonical same-name chapters without changing counts or link behavior', async () => {
    mockInvestigators([
      { investigatorId: 'joe-diamond', name: 'Joe Diamond', count: 8, archetypes: ['Seeker'] },
      { investigatorId: 'joe-diamond-ch2', name: 'Joe Diamond', count: 3, archetypes: ['Seeker'] },
    ])
    render(renderSurface())

    const names = await screen.findAllByText('Joe Diamond')
    expect(names).toHaveLength(2)
    for (const [index, name] of names.entries()) {
      const identity = name.closest('[data-name]')!
      const chapter = within(identity as HTMLElement).getByText(`Chapter ${index + 1}`).parentElement!
      expect(chapter).toHaveTextContent(`Ch. ${index + 1}`)
      expect(chapter).toBeVisible()
      expect(chapter).toHaveClass(index === 1 ? 'text-violet-400' : 'text-muted-foreground')
      const row = identity.parentElement!.parentElement!.parentElement!.parentElement!
      expect(within(row).getByText(`${index === 0 ? 8 : 3} campaigns`)).toBeVisible()
      if (linked) {
        expect(name).toHaveAttribute('href', `https://arkhamdb.com/card/${index === 0 ? '05002' : '12004'}`)
      } else {
        expect(name.tagName).toBe('SPAN')
      }
    }
  })

  it('uses existing chapter/set metadata and Parallel labels with wrapping names', async () => {
    const consoleError = vi.spyOn(console, 'error')
    mockInvestigators([
      { name: 'Joe Diamond', chapter: 1, count: 6, archetypes: ['Seeker'] },
      { name: 'Joe Diamond', investigatorSet: 'Core 2026', count: 4, archetypes: ['Seeker'] },
      { investigatorId: 'roland-banks-parallel', name: 'Roland Banks (Parallel)', count: 2, archetypes: ['Guardian'] },
      { investigatorId: 'miguel-de-la-cruz', name: 'Miguel de la Cruz', count: 1, archetypes: ['Survivor'] },
    ])
    render(renderSurface())

    const names = await screen.findAllByText('Joe Diamond')
    expect(within(names[0].closest('[data-name]') as HTMLElement).getByText('Chapter 1')).toHaveClass('sr-only')
    expect(within(names[1].closest('[data-name]') as HTMLElement).getByText('Chapter 2')).toHaveClass('sr-only')
    const parallel = screen.getByText('Roland Banks (Parallel)').closest('[data-name]')!
    expect(within(parallel as HTMLElement).getByText('Parallel').parentElement).toHaveTextContent('· Parallel')
    const longName = screen.getByText('Miguel de la Cruz')
    const identity = longName.closest('[data-name]')!
    expect(longName).toHaveClass('min-w-0', 'break-words')
    expect(identity).toHaveClass('flex-wrap', 'basis-32', 'min-w-0')
    expect(within(identity as HTMLElement).getByText('Chapter 2').parentElement).toHaveClass('whitespace-nowrap', 'flex-shrink-0')
    expect(identity.parentElement).toHaveClass('flex-wrap', 'min-w-0')
    expect(consoleError.mock.calls.some(args => String(args[0]).includes('same key'))).toBe(false)
    consoleError.mockRestore()
  })

  it('keeps name-only legacy aggregates and unknown/custom identities without an invented chapter', async () => {
    mockInvestigators([
      { name: 'Joe Diamond', count: 9, archetypes: ['Seeker'] },
      { name: 'Unknown', count: 5, archetypes: ['Unknown'] },
      { investigatorId: 'custom-investigator', name: 'A Custom Investigator', count: 2, archetypes: ['Mystic'] },
    ])
    render(renderSurface())

    await screen.findByText('Joe Diamond')
    for (const name of ['Joe Diamond', 'Unknown', 'A Custom Investigator']) {
      const identity = screen.getByText(name, { selector: '[data-name] > span, [data-name] > a' }).closest('[data-name]')!
      expect(identity).not.toHaveTextContent(/Ch\. [12]|Parallel/)
      expect(identity.querySelector('[data-chapter]')).toBeNull()
    }
    expect(screen.getByText('9 campaigns')).toBeVisible()
    expect(screen.getByText('5 campaigns')).toBeVisible()
    expect(screen.getByText('2 campaigns')).toBeVisible()
  })
})
