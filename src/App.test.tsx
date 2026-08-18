import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CampaignRun, Playthrough } from '@/lib/types'
import App from './App'

const mockPromotePlaythroughToCampaignRun = vi.fn()
const mockImportNormalizedData = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

let mockPlaythroughs: Playthrough[] = []
let mockCampaignRuns: CampaignRun[] = []

const mockPlaythroughActions = {
  add: vi.fn(async () => 'new-id'),
  update: vi.fn(async () => {}),
  upsert: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  setAll: vi.fn(async () => {}),
}

const mockCampaignRunActions = {
  add: vi.fn(async () => 'run-id'),
  upsert: vi.fn(async () => {}),
  edit: vi.fn(async () => ({})),
  remove: vi.fn(async () => {}),
  appendScenario: vi.fn(async () => ({})),
  editScenario: vi.fn(async () => ({})),
  removeScenario: vi.fn(async () => ({})),
}

vi.mock('@/lib/firestore', () => ({
  importNormalizedData: (...args: unknown[]) => mockImportNormalizedData(...args),
  promotePlaythroughToCampaignRun: (...args: unknown[]) => mockPromotePlaythroughToCampaignRun(...args),
}))

vi.mock('@/hooks/useAuthState', () => ({
  useAuthState: () => ({
    currentUser: {
      id: 'user-1',
      email: 'user@example.com',
      createdAt: 1,
      authProvider: 'email' as const,
    },
    isLoading: false,
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/usePlaythroughs', () => ({
  usePlaythroughs: () => [mockPlaythroughs, mockPlaythroughActions, false, null],
}))

vi.mock('@/hooks/useCampaignRuns', () => ({
  useCampaignRuns: () => [mockCampaignRuns, mockCampaignRunActions, false, null],
}))

vi.mock('@/hooks/usePlaythroughFilters', () => ({
  usePlaythroughFilters: (playthroughs: Playthrough[]) => ({
    filters: {
      selectedArchetypes: [],
      selectedCampaignTypes: [],
      selectedCampaigns: [],
    },
    handlers: {
      onArchetypeToggle: vi.fn(),
      onCampaignTypeToggle: vi.fn(),
      onCampaignToggle: vi.fn(),
      onClearFilters: vi.fn(),
    },
    filteredPlaythroughs: playthroughs,
  }),
}))

vi.mock('@/hooks/usePasswordLink', () => ({
  usePasswordLink: () => ({
    isGoogleUser: false,
    hasPasswordLinked: true,
    linkPasswordOpen: false,
    setLinkPasswordOpen: vi.fn(),
    linkPassword: '',
    setLinkPassword: vi.fn(),
    linkPasswordConfirm: '',
    setLinkPasswordConfirm: vi.fn(),
    linkPasswordLoading: false,
    handleLinkPassword: vi.fn(),
  }),
}))

vi.mock('@/hooks/useLegacyDataMigration', () => ({
  useLegacyDataMigration: vi.fn(),
}))

vi.mock('@/hooks/useCommunityStatsSync', () => ({
  useCommunityStatsSync: vi.fn(),
}))

vi.mock('@/lib/community-stats', () => ({
  markCommunityStatsDirty: vi.fn(),
}))

vi.mock('@/components/AppHeader', () => ({
  AppHeader: () => <div data-testid="app-header" />,
}))

vi.mock('@/components/GamesTab', () => ({
  GamesTab: (props: any) => (
    <div>
      <div data-testid="campaign-run-count">{props.campaignRuns?.length ?? 0}</div>
      <div data-testid="playthrough-count">{props.playthroughs?.length ?? 0}</div>
      <div data-testid="expanded-run-ids">{Array.from(props.expandedCampaignRunIds).join(',')}</div>
      {props.campaignRuns?.[0] ? (
        <button type="button" onClick={() => props.onContinueCampaignRun(props.campaignRuns[0])}>
          continue-run
        </button>
      ) : null}
      {props.playthroughs?.[0] ? (
        <button type="button" onClick={() => props.onContinueCampaign(props.playthroughs[0])}>
          continue-legacy
        </button>
      ) : null}
      {props.campaignRuns?.[0] ? (
        <button type="button" onClick={() => props.onDeleteCampaignRun(props.campaignRuns[0])}>
          delete-run
        </button>
      ) : null}
    </div>
  ),
}))

vi.mock('@/components/PlaythroughForm', () => ({
  PlaythroughForm: (props: any) => {
    if (!props.open) return null
    return (
      <button
        type="button"
        onClick={() =>
          props.onSave({
            date: '2026-08-20',
            campaignName: 'The Path to Carcosa',
            campaignSet: 'The Path to Carcosa',
            campaignType: 'Full Campaign',
            scenarioName: 'Curtain Call',
            investigators: [
              {
                playerName: 'Alice',
                investigatorName: 'Roland Banks',
                archetype: 'Guardian',
              },
            ],
            notes: '',
            sideStories: [],
          })
        }
      >
        submit-form
      </button>
    )
  },
}))

vi.mock('@/components/CampaignScenarioForm', () => ({
  CampaignScenarioForm: (props: any) => {
    if (!props.open) return null
    return (
      <button
        type="button"
        onClick={() =>
          props.onSave({
            date: '2026-08-20',
            scenarioName: 'Curtain Call',
            investigators: [
              {
                playerName: 'Alice',
                investigatorName: 'Roland Banks',
                archetype: 'Guardian',
              },
            ],
            sideStories: [],
            notes: '',
          })
        }
      >
        submit-scenario-form
      </button>
    )
  },
}))

vi.mock('@/components/PlayersTab', () => ({
  PlayersTab: () => <div data-testid="players-tab" />,
}))

vi.mock('@/components/CommunityStats', () => ({
  CommunityStats: () => <div data-testid="community-stats" />,
}))

vi.mock('@/components/CompletionStats', () => ({
  CompletionStatsPanel: () => <div data-testid="completion-stats" />,
}))

vi.mock('@/components/InvestigatorHeatmap', () => ({
  InvestigatorHeatmap: () => <div data-testid="heatmap" />,
}))

vi.mock('@/components/PublicHomepage', () => ({
  PublicHomepage: () => <div data-testid="public-homepage" />,
}))

vi.mock('@/components/MobileNav', () => ({
  MobileNav: () => <div data-testid="mobile-nav" />,
}))

vi.mock('@/components/PasswordLinkDialog', () => ({
  PasswordLinkDialog: () => null,
}))

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

function makeRun(id: string): CampaignRun {
  return {
    id,
    version: 1,
    campaignLineageId: 'campaign:path-to-carcosa',
    campaignName: 'The Path to Carcosa',
    campaignSet: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    startedAt: '2026-08-10',
    updatedAt: '2026-08-17T00:00:00.000Z',
    status: 'active',
    setupSnapshot: {
      date: '2026-08-10',
      investigators: [
        {
          playerName: 'Alice',
          investigatorName: 'Roland Banks',
          archetype: 'Guardian',
        },
      ],
    },
    scenarioLogs: [],
  }
}

function makeLegacyPlaythrough(id: string): Playthrough {
  return {
    id,
    date: '2026-08-09',
    campaignName: 'The Path to Carcosa',
    campaignSet: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    investigators: [
      {
        playerName: 'Alice',
        investigatorName: 'Roland Banks',
        archetype: 'Guardian',
      },
    ],
  }
}

describe('App campaign continuation flow', () => {
  beforeEach(() => {
    mockPlaythroughs = []
    mockCampaignRuns = []
    mockPromotePlaythroughToCampaignRun.mockReset()
    mockImportNormalizedData.mockReset()
    mockCampaignRunActions.appendScenario.mockClear()
    mockCampaignRunActions.edit.mockClear()
    mockCampaignRunActions.remove.mockClear()
    mockCampaignRunActions.removeScenario.mockClear()
    mockPlaythroughActions.add.mockClear()
    mockPlaythroughActions.update.mockClear()
    mockToastSuccess.mockClear()
    mockToastError.mockClear()
  })

  it('continues an existing campaign run by appending a scenario and auto-expanding the run', async () => {
    const user = userEvent.setup()
    mockCampaignRuns = [makeRun('run-1')]

    render(<App />)

    expect(screen.getByTestId('expanded-run-ids')).toHaveTextContent('')
    await user.click(screen.getByRole('button', { name: 'continue-run' }))
    await user.click(screen.getByRole('button', { name: 'submit-scenario-form' }))

    await waitFor(() =>
      expect(mockCampaignRunActions.appendScenario).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          scenarioName: 'Curtain Call',
        }),
      ),
    )
    await waitFor(() => expect(screen.getByTestId('expanded-run-ids')).toHaveTextContent('run-1'))
  })

  it('promotes a legacy campaign log before appending the first scenario entry', async () => {
    const user = userEvent.setup()
    mockPlaythroughs = [makeLegacyPlaythrough('legacy-1')]
    mockPromotePlaythroughToCampaignRun.mockResolvedValue({
      campaignRunId: 'legacy-1',
      status: 'created',
    })

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'continue-legacy' }))
    await user.click(screen.getByRole('button', { name: 'submit-scenario-form' }))

    await waitFor(() =>
      expect(mockPromotePlaythroughToCampaignRun).toHaveBeenCalledWith('user-1', 'legacy-1'),
    )
    await waitFor(() =>
      expect(mockCampaignRunActions.appendScenario).toHaveBeenCalledWith(
        'legacy-1',
        expect.objectContaining({
          scenarioName: 'Curtain Call',
        }),
      ),
    )
  })

  it('deletes a promoted run and renders the restored source after subscription reconciliation', async () => {
    const user = userEvent.setup()
    const restoredSource = {
      ...makeLegacyPlaythrough('source-restore'),
      promotedToCampaignRunId: undefined,
    }
    mockCampaignRuns = [{
      ...makeRun('run-delete'),
      sourcePlaythroughId: restoredSource.id,
    }]
    mockCampaignRunActions.remove.mockImplementationOnce(async () => {
      mockCampaignRuns = []
      mockPlaythroughs = [restoredSource]
    })

    const view = render(<App />)
    expect(screen.getByTestId('campaign-run-count')).toHaveTextContent('1')
    expect(screen.getByTestId('playthrough-count')).toHaveTextContent('0')

    await user.click(screen.getByRole('button', { name: 'delete-run' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mockCampaignRunActions.remove).toHaveBeenCalledWith('run-delete'))
    view.rerender(<App />)

    expect(screen.getByTestId('campaign-run-count')).toHaveTextContent('0')
    expect(screen.getByTestId('playthrough-count')).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'continue-legacy' })).toBeInTheDocument()
    expect(mockToastSuccess).toHaveBeenCalledWith('Campaign run deleted')
    expect(mockToastError).not.toHaveBeenCalled()
  })
})
