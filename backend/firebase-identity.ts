import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose'

import {
  FIREBASE_PROJECT_ID,
  getBackendGoogleAuth,
  getBackendProjectId,
} from './google-cloud.js'

const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`
const FIREBASE_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/' +
  'securetoken@system.gserviceaccount.com',
)
const CLOCK_TOLERANCE_SECONDS = 5
const GOOGLE_API_TIMEOUT_MS = 5_000
const MAX_AUTH_USERS = 10_000

const remoteJwks = createRemoteJWKSet(FIREBASE_JWKS_URL, {
  timeoutDuration: 5_000,
  cooldownDuration: 30_000,
  cacheMaxAge: 60 * 60 * 1_000,
})

type FirebaseUserRecord = {
  localId?: string
  disabled?: boolean
  validSince?: string
}

type FirebaseIdTokenPayload = JWTPayload & {
  auth_time: number
}

type VerifyFirebaseIdTokenOptions = {
  keyResolver?: JWTVerifyGetKey
  checkUserStatus?: (uid: string, authTime: number) => Promise<void>
  currentDate?: Date
}

function identityToolkitProjectUrl(projectId: string, operation: string): string {
  return `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:${operation}`
}

async function lookupFirebaseUser(uid: string): Promise<FirebaseUserRecord> {
  const response = await getBackendGoogleAuth().request<{ users?: FirebaseUserRecord[] }>({
    url: 'https://identitytoolkit.googleapis.com/v1/accounts:lookup',
    method: 'POST',
    data: {
      localId: [uid],
      targetProjectId: FIREBASE_PROJECT_ID,
    },
    timeout: GOOGLE_API_TIMEOUT_MS,
  })
  const user = response.data.users?.find((candidate) => candidate.localId === uid)
  if (!user) throw new Error('Firebase user does not exist.')
  return user
}

export async function verifyFirebaseUserStatus(uid: string, authTime: number): Promise<void> {
  const user = await lookupFirebaseUser(uid)
  if (user.disabled) throw new Error('Firebase user is disabled.')
  const validSince = Number(user.validSince ?? 0)
  if (!Number.isSafeInteger(validSince) || validSince < 0) {
    throw new Error('Firebase user revocation state is invalid.')
  }
  if (authTime < validSince) {
    throw new Error('Firebase ID token has been revoked.')
  }
}

function requireSafeUid(payload: FirebaseIdTokenPayload): string {
  const uid = payload.sub
  if (
    typeof uid !== 'string' ||
    uid.length === 0 ||
    uid.length > 128 ||
    uid.trim() !== uid ||
    /[\u0000-\u001f\u007f/]/.test(uid)
  ) {
    throw new Error('Firebase ID token subject is invalid.')
  }
  return uid
}

function requirePastTimestamp(
  value: unknown,
  claim: 'iat' | 'auth_time',
  nowSeconds: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > nowSeconds + CLOCK_TOLERANCE_SECONDS
  ) {
    throw new Error(`Firebase ID token ${claim} claim is invalid.`)
  }
  return value
}

export async function verifyFirebaseIdToken(
  token: string,
  options: VerifyFirebaseIdTokenOptions = {},
): Promise<{ uid: string }> {
  const currentDate = options.currentDate ?? new Date()
  const { payload, protectedHeader } = await jwtVerify(
    token,
    options.keyResolver ?? remoteJwks,
    {
      algorithms: ['RS256'],
      issuer: FIREBASE_ISSUER,
      audience: FIREBASE_PROJECT_ID,
      requiredClaims: ['sub', 'exp', 'iat', 'auth_time'],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      currentDate,
    },
  )
  if (
    protectedHeader.alg !== 'RS256' ||
    typeof protectedHeader.kid !== 'string' ||
    protectedHeader.kid.length === 0
  ) {
    throw new Error('Firebase ID token header is invalid.')
  }

  const firebasePayload = payload as FirebaseIdTokenPayload
  const nowSeconds = Math.floor(currentDate.getTime() / 1_000)
  requirePastTimestamp(firebasePayload.iat, 'iat', nowSeconds)
  const authTime = requirePastTimestamp(firebasePayload.auth_time, 'auth_time', nowSeconds)
  const uid = requireSafeUid(firebasePayload)
  await (options.checkUserStatus ?? verifyFirebaseUserStatus)(uid, authTime)
  return { uid }
}

export async function listFirebaseAuthUserIds(): Promise<string[]> {
  const projectId = getBackendProjectId()
  const userIds: string[] = []
  let pageToken: string | undefined
  do {
    const response = await getBackendGoogleAuth().request<{
      users?: FirebaseUserRecord[]
      nextPageToken?: string
    }>({
      url: identityToolkitProjectUrl(projectId, 'batchGet'),
      method: 'GET',
      params: {
        maxResults: 1_000,
        ...(pageToken ? { nextPageToken: pageToken } : {}),
      },
      timeout: GOOGLE_API_TIMEOUT_MS,
    })
    userIds.push(
      ...(response.data.users ?? [])
        .map((user) => user.localId)
        .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0),
    )
    if (userIds.length > MAX_AUTH_USERS) {
      throw new Error(`Auth user count exceeds the ${MAX_AUTH_USERS}-user bootstrap bound.`)
    }
    pageToken = response.data.nextPageToken
  } while (pageToken)
  return userIds
}
