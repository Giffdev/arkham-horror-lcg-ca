import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayersTab } from './PlayersTab'
import { ALL_CAMPAIGNS } from '@/lib/campaign-data'
import { getCampaignSvgRaw } from '@/lib/campaign-icon-map'
import { buildCampaignRunFromSourcePlaythrough } from '@/lib/campaign-runs'
import type { CampaignRun, Playthrough } from '@/lib/types'
import tracesRaw from '@/components/icons/traces_to_nowhere.svg?raw'

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
  it.each([null, 'Alice', 'Bob'])('keeps promoted whole-campaign history in the correct played scope for %s', async player => {
    const user = userEvent.setup()
    const source: Playthrough = {
      ...records[0], campaignName: 'The Drowned City', campaignSet: 'The Drowned City',
      date: '2026-11-03', scenarioName: undefined, sideStories: undefined,
    }
    const run = buildCampaignRunFromSourcePlaythrough(source)
    render(<PlayersTab isLoading={false} playthroughs={[source]}
      campaignPlaythroughs={[{ ...source, promotedToCampaignRunId: run.id }]} campaignRuns={[run]}
      allPlayers={['Alice', 'Bob']} selectedPlayer={player} onSelectPlayer={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    const panel = within(screen.getByRole('region', {
      name: player ? `${player}'s campaigns` : 'All players’ campaigns',
    }))
    await user.type(panel.getByRole('textbox', { name: 'Search campaigns and scenario packs' }), 'Drowned')
    if (player === 'Bob') {
      expect(panel.getByRole('tab', { name: 'Played (0)' })).toBeVisible()
      await user.click(panel.getByRole('tab', { name: 'Not Played (1)' }))
      expect(panel.getByRole('heading', { name: 'The Drowned City' })).toBeVisible()
    } else {
      expect(panel.getByRole('tab', { name: 'Played (1)' })).toBeVisible()
      await user.click(panel.getByRole('button', { name: 'Full Campaign', exact: true }))
      await user.click(panel.getByRole('button', { name: 'History for The Drowned City (1)' }))
      expect(panel.getByRole('link', { name: 'Roland Banks' })).toBeVisible()
      expect(panel.queryByText(/0 of 8/)).toBeNull()
      await user.click(panel.getByRole('tab', { name: 'Not Played (0)' }))
      expect(panel.queryByRole('heading', { name: 'The Drowned City' })).toBeNull()
    }
  })

  it('keeps the Traces artwork when searching the played catalog and opening its history', async () => {
    const user = userEvent.setup()
    const record: Playthrough = {
      ...records[0], campaignName: 'Traces To Nowhere', campaignSet: 'Scenario Pack',
      campaignType: 'Scenario Pack', scenarioName: 'Traces To Nowhere', sideStories: undefined,
    }
    render(<PlayersTab isLoading={false} playthroughs={[record]} campaignPlaythroughs={[record]} campaignRuns={[]}
      allPlayers={['Alice']} selectedPlayer="Alice" onSelectPlayer={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    const panel = within(screen.getByRole('region', { name: "Alice's campaigns" }))
    await user.type(panel.getByRole('textbox', { name: 'Search campaigns and scenario packs' }), 'traces')
    const heading = panel.getByRole('heading', { name: 'Traces To Nowhere' })
    const source = new DOMParser().parseFromString(tracesRaw, 'image/svg+xml')
    expect(heading.querySelector('svg path')?.getAttribute('d')).toBe(source.querySelector('path')?.getAttribute('d'))
    await user.click(panel.getByRole('button', { name: 'History for Traces To Nowhere (1)' }))
    expect(panel.getByRole('link', { name: 'Roland Banks' })).toBeVisible()
    expect(heading.querySelector('svg path')?.getAttribute('d')).toBe(source.querySelector('path')?.getAttribute('d'))
  })

  it('renders distinct historical Joe Diamond chapters and link targets in aggregate and selected-player history', async () => {
    const user = userEvent.setup()
    const source: Playthrough = {
      ...records[0], sideStories: undefined,
      investigators: [
        { playerName: 'Alice', investigatorName: 'Joe Diamond', investigatorId: 'joe-diamond',
          chapter: 1, investigatorSet: 'The Circle Undone', archetype: 'Seeker' },
        { playerName: 'Alice', investigatorName: 'Joe Diamond', investigatorId: 'joe-diamond-ch2',
          chapter: 2, investigatorSet: 'Core 2026', archetype: 'Seeker' },
        { playerName: 'Alice', investigatorName: 'Joe Diamond', investigatorId: 'custom-joe',
          isCustom: true, customInvestigatorName: 'Joe Diamond', archetype: 'Mystic' },
      ],
    }
    const campaign = buildCampaignRunFromSourcePlaythrough(source)
    const log = campaign.scenarioLogs[0]
    log.rosterBefore = structuredClone(campaign.currentRoster!)
    log.investigatorOutcomes = log.rosterBefore.map(entry => ({
      seatId: entry.seatId, slotId: entry.slotId, playerName: entry.playerName,
      investigatorName: entry.investigator.investigatorName,
      status: 'survived', xpEarned: 0, traumaGainedPhysical: 0, traumaGainedMental: 0,
    }))
    campaign.currentRoster = campaign.currentRoster!.map(entry => ({
      ...entry, slotId: `${entry.slotId}:replacement`, investigator: records[0].investigators[0],
    }))
    const props = {
      isLoading: false, playthroughs: [source], campaignPlaythroughs: [], campaignRuns: [campaign],
      allPlayers: ['Alice'], onSelectPlayer: vi.fn(),
    }
    const { rerender } = render(<PlayersTab {...props} selectedPlayer={null} />)
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    for (const player of [null, 'Alice']) {
      rerender(<PlayersTab {...props} selectedPlayer={player} />)
      const panel = within(screen.getByRole('region', {
        name: player ? "Alice's campaigns" : 'All players’ campaigns',
      }))
      const toggle = panel.getByText('History for The Dunwich Legacy (1)')
      const historyElement = toggle.parentElement!
      if (!within(historyElement).queryByRole('link')) await user.click(toggle)
      const history = within(historyElement)
      const links = history.getAllByRole('link', { name: 'Joe Diamond' })
      expect(links.map(link => link.getAttribute('href'))).toEqual([
        'https://arkhamdb.com/card/05002', 'https://arkhamdb.com/card/12004',
      ])
      expect(links[0].parentElement).toHaveTextContent('Ch. 1')
      expect(links[1].parentElement).toHaveTextContent('Ch. 2')
      expect(history.getAllByText('Joe Diamond')).toHaveLength(3)
      expect(history.getByText('Mystic')).toBeVisible()
    }
  })

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
      ['Traces To Nowhere', 'Traces To Nowhere'],
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
    expect(screen.getByRole('textbox', { name: 'Search investigators' })).toBeVisible()
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
    expect(bob.getByRole('textbox')).toHaveValue('Carnevale')
    expect(bob.getByRole('button', { name: 'Scenario Pack' })).toHaveAttribute('aria-pressed', 'true')
    expect(bob.getByRole('tab', { name: 'Not Played (1)' })).toHaveAttribute('aria-selected', 'true')
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
    expect(panel.getByText(`History for ${parent} (2)`)).toBeVisible()
    expect(panel.getByText(`History for ${first} (1)`)).toBeVisible()
    expect(panel.getByText(`History for ${second} (1)`)).toBeVisible()
    rerender(<PlayersTab {...props} campaignPlaythroughs={[pack(parent)]} />)
    expect(panel.getByRole('tab', { name: 'Played (3)' })).toBeVisible()
    for (const name of [parent, first, second]) {
      expect(panel.getByRole('heading', { name })).toBeVisible()
      expect(panel.getByText(`History for ${name} (1)`)).toBeVisible()
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
    const all = within(screen.getByRole('region', { name: 'All players’ campaigns' }))
    expect(all.getByRole('tab', { name: 'Played (3)' })).toBeVisible()
    expect(all.getByRole('heading', { name: 'Children of Blood' })).toBeVisible()
    await user.click(screen.getAllByRole('button', { name: 'Alice' })[0])
    let panel = within(screen.getByRole('region', { name: "Alice's campaigns" }))
    expect(panel.getByRole('tab', { name: 'Played (2)' })).toHaveAttribute('aria-selected', 'true')
    expect(panel.getByRole('heading', { name: 'The Dunwich Legacy' })).toBeVisible()
    expect(panel.getByRole('heading', { name: 'Curse of the Rougarou' })).toBeVisible()
    expect(panel.queryByRole('heading', { name: 'Children of Blood' })).not.toBeInTheDocument()
    expect(panel.queryByRole('heading', { name: 'Campaigns & Scenario Packs' })).not.toBeInTheDocument()
    expect(panel.queryByText(/at least one logged scenario, not campaign completion/)).not.toBeInTheDocument()
    expect(panel.getByRole('tablist', { name: 'Campaign play status' })).toBeVisible()
    expect(panel.getByRole('textbox', { name: 'Search campaigns and scenario packs' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Top Investigators' })).toBeVisible()

    await user.click(screen.getAllByRole('button', { name: 'Bob' })[0])
    panel = within(screen.getByRole('region', { name: "Bob's campaigns" }))
    expect(panel.getByRole('tab', { name: 'Played (1)' })).toBeInTheDocument()
    expect(panel.getByRole('heading', { name: 'Children of Blood' })).toBeVisible()
    expect(panel.queryByRole('heading', { name: 'Curse of the Rougarou' })).not.toBeInTheDocument()
  })

  it('shows real all-player history and preserves the pivot and catalog filters when selecting and clearing a player', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    let panel = within(screen.getByRole('region', { name: 'All players’ campaigns' }))
    await user.click(panel.getByRole('button', { name: 'Small Campaign' }))
    await user.type(panel.getByRole('textbox'), ' blood ')
    await user.click(panel.getByText('History for Children of Blood (1)'))
    expect(panel.getByText('By the Book')).toBeVisible()
    expect(panel.getByRole('link', { name: 'Daisy Walker' })).toBeVisible()
    expect(panel.getByText('Bob ·')).toBeVisible()
    await user.click(screen.getAllByRole('button', { name: 'Alice' })[0])
    panel = within(screen.getByRole('region', { name: "Alice's campaigns" }))
    expect(panel.getByRole('textbox')).toHaveValue(' blood ')
    expect(panel.getByRole('tab', { name: 'Played (0)' })).toHaveAttribute('aria-selected', 'true')
    expect(panel.getByText('No campaigns or scenario packs played match this view.')).toBeVisible()
    await user.click(panel.getByRole('tab', { name: 'Not Played (1)' }))
    expect(panel.getByRole('heading', { name: 'Children of Blood' })).toBeVisible()
    expect(panel.queryByText(/History for/)).not.toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Alice' })[0])
    panel = within(screen.getByRole('region', { name: 'All players’ campaigns' }))
    expect(panel.getByRole('button', { name: 'Small Campaign' })).toHaveAttribute('aria-pressed', 'true')
    expect(panel.getByRole('textbox')).toHaveValue(' blood ')
    expect(panel.getByRole('tab', { name: 'Not Played (0)' })).toHaveAttribute('aria-selected', 'true')
    await user.click(panel.getByRole('tab', { name: 'Played (1)' }))
    expect(panel.getByRole('heading', { name: 'Children of Blood' })).toBeVisible()
  })

  it('searches investigators in the selected-player catalog, combines filters and preserves them across the outer pivot', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getAllByRole('button', { name: 'Alice' })[0])
    const search = screen.getByRole('textbox', { name: 'Search investigators' })
    await user.type(search, ' roLAND ')
    expect(screen.getByRole('heading', { name: 'Roland Banks', exact: true })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('button', { name: 'Chapter 2' }))
    expect(screen.getByText('No investigators match the selected filters')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Chapter 1' }))
    await user.click(screen.getByRole('button', { name: 'Guardian' }))
    await user.click(screen.getByRole('button', { name: 'Core', exact: true }))
    expect(screen.getByRole('heading', { name: 'Roland Banks', exact: true })).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Unplayed', exact: true }))
    expect(screen.getByText('No unplayed investigators match the selected filters')).toBeVisible()
    await user.clear(search)
    await user.type(search, 'Zoey')
    expect(screen.getByText('No unplayed investigators match the selected filters')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Core', exact: true }))
    expect(screen.getByRole('heading', { name: 'Zoey Samaras', exact: true })).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    await user.click(screen.getByRole('tab', { name: 'Investigators', exact: true }))
    expect(search).toHaveValue('Zoey')
    expect(screen.getByRole('tab', { name: 'Unplayed', exact: true })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Zoey Samaras', exact: true })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Alice', exact: true })).toBeVisible()
  })

  it('keeps the all-player catalogs available with no logged evidence or named players', async () => {
    const user = userEvent.setup()
    render(<PlayersTab isLoading={false} playthroughs={[]} allPlayers={[]} selectedPlayer={null} onSelectPlayer={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Search investigators' })).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    const panel = within(screen.getByRole('region', { name: 'All players’ campaigns' }))
    expect(panel.getByRole('tab', { name: 'Played (0)' })).toBeVisible()
    await user.click(panel.getByRole('tab', { name: `Not Played (${ALL_CAMPAIGNS.length})` }))
    expect(panel.getByRole('heading', { name: 'The Dunwich Legacy', exact: true })).toBeVisible()
    expect(panel.queryByText(/History for/)).not.toBeInTheDocument()
  })

  it('preserves all-player investigator search and filters across the campaign pivot', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('button', { name: 'Seeker' }))
    await user.type(screen.getByRole('textbox', { name: 'Search investigators' }), 'daisy')
    expect(screen.getByRole('tab', { name: 'Played (1)' })).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    await user.click(screen.getByRole('tab', { name: 'Investigators', exact: true }))
    expect(screen.getByRole('textbox', { name: 'Search investigators' })).toHaveValue('daisy')
    expect(screen.getByRole('tab', { name: 'Played (1)' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Daisy Walker', exact: true })).toBeVisible()
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

  it('renders deduplicated promoted, embedded and multipart history using actual participants in all-player and individual views', async () => {
    const user = userEvent.setup()
    const first = 'The Eternal Slumber'
    const second = "The Night's Usurper"
    const source: Playthrough = { ...records[0], sideStories: [first, first] }
    const run = buildCampaignRunFromSourcePlaythrough(source, { campaignRunId: 'promoted' })
    run.scenarioLogs.push({
      id: 'bob-part', date: '2026-02-01', scenarioName: second, scenarioType: 'side_scenario',
      investigators: records[0].investigators,
      investigatorOutcomes: [{
        seatId: 'bob', slotId: 'daisy', playerName: 'Bob', investigatorName: 'Daisy Walker',
        status: 'survived', xpEarned: 3, traumaGainedPhysical: 0, traumaGainedMental: 0,
      }],
    }, {
      id: 'empty', date: '2026-03-01', scenarioName: 'Carnevale of Horrors', scenarioType: 'side_scenario',
      investigators: records[0].investigators, investigatorOutcomes: [],
    })
    const props = {
      isLoading: false, playthroughs: records, allPlayers: ['Alice', 'Bob'], onSelectPlayer: vi.fn(),
      campaignPlaythroughs: [{ ...source, promotedToCampaignRunId: run.id }], campaignRuns: [run],
    }
    const before = JSON.stringify(props)
    const { rerender } = render(<PlayersTab {...props} selectedPlayer={null} />)
    await user.click(screen.getByRole('tab', { name: 'Campaigns & Scenarios' }))
    let panel = within(screen.getByRole('region', { name: 'All players’ campaigns' }))
    expect(panel.getByRole('tab', { name: 'Played (4)' })).toBeVisible()
    expect(panel.queryByRole('heading', { name: 'Carnevale of Horrors' })).not.toBeInTheDocument()
    await user.click(panel.getByText('History for Guardians of the Abyss (2)'))
    const history = within(panel.getByText('History for Guardians of the Abyss (2)').parentElement!)
    expect(history.getAllByRole('link')).toHaveLength(2)
    expect(history.getByRole('link', { name: 'Roland Banks' })).toBeVisible()
    expect(history.getByRole('link', { name: 'Daisy Walker' })).toBeVisible()
    expect(history.getByText('Extracurricular Activity')).toBeVisible()
    expect(history.getByText(second)).toBeVisible()
    rerender(<PlayersTab {...props} selectedPlayer="Alice" />)
    panel = within(screen.getByRole('region', { name: "Alice's campaigns" }))
    expect(panel.getByRole('tab', { name: 'Played (2)' })).toBeVisible()
    expect(panel.queryByRole('heading', { name: 'Guardians of the Abyss' })).not.toBeInTheDocument()
    expect(panel.getByText(`History for ${first} (1)`)).toBeVisible()
    await user.click(panel.getByText(`History for ${first} (1)`))
    expect(panel.getByRole('link', { name: 'Roland Banks' })).toBeVisible()
    expect(panel.queryByRole('link', { name: 'Daisy Walker' })).not.toBeInTheDocument()
    rerender(<PlayersTab {...props} selectedPlayer="Bob" />)
    panel = within(screen.getByRole('region', { name: "Bob's campaigns" }))
    expect(panel.getByRole('tab', { name: 'Played (1)' })).toBeVisible()
    expect(panel.getByText(`History for ${second} (1)`)).toBeVisible()
    expect(panel.queryByRole('heading', { name: first })).not.toBeInTheDocument()
    expect(JSON.stringify(props)).toBe(before)
  })
})
