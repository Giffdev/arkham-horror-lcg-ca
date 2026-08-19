// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
}))

vi.mock('./google-cloud', () => ({
  FIREBASE_PROJECT_ID: 'arkham-horror-tracker',
  getBackendProjectId: () => 'arkham-horror-tracker',
  getBackendGoogleAuth: () => ({
    request: mocks.request,
  }),
}))

import {
  listFirebaseAuthUserIds,
  verifyFirebaseUserStatus,
} from './firebase-identity'

describe('Firebase Identity Toolkit integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checks disabled and revoked state with a fixed project lookup', async () => {
    mocks.request.mockResolvedValue({
      data: {
        users: [{
          localId: 'owner-1',
          disabled: false,
          validSince: '100',
        }],
      },
    })

    await expect(verifyFirebaseUserStatus('owner-1', 100)).resolves.toBeUndefined()
    expect(mocks.request).toHaveBeenCalledWith({
      url: 'https://identitytoolkit.googleapis.com/v1/accounts:lookup',
      method: 'POST',
      data: {
        localId: ['owner-1'],
        targetProjectId: 'arkham-horror-tracker',
      },
      timeout: 5_000,
    })
  })

  it.each([
    [{ localId: 'owner-1', disabled: true, validSince: '0' }, 100],
    [{ localId: 'owner-1', disabled: false, validSince: '101' }, 100],
  ])('rejects disabled or revoked Firebase users', async (user, authTime) => {
    mocks.request.mockResolvedValue({ data: { users: [user] } })

    await expect(verifyFirebaseUserStatus('owner-1', authTime))
      .rejects.toBeInstanceOf(Error)
  })

  it('rejects a token whose subject no longer maps to a Firebase user', async () => {
    mocks.request.mockResolvedValue({ data: { users: [] } })

    await expect(verifyFirebaseUserStatus('owner-1', 100))
      .rejects.toThrow('Firebase user does not exist.')
  })

  it('paginates Auth users through the project-scoped batch endpoint', async () => {
    mocks.request
      .mockResolvedValueOnce({
        data: {
          users: [{ localId: 'owner-1' }],
          nextPageToken: 'page-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          users: [{ localId: 'owner-2' }],
        },
      })

    await expect(listFirebaseAuthUserIds()).resolves.toEqual(['owner-1', 'owner-2'])
    expect(mocks.request).toHaveBeenNthCalledWith(2, {
      url:
        'https://identitytoolkit.googleapis.com/v1/projects/' +
        'arkham-horror-tracker/accounts:batchGet',
      method: 'GET',
      params: {
        maxResults: 1_000,
        nextPageToken: 'page-2',
      },
      timeout: 5_000,
    })
  })
})
