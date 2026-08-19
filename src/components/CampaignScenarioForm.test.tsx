import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { CampaignScenarioForm } from './CampaignScenarioForm'
import type { CampaignRun, CampaignScenarioLog } from '@/lib/types'

function makeRun(overrides: Partial<CampaignRun> = {}): CampaignRun {
  return {
    id: 'run-1',
    version: 2,
    campaignLineageId: 'campaign:path-to-carcosa',
    campaignName: 'The Path to Carcosa',
    campaignSet: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    startedAt: '2026-08-17',
    updatedAt: '2026-08-17T00:00:00.000Z',
    status: 'active',
    setupSnapshot: {
      date: '2026-08-17',
      investigators: [
        {
          playerName: 'Alice',
          investigatorName: 'Roland Banks',
          archetype: 'Guardian',
        },
      ],
    },
    currentRoster: [
      {
        seatId: 'seat:alice:1',
        slotId: 'seat:alice:1:slot:1',
        playerName: 'Alice',
        investigator: {
          playerName: 'Alice',
          investigatorName: 'Roland Banks',
          archetype: 'Guardian',
        },
        seatStatus: 'active',
        joinedAtScenarioIndex: 0,
        startedAtScenarioIndex: 0,
        xpTotal: 2,
        xpSpent: 0,
        physicalTrauma: 0,
        mentalTrauma: 0,
      },
    ],
    scenarioLogs: [],
    ...overrides,
  }
}

async function chooseScenarioType(user: ReturnType<typeof userEvent.setup>, label: 'Campaign Scenario' | 'Side Scenario') {
  await user.click(screen.getByRole('combobox', { name: 'Scenario Type' }))
  const options = await screen.findByRole('listbox')
  await user.click(within(options).getByRole('option', { name: label }))
}

