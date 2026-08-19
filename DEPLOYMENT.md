# Deployment

This repo does **not** auto-deploy from GitHub. `git push` alone does nothing.
Production release is a **manual two-stage rollout**:

1. deploy Firebase backend changes first
2. bootstrap and verify the community-stats pipeline
3. prove existing source documents were not rewritten
4. only then deploy the Vercel web client

Do **not** use a Vercel-only shortcut for changes that depend on Firestore rules,
Functions, or aggregate-schema rollout.

## Live targets

- Production site: https://arkham-horror-lcg-ca.vercel.app
- Firebase project: `arkham-horror-tracker`
- Vercel project: `giffdevs-projects/arkham-horror-lcg-ca`

## Prerequisites

- Use **Node 22** for install/build/bootstrap work. The repo pins `22.23.2` in:
  - `.nvmrc`
  - `.node-version`
- Firebase CLI is available via the repo dev dependency (`firebase-tools` in
  `package.json`), so prefer `npx firebase-tools ...`.
- The existing bootstrap/runtime dependency set already includes
  `firebase-admin` plus `google-auth-library` (`functions\package.json`), and
  `functions/scripts/bootstrap-community-stats.mjs` already enforces explicit
  `--project` targeting plus ADC project matching.
- Authenticate before touching production:
  - Firebase CLI authenticated to the intended account
  - Application Default Credentials configured for the intended Firebase project
  - Vercel CLI authenticated to the intended account
- Deploy from the release worktree root in **Windows PowerShell**.
- `.vercel\project.json` is intentionally **local-only** because `.vercel` is
  gitignored. It must **never** be committed.
- The read-only release audit files below also stay local-only under
  `.\.vercel\release-audit\`.

## Canonical production rollout

The commands below are the canonical production workflow. They are consistent
with `SERVICES.md`, `PRD.md`, `package.json`, `firebase.json`, and the
Functions bootstrap script.

### 0. Optional local validation

For code changes, validate locally before touching production:

```powershell
npm run typecheck
npm run test:firestore
npm test
npm run build
```

Documentation-only changes do not require this full suite unless a doc-specific
consistency test is added later.

### 1. PowerShell preflight: fix the target values up front and capture a baseline snapshot

Open PowerShell in the release worktree root, then refuse to continue unless
that shell is already using **Node 22**:

```powershell
$ReleaseRoot = (Get-Location).Path
$FirebaseProject = 'arkham-horror-tracker'
$VercelScope = 'giffdevs-projects'
$VercelProject = 'arkham-horror-lcg-ca'
$ExpectedVercelOrgId = 'team_qymLK9gugmE5lSs2mxC5XqRY'
$ExpectedVercelProjectId = 'prj_1QDOJMBT5hM80DuyFzs2mWG4a4Aw'
$AuditDir = Join-Path $ReleaseRoot '.vercel\release-audit'
$SnapshotScript = Join-Path $AuditDir 'snapshot-source-docs.mjs'
$BeforeSnapshot = Join-Path $AuditDir 'source.before.jsonl'
$AfterSnapshot = Join-Path $AuditDir 'source.after.jsonl'
$DiffPath = Join-Path $AuditDir 'source.diff.txt'

Set-Location $ReleaseRoot

if ((node -p "process.versions.node.split('.')[0]") -ne '22') {
  throw 'Select Node 22 before running production release commands.'
}

