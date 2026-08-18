import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DataExportImport } from './DataExportImport'
import type { CampaignRun, Playthrough } from '@/lib/types'

const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
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
    sourcePlaythroughId: 'seed',
    setupSnapshot: {
      date: '2026-08-17',
      investigators: makePlaythrough('seed').investigators,
    },
    scenarioLogs: [
      {
        id: 's1',
        date: '2026-08-17',
        scenarioName: 'The Gathering',
        investigators: makePlaythrough('seed').investigators,
      },
    ],
  }
}

describe('DataExportImport', () => {
  beforeEach(() => {
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it('exports a v2 envelope that includes campaign runs', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((_blob) => 'blob:1')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const appendChild = vi.spyOn(document.body, 'appendChild')
    const removeChild = vi.spyOn(document.body, 'removeChild')
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(
      <DataExportImport
        playthroughs={[makePlaythrough('p1')]}
        campaignRuns={[makeRun('run-1')]}
        onImport={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Export Data/i }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    const exported = JSON.parse(await blob.text()) as { version: number; playthroughs: unknown[]; campaignRuns: unknown[] }
    expect(exported.version).toBe(2)
    expect(exported.playthroughs).toHaveLength(1)
    expect(exported.campaignRuns).toHaveLength(1)
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(appendChild).toHaveBeenCalled()
    expect(removeChild).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalled()
  })

  it('imports a legacy v1 array payload', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn().mockResolvedValue(undefined)

    render(
      <DataExportImport
        playthroughs={[makePlaythrough('p1')]}
        campaignRuns={[]}
        onImport={onImport}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Import Data/i }))
    const textarea = screen.getByPlaceholderText('{"version":2,"playthroughs":[...],"campaignRuns":[...]}')
    await user.click(textarea)
    await user.paste(JSON.stringify([makePlaythrough('legacy-1')]))
    await user.click(screen.getByRole('button', { name: /^Import$/i }))

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1))
    expect(onImport.mock.calls[0][0]).toMatchObject({
      version: 1,
      playthroughs: [{ id: 'legacy-1' }],
      campaignRuns: [],
    })
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('legacy v1 array'))
  })

  it('imports a v2 payload with campaign runs', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn().mockResolvedValue(undefined)
    const payload = {
      version: 2,
      playthroughs: [makePlaythrough('p2')],
      campaignRuns: [makeRun('run-2')],
    }

    render(
      <DataExportImport
        playthroughs={[makePlaythrough('p1')]}
        campaignRuns={[]}
        onImport={onImport}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Import Data/i }))
    const textarea = screen.getByPlaceholderText('{"version":2,"playthroughs":[...],"campaignRuns":[...]}')
    await user.click(textarea)
    await user.paste(JSON.stringify(payload))
    await user.click(screen.getByRole('button', { name: /^Import$/i }))

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1))
    expect(onImport.mock.calls[0][0]).toMatchObject({
      version: 2,
      playthroughs: [{ id: 'p2' }],
      campaignRuns: [{ id: 'run-2' }],
    })
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('v2 export envelope'))
  })

  it('surfaces atomic import rejections without closing the dialog', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn().mockRejectedValue(new Error('Import would overwrite existing data.'))

    render(
      <DataExportImport
        playthroughs={[makePlaythrough('p1')]}
        campaignRuns={[]}
        onImport={onImport}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Import Data/i }))
    const textarea = screen.getByPlaceholderText('{"version":2,"playthroughs":[...],"campaignRuns":[...]}')
    await user.click(textarea)
    await user.paste(JSON.stringify([makePlaythrough('legacy-1')]))
    await user.click(screen.getByRole('button', { name: /^Import$/i }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Import would overwrite existing data.'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
