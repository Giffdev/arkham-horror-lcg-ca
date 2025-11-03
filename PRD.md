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
- **Functionality**: Create a new campaign playthrough record with campaign selection from a comprehensive list of full campaigns, standalone scenarios, custom fan-made campaigns, or unknown campaigns when details are forgotten, optional side story scenarios for full campaigns, players, and investigator assignments with automatic class detection
- **Purpose**: Capture gaming memories quickly with accurate campaign and investigator information from the official product catalog, while gracefully accommodating incomplete memories and recording side stories played during campaigns
- **Trigger**: User clicks "Log New Game" button
- **Progression**: Click "Log New Game" → Modal/form appears → Select campaign type (Full Campaign/Standalone/Fan-Made/Unknown) → If Full Campaign: Select campaign from dropdown (set is automatically associated) → Optionally expand "Side Stories" section and select standalone scenarios that were played during this campaign → If Standalone: Select standalone scenario from dropdown → If Fan-Made: Enter custom campaign name → If Unknown: No campaign selection needed (automatically logged as "Unknown Campaign") → Add investigators by selecting from searchable dropdown (class is automatically set for single-class investigators, dual-class investigators like Agatha Crane require manual selection) → Can mark individual investigators as unknown via checkbox → Optionally add player names → Save → Returns to log list with new entry visible
- **Success criteria**: Record persists between sessions, displays in the main list with accurate campaign and set information, side stories display as badges on the playthrough card, investigator classes are automatically assigned except for dual-class characters, fan-made campaigns allow free-text entry, standalone scenarios are separated from full campaigns, unknown campaigns and investigators are gracefully handled

### View Playthrough History
- **Functionality**: Display all logged playthroughs in a scannable card format showing campaign name, set (for official campaigns), campaign type, side stories (if any), date, players, and investigators
- **Purpose**: Allow users to reminisce and see their gaming history at a glance with complete campaign context including which side stories were experienced
- **Trigger**: Default view on app load
- **Progression**: App loads → Displays list of all playthroughs sorted by date (newest first) → Each entry shows campaign name, set badge (if official), campaign type, side story badges (if any), players, and investigators with archetypes
- **Success criteria**: All logged games appear with proper campaign metadata, side stories display as small badges, dates are human-readable, set badges display for official campaigns

### Filter by Archetype
- **Functionality**: Filter playthrough list to show only games where specific archetypes (Guardian, Survivor, Seeker, Rogue, Mystic, Neutral) were played
- **Purpose**: Help users track which character types they've explored and which they've neglected
- **Trigger**: User selects archetype filter chips/buttons
- **Progression**: View playthrough list → Click archetype filter → List updates to show only matching playthroughs → Multiple filters show games with any selected archetype → Clear filters to return to full list
- **Success criteria**: Filtering is instant, multiple selections work as OR logic, empty states show helpful message

### Filter by Campaign Type
- **Functionality**: Filter to show full campaigns, standalone scenarios, fan-made content, or unknown campaigns separately
- **Purpose**: Distinguish between full campaigns, quick standalone games, community content, and games where campaign details weren't remembered
- **Trigger**: User selects campaign type filter
- **Progression**: View playthrough list → Select type filter (Full Campaign/Standalone/Fan-Made/Unknown) → List updates → Can combine with archetype filters
- **Success criteria**: Filters work together, clear indication of active filters

### Edit/Delete Playthroughs
- **Functionality**: Modify existing playthrough records or remove them entirely
- **Purpose**: Correct mistakes or remove duplicate/test entries
- **Trigger**: User clicks edit/delete icon on a playthrough entry
- **Progression**: Click edit → Same form as creation pre-filled with existing data → Modify → Save / Click delete → Confirm → Entry removed
- **Success criteria**: Changes persist, deletion requires confirmation, UI updates immediately

### View Player Statistics
- **Functionality**: Browse all players who have been logged in playthroughs and view detailed statistics for each player including campaigns played, investigators used, and favorite classes
- **Purpose**: Allow players to see their own gaming history and track which campaigns they've experienced and characters they've played
- **Trigger**: User switches to the "Players" tab
- **Progression**: Click "Players" tab → View list of all unique players → Select a player → View player statistics dashboard showing: total games played, number of unique investigators used, favorite class (most played archetype), complete list of investigators they've played, chronological campaign history with investigator and archetype details for each game
- **Success criteria**: All players with logged names appear in the list, statistics accurately reflect playthrough data, campaign history is sorted chronologically (newest first), empty states guide users when no player data exists

