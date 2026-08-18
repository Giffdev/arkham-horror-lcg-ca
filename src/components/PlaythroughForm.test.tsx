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
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn()
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

describe('PlaythroughForm continue-campaign seeding', () => {
  it('prefills campaign identity and defaults to the first canonical Path to Carcosa scenario for new continuation logs', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    const seedPlaythrough: Playthrough = {
      id: 'existing-log-42',
      date: '2026-07-20',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      investigators: [
        { playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' },
      ],
    }

    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
        seedPlaythrough={seedPlaythrough}
      />,
    )

    expect(screen.getByText('Continue Campaign')).toBeInTheDocument()
    expect(screen.getByLabelText('Campaign')).toHaveValue('The Path to Carcosa')
    expect(screen.getByText('Scenario')).toBeInTheDocument()
    expect(screen.queryByText('Campaign Type')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('Curtain Call')
    const lockedCampaignInput = screen.getByLabelText('Campaign') as HTMLInputElement
    expect(lockedCampaignInput).toHaveAttribute('readonly')
    expect(lockedCampaignInput).toHaveClass('text-foreground', 'opacity-100')

    await user.click(screen.getByRole('button', { name: /save playthrough/i }))

    expect(onSave).toHaveBeenCalledOnce()
    const saved = onSave.mock.calls[0][0] as Omit<Playthrough, 'id'>
    expect(saved.campaignName).toBe('The Path to Carcosa')
    expect(saved.campaignType).toBe('Full Campaign')
    expect(saved.scenarioName).toBe('Curtain Call')
    expect((saved as Playthrough).id).toBeUndefined()
  })

  it('lists Path to Carcosa canonical scenarios in order and does not include campaign title as a scenario option', async () => {
    const user = userEvent.setup()
    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        seedPlaythrough={{
          id: 'path-seed',
          date: '2026-08-12',
          campaignName: 'The Path to Carcosa',
          campaignType: 'Full Campaign',
          investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
        }}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Scenario' }))
    const listbox = await screen.findByRole('listbox')
    const options = within(listbox)
      .getAllByRole('option')
      .map(option => option.textContent ?? '')

    expect(options[0]).toContain('Curtain Call')
    expect(options[1]).toContain('The Last King')
    expect(options).not.toContain('The Path to Carcosa')
  })

  it('defaults to the next Path to Carcosa scenario when a prior one is already logged', () => {
    const seed: Playthrough = {
      id: 'path-root',
      date: '2026-08-11',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
    }

    const priorScenario: Playthrough = {
      ...seed,
      id: 'path-s1',
      scenarioName: 'Curtain Call',
    }

    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        seedPlaythrough={seed}
        campaignHistory={[seed, priorScenario]}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('The Last King')
  })

  it('reuses Path to Carcosa canonical progression for Return to The Path to Carcosa', () => {
    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        seedPlaythrough={{
          id: 'return-path-root',
          date: '2026-08-13',
          campaignName: 'Return to The Path to Carcosa',
          campaignType: 'Full Campaign',
          campaignSet: 'Return to The Path to Carcosa',
          investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
        }}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('Curtain Call')
  })

  it('resolves the Return to the Circle Undone alias in the continuation dropdown', () => {
    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        seedPlaythrough={{
          id: 'return-circle-root',
          date: '2026-08-13',
          campaignName: 'Return to the Circle Undone',
          campaignType: 'Full Campaign',
          campaignSet: 'Return to The Circle Undone',
          investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
        }}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('The Witching Hour')
  })

  it('uses the canonical progression contract for branch-capable campaigns instead of local fallback lists', async () => {
    const user = userEvent.setup()
    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        seedPlaythrough={{
          id: 'dunwich-root',
          date: '2026-08-12',
          campaignName: 'The Dunwich Legacy',
          campaignType: 'Full Campaign',
          investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
        }}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('Extracurricular Activity')

    await user.click(screen.getByRole('combobox', { name: 'Scenario' }))
    const listbox = await screen.findByRole('listbox')
    const options = within(listbox)
      .getAllByRole('option')
      .map(option => option.textContent ?? '')

    expect(options[0]).toContain('Extracurricular Activity')
    expect(options[1]).toContain('The House Always Wins')
    expect(options).toContain('Lost in Time and Space')
  })

  it('resolves the seeded Core 2026 alias before progression lookup', () => {
    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        seedPlaythrough={{
          id: 'core-2026-gap-seed',
          date: '2026-08-12',
          campaignName: 'The Brethren of the Ash',
          campaignSet: 'Core 2026',
          campaignType: 'Unknown',
          investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
        }}
      />,
    )

    expect(screen.getByText('Small Campaign')).toBeInTheDocument()
    expect(screen.getByLabelText('Campaign')).toHaveValue('Brethren of Ash')
    expect(screen.queryByDisplayValue('Children of Blood')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('Spreading Flames')
  })

  it('offers the Drowned City east/west route choice after One Last Job', async () => {
    const user = userEvent.setup()
    const opening: Playthrough = {
      id: 'drowned-city-opening',
      date: '2026-08-12',
      campaignName: 'The Drowned City',
      campaignSet: 'The Drowned City',
      campaignType: 'Full Campaign',
      scenarioName: 'One Last Job',
      investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
    }
    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        seedPlaythrough={opening}
        campaignHistory={[opening]}
      />,
    )

    const scenario = screen.getByRole('combobox', { name: 'Scenario' })
    expect(scenario).toHaveTextContent('The Western Wall')
    await user.click(scenario)
    const options = within(await screen.findByRole('listbox')).getAllByRole('option')
      .map(option => option.textContent)
    expect(options).toEqual(['The Western Wall', 'Obsidian Canyons'])
  })

  it('applies dark calendar control styling on the date input in continuation mode', () => {
    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        seedPlaythrough={{
          id: 'seed-dark-calendar',
          date: '2026-08-12',
          campaignName: 'The Path to Carcosa',
          campaignType: 'Full Campaign',
          investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
        }}
      />,
    )

    const dateInput = screen.getByLabelText('Date')
    expect(dateInput.className).toContain('[color-scheme:dark]')
    expect(dateInput.className).toContain('[&::-webkit-calendar-picker-indicator]:invert')
    expect(dateInput.className).toContain('[&::-webkit-calendar-picker-indicator]:brightness-0')
    expect(dateInput.className).toContain('[-webkit-text-fill-color:currentColor]')

    const lockedCampaignInput = screen.getByLabelText('Campaign')
    expect(lockedCampaignInput).toHaveAttribute('readonly')
    expect(lockedCampaignInput.className).toContain('text-foreground')
    expect(lockedCampaignInput.className).toContain('opacity-100')

    const scenarioTrigger = screen.getByRole('combobox', { name: 'Scenario' })
    expect(scenarioTrigger.className).toContain('text-foreground')
  })

  it('defaults a new Drowned City continuation to its guide-backed opening scenario', () => {
    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        seedPlaythrough={{
          id: 'drowned-city-seed',
          date: '2026-08-12',
          campaignName: 'The Drowned City',
          campaignType: 'Full Campaign',
          investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
        }}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('One Last Job')
    expect(screen.queryByText(/No local Drowned City/i)).not.toBeInTheDocument()
  })
})

