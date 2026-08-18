import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CampaignRun, Playthrough } from './types'

const firestoreMocks = vi.hoisted(() => ({
  collectionGroup: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
}))

function makePlaythrough(id: string, overrides: Partial<Playthrough> = {}): Playthrough {
  return {
    id,
    date: '2026-08-17',
    campaignName: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
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

function makeCampaignRun(id: string, overrides: Partial<CampaignRun> = {}): CampaignRun {
  return {
    id,
    version: 1,
    campaignLineageId: 'campaign:path-to-carcosa',
    campaignName: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    startedAt: '2026-08-17T00:00:00.000Z',
    updatedAt: '2026-08-17T00:00:00.000Z',
    status: 'active',
    sourcePlaythroughId: 'source-1',
    setupSnapshot: {
      date: '2026-08-17',
      investigators: [
        {
          playerName: 'Devin',
          investigatorName: 'Mark Harrigan',
          archetype: 'Guardian',
        },
      ],
    },
    scenarioLogs: [
      {
        id: 'scenario-1',
        date: '2026-08-18',
        scenarioName: 'Curtain Call',
        investigators: [
          {
            playerName: 'Devin',
            investigatorName: 'Mark Harrigan',
            archetype: 'Guardian',
          },
        ],
      },
    ],
    ...overrides,
  }
}

vi.mock('./firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  collectionGroup: firestoreMocks.collectionGroup,
  deleteDoc: vi.fn(),
  deleteField: vi.fn(() => Symbol('deleteField')),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join('/'),
    id: segments[segments.length - 1],
  })),
  getDoc: firestoreMocks.getDoc,
  getDocs: firestoreMocks.getDocs,
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
}))

import { getAllPlaythroughs } from './firestore'

describe('getAllPlaythroughs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    firestoreMocks.collectionGroup.mockImplementation((_db: unknown, collectionId: string) => ({ collectionId }))
    firestoreMocks.getDocs.mockImplementation(async ({ collectionId }: { collectionId: string }) => {
      if (collectionId === 'playthroughs') {
        return {
          docs: [
            {
              id: 'source-1',
              ref: { path: 'users/u1/playthroughs/source-1' },
              data: () => makePlaythrough('source-1', { promotedToCampaignRunId: 'run-1' }),
            },
            {
              id: 'standalone-2',
              ref: { path: 'users/u2/playthroughs/standalone-2' },
              data: () => makePlaythrough('standalone-2', {
                campaignName: 'The Dunwich Legacy',
                investigators: [
                  {
                    playerName: 'Jenny',
                    investigatorName: 'Jenny Barnes',
                    archetype: 'Rogue',
                  },
                ],
              }),
            },
          ],
        }
      }

      if (collectionId === 'campaignRuns') {
        return {
          docs: [
            {
              id: 'run-1',
              ref: { path: 'users/u1/campaignRuns/run-1' },
              data: () => makeCampaignRun('run-1'),
            },
          ],
        }
      }

      throw new Error(`Unexpected collectionGroup: ${collectionId}`)
    })
    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ registeredUsers: 5 }),
    })
  })

  it('queries both collection groups and flattens campaign runs into community game logs', async () => {
    const result = await getAllPlaythroughs()

    expect(firestoreMocks.collectionGroup).toHaveBeenCalledWith({}, 'playthroughs')
    expect(firestoreMocks.collectionGroup).toHaveBeenCalledWith({}, 'campaignRuns')
    expect(result.userCount).toBe(5)
    expect(result.playthroughs).toHaveLength(2)
    expect(result.playthroughs.map((entry) => entry.id)).toEqual([
      'campaign-run:run-1:scenario:scenario-1',
      'standalone-2',
    ])
    expect(result.playthroughs[0]).toMatchObject({
      campaignRunId: 'run-1',
      scenarioName: 'Curtain Call',
      sourceKind: 'campaign-run-scenario',
    })
  })
})
