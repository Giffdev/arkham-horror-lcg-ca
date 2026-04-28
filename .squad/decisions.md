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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
