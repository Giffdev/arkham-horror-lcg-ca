# Deployment

This repo does **not** auto-deploy from GitHub. `git push` alone does nothing.
Production release is a **manual backend-first rollout**:

1. deploy Firestore rules only
2. deploy Vercel with the backend enabled and client wake flag disabled
3. bootstrap and verify the community-stats pipeline
4. optionally prove existing source documents were not rewritten with local read-only fingerprints
5. enable client wakes and deploy the same verified revision again

No Firebase Functions or paid Firebase services are used.

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
- The bootstrap/runtime dependency set includes `firebase-admin` and
  `google-auth-library`; and
  `backend/scripts/bootstrap-community-stats.mjs` enforces explicit
  `--project` targeting plus ADC project matching.
- Authenticate before touching production:
  - Firebase CLI authenticated to the intended account
  - Application Default Credentials configured for the intended Firebase project
  - Vercel CLI authenticated to the intended account
- Deploy from the release worktree root in **Windows PowerShell**.
- `.vercel\project.json` is intentionally **local-only** because `.vercel` is
  gitignored. It must **never** be committed.
- The read-only release audit files below stay local-only under
  `.\.vercel\release-audit\`.
- Configure the dedicated least-privilege service account and encrypted,
  production-only Vercel environment variables exactly as described in `SERVICES.md`.
  The Spark Firebase project does not require Cloud Billing for this identity path.

## Canonical production rollout

The commands below are the canonical production workflow. They are consistent
with `SERVICES.md`, `PRD.md`, `package.json`, `firebase.json`, and the
contribution bootstrap script.

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

### 1. PowerShell preflight and optional read-only baseline snapshot

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
mismatch, performs **reads only**, canonicalizes every supported value into an
unambiguous structural tagged representation (including timestamps, document
references, GeoPoints, bytes, Dates, primitives, arrays, and maps) before
hashing, rejects unsupported values/cycles, and writes **only**
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

function compareCodeUnits(left, right) {
  if (left < right) {
    return -1
  }
  if (left > right) {
    return 1
  }
  return 0
}

function normalizeNumber(value, path) {
  if (!Number.isFinite(value)) {
    throw new Error(`Non-finite number encountered at ${path}: ${value}`)
  }
  return Object.is(value, -0) ? '-0' : String(value)
}

function normalize(value, path = '$', seen = new WeakSet()) {
  if (value === null) {
    return ['null']
  }
  if (typeof value === 'string') {
    return ['string', value]
  }
  if (typeof value === 'boolean') {
    return ['boolean', value]
  }
  if (typeof value === 'number') {
    return ['number', normalizeNumber(value, path)]
  }
  if (typeof value === 'bigint') {
    throw new Error(`Unsupported Firestore value at ${path}: bigint`)
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
    if (!Number.isFinite(value.getTime())) {
      throw new Error(`Unsupported Firestore value at ${path}: invalid Date`)
    }
    return ['date', value.toISOString()]
  }
  if (value instanceof Timestamp) {
    return [
      'timestamp',
      normalizeNumber(value.seconds, `${path}.seconds`),
      normalizeNumber(value.nanoseconds, `${path}.nanoseconds`),
    ]
  }
  if (value instanceof DocumentReference) {
    return ['document-reference', value.firestore.formattedName, value.path]
  }
  if (value instanceof GeoPoint) {
    return [
      'geo-point',
      normalizeNumber(value.latitude, `${path}.latitude`),
      normalizeNumber(value.longitude, `${path}.longitude`),
    ]
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return ['bytes', Buffer.from(value).toString('base64')]
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new Error(`Cycle detected at ${path}`)
    }
    seen.add(value)
    try {
      const entries = []
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new Error(`Unsupported Firestore value at ${path}[${index}]: array hole`)
        }
        entries.push(normalize(value[index], `${path}[${index}]`, seen))
      }
      return ['array', entries]
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
      const entries = Array.from(value.entries()).map(([key, entry]) => {
        if (typeof key !== 'string') {
          throw new Error(`Unsupported Firestore map key at ${path}: ${String(key)}`)
        }
        return [key, normalize(entry, `${path}.${key}`, seen)]
      })
      entries.sort(([left], [right]) => compareCodeUnits(left, right))
      return ['map', entries]
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype === Object.prototype || prototype === null) {
      if (Object.getOwnPropertySymbols(value).length > 0) {
        throw new Error(`Unsupported Firestore map key at ${path}: symbol`)
      }
      const entries = Object.keys(value)
        .sort(compareCodeUnits)
        .map((key) => [key, normalize(value[key], `${path}.${key}`, seen)])
      return ['map', entries]
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
  const unicodeFirst = {
    'é': 'precomposed',
    'e\u0301': 'decomposed',
  }
  const unicodeSecond = {
    'e\u0301': 'decomposed',
    'é': 'precomposed',
  }

  assert.equal(
    firstHash,
    secondHash,
    'Canonical hashes should be stable across object and map key reordering.',
  )
  assert.notEqual(firstHash, changedHash, 'Canonical hashes should change when content changes.')
  assert.equal(
    JSON.stringify(normalize(unicodeFirst)),
    JSON.stringify(normalize(unicodeSecond)),
    'Unicode-distinct keys should have equal canonical output regardless of insertion order.',
  )
  assert.equal(
    hashCanonicalValue(unicodeFirst),
    hashCanonicalValue(unicodeSecond),
    'Unicode-distinct keys should have equal hashes regardless of insertion order.',
  )
  assert.notEqual(
    hashCanonicalValue(sharedDate),
    hashCanonicalValue({
      __type: 'Date',
      value: sharedDate.toISOString(),
    }),
    'Date must not collide with a lookalike user map.',
  )
  assert.notEqual(
    hashCanonicalValue(sharedRef),
    hashCanonicalValue({
      __type: 'DocumentReference',
      path: sharedRef.path,
    }),
    'DocumentReference must not collide with a lookalike user map.',
  )

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
  expectFailure('symbol key rejection', () => normalize({ [Symbol('bad')]: true }), /symbol/)
  expectFailure('bigint rejection', () => normalize({ bad: 1n }), /bigint/)
  expectFailure('undefined rejection', () => normalize({ bad: undefined }), /undefined/)
  expectFailure('NaN rejection', () => normalize({ bad: Number.NaN }), /Non-finite/)
  expectFailure('Infinity rejection', () => normalize({ bad: Number.POSITIVE_INFINITY }), /Non-finite/)
  expectFailure('array hole rejection', () => normalize(new Array(1)), /array hole/)
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
  ].sort((left, right) => compareCodeUnits(left.path, right.path))

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
# Optional:
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

### 2. Deploy Firestore rules only

```powershell
npx firebase-tools deploy --only firestore:rules --project $FirebaseProject --non-interactive
```

This preserves owner-only source access, write-only owner outboxes, and a server-owned
read-only public aggregate. `firebase.json` intentionally has no Functions target.

### 3. Link and deploy the Vercel backend with client wakes disabled

Set these production values before the first deployment:

```text
COMMUNITY_STATS_BACKEND_ENABLED=true
VITE_COMMUNITY_STATS_API_ENABLED=false
```

Configure `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`,
and `CRON_SECRET` interactively as production-only, sensitive server values using
the commands in `SERVICES.md`. Do not populate a tracked or local project file with
the real key. Confirm Preview and Development have no production credential.

Before deploying, run `npm run build`. In addition to the Vite production build,
this compiles the Node ESM backend and imports the emitted serverless entrypoint so
an unresolved relative module fails locally instead of at function startup.

```powershell
npx vercel link --yes --non-interactive --team $VercelScope --project $VercelProject
npx vercel deploy --prod --yes --scope $VercelScope --project $VercelProject
```

The first deployment publishes the API while the browser continues only writing the
durable outbox. This prevents a new client from depending on an unverified backend.

Before bootstrap, verify the deployed Firebase Admin certificate identity with the
cron-protected endpoint. Set the same `CRON_SECRET` in this release shell without
writing it to disk:

```powershell
$Headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
$WorkerCheck = Invoke-RestMethod `
  -Uri 'https://arkham-horror-lcg-ca.vercel.app/api/community-stats/process' `
  -Method Get `
  -Headers $Headers

if (-not $WorkerCheck.status) {
  throw 'Vercel worker identity integration check returned no status.'
}
```

