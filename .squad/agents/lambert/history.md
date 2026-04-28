# Project Context

- **Owner:** Devin Sinha
- **Project:** Arkham Horror LCG campaign playthrough tracker — logs gaming sessions with friends, tracks investigators, campaigns, player archetypes, and statistics
- **Stack:** React, Vite, TailwindCSS 4, Radix UI, TypeScript, Phosphor Icons, KV storage via Spark runtime
- **Created:** 2026-04-28

## Learnings

### 2026-04-28: Brainstorm Findings (Team Sync)

**Test Coverage Baseline: ZERO**
- No test framework configured. No vitest, jest, @testing-library/react, playwright, cypress.
- No test scripts. No `*.test.*` or `*.spec.*` files in codebase.
- **RECOMMENDATION:** Vitest + React Testing Library + MSW (Firebase mocking). [P0 — BLOCKING REFACTORING]

**P0 Tests (Highest Risk — Data Integrity):**
1. `usePlaythroughs` hook — CRUD operations. Core data layer. Silent corruption = permanent loss.
2. `PlaythroughForm` validation logic. Users can submit malformed data if validation bypassed.
3. `firestore.ts` subscription error handling. **No `onError` callback on `onSnapshot`.** [SEE BELOW]

**P1 Tests:**
- `DataExportImport` import validation. Insufficient schema validation (allows malformed archetypes, missing campaignType).
- `community-stats.ts` rebuild logic. Cross-user aggregation; race conditions possible.
- Auth flows error mapping. Custom error messages for Firebase codes.

**P2 Tests:**
- Filter logic (combined archetype + campaign type + specific campaign).
- `PlayerStats` computed statistics (complex reduce/aggregation with edge cases).

---

**Error Handling Gaps (All Critical):**

**🔴 `subscribeToPlaythroughs` — No Error Callback:**
- `firestore.ts:31` — `onSnapshot(q, (snapshot) => {...})` missing third parameter.
- Network drop, permission denied → silent failure. User sees stale data indefinitely.
- User thinks data is saving but it isn't. **HIGH RISK DATA INTEGRITY ISSUE.**
- **FIX:** Add `(error) => {handleError(error)}` callback. Propagate error to component.
- **Priority:** P0

**🔴 Auto-Migration — Only `.catch(console.error)`:**
- `App.tsx:124` — Migration failure never surfaces to user. Silent data corruption.
- Could leave data in mixed legacy/new format permanently.
- **FIX:** Add toast or error state when migration fails.
- **Priority:** P0

**🟡 No Network Status Indicator:**
- User has no idea if offline. Firebase queues writes offline but doesn't surface this.
- **FIX:** Add offline indicator in header or toast.
- **Priority:** P1

**🟡 No Retry Logic:**
- All Firestore operations fire-and-forget. If `addPlaythrough` fails due to transient network error, user gets toast and loses form input (form closes).
- **FIX:** Implement exponential backoff retry for transient errors. Persist draft if persistent failure.
- **Priority:** P1

**🟡 `rebuildCommunityStats` Error Flood:**
- Called on every playthroughs change. If Firestore security rules change, throws repeatedly on every state update.
- Floods console with errors but user doesn't see clear failure message.
- **FIX:** Rate-limit or move to Cloud Function (per architecture consensus).
- **Priority:** P1

---

**Edge Cases — Unhandled (Data Integrity):**

| Scenario | Current | Risk | Fix |
|----------|---------|------|-----|
| **Firestore `onSnapshot` error** | Silent failure | **HIGH** | Add error callback |
| **Concurrent edits** (2 tabs) | `onSnapshot` syncs, `setAll` races | **MEDIUM** | Queue mutations or detect conflicts |
| **`setAll` partial failure** | One fails, others succeed | **MEDIUM** | Rollback or skip already-updated |
| **Offline writes** | Persistence not enabled | **MEDIUM** | Enable `enableIndexedDbPersistence()` |
| **Form: Date field empty** | No validation → empty string stored | **HIGH** | Require date in form + Firestore rules |
| **Form: Rapid double-submit** | No loading state on Save button | **MEDIUM** | Add `isSaving` state, disable button |
| **Form: `setAll` writes ALL playthroughs** | Even unchanged ones updated | **MEDIUM** | Compute delta, only write changes |
| **Import: Duplicate IDs** | No deduplication logic | **HIGH** | Reject or offer merge/skip options |
| **Import: Missing `campaignType`** | Only 4 fields validated | **MEDIUM** | Validate all required fields |
| **Import: Malformed archetypes** | Not validated against union | **MEDIUM** | Validate enum values |
| **Import: 1000+ entries** | No chunking; `Promise.all` timeouts | **MEDIUM** | Batch writes with delays |

---

**Data Validation — Insufficient:**

