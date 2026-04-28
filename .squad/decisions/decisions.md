# Decisions Log

**Last Updated:** 2026-04-28T15:12:33Z

---

## 2026-04-28: Architecture Deep Dive — Decomposition Plans, Stats Strategy, Duplicate Investigators

### Decision: Duplicate Investigator Selection (DECIDED)

**Author:** Ripley (Lead)  
**Date:** 2026-04-28  
**Status:** DECIDED

The PRD explicitly states: "Duplicate investigators: Multiple players can select the same investigator (helpful for tracking different builds or repeated favorites)"

However, `PlaythroughForm.tsx` (lines 193-201) blocks duplicate investigators with a validation check and error toast.

**Decision:** Allow duplicate investigators. Remove the duplicate check entirely.

**Rationale:**
1. The PRD is the product spec. The code contradicts the spec.
2. The use case is real: players replay favorites, try different builds, or track multiple copies in past games.
3. This is a *tracker*, not a game rules enforcer.
4. The duplicate block was likely a well-intentioned guard that didn't check the spec.

**Implementation:** Remove lines 193-201 in `PlaythroughForm.tsx` (the duplicate check and toast).

---

### Plan: App.tsx Decomposition (FOR WAVE 2)

**Author:** Ripley (Lead)  
**Date:** 2026-04-28  
**For:** Dallas (implementation in Wave 2)

`src/App.tsx` is 627 lines containing auth state, migration logic, community stats, filters, CRUD handlers, and layout.

**Extraction Plan:**

**Phase 1: Custom Hooks**
- useAuthState — auth subscription, sign-out
- useLegacyDataMigration — campaign type/investigator metadata fixes
- useCommunityStatsSync — cooldown timer, rebuild trigger logic
- usePlaythroughFilters — filter state + filtered results memo
- usePasswordLink — password link dialog state

**Phase 2: Components**
- AppHeader — header bar, New Game, user dropdown
- GamesTab — games list + filters + empty state
- PlayersTab — player grid + sidebar stats
- MobileNav — fixed bottom nav bar
- PasswordLinkDialog — password link dialog

**Phase 3: Simplified AuthenticatedApp**
~80 lines orchestrating the hooks and components.

**Extraction Order:** useAuthState → useLegacyDataMigration → usePlaythroughFilters → usePasswordLink → useCommunityStatsSync → MobileNav → AppHeader → PasswordLinkDialog → GamesTab → PlayersTab

---

### Plan: PlaythroughForm.tsx Decomposition (FOR WAVE 2)

**Author:** Ripley (Lead)  
**Date:** 2026-04-28  
**For:** Dallas (implementation in Wave 2)

`src/components/PlaythroughForm.tsx` is 729 lines containing form logic and InvestigatorRow.

**Extraction Plan:**

**Phase 1: Custom Hooks**
- usePlaythroughFormState — all form field state (campaign, date, investigators, side stories, notes)
- useInvestigatorList — investigators array state + handlers
- useSideStories — side stories state + handlers
- useFormValidation — validation logic + data assembly (testable)

**Phase 2: Components**
- CampaignSection — campaign type + name picker + fan-made input
- SideStoriesSection — collapsible side stories + checkboxes
- InvestigatorSection — investigators header + list
- InvestigatorRow — move to own file (already self-contained)

**Phase 3: Simplified PlaythroughForm**
~60 lines orchestrating hooks and components.

**Extraction Order:** InvestigatorRow → useSideStories → useInvestigatorList → usePlaythroughFormState → useFormValidation → SideStoriesSection → CampaignSection → InvestigatorSection

---

### Decision: Community Stats Computation Strategy (DECIDED)

**Author:** Ripley (Lead)  
**Date:** 2026-04-28  
**Status:** DECIDED

**Context:** `rebuildCommunityStats()` runs a full `collectionGroup` scan of ALL users' playthroughs on every client mutation. Cost: O(N) reads per mutation.

**Current Issues:**
- Fires on auth state change, playthrough list change, save/delete (with 500ms delay)
- No Firebase Functions infrastructure exists
- At scale (100 users × 20 playthroughs), each mutation = 2000 reads

**Options Considered:**
1. Cloud Function on write — perfect accuracy, requires infra
2. Client-side debounced rebuild — simple, breaks at scale
3. Hybrid: optimistic bump + periodic rebuild — already partially implemented

**Decision:** Client-side debounced rebuild with cooldown + optimistic bump. No Cloud Functions now.

**Implementation:**
1. Keep `bumpCommunityStats()` as primary post-mutation path (1 read + 1 write)
2. Run `rebuildCommunityStats()` only when:
   - User signs in (once per session)
   - Cached `lastUpdated` older than 60s AND user navigates to Community tab
3. Remove aggressive triggers: no rebuild on every playthroughs change, no rebuild after save/delete
4. Add in-memory cooldown (60s minimum between full rebuilds per client)

**Rationale:**
- No Firebase Functions infra — premature to add for this one feature
- Current problem is excessive triggers, not lack of Cloud Functions
- With debounce + bump: reads drop from "every mutation × all docs" to "once per session + once per 60s max"
- Scale later (1000+ users) — add Cloud Function then
