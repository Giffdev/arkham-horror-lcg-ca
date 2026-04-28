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