**Form-Level (Exists):**
- Campaign required (unless Unknown/Fan-Made) ✓
- Custom campaign required for Fan-Made ✓
- At least one investigator ✓
- Player name required per investigator ✓
- Duplicate investigator check ✓
- Dream-Eaters path limit (max 4/path) ✓

**Form-Level (Missing) — HIGH PRIORITY:**
- **Date is NEVER validated.** Empty string, invalid format, absurd values (year 3000) all pass. [P0]
- Player name length not capped.
- Notes field not capped.

**Persistence Level (Missing):**
- No Firestore security rules validation. Crafted API calls can bypass form validation.
- Import validation too loose. Only checks 4 fields exist, doesn't validate types or enum values.
- No schema versioning. Data model evolves with no version marker for migration.

---

**Accessibility Gaps (User Experience):**

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| **Icon-only buttons lack `aria-label`** | Edit/Delete on PlaythroughCard | Screen readers can't name buttons | Add labels |
| **Filter buttons lack `aria-pressed`** | Filters.tsx toggle buttons | Can't announce toggle state | Add state attribute |
| **Mobile sheet "Clear All" lacks `aria-label`** | Filters.tsx:225-235 | Ambiguous for assistive tech | Add label |
| **Combobox remove "X" lacks label** | Investigator badge remover | "X" meaningless to readers | Add aria-label |
| **Cards not keyboard-focusable** | PlaythroughCard is `<div>` | Cards not announced as groups | Add tabindex? or semantic markup |
| **No skip-to-content link** | Header → main flow | Keyboard-only users tab through header every time | Add link |

**Recommended Fixes (Low Effort):**
- Add `aria-pressed` to filter toggles.
- Add `aria-label` to icon-only buttons (remove badges, edit, delete).
- Add `aria-label` to "Clear All" buttons.
- Add skip-to-content link in header.

---

**PRD Contradictions (Needs Resolution):**

**Duplicate Investigator Allowance:**
- PRD §2.3: *"Multiple players can select the same investigator"*
- Code: `PlaythroughForm.tsx:193-201` blocks duplicates with error toast.
- **Status:** NEEDS TEAM DECISION. Is PRD or code correct?

---

**Robustness Opportunities:**

| Feature | Value | Effort | Impact |
|---------|-------|--------|--------|
| **Undo delete** | Toast "Undo" action. Prevent accidental data loss. | Low | **MEDIUM** |
| **Optimistic UI + rollback** | Show changes immediately, revert on failure. | Medium | **HIGH** |
| **Form autosave / draft** | localStorage draft if accidental close during entry. | Medium | **MEDIUM** |
| **Offline indicator** | Show when writes pending. Firebase handles queue but users don't know. | Low | **LOW** |
| **Rate-limited community stats** | Debounce rebuild or move to Cloud Function. | Low-Medium | **HIGH** |
| **Data backup reminder** | Prompt users to export periodically. | Low | **LOW** |
| **Schema versioning** | Add `_schemaVersion` field. Auto-fix effect is fragile. | Medium | **MEDIUM** |
| **Conflict resolution for import** | Detect duplicates by date+campaign+investigators. Offer merge/skip/overwrite. | Medium | **MEDIUM** |
| **Debounce search inputs** | Investigator combobox filters on every keystroke. | Low | **LOW** |

---

**Top 5 Actions by Risk:**

1. **Add `onError` handler to `onSnapshot`** — users get silent data failures [P0]
2. **Validate date field** — empty/invalid dates corrupt sort and display [P0]
3. **Add submit-loading state to form** — prevents duplicate entries [P0]
4. **Resolve duplicate investigator contradiction** — PRD vs. code mismatch [P0]
5. **Set up Vitest + basic smoke tests** — no safety net exists for any refactoring [P0]

---

**Team Consensus:** Quality gaps are P0. Every architecture/feature change needs test coverage first. Error handling infrastructure (onSnapshot, form submission) is blocking reliability.

### 2026-04-28: Testing Infrastructure Established

- Installed: vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom, @vitest/coverage-v8
- Created `vitest.config.ts` — jsdom environment, `@` path alias, v8 coverage, setup file
- Created `src/test-setup.ts` — jest-dom matchers + Firebase global mocks
- Added scripts: `npm test` (run once), `npm run test:watch`, `npm run test:coverage`
- Initial test suite: **49 tests, all passing** in ~2.3s
  - `src/lib/investigator-data.test.ts` (37 tests) — covers getInvestigatorById, getInvestigatorByName, getInvestigatorsByArchetype, resolveInvestigator, getAllInvestigatorNames, isDualClassInvestigator, badge utilities, ArkhamDB URL generation, display names, dataset integrity
  - `src/components/DataExportImport.test.ts` (12 tests) — covers validation logic for import (valid/invalid JSON, missing fields, type checks, batch validation)
- Strategy: test pure logic first; component tests after refactor lands
