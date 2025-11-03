# Planning Guide

A campaign playthrough tracker for Arkham Horror: The Card Game that allows players to log and review their gaming sessions with friends, tracking investigators, campaigns, and player archetypes.

**Experience Qualities**:
1. **Nostalgic** - Evoke fond memories of past gaming sessions with a warm, inviting interface that celebrates shared experiences
2. **Organized** - Present complex gaming data (players, investigators, campaigns) in a clear, scannable format that makes patterns easy to spot
3. **Accommodating** - Gracefully handle incomplete information, acknowledging that memories fade and not every detail needs to be recorded

**Complexity Level**: Complex Application (advanced functionality, accounts)
- The app manages user authentication via custom email/password accounts, scopes playthrough data to individual users, and provides both public aggregate statistics for logged-out visitors and private detailed tracking for authenticated users. Each user has their own isolated data store with player names and detailed game logs kept private.

## Essential Features

### User Authentication
- **Functionality**: Create an account or sign in with email and password to access personalized playthrough tracking
- **Purpose**: Provide each user with their own private space for tracking games and player names, while showing aggregate public stats to logged-out visitors
- **Trigger**: User clicks "Sign In" button on public homepage, or visits app while not authenticated
- **Progression**: Visit app → If not logged in, see public homepage with aggregate stats → Click "Sign In" → Choose to sign in or create account → Enter email and password → Access personal playthrough tracker
- **Success criteria**: Users can create accounts and sign in securely, their data is isolated from other users, player names and detailed data remain private, public homepage shows aggregate stats without exposing player names, passwords are hashed and stored securely

### Public Homepage (Logged Out)
- **Functionality**: Display aggregate statistics across all users without exposing private information like player names
- **Purpose**: Showcase the app's value and community activity to potential new users without compromising privacy
- **Trigger**: User visits app without being authenticated
- **Progression**: Visit app → See total games logged across all users → View top campaigns played (no player names) → View top investigators used (no player names) → Click "Sign In" to create account or sign in
- **Success criteria**: Shows compelling stats (total games, top campaigns, top investigators), never displays player names, provides clear call-to-action to sign in or create account

### Log a Playthrough
- **Functionality**: Create a new campaign playthrough record with campaign selection from a comprehensive list of full campaigns, standalone scenarios, custom fan-made campaigns, or unknown campaigns when details are forgotten, optional side story scenarios for full campaigns, players, and investigator assignments with automatic class detection (authenticated users only)
- **Purpose**: Capture gaming memories quickly with accurate campaign and investigator information from the official product catalog, while gracefully accommodating incomplete memories and recording side stories played during campaigns
- **Trigger**: Authenticated user clicks "Log New Game" button
- **Progression**: Click "Log New Game" → Modal/form appears → Select campaign type (Full Campaign/Standalone/Fan-Made/Unknown) → If Full Campaign: Select campaign from dropdown (set is automatically associated) → Optionally expand "Side Stories" section and select standalone scenarios that were played during this campaign → If Standalone: Select standalone scenario from dropdown → If Fan-Made: Enter custom campaign name → If Unknown: No campaign selection needed (automatically logged as "Unknown Campaign") → Add investigators by selecting from searchable dropdown (class is automatically set for single-class investigators, dual-class investigators like Agatha Crane require manual selection) → Can mark individual investigators as unknown via checkbox → Optionally add player names → Save → Returns to log list with new entry visible
- **Success criteria**: Record persists in user's private data store, displays in the main list with accurate campaign and set information, side stories display as badges on the playthrough card, investigator classes are automatically assigned except for dual-class characters, fan-made campaigns allow free-text entry, standalone scenarios are separated from full campaigns, unknown campaigns and investigators are gracefully handled, data is isolated per user

