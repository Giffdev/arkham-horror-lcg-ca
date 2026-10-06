# Arkham Horror LCG Tracker

A web application for logging and exploring play history for *Arkham Horror: The Card Game*.

**Live app:** [arkham-horror-lcg-ca.vercel.app](https://arkham-horror-lcg-ca.vercel.app)

## What the app does

- Log standalone games, short campaigns, full campaigns, and individual scenario nights.
- Track investigators, players, dates, campaign progress, outcomes, and notes.
- Continue an active campaign while preserving its investigator roster and scenario history.
- Filter and browse your game history across desktop and mobile layouts.
- Review player statistics, investigator usage, completion progress, and investigator pairings.
- Explore community-wide campaign, investigator, class, and standalone-scenario popularity.
- Import and export tracker data for backup or migration.
- Sign in with email/password or Google through Firebase Authentication.

## Technology

- React 19 and TypeScript
- Vite
- Tailwind CSS and shadcn/ui
- Firebase Authentication and Cloud Firestore
- Vercel serverless functions for trusted community-stat aggregation
- Vitest and Testing Library

## Local development

### Prerequisites

- Node.js 22
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
| `npm run typecheck` | Type-check the frontend and backend |
| `npm run build` | Build the backend artifact and production frontend |
| `npm run preview` | Preview the production build locally |
| `npm run test:firestore:unit` | Run Firestore-related unit tests |
| `npm run test:firestore` | Run unit and emulator-backed Firestore tests |

## Deployment

The production application is hosted on Vercel. Firebase provides authentication and persistent data storage, while the community-stat endpoint publishes trusted aggregate data without exposing individual users' game logs.

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