This call either reports no pending work or safely processes one queued owner. Stop
before enabling client wakes if the request returns an authentication, identity, IAM,
or Firestore error. Also exercise an owner-authenticated wake to verify revoked-token
checking, then confirm audit logs name the dedicated service account. Never log the
Firebase ID token or private key.

### 4. Bootstrap the community-stats pipeline against the explicit project

```powershell
npm run backend:bootstrap -- --project $FirebaseProject
```

The bootstrap script is `backend/scripts/bootstrap-community-stats.mjs`. It
refuses ambiguous targeting and requires the requested `--project` to match the
authenticated Application Default Credentials project. It enumerates Firebase
Authentication accounts, reads each account's source collections independently,
writes an empty contribution when the account has no games, removes stale
contributions for deleted Auth accounts, and publishes the aggregate. It writes only
server-private privacy-filtered state and does not modify source documents.

### 5. Verify backend rollout

Stop immediately if **any** item below fails.

Verify all of the following:

- `community-stats/global`
  - `schemaVersion == 3`
  - `refreshState == "ready"`
  - `pipelineGeneration == sourceGeneration` when those fields are present
  - `generatedAt` is recent
- `community-stats-internal/contribution-publisher`
  - no active lease remains (`leaseId` absent, or no unexpired lease)
- `community-stats-internal/recovery-cursor`
  - no active recovery lease remains (`leaseId` absent, or no unexpired lease)
  - `afterPath`, when present, is a server-owned outbox document cursor; clients
    cannot read or write it
