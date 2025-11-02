# Planning Guide

A campaign playthrough tracker for Arkham Horror: The Card Game that allows players to log and review their gaming sessions with friends, tracking investigators, campaigns, and player archetypes.

**Experience Qualities**:
1. **Nostalgic** - Evoke fond memories of past gaming sessions with a warm, inviting interface that celebrates shared experiences
2. **Organized** - Present complex gaming data (players, investigators, campaigns) in a clear, scannable format that makes patterns easy to spot
3. **Accommodating** - Gracefully handle incomplete information, acknowledging that memories fade and not every detail needs to be recorded

**Complexity Level**: Light Application (multiple features with basic state)
- The app manages playthrough logs with relationships between campaigns, players, and investigators, but doesn't require authentication or advanced data processing beyond basic CRUD operations and filtering.

## Essential Features

### Log a Playthrough
- **Functionality**: Create a new campaign playthrough record with optional fields for campaign name, campaign type, players, and investigator assignments
- **Purpose**: Capture gaming memories while they're fresh, without forcing users to fill out every field
- **Trigger**: User clicks "Log New Game" button
- **Progression**: Click "Log New Game" → Modal/form appears → Fill in any combination of: campaign name, type (official/side story/fan-made), player names, investigator selections with archetypes → Save → Returns to log list with new entry visible
- **Success criteria**: Record persists between sessions, displays in the main list, all fields are optional and can be left blank

### View Playthrough History
- **Functionality**: Display all logged playthroughs in a scannable list/card format showing campaign, date, players, and investigators
- **Purpose**: Allow users to reminisce and see their gaming history at a glance
- **Trigger**: Default view on app load
- **Progression**: App loads → Displays list of all playthroughs sorted by date (newest first) → Each entry shows available information (campaign, players, investigators with archetypes)
- **Success criteria**: All logged games appear, empty fields don't break layout, dates are human-readable

### Filter by Archetype
- **Functionality**: Filter playthrough list to show only games where specific archetypes (Guardian, Survivor, Seeker, Rogue, Mystic, Neutral) were played
- **Purpose**: Help users track which character types they've explored and which they've neglected
- **Trigger**: User selects archetype filter chips/buttons
- **Progression**: View playthrough list → Click archetype filter → List updates to show only matching playthroughs → Multiple filters show games with any selected archetype → Clear filters to return to full list
- **Success criteria**: Filtering is instant, multiple selections work as OR logic, empty states show helpful message

### Filter by Campaign Type
- **Functionality**: Filter to show official campaigns, side stories, or fan-made content separately
- **Purpose**: Distinguish between full campaign experiences and one-off scenarios
- **Trigger**: User selects campaign type filter
- **Progression**: View playthrough list → Select type filter → List updates → Can combine with archetype filters
- **Success criteria**: Filters work together, clear indication of active filters

### Edit/Delete Playthroughs
- **Functionality**: Modify existing playthrough records or remove them entirely
- **Purpose**: Correct mistakes or remove duplicate/test entries
- **Trigger**: User clicks edit/delete icon on a playthrough entry
- **Progression**: Click edit → Same form as creation pre-filled with existing data → Modify → Save / Click delete → Confirm → Entry removed
- **Success criteria**: Changes persist, deletion requires confirmation, UI updates immediately

## Edge Case Handling

- **Completely empty playthrough**: Allow saving with just a date - sometimes you remember playing but nothing else
- **Duplicate investigators**: Multiple players can select the same investigator (helpful for tracking different builds or repeated favorites)
- **Very long player names or investigator names**: Truncate with ellipsis, show full name on hover
- **No playthroughs yet**: Show welcoming empty state with prominent "Log Your First Game" call-to-action
- **Many playthroughs (100+)**: Virtual scrolling or pagination to maintain performance
- **Browser back button**: Standard navigation, no special handling needed for this SPA

## Design Direction

The design should feel like opening a well-maintained gaming journal - warm, personal, and slightly atmospheric with nods to Arkham Horror's 1920s investigative noir aesthetic, while maintaining modern usability. The interface should be rich enough to feel thematic but minimal enough to keep the focus on the data and memories.

## Color Selection

Custom palette inspired by Arkham Horror's atmospheric noir aesthetic with vintage paper tones and archetype-specific accent colors.

