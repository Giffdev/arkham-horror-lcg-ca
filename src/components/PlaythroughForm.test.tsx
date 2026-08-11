import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeAll } from 'vitest'
import { PlaythroughForm } from './PlaythroughForm'
import type { Playthrough } from '@/lib/types'

// ResizeObserver is not available in jsdom; Radix Popover uses it.
// scrollIntoView is not available in jsdom; cmdk (Command) uses it.
beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn()
  }
})

describe('PlaythroughForm player controls', () => {
  it('prevents adding a fifth player and keeps remove controls visible', async () => {
    const user = userEvent.setup()
    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    )

    const addButton = screen.getByRole('button', { name: 'Add Investigator' })
    await user.click(addButton)
    await user.click(addButton)
    await user.click(addButton)

    expect(addButton).toBeDisabled()
    expect(screen.getByText('Player limit reached (4 maximum).')).toBeVisible()
    expect(screen.getByText('Investigators (4/4)')).toBeVisible()

    const removeButton = screen.getByRole('button', { name: 'Remove investigator 1' })
    expect(removeButton).toHaveClass('text-destructive', 'bg-destructive/10', 'focus-visible:ring-destructive/50')
    expect(removeButton).toHaveClass('self-end')
    expect(removeButton).not.toHaveClass('mt-7')
    expect(removeButton.parentElement).toHaveClass('flex', 'items-end')

    await user.click(removeButton)
    expect(addButton).toBeEnabled()
    expect(screen.getByText('Up to 4 players per playthrough.')).toBeVisible()
  })

  it('keeps a valid four-player playthrough editable', () => {
    const editPlaythrough: Playthrough = {
      id: 'playthrough-1',
      date: '2026-08-01',
      campaignName: 'Night of the Zealot',
      campaignType: 'Full Campaign',
      investigators: Array.from({ length: 4 }, (_, index) => ({
        playerName: `Player ${index + 1}`,
        investigatorName: `Investigator ${index + 1}`,
        archetype: 'Unknown',
      })),
    }

    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        editPlaythrough={editPlaythrough}
      />
    )

    expect(screen.getByRole('button', { name: 'Add Investigator' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Update Playthrough' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: /Remove investigator/ })).toHaveLength(4)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Traces To Nowhere — Scenario Pack (chapter 2)
// Design decisions D1, D2, D7 (Dallas: show · Ch. 2 badge in both pickers).
// The badge tests will fail until Dallas lands the chapter annotation.
// Presence tests (scenario selectable in both pickers) pass against current code.
// ─────────────────────────────────────────────────────────────────────────────

describe('PlaythroughForm — Traces To Nowhere (chapter 2 scenario)', () => {
  // Radix UI <Select> portals don't respond reliably to userEvent.click in jsdom.
  // Seed the campaign type via editPlaythrough to bypass Select interaction.
  // This directly exercises the combobox picker and side-story list, which are
  // the surfaces we care about for Traces To Nowhere visibility.

  const SCENARIO_PACK_SEED: Playthrough = {
    id: 'seed',
    date: '2026-01-01',
    campaignName: '',
    campaignType: 'Scenario Pack',
    investigators: [{ playerName: 'P1', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
  }

  const FULL_CAMPAIGN_SEED: Playthrough = {
    id: 'seed',
    date: '2026-01-01',
    campaignName: 'The Night of the Zealot',
    campaignType: 'Full Campaign',
    investigators: [{ playerName: 'P1', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
  }

  it('appears in the Scenario Pack campaign combobox', async () => {
    const user = userEvent.setup()
    render(
      <PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={SCENARIO_PACK_SEED} />,
    )
    // The campaign picker button shows "Select campaign..." when nothing selected
    await user.click(screen.getByText('Select campaign...'))
    // Traces To Nowhere must appear in the list
    expect(await screen.findByText('Traces To Nowhere')).toBeVisible()
  })

  it('is selectable as a Scenario Pack campaign', async () => {
    const user = userEvent.setup()
    render(
      <PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={SCENARIO_PACK_SEED} />,
    )
    await user.click(screen.getByText('Select campaign...'))
    await user.click(await screen.findByText('Traces To Nowhere'))
    // The combobox trigger must now display the selected name
    expect(screen.getByText('Traces To Nowhere')).toBeInTheDocument()
  })

  it('shows the chapter 2 badge next to Traces To Nowhere in the campaign combobox (D1 / Dallas)', async () => {
    const user = userEvent.setup()
    render(
      <PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={SCENARIO_PACK_SEED} />,
    )
    await user.click(screen.getByText('Select campaign...'))
    // Dallas renders <span>Ch. 2</span> inside the option row for chapter-2 entries.
    // Only Traces To Nowhere has chapter: 2 in SCENARIO_PACK_SCENARIOS, so exactly one badge.
    // Scope to within the [role="option"] row to be explicit about which item it's for.
    const item = await screen.findByText('Traces To Nowhere')
    const row = item.closest('[role="option"]')
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByText('Ch. 2')).toBeVisible()
  })

  it('appears in the side-story official scenarios list', async () => {
    const user = userEvent.setup()
    render(
      <PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={FULL_CAMPAIGN_SEED} />,
    )
    // Expand side stories
    await user.click(screen.getByRole('button', { name: /side stories/i }))
    expect(await screen.findByText('Traces To Nowhere')).toBeInTheDocument()
  })

  it('is checkable as a side story', async () => {
    const user = userEvent.setup()
    render(
      <PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={FULL_CAMPAIGN_SEED} />,
    )
    await user.click(screen.getByRole('button', { name: /side stories/i }))
    // Wait for the panel to render, then find the checkbox by its accessible name
    const checkbox = await screen.findByRole('checkbox', { name: /traces to nowhere/i })
    expect(checkbox).toBeInTheDocument()
    await user.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('shows the chapter 2 badge in the side-story list (D1 / Dallas)', async () => {
    const user = userEvent.setup()
    render(
      <PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={FULL_CAMPAIGN_SEED} />,
    )
    await user.click(screen.getByRole('button', { name: /side stories/i }))
    // Dallas renders a <span>Ch. 2</span> inside the label for chapter-2 scenarios.
    // Only Traces To Nowhere has chapter: 2, so exactly one such badge in this list.
    // PlaythroughForm has no Chapter filter buttons, so "Ch. 2" can only be this badge.
    expect(await screen.findByText('Ch. 2')).toBeVisible()
  })
})
