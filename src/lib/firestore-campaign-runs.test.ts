import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Playthrough } from './types'

const store = new Map<string, Record<string, unknown>>()
const DELETE_FIELD = Symbol('deleteField')

function clone<T>(value: T): T {
  return structuredClone(value)
}

function docPath(...segments: string[]): string {
  return segments.join('/')
}

function makePlaythrough(id: string, overrides: Partial<Playthrough> = {}): Playthrough {
  return {
    id,
    date: '2026-08-17',
    campaignName: 'The Path to Carcosa',
    campaignSet: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    campaignLineageId: 'campaign:path-to-carcosa',
    scenarioName: 'Curtain Call',
    investigators: [
      {
        playerName: 'Devin',
        investigatorName: 'Mark Harrigan',
        archetype: 'Guardian',
      },
    ],
    ...overrides,
  }
}

vi.mock('./firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => {
  const applyUpdate = (path: string, patch: Record<string, unknown>) => {
    const existing = clone(store.get(path) ?? {})
    for (const [key, value] of Object.entries(patch)) {
      if (value === DELETE_FIELD) {
        delete existing[key]
      } else {
        existing[key] = value
      }
    }
    store.set(path, existing)
  }

  return {
    addDoc: vi.fn(),
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({
      path: docPath(...segments),
    })),
    collectionGroup: vi.fn(),
    deleteDoc: vi.fn(),
    deleteField: vi.fn(() => DELETE_FIELD),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({
      path: docPath(...segments),
      id: segments[segments.length - 1],
    })),
    getDoc: vi.fn(),
    getDocs: vi.fn(async (queryRef: {
      path: string
      constraint?: { field: string; value: unknown }
    }) => {
      const prefix = `${queryRef.path}/`
      const docs = Array.from(store.entries())
        .filter(([path, value]) => (
          path.startsWith(prefix) &&
          !path.slice(prefix.length).includes('/') &&
          (!queryRef.constraint || value[queryRef.constraint.field] === queryRef.constraint.value)
        ))
        .map(([path, value]) => ({
          id: path.slice(prefix.length),
          data: () => clone(value),
        }))
      return { docs }
    }),
    onSnapshot: vi.fn(),
    orderBy: vi.fn(),
    query: vi.fn((collectionRef: { path: string }, constraint?: { field: string; value: unknown }) => ({
      ...collectionRef,
      constraint,
    })),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    where: vi.fn((field: string, _operator: string, value: unknown) => ({ field, value })),
    runTransaction: vi.fn(async (_db: unknown, callback: (tx: {
      get: (ref: { path: string; id: string }) => Promise<{ exists: () => boolean; id: string; data: () => Record<string, unknown> }>
      set: (ref: { path: string }, data: Record<string, unknown>) => void
      update: (ref: { path: string }, data: Record<string, unknown>) => void
      delete: (ref: { path: string }) => void
    }) => Promise<unknown>) => {
      const pending: Array<() => void> = []
      let hasWritten = false
      const tx = {
        get: async (ref: { path: string; id: string }) => {
          if (hasWritten) {
            throw new Error('Firestore transactions require all reads to be executed before all writes.')
          }
          const value = store.get(ref.path)
          return {
            exists: () => value !== undefined,
            id: ref.id,
            data: () => clone(value ?? {}),
          }
        },
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          hasWritten = true
          pending.push(() => store.set(ref.path, clone(data)))
        },
        update: (ref: { path: string }, data: Record<string, unknown>) => {
          hasWritten = true
          pending.push(() => applyUpdate(ref.path, data))
        },
        delete: (ref: { path: string }) => {
          hasWritten = true
          pending.push(() => store.delete(ref.path))
        },
      }
      const result = await callback(tx)
      for (const operation of pending) operation()
      return result
    }),
  }
})

import {
  deleteCampaignRunWithRestoration,
  promotePlaythroughToCampaignRun,
  unpromoteCampaignRun,
} from './firestore'

