import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(currentDir, '..', '..')
const firebaseJson = JSON.parse(readFileSync(resolve(repoRoot, 'firebase.json'), 'utf8')) as {
  firestore?: { rules?: string }
  emulators?: { firestore?: { port?: number } }
}
const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  engines?: { node?: string }
}
const vercelJson = JSON.parse(readFileSync(resolve(repoRoot, 'vercel.json'), 'utf8')) as {
  functions?: Record<string, { maxDuration?: number }>
  crons?: Array<{ path?: string; schedule?: string }>
}
const nvmrc = readFileSync(resolve(repoRoot, '.nvmrc'), 'utf8').trim()
const nodeVersionFile = readFileSync(resolve(repoRoot, '.node-version'), 'utf8').trim()
const firestoreRules = readFileSync(resolve(repoRoot, 'firestore.rules'), 'utf8')

describe('firestore repository contract', () => {
  it('keeps Firebase limited to Firestore rules and emulation', () => {
    expect(firebaseJson.firestore?.rules).toBe('firestore.rules')
    expect(firebaseJson).not.toHaveProperty('functions')
  })

  it('wires the Vercel backend and daily Hobby-compatible recovery', () => {
    expect(rootPackageJson.scripts?.['backend:build']).toBe('tsc -p backend/tsconfig.json')
    expect(rootPackageJson.scripts?.['backend:typecheck']).toBe('tsc -p backend/tsconfig.typecheck.json')
    expect(rootPackageJson.scripts?.['backend:test']).toBe(
      'vitest run backend/scripts/bootstrap-community-stats.test.ts backend/firebase-admin.test.ts backend/community-stats-contributions.test.ts backend/community-stats-handler.test.ts',
    )
    expect(rootPackageJson.scripts?.['backend:test:emulator']).toBe(
      'firebase emulators:exec --project demo-arkham-horror-lcg-ca --only firestore "vitest run --config vitest.firestore.config.ts backend/community-stats-contributions.emulator.test.ts"',
    )
    expect(rootPackageJson.dependencies).not.toHaveProperty('@vercel/oidc')
    expect(rootPackageJson.dependencies).toHaveProperty('firebase-admin')
    expect(rootPackageJson.dependencies).toHaveProperty('google-auth-library')
    expect(rootPackageJson.devDependencies).not.toHaveProperty('firebase-functions')
    expect(vercelJson.functions?.['api/community-stats/process.ts']?.maxDuration).toBe(60)
    expect(vercelJson.crons).toEqual([
      { path: '/api/community-stats/process', schedule: '17 4 * * *' },
    ])
    expect(rootPackageJson.engines?.node).toBe('22.x')
    expect(nvmrc).toBe('22.23.2')
    expect(nodeVersionFile).toBe('22.23.2')
  })

  it('keeps user playthrough and campaign-run access owner scoped', () => {
    expect(firestoreRules).toMatch(/match \/playthroughs\/\{playthroughId\}\s*\{\s*allow read, write: if isOwner\(userId\);/s)
    expect(firestoreRules).toMatch(/match \/campaignRuns\/\{campaignRunId\}\s*\{\s*allow read, write: if isOwner\(userId\);/s)
    expect(firestoreRules).toMatch(/function isAllowedClientOutboxReason\(reason\)\s*\{[\s\S]*reason == 'import';/s)
    expect(firestoreRules).toMatch(/function isValidClientOutboxCreate\(userId, eventId\)\s*\{[\s\S]*request\.resource\.data\.mutationId == eventId[\s\S]*request\.resource\.data\.requestedBy == 'client'[\s\S]*request\.resource\.data\.affectedDocuments <= 499;/s)
    expect(firestoreRules).toMatch(/match \/communityStatsOutbox\/\{eventId\}\s*\{\s*allow create: if isValidClientOutboxCreate\(userId, eventId\);\s*allow read, update, delete: if false;/s)
  })

  it('publishes a read-only global community aggregate to clients', () => {
    expect(firestoreRules).toMatch(/match \/community-stats\/\{docId\}\s*\{\s*allow read: if docId == 'global';\s*allow write: if false;/s)
    expect(firestoreRules).toMatch(/match \/community-stats-internal\/\{docId\}\s*\{\s*allow read, write: if false;/s)
    expect(firestoreRules).toMatch(/match \/community-stats-contributions\/\{userId\}\s*\{\s*allow read, write: if false;/s)
    expect(firestoreRules).toMatch(/match \/community-stats-quarantine\/\{userId\}\s*\{\s*allow read, write: if false;/s)
  })

  it('defines a Firestore emulator port for rules tests', () => {
    expect(firebaseJson.emulators?.firestore?.port).toBe(8080)
  })
})
