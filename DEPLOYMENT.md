# Deployment

This app is **not** deployed by pushing to GitHub. There is no CI/CD pipeline and
GitHub Pages is disabled. The live site is published by **manually deploying to
Vercel** from your local machine after each change.

> Historical note: this repo started from a GitHub Spark template, but Spark is no
> longer used for deployment.

## Live URLs

- Production: https://arkham-horror-lcg-ca.vercel.app
- Vercel project: `giffdevs-projects/arkham-horror-lcg-ca`

## Prerequisites

- [Vercel CLI](https://vercel.com/docs/cli) installed (`npm i -g vercel`).
- Authenticated: `vercel login` (one-time).
- The repo is already linked to the Vercel project via the committed `.vercel/`
  directory (`project.json` holds the `projectId` / `orgId`).

## Deploy workflow (run for every change)

1. Commit and push your source changes to `main`:

   ```sh
   git add <files>
   git commit -m "<message>"
   git push origin main
   ```

2. Deploy the current working tree to production:

   ```sh
   vercel --prod --yes
   ```

   The CLI builds the app (`npm run build` → `vite build`) on Vercel's build
   machines and publishes the output. On success it prints the production URL and
   aliases it to `https://arkham-horror-lcg-ca.vercel.app`.

That's it — the change is live once the command reports `Aliased: …`.

## Notes

- `git push` alone does **not** deploy. The `vercel --prod` step is required every
  time you want changes to appear on the live site.
- Deploying uses your local working tree, so make sure it matches what you pushed
  (deploy after committing to avoid publishing uncommitted or stale code).
- To preview without going to production, run `vercel` (no `--prod`) for a
  throwaway preview URL.