describe('PlaythroughForm campaign dropdown ordering', () => {
  const SMALL_CAMPAIGN_SEED: Playthrough = {
    id: 'small-campaign-seed',
    date: '2026-01-01',
    campaignName: '',
    campaignType: 'Small Campaign',
    investigators: [{ playerName: 'P1', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
  }

  const getVisibleOptionTexts = () =>
    screen
      .getAllByRole('option')
      .filter(option => !option.hasAttribute('hidden'))
      .map(option => option.textContent ?? '')

  it('orders short-campaign choices deterministically, preserving structured progression before alphabetical tie-breaks', async () => {
    const user = userEvent.setup()
    render(
      <PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={SMALL_CAMPAIGN_SEED} />,
    )

    await user.click(screen.getByText('Select campaign...'))
    const optionTexts = getVisibleOptionTexts()

    const brethrenIndex = optionTexts.findIndex(text => text.includes('Brethren of Ash'))
    const childrenIndex = optionTexts.findIndex(text => text.includes('Children of Blood'))
    const returnToIndex = optionTexts.findIndex(text => text.includes('Return to The Night of the Zealot'))
    const zealotIndex = optionTexts.findIndex(
      text => text.includes('The Night of the Zealot') && !text.includes('Return to The Night of the Zealot'),
    )

    expect(brethrenIndex).toBeGreaterThanOrEqual(0)
    expect(childrenIndex).toBeGreaterThanOrEqual(0)
    expect(returnToIndex).toBeGreaterThanOrEqual(0)
    expect(zealotIndex).toBeGreaterThanOrEqual(0)

    expect(childrenIndex).toBeLessThan(brethrenIndex)
    expect(childrenIndex).toBeLessThan(returnToIndex)
    expect(returnToIndex).toBeLessThan(zealotIndex)
  })

  it('preserves the same campaign order when filtering search results', async () => {
    const user = userEvent.setup()
    render(
      <PlaythroughForm open onOpenChange={vi.fn()} onSave={vi.fn()} editPlaythrough={SMALL_CAMPAIGN_SEED} />,
    )

    await user.click(screen.getByText('Select campaign...'))
    await user.type(screen.getByPlaceholderText('Search campaigns...'), 'the')

    const optionTexts = getVisibleOptionTexts()
    const returnToIndex = optionTexts.findIndex(text => text.includes('Return to The Night of the Zealot'))
    const zealotIndex = optionTexts.findIndex(
      text => text.includes('The Night of the Zealot') && !text.includes('Return to The Night of the Zealot'),
    )

    expect(returnToIndex).toBeGreaterThanOrEqual(0)
    expect(zealotIndex).toBeGreaterThanOrEqual(0)
    expect(returnToIndex).toBeLessThan(zealotIndex)
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

  it('hides side-story controls and persists rich per-investigator standalone results', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
        editPlaythrough={{
          ...SCENARIO_PACK_SEED,
          campaignName: 'Traces To Nowhere',
          scenarioName: 'Traces To Nowhere',
          sideStories: ['Legacy imported side story'],
        }}
      />,
    )

    expect(screen.queryByRole('button', { name: /side stories/i })).toBeNull()
    expect(screen.getByText('Scenario Results')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Resolution' }))
    await user.click(await screen.findByRole('option', { name: 'Named' }))
    await user.type(screen.getByLabelText('Resolution Detail'), 'Resolution A')
    await user.type(screen.getByLabelText('XP earned for Roland Banks'), '5')
    await user.type(screen.getByLabelText('Physical trauma for Roland Banks'), '1')
    await user.type(screen.getByLabelText('Mental trauma for Roland Banks'), '2')
    await user.click(screen.getByRole('button', { name: 'Update Playthrough' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 'seed',
      campaignType: 'Scenario Pack',
      scenarioName: 'Traces To Nowhere',
      scenarioType: 'standard',
      sideStories: ['Legacy imported side story'],
      resolution: { type: 'named', value: 'Resolution A' },
      investigatorOutcomes: [expect.objectContaining({
        investigatorName: 'Roland Banks',
        xpEarned: 5,
        traumaGainedPhysical: 1,
        traumaGainedMental: 2,
      })],
    }))
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
