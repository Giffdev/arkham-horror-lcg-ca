# Arkham Horror LCG Tracker

When your group returns to Carcosa after a month away, pick up the story where you left off. This play journal for *Arkham Horror: The Card Game* keeps track of the investigators you brought, the choices you made, and how each game night ended.

**[Open the tracker](https://arkham-horror-lcg-ca.vercel.app)** · [v1.1.0 release notes](https://github.com/Giffdev/arkham-horror-lcg-ca/releases/tag/v1.1.0) · [Changelog](CHANGELOG.md)

## At the table and between games

- **Keep a campaign journal.** Record a one-night mystery or follow a full campaign from its opening scenario to its final resolution. Bring up the roster and last session’s notes when it’s time to play again.
- **Explore your table’s history.** See which investigators each player keeps coming back to, look up a past campaign, or find one your group hasn’t tried yet.
- **Find inspiration for your next game.** Browse the community’s favorite campaigns, standalone scenarios, and investigators. Explore investigator pairings to see who tends to take on the mythos together.

Community rankings are public. To start a private journal for your table, sign in with Google or email and choose **Log New Campaign**.

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
