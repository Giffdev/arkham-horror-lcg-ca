# Product Requirements Document

A campaign playthrough tracker for Arkham Horror: The Card Game that allows players to log and review their gaming sessions with friends, tracking investigators, campaigns, player archetypes, and community-wide statistics.

**Live URL**: Deployed on Vercel (production)

**Experience Qualities**:
1. **Nostalgic** - Evoke fond memories of past gaming sessions with a warm, inviting interface that celebrates shared experiences
2. **Organized** - Present complex gaming data (players, investigators, campaigns) in a clear, scannable format that makes patterns easy to spot
3. **Accommodating** - Gracefully handle incomplete information, acknowledging that memories fade and not every detail needs to be recorded

**Complexity Level**: Full Application (multi-user with authentication, real-time data, community analytics)

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: TailwindCSS 4, class-variance-authority, tailwind-merge
- **UI Components**: Radix UI primitives (Dialog, Tabs, Select, Popover, AlertDialog, DropdownMenu, Toast, etc.)
- **Icons**: Phosphor Icons (`@phosphor-icons/react`)
- **Authentication**: Firebase Auth (Google OAuth + Email/Password)
- **Database**: Cloud Firestore (real-time subscriptions via `onSnapshot`)
- **Hosting**: Vercel
- **Testing**: Vitest + React Testing Library + Playwright
- **Other**: cmdk (searchable combobox), date-fns, sonner (toasts), react-error-boundary

## Data Architecture

- **Per-user data**: Each authenticated user's playthroughs are stored in `users/{uid}/playthroughs` subcollection in Firestore
- **Community stats**: Aggregated stats document rebuilt client-side from a `collectionGroup` query across all users' playthroughs
- **User document**: Created on first sign-in at `users/{uid}` with email, createdAt, authProvider, displayName
- **Real-time sync**: Playthrough list uses Firestore `onSnapshot` for live updates

## Authentication

- **Providers**: Google OAuth (popup-based) and Email/Password
- **Account creation**: Email signup or Google sign-in; user document created on first auth
- **Password linking**: Google users can optionally add a password via "Set Password" in profile menu
- **Password reset**: Email-based reset flow
- **Public access**: Unauthenticated visitors see a public homepage with community stats (no sign-in required to view community data)
- **Session management**: Firebase Auth handles session persistence automatically

## Essential Features

### Public Homepage (Unauthenticated)
- **Functionality**: Landing page for visitors who are not signed in, showcasing community statistics and inviting sign-up
- **Purpose**: Demonstrate the app's value and community activity before requiring authentication
- **Trigger**: Visiting the app without being signed in
- **Progression**: Page loads → Shows app title, description, and call-to-action → Displays live community stats (total games, registered users, popular campaigns/investigators) → Sign In button opens auth dialog
- **Success criteria**: Community stats load from Firestore without authentication, auth dialog supports both Google and email sign-in/sign-up

### Log a Playthrough
- **Functionality**: Create a new campaign playthrough record with campaign selection from a comprehensive list of full campaigns, small campaigns, scenario packs, custom fan-made campaigns, or unknown campaigns when details are forgotten, optional side story scenarios for full campaigns, players, and investigator assignments with automatic class detection
- **Purpose**: Capture gaming memories quickly with accurate campaign and investigator information from the official product catalog, while gracefully accommodating incomplete memories and recording side stories played during campaigns
- **Trigger**: User clicks "Log New Game" button in the app header
- **Progression**: Click "Log New Game" → Dialog form appears → Select campaign type (Full Campaign/Small Campaign/Scenario Pack/Fan-Made/Unknown) → Select campaign from searchable dropdown (set is automatically associated) → Optionally expand "Side Stories" section and select standalone scenarios played during this campaign → Add investigators by selecting from searchable command palette (class is automatically set for single-class investigators, dual-class investigators require manual selection) → Can mark individual investigators as unknown via checkbox → Optionally add player names (with autocomplete from previously used names) → Save → Returns to log list with new entry visible
- **Success criteria**: Record persists in user's Firestore subcollection, displays in the main list with accurate campaign and set information, side stories display as badges on the playthrough card, investigator classes are automatically assigned except for dual-class characters, fan-made campaigns allow free-text entry, unknown campaigns and investigators are gracefully handled

### View Playthrough History (Games Tab)
- **Functionality**: Display all logged playthroughs in a scannable card format showing campaign name, set (for official campaigns), campaign type, side stories (if any), date, players, and investigators with ArkhamDB links
- **Purpose**: Allow users to reminisce and see their gaming history at a glance with complete campaign context
- **Trigger**: Default view when authenticated user loads app (Games tab)
- **Progression**: App loads → Real-time Firestore subscription populates list → Displays playthroughs sorted by date (newest first) → Each card shows campaign name, set badge, campaign type, side story badges, players, investigators with archetype badges
- **Success criteria**: All logged games appear with proper campaign metadata, real-time updates when data changes, skeleton loading states during initial fetch

