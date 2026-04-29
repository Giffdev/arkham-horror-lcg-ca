# Squad Decisions

## Active Decisions

### 2026-04-28T15:27:03Z: User directive — Stability first
**By:** Devin Sinha (via Copilot)
**Status:** Active
The live site must not break. Stability is the #1 priority — existing users are actively using it. All changes must preserve current behavior.

### 2026-04-28T15:25:30Z: User directive — No new features yet
**By:** Devin Sinha (via Copilot)
**Status:** Active
Focus on refactoring, fixes, and quality only. No new features until explicitly approved.

### 2026-04-28T15:27:03Z: Campaign Outcome Tracking Reverted
**By:** Ash (Data/Performance Dev)
**Status:** Executed
Surgically reverted all outcome-related code while preserving date validation and all Wave 1/Wave 2 performance improvements. Build passes, all 89 tests pass. No data migration needed — field was optional and never shipped to production.
- Files: src/lib/types.ts, src/components/PlaythroughCard.tsx, src/components/PlaythroughForm.tsx, src/components/PlayerStats.tsx

### 2026-04-28T16:35:02.272-07:00: Stats Hooks Are Pure Computation (No Firestore Coupling)
**By:** Ash (Data/Performance Dev)
**Status:** Implemented
Built `useCompletionStats` and `useInvestigatorPairings` hooks accepting playthrough arrays as arguments — no Firestore coupling. Pure input → output, testable in isolation, no schema changes.
- Files: `src/hooks/useCompletionStats.ts`, `src/hooks/useInvestigatorPairings.ts`

### 2026-04-28T16:53:50.887-07:00: Heatmap Data Layer — Sparse Storage + Client-Side Matrix
**By:** Ash (Data/Performance Dev)
**Status:** Implemented
Community `topPairings` field now stores ALL pairs (not sliced to 10). Client reconstructs NxN matrix on demand via `buildHeatmapFromPairings()`. Created `useInvestigatorHeatmap` as separate hook, preserving `useInvestigatorPairings` untouched.
- Files: `src/hooks/useInvestigatorHeatmap.ts`, `src/lib/community-stats.ts` (removed `.slice(0, 10)`)

### 2026-04-28T16:53:50.887-07:00: Stats Panels Use Props-Driven Pattern (No New State)
**By:** Dallas (Frontend Dev)
**Status:** Implemented
Both stats panels accept `playthroughs` as prop from App.tsx, use Ash's pure `useMemo` hooks for computation. No new async state, no new API calls. Community tab now shows 3 sections: CommunityStats + CompletionStatsPanel + InvestigatorPairingsPanel.

### 2026-04-28T16:53:50.887-07:00: Heatmap UI — Dual-Layout with Mobile-First Investigator Picker
**By:** Dallas (Frontend Dev)
**Status:** Implemented
Desktop: full NxN grid heatmap with hover tooltips, row/column highlighting. Mobile: searchable investigator picker with ranked pairings. Community-first default view. Built with React + TailwindCSS (no external charting libs). oklch-based dynamic colors with 5-step legend. Full keyboard accessibility.
- Files: `src/components/InvestigatorHeatmap.tsx` (replaces `InvestigatorPairings.tsx`), `src/App.tsx`

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
