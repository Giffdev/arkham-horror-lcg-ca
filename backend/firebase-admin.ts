import { getVercelOidcToken } from '@vercel/oidc'
import {
  applicationDefault,
  getApps,
  initializeApp,
  type Credential,
} from 'firebase-admin/app'
import { ExternalAccountClient } from 'google-auth-library'

type RequiredBackendConfig = {
  projectId: string
  projectNumber: string
  serviceAccountEmail: string
  workloadIdentityPoolId: string
  workloadIdentityPoolProviderId: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required backend environment variable: ${name}`)
  }
  return value
}

export function getBackendConfig(): RequiredBackendConfig {
  const projectId = requiredEnv('GCP_PROJECT_ID')
  const expectedProjectId = requiredEnv('COMMUNITY_STATS_FIREBASE_PROJECT_ID')
  if (projectId !== expectedProjectId) {
    throw new Error('GCP_PROJECT_ID does not match COMMUNITY_STATS_FIREBASE_PROJECT_ID.')
  }

  return {
    projectId,
    projectNumber: requiredEnv('GCP_PROJECT_NUMBER'),
    serviceAccountEmail: requiredEnv('GCP_SERVICE_ACCOUNT_EMAIL'),
    workloadIdentityPoolId: requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_ID'),
    workloadIdentityPoolProviderId: requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID'),
  }
}

function createVercelOidcCredential(config: RequiredBackendConfig): Credential {
  const providerPath =
    `//iam.googleapis.com/projects/${config.projectNumber}/locations/global/` +
    `workloadIdentityPools/${config.workloadIdentityPoolId}/providers/` +
    config.workloadIdentityPoolProviderId
  const oidcAudience = `https://iam.googleapis.com${providerPath}`

  const authClient = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: providerPath,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/` +
      `${config.serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({ audience: oidcAudience }),
    },
  })

  if (!authClient) {
    throw new Error('Unable to create the Vercel OIDC Google authentication client.')
  }

  return {
    async getAccessToken() {
      const token = await authClient.getAccessToken()
      if (!token.token) {
        throw new Error('Google workload identity federation returned no access token.')
      }
      return {
        access_token: token.token,
        expires_in: 300,
      }
    },
  }
}

export function ensureFirebaseAdminApp(): void {
  if (getApps().length > 0) return

  if (process.env.VERCEL) {
    const config = getBackendConfig()
    initializeApp({
      credential: createVercelOidcCredential(config),
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