### Filter Playthroughs
- **Functionality**: Filter playthrough list by archetype (Guardian, Survivor, Seeker, Rogue, Mystic, Neutral), campaign type (Full Campaign, Small Campaign, Scenario Pack, Fan-Made, Unknown), and specific campaign name
- **Purpose**: Help users find specific games and track patterns in their gaming history
- **Trigger**: User interacts with filter UI (desktop: inline panel; mobile: sheet/drawer)
- **Progression**: Open filters → Select archetypes, campaign types, or specific campaigns → List updates instantly → Multiple selections use OR logic within category → Clear all filters to reset
- **Success criteria**: Filtering is instant (client-side), multiple filter categories combine, active filter count displayed, mobile uses bottom sheet for filter UI

### Edit/Delete Playthroughs
- **Functionality**: Modify existing playthrough records or remove them entirely
- **Purpose**: Correct mistakes or remove duplicate/test entries
- **Trigger**: User clicks edit/delete icon on a playthrough card
- **Progression**: Click edit → Same form as creation pre-filled with existing data → Modify → Save (with loading state) / Click delete → Confirmation dialog → Entry removed
- **Success criteria**: Changes persist to Firestore, deletion requires confirmation via AlertDialog, optimistic UI updates, toast notifications on success/failure, save button shows loading state to prevent double-submit

### Players Tab
- **Functionality**: Browse all players who have been logged in playthroughs. Two sub-views: individual player statistics and an "Investigators Overview" showing all investigators played/not-yet-played across the user's collection
- **Purpose**: Track gaming group history, see who plays what, and identify investigator coverage gaps
- **Trigger**: User switches to the "Players" tab
- **Sub-features**:
  - **Player List**: All unique player names extracted from playthroughs, selectable
  - **Player Stats**: For a selected player — total games, unique investigators, favorite class, chronological campaign history with investigators and archetypes, filterable by archetype/set/chapter
  - **Investigators Overview** ("All Investigators" view): Shows which investigators from the full game catalog have been played and which haven't, with ArkhamDB links, filterable by archetype, set, and campaign chapter
- **Success criteria**: All players with logged names appear, statistics accurately reflect data, ArkhamDB links work, filters apply correctly

### Community Tab
- **Functionality**: Three analytics sections visible to authenticated users showing aggregated data across ALL users of the app
- **Sections**:
  1. **Community Stats**: Total games logged, registered users, top campaigns, top investigators (with ArkhamDB links and chapter badges), top classes, top side scenarios, top standalones
  2. **Campaign Completion Stats**: Breakdown of all logged playthroughs by type (Full Campaign, Small Campaign, Scenario Pack, Fan-Made) — both personal and community-wide
  3. **Investigator Pairing Heatmap**: Interactive NxN matrix showing how often investigators are paired together across games. Supports community and personal view modes. Desktop shows full grid with hover tooltips and row/column highlighting. Mobile shows a searchable investigator picker with ranked pairings. Investigators link to ArkhamDB. oklch-based dynamic color scale with 5-step legend.
- **Success criteria**: Community data loads from shared Firestore document, heatmap renders responsively, personal/community toggle works, investigator names link to ArkhamDB

### Community Stats Sync
- **Functionality**: When an authenticated user's playthroughs change, community stats are rebuilt client-side with a debounced 60-second cooldown to avoid excessive writes
- **Purpose**: Keep community statistics up-to-date without requiring Cloud Functions infrastructure
- **Implementation**: `useCommunityStatsSync` hook watches playthrough changes, queries all users' playthroughs via `collectionGroup`, aggregates stats, and writes to shared community-stats document
- **Success criteria**: Stats stay reasonably fresh, no infinite rebuild loops, errors are caught silently

### Data Export/Import
- **Functionality**: Export all playthroughs as JSON file download; import playthroughs from a JSON file with validation
- **Purpose**: Allow users to back up their data or migrate between accounts
- **Trigger**: Available in app settings/profile area
- **Success criteria**: Export produces valid JSON, import validates structure before saving, toast notifications for success/failure

## Edge Case Handling