New-Item -ItemType Directory -Force -Path $AuditDir | Out-Null
```

Now create a **read-only** local helper that fingerprints both
`users/*/playthroughs/*` and `users/*/campaignRuns/*`. It aborts on ADC/project
mismatch, performs **reads only**, canonicalizes supported Admin SDK values
(timestamps, document references, GeoPoints, and bytes) plus arrays/maps before
hashing, rejects unsupported functions/symbols/cycles, and writes **only**
`{ path, updateTime, hash }` records to a local ignored JSONL file:

```powershell
@'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { GoogleAuth } from 'google-auth-library'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import {
  DocumentReference,
  Firestore,
  GeoPoint,
  Timestamp,
  getFirestore,
} from 'firebase-admin/firestore'

function parseArgs(argv) {
  let projectId
  let outFile
  let label = 'snapshot'
  let selfTest = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--self-test') {
      selfTest = true
      continue
    }
    if (arg === '--project') {
      projectId = argv[index + 1]
      index += 1
      continue
    }
    if (arg === '--out') {
      outFile = argv[index + 1]
      index += 1
      continue
    }
    if (arg === '--label') {
      label = argv[index + 1]
      index += 1
    }
  }

  return {
    selfTest,
    projectId: projectId?.trim() || null,
    outFile: outFile?.trim() || null,
    label: label.trim() || 'snapshot',
  }
}

async function resolveAuthenticatedProjectId() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  return auth.getProjectId()
}

function padNanos(value) {
  return String(value).padStart(9, '0')
}

function normalizeTimestamp(value) {
  return {
    __type: 'Timestamp',
    seconds: value.seconds,
    nanoseconds: value.nanoseconds,
  }
}

function normalize(value, path = '$', seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite number encountered at ${path}: ${value}`)
    }
    return value
  }
  if (typeof value === 'bigint') {
    return { __type: 'BigInt', value: value.toString() }
  }
  if (typeof value === 'undefined') {
    throw new Error(`Unsupported Firestore value at ${path}: undefined`)
  }
  if (typeof value === 'function') {
    throw new Error(`Unsupported Firestore value at ${path}: function`)
  }
  if (typeof value === 'symbol') {
    throw new Error(`Unsupported Firestore value at ${path}: symbol`)
  }
  if (value instanceof Date) {
    return { __type: 'Date', value: value.toISOString() }
  }
  if (value instanceof Timestamp) {
    return normalizeTimestamp(value)
  }
  if (value instanceof DocumentReference) {
    return { __type: 'DocumentReference', path: value.path }
  }
  if (value instanceof GeoPoint) {
    return {
      __type: 'GeoPoint',
      latitude: value.latitude,
      longitude: value.longitude,
    }
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __type: 'Bytes', value: Buffer.from(value).toString('base64') }
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new Error(`Cycle detected at ${path}`)
    }
    seen.add(value)
    try {
      return value.map((entry, index) => normalize(entry, `${path}[${index}]`, seen))
    } finally {
      seen.delete(value)
    }
  }

  if (!value || typeof value !== 'object') {
    throw new Error(`Unsupported Firestore value at ${path}: ${typeof value}`)
  }

  if (seen.has(value)) {
    throw new Error(`Cycle detected at ${path}`)
  }

  seen.add(value)
  try {
    if (value instanceof Map) {
      return Object.fromEntries(
        Array.from(value.entries())
          .map(([key, entry]) => {
            if (typeof key !== 'string') {
              throw new Error(`Unsupported Firestore map key at ${path}: ${String(key)}`)
            }
            return [key, normalize(entry, `${path}.${key}`, seen)]
          })
          .sort(([left], [right]) => left.localeCompare(right)),
      )
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype === Object.prototype || prototype === null) {
      return Object.fromEntries(
        Object.keys(value)
          .sort((left, right) => left.localeCompare(right))
          .map((key) => [key, normalize(value[key], `${path}.${key}`, seen)]),
      )
    }

    const constructorName = prototype?.constructor?.name || 'object'
    throw new Error(`Unsupported Firestore value at ${path}: ${constructorName}`)
  } finally {
    seen.delete(value)
  }
}

function hashCanonicalValue(value) {
  return createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex')
}

function formatTimestamp(value) {
  if (!(value instanceof Timestamp)) {
    throw new Error('Expected Firestore Timestamp for updateTime.')
  }

  return `${value.seconds}.${padNanos(value.nanoseconds)}`
}

function formatUpdateTime(updateTime) {
  return updateTime ? formatTimestamp(updateTime) : null
}

function toFingerprint(doc) {
  if (!(doc.ref instanceof DocumentReference)) {
    throw new Error('Expected Firestore DocumentReference for snapshot fingerprinting.')
  }

  return {
    path: doc.ref.path,
    updateTime: formatUpdateTime(doc.updateTime),
    hash: hashCanonicalValue(doc.data()),
  }
}

function expectFailure(label, fn, pattern) {
  try {
    fn()
  } catch (error) {
    if (!pattern.test(error.message)) {
      throw new Error(`${label} failed with unexpected message: ${error.message}`)
    }
    return
  }

  throw new Error(`${label} should have failed.`)
}

async function runSelfTest() {
  const firestore = new Firestore({ projectId: 'demo-snapshot-self-test' })
  const sharedRef = firestore.doc('users/self-test/playthroughs/reference-doc')
  const sharedTimestamp = new Timestamp(1763141234, 456000789)
  const updateTime = new Timestamp(1763142234, 111222333)
  const sharedGeoPoint = new GeoPoint(47.6062, -122.3321)
  const sharedBytes = Uint8Array.from([0, 1, 2, 3, 252, 253, 254, 255])
  const sharedDate = new Date('2026-01-02T03:04:05.678Z')

  const firstValue = {
    bytes: Buffer.from(sharedBytes),
    createdAt: sharedDate,
    flags: [true, false, null],
    nested: {
      alpha: new Map([
        ['timestamp', sharedTimestamp],
        ['reference', sharedRef],
        ['geo', sharedGeoPoint],
      ]),
      beta: [
        { k2: 'value', k1: 7 },
        new Map([
          ['arr', [Buffer.from('Arkham', 'utf8'), sharedTimestamp]],
          ['stamp', sharedTimestamp],
        ]),
      ],
    },
  }

  const secondValue = {
    nested: {
      beta: [
        { k1: 7, k2: 'value' },
        new Map([
          ['stamp', new Timestamp(1763141234, 456000789)],
          ['arr', [Uint8Array.from(Buffer.from('Arkham', 'utf8')), new Timestamp(1763141234, 456000789)]],
        ]),
      ],
      alpha: new Map([
        ['geo', new GeoPoint(47.6062, -122.3321)],
        ['reference', firestore.doc('users/self-test/playthroughs/reference-doc')],
        ['timestamp', new Timestamp(1763141234, 456000789)],
      ]),
    },
    flags: [true, false, null],
    createdAt: new Date('2026-01-02T03:04:05.678Z'),
    bytes: Uint8Array.from(sharedBytes),
  }

  const changedValue = {
    ...firstValue,
    nested: {
      ...firstValue.nested,
      beta: [
        firstValue.nested.beta[0],
        new Map([
          ['arr', [Buffer.from('Arkham', 'utf8'), sharedTimestamp]],
          ['stamp', new Timestamp(1763141234, 456000790)],
        ]),
      ],
    },
  }

  const firstHash = hashCanonicalValue(firstValue)
  const secondHash = hashCanonicalValue(secondValue)
  const changedHash = hashCanonicalValue(changedValue)

  assert.equal(
    firstHash,
    secondHash,
    'Canonical hashes should be stable across object and map key reordering.',
  )
  assert.notEqual(firstHash, changedHash, 'Canonical hashes should change when content changes.')

  const fingerprint = toFingerprint({
    data: () => firstValue,
    ref: sharedRef,
    updateTime,
  })
  assert.equal(fingerprint.path, 'users/self-test/playthroughs/reference-doc')
  assert.equal(fingerprint.updateTime, '1763142234.111222333')
  assert.equal(fingerprint.hash, firstHash)

  expectFailure('function rejection', () => normalize({ bad: () => {} }), /function/)
  expectFailure('symbol rejection', () => normalize({ bad: Symbol('bad') }), /symbol/)
  const cyclic = {}
  cyclic.self = cyclic
  expectFailure('cycle rejection', () => normalize(cyclic), /Cycle detected/)

  console.log(`self-test: ok stableHash=${firstHash} changedHash=${changedHash}`)
}

async function readCollectionGroup(db, collectionId) {
  const snapshot = await db.collectionGroup(collectionId).get()
  return snapshot.docs.map((doc) => toFingerprint(doc))
}

async function main() {
  const { selfTest, projectId, outFile, label } = parseArgs(process.argv.slice(2))

  if (selfTest) {
    await runSelfTest()
    return
  }

  if (!projectId) {
    throw new Error('Pass --project <firebase-project-id>. Refusing ambiguous Firestore reads.')
  }
  if (!outFile) {
    throw new Error('Pass --out <path>. Refusing to stream fingerprints to stdout.')
  }

  const authenticatedProjectId = await resolveAuthenticatedProjectId()

  if (!authenticatedProjectId?.trim()) {
    throw new Error(
      'Unable to resolve the authenticated ADC project. Refusing ambiguous Firestore reads.',
    )
  }
  if (authenticatedProjectId !== projectId) {
    throw new Error(
      `Requested project "${projectId}" does not match authenticated ADC project "${authenticatedProjectId}".`,
    )
  }

  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId,
    })
  }

  const db = getFirestore()
  const entries = [
    ...(await readCollectionGroup(db, 'playthroughs')),
    ...(await readCollectionGroup(db, 'campaignRuns')),
  ].sort((left, right) => left.path.localeCompare(right.path))

  const resolvedOutFile = resolve(outFile)
  await mkdir(dirname(resolvedOutFile), { recursive: true })
  await writeFile(
    resolvedOutFile,
    `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    'utf8',
  )

  const playthroughCount = entries.filter((entry) => entry.path.includes('/playthroughs/')).length
  const campaignRunCount = entries.filter((entry) => entry.path.includes('/campaignRuns/')).length

  console.log(
    `${label}: wrote ${entries.length} source-doc fingerprints ` +
      `(${playthroughCount} playthroughs, ${campaignRunCount} campaignRuns) to ${resolvedOutFile}`,
  )
}

main().catch((error) => {
  console.error(error.stack ?? error.message)
  process.exit(1)
})
'@ | Set-Content -Path $SnapshotScript -Encoding UTF8

node --check $SnapshotScript
node $SnapshotScript --self-test
node $SnapshotScript --project $FirebaseProject --out $BeforeSnapshot --label before-bootstrap
```

Snapshot invariants:

- the helper reads **only** collection-group query results from `playthroughs`
  and `campaignRuns`
- it writes **only** local ignored files under `.\.vercel\release-audit\`
- it never prints document bodies or field values to the console
- `node $SnapshotScript --self-test` uses only synthetic local Admin SDK values
  and does **not** connect to production before release reads begin
- keep the snapshot and diff files local; they contain document paths and must
  not be pasted into PRs, chat, or shared logs
- it aborts on project mismatch, auth ambiguity, or query failure

### 2. Deploy Firestore rules and Functions first

```powershell
npx firebase-tools deploy --only firestore:rules,functions --project $FirebaseProject --non-interactive
```

Why first:

- `firebase.json` defines Firestore rules plus Functions deployment
- Functions predeploy runs `npm run functions:build`
- the web client must not ship before required backend/schema support is live

### 3. Bootstrap the community-stats pipeline against the explicit project

```powershell
npm run functions:bootstrap -- --project $FirebaseProject
```

The bootstrap script is `functions/scripts/bootstrap-community-stats.mjs`. It
refuses ambiguous targeting and requires the requested `--project` to match the
authenticated Admin SDK project.

### 4. Verify backend rollout before touching Vercel

Stop immediately if **any** item below fails.

Verify all of the following:

- `community-stats/global`
  - `schemaVersion == 3`
  - `refreshState == "ready"`
  - `pipelineGeneration == sourceGeneration` when those fields are present
  - `generatedAt` is recent (the bootstrap script currently requires it to be
    within its freshness window)
- `community-stats-internal/state`
  - the exact bootstrap marker reported by the bootstrap run is present in
    `completedBootstrapMarkers`
  - `pendingBootstrapMarkers` is empty or absent
  - no active lease remains (`leaseId` absent, or no unexpired lease)
- durable outbox
  - `communityStatsOutbox` is empty after the publish completes

The bootstrap command itself is expected to finish with the success marker:

```text
Community stats bootstrap complete at pipeline generation ... (generatedAt=..., marker=bootstrap-...)
```

Treat the printed `marker=bootstrap-...` value as the exact completed marker to
check in retained completed worker state.

### 5. Prove source documents were not rewritten before shipping the client

After step 4 succeeds, capture a second read-only snapshot and require an empty
diff of `{ path, updateTime, hash }` across **both** collection groups:

```powershell
node $SnapshotScript --project $FirebaseProject --out $AfterSnapshot --label after-bootstrap

& git --no-pager diff --no-index --exit-code --no-ext-diff -- $BeforeSnapshot $AfterSnapshot *> $DiffPath

if ($LASTEXITCODE -ne 0) {
  throw "Production source-document fingerprints changed. Hard stop. Inspect $DiffPath locally; do not deploy Vercel."
}

Remove-Item $DiffPath -ErrorAction SilentlyContinue
```

This is a **hard stop** if any source document count, path, `updateTime`, or
stable content hash changes under either:

- `users/{uid}/playthroughs/*`
- `users/{uid}/campaignRuns/*`

Never auto-delete, auto-restore, or otherwise mutate production user data as a
release step. If the diff is non-empty, stop and investigate before deploying
the client.

### 6. Explicitly link this release worktree to the production Vercel project, then verify the generated linkage

This clean branch intentionally does **not** commit `.vercel\project.json`
because `.vercel` is ignored. Link the current worktree explicitly with the
verified non-interactive Vercel CLI flags, then inspect the local ignored
linkage file before deploying:

```powershell
npx vercel link --yes --non-interactive --team $VercelScope --project $VercelProject

$VercelLink = Get-Content '.\.vercel\project.json' -Raw | ConvertFrom-Json

if (
  $VercelLink.projectName -ne $VercelProject -or
  $VercelLink.orgId -ne $ExpectedVercelOrgId -or
  $VercelLink.projectId -ne $ExpectedVercelProjectId
) {
  throw 'Unexpected .vercel\project.json identity. Stop before production deploy.'
}
```

If `.vercel\project.json` points anywhere else, fix the **local** linkage and
re-run the verification. Do **not** commit that file.

### 7. Deploy the Vercel web client only after backend verification, source comparison, and link verification pass

Use the deploy command with the explicit scope/project flags supported by the
current Vercel CLI:

```powershell
npx vercel deploy --prod --yes --scope $VercelScope --project $VercelProject
```

This publishes the current working tree to the intended production Vercel
project. Do not run it until steps 1-6 are clean.

## Post-deploy smoke checks

After the Vercel deploy succeeds:

1. Open https://arkham-horror-lcg-ca.vercel.app
2. Verify the app loads successfully
3. Verify the production client reads the current aggregate without an old
   schema / stale-pipeline downgrade
4. Verify Community data renders from the published aggregate
5. Verify existing campaign/playthrough source data still appears unchanged

## Failure / rollback guidance

- If the Firebase deploy fails: do **not** deploy Vercel.
- If bootstrap fails or times out: do **not** deploy Vercel. Fix backend
  rollout first, then rerun bootstrap against `arkham-horror-tracker`.
- If backend verification fails: stop. Do not “test in prod” by shipping the
  newer client anyway.
- If the source snapshot diff is non-empty: stop. Never delete/restore
  production data automatically as a release shortcut.
- If the Vercel link verification fails: stop and fix the local ignored linkage
  before deploying production.
- If the web client deploy succeeds but smoke checks fail:
  - roll back the **client** to the last known-good Vercel deployment or commit
  - keep the verified backend rollout in place unless there is a separate
    backend defect requiring a controlled fix

Never delete user game data as a rollback tactic:

- do **not** delete `users/{uid}/playthroughs/*`
- do **not** delete `users/{uid}/campaignRuns/*`

The community aggregate/internal pipeline state is rebuildable from source.
User game logs are not.

## Still-valid Vercel notes

- Production deploy syntax verified locally with `npx vercel deploy --help`
- Link syntax verified locally with `npx vercel link --help`
- `.vercel\project.json` stays local/ignored and must never be committed
- To generate a throwaway preview URL instead of production, run:

```powershell
npx vercel deploy --yes --scope giffdevs-projects --project arkham-horror-lcg-ca
```
