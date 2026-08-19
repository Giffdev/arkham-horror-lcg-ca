import { generateKeyPairSync } from 'node:crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  Firestore: vi.fn(),
  GoogleAuth: vi.fn(),
}))

vi.mock('@google-cloud/firestore', () => ({
  Firestore: mocks.Firestore,
}))

vi.mock('google-auth-library', () => ({
  GoogleAuth: mocks.GoogleAuth,
}))

import {
  FIREBASE_PROJECT_ID,
  getBackendConfig,
  getBackendFirestore,
  getBackendGoogleAuth,
  resetBackendClientsForTest,
} from './google-cloud'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 })
const validPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
const validKey = validPem.trim().replace(/\n/g, '\\n')

describe('Google Cloud backend identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetBackendClientsForTest()
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('FIREBASE_PROJECT_ID', FIREBASE_PROJECT_ID)
    vi.stubEnv(
      'FIREBASE_CLIENT_EMAIL',
      'vercel-community-stats@arkham-horror-tracker.iam.gserviceaccount.com',
    )
    vi.stubEnv('FIREBASE_PRIVATE_KEY', validKey)
  })

  it('constructs Firestore and Google Auth with the explicit production identity', () => {
    getBackendFirestore()
    getBackendGoogleAuth()

    const identity = {
      client_email:
        'vercel-community-stats@arkham-horror-tracker.iam.gserviceaccount.com',
      private_key: validPem,
    }
    expect(mocks.Firestore).toHaveBeenCalledWith({
      projectId: FIREBASE_PROJECT_ID,
      credentials: identity,
    })
    expect(mocks.GoogleAuth).toHaveBeenCalledWith({
      projectId: FIREBASE_PROJECT_ID,
      credentials: identity,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
  })

  it.each(['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'])(
    'rejects a missing %s without exposing another credential',
    (name) => {
      vi.stubEnv(name, '')
      vi.stubEnv('FIREBASE_PRIVATE_KEY', name === 'FIREBASE_PRIVATE_KEY' ? '' : validKey)

      expect(() => getBackendConfig()).toThrow(
        `Missing required backend environment variable: ${name}`,
      )
    },
  )

  it('rejects a non-production project or cross-project service account', () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', 'another-project')
    expect(() => getBackendConfig()).toThrow(
      `FIREBASE_PROJECT_ID must be ${FIREBASE_PROJECT_ID}.`,
    )

    vi.stubEnv('FIREBASE_PROJECT_ID', FIREBASE_PROJECT_ID)
    vi.stubEnv(
      'FIREBASE_CLIENT_EMAIL',
      'worker@another-firebase-project.iam.gserviceaccount.com',
    )
    expect(() => getBackendConfig()).toThrow(
      'FIREBASE_CLIENT_EMAIL does not belong to FIREBASE_PROJECT_ID.',
    )
  })

  it('rejects malformed PEM material without including it in the error', () => {
    vi.stubEnv('FIREBASE_PRIVATE_KEY', 'not-a-private-key')

    expect(() => getBackendConfig()).toThrow(
      'FIREBASE_PRIVATE_KEY must be a valid PKCS#8 PEM private key.',
    )
    expect(() => getBackendConfig()).not.toThrow('not-a-private-key')
  })

  it('normalizes escaped Windows newlines in the private key', () => {
    vi.stubEnv('FIREBASE_PRIVATE_KEY', validPem.trim().replace(/\n/g, '\\r\\n'))

    expect(getBackendConfig().privateKey).toBe(validPem)
  })

  it('uses ADC with explicit project targeting outside Vercel', () => {
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('COMMUNITY_STATS_FIREBASE_PROJECT_ID', FIREBASE_PROJECT_ID)

    getBackendFirestore()
    getBackendGoogleAuth()

    expect(mocks.Firestore).toHaveBeenCalledWith({ projectId: FIREBASE_PROJECT_ID })
    expect(mocks.GoogleAuth).toHaveBeenCalledWith({
      projectId: FIREBASE_PROJECT_ID,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
  })
})