- **First time user**: Show empty state with "Log Your First Game" call-to-action when no playthroughs exist
- **Data isolation**: Each user's playthroughs are in their own Firestore subcollection (`users/{uid}/playthroughs`)
- **Missing player names**: Players without names are excluded from the player statistics view; playthroughs still appear in main log
- **Fan-made campaigns**: Allow free-text entry for campaign names when Fan-Made type is selected
- **Unknown campaigns**: Allow logging playthroughs where campaign name isn't remembered by selecting Unknown campaign type
- **Unknown investigators**: Individual investigators can be marked as unknown via checkbox, automatically setting class to Unknown
- **Dual-class investigators**: Investigators with multiple possible classes show a class selector; single-class investigators auto-assign their class
- **Campaign types**: Full Campaign, Small Campaign, Scenario Pack categories with separate campaign lists per type
- **Side stories**: Only available when Full Campaign type is selected; displayed in a collapsible section; can add multiple side stories via checkbox list; side stories display as badges on the playthrough card
- **Dream-Eaters paths**: Investigators can be assigned to Dream-Eaters campaign path A or B
- **Duplicate investigators**: Multiple players can select the same investigator (helpful for tracking different builds or repeated favorites)
- **Very long campaign or player names**: Truncate with ellipsis, show full name on hover
- **No players logged**: Show helpful message explaining that player names need to be added when logging games
- **Firestore errors**: `onSnapshot` has error callback; network/permission errors are logged to console
- **Legacy data migration**: `useLegacyDataMigration` hook auto-fixes old data formats on load (guarded against loops)
- **Password linking for Google users**: Google-authenticated users can add email/password as an additional sign-in method
- **Auth state persistence**: Firebase Auth manages session state; app shows loading spinner while checking auth status

## Design Direction

The design evokes the spooky, atmospheric Lovecraftian horror of Arkham Horror — dark, mysterious, and moody with deep purples and shadowy backgrounds reminiscent of the ArkhamCards app. The interface feels like investigating cosmic mysteries by candlelight, maintaining modern usability while creating an immersive, eerie atmosphere.

## Color Selection

Dark atmospheric palette inspired by the ArkhamCards app and Lovecraftian cosmic horror with deep purples, shadowy backgrounds, and mysterious tones.

- **Primary Color**: Deep purple (oklch-based) — Evokes the cosmic horror and mysterious supernatural forces of Arkham Horror
- **Archetype Colors**: Each investigator class has a distinct color scheme (Guardian: blue, Seeker: orange, Rogue: green, Mystic: purple, Survivor: red, Neutral: grey) with dedicated bg/text/border tokens
- **High contrast**: All foreground/background pairings meet WCAG AA standards
- **Heatmap colors**: oklch-based dynamic purple scale for the investigator pairing heatmap

## Component Selection

- **Components**: 
  - Tabs for switching between "All Games", "Players", and "Community" views (3 tabs)
  - Dialog for add/edit playthrough forms with form fields for all optional inputs
  - Command (cmdk searchable combobox) for investigator selection with autocomplete
  - Select dropdown for campaign selection from comprehensive list
  - Collapsible for side stories section with smooth expand/collapse animation
  - Checkbox list within collapsible for selecting multiple side story scenarios
  - Card components for each playthrough entry with hover states
  - Card components for player statistics and community stats metrics
  - Badge components for archetype tags with archetype-specific colors
  - Badge components for side story scenario names and campaign set names
  - Button with primary variant for "Log New Game", ghost variants for filters
  - DropdownMenu for user profile actions (Set Password, Sign Out)
  - Toast notifications (sonner) for action feedback
  - Alert-dialog for delete confirmation
  - Sheet for mobile filter UI
  - Skeleton loading states for playthrough cards
  - Error boundary (react-error-boundary) for graceful error handling

- **Icon Selection** (Phosphor Icons): 
  - Plus for "Log New Game"
  - Pencil for edit actions
  - Trash for delete actions  
  - Funnel for filter toggle
  - X for clear filters
  - BookOpen for campaigns/app logo
  - User/UsersThree for players
  - SignIn/SignOut for auth actions
  - GoogleLogo for Google sign-in
  - Lock for password linking
  - Download/Upload for data export/import
  - MagnifyingGlass for heatmap search
  - ArrowSquareOut for external ArkhamDB links
  - ChartBar/Trophy/GameController/Shield for community stat cards

- **Mobile**: 
  - Desktop: Sticky header, 3-tab layout, inline filters, sidebar player list with stats panel
  - Mobile: Full-width stacked cards, bottom navigation bar (MobileNav), filters in bottom sheet, dialog forms as full-width dialogs
  - Touch targets: Minimum 44x44px for all interactive elements
  - Responsive heatmap: Desktop shows full NxN grid; mobile shows searchable investigator picker with ranked pairings list
