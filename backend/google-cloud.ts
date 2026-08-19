import { createPrivateKey } from 'node:crypto'

import { Firestore } from '@google-cloud/firestore'
import { GoogleAuth } from 'google-auth-library'

export const FIREBASE_PROJECT_ID = 'arkham-horror-tracker'

type RequiredBackendConfig = {
  projectId: string
  clientEmail: string
  privateKey: string
}

let firestore: Firestore | undefined
let googleAuth: GoogleAuth | undefined

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required backend environment variable: ${name}`)
  }
  return value
}

function normalizedPrivateKey(value: string): string {
  const privateKey = value
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim()
  if (
    !/^-----BEGIN PRIVATE KEY-----\n[\s\S]+\n-----END PRIVATE KEY-----$/.test(privateKey)
  ) {
    throw new Error('FIREBASE_PRIVATE_KEY must be a valid PKCS#8 PEM private key.')
  }
  try {
    createPrivateKey({ key: privateKey, format: 'pem', type: 'pkcs8' })
  } catch {
    throw new Error('FIREBASE_PRIVATE_KEY must be a valid PKCS#8 PEM private key.')
  }
  return `${privateKey}\n`
}

export function getBackendConfig(): RequiredBackendConfig {
  const projectId = requiredEnv('FIREBASE_PROJECT_ID')
  if (projectId !== FIREBASE_PROJECT_ID) {
    throw new Error(`FIREBASE_PROJECT_ID must be ${FIREBASE_PROJECT_ID}.`)
  }

  const clientEmail = requiredEnv('FIREBASE_CLIENT_EMAIL').toLowerCase()
  if (
    !/^[a-z0-9][a-z0-9._-]*@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/.test(
      clientEmail,
    )
  ) {
    throw new Error('FIREBASE_CLIENT_EMAIL is not a valid service-account email.')
  }
  const emailProjectId = clientEmail.slice(
    clientEmail.indexOf('@') + 1,
    -'.iam.gserviceaccount.com'.length,
  )
  if (emailProjectId !== projectId) {
    throw new Error('FIREBASE_CLIENT_EMAIL does not belong to FIREBASE_PROJECT_ID.')
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizedPrivateKey(requiredEnv('FIREBASE_PRIVATE_KEY')),
  }
}

export function getBackendProjectId(): string {
  if (process.env.VERCEL) return getBackendConfig().projectId
  const projectId =
    process.env.COMMUNITY_STATS_FIREBASE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim()
  if (!projectId) {
    throw new Error(
      'Set COMMUNITY_STATS_FIREBASE_PROJECT_ID when running the backend outside Vercel.',
    )
  }
  return projectId
}

export function getBackendFirestore(): Firestore {
  if (firestore) return firestore
  if (process.env.VERCEL) {
    const config = getBackendConfig()
    firestore = new Firestore({
      projectId: config.projectId,
      credentials: {
        client_email: config.clientEmail,
        private_key: config.privateKey,
      },
    })
    return firestore
  }
  firestore = new Firestore({ projectId: getBackendProjectId() })
  return firestore
}

export function getBackendGoogleAuth(): GoogleAuth {
  if (googleAuth) return googleAuth
  const scopes = ['https://www.googleapis.com/auth/cloud-platform']
  if (process.env.VERCEL) {
    const config = getBackendConfig()
    googleAuth = new GoogleAuth({
      projectId: config.projectId,
      credentials: {
        client_email: config.clientEmail,
        private_key: config.privateKey,
      },
      scopes,
    })
    return googleAuth
  }
  googleAuth = new GoogleAuth({
    projectId: getBackendProjectId(),
    scopes,
  })
  return googleAuth
}

export function resetBackendClientsForTest(): void {
  firestore = undefined
  googleAuth = undefined
}
