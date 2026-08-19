// @vitest-environment node

import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
  type KeyLike,
} from 'jose'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { verifyFirebaseIdToken } from './firebase-identity'
import { FIREBASE_PROJECT_ID } from './google-cloud'

const issuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`
const now = new Date('2026-08-19T08:00:00.000Z')
const nowSeconds = Math.floor(now.getTime() / 1_000)

let signingKey: KeyLike
let otherSigningKey: KeyLike
let localJwks: ReturnType<typeof createLocalJWKSet>

async function token(options: {
  payload?: Record<string, unknown>
  header?: { alg: string; kid?: string }
  key?: KeyLike
} = {}): Promise<string> {
  const payload = {
    sub: 'owner-1',
    aud: FIREBASE_PROJECT_ID,
    iss: issuer,
    iat: nowSeconds - 60,
    auth_time: nowSeconds - 120,
    exp: nowSeconds + 3_600,
    ...options.payload,
  }
  return new SignJWT(payload)
    .setProtectedHeader(options.header ?? { alg: 'RS256', kid: 'firebase-key-1' })
    .sign(options.key ?? signingKey)
}

async function verify(value: string, checkUserStatus = vi.fn().mockResolvedValue(undefined)) {
  return verifyFirebaseIdToken(value, {
    keyResolver: localJwks,
    checkUserStatus,
    currentDate: now,
  })
}

beforeAll(async () => {
  const primary = await generateKeyPair('RS256', { modulusLength: 2048 })
  const secondary = await generateKeyPair('RS256', { modulusLength: 2048 })
  signingKey = primary.privateKey
  otherSigningKey = secondary.privateKey
  const jwk = await exportJWK(primary.publicKey)
  localJwks = createLocalJWKSet({
    keys: [{ ...jwk, alg: 'RS256', use: 'sig', kid: 'firebase-key-1' } as JWK],
  })
})

describe('Firebase ID token verification', () => {
  it('accepts a valid RS256 token from the fixed Firebase issuer and checks revocation', async () => {
    const checkUserStatus = vi.fn().mockResolvedValue(undefined)

    await expect(verify(await token(), checkUserStatus)).resolves.toEqual({ uid: 'owner-1' })
    expect(checkUserStatus).toHaveBeenCalledWith('owner-1', nowSeconds - 120)
  })

  it.each([
    ['malformed token', async () => 'not-a-jwt'],
    ['wrong issuer', async () => token({ payload: { iss: 'https://example.invalid' } })],
    ['wrong audience', async () => token({ payload: { aud: 'another-project' } })],
    ['expired token', async () => token({ payload: { exp: nowSeconds - 10 } })],
    ['not-yet-valid token', async () => token({ payload: { nbf: nowSeconds + 60 } })],
    ['missing subject', async () => token({ payload: { sub: undefined } })],
    ['unsafe subject', async () => token({ payload: { sub: 'owner\u0000admin' } })],
    ['path-breaking subject', async () => token({ payload: { sub: 'owners/admin' } })],
    ['future issued-at', async () => token({ payload: { iat: nowSeconds + 60 } })],
    ['future auth time', async () => token({ payload: { auth_time: nowSeconds + 60 } })],
  ])('rejects a %s', async (_name, makeToken) => {
    await expect(verify(await makeToken())).rejects.toBeInstanceOf(Error)
  })

  it('rejects an algorithm outside the explicit RS256 allow-list', async () => {
    const ec = await generateKeyPair('ES256')
    const value = await token({
      header: { alg: 'ES256', kid: 'firebase-key-1' },
      key: ec.privateKey,
    })

    await expect(verify(value)).rejects.toBeInstanceOf(Error)
  })

  it('rejects unknown key ids and invalid signatures', async () => {
    await expect(verify(await token({
      header: { alg: 'RS256', kid: 'unknown-key' },
    }))).rejects.toBeInstanceOf(Error)
    await expect(verify(await token({
      key: otherSigningKey,
    }))).rejects.toBeInstanceOf(Error)
  })

  it('rejects revoked or disabled users through the status check', async () => {
    const checkUserStatus = vi.fn().mockRejectedValue(new Error('revoked'))

    await expect(verify(await token(), checkUserStatus)).rejects.toThrow('revoked')
  })
})
