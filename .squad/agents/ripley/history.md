# Project Context

- **Owner:** Devin Sinha
- **Project:** Arkham Horror LCG campaign playthrough tracker — logs gaming sessions with friends, tracks investigators, campaigns, player archetypes, and statistics
- **Stack:** React, Vite, TailwindCSS 4, Radix UI, TypeScript, Phosphor Icons, KV storage via Spark runtime
- **Created:** 2026-04-28

## Learnings

### 2026-04-28: Brainstorm Findings (Team Sync)

**Cross-team architecture consensus:**
- `App.tsx` (627 lines) is a god component. Decompose into `GamesView`, `PlayersView`, `CommunityView`, `AppLayout`, `useAuthState`. [P1]
- `PlaythroughForm.tsx` (~700 lines) should split into `CampaignSelector`, `InvestigatorRow`, `SideStoriesSection`, `PlaythroughFormShell`. [P1]
- **Community stats rebuilds on every client mutation via collectionGroup query.** All agents consensus: move to Cloud Function. [P0 — HIGH IMPACT]
- Legacy auto-fix migration may loop on snapshots. Guard needed or remove entirely. [P0 — DATA INTEGRITY]
- `PlaythroughCard` needs `React.memo` to prevent re-render jank with 100+ items. [P1]
- No virtualization for long lists. Add `react-window` when count > 50. [P2]
- No code splitting. Lazy-load `PlaythroughForm`, `CommunityStats`, `PublicHomepage`. [P2]
- Only root error boundary. Add granular boundaries for `CommunityStats`, `PlaythroughForm`, each tab. [P2]
- No loading states for mutations. Add `isSaving`/`isDeleting` flags to prevent double-submit. [P0]

**Team flagged:** Firestore `onSnapshot` has no error callback. Network/permission errors are silent. [P0]

**Cross-agent alignment:** 6 items consensus (stats CF, app split, form decomp, migration, theme conflict, date validation).

**Next:** Prioritize P0 fixes before architecture refactoring. Confirm community stats CF approach with team.

### 2026-04-28: Wave 2 Decisions & Decomposition Plans

**Decisions made:**
- **Duplicate investigators:** Allow them. PRD explicitly permits; code block was a spec violation. Remove the check in PlaythroughForm.tsx lines 193-201.
- **Community stats strategy:** Client-side debounced rebuild (60s cooldown) + optimistic bump. NO Cloud Functions — none exist in project, premature to add. Revisit at 1000+ users.

**Decomposition plans delivered:**
- `App.tsx` → 5 hooks (`useAuthState`, `useLegacyDataMigration`, `useCommunityStatsSync`, `usePlaythroughFilters`, `usePasswordLink`) + 5 components (`AppHeader`, `GamesTab`, `PlayersTab`, `MobileNav`, `PasswordLinkDialog`)
- `PlaythroughForm.tsx` → 4 hooks (`usePlaythroughFormState`, `useInvestigatorList`, `useSideStories`, `useFormValidation`) + 4 components (`CampaignSection`, `SideStoriesSection`, `InvestigatorSection`, `InvestigatorRow` file move)

**Key learnings:**
- No `firebase.json` or `functions/` directory exists. Any Cloud Functions would be entirely new infrastructure.
- The brainstorm consensus on "move to Cloud Function" was premature — team didn't check if infra existed. Pragmatic debounce is the right call now.
- PlaythroughForm's `InvestigatorRow` is already self-contained at 225 lines — just needs file extraction, no logic changes.

### 2026-04-28: Wave 1 Completion — Inbox Merged, Decisions Archived

**Scribe consolidation:**
- All 4 inbox files merged into decisions.md (ripley-duplicate-investigators.md, ripley-community-stats-strategy.md, ripley-app-decomposition-plan.md, ripley-form-decomposition-plan.md)
- Old decisions.md (28.4 KB) archived to `.squad/decisions/archive/decisions-20260428T151906Z.md`
- Fresh decisions.md (5.1 KB) now canonical
- Orchestration log created
- Session log created

**Wave 1 agent outcomes:**
- **ash-1:** Data layer bugs fixed (removed redundant stats rebuilds, gated migration, added error handler)
- **lambert-1:** Vitest + 49 smoke tests baseline established
- **dallas-1:** UI polish completed (removed theme.css, fixed mobile, added aria-labels, save loading state)
- **ripley-1:** Decisions + decomposition plans finalized (duplicate investigator decision, stats strategy, app/form extraction plans)

**Ready for Wave 2:** All extraction plans documented, priority ranking established, Dallas has clear implementation path for App.tsx + PlaythroughForm refactoring.
