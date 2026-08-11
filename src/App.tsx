import { useState, useMemo, useEffect } from 'react'
import { usePlaythroughs } from '@/hooks/usePlaythroughs'
import { useAuthState } from '@/hooks/useAuthState'
import { usePlaythroughFilters } from '@/hooks/usePlaythroughFilters'
import { usePasswordLink } from '@/hooks/usePasswordLink'
import { useLegacyDataMigration } from '@/hooks/useLegacyDataMigration'
import { useCommunityStatsSync } from '@/hooks/useCommunityStatsSync'
import { Playthrough } from '@/lib/types'
import { User as AuthUser } from '@/lib/auth'

import { PlaythroughForm } from '@/components/PlaythroughForm'
import { CommunityStats } from '@/components/CommunityStats'
import { CompletionStatsPanel } from '@/components/CompletionStats'
import { InvestigatorHeatmap } from '@/components/InvestigatorHeatmap'
import { AppHeader } from '@/components/AppHeader'
import { GamesTab } from '@/components/GamesTab'
import { PlayersTab } from '@/components/PlayersTab'
import { MobileNav } from '@/components/MobileNav'
import { PasswordLinkDialog } from '@/components/PasswordLinkDialog'

import { BookOpen, User, UsersThree } from '@phosphor-icons/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Toaster, toast } from 'sonner'
import { PublicHomepage } from '@/components/PublicHomepage'
import { rebuildCommunityStats, getCommunityStats, CommunityStats as CommunityStatsType } from '@/lib/community-stats'

interface AuthenticatedAppProps {
  currentUser: AuthUser
  onSignOut: () => void
}

