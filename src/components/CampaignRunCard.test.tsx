import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CampaignRunCard } from './CampaignRunCard'
import type { CampaignRun } from '@/lib/types'

function makeRun(overrides: Partial<CampaignRun> = {}): CampaignRun {
  return {
    id: 'run-1',
    version: 1,
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
      notes: 'Setup',
    },
    scenarioLogs: [],
    ...overrides,
  }
}

describe('CampaignRunCard', () => {
  it.each([false, true])('keeps Continue Campaign in the single top-right action area when expansion is %s', (isExpanded) => {
    const run = makeRun({
      scenarioLogs: [{
        id: 'scenario-1',
        date: '2026-08-18',
        scenarioName: 'Curtain Call',
        investigators: makeRun().setupSnapshot.investigators,
      }],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded={isExpanded}
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    const continueButton = screen.getByRole('button', { name: /Continue Campaign/i })
    expect(screen.getAllByRole('button', { name: /Continue Campaign/i })).toHaveLength(1)
    expect(continueButton.querySelector('svg')).not.toBeNull()
    expect(continueButton.closest('[data-slot="card-action-area"]')).toHaveClass(
      'order-2',
      'justify-start',
      'md:order-none',
      'md:justify-end',
    )
  })

  it.each([
    { isExpanded: false, label: /Show scenarios/i },
    { isExpanded: true, label: /Hide scenarios/i },
  ])('places the accessible disclosure below and outside the action area when expanded is $isExpanded', ({ isExpanded, label }) => {
    const run = makeRun({
      scenarioLogs: [{
        id: 'scenario-1',
        date: '2026-08-18',
        scenarioName: 'Curtain Call',
        investigators: makeRun().setupSnapshot.investigators,
      }],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded={isExpanded}
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    const toggle = screen.getByRole('button', { name: label })
    const actionArea = document.querySelector('[data-slot="card-action-area"]')
    const disclosureArea = document.querySelector('[data-slot="scenario-disclosure-area"]')
    const scenarioRegion = document.getElementById(`campaign-run-scenarios-${run.id}`)

    expect(toggle).toHaveAttribute('aria-expanded', String(isExpanded))
    expect(toggle).toHaveAttribute('aria-controls', scenarioRegion?.id)
    expect(toggle.querySelector('svg')).not.toBeNull()
    expect(toggle.closest('[data-slot="card-action-area"]')).toBeNull()
    expect(toggle.closest('[data-slot="scenario-disclosure-area"]')).toBe(disclosureArea)
    expect(disclosureArea).toHaveClass('justify-start', 'border-t', 'pt-3')
    expect(actionArea!.compareDocumentPosition(disclosureArea!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(disclosureArea!.compareDocumentPosition(scenarioRegion!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each([false, true])('uses normalized title typography when expansion is %s', (isExpanded) => {
    const campaignName = 'The Circle Undone'

    render(
      <CampaignRunCard
        campaignRun={makeRun({ campaignName, campaignSet: campaignName })}
        isExpanded={isExpanded}
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    const heading = screen.getByRole('heading', { level: 3, name: campaignName })
    expect(heading).toHaveClass('text-lg', 'font-semibold', 'leading-snug', 'md:text-xl')
    expect(within(heading).getByText(campaignName)).toHaveClass('min-w-0', 'truncate')
  })

  it('exposes accessible expand/collapse semantics and empty-run affordance', async () => {
    const user = userEvent.setup()
    const onToggleExpanded = vi.fn()
    const run = makeRun()

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded={false}
        onToggleExpanded={onToggleExpanded}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    const toggle = screen.getByRole('button', { name: /Show scenarios/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', `campaign-run-scenarios-${run.id}`)
    expect(screen.queryByText('No scenario nights yet.')).toBeNull()

    await user.click(toggle)
    expect(onToggleExpanded).toHaveBeenCalledWith(run.id)
  })

  it('routes parent and child actions distinctly', async () => {
    const user = userEvent.setup()
    const onContinue = vi.fn()
    const onEditRun = vi.fn()
    const onDeleteRun = vi.fn()
    const onEditScenario = vi.fn()
    const onDeleteScenario = vi.fn()
    const run = makeRun({
      scenarioLogs: [
        {
          id: 'scenario-1',
          date: '2026-08-18',
          scenarioName: 'Curtain Call',
          investigators: makeRun().setupSnapshot.investigators,
        },
      ],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={onContinue}
        onEditRun={onEditRun}
        onDeleteRun={onDeleteRun}
        onEditScenario={onEditScenario}
        onDeleteScenario={onDeleteScenario}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Continue Campaign/i }))
    await user.click(screen.getByRole('button', { name: /Edit campaign setup/i }))
    await user.click(screen.getByRole('button', { name: /Delete campaign run/i }))
    await user.click(screen.getByRole('button', { name: /Edit scenario log Curtain Call/i }))
    await user.click(screen.getByRole('button', { name: /Delete scenario log Curtain Call/i }))

    expect(onContinue).toHaveBeenCalledWith(run)
    expect(onEditRun).toHaveBeenCalledWith(run)
    expect(onDeleteRun).toHaveBeenCalledWith(run)
    expect(onEditScenario).toHaveBeenCalledWith(run, run.scenarioLogs[0])
    expect(onDeleteScenario).toHaveBeenCalledWith(run, run.scenarioLogs[0])
  })

  it('shows Log First Scenario for empty runs and Continue Campaign once scenarios exist', () => {
    const { rerender } = render(
      <CampaignRunCard
        campaignRun={makeRun({ scenarioLogs: [] })}
        isExpanded={false}
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Log First Scenario/i })).toBeInTheDocument()

    rerender(
      <CampaignRunCard
        campaignRun={makeRun({
          scenarioLogs: [
            {
              id: 'scenario-2',
              date: '2026-08-19',
              scenarioName: 'The Last King',
              investigators: makeRun().setupSnapshot.investigators,
            },
          ],
        })}
        isExpanded={false}
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Continue Campaign/i })).toBeInTheDocument()
  })

  it('treats a legacy root shell as empty and keeps Log First Scenario', () => {
    render(
      <CampaignRunCard
        campaignRun={makeRun({
          scenarioLogs: [
            {
              id: 'legacy-root-shell',
              date: '2026-08-17',
              scenarioName: 'The Path to Carcosa',
              legacySourcePlaythroughId: 'legacy-root-log',
              investigators: makeRun().setupSnapshot.investigators,
            },
          ],
        })}
        isExpanded={false}
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Log First Scenario/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continue Campaign/i })).toBeNull()
  })

  it('shows Continue Campaign when only side-scenario nights are logged', () => {
    render(
      <CampaignRunCard
        campaignRun={makeRun({
          scenarioLogs: [
            {
              id: 'side-1',
              date: '2026-08-19',
              scenarioName: 'Curse of the Rougarou',
              scenarioType: 'side_scenario',
              investigators: makeRun().setupSnapshot.investigators,
            },
          ],
        })}
        isExpanded={false}
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Continue Campaign/i })).toBeInTheDocument()
  })

  it('shows Next only for a valid incomplete canonical progression', () => {
    render(
      <CampaignRunCard
        campaignRun={makeRun()}
        isExpanded={false}
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getByText(/Progress:\s*0 of 8/i)).toBeInTheDocument()
    expect(screen.getByText(/Next:\s*Curtain Call/i)).toBeInTheDocument()
  })

  it('omits Next after every canonical scenario is complete', () => {
    const canonicalScenarios = [
      'Curtain Call',
      'The Last King',
      'Echoes of the Past',
      'The Unspeakable Oath',
      'A Phantom of Truth',
      'The Pallid Mask',
      'Black Stars Rise',
      'Dim Carcosa',
    ]
    const run = makeRun({
      scenarioLogs: canonicalScenarios.map((scenarioName, index) => ({
        id: `scenario-${index + 1}`,
        date: `2026-08-${String(index + 10).padStart(2, '0')}`,
        scenarioName,
        scenarioType: 'standard',
        investigators: makeRun().setupSnapshot.investigators,
      })),
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded={false}
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getByText(/Progress:\s*8 of 8/i)).toBeInTheDocument()
    expect(screen.queryByText(/Next:/i)).toBeNull()
  })

  it('summarizes multiple valid branch-aware next scenarios', () => {
    render(
      <CampaignRunCard
        campaignRun={makeRun({
          campaignLineageId: 'campaign:the-dunwich-legacy',
          campaignName: 'The Dunwich Legacy',
          campaignSet: 'The Dunwich Legacy',
        })}
        isExpanded={false}
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getByText(/Next:\s*Choose next \(2 options\)/i)).toBeInTheDocument()
  })

  it('offers one standalone result entry and never offers Continue Campaign afterward', () => {
    const onContinue = vi.fn()
    const standalone = makeRun({
      campaignName: 'Curse of the Rougarou',
      campaignSet: 'Scenario Pack',
      campaignType: 'Scenario Pack',
      scenarioLogs: [],
    })

    const { rerender } = render(
      <CampaignRunCard
        campaignRun={standalone}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={onContinue}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Log Scenario Result' })).toBeInTheDocument()
    expect(screen.queryByText(/Next:/)).toBeNull()

    rerender(
      <CampaignRunCard
        campaignRun={{
          ...standalone,
          scenarioLogs: [{
            id: 'result-1',
            date: '2026-08-18',
            scenarioName: 'Curse of the Rougarou',
            investigators: standalone.setupSnapshot.investigators,
          }],
        }}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={onContinue}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /Continue Campaign|Log Scenario Result/ })).toBeNull()
  })

  it('shows fan-made logged order without canonical progress or completion claims', () => {
    const run = makeRun({
      campaignLineageId: 'name:the-custom-mystery',
      campaignName: 'The Custom Mystery',
      campaignSet: undefined,
      campaignType: 'Fan-Made',
      customCampaignName: 'The Custom Mystery',
      scenarioLogs: [
        {
          id: 'fan-1',
          date: '2026-08-18',
          scenarioName: 'The House Beyond',
          investigators: makeRun().setupSnapshot.investigators,
        },
        {
          id: 'fan-side',
          date: '2026-08-19',
          scenarioName: 'Custom Detour',
          scenarioType: 'side_scenario',
          investigators: makeRun().setupSnapshot.investigators,
        },
        {
          id: 'fan-2',
          date: '2026-08-20',
          scenarioName: 'A Debt Repaid',
          investigators: makeRun().setupSnapshot.investigators,
        },
      ],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getByText('Scenarios: 2 logged')).toBeInTheDocument()
    expect(screen.getByText('Game nights: 3 logged')).toBeInTheDocument()
    expect(screen.queryByText(/Progress:/)).toBeNull()
    expect(screen.queryByText(/Next:/)).toBeNull()
    const rows = screen.getAllByRole('listitem')
    expect(rows.map(row => row.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('The House Beyond'),
      expect.stringContaining('Custom Detour'),
      expect.stringContaining('A Debt Repaid'),
    ]))
  })

  it('marks side-scenario rows and ignores them for canonical progress and next scenario', () => {
    const run = makeRun({
      scenarioLogs: [
        {
          id: 'scenario-1',
          date: '2026-08-18',
          scenarioName: 'Curtain Call',
          scenarioType: 'standard',
          investigators: makeRun().setupSnapshot.investigators,
        },
        {
          id: 'scenario-2',
          date: '2026-08-19',
          scenarioName: 'Curse of the Rougarou',
          scenarioType: 'side_scenario',
          investigators: makeRun().setupSnapshot.investigators,
        },
      ],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getByText(/Progress:\s*1 of 8/i)).toBeInTheDocument()
    expect(screen.getByText(/Game nights:\s*2 logged/i)).toBeInTheDocument()
    expect(screen.getByText(/Next:\s*The Last King/i)).toBeInTheDocument()
    expect(screen.getByText('Side Scenario')).toBeInTheDocument()
  })

  it('counts only canonical scenarios in progress when multiple side nights exist', () => {
    const run = makeRun({
      scenarioLogs: [
        {
          id: 'scenario-1',
          date: '2026-08-18',
          scenarioName: 'Curtain Call',
          scenarioType: 'standard',
          investigators: makeRun().setupSnapshot.investigators,
        },
        {
          id: 'scenario-2',
          date: '2026-08-19',
          scenarioName: 'The Last King',
          scenarioType: 'standard',
          investigators: makeRun().setupSnapshot.investigators,
        },
        {
          id: 'scenario-3',
          date: '2026-08-20',
          scenarioName: 'Curse of the Rougarou',
          scenarioType: 'side_scenario',
          investigators: makeRun().setupSnapshot.investigators,
        },
      ],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getByText(/Progress:\s*2 of 8/i)).toBeInTheDocument()
    expect(screen.getByText(/Game nights:\s*3 logged/i)).toBeInTheDocument()
  })

  it('shows side-only runs as zero canonical progress while surfacing total game nights separately', () => {
    const run = makeRun({
      scenarioLogs: [
        {
          id: 'scenario-1',
          date: '2026-08-18',
          scenarioName: 'Curse of the Rougarou',
          scenarioType: 'side_scenario',
          investigators: makeRun().setupSnapshot.investigators,
        },
      ],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getByText(/Progress:\s*0 of 8/i)).toBeInTheDocument()
    expect(screen.getByText(/Game nights:\s*1 logged/i)).toBeInTheDocument()
  })

  it('uses metadata-gap logged semantics without treating side scenarios as canonical progress', () => {
    const run = makeRun({
      campaignName: 'Unknown Archived Campaign',
      campaignSet: 'Unknown Archived Campaign',
      scenarioLogs: [
        {
          id: 'scenario-1',
          date: '2026-08-18',
          scenarioName: 'An Uncatalogued Opening',
          scenarioType: 'standard',
          investigators: makeRun().setupSnapshot.investigators,
        },
        {
          id: 'scenario-2',
          date: '2026-08-19',
          scenarioName: 'Machinations Through Time',
          scenarioType: 'side_scenario',
          investigators: makeRun().setupSnapshot.investigators,
        },
      ],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getByText(/Progress:\s*1 logged/i)).toBeInTheDocument()
    expect(screen.getByText(/Game nights:\s*2 logged/i)).toBeInTheDocument()
    expect(screen.queryByText(/Progress:\s*2 logged/i)).toBeNull()
    expect(screen.queryByText(/Next:/i)).toBeNull()
  })

  it('renders structured roster rows with badges and status metadata (no inline prose)', () => {
    const run = makeRun({
      currentRoster: [
        {
          seatId: 'seat:alice:1',
          slotId: 'seat:alice:1:slot:2',
          playerName: 'Alice',
          investigator: {
            playerName: 'Alice',
            investigatorName: 'André Patel',
            archetype: 'Rogue',
            chapter: 2,
            investigatorSet: 'Evergreen Starters (Ch. 2)',
          },
          seatStatus: 'active',
          joinedAtScenarioIndex: 1,
          startedAtScenarioIndex: 1,
          xpTotal: 3,
          xpSpent: 0,
          physicalTrauma: 0,
          mentalTrauma: 0,
        },
      ],
      scenarioLogs: [
        {
          id: 'scenario-1',
          date: '2026-08-18',
          scenarioName: 'Curtain Call',
          investigators: makeRun().setupSnapshot.investigators,
          rosterBefore: [
            {
              seatId: 'seat:alice:1',
              slotId: 'seat:alice:1:slot:1',
              playerName: 'Alice',
              investigator: {
                playerName: 'Alice',
                investigatorName: 'Roland Banks',
                archetype: 'Guardian',
                chapter: 1,
                investigatorSet: 'Core',
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
          rosterAfter: [
            {
              seatId: 'seat:alice:1',
              slotId: 'seat:alice:1:slot:1',
              playerName: 'Alice',
              investigator: {
                playerName: 'Alice',
                investigatorName: 'Roland Banks',
                archetype: 'Guardian',
                chapter: 1,
                investigatorSet: 'Core',
              },
              seatStatus: 'eliminated',
              joinedAtScenarioIndex: 0,
              startedAtScenarioIndex: 0,
              endedAtScenarioIndex: 0,
              endReason: 'driven_insane',
              xpTotal: 2,
              xpSpent: 0,
              physicalTrauma: 1,
              mentalTrauma: 0,
            },
            {
              seatId: 'seat:alice:1',
              slotId: 'seat:alice:1:slot:2',
              playerName: 'Alice',
              investigator: {
                playerName: 'Alice',
                investigatorName: 'André Patel',
                archetype: 'Rogue',
                chapter: 2,
                investigatorSet: 'Evergreen Starters (Ch. 2)',
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
        },
        {
          id: 'scenario-2',
          date: '2026-08-19',
          scenarioName: 'The Last King',
          investigators: [
            {
              playerName: 'Alice',
              investigatorName: 'André Patel',
              archetype: 'Rogue',
              chapter: 2,
              investigatorSet: 'Evergreen Starters (Ch. 2)',
            },
          ],
          rosterBefore: [
            {
              seatId: 'seat:alice:1',
              slotId: 'seat:alice:1:slot:2',
              playerName: 'Alice',
              investigator: {
                playerName: 'Alice',
                investigatorName: 'André Patel',
                archetype: 'Rogue',
                chapter: 2,
                investigatorSet: 'Evergreen Starters (Ch. 2)',
              },
              seatStatus: 'active',
              joinedAtScenarioIndex: 1,
              startedAtScenarioIndex: 1,
              xpTotal: 0,
              xpSpent: 0,
              physicalTrauma: 0,
              mentalTrauma: 0,
            },
          ],
          rosterAfter: [
            {
              seatId: 'seat:alice:1',
              slotId: 'seat:alice:1:slot:2',
              playerName: 'Alice',
              investigator: {
                playerName: 'Alice',
                investigatorName: 'André Patel',
                archetype: 'Rogue',
                chapter: 2,
                investigatorSet: 'Evergreen Starters (Ch. 2)',
              },
              seatStatus: 'active',
              joinedAtScenarioIndex: 1,
              startedAtScenarioIndex: 1,
              xpTotal: 0,
              xpSpent: 0,
              physicalTrauma: 0,
              mentalTrauma: 0,
            },
          ],
        },
      ],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    const rosterList = screen.getByRole('list', { name: /campaign roster summary/i })
    expect(screen.getByTestId('campaign-roster-column')).toHaveClass(
      'order-3',
      'min-w-0',
      'md:order-none',
      'md:self-center',
    )
    const rosterRows = within(rosterList).getAllByRole('listitem')
    expect(rosterList.textContent).not.toContain('--')
    expect(rosterList.textContent).not.toContain('—')
    expect(rosterRows).toHaveLength(1)
    const seatRow = rosterRows[0]
    expect(seatRow).toHaveClass(
      'grid-cols-[auto_minmax(0,1fr)]',
      'md:grid-cols-[7rem_minmax(0,1fr)]',
    )
    expect(within(seatRow).getByText('Rogue')).toBeInTheDocument()
    const currentName = within(seatRow).getAllByText('André Patel')[0]
    expect(currentName).toHaveClass('break-words', 'hyphens-none')
    expect(currentName).not.toHaveClass('[overflow-wrap:anywhere]')
    expect(within(seatRow).getByText(/^·\s*Ch\. 2$/i)).toBeInTheDocument()
    expect(within(seatRow).getByText('Evergreen Starters (Ch. 2)')).toBeInTheDocument()
    expect(within(seatRow).getByText('Alice')).toHaveClass('break-words', 'hyphens-none', 'md:truncate')
    expect(seatRow).toHaveTextContent('XP 3')
    expect(seatRow).toHaveTextContent('Trauma P0/M0')
    const tallyGroups = seatRow.querySelectorAll('[data-slot="campaign-roster-tallies"]')
    expect(tallyGroups[0]).toHaveClass('flex', 'flex-wrap')
    expect(tallyGroups[0].children[0]).toHaveClass('whitespace-nowrap')
    expect(tallyGroups[0].children[1]).toHaveClass('whitespace-nowrap')
    expect(seatRow).toHaveTextContent('History:')
    const historicalName = within(seatRow).getByText('Roland Banks')
    const historicalRow = historicalName.closest('[data-testid^="campaign-roster-history-row-"]')
    expect(historicalRow).toHaveClass(
      'grid',
      'grid-cols-[auto_minmax(0,1fr)]',
      'md:grid-cols-[7rem_minmax(0,1fr)]',
      'gap-x-3',
    )
    expect(within(historicalRow as HTMLElement).getByText('Driven insane')).toHaveClass('whitespace-nowrap')
    expect(seatRow).toHaveTextContent('XP 2')
    expect(seatRow).toHaveTextContent('Trauma P1/M0')

    expect(screen.getByRole('button', { name: /Delete scenario log Curtain Call/i })).toBeDisabled()
    expect(screen.queryByText(/Historical state is locked for this scenario/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete scenario log The Last King/i })).toBeEnabled()
  })

  it('displays scenario XP and trauma per investigator without a group total', () => {
    const run = makeRun({
      scenarioLogs: [{
        id: 'scenario-1',
        date: '2026-08-18',
        scenarioName: 'Curtain Call',
        investigators: [
          { playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' },
          { playerName: 'Bob', investigatorName: 'Daisy Walker', archetype: 'Seeker' },
        ],
        investigatorOutcomes: [
          {
            seatId: 'seat:alice:1',
            slotId: 'seat:alice:1:slot:1',
            playerName: 'Alice',
            investigatorName: 'Roland Banks',
            status: 'survived',
            xpEarned: 2,
            traumaGainedPhysical: 1,
            traumaGainedMental: 0,
          },
          {
            seatId: 'seat:bob:1',
            slotId: 'seat:bob:1:slot:1',
            playerName: 'Bob',
            investigatorName: 'Daisy Walker',
            status: 'defeated_mental',
            xpEarned: 4,
            traumaGainedPhysical: 0,
            traumaGainedMental: 2,
          },
        ],
      }],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    const playerList = screen.getByRole('list', { name: /Curtain Call players/i })
    expect(playerList).toHaveClass(
      'min-w-0',
      'space-y-3',
      'text-left',
      'md:self-center',
    )
    const scenarioRows = within(playerList).getAllByRole('listitem')
    const rolandRow = scenarioRows.find((row) => row.textContent?.includes('Roland Banks') && row.textContent.includes('2 XP'))
    const daisyRow = scenarioRows.find((row) => row.textContent?.includes('Daisy Walker') && row.textContent.includes('4 XP'))
    expect(rolandRow).toBeDefined()
    expect(daisyRow).toBeDefined()
    expect(rolandRow!).toHaveTextContent('Trauma P1/M0')
    expect(daisyRow!).toHaveTextContent('Trauma P0/M2')
    expect(daisyRow!).toHaveTextContent('Defeated (Mental)')
    const daisyHeading = daisyRow!.querySelector('[data-slot="scenario-player-heading"]')
    const daisyOutcome = daisyRow!.querySelector('[data-slot="scenario-player-outcome"]')
    expect(daisyRow!).toHaveClass(
      'grid',
      'grid-cols-[minmax(6.25rem,0.8fr)_minmax(0,1.2fr)]',
      'md:block',
    )
    expect(daisyHeading).toHaveClass('contents', 'text-left', 'md:flex', 'md:flex-wrap')
    expect(within(daisyHeading as HTMLElement).getByText('Bob')).toHaveClass(
      'col-start-1',
      'row-start-1',
      'md:order-3',
    )
    const daisyInvestigator = within(daisyHeading as HTMLElement).getByText('Daisy Walker')
    expect(daisyInvestigator.closest('[data-slot="scenario-investigator-label"]'))
      .toHaveClass('col-start-2', 'row-start-1', 'flex', 'min-w-0', 'md:contents')
    expect(daisyInvestigator)
      .toHaveClass('md:order-1', 'break-words', 'hyphens-none')
    expect(daisyInvestigator)
      .not.toHaveClass('[overflow-wrap:anywhere]')
    expect(daisyOutcome).toHaveClass('col-start-2', 'row-start-2', 'flex', 'flex-wrap')
    expect(Array.from(daisyOutcome!.children).every((child) =>
      child.classList.contains('whitespace-nowrap'),
    )).toBe(true)
    expect(screen.queryByText(/^6 XP$/)).not.toBeInTheDocument()
  })

  it('uses the card width for dense four-player rosters and multi-scenario history on phones', () => {
    const investigators = [
      { playerName: 'Alexandria Montgomery', investigatorName: 'William Yorick', archetype: 'Survivor' as const },
      { playerName: 'Christopher Livingston', investigatorName: 'Jacqueline Fine', archetype: 'Mystic' as const },
      { playerName: 'Morgan Matsushita', investigatorName: 'Nathaniel Cho', archetype: 'Guardian' as const },
      { playerName: 'Samira del Rosario', investigatorName: 'Winifred Habbamock', archetype: 'Rogue' as const },
    ]
    const rosterEntries = investigators.map((investigator, index) => ({
      seatId: `seat-${index + 1}`,
      slotId: `slot-${index + 1}`,
      playerName: investigator.playerName,
      investigator,
      seatStatus: 'active' as const,
      joinedAtScenarioIndex: 0,
      startedAtScenarioIndex: 0,
      xpTotal: index + 4,
      xpSpent: index,
      physicalTrauma: index === 2 ? 1 : 0,
      mentalTrauma: index === 1 ? 1 : 0,
    }))
    const investigatorOutcomes = investigators.map((investigator, index) => ({
      seatId: `seat-${index + 1}`,
      slotId: `slot-${index + 1}`,
      playerName: investigator.playerName,
      investigatorName: investigator.investigatorName,
      status: index === 1 ? 'defeated_mental' as const : 'survived' as const,
      xpEarned: index + 2,
      traumaGainedPhysical: index === 2 ? 1 : 0,
      traumaGainedMental: index === 1 ? 1 : 0,
    }))
    const run = makeRun({
      setupSnapshot: {
        date: '2026-08-17',
        investigators,
        notes: 'Dense mobile fixture',
      },
      currentRoster: rosterEntries,
      scenarioLogs: [
        {
          id: 'scenario-1',
          date: '2026-08-18',
          scenarioName: 'Curtain Call',
          investigators,
          investigatorOutcomes,
          rosterBefore: rosterEntries,
          rosterAfter: rosterEntries,
        },
        {
          id: 'scenario-2',
          date: '2026-08-19',
          scenarioName: 'The Last King',
          investigators,
          investigatorOutcomes,
          rosterBefore: rosterEntries,
          rosterAfter: rosterEntries,
        },
      ],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-slot="campaign-card-layout"]')).toHaveClass(
      'grid-cols-1',
      'md:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_auto]',
    )

    const roster = screen.getByRole('list', { name: /campaign roster summary/i })
    const rosterSeats = Array.from(roster.querySelectorAll(':scope > li'))
    expect(rosterSeats).toHaveLength(4)
    rosterSeats.forEach((seat) => {
      expect(seat).toHaveClass(
        'grid-cols-[auto_minmax(0,1fr)]',
        'md:grid-cols-[7rem_minmax(0,1fr)]',
      )
    })

    const scenarioLayouts = document.querySelectorAll('[data-slot="scenario-row-layout"]')
    expect(scenarioLayouts).toHaveLength(2)
    scenarioLayouts.forEach((layout) => {
      expect(layout).toHaveClass(
        'grid-cols-[minmax(0,1fr)_auto]',
        'md:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_auto]',
      )
    })

    for (const scenarioName of ['Curtain Call', 'The Last King']) {
      const players = screen.getByRole('list', { name: `${scenarioName} players` })
      expect(players).toHaveClass(
        'space-y-3',
        'text-left',
      )
      expect(players.className).not.toContain('min-[380px]:grid-cols-2')
      expect(players).not.toHaveClass('grid-cols-[repeat(2,minmax(0,1fr))]')
      const playerRows = within(players).getAllByRole('listitem')
      expect(playerRows).toHaveLength(4)
      playerRows.forEach((row) => {
        expect(row).toHaveClass(
          'grid',
          'grid-cols-[minmax(6.25rem,0.8fr)_minmax(0,1.2fr)]',
          'md:block',
        )
        expect(row.querySelector('[data-slot="scenario-player-name"]')).toHaveClass(
          'col-start-1',
          'row-start-1',
        )
        expect(row.querySelector('[data-slot="scenario-player-outcome"]')).toHaveClass(
          'col-start-2',
          'row-start-2',
        )
      })
    }

    const longInvestigatorNames = screen.getAllByText('Winifred Habbamock')
    expect(longInvestigatorNames.length).toBeGreaterThan(1)
    longInvestigatorNames.forEach((name) => {
      expect(name).toHaveClass('break-words', 'hyphens-none')
      expect(name).not.toHaveClass('[overflow-wrap:anywhere]')
    })
  })

  it('labels legacy group totals as unallocated', () => {
    const legacyScenario = {
      id: 'legacy-scenario',
      date: '2026-08-18',
      scenarioName: 'Curtain Call',
      investigators: makeRun().setupSnapshot.investigators,
      xpEarned: 6,
      physicalTrauma: 1,
      mentalTrauma: 2,
    } as unknown as CampaignRun['scenarioLogs'][number]

    render(
      <CampaignRunCard
        campaignRun={makeRun({ scenarioLogs: [legacyScenario] })}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getByText(/Legacy group totals \(unallocated\): 6 XP trauma P1\/M2/i)).toBeInTheDocument()
  })

  it('does not show Retired when an investigator resigned from a scenario', () => {
    const neal = {
      playerName: 'Devin',
      investigatorName: "Neal O'Grady",
      archetype: 'Rogue' as const,
    }
    const leftRosterEntry = {
      seatId: 'seat:devin:1',
      slotId: 'seat:devin:1:slot:1',
      playerName: 'Devin',
      investigator: neal,
      seatStatus: 'left' as const,
      joinedAtScenarioIndex: 0,
      startedAtScenarioIndex: 0,
      endedAtScenarioIndex: 0,
      xpTotal: 2,
      xpSpent: 0,
      physicalTrauma: 0,
      mentalTrauma: 0,
    }
    const run = makeRun({
      setupSnapshot: {
        date: '2026-08-17',
        investigators: [neal],
      },
      currentRoster: [leftRosterEntry],
      scenarioLogs: [{
        id: 'scenario-1',
        date: '2026-08-18',
        scenarioName: 'The Witching Hour',
        investigators: [neal],
        investigatorOutcomes: [{
          seatId: leftRosterEntry.seatId,
          slotId: leftRosterEntry.slotId,
          playerName: 'Devin',
          investigatorName: "Neal O'Grady",
          status: 'resigned',
          xpEarned: 2,
          traumaGainedPhysical: 0,
          traumaGainedMental: 0,
        }],
        rosterAfter: [leftRosterEntry],
      }],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getAllByText("Neal O'Grady").length).toBeGreaterThan(0)
    expect(screen.queryByText('Retired')).not.toBeInTheDocument()
  })

  it('lists historical investigators without a generic Former badge', () => {
    const neal = {
      playerName: 'Devin',
      investigatorName: "Neal O'Grady",
      archetype: 'Rogue' as const,
    }
    const wendy = {
      playerName: 'Devin',
      investigatorName: 'Wendy Adams',
      archetype: 'Survivor' as const,
    }
    const nealEntry = {
      seatId: 'seat:devin:1',
      slotId: 'seat:devin:1:slot:1',
      playerName: 'Devin',
      investigator: neal,
      seatStatus: 'active' as const,
      joinedAtScenarioIndex: 0,
      startedAtScenarioIndex: 0,
      xpTotal: 3,
      xpSpent: 0,
      physicalTrauma: 0,
      mentalTrauma: 0,
    }
    const wendyEntry = {
      ...nealEntry,
      slotId: 'seat:devin:1:slot:2',
      investigator: wendy,
      joinedAtScenarioIndex: 1,
      startedAtScenarioIndex: 1,
      xpTotal: 0,
    }
    const run = makeRun({
      setupSnapshot: {
        date: '2026-08-17',
        investigators: [neal],
      },
      scenarioLogs: [
        {
          id: 'scenario-1',
          date: '2026-08-18',
          scenarioName: 'The Witching Hour',
          investigators: [neal],
          rosterBefore: [nealEntry],
          rosterAfter: [nealEntry],
        },
        {
          id: 'scenario-2',
          date: '2026-08-19',
          scenarioName: "At Death's Doorstep",
          investigators: [wendy],
          rosterBefore: [nealEntry],
          rosterAfter: [wendyEntry],
        },
      ],
      currentRoster: [wendyEntry],
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    expect(screen.getAllByText("Neal O'Grady").length).toBeGreaterThan(0)
    expect(screen.getAllByText('Wendy Adams').length).toBeGreaterThan(0)
    expect(screen.queryByText('Former')).not.toBeInTheDocument()
  })

  it('renders duplicate player names as separate simultaneous roster seats', () => {
    const run = makeRun({
      setupSnapshot: {
        date: '2026-08-17',
        investigators: [
          {
            playerName: 'Alice',
            investigatorName: 'Roland Banks',
            archetype: 'Guardian',
          },
          {
            playerName: 'Alice',
            investigatorName: 'Daisy Walker',
            archetype: 'Seeker',
          },
        ],
      },
      scenarioLogs: [],
      currentRoster: undefined,
    })

    render(
      <CampaignRunCard
        campaignRun={run}
        isExpanded
        onToggleExpanded={vi.fn()}
        onContinue={vi.fn()}
        onEditRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onEditScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
      />,
    )

    const rosterRows = within(screen.getByRole('list', { name: /campaign roster summary/i }))
      .getAllByRole('listitem')
    expect(rosterRows).toHaveLength(2)
    expect(rosterRows[0]).toHaveTextContent('Alice')
    expect(rosterRows[0]).toHaveTextContent('Roland Banks')
    expect(rosterRows[1]).toHaveTextContent('Alice')
    expect(rosterRows[1]).toHaveTextContent('Daisy Walker')
  })
})