describe('firestore campaign-run transactions', () => {
  beforeEach(() => {
    store.clear()
  })

  it('promotes a selected source playthrough deterministically and suppresses the source record', async () => {
    const source = makePlaythrough('source-1')
    store.set(docPath('users', 'u1', 'playthroughs', source.id), clone(source) as Record<string, unknown>)

    const result = await promotePlaythroughToCampaignRun('u1', source.id)

    expect(result).toEqual({ campaignRunId: 'source-1', status: 'created' })
    const run = store.get(docPath('users', 'u1', 'campaignRuns', 'source-1')) as Record<string, unknown>
    const updatedSource = store.get(docPath('users', 'u1', 'playthroughs', 'source-1')) as Record<string, unknown>
    expect(run.sourcePlaythroughId).toBe('source-1')
    expect(run.startedAt).toMatch(/^2026-08-17T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(Array.isArray(run.scenarioLogs)).toBe(true)
    expect(updatedSource.promotedToCampaignRunId).toBe('source-1')
  })

  it('is idempotent when promotion is retried for an already-promoted source', async () => {
    const source = makePlaythrough('source-2')
    store.set(docPath('users', 'u1', 'playthroughs', source.id), clone(source) as Record<string, unknown>)

    await promotePlaythroughToCampaignRun('u1', source.id)
    const second = await promotePlaythroughToCampaignRun('u1', source.id)

    expect(second).toEqual({ campaignRunId: 'source-2', status: 'already-promoted' })
    const run = store.get(docPath('users', 'u1', 'campaignRuns', 'source-2')) as Record<string, unknown>
    expect((run.scenarioLogs as unknown[]).length).toBe(1)
  })

  it('promotes fan-made campaign records into nested runs', async () => {
    const source = makePlaythrough('fan-source', {
      campaignName: 'The Custom Mystery',
      campaignSet: undefined,
      campaignType: 'Fan-Made',
      customCampaignName: 'The Custom Mystery',
      scenarioName: undefined,
    })
    store.set(docPath('users', 'u1', 'playthroughs', source.id), clone(source) as Record<string, unknown>)

    await expect(promotePlaythroughToCampaignRun('u1', source.id)).resolves.toEqual({
      campaignRunId: source.id,
      status: 'created',
    })
    expect(store.get(docPath('users', 'u1', 'campaignRuns', source.id))).toMatchObject({
      campaignType: 'Fan-Made',
      customCampaignName: 'The Custom Mystery',
    })
  })

  it('recovers interrupted promotions when source is marked promoted but parent run is missing', async () => {
    const source = makePlaythrough('source-3', { promotedToCampaignRunId: 'source-3' })
    store.set(docPath('users', 'u1', 'playthroughs', source.id), clone(source) as Record<string, unknown>)

    const result = await promotePlaythroughToCampaignRun('u1', source.id)

    expect(result).toEqual({ campaignRunId: 'source-3', status: 'recovered' })
    expect(store.has(docPath('users', 'u1', 'campaignRuns', 'source-3'))).toBe(true)
  })

  it('unpromotes by deleting the run and restoring the source record visibility', async () => {
    const source = makePlaythrough('source-4')
    store.set(docPath('users', 'u1', 'playthroughs', source.id), clone(source) as Record<string, unknown>)
    await promotePlaythroughToCampaignRun('u1', source.id)

    const result = await unpromoteCampaignRun('u1', source.id)

    expect(result).toBe('restored')
    expect(store.has(docPath('users', 'u1', 'campaignRuns', source.id))).toBe(false)
    const restoredSource = store.get(docPath('users', 'u1', 'playthroughs', source.id)) as Record<string, unknown>
    expect(restoredSource.promotedToCampaignRunId).toBeUndefined()
  })

  it('deletes a legacy promoted run after restoring its same-id source record', async () => {
    const source = makePlaythrough('legacy-source', {
      promotedToCampaignRunId: 'legacy-source',
    })
    store.set(docPath('users', 'u1', 'playthroughs', source.id), clone(source) as Record<string, unknown>)
    store.set(docPath('users', 'u1', 'campaignRuns', source.id), {
      campaignName: source.campaignName,
      campaignSet: source.campaignSet,
      campaignType: source.campaignType,
      scenarioLogs: [],
    })

    await deleteCampaignRunWithRestoration('u1', source.id)

    expect(store.has(docPath('users', 'u1', 'campaignRuns', source.id))).toBe(false)
    const restoredSource = store.get(docPath('users', 'u1', 'playthroughs', source.id)) as Record<string, unknown>
    expect(restoredSource.promotedToCampaignRunId).toBeUndefined()
  })

  it('restores a marked source when the promoted run is already absent', async () => {
    const source = makePlaythrough('custom-source', {
      promotedToCampaignRunId: 'missing-custom-run',
    })
    store.set(docPath('users', 'u1', 'playthroughs', source.id), clone(source) as Record<string, unknown>)

    const result = await unpromoteCampaignRun('u1', 'missing-custom-run')

    expect(result).toBe('restored')
    expect((store.get(docPath('users', 'u1', 'playthroughs', source.id)) as Record<string, unknown>)
      .promotedToCampaignRunId).toBeUndefined()
  })

  it('is idempotent when both the run and promoted source are absent', async () => {
    await expect(unpromoteCampaignRun('u1', 'already-gone')).resolves.toBe('noop')
    await expect(deleteCampaignRunWithRestoration('u1', 'already-gone')).resolves.toBeUndefined()
  })

  it('falls back to the deterministic source id for blank legacy source references', async () => {
    const source = makePlaythrough('blank-source', {
      promotedToCampaignRunId: 'blank-source',
    })
    store.set(docPath('users', 'u1', 'playthroughs', source.id), clone(source) as Record<string, unknown>)
    store.set(docPath('users', 'u1', 'campaignRuns', source.id), {
      campaignName: source.campaignName,
      campaignType: source.campaignType,
      sourcePlaythroughId: '   ',
      scenarioLogs: [],
    })

    await expect(unpromoteCampaignRun('u1', source.id)).resolves.toBe('restored')
    expect(store.has(docPath('users', 'u1', 'campaignRuns', source.id))).toBe(false)
  })
})
