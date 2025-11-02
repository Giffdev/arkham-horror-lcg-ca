import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { Playthrough, Archetype, CampaignType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { PlaythroughCard } from '@/components/PlaythroughCard'
import { PlaythroughForm } from '@/components/PlaythroughForm'
import { EmptyState } from '@/components/EmptyState'
import { Filters } from '@/components/Filters'
import { Plus, BookOpen } from '@phosphor-icons/react'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Toaster, toast } from 'sonner'

function App() {
  const [playthroughs, setPlaythroughs] = useKV<Playthrough[]>('playthroughs', [])
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlaythrough, setEditingPlaythrough] = useState<Playthrough | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedArchetypes, setSelectedArchetypes] = useState<Archetype[]>([])
  const [selectedCampaignTypes, setSelectedCampaignTypes] = useState<CampaignType[]>([])

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
        <div className="space-y-8">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
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