describe('CampaignScenarioForm', () => {
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

  it('builds rich payload with canonical replacement metadata for appended scenarios', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const run = makeRun()

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={run}
        mode="append"
        onSave={onSave}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('Curtain Call')

    await user.click(screen.getByRole('combobox', { name: 'Outcome' }))
    const statusListbox = await screen.findByRole('listbox')
    await user.click(within(statusListbox).getByRole('option', { name: 'Killed' }))

    await user.click(screen.getByLabelText('Add replacement investigator'))
    const replacementPlayer = screen.getByLabelText('Player Slot')
    expect(replacementPlayer).toHaveAttribute('readonly')
    expect(replacementPlayer).toHaveClass('text-foreground', 'opacity-100')
    expect(screen.getByText(/Replacement stays on this player slot/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Archetype')).not.toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Replacement Investigator' }))
    const investigatorSearch = screen.getByPlaceholderText('Search investigators...')
    await user.type(investigatorSearch, 'stella')
    const replacementListbox = await screen.findByRole('listbox')
    await user.click(within(replacementListbox).getByRole('option', { name: /Stella Clark/i }))
    expect(screen.getByRole('combobox', { name: 'Replacement Investigator' })).toHaveTextContent('Stella Clark')
    expect(screen.getByTestId('replacement-metadata-seat:alice:1:slot:1')).toHaveTextContent('Survivor')
    expect(screen.getByTestId('replacement-metadata-seat:alice:1:slot:1')).toHaveTextContent('Investigator Starter Deck')

    await user.click(screen.getByRole('button', { name: 'Log Scenario' }))

    expect(onSave).toHaveBeenCalledOnce()
    const payload = onSave.mock.calls[0][0]
    expect(payload.scenarioName).toBe('Curtain Call')
    expect(payload.preScenarioAdjustments).toBeUndefined()
    expect(payload.investigatorOutcomes[0]).toMatchObject({
      playerName: 'Alice',
      investigatorName: 'Roland Banks',
      status: 'killed',
    })
    expect(payload.rosterChanges[0]).toMatchObject({
      type: 'replacement',
      seatId: 'seat:alice:1',
      previousSlotId: 'seat:alice:1:slot:1',
      reason: 'killed',
    })
    expect(payload.rosterChanges[0].newEntry.playerName).toBe('Alice')
    expect(payload.rosterChanges[0].newEntry.investigator).toMatchObject({
      playerName: 'Alice',
      investigatorName: 'Stella Clark',
      investigatorId: 'stella-clark',
      chapter: 1,
      investigatorSet: 'Evergreen Starters (Ch. 1)',
      archetype: 'Survivor',
    })
    expect(payload.rosterAfter).toHaveLength(2)
    expect(payload.rosterAfter[1]).toMatchObject({
      seatId: 'seat:alice:1',
      seatStatus: 'active',
      playerName: 'Alice',
    })
  })

  it('excludes the eliminated investigator from replacement choices and clears replacement when outcome changes', async () => {
    const user = userEvent.setup()

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun()}
        mode="append"
        onSave={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Outcome' }))
    let statusListbox = await screen.findByRole('listbox')
    await user.click(within(statusListbox).getByRole('option', { name: 'Killed' }))

    await user.click(screen.getByLabelText('Add replacement investigator'))
    await user.click(screen.getByRole('combobox', { name: 'Replacement Investigator' }))
    let replacementListbox = await screen.findByRole('listbox')
    expect(within(replacementListbox).queryByRole('option', { name: 'Roland Banks' })).not.toBeInTheDocument()
    await user.click(within(replacementListbox).getByRole('option', { name: /Stella Clark/i }))
    expect(screen.getByRole('combobox', { name: 'Replacement Investigator' })).toHaveTextContent('Stella Clark')

    await user.click(screen.getByRole('combobox', { name: 'Outcome' }))
    statusListbox = await screen.findByRole('listbox')
    await user.click(within(statusListbox).getByRole('option', { name: 'Survived' }))
    expect(screen.queryByRole('combobox', { name: 'Replacement Investigator' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Outcome' }))
    statusListbox = await screen.findByRole('listbox')
    await user.click(within(statusListbox).getByRole('option', { name: 'Killed' }))
    expect(screen.getByLabelText('Add replacement investigator')).not.toBeChecked()
  })

  it('seeds replacement picker and metadata in latest-scenario edit mode', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const scenarioLog: CampaignScenarioLog = {
      id: 'scenario-1',
      date: '2026-08-18',
      scenarioName: 'Curtain Call',
      investigators: makeRun().setupSnapshot.investigators,
      investigatorOutcomes: [
        {
          seatId: 'seat:alice:1',
          slotId: 'seat:alice:1:slot:1',
          playerName: 'Alice',
          investigatorName: 'Roland Banks',
          status: 'killed',
          xpEarned: 0,
          traumaGainedPhysical: 0,
          traumaGainedMental: 0,
        },
      ],
      rosterChanges: [
        {
          type: 'replacement',
          seatId: 'seat:alice:1',
          previousSlotId: 'seat:alice:1:slot:1',
          reason: 'killed',
          newEntry: {
            seatId: 'seat:alice:1',
            slotId: 'seat:alice:1:slot:2',
            playerName: 'Alice',
            investigator: {
              playerName: 'Alice',
              investigatorName: 'Stella Clark',
              investigatorId: 'stella-clark',
              chapter: 1,
              investigatorSet: 'Evergreen Starters (Ch. 1)',
              archetype: 'Survivor',
              archetypes: ['Survivor'],
            },
            seatStatus: 'active',
            joinedAtScenarioIndex: 0,
            startedAtScenarioIndex: 0,
            xpTotal: 0,
            xpSpent: 0,
            physicalTrauma: 0,
            mentalTrauma: 0,
          },
        },
      ],
      rosterBefore: makeRun().currentRoster,
      rosterAfter: [
        {
          ...makeRun().currentRoster[0],
          seatStatus: 'eliminated',
          endReason: 'killed',
          endedAtScenarioIndex: 0,
        },
        {
          seatId: 'seat:alice:1',
          slotId: 'seat:alice:1:slot:2',
          playerName: 'Alice',
          investigator: {
            playerName: 'Alice',
            investigatorName: 'Stella Clark',
            investigatorId: 'stella-clark',
            chapter: 1,
            investigatorSet: 'Evergreen Starters (Ch. 1)',
            archetype: 'Survivor',
            archetypes: ['Survivor'],
          },
          seatStatus: 'active',
          joinedAtScenarioIndex: 0,
          startedAtScenarioIndex: 0,
          xpTotal: 0,
          xpSpent: 0,
          physicalTrauma: 0,
          mentalTrauma: 0,
        },
      ],
    }

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun({ scenarioLogs: [scenarioLog], currentRoster: scenarioLog.rosterAfter })}
        mode="edit"
        scenarioLog={scenarioLog}
        onSave={onSave}
      />,
    )

    expect(screen.getByLabelText('Add replacement investigator')).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Replacement Investigator' })).toHaveTextContent('Stella Clark')
    expect(screen.getByTestId('replacement-metadata-seat:alice:1:slot:1')).toHaveTextContent('Survivor')

    await user.click(screen.getByRole('button', { name: 'Save Scenario' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      rosterChanges: expect.arrayContaining([
        expect.objectContaining({
          type: 'replacement',
          newEntry: expect.objectContaining({
            investigator: expect.objectContaining({
              investigatorId: 'stella-clark',
            }),
          }),
        }),
      ]),
    }))
  })

  it('assigns slot:3 for a second consecutive replacement on the same seat', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const run = makeRun({
      currentRoster: [
        {
          seatId: 'seat:alice:1',
          slotId: 'seat:alice:1:slot:2',
          playerName: 'Alice',
          investigator: {
            playerName: 'Alice',
            investigatorName: 'Stella Clark',
            investigatorId: 'stella-clark',
            chapter: 1,
            investigatorSet: 'Evergreen Starters (Ch. 1)',
            archetype: 'Survivor',
            archetypes: ['Survivor'],
          },
          seatStatus: 'active',
          joinedAtScenarioIndex: 0,
          startedAtScenarioIndex: 0,
          xpTotal: 4,
          xpSpent: 0,
          physicalTrauma: 1,
          mentalTrauma: 0,
        },
      ],
    })

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={run}
        mode="append"
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Outcome' }))
    const statusListbox = await screen.findByRole('listbox')
    await user.click(within(statusListbox).getByRole('option', { name: 'Killed' }))
    await user.click(screen.getByLabelText('Add replacement investigator'))
    await user.click(screen.getByRole('combobox', { name: 'Replacement Investigator' }))
    const investigatorSearch = screen.getByPlaceholderText('Search investigators...')
    await user.type(investigatorSearch, 'agnes')
    const replacementListbox = await screen.findByRole('listbox')
    await user.click(within(replacementListbox).getAllByRole('option')[0])

    await user.click(screen.getByRole('button', { name: 'Log Scenario' }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0].rosterChanges[0]).toMatchObject({
      seatId: 'seat:alice:1',
      previousSlotId: 'seat:alice:1:slot:2',
      newEntry: expect.objectContaining({
        slotId: 'seat:alice:1:slot:3',
      }),
    })
    expect(onSave.mock.calls[0][0].rosterAfter).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotId: 'seat:alice:1:slot:2',
        seatStatus: 'eliminated',
      }),
      expect.objectContaining({
        slotId: 'seat:alice:1:slot:3',
        seatStatus: 'active',
      }),
    ]))
  })

  it('keeps duplicate player-name seats isolated when creating replacements', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const run = makeRun({
      currentRoster: [
        {
          seatId: 'seat:alice:1',
          slotId: 'seat:alice:1:slot:1',
          playerName: 'Alice',
          investigator: {
            playerName: 'Alice',
            investigatorName: 'Roland Banks',
            archetype: 'Guardian',
          },
          seatStatus: 'active',
          joinedAtScenarioIndex: 0,
          startedAtScenarioIndex: 0,
          xpTotal: 0,
          xpSpent: 0,
          physicalTrauma: 0,
          mentalTrauma: 0,
        },
        {
          seatId: 'seat:alice:2',
          slotId: 'seat:alice:2:slot:1',
          playerName: 'Alice',
          investigator: {
            playerName: 'Alice',
            investigatorName: 'Daisy Walker',
            archetype: 'Seeker',
          },
          seatStatus: 'active',
          joinedAtScenarioIndex: 0,
          startedAtScenarioIndex: 0,
          xpTotal: 2,
          xpSpent: 0,
          physicalTrauma: 0,
          mentalTrauma: 0,
        },
      ],
    })

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={run}
        mode="append"
        onSave={onSave}
      />,
    )

    let daisyCard: HTMLElement | null = screen.getByText(/Alice\s+—\s+Daisy Walker/i).parentElement
    while (daisyCard && !String(daisyCard.className).includes('bg-background/60')) {
      daisyCard = daisyCard.parentElement
    }
    expect(daisyCard).not.toBeNull()

    await user.click(within(daisyCard!).getByRole('combobox', { name: 'Outcome' }))
    const statusListbox = await screen.findByRole('listbox')
    await user.click(within(statusListbox).getByRole('option', { name: 'Killed' }))
    await user.click(within(daisyCard!).getByLabelText('Add replacement investigator'))
    await user.click(within(daisyCard!).getByRole('combobox', { name: 'Replacement Investigator' }))
    const investigatorSearch = screen.getByPlaceholderText('Search investigators...')
    await user.type(investigatorSearch, 'stella')
    const replacementListbox = await screen.findByRole('listbox')
    await user.click(within(replacementListbox).getByRole('option', { name: /Stella Clark/i }))

    await user.click(screen.getByRole('button', { name: 'Log Scenario' }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0].rosterChanges[0]).toMatchObject({
      seatId: 'seat:alice:2',
      previousSlotId: 'seat:alice:2:slot:1',
      newEntry: expect.objectContaining({
        seatId: 'seat:alice:2',
        slotId: 'seat:alice:2:slot:2',
        playerName: 'Alice',
      }),
    })
    expect(onSave.mock.calls[0][0].rosterAfter).toEqual(expect.arrayContaining([
      expect.objectContaining({
        seatId: 'seat:alice:1',
        slotId: 'seat:alice:1:slot:1',
        investigator: expect.objectContaining({ investigatorName: 'Roland Banks' }),
      }),
      expect.objectContaining({
        seatId: 'seat:alice:2',
        slotId: 'seat:alice:2:slot:2',
        investigator: expect.objectContaining({ investigatorName: 'Stella Clark' }),
      }),
    ]))
  })

  it('keeps numeric fields editable/clearable, placeholder-driven, and safely normalizes empty/zero values', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const run = makeRun()
    const slotId = 'seat:alice:1:slot:1'

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={run}
        mode="append"
        onSave={onSave}
      />,
    )

    const outcomeGrid = screen.getByTestId(`participant-outcome-grid-${slotId}`)
    expect(outcomeGrid).toHaveClass('grid-cols-1', 'md:grid-cols-6', 'items-stretch')
    expect(screen.getByTestId(`outcome-cell-${slotId}`)).toHaveClass('md:col-span-3')
    expect(screen.getByText('Outcome')).toHaveClass('min-h-[2rem]', 'items-end')
    expect(screen.getByRole('combobox', { name: 'Outcome' })).toHaveClass('min-w-[14rem]')
    expect(screen.getByTestId(`numeric-cell-xp-earned-${slotId}`)).toHaveClass('flex', 'h-full', 'flex-col', 'justify-end')
    expect(screen.getByText('Physical Trauma')).toHaveClass('min-h-[2rem]', 'items-end')

    expect(screen.queryByLabelText('XP Spent Before Scenario')).not.toBeInTheDocument()

    const xpEarnedInput = screen.getByLabelText('XP earned for Roland Banks') as HTMLInputElement
    const traumaPhysicalInput = screen.getByLabelText('Physical trauma for Roland Banks') as HTMLInputElement
    const traumaMentalInput = screen.getByLabelText('Mental trauma for Roland Banks') as HTMLInputElement

    for (const input of [xpEarnedInput, traumaPhysicalInput, traumaMentalInput]) {
      expect(input).toHaveAttribute('type', 'number')
      expect(input).toHaveAttribute('inputmode', 'numeric')
      expect(input).toHaveAttribute('min', '0')
      expect(input).toHaveAttribute('placeholder', '0')
      expect(input).toHaveClass(
        '[appearance:textfield]',
        '[&::-webkit-inner-spin-button]:appearance-none',
        '[&::-webkit-outer-spin-button]:appearance-none',
      )
      expect(input.value).toBe('')
    }

    await user.type(xpEarnedInput, '9')
    await user.click(xpEarnedInput)
    await user.keyboard('{Control>}a{/Control}{Backspace}')
    expect(xpEarnedInput.value).toBe('')
    await user.type(xpEarnedInput, '0')
    fireEvent.blur(xpEarnedInput)
    expect(xpEarnedInput.value).toBe('0')

    await user.type(traumaPhysicalInput, '1')
    await user.click(traumaMentalInput)
    await user.type(traumaMentalInput, '2')
    await user.click(traumaMentalInput)
    await user.keyboard('{Control>}a{/Control}{Backspace}')
    expect(traumaMentalInput.value).toBe('')

    await user.click(screen.getByRole('button', { name: 'Log Scenario' }))

    expect(onSave).toHaveBeenCalledOnce()
    const payload = onSave.mock.calls[0][0]
    expect(payload.preScenarioAdjustments).toBeUndefined()
    expect(payload.investigatorOutcomes[0]).toMatchObject({
      xpEarned: 0,
      traumaGainedPhysical: 1,
      traumaGainedMental: 0,
    })
  })

  it('persists and rolls forward distinct XP and trauma for each investigator', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn().mockResolvedValue(undefined)
      const run = makeRun()
      const daisy = {
        playerName: 'Bob',
        investigatorName: 'Daisy Walker',
        archetype: 'Seeker' as const,
      }
      const bobRosterEntry = {
        seatId: 'seat:bob:1',
        slotId: 'seat:bob:1:slot:1',
        playerName: 'Bob',
        investigator: daisy,
        seatStatus: 'active' as const,
        joinedAtScenarioIndex: 0,
        startedAtScenarioIndex: 0,
        xpTotal: 7,
        xpSpent: 2,
        physicalTrauma: 0,
        mentalTrauma: 1,
      }
      const campaignRun = {
        ...run,
        setupSnapshot: {
          ...run.setupSnapshot,
          investigators: [...run.setupSnapshot.investigators, daisy],
        },
        currentRoster: [...run.currentRoster!, bobRosterEntry],
      }

      render(
        <CampaignScenarioForm
          open
          onOpenChange={vi.fn()}
          campaignRun={campaignRun}
          mode="append"
          onSave={onSave}
        />,
      )

      await user.type(screen.getByLabelText('XP earned for Roland Banks'), '2')
      await user.type(screen.getByLabelText('Physical trauma for Roland Banks'), '1')
      await user.type(screen.getByLabelText('XP earned for Daisy Walker'), '4')
      await user.type(screen.getByLabelText('Mental trauma for Daisy Walker'), '2')
      await user.click(screen.getByRole('button', { name: 'Log Scenario' }))

      const payload = onSave.mock.calls[0][0]
      expect(payload.investigatorOutcomes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          investigatorName: 'Roland Banks',
          xpEarned: 2,
          traumaGainedPhysical: 1,
          traumaGainedMental: 0,
        }),
        expect.objectContaining({
          investigatorName: 'Daisy Walker',
          xpEarned: 4,
          traumaGainedPhysical: 0,
          traumaGainedMental: 2,
        }),
      ]))
      expect(payload.rosterAfter).toEqual(expect.arrayContaining([
        expect.objectContaining({
          slotId: 'seat:alice:1:slot:1',
          xpTotal: 4,
          physicalTrauma: 1,
          mentalTrauma: 0,
        }),
        expect.objectContaining({
          slotId: 'seat:bob:1:slot:1',
          xpTotal: 11,
          xpSpent: 2,
          physicalTrauma: 0,
          mentalTrauma: 3,
        }),
      ]))
      expect(campaignRun.currentRoster[0]).toMatchObject({
        xpTotal: 2,
        physicalTrauma: 0,
        mentalTrauma: 0,
      })
      expect(campaignRun.currentRoster[1]).toMatchObject({
        xpTotal: 7,
        physicalTrauma: 0,
        mentalTrauma: 1,
      })
  })

  it('keeps a resigned investigator active for future campaign scenarios', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun()}
        mode="append"
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Outcome' }))
    await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Resigned' }))
    await user.click(screen.getByRole('button', { name: 'Log Scenario' }))

    const payload = onSave.mock.calls[0][0]
    expect(payload.investigatorOutcomes[0].status).toBe('resigned')
    expect(payload.rosterAfter[0].seatStatus).toBe('active')
    expect(payload.rosterAfter[0].endedAtScenarioIndex).toBeUndefined()
  })

  it('renders every outcome option and supports selecting long labels', async () => {
    const user = userEvent.setup()

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun()}
        mode="append"
        onSave={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Outcome' }))
    const listbox = await screen.findByRole('listbox')
    const optionLabels = within(listbox).getAllByRole('option').map((option) => option.textContent ?? '')
    expect(optionLabels).toEqual([
      'Survived',
      'Resigned',
      'Defeated (Physical)',
      'Defeated (Mental)',
      'Killed',
      'Driven Insane',
      'Devoured',
    ])
    await user.click(within(listbox).getByRole('option', { name: 'Defeated (Physical)' }))
    expect(screen.getByRole('combobox', { name: 'Outcome' })).toHaveTextContent('Defeated (Physical)')
  })

  it('locks stateful edits for non-latest logs and preserves dark-form foreground classes', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const scenarioLog: CampaignScenarioLog = {
      id: 'scenario-1',
      date: '2026-08-18',
      scenarioName: 'Curtain Call',
      investigators: [
        {
          playerName: 'Alice',
          investigatorName: 'Roland Banks',
          archetype: 'Guardian',
        },
      ],
    }
    const run = makeRun({
      scenarioLogs: [
        scenarioLog,
        {
          id: 'scenario-2',
          date: '2026-08-19',
          scenarioName: 'The Last King',
          investigators: scenarioLog.investigators,
        },
      ],
    })

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={run}
        mode="edit"
        scenarioLog={scenarioLog}
        onSave={onSave}
      />,
    )

    expect(screen.getByText(/Historical state is locked for non-latest scenario logs/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Campaign')).toHaveClass('text-foreground', 'opacity-100')
    expect(screen.getByLabelText('Campaign')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Date')).toHaveClass('[color-scheme:dark]')

    expect(screen.queryByLabelText('XP Spent Before Scenario')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Notes'))
    await user.type(screen.getByLabelText('Notes'), 'Cosmetic-only edit')
    await user.click(screen.getByRole('button', { name: 'Save Scenario' }))

    expect(onSave).toHaveBeenCalledOnce()
    const payload = onSave.mock.calls[0][0]
    expect(payload.notes).toContain('Cosmetic-only edit')
    expect(payload).not.toHaveProperty('investigators')
    expect(payload).not.toHaveProperty('rosterBefore')
    expect(payload).not.toHaveProperty('investigatorOutcomes')
    expect(payload).not.toHaveProperty('rosterAfter')
  })

  it('shows only valid Drowned City route choices after the common opening scenario', async () => {
    const user = userEvent.setup()
    const run = makeRun({
      campaignName: 'The Drowned City',
      campaignSet: 'The Drowned City',
      scenarioLogs: [{
        id: 'drowned-opening',
        date: '2026-08-17',
        scenarioName: 'One Last Job',
        investigators: [],
      }],
    })

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={run}
        mode="append"
        onSave={vi.fn()}
      />,
    )

    const scenario = screen.getByRole('combobox', { name: 'Scenario' })
    expect(scenario).toHaveTextContent('The Western Wall')
    await user.click(scenario)
    const options = within(await screen.findByRole('listbox')).getAllByRole('option')
      .map(option => option.textContent)
    expect(options).toEqual(['The Western Wall', 'Obsidian Canyons'])
    expect(screen.queryByText(/guide-backed scenarios unavailable/i)).not.toBeInTheDocument()
  })

  it('accepts a trimmed custom campaign scenario name for fan-made campaigns', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun({
          campaignLineageId: 'name:the-custom-mystery',
          campaignName: 'The Custom Mystery',
          campaignSet: undefined,
          campaignType: 'Fan-Made',
          customCampaignName: 'The Custom Mystery',
        })}
        mode="append"
        onSave={onSave}
      />,
    )

    expect(screen.queryByText(/canonical progression metadata is unavailable/i)).toBeNull()
    await user.type(screen.getByLabelText('Custom Scenario Name'), '  The House Beyond  ')
    await user.click(screen.getByRole('button', { name: 'Log Scenario' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      scenarioName: 'The House Beyond',
      scenarioType: 'standard',
    }))
  })

  it('requires a non-empty fan-made campaign scenario name', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun({
          campaignLineageId: 'name:the-custom-mystery',
          campaignName: 'The Custom Mystery',
          campaignSet: undefined,
          campaignType: 'Fan-Made',
          customCampaignName: 'The Custom Mystery',
        })}
        mode="append"
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Log Scenario' }))
    expect(await screen.findByText('Scenario name is required.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('lists Return to the Circle Undone scenarios in canonical order', async () => {
    const user = userEvent.setup()
    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun({
          campaignLineageId: 'campaign:the-circle-undone',
          campaignName: 'Return to the Circle Undone',
          campaignSet: 'Return to The Circle Undone',
        })}
        mode="append"
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('The Witching Hour')
    await user.click(screen.getByRole('combobox', { name: 'Scenario' }))
    const options = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .map(option => option.textContent ?? '')

    expect(options).toEqual([
      'The Witching Hour',
      "At Death's Doorstep",
      'The Secret Name',
      'The Wages of Sin',
      'For the Greater Good',
      'Union and Disillusion',
      'In the Clutches of Chaos',
      'Before the Black Throne',
    ])
  })

  it('shows ordered canonical options for Path to Carcosa without campaign-title fallback', async () => {
    const user = userEvent.setup()
    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun()}
        mode="append"
        onSave={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Scenario' }))
    const listbox = await screen.findByRole('listbox')
    const options = within(listbox).getAllByRole('option').map((option) => option.textContent ?? '')
    expect(options[0]).toContain('Curtain Call')
    expect(options[1]).toContain('The Last King')
    expect(options).not.toContain('The Path to Carcosa')
  })

  it('resolves the Core 2026 Brethren alias to its own canonical order', async () => {
    const user = userEvent.setup()
    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun({
          campaignLineageId: 'campaign:brethren-of-ash',
          campaignName: 'The Brethren of the Ash',
          campaignSet: 'Core 2026',
          campaignType: 'Small Campaign',
        })}
        mode="append"
        onSave={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Scenario' }))
    expect(within(await screen.findByRole('listbox')).getAllByRole('option').map(option => option.textContent))
      .toEqual(['Spreading Flames', 'Smoke and Mirrors', 'Queen of Ash'])
  })

  it('switches scenario type and clears incompatible selections', async () => {
    const user = userEvent.setup()

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun()}
        mode="append"
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('Curtain Call')

    await chooseScenarioType(user, 'Side Scenario')
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('Select side scenario...')

    await user.click(screen.getByRole('combobox', { name: 'Scenario' }))
    const sideOptions = await screen.findByRole('listbox')
    await user.click(within(sideOptions).getByRole('option', { name: 'Curse of the Rougarou' }))
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('Curse of the Rougarou')

    await chooseScenarioType(user, 'Campaign Scenario')
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('Curtain Call')

    await chooseScenarioType(user, 'Side Scenario')
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('Select side scenario...')
  })

  it('hides side-scenario controls and persists a single rich standalone result', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun({
          campaignLineageId: 'campaign:curse-of-the-rougarou',
          campaignName: 'Curse of the Rougarou',
          campaignSet: 'Scenario Pack',
          campaignType: 'Scenario Pack',
          scenarioLogs: [],
        })}
        mode="append"
        onSave={onSave}
      />,
    )

    expect(screen.getByText('Log Scenario Result')).toBeInTheDocument()
    expect(screen.queryByLabelText('Scenario Type')).toBeNull()
    expect(screen.queryByText('Side Scenario')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('Curse of the Rougarou')

    await user.type(screen.getByLabelText('XP earned for Roland Banks'), '4')
    await user.type(screen.getByLabelText('Physical trauma for Roland Banks'), '1')
    await user.click(screen.getByRole('button', { name: 'Log Scenario' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      scenarioName: 'Curse of the Rougarou',
      scenarioType: 'standard',
      investigatorOutcomes: [expect.objectContaining({
        investigatorName: 'Roland Banks',
        xpEarned: 4,
        traumaGainedPhysical: 1,
      })],
    }))
  })

  it('supports canonical side-scenario selection and custom side scenario path', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun()}
        mode="append"
        onSave={onSave}
      />,
    )

    await chooseScenarioType(user, 'Side Scenario')
    expect(screen.queryByLabelText(/Side Stories \(comma separated\)/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Scenario' }))
    const sideOptions = await screen.findByRole('listbox')
    const optionLabels = within(sideOptions).getAllByRole('option').map((option) => option.textContent ?? '')
    expect(optionLabels.indexOf('Carnevale of Horrors')).toBeLessThan(optionLabels.indexOf('Curse of the Rougarou'))
    expect(optionLabels).toEqual(expect.arrayContaining([
      'Fortune and Folly, Part I',
      'Fortune and Folly, Part II',
      'The Eternal Slumber',
      "The Night's Usurper",
    ]))
    await user.click(within(sideOptions).getByRole('option', { name: 'Other / Custom Side Scenario' }))

    const customInput = screen.getByLabelText('Custom Side Scenario Name')
    await user.type(customInput, 'My Fan Scenario')

    await user.click(screen.getByRole('button', { name: 'Log Scenario' }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      scenarioType: 'side_scenario',
      scenarioName: 'My Fan Scenario',
    }))
  })

  it('ignores side-scenario history when defaulting next campaign scenario', () => {
    const run = makeRun({
      scenarioLogs: [
        {
          id: 's1',
          date: '2026-08-17',
          scenarioName: 'Curtain Call',
          scenarioType: 'standard',
          investigators: makeRun().setupSnapshot.investigators,
        },
        {
          id: 's2',
          date: '2026-08-18',
          scenarioName: 'Curse of the Rougarou',
          scenarioType: 'side_scenario',
          investigators: makeRun().setupSnapshot.investigators,
        },
      ],
    })

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={run}
        mode="append"
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('The Last King')
  })

  it('seeds and round-trips existing side scenario logs in edit mode', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const sideScenarioLog: CampaignScenarioLog = {
      id: 'side-1',
      date: '2026-08-18',
      scenarioName: 'Curse of the Rougarou',
      scenarioType: 'side_scenario',
      investigators: makeRun().setupSnapshot.investigators,
    }

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={makeRun({ scenarioLogs: [sideScenarioLog] })}
        mode="edit"
        scenarioLog={sideScenarioLog}
        onSave={onSave}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Scenario Type' })).toHaveTextContent('Side Scenario')
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('Curse of the Rougarou')

    await user.click(screen.getByRole('button', { name: 'Save Scenario' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      scenarioType: 'side_scenario',
      scenarioName: 'Curse of the Rougarou',
    }))
  })

  it('seeds continue participants from active continuation slots only', () => {
    const run = makeRun({
      currentRoster: [
        {
          seatId: 'seat:alice:1',
          slotId: 'seat:alice:1:slot:1',
          playerName: 'Alice',
          investigator: {
            playerName: 'Alice',
            investigatorName: 'Roland Banks',
            archetype: 'Guardian',
          },
          seatStatus: 'eliminated',
          joinedAtScenarioIndex: 0,
          startedAtScenarioIndex: 0,
          endedAtScenarioIndex: 0,
          endReason: 'killed',
          xpTotal: 4,
          xpSpent: 1,
          physicalTrauma: 1,
          mentalTrauma: 0,
        },
        {
          seatId: 'seat:alice:1',
          slotId: 'seat:alice:1:slot:2',
          playerName: 'Alice',
          investigator: {
            playerName: 'Alice',
            investigatorName: 'Stella Clark',
            archetype: 'Survivor',
          },
          seatStatus: 'active',
          joinedAtScenarioIndex: 0,
          startedAtScenarioIndex: 0,
          xpTotal: 0,
          xpSpent: 0,
          physicalTrauma: 0,
          mentalTrauma: 0,
        },
        {
          seatId: 'seat:bob:1',
          slotId: 'seat:bob:1:slot:1',
          playerName: 'Bob',
          investigator: {
            playerName: 'Bob',
            investigatorName: 'Agnes Baker',
            archetype: 'Mystic',
          },
          seatStatus: 'eliminated',
          joinedAtScenarioIndex: 0,
          startedAtScenarioIndex: 0,
          endedAtScenarioIndex: 0,
          endReason: 'devoured',
          xpTotal: 5,
          xpSpent: 0,
          physicalTrauma: 0,
          mentalTrauma: 2,
        },
        {
          seatId: 'seat:carol:1',
          slotId: 'seat:carol:1:slot:1',
          playerName: 'Carol',
          investigator: {
            playerName: 'Carol',
            investigatorName: 'Daisy Walker',
            archetype: 'Seeker',
          },
          seatStatus: 'active',
          joinedAtScenarioIndex: 0,
          startedAtScenarioIndex: 0,
          xpTotal: 1,
          xpSpent: 0,
          physicalTrauma: 0,
          mentalTrauma: 0,
        },
      ],
    })

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={run}
        mode="append"
        onSave={vi.fn()}
      />,
    )

    expect(screen.queryByText(/Alice\s+—\s+Roland Banks/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/Alice\s+—\s+Stella Clark/i)).toHaveLength(1)
    expect(screen.queryByText(/Bob\s+—\s+Agnes Baker/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Carol\s+—\s+Daisy Walker/i)).toBeInTheDocument()
  })

  it('recovers legacy left slots when their latest outcome was scenario resignation', () => {
    const run = makeRun({
      scenarioLogs: [{
        id: 'scenario-1',
        date: '2026-08-18',
        scenarioName: 'Curtain Call',
        investigators: makeRun().setupSnapshot.investigators,
        investigatorOutcomes: [{
          seatId: 'seat:alice:1',
          slotId: 'seat:alice:1:slot:1',
          playerName: 'Alice',
          investigatorName: 'Roland Banks',
          status: 'resigned',
          xpEarned: 2,
          traumaGainedPhysical: 0,
          traumaGainedMental: 0,
        }],
      }],
      currentRoster: [{
        ...makeRun().currentRoster![0],
        seatStatus: 'left',
        endedAtScenarioIndex: 0,
      }],
    })

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={run}
        mode="append"
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByText(/Alice\s+—\s+Roland Banks/i)).toBeInTheDocument()
  })

  it('treats legacy continuation slots without seatStatus as active participants', () => {
    const run = makeRun({
      currentRoster: [
        {
          seatId: 'seat:legacy:1',
          slotId: 'seat:legacy:1:slot:1',
          playerName: 'Legacy',
          investigator: {
            playerName: 'Legacy',
            investigatorName: 'Wendy Adams',
            archetype: 'Survivor',
          },
          joinedAtScenarioIndex: 0,
          startedAtScenarioIndex: 0,
          xpTotal: 0,
          xpSpent: 0,
          physicalTrauma: 0,
          mentalTrauma: 0,
        } as unknown as NonNullable<CampaignRun['currentRoster']>[number],
      ],
    })

    render(
      <CampaignScenarioForm
        open
        onOpenChange={vi.fn()}
        campaignRun={run}
        mode="append"
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByText(/Legacy\s+—\s+Wendy Adams/i)).toBeInTheDocument()
  })
})
