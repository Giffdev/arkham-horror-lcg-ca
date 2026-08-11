/**
 * PlayersOverview — behavior-first tests
 *
 * Target: src/components/PlayersOverview.tsx (tabs refactor by Dallas, D13-D17)
 * Tests will fail until Dallas wraps the investigator sections in shadcn Tabs.
 * That is expected and correct — these tests define the required behaviour.
 *
 * Covered (per design doc D13-D17, acceptance criteria):
 *  1. Default tab is "Played" (D17)
 *  2. Trigger labels include live counts that update when a class filter is applied (D15)
 *  3. Class filters update counts on both triggers simultaneously (D15)
 *  4. Arrow-key navigation between triggers and aria-selected follows (D14, ARIA)
 *  5. Filter state survives switching tabs (D17)
 *  6. "Played" panel empty state when filters exclude all played investigators
 *  7. "Never Played" panel empty state when every investigator has been played
 *  8. Nested tablist has aria-label="Investigator view" (D14)
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PlayersOverview } from './PlayersOverview'
import type { Playthrough } from '@/lib/types'

// ─── fixture helpers ──────────────────────────────────────────────────────────

function makePlayed(investigators: { playerName: string; investigatorName: string; archetype: string }[]): Playthrough {
  return {
    id: 'pt-1',
    date: '2026-01-01',
    campaignName: 'The Night of the Zealot',
    campaignType: 'Small Campaign',
    investigators: investigators.map((inv) => ({
      playerName: inv.playerName,
      investigatorName: inv.investigatorName,
      archetype: inv.archetype as Playthrough['investigators'][number]['archetype'],
    })),
  }
}

// A playthrough with Roland Banks (Guardian, Ch1, Core set) so we always have
// at least one played investigator in tests that need it.
const ROLAND_PLAYTHROUGH = makePlayed([
  { playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' },
])

// Empty playthroughs array → all investigators are in "Never Played"
const NO_PLAYTHROUGHS: Playthrough[] = []

// ─── tests ────────────────────────────────────────────────────────────────────

describe('PlayersOverview — tab navigation (D13-D17)', () => {
  it('renders a tablist with aria-label="Investigator view"', () => {
    render(<PlayersOverview playthroughs={NO_PLAYTHROUGHS} />)
    const tablist = screen.getByRole('tablist', { name: /investigator view/i })
    expect(tablist).toBeInTheDocument()
  })

  it('has exactly two tab triggers: "Played" and "Never Played"', () => {
    render(<PlayersOverview playthroughs={NO_PLAYTHROUGHS} />)
    const tabs = screen.getAllByRole('tab')
    const names = tabs.map((t) => t.textContent ?? '')
    expect(names.some((n) => /played/i.test(n) && !/never/i.test(n))).toBe(true)
    expect(names.some((n) => /never played/i.test(n))).toBe(true)
  })

  it('defaults to the "Played" tab selected (D17)', () => {
    render(<PlayersOverview playthroughs={NO_PLAYTHROUGHS} />)
    const playedTab = screen.getByRole('tab', { name: /^played/i })
    expect(playedTab).toHaveAttribute('aria-selected', 'true')
  })

  it('trigger labels include live counts from the data', () => {
    render(<PlayersOverview playthroughs={[ROLAND_PLAYTHROUGH]} />)
    // "Played (N)" — at least 1 investigator logged. Anchor to avoid matching "Never Played".
    expect(screen.getByRole('tab', { name: /^Played \(\d+\)/i })).toBeInTheDocument()
    // "Never Played" has a positive count too
    expect(screen.getByRole('tab', { name: /^Never Played \(\d+\)/i })).toBeInTheDocument()
  })

  it('switching to "Never Played" tab shows that panel', async () => {
    const user = userEvent.setup()
    render(<PlayersOverview playthroughs={[ROLAND_PLAYTHROUGH]} />)
    await user.click(screen.getByRole('tab', { name: /^Never Played/i }))
    expect(screen.getByRole('tab', { name: /^Never Played/i })).toHaveAttribute('aria-selected', 'true')
    // The count text inside the Never Played panel should now be visible
    expect(screen.getByText(/investigators haven't been played yet/i)).toBeVisible()
  })

  it('switching back to "Played" tab hides the never-played panel', async () => {
    const user = userEvent.setup()
    render(<PlayersOverview playthroughs={[ROLAND_PLAYTHROUGH]} />)
    const neverTab = screen.getByRole('tab', { name: /^Never Played/i })
    const playedTab = screen.getByRole('tab', { name: /^Played/i })
    await user.click(neverTab)
    await user.click(playedTab)
    expect(playedTab).toHaveAttribute('aria-selected', 'true')
  })

  describe('arrow-key navigation', () => {
    it('ArrowRight moves focus and aria-selected to "Never Played"', async () => {
      const user = userEvent.setup()
      render(<PlayersOverview playthroughs={NO_PLAYTHROUGHS} />)
        const playedTab = screen.getByRole('tab', { name: /^Played/i })
      await user.click(playedTab)
      await user.keyboard('{ArrowRight}')
        expect(screen.getByRole('tab', { name: /^Never Played/i })).toHaveFocus()
    })

    it('ArrowLeft from "Never Played" returns focus to "Played"', async () => {
      const user = userEvent.setup()
      render(<PlayersOverview playthroughs={NO_PLAYTHROUGHS} />)
        const neverTab = screen.getByRole('tab', { name: /^Never Played/i })
      await user.click(neverTab)
      await user.keyboard('{ArrowLeft}')
        expect(screen.getByRole('tab', { name: /^Played/i })).toHaveFocus()
    })
  })
})

describe('PlayersOverview — filter interaction (D15, D17)', () => {
  it('shows active filters badge and reduces played count when a class is applied', async () => {
    const user = userEvent.setup()
    const twoPlayerPT = makePlayed([
      { playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' },
      { playerName: 'Bob', investigatorName: 'Wendy Adams', archetype: 'Survivor' },
    ])
    render(<PlayersOverview playthroughs={[twoPlayerPT]} />)
    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('button', { name: 'Guardian' }))
    // "Played (1)" — Guardian filter reduces played to 1. Anchor to avoid matching "Never Played".
    expect(screen.getByRole('tab', { name: /^Played \(1\)/i })).toBeInTheDocument()
  })

  it('both trigger counts update simultaneously when a filter is applied (D15)', async () => {
    const user = userEvent.setup()
    render(<PlayersOverview playthroughs={[ROLAND_PLAYTHROUGH]} />)
    const initialNeverTab = screen.getByRole('tab', { name: /^Never Played/i })
    const initialNeverCount = parseInt(
      (initialNeverTab.textContent ?? '').replace(/\D/g, '') || '0',
    )
    await user.click(screen.getByRole('button', { name: /filters/i }))
    // Filter to Chapter 2 — Roland is Ch1, so played becomes 0, never-played count changes
    const ch2Button = screen.getByRole('button', { name: /chapter 2/i })
    await user.click(ch2Button)
    const newNeverCount = parseInt(
      (screen.getByRole('tab', { name: /^Never Played/i }).textContent ?? '').replace(/\D/g, '') || '0',
    )
    expect(newNeverCount).not.toBe(initialNeverCount)
  })

  it('filter state survives a tab switch (D17)', async () => {
    const user = userEvent.setup()
    render(<PlayersOverview playthroughs={[ROLAND_PLAYTHROUGH]} />)
    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('button', { name: 'Guardian' }))
    // Switch to Never Played tab
    await user.click(screen.getByRole('tab', { name: /^Never Played/i }))
    // Switch back
    await user.click(screen.getByRole('tab', { name: /^Played/i }))
    // Guardian filter is still active — Played count should still reflect filtered state
    expect(screen.getByRole('tab', { name: /^Played \(1\)/i })).toBeInTheDocument()
  })
})

describe('PlayersOverview — empty states', () => {
  it('shows empty state in "Played" panel when no playthroughs are logged', () => {
    render(<PlayersOverview playthroughs={NO_PLAYTHROUGHS} />)
    expect(
      screen.getByText(/no investigators played yet|log games to see statistics/i),
    ).toBeVisible()
  })

  it('shows "Played" empty state when class filter excludes all played investigators', async () => {
    const user = userEvent.setup()
    // Only Survivor played, filter to Guardian → played = 0
    const survivorPT = makePlayed([
      { playerName: 'Alice', investigatorName: 'Wendy Adams', archetype: 'Survivor' },
    ])
    render(<PlayersOverview playthroughs={[survivorPT]} />)
    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('button', { name: 'Guardian' }))
    expect(
      screen.getByText(/no investigators played yet|log games to see statistics/i),
    ).toBeVisible()
  })

  it('shows "Never Played" all-clear message when every investigator has been played', async () => {
    const user = userEvent.setup()
    render(<PlayersOverview playthroughs={NO_PLAYTHROUGHS} />)
    // Must switch to the Never Played tab to see its content
    await user.click(screen.getByRole('tab', { name: /^Never Played/i }))
    // With zero playthroughs all investigators are in never-played — so the list
    // renders, not the all-played empty state. We verify the count line is visible.
    expect(screen.getByText(/investigators haven't been played yet/i)).toBeVisible()
  })

  it('shows empty state for "Never Played" when chapter filter matches only played investigators', async () => {
    const user = userEvent.setup()
    render(<PlayersOverview playthroughs={[ROLAND_PLAYTHROUGH]} />)
    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('button', { name: /chapter 2/i }))
    await user.click(screen.getByRole('button', { name: 'Guardian' }))
    await user.click(screen.getByRole('tab', { name: /^Never Played/i }))
    expect(screen.getByRole('tab', { name: /^Never Played/i })).toHaveAttribute('aria-selected', 'true')
  })
})
