# Service Connections

How this project connects to GitHub, Firebase, and Vercel.

## GitHub

- **Repo:** `Giffdev/arkham-horror-lcg-ca`
- **CLI:** `gh` authenticated as `Giffdev` (active account, keyring-stored token)
- **Protocol:** HTTPS (`https://github.com/Giffdev/arkham-horror-lcg-ca.git`)
- **Scopes:** gist, read:org, repo, workflow

## Firebase (Firestore)

- **Runtime:** Firestore + Firebase Functions (Node 22)
- **Supported local toolchain:** Node `22.23.2` via the repo-root `.nvmrc` / `.node-version` pins (current CI workflows already use Node 22)
- **Config:** Environment variables in `.env` (not committed), loaded via `import.meta.env.VITE_FIREBASE_*`
- **Config file:** `src/lib/firebase.ts`
- **Data file:** `src/lib/firestore.ts`
- **Canonical rules file:** `firestore.rules` (wired through `firebase.json`)
- **Functions entrypoint:** `functions/lib/functions/index.js` (built from `functions/index.ts`)
- **Functions predeploy build:** `firebase.json` runs `npm run functions:build`
- **Manual bootstrap script:** `npm run functions:bootstrap -- --project <firebase-project-id>`
- **Auth:** Google Sign-In via `src/lib/auth.ts`
- **Collections:**
  - `users/{uid}` — user profile (created on first login)
  - `users/{uid}/playthroughs/{id}` — per-user game logs
  - `users/{uid}/campaignRuns/{id}` — per-user campaign runs with nested scenario logs
  - `users/{uid}/communityStatsOutbox/{eventId}` — owner-created durable aggregation outbox events (write-only to clients; exact client schema only)
  - `community-stats/global` — published read-only community aggregate
  - `community-stats-internal/state` — private lease / recovery / watermark state for the aggregate worker
  - `community-stats-system/system/communityStatsOutbox/{eventId}` — admin-only bootstrap markers and manual wake events
- **Security rules policy:** Canonical text now lives in-repo in `firestore.rules`
  - Users can only read/write their own `users/{uid}` profile doc
  - Users can only read/write their own `playthroughs` and `campaignRuns` docs
  - Users can create, but not read/update/delete, their own `communityStatsOutbox` docs
  - Client outbox creates must use the exact 5-field schema `{ mutationId, requestedAtMs, requestedBy, reason, affectedDocuments }`
  - Client outbox doc ids must exactly match `mutationId`, `requestedBy` must be `"client"`, `reason` must be one of `user-create`, `playthrough-write`, `playthrough-delete`, `campaign-run-write`, `campaign-run-delete`, `campaign-run-promotion`, `campaign-run-restoration`, or `import`, and `affectedDocuments` must stay within `1..499`
  - Client outbox docs cannot include bootstrap/system fields, extra keys, or PII side-channel fields; `community-stats-system/**` and `community-stats-internal/**` are always denied to clients
  - Raw cross-user `collectionGroup(...)` reads are denied to ordinary clients
  - `community-stats/global` is publicly readable and client-writes are always denied
  - `community-stats-internal/state` has no client access; only Admin SDK / Functions may manage leases or recovery state
