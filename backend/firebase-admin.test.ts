import { generateKeyPairSync } from 'node:crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  applicationDefault: vi.fn(() => ({ kind: 'adc' })),
  cert: vi.fn((config: unknown) => ({ kind: 'cert', config })),
  getApps: vi.fn((): unknown[] => []),
  initializeApp: vi.fn(),
}))

vi.mock('firebase-admin/app', () => mocks)

import { ensureFirebaseAdminApp, getBackendConfig } from './firebase-admin'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 })
const validPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
const validKey = validPem.trim().replace(/\n/g, '\\n')

describe('Firebase Admin identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('FIREBASE_PROJECT_ID', 'arkham-horror-tracker')
    vi.stubEnv(
      'FIREBASE_CLIENT_EMAIL',
      'vercel-community-stats@arkham-horror-tracker.iam.gserviceaccount.com',
    )
    vi.stubEnv('FIREBASE_PRIVATE_KEY', validKey)
  })

  it('initializes Vercel with an explicit project and certificate credential', () => {
    ensureFirebaseAdminApp()

    expect(mocks.cert).toHaveBeenCalledWith({
      projectId: 'arkham-horror-tracker',
      clientEmail:
        'vercel-community-stats@arkham-horror-tracker.iam.gserviceaccount.com',
      privateKey: validPem,
    })
    expect(mocks.initializeApp).toHaveBeenCalledWith({
      credential: expect.objectContaining({ kind: 'cert' }),
      projectId: 'arkham-horror-tracker',
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

  it('rejects malformed or cross-project service-account configuration', () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', 'INVALID_PROJECT')
    expect(() => getBackendConfig()).toThrow(
      'FIREBASE_PROJECT_ID is not a valid Google Cloud project ID.',
    )

    vi.stubEnv('FIREBASE_PROJECT_ID', 'arkham-horror-tracker')
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

  it('retains ADC with explicit project targeting outside Vercel', () => {
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('COMMUNITY_STATS_FIREBASE_PROJECT_ID', 'arkham-horror-tracker')

    ensureFirebaseAdminApp()

    expect(mocks.applicationDefault).toHaveBeenCalled()
    expect(mocks.cert).not.toHaveBeenCalled()
    expect(mocks.initializeApp).toHaveBeenCalledWith({
      credential: expect.objectContaining({ kind: 'adc' }),
      projectId: 'arkham-horror-tracker',
    })
  })
})
