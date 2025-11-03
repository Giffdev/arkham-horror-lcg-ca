import { useState, useMemo, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Playthrough, Archetype, CampaignType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { PlaythroughCard } from '@/components/PlaythroughCard'
import { PlaythroughForm } from '@/components/PlaythroughForm'
import { EmptyState } from '@/components/EmptyState'
import { Filters } from '@/components/Filters'
import { PlayerStats } from '@/components/PlayerStats'
import { Plus, BookOpen, User } from '@phosphor-icons/react'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Toaster, toast } from 'sonner'
import { getInvestigatorByName } from '@/lib/investigator-data'

function App() {
  const [playthroughs, setPlaythroughs] = useKV<Playthrough[]>('playthroughs', [])
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlaythrough, setEditingPlaythrough] = useState<Playthrough | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedArchetypes, setSelectedArchetypes] = useState<Archetype[]>([])
  const [selectedCampaignTypes, setSelectedCampaignTypes] = useState<CampaignType[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)

  useEffect(() => {
    if (!playthroughs || playthroughs.length === 0) return

    let needsUpdate = false
    const updatedPlaythroughs = playthroughs.map(playthrough => {
      const updatedInvestigators = playthrough.investigators.map(inv => {
        if (inv.isCustom || inv.isUnknown || inv.investigatorName === 'Unknown') {
          return inv
        }
        
        if (!inv.investigatorSet) {
          const investigatorData = getInvestigatorByName(inv.investigatorName)
          if (investigatorData) {
            needsUpdate = true
            return { ...inv, investigatorSet: investigatorData.set }
          }
        }
        
        return inv
      })

      if (JSON.stringify(updatedInvestigators) !== JSON.stringify(playthrough.investigators)) {
        return { ...playthrough, investigators: updatedInvestigators }
      }
      
      return playthrough
    })

    if (needsUpdate) {
      setPlaythroughs(updatedPlaythroughs)
    }
  }, [playthroughs, setPlaythroughs])

  const filteredPlaythroughs = useMemo(() => {
    if (!playthroughs) return []
    
    return playthroughs.filter((playthrough) => {
      if (selectedArchetypes.length > 0) {
        const hasMatchingArchetype = playthrough.investigators.some((inv) =>
          selectedArchetypes.includes(inv.archetype)
        )
        if (!hasMatchingArchetype) return false
      }

      if (selectedCampaignTypes.length > 0) {
        if (!selectedCampaignTypes.includes(playthrough.campaignType)) {
          return false
        }
      }

      return true
    })
  }, [playthroughs, selectedArchetypes, selectedCampaignTypes])

  const handleSavePlaythrough = (playthrough: Omit<Playthrough, 'id'> | Playthrough) => {
    setPlaythroughs((current) => {
      const existing = current || []
      if ('id' in playthrough) {
        toast.success('Playthrough updated successfully')
        return existing.map((p) => (p.id === playthrough.id ? playthrough : p))
      } else {
        const newPlaythrough = {
          ...playthrough,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        } as Playthrough
        toast.success('Playthrough logged successfully')
        return [newPlaythrough, ...existing]
      }
    })
    setEditingPlaythrough(null)
  }

  const handleDeletePlaythrough = () => {
    if (deleteId) {
      setPlaythroughs((current) => (current || []).filter((p) => p.id !== deleteId))
      toast.success('Playthrough deleted')
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
  }

  const handleClearFilters = () => {
    setSelectedArchetypes([])
    setSelectedCampaignTypes([])
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
      
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen size={32} weight="duotone" className="text-primary" />
              <h1 className="text-3xl font-bold">Arkham Horror LCG Tracker</h1>
            </div>
            <Button onClick={handleNewGame} className="gap-2">
              <Plus size={20} weight="bold" />
              Log New Game
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="games" className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="games" className="gap-2">
              <BookOpen size={18} weight="duotone" />
              All Games
            </TabsTrigger>
            <TabsTrigger value="players" className="gap-2">
              <User size={18} weight="duotone" />
              Players
            </TabsTrigger>
          </TabsList>

          <TabsContent value="games" className="space-y-8">
            <Filters
              selectedArchetypes={selectedArchetypes}
              selectedCampaignTypes={selectedCampaignTypes}
              onArchetypeToggle={handleArchetypeToggle}
              onCampaignTypeToggle={handleCampaignTypeToggle}
              onClearFilters={handleClearFilters}
            />

            <Separator />

            {!playthroughs || playthroughs.length === 0 ? (
              <EmptyState />
            ) : filteredPlaythroughs.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">
                  No playthroughs match your selected filters.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPlaythroughs.map((playthrough) => (
                  <PlaythroughCard
                    key={playthrough.id}
                    playthrough={playthrough}
                    onEdit={handleEdit}
                    onDelete={setDeleteId}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            {!playthroughs || playthroughs.length === 0 ? (
              <EmptyState />
            ) : allPlayers.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">
                  No players found. Add player names when logging games to see player statistics.
                </p>
              </Card>
            ) : (
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
                    <Card className="p-12 text-center">
                      <User size={48} weight="duotone" className="mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Select a player to view their statistics and campaign history
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            )}
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
    </div>
  )
}

export default App