- **Aggregate contract:**
  - Client-owned source writes emit one durable outbox event per logical mutation rather than contending on one control document
  - Atomic imports cap at **499 source records** because the transaction also writes one outbox event (500 Firestore writes total)
  - System outbox docs use exact admin schemas only: bootstrap markers are `{ mutationId, requestedAtMs, requestedBy: "bootstrap", reason: "bootstrap", affectedDocuments: 0, bootstrapMarkerId }` with `bootstrapMarkerId == mutationId`; manual wake docs are `{ mutationId, requestedAtMs, requestedBy: "system", reason: "manual", affectedDocuments: 0 }`
  - Bootstrap marker ids must match `bootstrap-[a-z0-9]+(?:-[a-z0-9]+)*$`; manual wake ids must match `manual-[a-z0-9]+(?:-[a-z0-9]+)*$`; both are capped at **64 ASCII chars / 64 UTF-8 bytes**. Generated bootstrap ids use `bootstrap-<13-digit-ms>-<uuid>` (60 chars).
  - Firestore-triggered workers claim a lease in `community-stats-internal/state`, rebuild from one consistent snapshot across `users`, `playthroughs`, and `campaignRuns`, and publish `ready` only when no newer outbox work exists at publish time
  - Bootstrap markers are tracked in `community-stats-internal/state` as non-PII watermarks. `pendingBootstrapMarkers` stay `{ markerId, requestedAtMs }` while a deleted marker still needs an exact ready-ack; retained `completedBootstrapMarkers` persist `{ markerId, requestedAtMs, completedAtMs }`, where `completedAtMs` is a trusted server/worker completion clock. Retention/pruning is driven only by `completedAtMs`; `requestedAtMs` remains ordering metadata and cannot extend retention.
  - Legacy completed markers missing `completedAtMs`, or carrying invalid / far-future completion data, are migrated conservatively onto one bounded completion window and then prune finitely instead of holding capacity indefinitely.
  - Retained marker state fails closed at **1,024** ids or **110 KiB** serialized UTF-8 JSON. That **110 KiB** reserve leaves **914 KiB** below Firestore’s 1 MiB document limit before encoding/property/other worker state, so the implementation treats it as a conservative marker budget rather than claiming exact remaining headroom.
  - Each publish transaction reserves two writes for `community-stats/global` and `community-stats-internal/state`, so it deletes at most **498** outbox docs per pass; larger backlogs publish `refreshState: "stale"` and are drained across retry-backed follow-up passes until current
  - If newer outbox work arrives during a rebuild, Functions publish the freshest proven snapshot as `refreshState: "stale"` and leave the newer outbox docs queued for the next pass
  - A bootstrap marker is acknowledged complete only on a schema-current `refreshState: "ready"` publish that has aggregated all work at or before that marker’s queue ordering, left no pending outbox docs, and released the active lease; later markers do not erase earlier completed ids from state, and count/size pressure fails closed instead of dropping visible ids early
  - Transient rebuild failures and lease-active skips leave the durable outbox untouched and then throw so Firestore/Eventarc `retry: true` requests another delivery with managed backoff/eventual wake-up; the scheduled Cloud Scheduler sweeper is a periodic best-effort crash / lease-expiry fallback while durable work remains queued, but persistent configuration or operational failures remain explicitly `stale` / `failed`
  - Malformed or overflowed Admin-created bootstrap outbox docs are quarantined out of the queue, recorded in `community-stats-internal/state`, leave the aggregate stale, and emit one exact manual system wake event so recovery stays bounded instead of retry-looping forever
  - Published aggregates include `schemaVersion`, `generatedAt`, `snapshotReadAt`, `sourceGeneration`, `pipelineGeneration`, and `refreshState`
  - Clients treat missing docs as unavailable, old schema as upgrade-pending, and stale/failed docs as non-current
- **Bootstrap/auth requirement:** `npm run functions:bootstrap -- --project <firebase-project-id> [--timeout-ms <= 900000]` uses Application Default Credentials (for example `gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS`), refuses project mismatches, validates the generated marker id against the strict bootstrap format above, and waits for schema version 3 plus the exact bootstrap marker in retained completed worker state, an empty outbox, no active lease, and recent `generatedAt`
- **Quarantine recovery:** Inspect `community-stats/global`, `community-stats-internal/state`, and Functions logs together; identify whether the blocker is malformed bootstrap metadata, retained-marker capacity, or another operational error; fix the underlying malformed/capacity cause; if recovery depends on retained-marker expiry, wait for the eligible completion window to pass rather than force-deleting source data; rerun bootstrap with a fresh marker; then verify the new exact marker appears in retained completed state, the outbox is empty, and backlog processing is clear. Never manually delete production playthrough/campaign source documents as a shortcut.
- **Required Firebase / GCP services:** Firestore, Cloud Functions for Firebase (v2), Eventarc/Cloud Run for Firestore triggers, and Cloud Scheduler for lease recovery. No Cloud Tasks queue is required in this implementation.
- **Firebase CLI:** `firebase-tools` v15.26.0 installed via dev dependency

## Vercel

- **Account:** `giffdev` (Vercel CLI authenticated)
- **CLI version:** 52.0.0+
- **Project:** Linked via `.vercel/project.json` in repo root
- **Auto-deploy:** Unreliable from GitHub webhooks — do NOT rely on it
- **Manual deploy command:** `npx vercel --prod --yes` (from repo root)
- **Build time:** ~12s build, ~29s total deploy
- **Environment variables:** Firebase config vars are set in Vercel dashboard (mirrors `.env`)

## Deployment Workflow

Use Node 22 for every install/build/bootstrap command. The repo pins `22.23.2` in `.nvmrc` and `.node-version`; if your host default is newer (for example Node 24), use `npx -y -p node@22 ...` for clean proof commands instead of changing global Node state.

```bash
# 0. Validate locally
npm run typecheck
npm run test:firestore
npm test
npm run build

# 1. Deploy Firestore rules + Functions first
npx firebase-tools deploy --only firestore:rules,functions --project <firebase-project-id>

# 2. Bootstrap / migrate the aggregate before shipping the client
npm run functions:bootstrap -- --project <firebase-project-id>

# 3. Verify the published aggregate
#    Expect community-stats/global to have:
#    - schemaVersion == 3
#    - refreshState == "ready"
#    - generatedAt recent
#    - pipelineGeneration == sourceGeneration
#    - and the bootstrap script to finish only after the outbox is empty and the exact marker remains present in retained completed state

# 4. Deploy the client only after bootstrap succeeds
npx vercel --prod --yes
```

Rollout order matters: deploy rules/functions, bootstrap the aggregate against the explicit target project, verify the durable queue drained and the schema-3 aggregate is ready, then deploy the web client. That avoids a window where existing site users read a legacy or transitional aggregate and the updated client has to downgrade it as stale/old-schema.
