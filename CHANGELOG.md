# Changelog

All notable user-facing changes to this project are documented here.

This project follows the spirit of [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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
