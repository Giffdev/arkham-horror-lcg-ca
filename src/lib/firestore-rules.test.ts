import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(currentDir, '..', '..')
const firebaseJson = JSON.parse(readFileSync(resolve(repoRoot, 'firebase.json'), 'utf8')) as {
  firestore?: { rules?: string }
  functions?: { source?: string; predeploy?: string[] }
  emulators?: { firestore?: { port?: number } }
}
const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>
}
const nvmrc = readFileSync(resolve(repoRoot, '.nvmrc'), 'utf8').trim()
const nodeVersionFile = readFileSync(resolve(repoRoot, '.node-version'), 'utf8').trim()
const functionsPackageJson = JSON.parse(readFileSync(resolve(repoRoot, 'functions', 'package.json'), 'utf8')) as {
  engines?: { node?: string }
  name?: string
  main?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
const functionsPackageLock = JSON.parse(readFileSync(resolve(repoRoot, 'functions', 'package-lock.json'), 'utf8')) as {
  name?: string
  lockfileVersion?: number
  packages?: Record<string, {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }>
}
const functionsTsconfig = JSON.parse(readFileSync(resolve(repoRoot, 'functions', 'tsconfig.json'), 'utf8')) as {
  compilerOptions?: { rootDir?: string; outDir?: string }
}
const firestoreRules = readFileSync(resolve(repoRoot, 'firestore.rules'), 'utf8')

function expectedFunctionsMain(): string {
  const functionsDir = resolve(repoRoot, 'functions')
  const rootDir = resolve(functionsDir, functionsTsconfig.compilerOptions?.rootDir ?? '.')
  const outDir = resolve(functionsDir, functionsTsconfig.compilerOptions?.outDir ?? 'lib')
  const compiledEntry = resolve(
    outDir,
    relative(rootDir, resolve(functionsDir, 'index.ts')).replace(/\.ts$/, '.js'),
  )
  return relative(functionsDir, compiledEntry).replace(/\\/g, '/')
}

describe('firestore repository contract', () => {
  it('points firebase config at the canonical firestore rules file and functions source', () => {
    expect(firebaseJson.firestore?.rules).toBe('firestore.rules')
    expect(firebaseJson.functions?.source).toBe('functions')
    expect(firebaseJson.functions?.predeploy).toEqual(['npm run functions:build'])
  })

  it('keeps Firebase Functions build wiring aligned with the compiled main entry', () => {
    expect(rootPackageJson.scripts?.['functions:build']).toBe('tsc -p functions/tsconfig.json')
    expect(rootPackageJson.scripts?.['functions:typecheck']).toBe('tsc -p functions/tsconfig.typecheck.json')
    expect(rootPackageJson.scripts?.['functions:test']).toBe(
      'vitest run functions/scripts/bootstrap-community-stats.test.ts functions/community-stats-pipeline.test.ts functions/index.test.ts',
    )
    expect(rootPackageJson.scripts?.['functions:test:emulator']).toBe(
      'firebase emulators:exec --project demo-arkham-horror-lcg-ca --only firestore "vitest run --config vitest.firestore.config.ts functions/community-stats-pipeline.emulator.test.ts"',
    )
    expect(rootPackageJson.scripts?.['test:firestore:unit']).toContain('functions/scripts/bootstrap-community-stats.test.ts')
    expect(rootPackageJson.scripts?.['test:firestore:unit']).toContain('functions/index.test.ts')
    expect(functionsPackageJson.scripts?.build).toBe('tsc -p tsconfig.json')
    expect(functionsPackageJson.scripts?.typecheck).toBe('tsc -p tsconfig.typecheck.json')
    expect(functionsPackageJson.engines?.node).toBe('22')
    expect(nvmrc).toBe('22.23.2')
    expect(nodeVersionFile).toBe('22.23.2')
    expect(functionsPackageJson.main).toBe(expectedFunctionsMain())
  })

  it('pins functions deploy dependencies to exact versions', () => {
    const pinnedVersions = {
      ...functionsPackageJson.dependencies,
      ...functionsPackageJson.devDependencies,
    }

    expect(
      Object.values(pinnedVersions ?? {}).every((version) => !/^[~^]/.test(version)),
    ).toBe(true)
    expect(functionsPackageLock.name).toBe(functionsPackageJson.name)
    expect(functionsPackageLock.lockfileVersion).toBeGreaterThanOrEqual(3)
    expect(functionsPackageLock.packages?.['']?.dependencies).toEqual(functionsPackageJson.dependencies)
    expect(functionsPackageLock.packages?.['']?.devDependencies).toEqual(functionsPackageJson.devDependencies)
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
    expect(firestoreRules).toMatch(/match \/community-stats-system\/\{scope\}\/\{document=\*\*\}\s*\{\s*allow read, write: if false;/s)
  })

  it('defines a Firestore emulator port for rules tests', () => {
    expect(firebaseJson.emulators?.firestore?.port).toBe(8080)
  })
})
