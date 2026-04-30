---
last_updated: 2026-04-30T09:42:57.577Z
---

# Team Wisdom

Reusable patterns and heuristics learned through work. NOT transcripts — each entry is a distilled, actionable insight.

## Patterns

- **Pattern:** Counter-based aggregation avoids cross-user reads. **Context:** When security rules prevent reading all user docs, maintain counters (e.g., registeredUsers) that get incremented on write events instead.

- **Pattern:** Firebase security rules can't be deployed via CLI on Spark tier without full auth setup — guide user through Console instead. **Context:** When Firebase CLI isn't authenticated and project is on Spark tier.

- **Pattern:** Community/public stats should use `allow read: if true` in Firestore rules to support unauthenticated landing pages. **Context:** When you want to show aggregate stats to entice sign-ups.
