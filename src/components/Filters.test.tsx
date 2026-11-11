import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Filters } from './Filters'
import type { Playthrough } from '@/lib/types'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  })
})

const playthroughs: Playthrough[] = [
  {
    id: 'pt-1',
    date: '2026-07-20',
    campaignName: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
  },
  {
    id: 'pt-2',
    date: '2026-07-21',
    campaignName: 'The Night of the Zealot',
    campaignType: 'Small Campaign',
    investigators: [{ playerName: 'Bob', investigatorName: 'Daisy Walker', archetype: 'Seeker' }],
  },
]

describe('Filters campaign semantics', () => {
  it('offers scenario packs embedded in campaigns and counts each containing record once', () => {
    render(
      <Filters selectedArchetypes={[]} selectedCampaignTypes={['Scenario Pack']} selectedCampaigns={[]}
        onArchetypeToggle={vi.fn()} onCampaignTypeToggle={vi.fn()} onCampaignToggle={vi.fn()} onClearFilters={vi.fn()}
        playthroughs={[{
          ...playthroughs[0],
          sideStories: ['Curse of the Rougarou', 'Curse of the Rougarou'],
        }]} />,
    )
    expect(screen.getByRole('button', { name: /Scenario Pack\s*\(1\)/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /Curse of the Rougarou\s*\(1\)/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Carnevale of Horrors/ })).not.toBeInTheDocument()
  })

  it('uses campaign-log wording and does not present campaigns and game nights as peer filters', () => {
    render(
      <Filters
        selectedArchetypes={[]}
        selectedCampaignTypes={['Full Campaign']}
        selectedCampaigns={[]}
        onArchetypeToggle={vi.fn()}
        onCampaignTypeToggle={vi.fn()}
        onCampaignToggle={vi.fn()}
        onClearFilters={vi.fn()}
        playthroughs={playthroughs}
      />,
    )

    expect(screen.getByText('Campaign Scope')).toBeInTheDocument()
    expect(screen.getByText('Campaign')).toBeInTheDocument()
    expect(screen.queryByText('Campaign Type')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Game Night/i })).not.toBeInTheDocument()
  })

  it('keeps campaign-scope filtering functional', async () => {
    const user = userEvent.setup()
    const onCampaignTypeToggle = vi.fn()

    render(
      <Filters
        selectedArchetypes={[]}
        selectedCampaignTypes={[]}
        selectedCampaigns={[]}
        onArchetypeToggle={vi.fn()}
        onCampaignTypeToggle={onCampaignTypeToggle}
        onCampaignToggle={vi.fn()}
        onClearFilters={vi.fn()}
        playthroughs={playthroughs}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Full Campaign/i }))
    expect(onCampaignTypeToggle).toHaveBeenCalledWith('Full Campaign')
  })
})
