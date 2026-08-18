import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as firestoreClient from 'firebase/firestore'

import type { CampaignRun, Playthrough } from './types'

const store = new Map<string, Record<string, unknown>>()
const DELETE_FIELD = Symbol('deleteField')

function clone<T>(value: T): T {
  return structuredClone(value)
}

function docPath(...segments: string[]): string {
  return segments.join('/')
}

function outboxPaths(): string[] {
  return Array.from(store.keys()).filter((path) => path.includes('/communityStatsOutbox/'))
}

function makePlaythrough(id: string, overrides: Partial<Playthrough> = {}): Playthrough {
  return {
    id,
    date: '2026-08-17',
    campaignName: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    investigators: [
      {
        playerName: 'Alice',
        investigatorName: 'Roland Banks',
        archetype: 'Guardian',
      },
    ],
    ...overrides,
  }
}

function makeCampaignRun(id: string, overrides: Partial<CampaignRun> = {}): CampaignRun {
  return {
    id,
    version: 2,
    campaignLineageId: 'campaign:path-to-carcosa',
    campaignName: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    startedAt: '2026-08-17',
    updatedAt: '2026-08-18T00:00:00.000Z',
    status: 'active',
    sourcePlaythroughId: 'source-1',
    setupSnapshot: {
      date: '2026-08-17',
      investigators: makePlaythrough('seed').investigators,
    },
    scenarioLogs: [],
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
    getDocs: vi.fn(),
    onSnapshot: vi.fn(),
    orderBy: vi.fn(),
    query: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    where: vi.fn(),
    runTransaction: vi.fn(async (_db: unknown, callback: (transaction: {
      get: (ref: { path: string; id: string }) => Promise<{ exists: () => boolean; id: string; data: () => Record<string, unknown> }>
      set: (ref: { path: string }, data: Record<string, unknown>) => void
      update: (ref: { path: string }, data: Record<string, unknown>) => void
      delete: (ref: { path: string }) => void
    }) => Promise<unknown>) => {
      const pending: Array<() => void> = []
      let hasWritten = false
      const transaction = {
        get: async (ref: { path: string; id: string }) => {
          if (hasWritten) {
            throw new Error('Firestore transactions require all reads to happen before writes.')
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

      const result = await callback(transaction)
      for (const operation of pending) operation()
      return result
    }),
  }
})

import { importNormalizedData } from './firestore'

const mockRunTransaction = vi.mocked(firestoreClient.runTransaction)

describe('importNormalizedData', () => {
  beforeEach(() => {
    store.clear()
    mockRunTransaction.mockClear()
  })

  it('rejects id collisions instead of overwriting existing playthroughs or campaign runs', async () => {
    store.set(docPath('users', 'u1', 'playthroughs', 'existing-playthrough'), clone(makePlaythrough('existing-playthrough')) as Record<string, unknown>)
    store.set(docPath('users', 'u1', 'campaignRuns', 'existing-run'), clone(makeCampaignRun('existing-run')) as Record<string, unknown>)

    await expect(importNormalizedData('u1', {
      version: 2,
      playthroughs: [makePlaythrough('existing-playthrough')],
      campaignRuns: [makeCampaignRun('existing-run')],
    })).rejects.toThrow(/would overwrite existing data/i)

    expect(store.get(docPath('users', 'u1', 'playthroughs', 'existing-playthrough'))).toMatchObject({
      campaignName: 'The Path to Carcosa',
    })
    expect(store.get(docPath('users', 'u1', 'campaignRuns', 'existing-run'))).toMatchObject({
      campaignLineageId: 'campaign:path-to-carcosa',
    })
  })

  it('aborts the whole import when validation fails after preflight reads', async () => {
    await expect(importNormalizedData('u1', {
      version: 1,
      playthroughs: [
        makePlaythrough('valid-playthrough'),
        makePlaythrough('invalid-playthrough', { campaignName: '   ' }),
      ],
      campaignRuns: [],
    })).rejects.toThrow(/campaignName must be a non-empty string/i)

    expect(store.size).toBe(0)
  })

  it('imports playthroughs and campaign runs atomically when preflight succeeds', async () => {
    const result = await importNormalizedData('u1', {
      version: 2,
      playthroughs: [makePlaythrough('playthrough-1')],
      campaignRuns: [makeCampaignRun('run-1')],
    })

    expect(result).toEqual({
      importedPlaythroughs: 1,
      importedCampaignRuns: 1,
    })
    expect(store.get(docPath('users', 'u1', 'playthroughs', 'playthrough-1'))).toMatchObject({
      campaignName: 'The Path to Carcosa',
    })
    expect(store.get(docPath('users', 'u1', 'campaignRuns', 'run-1'))).toMatchObject({
      campaignLineageId: 'campaign:path-to-carcosa',
      updatedAt: '2026-08-18T00:00:00.000Z',
    })
  })

  it('accepts 499 source records because the transaction reserves the 500th write for the outbox signal', async () => {
    const playthroughs = Array.from({ length: 498 }, (_, index) => makePlaythrough(`playthrough-${index}`))

    const result = await importNormalizedData('u1', {
      version: 2,
      playthroughs,
      campaignRuns: [makeCampaignRun('run-499')],
    })

    expect(result).toEqual({
      importedPlaythroughs: 498,
      importedCampaignRuns: 1,
    })
    expect(store.size).toBe(500)
    expect(outboxPaths()).toHaveLength(1)
  })

  it('rejects 500 source records before opening a Firestore transaction', async () => {
    const playthroughs = Array.from({ length: 500 }, (_, index) => makePlaythrough(`playthrough-${index}`))

    await expect(importNormalizedData('u1', {
      version: 1,
      playthroughs,
      campaignRuns: [],
    })).rejects.toThrow(/only 499 source records fit in one atomic import/i)

    expect(mockRunTransaction).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })

  it('rejects malformed investigator payloads before opening a Firestore transaction', async () => {
    await expect(importNormalizedData('u1', {
      version: 1,
      playthroughs: [{
        ...makePlaythrough('invalid-investigator'),
        investigators: [{}],
      } as unknown as Playthrough],
      campaignRuns: [],
    })).rejects.toThrow(/valid investigator assignment/i)

    expect(mockRunTransaction).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })

  it('rejects invalid document ids before any transaction reads or writes', async () => {
    await expect(importNormalizedData('u1', {
      version: 1,
      playthroughs: [makePlaythrough('bad/id')],
      campaignRuns: [],
    })).rejects.toThrow(/must not contain/i)

    expect(mockRunTransaction).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })

  it('rejects unknown playthrough properties before opening a Firestore transaction', async () => {
    await expect(importNormalizedData('u1', {
      version: 1,
      playthroughs: [{
        ...makePlaythrough('extra-prop'),
        ignored: 'value',
      } as unknown as Playthrough],
      campaignRuns: [],
    })).rejects.toThrow(/unknown propert/i)

    expect(mockRunTransaction).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })

  it('rejects nested arrays before opening a Firestore transaction', async () => {
    await expect(importNormalizedData('u1', {
      version: 1,
      playthroughs: [{
        ...makePlaythrough('nested-arrays'),
        sideStories: ['Curse of the Rougarou', ['Nested']] as unknown as string[],
      } as unknown as Playthrough],
      campaignRuns: [],
    })).rejects.toThrow(/nested array/i)

    expect(mockRunTransaction).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })

  it('rejects excessively deep payload branches before opening a Firestore transaction', async () => {
    const metadata: Record<string, unknown> = {}
    let cursor: Record<string, unknown> = metadata
    for (let depth = 0; depth < 20; depth++) {
      cursor.child = {}
      cursor = cursor.child as Record<string, unknown>
    }

    await expect(importNormalizedData('u1', {
      version: 1,
      playthroughs: [{
        ...makePlaythrough('too-deep'),
        metadata,
      } as unknown as Playthrough],
      campaignRuns: [],
    })).rejects.toThrow(/maximum supported nesting depth/i)

    expect(mockRunTransaction).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })

  it('rejects oversized records before opening a Firestore transaction', async () => {
    await expect(importNormalizedData('u1', {
      version: 1,
      playthroughs: [{
        ...makePlaythrough('oversized'),
        notes: 'x'.repeat(950_000),
      }],
      campaignRuns: [],
    })).rejects.toThrow(/maximum supported string size|document size safety limit/i)

    expect(mockRunTransaction).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })
})
