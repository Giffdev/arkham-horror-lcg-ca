# Project Context

- **Owner:** Devin Sinha
- **Project:** Arkham Horror LCG campaign playthrough tracker — logs gaming sessions with friends, tracks investigators, campaigns, player archetypes, and statistics
- **Stack:** React, Vite, TailwindCSS 4, Radix UI, TypeScript, Phosphor Icons, KV storage via Spark runtime
- **Created:** 2026-04-28

## Learnings

### 2026-04-28: Brainstorm Findings (Team Sync)

**State Management & Prop Drilling:**
- `AuthenticatedApp` owns 13 `useState` hooks (filters, modals, form state) with prop drilling 2 levels deep. Extract into `useFilters()` hook + lightweight context for `playthroughs` + `currentUser`. [P1]
- No shared state between tabs; `CommunityStats` re-fetches on mount. Opportunity for caching layer (useSWR/React Query). [P2]
- Duplicate player name extraction in two separate `useMemo` blocks. Consolidate. [P3]

**Data Model Issues (Architecture + Integrity):**
- **CRITICAL: Player names denormalized as strings inside playthroughs.** No `players` collection. Renaming player requires updating every playthrough. Add `players` subcollection with IDs. [P2 — HIGH IMPACT]
- `InvestigatorAssignment` overloaded with 11 optional fields (legacy `archetype` + current `archetypes`, custom investigators, unknown markers, dream-eaters paths). [P3 — REFACTOR LATER]
- Campaign identity string-based with no ID reference. Brittle for foreign key constraints. [P2]
- No `createdAt`/`updatedAt` timestamps. Only user-entered `date` field. Blocks "recently added" sorting, conflict detection, audit trails. [P2]

**Performance Audit (Critical Consensus Across All Agents):**

**🔴 HIGHEST PRIORITY — Community Stats Rebuild Loop:**
- `rebuildCommunityStats()` calls `getAllPlaythroughs()` which does **collectionGroup query across ALL users' data** on every single local playthrough change.
- With 100 users × 20 playthroughs = 2000 Firestore reads per user mutation. O(n) on platform data. Unsustainable.
- Fires on auth change, save, delete, AND every snapshot update (already redundant from useEffect).
- **DECISION: Move to Cloud Function triggered on `playthroughs` write. Client only reads pre-computed `community-stats/global`.** [P0 — ELIMINATE THOUSANDS OF READS]

**🔴 Auto-Migration Write Loop:**
- Legacy auto-fix (lines 84-126 of App.tsx) re-runs on every playthroughs change. If it writes, triggers snapshot → re-triggers effect. No guard to prevent re-running after fix. [P0 — DATA INTEGRITY]
- Solution: Add `migrationVersion` field to each playthrough. Skip already-migrated docs. OR run once per session with ref flag.

**🟡 `setAll` Callback Issues:**
- Recreates on every `playthroughs` change since it depends on it in closure. More importantly, writes ALL playthroughs back, not just changed ones. [P1]
- Should compute delta and only write changed documents.

**🟡 No Virtualization:**
- All `filteredPlaythroughs` render at once. With 50+ playthroughs, each with resolved investigators, expensive DOM. Add `react-window` when > 50. [P2]

**🟡 `resolveInvestigator` Called Repeatedly:**
- Called per-investigator per-render in PlaythroughCard, PlayerStats, migration effect. No memoization. Function is O(1) Map lookup (good) but surrounding object spreads add up. [P1]

**Bundle & Dependencies:**
- Firebase SDK ~100KB gzipped (dominant, but necessary).
- `date-fns` installed but only `formatDate` used. Replace with `Intl.DateTimeFormat` (native, no dep). [P2]
- `lucide-react` unused (~50KB). Only `@phosphor-icons/react` used. [P2]

**Hook Quality Assessment:**
- `usePlaythroughs`: Abstraction B+, loading B, error D (all errors thrown), memoization C, offline F.
- Missing: `useDebounce`, `useCommunityStats`, `useAuth`.
- Recommend: Extract hook logic, add error state alongside loading, enable offline persistence.

**Recommendations (Priority 1 — Foundation):**
1. **Move community stats to Cloud Function.** Eliminates thousands of redundant reads. [P0]
2. **Gate legacy migration** with `migrationVersion`. Skip already-migrated. Run once per session. [P0]
3. **Enable Firestore offline persistence** (`enableIndexedDbPersistence(db)`). Instant loads, offline support, reduced reads. [P2 — QUICK WIN]
4. **Remove duplicate `rebuildCommunityStats` calls.** useEffect already handles it. [P0]

