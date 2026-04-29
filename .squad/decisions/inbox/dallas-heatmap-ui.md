# Decision: Heatmap UI — Dual-Layout with Mobile-First Investigator Picker

**Date:** 2026-04-28T16:53:50.887-07:00
**By:** Dallas (Frontend Dev)
**Status:** Implemented

## Context

The `InvestigatorPairingsPanel` showed a flat top-7 list. With Ash's full matrix data now available, we're replacing it with an interactive co-occurrence heatmap.

## Decision

1. **Responsive dual-layout.** Desktop gets a full NxN grid heatmap with hover tooltips and row/column highlighting. Mobile gets a searchable investigator picker that shows ranked pairings for the selected character. No shrunken desktop view on mobile.

2. **Community-first default.** The toggle defaults to "Community" view (all users' data). "Your Games" is the secondary option. This surfaces the most interesting, richest data first.

3. **No external charting libs.** Built entirely with React + TailwindCSS. Cells are simple divs with oklch-based dynamic background colors. Keeps bundle lean.

4. **Color scale.** Uses the app's purple oklch primary hue with opacity scaling (0→max). A 5-step color legend is shown for context.

5. **Accessible.** Grid cells have `role="gridcell"` with aria-labels. Toggle uses `role="tab"` with `aria-selected`. Mobile search has `aria-label`. All interactive elements are keyboard-navigable.

## Files

- `src/components/InvestigatorHeatmap.tsx` — new component (replaces `InvestigatorPairings.tsx`)
- `src/App.tsx` — swapped import and usage

## For Team

- `InvestigatorPairings.tsx` is now unused. Can be deleted in a cleanup pass.
- The new component consumes the same props (`playthroughs`, `communityPairings`) so it's a drop-in replacement.
