# Arkham Horror LCG Tracker

A web application for logging and exploring play history for *Arkham Horror: The Card Game*.

**[Open the tracker](https://arkham-horror-lcg-ca.vercel.app)** · [v1.1.0 release notes](https://github.com/Giffdev/arkham-horror-lcg-ca/releases/tag/v1.1.0) · [Changelog](CHANGELOG.md)

## Using the tracker

Sign in with email/password or Google to keep your own play history. You can also browse community rankings on the homepage without signing in.

- **All Games:** Log a campaign or standalone game, then record scenario nights with dates, investigators, XP, trauma, outcomes, and notes. Expand a campaign to revisit its scenarios or continue from its current roster. On portrait tablets, player and investigator names have the full card width instead of sharing a narrow column with the action buttons.
- **Players:** Explore investigator use and campaign history for the whole group or one player. Search the Played and Not Played lists, then expand a played entry to see its recorded games.
- **Community:** Browse campaign, investigator, class, and standalone-scenario rankings. Standalone breakdowns distinguish games played on their own from side stories played within campaigns.
- **Backups:** Choose **Export Data** in the profile menu to download your campaign runs and playthroughs as JSON. Import tools still support older backups, but the normal profile menu does not offer an import action.

### Reading your campaign history

An older whole-campaign log counts as played for its recorded participants even if it has no individual scenario logs. **Scenario progress not tracked** means the tracker has no scenario details to show; it does not infer completion or award XP. Starting a new campaign without logging a game night does not count as a play.

Side-story entry guidance shows published costs separately from XP earned. It does not deduct XP, mark it as paid, or rewrite saved logs. Unknown costs are labeled, and conditional costs are explained where relevant. For *Fortune and Folly* and *Guardians of the Abyss*, choose the individual scenario under its group heading; the second scenario can also be logged directly.

## Technology

- React 19 and TypeScript
- Vite
- Tailwind CSS and shadcn/ui
- Firebase Authentication and Cloud Firestore
- Vercel serverless functions for trusted community-stat aggregation
- Vitest and Testing Library

## Local development

### Prerequisites

- Node.js 22 (see [`.nvmrc`](.nvmrc) for the pinned version)
- npm
- A Firebase project with Authentication and Cloud Firestore enabled

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/Giffdev/arkham-horror-lcg-ca.git
   cd arkham-horror-lcg-ca
   ```

2. Install dependencies:

   ```bash
   npm ci
   ```

3. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

4. Add your Firebase web-app configuration to `.env.local`.

5. Start the development server:

   ```bash
   npm run dev
   ```

Vite prints the local URL when the server starts.

## Environment configuration

The client requires the `VITE_FIREBASE_*` values documented in [`.env.example`](.env.example).

`VITE_COMMUNITY_STATS_API_ENABLED` controls whether the browser wakes the community-stat processing endpoint. The server-only community-stat variables are needed only when running or deploying that backend; do not expose service-account credentials through `VITE_*` variables.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm test` | Run the Vitest suite |
| `npm run typecheck` | Type-check the frontend and backend; flag unused locals and parameters in the frontend app |
| `npm run build` | Build the backend artifact and production frontend |
| `npm run preview` | Preview the production build locally |
| `npm run test:firestore:unit` | Run Firestore-related unit tests |
| `npm run test:firestore` | Run unit and emulator-backed Firestore tests |

## Deployment

The production application is deployed manually to Vercel; pushing a commit or publishing a GitHub release does not deploy the site. Firebase provides authentication and persistent data storage, while the community-stat endpoint publishes aggregate statistics without exposing individual users' game logs.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the deployment architecture, required server configuration, bootstrap process, and operational checks.

## Contributing

Issues and pull requests are welcome. Before submitting a change, run the most relevant tests along with:

```bash
npm run typecheck
npm run build
```

## Disclaimer

This is an unofficial fan-made tracker. *Arkham Horror: The Card Game* and related names and artwork belong to their respective owners. This project is not affiliated with or endorsed by Fantasy Flight Games.

## License

This repository is available under the [MIT License](LICENSE).
