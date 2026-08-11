import { render, screen, waitFor, within } from '@testing-library/react'
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

// ─────────────────────────────────────────────────────────────────────────────
// Date-hydration regression — 2026-08-11
// Bug: editing an existing playthrough left the date input blank/placeholder
// because setDate(editPlaythrough.date) was called with an ISO timestamp or
// other non-YYYY-MM-DD value, which <input type="date"> silently rejects.
// Fix: PlaythroughForm now calls setDate(toDateInputValue(editPlaythrough.date)).
//
// Production date formats handled by toDateInputValue (date-utils.ts):
//  1. YYYY-MM-DD          — current canonical stored format (Firestore & import)
//  2. YYYY-MM-DDTHH:…Z   — legacy Firestore ISO timestamp (lexically sliced)
//  3. MM/DD/YYYY          — legacy export/import round-trip format
//
// Timezone guard: toDateInputValue uses lexical slicing, never Date construction,
// so a stored '2026-08-01' can never silently shift to '2026-07-31' in UTC-N
// environments. Tests here use a calendar date that would shift in UTC-12.
// ─────────────────────────────────────────────────────────────────────────────

describe('PlaythroughForm — edit-mode date hydration regression', () => {
  /** Minimum valid edit playthrough; all tests build on this baseline. */
  const BASE: Playthrough = {
    id: 'hydration-regression',
    date: '2026-01-15',
    campaignName: 'The Night of the Zealot',
    campaignType: 'Full Campaign',
    investigators: [
      { playerName: 'P1', investigatorName: 'Roland Banks', archetype: 'Guardian' },
    ],
  }

  it('hydrates the date input with a stored YYYY-MM-DD date', () => {
    render(<PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={BASE} />)
    const input = screen.getByLabelText('Date') as HTMLInputElement
    // Must equal the stored date exactly — not empty, not today's date.
    expect(input.value).toBe('2026-01-15')
  })

  it('hydrates the date input from a stored ISO timestamp (legacy Firestore format)', () => {
    // Legacy Firestore documents stored full ISO 8601 strings before YYYY-MM-DD
    // was enforced. An <input type="date"> silently shows blank for any value
    // that is not exactly YYYY-MM-DD, so the form must normalise on load.
    const legacy: Playthrough = { ...BASE, date: '2026-01-15T22:30:00.000Z' }
    render(<PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={legacy} />)
    const input = screen.getByLabelText('Date') as HTMLInputElement
    expect(input.value).toBe('2026-01-15')
  })

  it('hydrates the date input from a legacy MM/DD/YYYY import format', () => {
    // The import round-trip (DataExportImport) historically wrote MM/DD/YYYY
    // strings that were stored verbatim. toDateInputValue re-orders these.
    const legacy: Playthrough = { ...BASE, date: '01/15/2026' }
    render(<PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={legacy} />)
    const input = screen.getByLabelText('Date') as HTMLInputElement
    expect(input.value).toBe('2026-01-15')
  })

  it('timezone guard: stored YYYY-MM-DD never shifts to the previous day', () => {
    // new Date('2026-08-01') parses as UTC midnight; in UTC-12 that local date
    // is 2026-07-31. toDateInputValue does purely lexical extraction, so this
    // cannot happen regardless of the test runner's timezone.
    const tzEdge: Playthrough = { ...BASE, date: '2026-08-01' }
    render(<PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={tzEdge} />)
    const input = screen.getByLabelText('Date') as HTMLInputElement
    expect(input.value).toBe('2026-08-01')
  })

  it('timezone guard: ISO timestamp date portion is preserved lexically (not converted via Date)', () => {
    // '2026-08-01T02:30:00.000Z' stored UTC. A user in UTC-5 would see
    // 2026-07-31 if the code did new Date(raw).toLocaleDateString(). Slicing
    // raw.slice(0,10) always gives '2026-08-01'.
    const tsEdge: Playthrough = { ...BASE, date: '2026-08-01T02:30:00.000Z' }
    render(<PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={tsEdge} />)
    const input = screen.getByLabelText('Date') as HTMLInputElement
    expect(input.value).toBe('2026-08-01')
  })

  it('submit without changing date calls onSave with the original YYYY-MM-DD date', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<PlaythroughForm open onOpenChange={vi.fn()} onSave={onSave} editPlaythrough={BASE} />)
    await user.click(screen.getByRole('button', { name: /update playthrough/i }))
    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0]).toMatchObject({ date: '2026-01-15' })
  })

  it('submit of a legacy ISO-timestamp playthrough saves the normalised YYYY-MM-DD date', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const legacy: Playthrough = { ...BASE, date: '2026-01-15T22:30:00.000Z' }
    render(<PlaythroughForm open onOpenChange={vi.fn()} onSave={onSave} editPlaythrough={legacy} />)
    await user.click(screen.getByRole('button', { name: /update playthrough/i }))
    expect(onSave).toHaveBeenCalledOnce()
    // Regardless of what was stored, onSave must receive a clean YYYY-MM-DD date.
    expect(onSave.mock.calls[0][0]).toMatchObject({ date: '2026-01-15' })
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

// ─────────────────────────────────────────────────────────────────────────────
// Legacy entry — edit + add side story + save regression (2026-08-11)
//
// Reported bug: user edits a legacy playthrough (missing optional metadata),
// corrects the date, adds a side scenario, clicks Update — receives generic
// "Save failed" with no specific reason, and loses their edits because the
// form closes before the async save settles.
//
// Root cause in PlaythroughForm.handleSubmit:
//   onSave(...)        ← no await
//   onOpenChange(false) ← fires unconditionally, before promise settles
//
// The generic "Failed to save playthrough" comes from App.tsx which catches
// the rejected promise downstream — the form itself surfaces nothing.
//
// Legacy fixture characteristics:
//  - date stored as ISO timestamp (pre-toDateInputValue era)
//  - investigators have only `archetype` (no `archetypes[]`)
//  - no `sideStories`, no `notes`, no `campaignSet`
//
// Test 1 (PASSES now): payload assembled correctly — original fields intact,
//   side story included, archetypes normalised from archetype fallback.
// Test 2 (FAILS now): form must not close and must surface the rejection reason
//   when onSave rejects — both contracts currently broken.
// ─────────────────────────────────────────────────────────────────────────────

describe('PlaythroughForm — legacy edit + add side story regression', () => {
  /**
   * Represents a playthrough written before Wave 2 optional-metadata fields:
   * no sideStories, no archetypes[], no notes, no campaignSet.
   * Date is an ISO timestamp (pre-toDateInputValue era).
   */
  const LEGACY_ENTRY: Playthrough = {
    id: 'legacy-entry-001',
    date: '2026-03-10T18:45:00.000Z', // ISO timestamp — normalised to '2026-03-10' on load
    campaignName: 'The Night of the Zealot',
    campaignType: 'Full Campaign',
    // sideStories intentionally absent
    // notes intentionally absent
    // campaignSet intentionally absent
    investigators: [
      {
        playerName: 'Alice',
        investigatorName: 'Roland Banks',
        archetype: 'Guardian',
        // archetypes[] intentionally absent — form must normalise to ['Guardian']
        // investigatorSet, isUnknown, isCustom intentionally absent
      },
      {
        playerName: 'Bob',
        investigatorName: 'Wendy Adams',
        archetype: 'Survivor',
      },
    ],
  }

  it('loads legacy entry and hydrates date input correctly', () => {
    render(<PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={LEGACY_ENTRY} />)
    const input = screen.getByLabelText('Date') as HTMLInputElement
    expect(input.value).toBe('2026-03-10')
  })

  it('assembled update payload preserves original data and includes new side story', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
        editPlaythrough={LEGACY_ENTRY}
      />,
    )

    // Date is pre-hydrated — no user action needed
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-03-10')

    // Expand side stories and add Traces To Nowhere
    await user.click(screen.getByRole('button', { name: /side stories/i }))
    const checkbox = await screen.findByRole('checkbox', { name: /traces to nowhere/i })
    await user.click(checkbox)
    expect(checkbox).toBeChecked()

    // Submit
    await user.click(screen.getByRole('button', { name: /update playthrough/i }))
    expect(onSave).toHaveBeenCalledOnce()

    const saved = onSave.mock.calls[0][0] as Playthrough

    // Identity preserved
    expect(saved.id).toBe('legacy-entry-001')

    // Date normalised
    expect(saved.date).toBe('2026-03-10')

    // Campaign fields preserved
    expect(saved.campaignName).toBe('The Night of the Zealot')
    expect(saved.campaignType).toBe('Full Campaign')

    // New side story included
    expect(saved.sideStories).toContain('Traces To Nowhere')

    // Both investigators preserved
    expect(saved.investigators).toHaveLength(2)
    expect(saved.investigators[0]).toMatchObject({
      playerName: 'Alice',
      investigatorName: 'Roland Banks',
      archetype: 'Guardian',
    })
    // archetypes[] normalised from archetype fallback (useEffect: archetypes || [archetype])
    expect(saved.investigators[0].archetypes).toEqual(['Guardian'])
    expect(saved.investigators[1]).toMatchObject({
      playerName: 'Bob',
      investigatorName: 'Wendy Adams',
      archetype: 'Survivor',
    })
    expect(saved.investigators[1].archetypes).toEqual(['Survivor'])
  })

  it('does not close the form and surfaces a specific error reason when onSave rejects', async () => {
    /**
     * EXPECTED TO FAIL until PlaythroughForm.handleSubmit is made async and
     * wraps onSave in try/catch.
     *
     * Current behaviour (broken):
     *   - onSave(...) called without await
     *   - onOpenChange(false) fires synchronously → form closes unconditionally
     *   - rejected promise propagates to App.tsx which shows generic toast
     *   - user loses edits and sees no actionable reason
     *
     * Required behaviour (fixed):
     *   - handleSubmit awaits onSave
     *   - if onSave rejects, onOpenChange(false) is NOT called
     *   - an inline save-error message with the rejection reason is rendered
     */
    const user = userEvent.setup()
    const ERROR_MESSAGE = 'Permission denied: Firestore write rejected'
    const onSave = vi.fn().mockRejectedValue(new Error(ERROR_MESSAGE))
    const onOpenChange = vi.fn()

    render(
      <PlaythroughForm
        open
        onOpenChange={onOpenChange}
        onSave={onSave}
        editPlaythrough={LEGACY_ENTRY}
      />,
    )

    await user.click(screen.getByRole('button', { name: /side stories/i }))
    await user.click(await screen.findByRole('checkbox', { name: /traces to nowhere/i }))
    await user.click(screen.getByRole('button', { name: /update playthrough/i }))

    // Contract 1: form must NOT close on failure — onOpenChange(false) must not have fired.
    // FAILS currently: handleSubmit calls onOpenChange(false) synchronously regardless.
    expect(onOpenChange).not.toHaveBeenCalledWith(false)

    // Contract 2: a specific error reason must appear in the form.
    // FAILS currently: no error is rendered; the generic toast fires in App.tsx instead.
    await waitFor(
      () => expect(screen.getByText(/permission denied|firestore write rejected/i)).toBeVisible(),
      { timeout: 1500 },
    )
  })
})
