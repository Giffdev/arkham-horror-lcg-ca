import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayersTab } from './PlayersTab'
import { ALL_CAMPAIGNS } from '@/lib/campaign-data'
import { getCampaignSvgRaw } from '@/lib/campaign-icon-map'
import type { CampaignRun, Playthrough } from '@/lib/types'

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
  it('uses canonical decorative campaign and multipart artwork in the unplayed catalog, with readable fallback labels', async () => {
    const user = userEvent.setup()
    render(<PlayersTab isLoading={false} playthroughs={records} campaignPlaythroughs={[]} campaignRuns={[]}
      allPlayers={['Alice']} selectedPlayer="Alice" onSelectPlayer={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    const panel = within(screen.getByRole('region', { name: "Alice's campaigns" }))
    await user.click(panel.getByRole('tab', { name: /^Not Played/ }))
    for (const [name, iconKey] of [
      ['The Night of the Zealot', 'Core'],
      ['The Dunwich Legacy', 'The Dunwich Legacy'],
      ['Return to The Night of the Zealot', 'Return to The Night of the Zealot'],
      ['Children of Blood', 'Children of Blood'],
      ['Brethren of Ash', 'Core 2026'],
      ['Guardians of the Abyss', 'Guardians of the Abyss'],
      ['The Eternal Slumber', 'Guardians of the Abyss'],
      ["The Night's Usurper", 'Guardians of the Abyss'],
      ['Fortune and Folly', 'Fortune and Folly'],
      ['Fortune and Folly, Part I', 'Fortune and Folly'],
      ['Fortune and Folly, Part II', 'Fortune and Folly'],
      ['Traces To Nowhere', 'Scenario Pack'],
    ]) {
      const heading = panel.getByRole('heading', { name, exact: true })
      const decorative = heading.querySelector('[aria-hidden="true"]')
      const expected = document.createElement('span')
      expected.innerHTML = getCampaignSvgRaw(iconKey)
      expect(heading).toBeVisible()
      expect(heading).toHaveAccessibleName(name)
      expect(decorative?.querySelector('svg')?.innerHTML).toBe(expected.querySelector('svg')?.innerHTML)
    }
  })

  it('keeps existing summary cards above an accessible pivot and preserves player and filters across pivots', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByText('All player statistics')).toBeVisible()
    await user.click(screen.getAllByRole('button', { name: 'Alice' })[0])
    const pivot = screen.getByRole('tablist', { name: 'Player drilldown' })
    for (const name of ['Top Campaigns', 'Top Players', 'Top Investigators', 'Class Ranking']) {
      const summary = screen.getByRole('heading', { name })
      expect(summary).toBeVisible()
      expect(summary.compareDocumentPosition(pivot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(within(pivot).getByRole('tab', { name: 'Investigators' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Investigators' })).toBeVisible()
    expect(screen.queryByRole('region', { name: "Alice's campaigns" })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Unplayed', exact: true }))
    await user.click(within(pivot).getByRole('tab', { name: 'Campaigns & Scenarios' }))
    expect(screen.getByRole('tabpanel', { name: 'Campaigns & Scenarios' })).toBeVisible()
    expect(screen.queryByRole('tabpanel', { name: 'Investigators' })).not.toBeInTheDocument()
    const panel = within(screen.getByRole('region', { name: "Alice's campaigns" }))
    await user.click(panel.getByRole('button', { name: 'Scenario Pack' }))
    await user.type(panel.getByRole('textbox'), 'Carnevale')
    await user.click(panel.getByRole('tab', { name: 'Not Played (1)' }))
    await user.click(within(pivot).getByRole('tab', { name: 'Investigators' }))
    expect(screen.getByRole('tab', { name: 'Unplayed', exact: true })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Alice', exact: true })).toBeVisible()
    // Radix keyboard navigation switches only the outer pivot.
    within(pivot).getByRole('tab', { name: 'Investigators' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(within(pivot).getByRole('tab', { name: 'Campaigns & Scenarios' })).toHaveAttribute('aria-selected', 'true')
    expect(panel.getByRole('textbox')).toHaveValue('Carnevale')
    expect(panel.getByRole('button', { name: 'Scenario Pack' })).toHaveAttribute('aria-pressed', 'true')
    expect(panel.getByRole('tab', { name: 'Not Played (1)' })).toHaveAttribute('aria-selected', 'true')
    expect(panel.getByRole('heading', { name: 'Carnevale of Horrors' })).toBeVisible()
    await user.click(screen.getAllByRole('button', { name: 'Bob' })[0])
    expect(screen.getByRole('heading', { name: 'Bob', exact: true })).toBeVisible()
    const bob = within(screen.getByRole('region', { name: "Bob's campaigns" }))
    expect(bob.getByRole('textbox')).toHaveValue('')
    expect(bob.getByRole('tab', { name: 'Played (1)' })).toHaveAttribute('aria-selected', 'true')
  })

  it.each([
    ['Guardians of the Abyss', 'The Eternal Slumber', "The Night's Usurper"],
    ['Fortune and Folly', 'Fortune and Folly, Part I', 'Fortune and Folly, Part II'],
  ])('keeps played and not-played views complementary for %s and its parts', async (parent, first, second) => {
    const user = userEvent.setup()
    const pack = (name: string): Playthrough => ({
      ...records[0], id: name, campaignName: name, campaignType: 'Scenario Pack',
      scenarioName: undefined, sideStories: undefined,
    })
    const props = {
      isLoading: false, playthroughs: records, campaignRuns: [], allPlayers: ['Alice'],
      selectedPlayer: 'Alice', onSelectPlayer: vi.fn(),
    }
    const { rerender } = render(<PlayersTab {...props} campaignPlaythroughs={[pack(first)]} />)
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    const panel = within(screen.getByRole('region', { name: "Alice's campaigns" }))
    expect(panel.getByRole('tab', { name: 'Played (1)' })).toBeVisible()
    expect(panel.getByRole('heading', { name: first })).toBeVisible()
    expect(panel.queryByRole('heading', { name: parent })).not.toBeInTheDocument()
    await user.click(panel.getByRole('tab', { name: /^Not Played/ }))
    expect(panel.getByRole('heading', { name: parent })).toBeVisible()
    expect(panel.getByRole('heading', { name: second })).toBeVisible()
    expect(panel.queryByRole('heading', { name: first })).not.toBeInTheDocument()

    rerender(<PlayersTab {...props} campaignPlaythroughs={[pack(first), pack(second)]} />)
    expect(panel.getByRole('tab', { name: 'Played (3)' })).toBeVisible()
    for (const name of [parent, first, second]) {
      expect(panel.queryByRole('heading', { name })).not.toBeInTheDocument()
    }
    await user.click(panel.getByRole('tab', { name: 'Played (3)' }))
    for (const name of [parent, first, second]) {
      expect(panel.getByRole('heading', { name })).toBeVisible()
    }
    rerender(<PlayersTab {...props} campaignPlaythroughs={[pack(parent)]} />)
    expect(panel.getByRole('tab', { name: 'Played (3)' })).toBeVisible()
    for (const name of [parent, first, second]) {
      expect(panel.getByRole('heading', { name })).toBeVisible()
    }
    await user.click(panel.getByRole('tab', { name: /^Not Played/ }))
    for (const name of [parent, first, second]) {
      expect(panel.queryByRole('heading', { name })).not.toBeInTheDocument()
    }
  })

  it('makes individual campaign coverage discoverable and scopes it to the selected player', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    expect(screen.getByText(/Select a player to see their played and not played campaigns/)).toBeVisible()
    await user.click(screen.getAllByRole('button', { name: 'Alice' })[0])
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    let panel = within(screen.getByRole('region', { name: "Alice's campaigns" }))
    expect(panel.getByRole('tab', { name: 'Played (2)' })).toHaveAttribute('aria-selected', 'true')
    expect(panel.getByRole('heading', { name: 'The Dunwich Legacy' })).toBeVisible()
    expect(panel.getByRole('heading', { name: 'Curse of the Rougarou' })).toBeVisible()
    expect(panel.queryByRole('heading', { name: 'Children of Blood' })).not.toBeInTheDocument()
    expect(panel.getByText(/at least one logged scenario, not campaign completion/)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Top Investigators' })).toBeVisible()

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
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
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

  it('can show an entirely unplayed catalog without inventing progress', async () => {
    const user = userEvent.setup()
    render(<PlayersTab isLoading={false} playthroughs={records} campaignPlaythroughs={[]} campaignRuns={[]}
      allPlayers={['Alice']} selectedPlayer="Alice" onSelectPlayer={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    const panel = within(screen.getByRole('region', { name: "Alice's campaigns" }))
    expect(panel.getByRole('tab', { name: 'Played (0)' })).toBeInTheDocument()
    expect(panel.getByRole('tab', { name: `Not Played (${ALL_CAMPAIGNS.length})` })).toBeInTheDocument()
    expect(panel.getByText('No campaigns or scenario packs played match this view.')).toBeVisible()
  })

  it('uses original campaign scenario participants rather than collapsed investigator-stat records', async () => {
    const user = userEvent.setup()
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
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    expect(within(screen.getByRole('region', { name: "Alice's campaigns" })).getByRole('tab', { name: 'Played (0)' })).toBeInTheDocument()
    rerender(<PlayersTab isLoading={false} playthroughs={records} campaignPlaythroughs={[]} campaignRuns={[campaign]}
      allPlayers={['Alice', 'Bob']} selectedPlayer="Bob" onSelectPlayer={vi.fn()} />)
    const panel = within(screen.getByRole('region', { name: "Bob's campaigns" }))
    expect(panel.getByRole('heading', { name: 'Curse of the Rougarou' })).toBeVisible()
    expect(panel.queryByRole('heading', { name: 'The Dunwich Legacy' })).not.toBeInTheDocument()
  })
})