function AuthenticatedApp({ currentUser, onSignOut }: AuthenticatedAppProps) {
  const [playthroughs, playthroughActions, isLoadingPlaythroughs] = usePlaythroughs(currentUser.id)
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlaythrough, setEditingPlaythrough] = useState<Playthrough | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("games")

  const { filters, handlers: filterHandlers, filteredPlaythroughs } = usePlaythroughFilters(playthroughs)
  const passwordLink = usePasswordLink(currentUser)
  useLegacyDataMigration(playthroughs, playthroughActions.update)

  const [communityStats, setCommunityStats] = useState<CommunityStatsType | null>(null)
  useCommunityStatsSync(playthroughs, setCommunityStats)
  useEffect(() => {
    getCommunityStats().then(setCommunityStats).catch(() => {})
  }, [])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    window.scrollTo(0, 0)
  }

  const knownPlayerNames = useMemo(() => {
    if (!playthroughs) return []
    const names = new Set<string>()
    playthroughs.forEach(p => p.investigators.forEach(inv => {
      if (inv.playerName?.trim()) names.add(inv.playerName.trim())
    }))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [playthroughs])

  const allPlayers = useMemo(() => {
    if (!playthroughs) return []
    const playerSet = new Set<string>()
    playthroughs.forEach(playthrough => {
      playthrough.investigators.forEach(inv => {
        if (inv.playerName.trim()) {
          playerSet.add(inv.playerName)
        }
      })
    })
    return Array.from(playerSet).sort((a, b) => a.localeCompare(b))
  }, [playthroughs])

  const handleSavePlaythrough = async (playthrough: Omit<Playthrough, 'id'> | Playthrough) => {
    setIsSaving(true)
    try {
      if ('id' in playthrough) {
        await playthroughActions.update(playthrough)
        toast.success('Playthrough updated successfully')
      } else {
        await playthroughActions.add(playthrough)
        toast.success('Playthrough logged successfully')
      }
      setEditingPlaythrough(null)
    } catch (error) {
      console.error('Failed to save playthrough:', error)
      const raw = error instanceof Error ? error.message : String(error)
      const display = raw.length > 120 ? `${raw.slice(0, 120)}…` : raw
      toast.error(`Failed to save playthrough: ${display}`)
      throw error
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePlaythrough = async () => {
    if (deleteId) {
      try {
        await playthroughActions.remove(deleteId)
        toast.success('Playthrough deleted')
      } catch (error) {
        console.error('Failed to delete playthrough:', error)
        toast.error('Failed to delete playthrough')
      }
      setDeleteId(null)
    }
  }

  const handleEdit = (playthrough: Playthrough) => {
    setEditingPlaythrough(playthrough)
    setFormOpen(true)
  }

  const handleNewGame = () => {
    setEditingPlaythrough(null)
    setFormOpen(true)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-center" />

      <AppHeader
        currentUser={currentUser}
        onNewGame={handleNewGame}
        onSignOut={onSignOut}
        isGoogleUser={passwordLink.isGoogleUser}
        hasPasswordLinked={passwordLink.hasPasswordLinked}
        onOpenPasswordLink={() => passwordLink.setLinkPasswordOpen(true)}
      />

      <main className="container mx-auto px-6 py-8 md:pb-8 pb-24">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="hidden md:grid w-full max-w-2xl mx-auto grid-cols-3">
            <TabsTrigger value="games" className="gap-2">
              <BookOpen size={18} weight="duotone" />
              All Games
            </TabsTrigger>
            <TabsTrigger value="players" className="gap-2">
              <User size={18} weight="duotone" />
              Players
            </TabsTrigger>
            <TabsTrigger value="community" className="gap-2">
              <UsersThree size={18} weight="duotone" />
              Community
            </TabsTrigger>
          </TabsList>

          <TabsContent value="games" className="space-y-6">
            <GamesTab
              isLoading={isLoadingPlaythroughs}
              playthroughs={playthroughs}
              filteredPlaythroughs={filteredPlaythroughs}
              filters={filters}
              filterHandlers={filterHandlers}
              onEdit={handleEdit}
              onDelete={setDeleteId}
            />
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            <PlayersTab
              isLoading={isLoadingPlaythroughs}
              playthroughs={playthroughs}
              allPlayers={allPlayers}
              selectedPlayer={selectedPlayer}
              onSelectPlayer={setSelectedPlayer}
            />
          </TabsContent>

          <TabsContent value="community" className="space-y-6">
            <CommunityStats />
            <CompletionStatsPanel
              playthroughs={playthroughs}
              communityBreakdown={communityStats?.completionBreakdown}
              communityTotal={communityStats?.totalGames}
            />
            <InvestigatorHeatmap
              playthroughs={playthroughs}
              communityPairings={communityStats?.topPairings}
            />
          </TabsContent>
        </Tabs>
      </main>

      <PlaythroughForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={handleSavePlaythrough}
        editPlaythrough={editingPlaythrough}
        knownPlayerNames={knownPlayerNames}
        isSaving={isSaving}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Playthrough?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This playthrough will be permanently removed from your log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlaythrough} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PasswordLinkDialog
        currentUser={currentUser}
        open={passwordLink.linkPasswordOpen}
        onOpenChange={passwordLink.setLinkPasswordOpen}
        password={passwordLink.linkPassword}
        onPasswordChange={passwordLink.setLinkPassword}
        passwordConfirm={passwordLink.linkPasswordConfirm}
        onPasswordConfirmChange={passwordLink.setLinkPasswordConfirm}
        loading={passwordLink.linkPasswordLoading}
        onSubmit={passwordLink.handleLinkPassword}
      />

      <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}

function App() {
  const { currentUser, isLoading, signOut } = useAuthState()

  const handleAuthSuccess = async (_user: AuthUser) => {
    await rebuildCommunityStats([])
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <BookOpen size={48} className="text-primary mx-auto mb-4" weight="duotone" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <PublicHomepage onAuthSuccess={handleAuthSuccess} />
  }

  return (
    <AuthenticatedApp
      currentUser={currentUser}
      onSignOut={signOut}
    />
  )
}

export default App
