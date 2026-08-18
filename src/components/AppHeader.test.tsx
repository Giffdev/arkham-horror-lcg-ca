import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppHeader } from './AppHeader'
import type { CampaignRun, Playthrough } from '@/lib/types'
import type { NormalizedImportPayload } from '@/lib/import-export'

const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

vi.mock('@/lib/campaign-icon-map', () => ({
  getBrandSvgRaw: () => '<svg viewBox="0 0 24 24"></svg>',
}))

function makePlaythrough(id: string): Playthrough {
  return {
    id,
    date: '2026-08-17',
    campaignName: 'The Night of the Zealot',
    campaignType: 'Small Campaign',
    investigators: [
      {
        playerName: 'Alice',
        investigatorName: 'Roland Banks',
        archetype: 'Guardian',
      },
    ],
  }
}

function makeRun(id: string): CampaignRun {
  return {
    id,
    version: 1,
    campaignLineageId: 'campaign:night-of-the-zealot',
    campaignName: 'The Night of the Zealot',
    campaignType: 'Small Campaign',
    startedAt: '2026-08-17',
    updatedAt: '2026-08-17T00:00:00.000Z',
    status: 'active',
    setupSnapshot: {
      date: '2026-08-17',
      investigators: makePlaythrough('seed').investigators,
    },
    scenarioLogs: [],
  }
}

function renderHeader(options?: {
  playthroughs?: Playthrough[]
  campaignRuns?: CampaignRun[]
  onImportData?: (payload: NormalizedImportPayload) => Promise<void> | void
}) {
  const onImportData = options?.onImportData ?? vi.fn().mockResolvedValue(undefined)
  render(
    <AppHeader
      currentUser={{
        id: 'user-1',
        email: 'user@example.com',
        createdAt: 1,
        authProvider: 'email',
      }}
      onNewGame={vi.fn()}
      onSignOut={vi.fn()}
      isGoogleUser={false}
      hasPasswordLinked={true}
      onOpenPasswordLink={vi.fn()}
      playthroughs={options?.playthroughs ?? [makePlaythrough('p1')]}
      campaignRuns={options?.campaignRuns ?? [makeRun('run-1')]}
      onImportData={onImportData}
    />,
  )

  return { onImportData }
}

describe('AppHeader data actions', () => {
  beforeEach(() => {
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('removes standalone data buttons and keeps export reachable from the profile menu', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:1')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderHeader()

    expect(screen.queryByRole('button', { name: /^Export Data$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Import Data$/i })).not.toBeInTheDocument()

    const profileButton = screen.getByRole('button', { name: /user@example\.com/i })
    profileButton.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('menuitem', { name: /^Export Data$/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /^Import Data$/i })).toBeInTheDocument()

    await user.keyboard('{Enter}')

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalled()
  })

  it('keeps import reachable from the profile menu and restores focus after closing the dialog', async () => {
    const user = userEvent.setup()
    const onImportData = vi.fn().mockResolvedValue(undefined)

    renderHeader({ onImportData })

    const profileButton = screen.getByRole('button', { name: /user@example\.com/i })
    profileButton.focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{ArrowDown}{Enter}')

    const textarea = await screen.findByPlaceholderText('{"version":2,"playthroughs":[...],"campaignRuns":[...]}')
    await user.click(textarea)
    await user.paste(JSON.stringify([makePlaythrough('legacy-1')]))
    await user.click(screen.getByRole('button', { name: /^Import$/i }))

    await waitFor(() => expect(onImportData).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(profileButton).toHaveFocus())
  })
})
