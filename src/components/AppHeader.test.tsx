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
  showImport?: boolean
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
      showImport={options?.showImport}
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

  it('hides import and keeps export reachable from the profile menu by keyboard', async () => {
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
    expect(screen.queryByRole('menuitem', { name: /^Import Data$/i })).not.toBeInTheDocument()

    await user.keyboard('{Enter}')

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(JSON.parse(await blob.text())).toMatchObject({
      version: 2,
      playthroughs: [{ id: 'p1' }],
      campaignRuns: [{ id: 'run-1' }],
    })
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalled()
  })

  it('skips import during keyboard navigation and never mounts import controls', async () => {
    const user = userEvent.setup()
    const onImportData = vi.fn().mockResolvedValue(undefined)

    renderHeader({ onImportData })

    const profileButton = screen.getByRole('button', { name: /user@example\.com/i })
    profileButton.focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{ArrowDown}')

    expect(screen.getByRole('menuitem', { name: /^Sign Out$/i })).toHaveFocus()
    expect(screen.queryByText(/^Import Data$/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument()
    expect(document.querySelector('input[type="file"], textarea')).not.toBeInTheDocument()
    expect(onImportData).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(profileButton).toHaveFocus())
  })

  it('retains import behavior and focus restoration when explicitly enabled', async () => {
    const user = userEvent.setup()
    const onImportData = vi.fn().mockResolvedValue(undefined)

    renderHeader({ onImportData, showImport: true })

    const profileButton = screen.getByRole('button', { name: /user@example\.com/i })
    profileButton.focus()
    await user.keyboard('{Enter}{ArrowDown}{Enter}')

    const textarea = await screen.findByPlaceholderText('{"version":2,"playthroughs":[...],"campaignRuns":[...]}')
    await user.click(textarea)
    await user.paste(JSON.stringify([makePlaythrough('legacy-1')]))
    await user.click(screen.getByRole('button', { name: /^Import$/i }))

    await waitFor(() => expect(onImportData).toHaveBeenCalledTimes(1))
    expect(onImportData).toHaveBeenCalledWith(expect.objectContaining({
      version: 1,
      playthroughs: [expect.objectContaining({ id: 'legacy-1' })],
    }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(profileButton).toHaveFocus())
  })
})
