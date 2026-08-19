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
- `community-stats-internal/**` and `community-stats-contributions/**` are denied to clients.
- The Vercel Function reads only the authenticated owner's raw source collections.
  It writes a compact, privacy-filtered document under
  `community-stats-contributions/{uid}` and publishes from those server-only
  contributions; ordinary client wakes never scan another user's raw records.
- The lease, bounded owner reads, contribution replacement, bounded outbox deletion,
  and aggregate publication logic lives in `backend/community-stats-contributions.ts`.
- Nested campaign scenario logs are flattened by the shared campaign adapter. Side
  scenarios count as game nights but do not add campaigns or progression.

## Identity

Production uses Vercel OIDC plus Google Workload Identity Federation. No service
account private key is stored in Vercel.

The worker intentionally retains Firebase Admin's Firestore client instead of hand-
implementing Firestore REST transactions. This is a supported credential path, not
an assumed one: Vercel officially documents `ExternalAccountClient` with its OIDC
subject-token supplier (`https://vercel.com/docs/oidc/gcp`), and Firebase Admin's
official `Credential` contract accepts any implementation returning a Google OAuth
access token (`https://firebase.google.com/docs/reference/admin/node/firebase-admin.credential`).
`backend/firebase-admin.ts` implements exactly that contract. Firestore REST remains
a fallback if an integration deployment disproves this documented path. Reimplementing
Firestore value encoding, transactional preconditions, and retry semantics over REST
would add avoidable correctness risk without improving the short-lived identity model.
Client wakes stay disabled until the documented Admin/OIDC integration check succeeds.

One-time secure configuration:

1. In Vercel project **Settings → Security**, enable team-mode OIDC.
2. In the Firebase project's Google Cloud console, enable IAM Service Account
   Credentials and Security Token Service APIs.
3. Create a workload identity pool/provider with issuer
   `https://oidc.vercel.com/<team-slug>`, map `google.subject=assertion.sub`, and
   use the provider's default Google audience.
4. Create a dedicated service account with `roles/datastore.user` and
   `roles/firebaseauth.viewer` (needed for revoked-token checks). Do not create a
   key for it.
5. Grant `roles/iam.workloadIdentityUser` on that service account only to the
   exact production subject:
   `owner:<team-slug>:project:<vercel-project-name>:environment:production`.
   Do not grant the whole pool.
6. Put the non-secret project/pool/service-account identifiers below in Vercel
   production variables. Generate `CRON_SECRET` with a password manager or
   cryptographically secure random generator and store it as a sensitive,
   server-only Vercel variable.
7. Keep preview/development subjects untrusted unless a separate non-production
   Firebase project is intentionally configured.

Required server-only Vercel variables:

- `COMMUNITY_STATS_BACKEND_ENABLED`
- `COMMUNITY_STATS_FIREBASE_PROJECT_ID`
- `GCP_PROJECT_ID`
- `GCP_PROJECT_NUMBER`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- `GCP_WORKLOAD_IDENTITY_POOL_ID`
- `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`
- `CRON_SECRET`

`GCP_PROJECT_ID` must exactly equal `COMMUNITY_STATS_FIREBASE_PROJECT_ID`. Google IAM
must restrict workload identity impersonation to this Vercel project and environment.
The service account needs only Firestore/Admin SDK access required by the worker and
Firebase Auth token verification.

Local release tooling uses Application Default Credentials and independently refuses
an authenticated-project mismatch.

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
