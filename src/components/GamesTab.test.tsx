import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { GamesTab } from './GamesTab'

vi.mock('@/components/PlaythroughCard', () => ({
  PlaythroughCard: () => null,
}))

vi.mock('@/components/PlaythroughCardSkeleton', () => ({
  PlaythroughCardSkeleton: () => null,
}))

vi.mock('@/components/EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}))

vi.mock('@/components/Filters', () => ({
  Filters: () => <div data-testid="filters" />,
}))

vi.mock('@/components/CampaignRunCard', () => ({
  CampaignRunCard: () => null,
}))

describe('GamesTab', () => {
  it('does not render standalone import or export buttons in the main games interface', () => {
    render(
      <GamesTab
        isLoading={false}
        playthroughs={[]}
        campaignRuns={[]}
        topLevelRows={[]}
        filteredTopLevelRows={[]}
        filterPlaythroughs={[]}
        filters={{
          selectedArchetypes: [],
          selectedCampaignTypes: [],
          selectedCampaigns: [],
        }}
        filterHandlers={{
          onArchetypeToggle: vi.fn(),
          onCampaignTypeToggle: vi.fn(),
          onCampaignToggle: vi.fn(),
          onClearFilters: vi.fn(),
        }}
        onEdit={vi.fn()}
        onContinueCampaign={vi.fn()}
        onContinueCampaignRun={vi.fn()}
        onEditCampaignRun={vi.fn()}
        onDeleteCampaignRun={vi.fn()}
        onEditCampaignScenario={vi.fn()}
        onDeleteCampaignScenario={vi.fn()}
        expandedCampaignRunIds={new Set()}
        onToggleCampaignRunExpanded={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /^Export Data$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Import Data$/i })).not.toBeInTheDocument()
  })
})