- `community-stats-contributions`
  - one server-only contribution exists per Firebase Authentication user, including
    users with zero games
  - contribution documents contain counts/canonical dimensions only, never raw
    player names, notes, dates, or custom text
- `community-stats-quarantine`
  - empty after a clean bootstrap
  - any entry keeps the aggregate `refreshState` at `"failed"` until that owner
    produces a valid replacement contribution

The bootstrap command is expected to finish with:

```text
Community stats contribution bootstrap complete for ... users in project ...
```

### 6. Optionally prove source documents were not rewritten before enabling the client

If the optional baseline was captured, capture a second read-only snapshot and require an empty
diff of `{ path, updateTime, hash }` across **both** collection groups:

```powershell
node $SnapshotScript --project $FirebaseProject --out $AfterSnapshot --label after-bootstrap

& git --no-pager diff --no-index --exit-code --no-ext-diff -- $BeforeSnapshot $AfterSnapshot *> $DiffPath

if ($LASTEXITCODE -ne 0) {
  throw "Production source-document fingerprints changed. Hard stop. Inspect $DiffPath locally; do not deploy Vercel."
}

Remove-Item $DiffPath -ErrorAction SilentlyContinue
```

When this optional verification is run, it is a **hard stop** if any source document count, path, `updateTime`, or
stable content hash changes under either:

- `users/{uid}/playthroughs/*`
- `users/{uid}/campaignRuns/*`

Never auto-delete, auto-restore, or otherwise mutate production user data as a
release step. If the diff is non-empty, stop and investigate before deploying
the client.

### 7. Verify the generated Vercel linkage

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

### 8. Enable client wakes and deploy the same revision

Change the Vercel production build variable:

```text
VITE_COMMUNITY_STATS_API_ENABLED=true
```

Then deploy the same commit:

```powershell
npx vercel deploy --prod --yes --scope $VercelScope --project $VercelProject
```

Do not run the second deployment until steps 1-7 are clean. Source writes remain
compatible if the wake request fails: the outbox is durable, signed-in clients retry,
and the daily Hobby cron recovers abandoned work.

## Post-deploy smoke checks

After the Vercel deploy succeeds:

1. Open https://arkham-horror-lcg-ca.vercel.app
2. Verify the app loads successfully
3. Verify the production client reads the current aggregate without an old
   schema / stale-pipeline downgrade
4. Verify Community data renders from the published aggregate
5. Verify existing campaign/playthrough source data still appears unchanged

## Failure / rollback guidance

- If the Firestore rules deploy fails: do **not** deploy Vercel.
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
  - keep the verified Vercel backend rollout in place unless there is a separate
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
