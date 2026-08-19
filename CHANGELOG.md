# Changelog

All notable user-facing changes to this project are documented here.

This project follows the spirit of [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed

- **Community statistics bootstrap now uses Firestore-safe control IDs.** The final
  aggregate publish lease uses the centralized strict ASCII marker
  `bootstrap-publisher` instead of Firestore's reserved `__...__` document-ID format.

- **Vercel owner authentication is Node 22 compatible.** The backend now verifies
  Firebase ID tokens directly with Google's fixed Secure Token JWKS, an explicit
  RS256/issuer/audience contract, and disabled/revoked-user checks. The incompatible
  `firebase-admin`/`jwks-rsa` runtime chain has been removed.

- **Community statistics now run on the existing Vercel deployment without paid
  Firebase services.** Owner writes still atomically enqueue durable Firestore work,
  while a Firebase-authenticated Vercel Function publishes the
  server-owned aggregate. Each wake rebuilds only that owner's bounded, privacy-
  filtered contribution instead of rescanning every user's raw records. Raw user
  documents remain owner-only. Empty registered accounts remain represented,
  transient failures remain retryable, deterministic bad-owner work is quarantined
  without replacing valid totals, and bounded daily free-tier recovery continues to
  other owners.

- **"Most Popular Campaigns" no longer includes Scenario Pack one-shots.**
  Scenario Pack playthroughs (e.g. Curse of the Rougarou) are excluded from the campaigns
  ranking; they now appear in the dedicated "Most Played Standalones" card instead.
  Full campaigns, small campaigns, Return To campaigns, and fan-made entries continue to count.
  This changes what is visible in the campaigns card for any community that has logged
  Scenario Pack plays.

### Added

- **Standalone popularity card now shows real data.** Scenario Pack plays are counted
  whether logged as their own playthrough (`asStandalone`) or slotted as a side story in a
  longer campaign (`asSideStory`). The combined count and breakdown are persisted per scenario.

- **Side-scenarios card now shows real data.** All `sideStories[]` entries are aggregated,
  including custom free-text values. Names are normalised for deduplication (trim / lowercase /
  collapsed whitespace), with canonical Scenario Pack names preferred for display casing and
  first-seen casing used for custom entries.

- **"Traces To Nowhere" is now annotated as a Chapter 2 standalone scenario.**
  The existing catalog entry gains `chapter: 2`; the name string and set are unchanged, so
  no existing playthrough records are orphaned.

- **Five "Return To" campaigns are now explicitly marked in the catalog** (`returnTo: true`
  on `Campaign`), enabling the campaigns card to show which source each row draws from.

- **Top-list persistence cap raised from 10 to 25** for campaigns, investigators, standalones,
  and side scenarios, so the "show all" affordance can reveal meaningful depth.

- **Investigator pairings capped at 200 stored entries.** The previously unbounded
  `topPairings` array is now stored with a 200-entry cap, comfortably above the 7-entry
  client slice used by the pairings panel.

- **`getCommunityStats()` now defensively defaults new/missing list fields to `[]`.**
  Documents persisted before this release will not crash the community cards on load.

### Fixed

- **Dual-chapter investigators are now correctly differentiated in the co-occurrence heatmap.**
  Investigators with both a Chapter 1 and Chapter 2 version (e.g. Daniela Reyes) previously
  collapsed into a single Chapter 1 entry. They now render as distinct "(Ch. 1)" and "(Ch. 2)"
  entries in both the "Your Games" and "Community" heatmaps.

- **Chapter resolution now self-heals stale records.** Legacy playthrough records could carry a
  Chapter 1 investigator id alongside a Chapter 2 investigator set (a contradictory state left by
  earlier edits). Investigator resolution now reconciles this at read time: when a record's stored
  id and set disagree, the set match wins, so the correct chapter is displayed without requiring the
  user to re-edit the game.

- **The Community heatmap now refreshes after its stats are rebuilt.** The Community view read its
  cached stats once on page load and never re-read them after the background rebuild completed, so
  corrected data (such as an investigator's chapter) never reached the screen. The rebuilt stats are
  now fed straight back into the view, so the Community and "Your Games" heatmaps stay in agreement.
