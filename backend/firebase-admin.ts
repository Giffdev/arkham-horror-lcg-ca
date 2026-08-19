import { createPrivateKey } from 'node:crypto'

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app'

type RequiredBackendConfig = {
  projectId: string
  clientEmail: string
  privateKey: string
}

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
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error('FIREBASE_PROJECT_ID is not a valid Google Cloud project ID.')
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

export function ensureFirebaseAdminApp(): void {
  if (getApps().length > 0) return

  if (process.env.VERCEL) {
    const config = getBackendConfig()
    initializeApp({
      credential: cert(config),
      projectId: config.projectId,
    })
    return
  }

  const projectId =
    process.env.COMMUNITY_STATS_FIREBASE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim()
  if (!projectId) {
    throw new Error(
      'Set COMMUNITY_STATS_FIREBASE_PROJECT_ID when running the backend outside Vercel.',
    )
  }
  initializeApp({
    credential: applicationDefault(),
    projectId,
  })
}
