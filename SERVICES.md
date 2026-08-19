# Service Connections

## Runtime architecture

- **Web and trusted backend:** Vercel static hosting plus Node 22 Vercel Functions.
- **Database/auth:** Firebase Authentication and Firestore on the free Firebase plan.
- **No paid Firebase runtime:** this repository does not deploy Firebase Functions,
  Eventarc, Cloud Run, Cloud Scheduler, or Artifact Registry.
- **Trusted endpoint:** `POST /api/community-stats/process` accepts a revoked-token-
  checked Firebase ID token and only runs when that owner has durable queued work.
- **Recovery endpoint:** the same route accepts Vercel Cron `GET` requests protected
  by `CRON_SECRET`. Hobby-compatible recovery runs once daily; normal freshness comes
  from owner clients waking the endpoint immediately after committed writes.

## Data and security

- Raw source data remains under `users/{uid}/playthroughs/*` and
  `users/{uid}/campaignRuns/*`; Firestore rules allow owner access only.
- Each source transaction atomically creates
  `users/{uid}/communityStatsOutbox/{eventId}`. Clients can create only the exact,
  validated outbox schema and cannot read, update, or delete queued events.
- `community-stats/global` is public read-only aggregate data.
- `community-stats-internal/**`, `community-stats-contributions/**`, and
  `community-stats-quarantine/**` are denied to clients.
- The Vercel Function reads only the authenticated owner's raw source collections.
  It writes a compact, privacy-filtered document under
  `community-stats-contributions/{uid}` and publishes from those server-only
  contributions; ordinary client wakes never scan another user's raw records.
- The lease, bounded owner reads, contribution replacement, bounded outbox deletion,
  and aggregate publication logic lives in `backend/community-stats-contributions.ts`.
- Every Firebase Authentication account has one contribution, including accounts
  with no games. Bootstrap enumerates Auth accounts, rebuilds empty contributions,
  and removes contributions for deleted Auth accounts.
- Deterministic source failures are acknowledged into server-only quarantine without
  replacing the last valid contribution. The published snapshot reports `failed`
  until a later valid owner event clears quarantine. Firestore/runtime failures remain
  retryable, and daily recovery continues with other owners within a three-owner bound.
- Nested campaign scenario logs are flattened by the shared campaign adapter. Side
  scenarios count as game nights but do not add campaigns or progression.

## Identity

Production uses a dedicated Google service-account key stored only as encrypted,
server-only Vercel environment variables. This works with Firebase Admin and does not
require Cloud Billing, so `arkham-horror-tracker` remains on the Spark plan.
`backend/firebase-admin.ts` validates separate `FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` values, normalizes escaped
newlines, and initializes Admin with `cert()` plus an explicit project ID.

This is a pragmatic fallback, not a risk-free credential model. A service-account key
is long-lived and can be used outside Vercel if stolen. Firebase Admin also bypasses
Firestore Security Rules. IAM permissions are project-wide rather than collection-
scoped, so even a custom role can reach every document through its allowed operations.
Limit exposure through a dedicated identity, minimum permissions, production-only
Vercel scoping, rotation, audit, and immediate revocation after suspected compromise.

One-time secure configuration:

1. In Google Cloud IAM for `arkham-horror-tracker`, create a custom role containing
   only `datastore.databases.get`, `datastore.entities.get`,
   `datastore.entities.list`, `datastore.entities.create`,
   `datastore.entities.update`, `datastore.entities.delete`, and
   `firebaseauth.users.get`. The Firestore permissions cover the worker's queries,
   transactions, contribution writes, aggregate writes, and outbox deletes;
   `firebaseauth.users.get` is required by revoked-token verification. If Google
   rejects a permission for a custom role or the integration reports a missing
   permission, stop and review the exact denied operation rather than granting
   broad Editor/Owner access.
2. Create a dedicated service account such as
   `vercel-community-stats@arkham-horror-tracker.iam.gserviceaccount.com` and grant
   only that custom role. Do not grant `Editor`, `Owner`, or a Firebase-wide admin
   role. The predefined `roles/datastore.user` plus `roles/firebaseauth.viewer` may
   be used only as a documented temporary diagnostic fallback because they are
   broader than this worker needs.
3. Create one JSON key for that dedicated account. Verify its `project_id` is
   `arkham-horror-tracker`, its `client_email` is the dedicated account, and its
   private key has PKCS#8 `BEGIN PRIVATE KEY` / `END PRIVATE KEY` markers. Do not
   print or log the private key.
4. Link the Vercel project, then add each value interactively so no secret appears
   in shell history or command arguments:

   ```powershell
   npx vercel link --yes --non-interactive --team giffdevs-projects --project arkham-horror-lcg-ca
   npx vercel env add FIREBASE_PROJECT_ID production
   npx vercel env add FIREBASE_CLIENT_EMAIL production
   npx vercel env add FIREBASE_PRIVATE_KEY production --sensitive
   npx vercel env add CRON_SECRET production --sensitive
   ```

   Paste only the requested value at each prompt. `FIREBASE_PRIVATE_KEY` may be the
   original multiline PEM or use literal `\n`; the runtime accepts either. Never
   put real server values in `.env`, `.env.example`, Vercel build arguments, client
   variables, tracked files, screenshots, tickets, or logs. Delete the downloaded
   JSON key after the Vercel values are confirmed, including any recycle-bin copy.
5. Add `COMMUNITY_STATS_BACKEND_ENABLED` only to Production and keep
   `VITE_COMMUNITY_STATS_API_ENABLED=false` until verification completes. Leave
   Preview and Development without these credentials. If previews later require a
   backend, use a different Firebase project, service account, and key.

Required server-only Vercel variables:

- `COMMUNITY_STATS_BACKEND_ENABLED`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `CRON_SECRET`

All are server-only and must not use the `VITE_` prefix. The runtime requires the
service-account email's project to equal `FIREBASE_PROJECT_ID`. The separate
`COMMUNITY_STATS_FIREBASE_PROJECT_ID` variable is only for local ADC-backed release
tooling and is not a Vercel runtime credential.

Local release tooling uses Application Default Credentials and independently refuses
an authenticated-project mismatch.

After deployment, verify identity without exposing it:

1. Confirm Vercel lists all four production-only server variables and no Preview or
   Development copies. Do not use commands that print decrypted values.
2. Call the cron-protected endpoint as documented in `DEPLOYMENT.md`; this exercises
   Firestore reads/writes with the deployed certificate credential.
3. Call the owner endpoint with a valid Firebase ID token; `verifyIdToken(token, true)`
   exercises the `firebaseauth.users.get` permission. Never log the token.
4. Confirm Google Cloud audit logs attribute the operations to the dedicated service
   account and that no broader service account is used.

Rotate at a fixed interval and immediately after suspected disclosure: create a new
key on the same dedicated account, replace only `FIREBASE_PRIVATE_KEY` interactively
in Vercel Production, redeploy, repeat both identity checks, then disable and delete
the old key. If compromise is suspected, disable/delete the exposed key first,
disable the backend/client wake flags until redeployed, inspect audit logs, and issue
a fresh key. Never keep two valid keys longer than the verification window.

## Client rollout flag

`VITE_COMMUNITY_STATS_API_ENABLED=false` disables client wake requests while retaining
the durable outbox. Set it to `true` only after the backend deployment and bootstrap
are verified. A failed request never rolls back or invalidates the user's source write.

## Commands

```powershell
npm run typecheck
npm run backend:test
npm run test:firestore
npm test
npm run build
```

See `DEPLOYMENT.md` for the two-pass Vercel rollout, read-only source fingerprints,
bootstrap gates, and rollback procedure.
