import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { PlaythroughCard } from './PlaythroughCard'
import { PlaythroughForm } from './PlaythroughForm'
import type { Playthrough } from '@/lib/types'

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

const basePlaythrough: Playthrough = {
  id: 'log-2',
  date: '2026-08-10',
  campaignName: 'The Night of the Zealot',
  campaignType: 'Small Campaign',
  scenarioName: 'The Gathering',
  investigators: [
    {
      playerName: 'Alice',
      investigatorName: 'Roland Banks',
      archetype: 'Guardian',
    },
  ],
}

describe('PlaythroughCard campaign log actions', () => {
  it.each([
    {
      campaignName: 'Return to the Circle Undone',
      campaignSet: 'Return to The Circle Undone',
    },
    {
      campaignName: 'Brethren of Ash',
      campaignSet: 'Brethren of Ash',
    },
  ])('uses the normalized campaign title typography for $campaignName', ({ campaignName, campaignSet }) => {
    render(
      <PlaythroughCard
        playthrough={{ ...basePlaythrough, campaignName, campaignSet }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const heading = screen.getByRole('heading', { level: 3, name: campaignName })
    expect(heading).toHaveClass('text-lg', 'font-semibold', 'leading-snug', 'md:text-xl')
    expect(within(heading).getByText(campaignName)).toHaveClass('min-w-0', 'truncate')
  })

  it('exposes an accessible edit action that targets the same existing log', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()

    render(
      <PlaythroughCard
        playthrough={basePlaythrough}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    )

    const editButtons = screen.getAllByRole('button', {
      name: /Edit campaign log for The Night of the Zealot/i,
    })
    await user.click(editButtons[0])

    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledWith(basePlaythrough)
    expect(onEdit.mock.calls[0][0].id).toBe('log-2')
  })

  it('renders Continue Campaign with the shared plus icon and dispatches the selected campaign log', async () => {
    const user = userEvent.setup()
    const onContinueCampaign = vi.fn()

    render(
      <PlaythroughCard
        playthrough={basePlaythrough}
        onEdit={vi.fn()}
        onContinueCampaign={onContinueCampaign}
        onDelete={vi.fn()}
      />,
    )

    const continueButton = screen.getByRole('button', { name: /Continue Campaign/i })
    expect(screen.getAllByRole('button', { name: /Continue Campaign/i })).toHaveLength(1)
    expect(continueButton.querySelector('svg')).not.toBeNull()
    expect(continueButton.closest('[data-slot="card-action-area"]')).toHaveClass(
      'col-start-2',
      'row-start-1',
      'justify-end',
    )

    await user.click(continueButton)

    expect(onContinueCampaign).toHaveBeenCalledTimes(1)
    expect(onContinueCampaign).toHaveBeenCalledWith(basePlaythrough)
  })

  it('shows Log First Scenario for legacy/setup roots without an actual scenario night', () => {
    render(
      <PlaythroughCard
        playthrough={{
          ...basePlaythrough,
          scenarioName: 'The Night of the Zealot',
        }}
        onEdit={vi.fn()}
        onContinueCampaign={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Log First Scenario/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continue Campaign/i })).toBeNull()
  })

  it('shows Continue Campaign for side-scenario-only legacy histories', () => {
    render(
      <PlaythroughCard
        playthrough={{
          ...basePlaythrough,
          scenarioName: 'Curse of the Rougarou',
          scenarioType: 'side_scenario',
        }}
        onEdit={vi.fn()}
        onContinueCampaign={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Continue Campaign/i })).toBeInTheDocument()
  })

  it('does not render Continue Campaign for standalone scenario-pack nights', () => {
    render(
      <PlaythroughCard
        playthrough={{
          ...basePlaythrough,
          campaignName: 'Traces To Nowhere',
          campaignType: 'Scenario Pack',
          campaignSet: 'Scenario Pack',
          investigatorOutcomes: [{
            seatId: 'seat:alice:1',
            slotId: 'seat:alice:1:slot:1',
            playerName: 'Alice',
            investigatorName: 'Roland Banks',
            status: 'resigned',
            xpEarned: 4,
            traumaGainedPhysical: 1,
            traumaGainedMental: 2,
          }],
        }}
        onEdit={vi.fn()}
        onContinueCampaign={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /Continue Campaign/i })).toBeNull()
    expect(document.querySelectorAll('[data-slot="card-action-area"]')).toHaveLength(1)
    expect(screen.getByLabelText('Scenario results by investigator'))
      .toHaveTextContent(/Roland Banks.*resigned.*XP 4.*Trauma P1\/M2/i)
  })

  it.each([
    { campaignName: 'The Night of the Zealot', campaignType: 'Small Campaign' as const },
    { campaignName: 'The Path to Carcosa', campaignType: 'Full Campaign' as const },
    { campaignName: 'Return to The Night of the Zealot', campaignType: 'Small Campaign' as const, campaignSet: 'Return to The Night of the Zealot' },
    { campaignName: 'The Custom Mystery', campaignType: 'Fan-Made' as const },
  ])('renders Continue Campaign for eligible campaign logs: $campaignName', ({ campaignName, campaignType, campaignSet }) => {
    render(
      <PlaythroughCard
        playthrough={{ ...basePlaythrough, campaignName, campaignType, campaignSet }}
        onEdit={vi.fn()}
        onContinueCampaign={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Continue Campaign/i })).toBeInTheDocument()
  })
})

describe('Continue Campaign integration flow', () => {
  function ContinueHarness({
    playthrough,
    onAdd,
    onUpdate,
  }: {
    playthrough: Playthrough
    onAdd: (entry: Omit<Playthrough, 'id'>) => void
    onUpdate: (entry: Playthrough) => void
  }) {
    const [formOpen, setFormOpen] = useState(false)
    const [seed, setSeed] = useState<Playthrough | null>(null)

    return (
      <>
        <PlaythroughCard
          playthrough={playthrough}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onContinueCampaign={(p) => {
            setSeed(p)
            setFormOpen(true)
          }}
        />
        <PlaythroughForm
          open={formOpen}
          onOpenChange={setFormOpen}
          seedPlaythrough={seed}
          campaignHistory={seed ? [seed] : []}
          onSave={async (entry) => {
            if ('id' in entry) {
              onUpdate(entry)
              return
            }
            onAdd(entry)
          }}
        />
      </>
    )
  }

  it('opens a new scenario-entry continuation form and submits via create flow (not update)', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    const onUpdate = vi.fn()

    const rootCampaignLog: Playthrough = {
      id: 'campaign-root-log',
      date: '2026-08-14',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      campaignSet: 'The Path to Carcosa',
      investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
    }

    render(<ContinueHarness playthrough={rootCampaignLog} onAdd={onAdd} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: /Log First Scenario/i }))

    expect(screen.getByRole('heading', { name: 'Continue Campaign' })).toBeInTheDocument()
    expect(screen.getByText('Scenario')).toBeInTheDocument()
    expect(screen.queryByText('Campaign Type')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /save playthrough/i }))

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
    expect(onUpdate).not.toHaveBeenCalled()

    const created = onAdd.mock.calls[0][0] as Omit<Playthrough, 'id'>
    expect((created as Playthrough).id).toBeUndefined()
    expect(created.campaignName).toBe('The Path to Carcosa')
    expect(created.scenarioName).toBe('Curtain Call')
  })
})
