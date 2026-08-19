import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CampaignRun } from '@/lib/types'

let emitRuns: ((runs: CampaignRun[]) => void) | undefined
let emitError: ((error: Error) => void) | undefined

vi.mock('@/lib/firestore', () => ({
  subscribeToCampaignRuns: vi.fn((
    _uid: string,
    onRuns: (runs: CampaignRun[]) => void,
    onError: (error: Error) => void,
  ) => {
    emitRuns = onRuns
    emitError = onError
    return vi.fn()
  }),
  addCampaignRun: vi.fn(),
  appendCampaignScenarioLog: vi.fn(),
  deleteCampaignRunWithRestoration: vi.fn(),
  deleteCampaignScenarioLog: vi.fn(),
  editCampaignRun: vi.fn(),
  editCampaignScenarioLog: vi.fn(),
  upsertCampaignRun: vi.fn(),
}))

import { useCampaignRuns } from './useCampaignRuns'

describe('useCampaignRuns subscription recovery', () => {
  beforeEach(() => {
    emitRuns = undefined
    emitError = undefined
  })

  it('clears a transient listener error when the post-delete snapshot succeeds', () => {
    const { result } = renderHook(() => useCampaignRuns('user-1'))

    act(() => emitError?.(new Error('temporary listener failure')))
    expect(result.current[0]).toEqual([])
    expect(result.current[3]?.message).toBe('temporary listener failure')

    act(() => emitRuns?.([]))
    expect(result.current[0]).toEqual([])
    expect(result.current[2]).toBe(false)
    expect(result.current[3]).toBeNull()
  })
})
