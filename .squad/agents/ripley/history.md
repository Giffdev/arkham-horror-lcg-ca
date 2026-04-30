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

### 2026-04-28: Stats Features Architecture Plan

**Task:** Architecture review + risk assessment for two new read-only analytics features (Completion Stats, Investigator Pairing Analysis).

**Key decisions:**
- Both features are pure `useMemo` computations over already-subscribed playthrough data — zero new Firestore queries for personal stats.
- Community stats extensions are optional fields added to existing `CommunityStats` interface — backward compatible with cached docs.
- No schema changes needed. `campaignType`, `campaignName`, and `investigators[]` fields already contain all necessary data.
- Pairing analysis uses combinatorial pair generation (sort-dedup pattern) — O(n*k²) is trivial for expected data sizes.
- Risk is LOW across the board. Features are additive, read-only, and can't corrupt data.

**Plan delivered to:** `.squad/decisions/inbox/ripley-stats-architecture.md`

### 2026-04-28: Arkham Horror LCG Deep Dive — Feature Brainstorm

**Game knowledge acquired:**
- AHLCG campaigns are 8-scenario narratives with branching resolutions, XP-driven deck upgrades, and persistent trauma between scenarios.
- Five investigator classes (Guardian/Seeker/Rogue/Mystic/Survivor) plus Neutral, each with distinct playstyles and deckbuilding rules.
- Each campaign has unique mechanics: Forgotten Age has supplies, Dream-Eaters splits into two parallel campaigns, Scarlet Keys has freeform map travel, Edge of the Earth has partner allies with their own trauma system.
- Community tools (ArkhamCards, Arkham.build) track: scenario results, XP, trauma, chaos bag, story assets, supplies, investigator elimination, campaign log entries.
- Our app currently tracks only: date, campaign, investigators (name + class + player), side stories, notes. No outcomes, no XP, no trauma, no difficulty, no scenario-level data.

**Brainstorm delivered:**
- 16 feature ideas across 4 tiers, each with data implications and complexity estimates.
- Key insight: 3 features are buildable TODAY with zero new fields (completion tracker, popularity rankings, group patterns). 6 simple fields unlock the entire Tier 2 analytics layer.
- Campaign outcome (1.3) was previously reverted — flagged for careful re-approach.
- Written to `.squad/decisions/inbox/ripley-arkham-deep-dive.md`.

### 2026-04-30: PRD Rewrite — Aligned to Current Codebase

**Task:** Complete rewrite of PRD.md which was severely outdated (referenced Spark runtime, KV storage, 2-tab layout).

**Key corrections made:**
- Removed all Spark/KV references. Documented actual stack: Firebase Auth + Firestore + Vercel.
- Updated from 2-tab (Games/Players) to 3-tab layout (Games/Players/Community).
- Added entirely missing features: Public Homepage, Community Stats, Completion Stats, Investigator Heatmap, Data Export/Import, Password Linking, Community Stats Sync.
- Documented actual campaign types: Full Campaign, Small Campaign, Scenario Pack (not "Standalone"), Fan-Made, Unknown.
- Added Data Architecture section documenting Firestore structure.
- Added Authentication section documenting dual-provider auth (Google + Email/Password).
- Removed Font Selection section (Birmingham font no longer in use — Tailwind defaults).
- Updated component list to reflect actual Radix primitives in use (Sheet, DropdownMenu, Toast via sonner, Skeleton states).
- Documented mobile bottom nav (MobileNav component) and responsive heatmap behavior.

**Architecture insights confirmed:**
- No routing library — single-page with tab-based navigation managed by state.
- Community stats are rebuilt client-side via `collectionGroup` query with 60s debounce — no Cloud Functions.
- Heatmap stores ALL pairings (not sliced) and reconstructs NxN matrix client-side.
- Real-time data via `onSnapshot` subscriptions.
- `useLegacyDataMigration` hook still present for backward compat.