## Edge Case Handling

- **Missing player names**: Players without names are excluded from the player statistics view; playthroughs still appear in main log
- **Fan-made campaigns**: Allow free-text entry for campaign names when Fan-Made type is selected
- **Unknown campaigns**: Allow logging playthroughs where campaign name isn't remembered by selecting Unknown campaign type
- **Unknown investigators**: Individual investigators can be marked as unknown via checkbox, automatically setting class to Unknown
- **Dual-class investigators**: Investigators like Agatha Crane who can be either Seeker or Mystic show a class selector; single-class investigators auto-assign their class
- **Full campaign vs. standalone**: Separate dropdowns for full campaigns and standalone scenarios for better organization and findability
- **Official campaign/scenario selection**: Dropdowns list campaigns or scenarios based on selected type; set information is automatically associated
- **Side stories**: Only available when Full Campaign type is selected; displayed in a collapsible section; can add multiple side stories via checkbox list; side stories display as badges on the playthrough card
- **No side stories**: Side stories section is optional and only shows when expanded; playthroughs without side stories don't show the section on the card
- **Duplicate investigators**: Multiple players can select the same investigator (helpful for tracking different builds or repeated favorites)
- **Very long campaign or player names**: Truncate with ellipsis, show full name on hover
- **No playthroughs yet**: Show welcoming empty state with prominent "Log Your First Game" call-to-action
- **No players logged**: Show helpful message explaining that player names need to be added when logging games
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

Typography should balance readability with a clean, modern aesthetic using a single, highly legible sans-serif font family.

- **Typographic Hierarchy**:
  - H1 (Page Title): Inter Semi-Bold / 32px / normal letter-spacing
  - H2 (Section Headers): Inter Semi-Bold / 24px / normal letter-spacing
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
  - Tabs for switching between "All Games" and "Players" views
  - Dialog for add/edit playthrough forms with form fields for all optional inputs
  - Command (searchable combobox) for investigator selection with autocomplete
  - Select dropdown for campaign selection from comprehensive list
  - Collapsible for side stories section with smooth expand/collapse animation
  - Checkbox list within collapsible for selecting multiple side story scenarios
  - Card components for each playthrough entry with subtle hover states (border color shift, shadow increase)
  - Card components for player statistics showing key metrics (total games, investigators used, favorite class)
  - Badge components for archetype tags with archetype-specific colors (Guardian: blue, Seeker: orange, Rogue: green, Mystic: purple, Survivor: red, Neutral: grey)
  - Badge components for side story scenario names (outline variant) with remove button
  - Button with primary variant for "Log New Game", ghost variants for filters and player list
  - Select dropdowns for dual-class investigator class selection and campaign types
  - Input fields for player names and custom campaign names
  - Separator for visual organization between sections
  - Scroll-area for long lists of playthroughs, dropdown contents, and side story checkboxes
  - Label components for form fields
  - Alert-dialog for delete confirmation
  - Popover for command palette positioning

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
  - Users or UsersThree for players/investigators count
  - User for individual player
  - BookOpen or Notebook for campaigns
  - Sparkle for side stories section (adds thematic flavor)
  - CaretUpDown for collapsible trigger
  - Briefcase for total games metric
  - Campaign-specific icons next to set names (Star for Core, Buildings for Dunwich, Moon for Carcosa, Mountains for Forgotten Age, Church for Circle Undone, Eye for Dream-Eaters, Waves for Innsmouth, Snowflake for Edge of the Earth, Key for Scarlet Keys, Grains for Hemlock Vale, Compass for Drowned City, Cat for Barkham, Skull for Standalone, Ghost for unknown)

- **Spacing**: 
  - Page padding: p-6 (24px)
  - Card padding: p-6 (24px)
  - Card gaps in grid: gap-4 (16px)
  - Form field spacing: space-y-4 (16px between fields)
  - Section spacing: space-y-8 (32px between major sections)
  - Badge gaps: gap-2 (8px)

- **Mobile**: 
  - Desktop: Two-column card grid for playthroughs, filters in horizontal row, player list as sidebar with stats panel
  - Tablet: Single column cards, filters remain horizontal but may wrap, player list stacks above stats
  - Mobile: Full-width stacked cards, filters convert to scrollable horizontal chips, dialog forms become full-screen sheets, tabs for switching between games and players
  - Touch targets: Minimum 44x44px for all interactive elements
  - Bottom sheet for add/edit on mobile instead of centered dialog
