import { useState, useMemo, useEffect } from 'react'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { usePlaythroughs } from '@/hooks/usePlaythroughs'
import { Playthrough, Archetype, CampaignType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { PlaythroughCard } from '@/components/PlaythroughCard'
import { PlaythroughForm } from '@/components/PlaythroughForm'
import { EmptyState } from '@/components/EmptyState'
import { Filters } from '@/components/Filters'
import { PlayerStats } from '@/components/PlayerStats'
import { PlayersOverview } from '@/components/PlayersOverview'
import { CommunityStats } from '@/components/CommunityStats'

import { Plus, BookOpen, User, SignOut, CaretDown, UsersThree } from '@phosphor-icons/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Toaster, toast } from 'sonner'
import { getInvestigatorByName } from '@/lib/investigator-data'
import { signOutUser, User as AuthUser } from '@/lib/auth'
import { PublicHomepage } from '@/components/PublicHomepage'
import { rebuildCommunityStats } from '@/lib/community-stats'

interface AuthenticatedAppProps {
  currentUser: AuthUser
  onSignOut: () => void
}

function AuthenticatedApp({ currentUser, onSignOut }: AuthenticatedAppProps) {
  const [playthroughs, playthroughActions, isLoadingPlaythroughs] = usePlaythroughs(currentUser.id)
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlaythrough, setEditingPlaythrough] = useState<Playthrough | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedArchetypes, setSelectedArchetypes] = useState<Archetype[]>([])
  const [selectedCampaignTypes, setSelectedCampaignTypes] = useState<CampaignType[]>([])
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("games")

  // Auto-fix legacy data (campaign types, investigator metadata)
  useEffect(() => {
    if (!playthroughs || playthroughs.length === 0) return

    const toUpdate: Playthrough[] = []

    for (const playthrough of playthroughs) {
      let changed = false
      const updates: Partial<Playthrough> = {}

      if (playthrough.campaignType === 'Standalone' as any) {
        updates.campaignType = 'Scenario Pack'
        changed = true
      }

      if (
        (playthrough.campaignName === 'The Night of the Zealot' ||
         playthrough.campaignName === 'Return to The Night of the Zealot') &&
        playthrough.campaignType === 'Full Campaign'
      ) {
        updates.campaignType = 'Small Campaign'
        changed = true
      }

      const updatedInvestigators = playthrough.investigators.map(inv => {
        if (inv.isCustom || inv.isUnknown || inv.investigatorName === 'Unknown') return inv
        const data = getInvestigatorByName(inv.investigatorName)
        const invUpdates: Partial<typeof inv> = {}
        if (!inv.investigatorSet && data) { invUpdates.investigatorSet = data.set; changed = true }
        if (!inv.archetypes && data) { invUpdates.archetypes = data.archetypes; changed = true }
        return Object.keys(invUpdates).length ? { ...inv, ...invUpdates } : inv
      })

      if (changed) {
        toUpdate.push({ ...playthrough, ...updates, investigators: updatedInvestigators })
      }
    }

    if (toUpdate.length > 0) {
      Promise.all(toUpdate.map(p => playthroughActions.update(p))).catch(console.error)
    }
  }, [playthroughs]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredPlaythroughs = useMemo(() => {
    if (!playthroughs) return []
    
    return playthroughs.filter((playthrough) => {
      if (selectedArchetypes.length > 0) {
        const hasMatchingArchetype = playthrough.investigators.some((inv) => {
          const investigatorArchetypes = inv.archetypes || [inv.archetype]
          return investigatorArchetypes.some(archetype => selectedArchetypes.includes(archetype))
        })
        if (!hasMatchingArchetype) return false
      }

      if (selectedCampaignTypes.length > 0) {
        if (!selectedCampaignTypes.includes(playthrough.campaignType)) {
          return false
        }
      }

      if (selectedCampaigns.length > 0) {
        const campaignName = playthrough.customCampaignName || playthrough.campaignName
        if (!selectedCampaigns.includes(campaignName)) {
          return false
        }
      }

      return true
    })
  }, [playthroughs, selectedArchetypes, selectedCampaignTypes, selectedCampaigns])

  const handleSavePlaythrough = async (playthrough: Omit<Playthrough, 'id'> | Playthrough) => {
    try {
      if ('id' in playthrough) {
        await playthroughActions.update(playthrough)
        toast.success('Playthrough updated successfully')
      } else {
        await playthroughActions.add(playthrough)
        toast.success('Playthrough logged successfully')
      }
    } catch (error) {
      console.error('Failed to save playthrough:', error)
      toast.error('Failed to save playthrough')
    }
    setEditingPlaythrough(null)
    setTimeout(() => rebuildCommunityStats(), 500)
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
      setTimeout(() => rebuildCommunityStats(), 500)
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

  const handleArchetypeToggle = (archetype: Archetype) => {
    setSelectedArchetypes((current) =>
      current.includes(archetype)
        ? current.filter((a) => a !== archetype)
        : [...current, archetype]
    )
  }

  const handleCampaignTypeToggle = (type: CampaignType) => {
    setSelectedCampaignTypes((current) =>
      current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type]
    )
    if (selectedCampaignTypes.includes(type)) {
      setSelectedCampaigns([])
    }
  }

  const handleCampaignToggle = (campaign: string) => {
    setSelectedCampaigns((current) =>
      current.includes(campaign)
        ? current.filter((c) => c !== campaign)
        : [...current, campaign]
    )
  }

  const handleClearFilters = () => {
    setSelectedArchetypes([])
    setSelectedCampaignTypes([])
    setSelectedCampaigns([])
  }

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

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" />
      
      <header className="border-b bg-card/50 backdrop-blur-sm md:sticky md:top-0 z-10">
        <div className="container mx-auto px-6 py-4 md:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <BookOpen size={24} className="md:w-8 md:h-8 text-primary flex-shrink-0" weight="duotone" />
              <h1 className="text-lg md:text-3xl font-bold truncate text-foreground">Arkham Horror LCG Tracker</h1>
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <Button onClick={handleNewGame} className="gap-1.5 md:gap-2 text-xs md:text-sm">
                <Plus size={18} className="md:w-5 md:h-5" weight="bold" />
                <span className="hidden sm:inline">Log New Game</span>
                <span className="sm:hidden">New</span>
              </Button>
              {currentUser && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="gap-2 px-3 py-2"
                    >
                      <User size={16} weight="fill" className="text-primary" />
                      <span className="text-sm hidden sm:inline">{currentUser.email}</span>
                      <span className="text-sm sm:hidden">Profile</span>
                      <CaretDown size={14} weight="bold" className="opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem 
                      onClick={onSignOut}
                      variant="destructive"
                      className="gap-2 cursor-pointer"
                    >
                      <SignOut size={16} weight="bold" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 md:pb-8 pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
            {isLoadingPlaythroughs ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <BookOpen size={48} className="text-primary mb-4 animate-pulse" weight="duotone" />
                <p className="text-muted-foreground">Loading playthroughs...</p>
              </div>
            ) : (
              <>
                <Filters
                  selectedArchetypes={selectedArchetypes}
                  selectedCampaignTypes={selectedCampaignTypes}
                  selectedCampaigns={selectedCampaigns}
                  onArchetypeToggle={handleArchetypeToggle}
                  onCampaignTypeToggle={handleCampaignTypeToggle}
                  onCampaignToggle={handleCampaignToggle}
                  onClearFilters={handleClearFilters}
                  playthroughs={playthroughs || []}
                />

                {playthroughs && playthroughs.length === 0 ? (
                  <EmptyState />
                ) : filteredPlaythroughs.length === 0 && playthroughs && playthroughs.length > 0 ? (
                  <div className="text-center py-16">
                    <p className="text-muted-foreground">
                      No playthroughs match your selected filters.
                    </p>
                  </div>
                ) : playthroughs && playthroughs.length > 0 ? (
                  <div className="space-y-3">
                    {filteredPlaythroughs.map((playthrough) => (
                      <PlaythroughCard
                        key={playthrough.id}
                        playthrough={playthrough}
                        onEdit={handleEdit}
                        onDelete={setDeleteId}
                        activeArchetypeFilters={selectedArchetypes}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            {isLoadingPlaythroughs ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <BookOpen size={48} className="text-primary mb-4 animate-pulse" weight="duotone" />
                <p className="text-muted-foreground">Loading playthroughs...</p>
              </div>
            ) : playthroughs && playthroughs.length === 0 ? (
              <EmptyState />
            ) : playthroughs && playthroughs.length > 0 && allPlayers.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">
                  No players found. Add player names when logging games to see player statistics.
                </p>
              </Card>
            ) : playthroughs && playthroughs.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1">
                  <Card className="p-4">
                    <h3 className="font-semibold mb-4">Players ({allPlayers.length})</h3>
                    <div className="space-y-2">
                      {allPlayers.map((player) => (
                        <Button
                          key={player}
                          variant={selectedPlayer === player ? 'default' : 'ghost'}
                          className="w-full justify-start gap-2"
                          onClick={() => {
                            setSelectedPlayer(selectedPlayer === player ? null : player)
                          }}
                        >
                          <User size={16} weight={selectedPlayer === player ? 'fill' : 'regular'} />
                          {player}
                        </Button>
                      ))}
                    </div>
                  </Card>
                </div>

                <div className="lg:col-span-3">
                  {selectedPlayer ? (
                    <PlayerStats playerName={selectedPlayer} playthroughs={playthroughs} />
                  ) : (
                    <PlayersOverview playthroughs={playthroughs} />
                  )}
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="community" className="space-y-6">
            <CommunityStats />
          </TabsContent>
        </Tabs>
      </main>

      <PlaythroughForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={handleSavePlaythrough}
        editPlaythrough={editingPlaythrough}
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border pb-safe z-50">
        <div className="grid grid-cols-3 gap-0 px-2 py-2 pb-3">
          <button
            onClick={() => setActiveTab("games")}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-colors ${
              activeTab === "games"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <BookOpen size={24} weight={activeTab === "games" ? "fill" : "regular"} />
            <span className="text-xs font-medium">All Games</span>
          </button>
          <button
            onClick={() => setActiveTab("players")}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-colors ${
              activeTab === "players"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <User size={24} weight={activeTab === "players" ? "fill" : "regular"} />
            <span className="text-xs font-medium">Players</span>
          </button>
          <button
            onClick={() => setActiveTab("community")}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-colors ${
              activeTab === "community"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <UsersThree size={24} weight={activeTab === "community" ? "fill" : "regular"} />
            <span className="text-xs font-medium">Community</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        setCurrentUser({
          id: fbUser.uid,
          email: fbUser.email || '',
          createdAt: Date.now(),
          authProvider: fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
        })
        rebuildCommunityStats().catch(console.error)
      } else {
        setCurrentUser(null)
        rebuildCommunityStats().catch(console.error)
      }
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleAuthSuccess = async (_user: AuthUser) => {
    // Firebase onAuthStateChanged already handles setting the user
    await rebuildCommunityStats()
  }

  const handleSignOut = async () => {
    await signOutUser()
    setCurrentUser(null)
    toast.success('Signed out successfully')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
      onSignOut={handleSignOut}
    />
  )
}

export default App
