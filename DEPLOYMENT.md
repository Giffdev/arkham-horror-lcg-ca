# Deployment

This repo does **not** auto-deploy from GitHub. `git push` alone does nothing.
Production release is a **manual two-stage rollout**:

1. deploy Firebase backend changes first
2. verify the community-stats pipeline is healthy
3. only then deploy the Vercel web client

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
- Authenticate before touching production:
  - Firebase CLI authenticated to the intended account
  - Vercel CLI authenticated to the intended account
- Always target production explicitly:
  - Firebase commands must pass `--project arkham-horror-tracker`
  - Vercel deploys must go to `giffdevs-projects/arkham-horror-lcg-ca`
- Deploy from the repo root. If Vercel tries to link or create a different
  project, stop and fix the local linkage before deploying production.

## Canonical production rollout

The commands below are the canonical production workflow. They are consistent
with `SERVICES.md`, `PRD.md`, `package.json`, `firebase.json`, and the
Functions bootstrap script.

### 0. Optional local validation

For code changes, validate locally before touching production:

```bash
npm run typecheck
npm run test:firestore
npm test
npm run build
```

Documentation-only changes do not require this full suite unless a doc-specific
consistency test is added later.

### 1. Deploy Firestore rules and Functions first

```bash
npx firebase-tools deploy --only firestore:rules,functions --project arkham-horror-tracker --non-interactive
```

Why first:
- `firebase.json` defines Firestore rules plus Functions deployment
- Functions predeploy runs `npm run functions:build`
- the web client must not ship before required backend/schema support is live

### 2. Bootstrap the community-stats pipeline against the explicit project

```bash
npm run functions:bootstrap -- --project arkham-horror-tracker
```

The bootstrap script is `functions/scripts/bootstrap-community-stats.mjs`. It
refuses ambiguous targeting and requires the requested `--project` to match the
authenticated Admin SDK project.

### 3. Verify backend rollout before touching Vercel

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

### 4. Verify existing production source documents remain unchanged

This rollout must **not** migrate, rewrite, or delete existing user source data.

Expected mutable production docs during rollout:
- `community-stats/global`
- `community-stats-internal/state`
- bootstrap/system outbox docs under `community-stats-system/system/...`

Existing source documents must remain authoritative and unchanged:
- `users/{uid}/playthroughs/*`
- `users/{uid}/campaignRuns/*`

If you observe source-document rewrites as part of rollout, stop and
investigate before deploying the client.

### 5. Deploy the Vercel web client only after backend verification passes

```bash
npx vercel --prod --yes
```

This publishes the current working tree to the production Vercel project. Use
it **only after** steps 1-4 are complete.

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

- Manual production deploy command: `npx vercel --prod --yes`
- To generate a throwaway preview URL instead of production, run:

```bash
npx vercel
```