- **Primary Color**: Deep midnight blue (oklch(0.25 0.08 250)) - Evokes mystery and the cosmic horror themes of Arkham Horror
- **Secondary Colors**: Warm sepia/cream (oklch(0.92 0.02 75)) for cards and backgrounds, suggesting aged paper and vintage documents; muted slate (oklch(0.45 0.02 250)) for supporting UI elements
- **Accent Color**: Amber/gold (oklch(0.70 0.15 75)) for CTAs and important interactions, reminiscent of vintage lamplight and discovery
- **Foreground/Background Pairings**:
  - Background (Warm cream #F5F1E8 / oklch(0.95 0.015 75)): Dark charcoal text (oklch(0.25 0.01 250)) - Ratio 11.2:1 ✓
  - Card (Light sepia #FDFBF7 / oklch(0.98 0.01 75)): Dark charcoal text (oklch(0.25 0.01 250)) - Ratio 13.1:1 ✓
  - Primary (Midnight blue oklch(0.25 0.08 250)): Cream white (oklch(0.98 0.01 75)) - Ratio 10.8:1 ✓
  - Secondary (Muted slate oklch(0.45 0.02 250)): White (oklch(1 0 0)) - Ratio 4.9:1 ✓
  - Accent (Amber oklch(0.70 0.15 75)): Dark charcoal (oklch(0.25 0.01 250)) - Ratio 5.2:1 ✓
  - Muted (Light grey oklch(0.88 0.005 250)): Medium grey text (oklch(0.50 0.01 250)) - Ratio 4.6:1 ✓

## Font Selection

Typography should balance readability with period atmosphere - a clean sans-serif for UI clarity paired with subtle serif touches for thematic flavor.

- **Typographic Hierarchy**:
  - H1 (Page Title): Crimson Text Semi-Bold / 32px / normal letter-spacing
  - H2 (Section Headers): Crimson Text Semi-Bold / 24px / normal letter-spacing
  - H3 (Card Titles): Inter Semi-Bold / 18px / -0.01em letter-spacing
  - Body (Content): Inter Regular / 15px / 1.6 line-height
  - Labels: Inter Medium / 13px / 0.01em letter-spacing / uppercase
  - Caption (Dates, metadata): Inter Regular / 13px / muted color

## Animations

Animations should feel like turning pages in a journal or placing cards on a table - deliberate, tactile, and satisfying without being showy.

- **Purposeful Meaning**: Gentle fades and slides communicate state changes; subtle hover effects on cards suggest interactivity; modal entries feel like opening a logbook
- **Hierarchy of Movement**: New playthrough entries should have a brief fade-in; filters apply with a quick fade transition; modals slide up gently; card hovers have subtle lift with shadow change

## Component Selection

- **Components**: 
  - Dialog for add/edit playthrough forms with form fields for all optional inputs
  - Card components for each playthrough entry with subtle hover states (border color shift, shadow increase)
  - Badge components for archetype tags with archetype-specific colors (Guardian: red, Seeker: orange, Rogue: green, Mystic: purple, Survivor: blue, Neutral: grey)
  - Button with primary variant for "Log New Game", ghost variants for filters
  - Select dropdowns for investigators and campaign types
  - Input fields for player names and campaign names
  - Separator for visual organization between sections
  - Scroll-area for long lists of playthroughs
  - Label components for form fields
  - Alert-dialog for delete confirmation

- **Customizations**:
  - Custom archetype badge colors using class-variance-authority
  - Custom empty state illustration or message component
  - Date display helper component for human-readable dates

- **States**:
  - Buttons: Default has subtle shadow, hover increases brightness and shadow, active slightly scales down
  - Cards: Default has light border, hover shows amber accent border and lifts with deeper shadow, selected/active state for editing
  - Filters: Ghost style when inactive, filled style when active
  - Form inputs: Light background, focused state with amber ring, error state with red tint

- **Icon Selection**: 
  - Plus icon for "Log New Game"
  - Pencil/PencilSimple for edit actions
  - Trash for delete actions  
  - Funnel/FunnelSimple for filter toggle
  - X for clear filters
  - Calendar or Clock for dates
  - Users or UsersThree for players
  - BookOpen or Notebook for campaigns

- **Spacing**: 
  - Page padding: p-6 (24px)
  - Card padding: p-6 (24px)
  - Card gaps in grid: gap-4 (16px)
  - Form field spacing: space-y-4 (16px between fields)
  - Section spacing: space-y-8 (32px between major sections)
  - Badge gaps: gap-2 (8px)

- **Mobile**: 
  - Desktop: Two-column card grid for playthroughs, filters in horizontal row
  - Tablet: Single column cards, filters remain horizontal but may wrap
  - Mobile: Full-width stacked cards, filters convert to scrollable horizontal chips, dialog forms become full-screen sheets
  - Touch targets: Minimum 44x44px for all interactive elements
  - Bottom sheet for add/edit on mobile instead of centered dialog
