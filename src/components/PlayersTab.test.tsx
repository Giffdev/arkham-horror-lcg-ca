import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayersTab } from './PlayersTab'
import { ALL_CAMPAIGNS } from '@/lib/campaign-data'
import type { CampaignRun, Playthrough } from '@/lib/types'

vi.mock('./PlayerStats', () => ({ PlayerStats: () => <div>Investigator statistics</div> }))
vi.mock('./PlayersOverview', () => ({ PlayersOverview: () => <div>All player statistics</div> }))

const records: Playthrough[] = [
  { id: 'legacy', date: '2026-01-01', campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign',
    scenarioName: 'Extracurricular Activity', sideStories: ['Curse of the Rougarou'],
    investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }] },
  { id: 'small', date: '2026-01-01', campaignName: 'Children of Blood', campaignType: 'Small Campaign',
    scenarioName: 'By the Book', investigators: [{ playerName: 'Bob', investigatorName: 'Daisy Walker', archetype: 'Seeker' }] },
]

function Harness() {
  const [selectedPlayer, onSelectPlayer] = useState<string | null>(null)
  return <PlayersTab isLoading={false} playthroughs={records} campaignPlaythroughs={records} campaignRuns={[]}
    allPlayers={['Alice', 'Bob']} selectedPlayer={selectedPlayer} onSelectPlayer={onSelectPlayer} />
}

describe('Players tab campaign view', () => {
  it('makes individual campaign coverage discoverable and scopes it to the selected player', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByText(/Select a player to see their played and not played campaigns/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Alice' })[0])
    let panel = within(screen.getByRole('region', { name: "Alice's campaigns" }))
    expect(panel.getByRole('tab', { name: 'Played (2)' })).toHaveAttribute('aria-selected', 'true')
    expect(panel.getByRole('heading', { name: 'The Dunwich Legacy' })).toBeVisible()
    expect(panel.getByRole('heading', { name: 'Curse of the Rougarou' })).toBeVisible()
    expect(panel.queryByRole('heading', { name: 'Children of Blood' })).not.toBeInTheDocument()
    expect(panel.getByText(/at least one logged scenario, not campaign completion/)).toBeVisible()
    expect(screen.getByText('Investigator statistics')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Bob' })[0])
    panel = within(screen.getByRole('region', { name: "Bob's campaigns" }))
    expect(panel.getByRole('tab', { name: 'Played (1)' })).toBeInTheDocument()
    expect(panel.getByRole('heading', { name: 'Children of Blood' })).toBeVisible()
    expect(panel.queryByRole('heading', { name: 'Curse of the Rougarou' })).not.toBeInTheDocument()
  })

  it('combines status, scope and search, preserving filters across status tabs with useful empty states', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getAllByRole('button', { name: 'Alice' })[0])
    const panel = within(screen.getByRole('region', { name: "Alice's campaigns" }))
    await user.click(panel.getByRole('button', { name: 'Scenario Pack' }))
    expect(panel.getByRole('tab', { name: 'Played (1)' })).toBeInTheDocument()
    await user.type(panel.getByRole('textbox', { name: 'Search campaigns and scenario packs' }), 'Carnevale')
    expect(panel.getByText('No campaigns or scenario packs played match this view.')).toBeVisible()
    await user.click(panel.getByRole('tab', { name: 'Not Played (1)' }))
    expect(panel.getByRole('heading', { name: 'Carnevale of Horrors' })).toBeVisible()
    expect(panel.getByRole('textbox')).toHaveValue('Carnevale')
    await user.clear(panel.getByRole('textbox'))
    await user.type(panel.getByRole('textbox'), 'Curse of the Rougarou')
    expect(panel.getByText('No unplayed campaigns or scenario packs match this view.')).toBeVisible()
  })

  it('can show an entirely unplayed catalog without inventing progress', () => {
    render(<PlayersTab isLoading={false} playthroughs={records} campaignPlaythroughs={[]} campaignRuns={[]}
      allPlayers={['Alice']} selectedPlayer="Alice" onSelectPlayer={vi.fn()} />)
    const panel = within(screen.getByRole('region', { name: "Alice's campaigns" }))
    expect(panel.getByRole('tab', { name: 'Played (0)' })).toBeInTheDocument()
    expect(panel.getByRole('tab', { name: `Not Played (${ALL_CAMPAIGNS.length})` })).toBeInTheDocument()
    expect(panel.getByText('No campaigns or scenario packs played match this view.')).toBeVisible()
  })

  it('uses original campaign scenario participants rather than collapsed investigator-stat records', () => {
    const campaign: CampaignRun = {
      id: 'run', version: 2, campaignLineageId: 'dunwich', campaignName: 'The Dunwich Legacy',
      campaignType: 'Full Campaign', startedAt: '2026-01-01', updatedAt: '2026-01-01', status: 'active',
      setupSnapshot: { date: '2026-01-01', investigators: records[0].investigators },
      scenarioLogs: [{
        id: 'side', date: '2026-01-01', scenarioName: 'Curse of the Rougarou', scenarioType: 'side_scenario',
        investigators: records[0].investigators,
        investigatorOutcomes: [{
          seatId: 'bob', slotId: 'daisy', playerName: 'Bob', investigatorName: 'Daisy Walker',
          status: 'survived', xpEarned: 0, traumaGainedPhysical: 0, traumaGainedMental: 0,
        }],
      }],
    }
    const { rerender } = render(<PlayersTab isLoading={false} playthroughs={records} campaignPlaythroughs={[]} campaignRuns={[campaign]}
      allPlayers={['Alice', 'Bob']} selectedPlayer="Alice" onSelectPlayer={vi.fn()} />)
    expect(within(screen.getByRole('region', { name: "Alice's campaigns" })).getByRole('tab', { name: 'Played (0)' })).toBeInTheDocument()
    rerender(<PlayersTab isLoading={false} playthroughs={records} campaignPlaythroughs={[]} campaignRuns={[campaign]}
      allPlayers={['Alice', 'Bob']} selectedPlayer="Bob" onSelectPlayer={vi.fn()} />)
    const panel = within(screen.getByRole('region', { name: "Bob's campaigns" }))
    expect(panel.getByRole('heading', { name: 'Curse of the Rougarou' })).toBeVisible()
    expect(panel.queryByRole('heading', { name: 'The Dunwich Legacy' })).not.toBeInTheDocument()
  })
})
