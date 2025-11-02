import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Playthrough, InvestigatorAssignment, CAMPAIGN_TYPES, ARCHETYPES, Archetype, CampaignType } from '@/lib/types'
import { Plus, Trash } from '@phosphor-icons/react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface PlaythroughFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (playthrough: Omit<Playthrough, 'id'> | Playthrough) => void
  editPlaythrough?: Playthrough | null
}

export function PlaythroughForm({ open, onOpenChange, onSave, editPlaythrough }: PlaythroughFormProps) {
  const [campaignName, setCampaignName] = useState('')
  const [campaignType, setCampaignType] = useState<CampaignType | ''>('')
  const [investigators, setInvestigators] = useState<InvestigatorAssignment[]>([])

  useEffect(() => {
    if (editPlaythrough) {
      setCampaignName(editPlaythrough.campaignName || '')
      setCampaignType(editPlaythrough.campaignType || '')
      setInvestigators(editPlaythrough.investigators)
    } else {
      setCampaignName('')
      setCampaignType('')
      setInvestigators([])
    }
  }, [editPlaythrough, open])

  const handleAddInvestigator = () => {
    setInvestigators([
      ...investigators,
      { playerName: '', investigatorName: '', archetype: 'Guardian' }
    ])
  }

  const handleRemoveInvestigator = (index: number) => {
    setInvestigators(investigators.filter((_, i) => i !== index))
  }

  const handleUpdateInvestigator = (index: number, field: keyof InvestigatorAssignment, value: string) => {
    setInvestigators(investigators.map((inv, i) => 
      i === index ? { ...inv, [field]: value } : inv
    ))
  }

  const handleSubmit = () => {
    const playthroughData = {
      ...(editPlaythrough ? { id: editPlaythrough.id } : {}),
      date: editPlaythrough?.date || new Date().toISOString(),
      ...(campaignName && { campaignName }),
      ...(campaignType && { campaignType }),
      investigators: investigators.filter(inv => inv.investigatorName.trim() !== '')
    }

    onSave(playthroughData as Playthrough)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {editPlaythrough ? 'Edit Playthrough' : 'Log New Game'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                placeholder="e.g., The Dunwich Legacy"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-type">Campaign Type</Label>
              <Select value={campaignType} onValueChange={(value) => setCampaignType(value as CampaignType)}>
                <SelectTrigger id="campaign-type">
                  <SelectValue placeholder="Select type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Investigators</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddInvestigator}
                  className="gap-2"
                >
                  <Plus size={16} />
                  Add Investigator
                </Button>
              </div>

              {investigators.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No investigators added yet. Click "Add Investigator" to record who played.
                </p>
              ) : (
                <div className="space-y-4">
                  {investigators.map((inv, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3 bg-card">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          Investigator {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveInvestigator(index)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash size={16} />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`player-${index}`}>Player Name</Label>
                          <Input
                            id={`player-${index}`}
                            placeholder="e.g., Alice"
                            value={inv.playerName}
                            onChange={(e) => handleUpdateInvestigator(index, 'playerName', e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`investigator-${index}`}>Investigator</Label>
                          <Input
                            id={`investigator-${index}`}
                            placeholder="e.g., Roland Banks"
                            value={inv.investigatorName}
                            onChange={(e) => handleUpdateInvestigator(index, 'investigatorName', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`archetype-${index}`}>Archetype</Label>
                        <Select 
                          value={inv.archetype} 
                          onValueChange={(value) => handleUpdateInvestigator(index, 'archetype', value)}
                        >
                          <SelectTrigger id={`archetype-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ARCHETYPES.map((archetype) => (
                              <SelectItem key={archetype} value={archetype}>
                                {archetype}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {editPlaythrough ? 'Save Changes' : 'Log Game'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