**Recommendations (Priority 2 — Data Architecture):**
5. **Add `players` subcollection per user.** Enable player rename, player-specific stats without scanning all playthroughs. [P2]
6. **Add `createdAt`/`updatedAt` timestamps** to Playthrough schema. [P2]

**Recommendations (Priority 3 — Features):**
7. **Data export versioning:** Wrap in `{ version: 1, exportedAt, data }` for future migrations. [P3]
8. **Search/filter by player name.** (Exists on Players tab, missing from Games tab.) [P1]
9. **Playthrough outcome tracking** (win/lost/resigned). Core Arkham mechanic. [P1 — HIGH IMPACT]
10. **Virtualized list rendering** when playthrough count > 30. Measure first. [P2]

**Scaling Projections:**
- 10-30 playthroughs: smooth.
- 50-100: noticeable jank.
- 200+: degraded (filter useMemo re-scans full array).
- 500+: broken (community stats untenable, collectionGroup query of 500+ docs across all users).

**Scaling Solutions:**
- Pagination/infinite scroll with server-side cursor.
- Aggregate counters maintained by Cloud Functions (not client-side).
- Indexed Firestore composite queries (campaign+date, archetype+date).
- Client-side caching (useSWR/React Query) on tab switches.

**Team Consensus:** Community stats → Cloud Function is P0 across all agents. Data integrity (migration, validation) next.

### 2026-04-28: P0 Data Layer Fixes Applied

- **Removed redundant `rebuildCommunityStats` calls** from `handleSavePlaythrough` and `handleDeletePlaythrough`. The `useEffect([playthroughs])` already handles rebuild on snapshot updates.
- **Gated legacy migration** with `useRef(hasMigratedRef)` — runs once per session, prevents write-loop via Firestore snapshots re-triggering the effect.
- **Added `onError` handler to `onSnapshot`** in `subscribeToPlaythroughs`. Hook now exposes `error` state (4th tuple element). On error: clears stale data, logs, and surfaces error to consumers.
- **`lucide-react` is NOT dead** — used by 19 shadcn/ui components. Left in place.

### 2026-04-28: Performance Improvements Applied

- **React.memo on PlaythroughCard** — Wrapped in `memo()` to skip re-renders when parent filter/tab state changes. Props are stable (playthrough objects from snapshot, stable callbacks via `setDeleteId`/`handleEdit`).
- **60-second debounced community stats rebuild** — Replaced aggressive `useEffect([playthroughs])` fire-on-every-change with a `useRef`-based cooldown. Fires immediately on first change, then at most once per 60s. Implements Ripley's decision from `ripley-community-stats-strategy.md`.
- **Delete loading state** — Added `isDeleting` state to disable AlertDialog buttons during async delete, preventing double-clicks. Matches Dallas's pattern for `isSaving`.
- **Consolidated duplicate player computation** — Removed separate `knownPlayerNames` and `allPlayers` useMemo blocks. Single `allPlayers` useMemo now serves both the PlaythroughForm (knownPlayerNames prop) and the Players tab.

### 2026-04-28: Campaign Outcome Tracking Feature

- **Added `CampaignOutcome` type** to `src/lib/types.ts`: `'win' | 'loss' | 'resign' | 'incomplete'`. Optional field on `Playthrough` interface for backward compatibility.
- **PlaythroughForm**: Added RadioGroup-based "Outcome" section (only visible for Full Campaign type). Added date validation — rejects empty or future dates with inline error + toast.
- **PlaythroughCard**: Shows themed outcome badge (green/red/amber/gray) next to campaign type badge in both mobile and desktop layouts. No badge shown when outcome is undefined.
- **PlayerStats**: History tab now includes outcome badge on each campaign entry.
- Uses existing Radix `RadioGroup` component from `src/components/ui/radio-group.tsx`.
- `OUTCOME_STYLES` constant shared pattern between PlaythroughCard and PlayerStats (defined locally in each to avoid circular deps).

### 2026-04-28: Wave 2 Completion — React.memo + Performance Optimizations

**Status:** ✅ COMPLETE

