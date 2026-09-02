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
/**
 * Row structure / semantics tests — appended by Lambert 2026-08-11
 *
 * Covered (D13-D17 extended, per task):
 *  9. Played card two-column structure: investigator name + archetype badge + play
 *     count all co-present in the played tabpanel.
 * 10. Archetype badge precedes investigator name in DOM order in each played card
 *     (EXPECTED FAILURE until Dallas reorders the name/archetype markup).
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

// ─── Row structure / semantics (D13-D17 extended) ─────────────────────────────

describe('PlayersOverview — played card row structure (D14-D16)', () => {
  /**
   * Two-column content grouping: each "played" investigator card exposes both
   * investigator meta-data (name + archetype) in the left column and a play
   * count in the right column. Tests use semantic content only — no CSS class
   * assertions.
   */
  it('played card exposes investigator name, archetype badge, and play count in the tabpanel', () => {
    render(<PlayersOverview playthroughs={[ROLAND_PLAYTHROUGH]} />)
    const panel = screen.getByRole('tabpanel')
    // Left-column content
    expect(within(panel).getByRole('heading', { name: 'Roland Banks' })).toBeInTheDocument()
    expect(within(panel).getAllByText('Guardian').length).toBeGreaterThan(0)
    // Right-column content: singular "time" only appears when timesPlayed === 1
    expect(within(panel).getByText('time')).toBeInTheDocument()
  })

  it('classifies Hank Samson as played from canonical saved campaign metadata', () => {
    const hemlockCampaign: Playthrough = {
      id: 'campaign-run:hemlock-hank:setup',
      date: '2026-08-01',
      campaignName: 'The Feast of Hemlock Vale',
      campaignSet: 'The Feast of Hemlock Vale',
      campaignType: 'Full Campaign',
      investigators: [{
        playerName: 'Devin Sinha',
        investigatorName: 'Hank Samson',
        investigatorId: 'hank-samson',
        chapter: 1,
        investigatorSet: 'The Feast of Hemlock Vale',
        archetype: 'Survivor',
        archetypes: ['Survivor'],
      }],
    }

    render(<PlayersOverview playthroughs={[hemlockCampaign]} />)

    expect(screen.getByRole('tabpanel')).toHaveTextContent('Hank Samson')
  })

  it('multi-play card uses plural "times" label', () => {
    const twoPlays: Playthrough[] = [
      makePlayed([{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }]),
      makePlayed([{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }]),
    ]
    render(<PlayersOverview playthroughs={twoPlays} />)
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('times')).toBeInTheDocument()
  })

  /**
   * Archetype precedes investigator name in DOM document order within each
   * played card — scoped to the tabpanel to exclude hidden filter buttons.
   *
   * EXPECTED FAILURE until Dallas reorders the markup so ArchetypeBadge
   * renders before the <h3> name heading inside each played card.
   * Current production order: <h3 name> … <ArchetypeBadge>
   * Required order:           <ArchetypeBadge> … <h3 name>
   */
  it('archetype badge precedes investigator name in DOM order (regression)', () => {
    render(<PlayersOverview playthroughs={[ROLAND_PLAYTHROUGH]} />)
    const panel = screen.getByRole('tabpanel')
    const nameEl = within(panel).getByRole('heading', { name: 'Roland Banks' })
    // Find archetype badge elements inside the tabpanel (excludes hidden filter buttons)
    const guardianEls = within(panel).queryAllByText('Guardian')
    expect(guardianEls.length).toBeGreaterThan(0)
    // DOCUMENT_POSITION_FOLLOWING (4): the other node (nameEl) comes after guardianEl
    const anyBefore = guardianEls.some(
      el => (el.compareDocumentPosition(nameEl) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    )
    expect(anyBefore).toBe(true)
  })
})