### View Playthrough History
- **Functionality**: Display all logged playthroughs in a scannable card format showing campaign name, set (for official campaigns), campaign type, side stories (if any), date, players, and investigators (authenticated users only, shows only their own data)
- **Purpose**: Allow users to reminisce and see their gaming history at a glance with complete campaign context including which side stories were experienced
- **Trigger**: Default view after authentication
- **Progression**: App loads for authenticated user → Displays list of their playthroughs sorted by date (newest first) → Each entry shows campaign name, set badge (if official), campaign type, side story badges (if any), players, and investigators with archetypes
- **Success criteria**: All logged games appear with proper campaign metadata, side stories display as small badges, dates are human-readable, set badges display for official campaigns, only the authenticated user's data is shown

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
- **Functionality**: Browse all players who have been logged in the authenticated user's playthroughs and view detailed statistics for each player including campaigns played, investigators used, and favorite classes
- **Purpose**: Allow users to see their own and their gaming group's history, tracking which campaigns they've experienced and characters they've played
- **Trigger**: Authenticated user switches to the "Players" tab
- **Progression**: Click "Players" tab → View list of all unique players from user's logged games → Select a player → View player statistics dashboard showing: total games played, number of unique investigators used, favorite class (most played archetype), complete list of investigators they've played, chronological campaign history with investigator and archetype details for each game
- **Success criteria**: All players with logged names appear in the list (only from current user's games), statistics accurately reflect playthrough data, campaign history is sorted chronologically (newest first), empty states guide users when no player data exists, player names remain private to the authenticated user

## Edge Case Handling

- **Not logged in**: Show public homepage with aggregate stats and "Sign In" button; hide all personal data and player names
- **First time user**: After signing in, show empty state with "Log Your First Game" call-to-action
- **Data isolation**: Each user's playthroughs are stored in a separate KV key (user-{userId}-playthroughs) ensuring complete privacy
- **Sign out**: User can sign out via dropdown menu from their avatar; app returns to public homepage
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

The design should evoke the spooky, atmospheric Lovecraftian horror of Arkham Horror - dark, mysterious, and moody with deep purples and shadowy backgrounds reminiscent of the ArkhamCards app. The interface should feel like investigating cosmic mysteries by candlelight, maintaining modern usability while creating an immersive, eerie atmosphere.

## Color Selection

Dark atmospheric palette inspired by the ArkhamCards app and Lovecraftian cosmic horror with deep purples, shadowy backgrounds, and mysterious tones.

- **Primary Color**: Deep purple (oklch(0.45 0.12 280)) - Evokes the cosmic horror and mysterious supernatural forces of Arkham Horror
- **Secondary Colors**: Dark slate (oklch(0.28 0.04 280)) for supporting elements, creating depth and shadow; darker purple (oklch(0.25 0.02 280)) for muted backgrounds
- **Accent Color**: Vibrant purple (oklch(0.50 0.14 280)) for CTAs and important interactions, creating focal points in the darkness
- **Foreground/Background Pairings**:
  - Background (Deep dark purple oklch(0.15 0.025 280)): Light grey text (oklch(0.88 0.01 280)) - Ratio 10.5:1 ✓
  - Card (Dark purple oklch(0.20 0.03 280)): Light grey text (oklch(0.88 0.01 280)) - Ratio 9.8:1 ✓
  - Primary (Purple oklch(0.45 0.12 280)): Very light text (oklch(0.95 0.01 280)) - Ratio 6.2:1 ✓
  - Secondary (Dark slate oklch(0.28 0.04 280)): Light grey (oklch(0.88 0.01 280)) - Ratio 8.5:1 ✓
  - Accent (Vibrant purple oklch(0.50 0.14 280)): Very light text (oklch(0.95 0.01 280)) - Ratio 5.8:1 ✓
  - Muted (Dark muted oklch(0.25 0.02 280)): Medium grey text (oklch(0.58 0.01 280)) - Ratio 4.7:1 ✓

## Font Selection

Typography should balance readability with a touch of thematic character. Birmingham (a display serif) is used for headings to evoke the vintage 1920s aesthetic of Arkham Horror, while Inter provides clean, modern readability for body text.

- **Typographic Hierarchy**:
  - H1 (Page Title): Birmingham / 32px / normal letter-spacing
  - H2 (Section Headers): Birmingham / 24px / normal letter-spacing
  - H3 (Card Titles): Birmingham / 18px / -0.01em letter-spacing
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
  - Buttons: Default has subtle shadow, hover increases brightness and glow, active slightly scales down
  - Cards: Default has subtle border, hover shows accent purple border and subtle glow, selected/active state for editing
  - Filters: Ghost style when inactive, filled style with purple glow when active
  - Form inputs: Dark background, focused state with purple ring, error state with red tint

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
