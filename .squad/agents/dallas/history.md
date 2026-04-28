# Project Context

- **Owner:** Devin Sinha
- **Project:** Arkham Horror LCG campaign playthrough tracker — logs gaming sessions with friends, tracks investigators, campaigns, player archetypes, and statistics
- **Stack:** React, Vite, TailwindCSS 4, Radix UI, TypeScript, Phosphor Icons, KV storage via Spark runtime
- **Created:** 2026-04-28

## Learnings

### 2026-04-28: Brainstorm Findings (Team Sync)

**Theme & Visual Polish (P0 CONFLICT TO FIX):**
- `theme.css` (Radix Colors, light-first, blue/slate) CONFLICTS with `index.css` (dark oklch system). Two competing design systems. Radix appears scaffolding remnant. DELETE or refactor to consolidate. [P0]
- No Birmingham `@font-face` declaration. Headings fall back to generic serif, breaking 1920s aesthetic. [P0]
- Flat dark purple lacks atmosphere. PRD: "cosmic mysteries by candlelight." Add subtle noise overlay or radial gradient. [P1]
- EmptyState is generic. Opportunity for thematic illustration (tentacle, Elder Sign) that rewards Arkham Horror fans. [P1]
- CampaignIcon component exists but unused in PlaythroughCard. Add icons to reinforce theme. [P1]

**Animations & Transitions (Specified in PRD):**
- Playthrough cards: no entrance animation. Add staggered fade-in + slide-in-from-bottom. [P0]
- Filter state changes: items pop in/out. Add 200ms fade transition. [P0]
- Tab content switching: add subtle cross-fade (150ms). [P0]
- Modal entry: add "opening logbook" feel with `animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300`. [P0]
- EmptyState: gentle float animation on BookOpen icon. [P0]

**Mobile UX Gaps:**
- Edit/Delete buttons use `opacity-0 group-hover:opacity-100` which fails on touch. Always visible on mobile or swipe-to-reveal. [P0]
- PRD specifies bottom sheet for form on mobile, not centered dialog. Swap `Dialog` → `Sheet` (side="bottom") on breakpoint. [P1]
- Header not sticky on mobile. "Log New Game" button unreachable. Add FAB or include "New" in bottom nav. [P1]

**UX Features (Player Impact):**
- **Keyboard shortcuts:** `Cmd/Ctrl+N` (new game), `Cmd/Ctrl+K` (search). Power user velocity. [P1]
- **Search bar:** Full-text across campaigns, players, investigators. Use installed `Command` component. [P1]
- **Campaign completion tracking:** Arkham players track win rate. Add result field (won/lost/resigned). [P1 — HIGH IMPACT]
- **Investigator portraits:** 32px avatars from ArkhamDB. Makes list scannable + delightful. [P2 — HIGH IMPACT]
- **Timeline view:** Vertical timeline showing campaign progression over time. Reinforces "reminiscing" quality. [P2]

**Accessibility (Low-Effort Wins):**
- Icon-only buttons lack `aria-label`. Edit/Delete on PlaythroughCard invisible to screen readers. [P0]
- Filter buttons lack `aria-pressed` to announce toggle state. [P1]
- Add skip-to-content link in header. Keyboard-only users shouldn't tab through header every time. [P1]

**Loading & Missing States:**
- Skeleton loaders instead of pulsing BookOpen icon for card list and community stats. Feels faster. [P0]
- Form submission: no loading indicator on Save button. Show spinner/disabled during async. [P0]
- Optimistic updates: show changes immediately, revert on failure. Currently form closes before visual confirmation. [P1]

**Other Polish:**
- Remove dead icon library `lucide-react`. ~50KB saved. Only `@phosphor-icons/react` is used. [P2]
- Radix theme conflict means colors are inconsistent. Fix theme.css → unify color system. [P0]

**Team Consensus:** Theme conflict + animation PRD gaps are P0. Accessibility + keyboard shortcuts high impact + low effort (P1).

### 2026-04-28: P0 UI Polish Fixes (Dallas)

- **Deleted `src/styles/theme.css`** — confirmed it was never imported anywhere, just dead scaffolding from Radix Colors init. Real theme lives entirely in `src/index.css` (oklch dark-first tokens) with `@theme` mapping in `main.css`.
- **Fixed mobile edit/delete** — changed from `opacity-0 group-hover:opacity-100` (broken on touch) to always-visible on mobile, hover-reveal on `md:`.
- **Added `aria-label`s** to all icon-only buttons: edit/delete in PlaythroughCard, remove investigator in PlaythroughForm, remove side story badge, and filter badge remove buttons in Filters.
- **Added `isSaving` loading state** — `App.tsx` tracks save-in-progress, passes to `PlaythroughForm` which disables the Save button and shows "Saving…" text during async.

### 2026-04-28: App.tsx Decomposition (Dallas)

- **Extracted 5 hooks** from the 627-line monolith `App.tsx`:
  - `useAuthState` — Firebase auth lifecycle + signOut
  - `useLegacyDataMigration` — one-time campaign type & investigator metadata fixer
  - `useCommunityStatsSync` — rebuilds community stats on playthrough changes
  - `usePlaythroughFilters` — filter state, toggle handlers, filtered memo
  - `usePasswordLink` — password link dialog state + handler
- **Extracted 5 components**:
  - `AppHeader` — header bar with title, new game button, user dropdown
  - `GamesTab` — games tab content (filters + card list + empty state)
  - `PlayersTab` — players tab with mobile grid + desktop sidebar + stats
  - `MobileNav` — fixed bottom nav bar for mobile
  - `PasswordLinkDialog` — password linking dialog
- **App.tsx reduced from 632 lines to ~210 lines** — now a thin orchestrator shell
- **Removed duplicate investigator validation** in PlaythroughForm.tsx (PRD allows duplicates)
- Build passes, all 49 tests pass.

### 2026-04-28: Wave 2 Completion — App.tsx Decomposition

**Status:** ✅ COMPLETE

**Scope Delivered:**
- Extracted 5 custom hooks (`useAuthState`, `useLegacyDataMigration`, `useCommunityStatsSync`, `usePlaythroughFilters`, `usePasswordLink`)
- Extracted 5 view components (`AppHeader`, `GamesTab`, `PlayersTab`, `MobileNav`, `PasswordLinkDialog`)
- Reduced App.tsx from 632 → 210 lines (67% reduction)
- Fixed duplicate investigator validation block in PlaythroughForm.tsx (now allows duplicates per PRD)

**Quality:** `npm run build` ✓ | `npm test` 49/49 pass ✓

**Impact:** Improved maintainability, isolated concerns, single responsibility per component/hook. Ready for Wave 3 (PlaythroughForm decomposition).
