import { access } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const artifactPath = process.argv[2]
  ? pathToFileURL(process.argv[2])
  : new URL('../lib/api/community-stats/process.js', import.meta.url)

await access(artifactPath)
const artifact = await import(artifactPath.href)

if (typeof artifact.default !== 'function') {
  throw new Error('Built community stats function does not export a default handler.')
}

const previousBackendEnabled = process.env.COMMUNITY_STATS_BACKEND_ENABLED
const previousProjectId = process.env.COMMUNITY_STATS_FIREBASE_PROJECT_ID
const previousVercel = process.env.VERCEL
process.env.COMMUNITY_STATS_BACKEND_ENABLED = 'true'
process.env.COMMUNITY_STATS_FIREBASE_PROJECT_ID = 'arkham-horror-tracker'
delete process.env.VERCEL

let statusCode = 200
let responseBody
try {
  await artifact.default(
    { method: 'POST', headers: {} },
    {
      status(code) {
        statusCode = code
        return this
      },
      setHeader() {},
      json(value) {
        responseBody = value
      },
    },
  )
} finally {
  if (previousBackendEnabled === undefined) delete process.env.COMMUNITY_STATS_BACKEND_ENABLED
  else process.env.COMMUNITY_STATS_BACKEND_ENABLED = previousBackendEnabled
  if (previousProjectId === undefined) delete process.env.COMMUNITY_STATS_FIREBASE_PROJECT_ID
  else process.env.COMMUNITY_STATS_FIREBASE_PROJECT_ID = previousProjectId
  if (previousVercel === undefined) delete process.env.VERCEL
  else process.env.VERCEL = previousVercel
}

if (statusCode !== 401 || responseBody?.error !== 'unauthorized') {
  throw new Error('Built community stats function did not complete the unauthenticated startup probe.')
}

console.log('Built community stats function starts and rejects an unauthenticated request.')