**Scope Delivered:**
- Applied `React.memo()` to `PlaythroughCard` component (eliminates unnecessary re-renders from parent filter/tab changes)
- Implemented 60-second debounced community stats rebuild with in-memory cooldown (per Ripley's strategy decision)
- Added `isDeleting` loading state to delete alert dialog (prevents double-click mutations)
- Consolidated duplicate player name computation into single `allPlayers` useMemo

**Perf Impact:** 
- PlaythroughCard re-renders now guarded by prop shallowness check
- Community stats reads reduced from "every mutation × all docs" to "once per 60s max"
- Delete UX improved (visual feedback during async operation)

**Quality:** Fully integrated with Dallas's App.tsx decomposition. All 49 tests pass.

**Impact:** Significant Firestore read cost reduction + improved perceived responsiveness.

### 2026-04-28: Campaign Outcome Tracking Reverted (Stability Priority)

- **Reverted `CampaignOutcome` type** and `outcome` field from Playthrough interface in `src/lib/types.ts`
- **Removed OUTCOME_STYLES** constants from PlaythroughCard and PlayerStats
- **Removed RadioGroup outcome selector** from PlaythroughForm (including import, state, reset logic, and save logic)
- **Removed outcome badges** from PlaythroughCard (both mobile and desktop layouts) and PlayerStats history tab
- **Kept date validation** (form hardening, not a feature) per Ripley's review
- **Kept all Wave 1/Wave 2 changes** (React.memo, debounced stats, isDeleting, consolidated player computation)
- Build passes, all 89 tests pass. No test modifications needed — feature was cleanly isolated.
- **Lesson:** Don't ship features during a stability freeze, even high-impact ones. Outcome tracking can return when the team is ready for feature work.

### 2026-04-28: Data Computation Hooks (Completion Stats + Investigator Pairings)

**Status:** ✅ COMPLETE

**Scope Delivered:**
- `useCompletionStats` hook — counts total playthroughs and breaks down by CampaignType (Full Campaign, Small Campaign, Scenario Pack, Fan-Made). Supports both personal and community playthrough arrays.
- `useInvestigatorPairings` hook — computes C(N,2) pairings from each playthrough's investigators array. Returns top-N pairs sorted by frequency. Supports personal + community data.

**Design Decisions:**
- Pure computation hooks — no Firestore reads, no schema changes. Consumers pass playthrough arrays in.
- `useMemo` on both personal and community computations, keyed on playthrough array reference.
- Pair key uses alphabetical ordering (`a|||b`) for stable deduplication.
- Filters out `isUnknown` and empty investigator names (matches community-stats.ts pattern).
- `topN` parameter defaults to 10, configurable by consumer.
- All types exported for Dallas to use in UI components.

**Performance Notes:**
- With ~27 playthroughs and ~3 investigators each: ~81 pair computations max. Trivial.
- At 500 playthroughs × 4 investigators = ~3000 pairs. Still sub-millisecond with Map-based counting.
- useMemo ensures no recomputation unless playthrough array reference changes.

### 2026-04-28: Investigator Heatmap Data Layer (Co-occurrence Matrix)

**Status:** ✅ COMPLETE

**Scope Delivered:**
- `useInvestigatorHeatmap` hook (`src/hooks/useInvestigatorHeatmap.ts`) — computes a full co-occurrence matrix from playthroughs. Returns `HeatmapData { investigators, matrix, maxCount }`.
- `buildHeatmapFromPairings()` utility — converts flat pair lists (personal or community) into the symmetric matrix format. Reusable by both personal and community data paths.
- Updated `community-stats.ts` — `topPairings` now stores ALL pairs (removed `.slice(0, 10)`). Client reconstructs heatmap matrix from the full pair list using `buildHeatmapFromPairings`.
- Existing `useInvestigatorPairings` hook untouched — backward compatible, `InvestigatorPairings` component continues to work.
- Full test coverage: 13 tests for heatmap hook + utility (empty input, 2x2, accumulation, symmetry, maxCount, filtering, 4x4).

**Design Decisions:**
- Chose Option B for community storage: store all pairs in sparse format (`CommunityPairing[]`), reconstruct matrix client-side. More storage-efficient and backward-compatible vs storing full NxN matrix.
- Separate hook (`useInvestigatorHeatmap`) rather than bolting onto existing hook — cleaner separation of concerns, no risk to existing consumers.
- `buildHeatmapFromPairings` is a pure function (not a hook) so Dallas can use it in community heatmap without needing raw playthroughs.

**Performance Notes:**
- ~60 investigators max → ~1800 non-zero pairs worst case → ~3600-cell matrix. Trivial computation.
- Single `useMemo` keyed on playthroughs array reference. No recomputation on re-renders.
