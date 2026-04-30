# Service Connections

How this project connects to GitHub, Firebase, and Vercel.

## GitHub

- **Repo:** `Giffdev/arkham-horror-lcg-ca`
- **CLI:** `gh` authenticated as `Giffdev` (active account, keyring-stored token)
- **Protocol:** HTTPS (`https://github.com/Giffdev/arkham-horror-lcg-ca.git`)
- **Scopes:** gist, read:org, repo, workflow

## Firebase (Firestore)

- **Tier:** Spark (free) — no Cloud Functions, all computation is client-side
- **Config:** Environment variables in `.env` (not committed), loaded via `import.meta.env.VITE_FIREBASE_*`
- **Config file:** `src/lib/firebase.ts`
- **Data file:** `src/lib/firestore.ts`
- **Auth:** Google Sign-In via `src/lib/auth.ts`
- **Collections:**
  - `users/{uid}` — user profile (created on first login)
  - `users/{uid}/playthroughs/{id}` — per-user game logs
  - `community-stats/global` — aggregated community statistics
- **Security rules:** Managed via Firebase Console (not CLI-deployed)
  - Users can only read/write their own `users/{uid}` doc and `playthroughs` subcollection
  - Any authenticated user can read all playthroughs (collectionGroup query for community stats)
  - `community-stats/global` is publicly readable (no auth required) and writable by any authenticated user
- **Firebase CLI:** `firebase-tools` v15.15.0 installed globally but NOT authenticated (auth was done via Console instead)

## Vercel

- **Account:** `giffdev` (Vercel CLI authenticated)
- **CLI version:** 52.0.0+
- **Project:** Linked via `.vercel/project.json` in repo root
- **Auto-deploy:** Unreliable from GitHub webhooks — do NOT rely on it
- **Manual deploy command:** `npx vercel --prod --yes` (from repo root)
- **Build time:** ~12s build, ~29s total deploy
- **Environment variables:** Firebase config vars are set in Vercel dashboard (mirrors `.env`)

## Deployment Workflow

```bash
# 1. Commit and push
git add <files>
git commit -m "feat: description"
git push origin main

# 2. Deploy to production
npx vercel --prod --yes
```

Always run both steps. Do not assume Vercel auto-deploys from GitHub pushes.
