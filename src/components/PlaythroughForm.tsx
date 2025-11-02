import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Playthrough, InvestigatorAssignment, CAMPAIGN_TYPES, Archetype, CampaignType } from '@/lib/types'
import { getAllCampaignNames, getCampaignSet } from '@/lib/campaign-data'
import { getAllInvestigatorNames, getInvestigatorByName, isDualClassInvestigator } from '@/lib/investigator-data'
import { Plus, Trash } from '@phosphor-icons/react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, CaretUpDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface PlaythroughFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (playthrough: Omit<Playthrough, 'id'> | Playthrough) => void
  editPlaythrough?: Playthrough | null
}

export function PlaythroughForm({ open, onOpenChange, onSave, editPlaythrough }: PlaythroughFormProps) {
  const [campaignType, setCampaignType] = useState<CampaignType>('Official')
  const [campaignName, setCampaignName] = useState('')
  const [customCampaignName, setCustomCampaignName] = useState('')
  const [investigators, setInvestigators] = useState<InvestigatorAssignment[]>([])

  useEffect(() => {
    if (editPlaythrough) {
      setCampaignType(editPlaythrough.campaignType)
      setCampaignName(editPlaythrough.campaignName)
      setCustomCampaignName(editPlaythrough.customCampaignName || '')
      setInvestigators(editPlaythrough.investigators)
    } else {
      setCampaignType('Official')
      setCampaignName('')
      setCustomCampaignName('')
      setInvestigators([{ playerName: '', investigatorName: '', archetype: 'Guardian' }])
    }
  }, [editPlaythrough, open])

  const handleCampaignTypeChange = (value: CampaignType) => {
    setCampaignType(value)
    setCampaignName('')
    setCustomCampaignName('')
  }

  const handleAddInvestigator = () => {
    if (investigators.length < 4) {
      setInvestigators([
        ...investigators,
        { playerName: '', investigatorName: '', archetype: 'Guardian' }
      ])
    }
  }

  const handleRemoveInvestigator = (index: number) => {
    setInvestigators(investigators.filter((_, i) => i !== index))
  }

  const handleUpdateInvestigator = (index: number, field: keyof InvestigatorAssignment, value: string) => {
    setInvestigators(investigators.map((inv, i) => {
      if (i !== index) return inv
      
      const updated = { ...inv, [field]: value }
      
      if (field === 'investigatorName') {
        const investigatorData = getInvestigatorByName(value)
        if (investigatorData && investigatorData.archetypes.length === 1) {
          updated.archetype = investigatorData.archetypes[0]
        }
      }
      
      return updated
    }))
  }

  const handleSubmit = () => {
    const finalCampaignName = campaignType === 'Fan-Made' ? customCampaignName : campaignName
    
    if (!finalCampaignName.trim()) return

    const validInvestigators = investigators.filter(inv => inv.investigatorName.trim() !== '')
    
    if (validInvestigators.length === 0 || validInvestigators.length > 4) return

    const campaignSet = campaignType === 'Official' ? getCampaignSet(finalCampaignName) : undefined

    const playthroughData = {
      ...(editPlaythrough ? { id: editPlaythrough.id } : {}),
      date: editPlaythrough?.date || new Date().toISOString(),
      campaignType,
      campaignName: finalCampaignName,
      ...(campaignSet && { campaignSet }),
      ...(campaignType === 'Fan-Made' && { customCampaignName }),
      investigators: validInvestigators
    }

    onSave(playthroughData as Playthrough)
    onOpenChange(false)
  }

  const availableCampaigns = getAllCampaignNames()
  const availableInvestigators = getAllInvestigatorNames()
  const isFormValid = (campaignType === 'Fan-Made' 
    ? customCampaignName.trim() !== ''
    : campaignName.trim() !== '') && 
    investigators.length >= 1 && 
    investigators.length <= 4 &&
    investigators.every(inv => inv.investigatorName.trim() !== '')

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-type">Campaign Type</Label>
                <Select value={campaignType} onValueChange={handleCampaignTypeChange}>
                  <SelectTrigger id="campaign-type">
                    <SelectValue />
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

              {campaignType === 'Official' ? (
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Campaign</Label>
                  <Select value={campaignName} onValueChange={setCampaignName}>
                    <SelectTrigger id="campaign-name">
                      <SelectValue placeholder="Select a campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-72">
                        {availableCampaigns.map((campaign) => (
                          <SelectItem key={campaign} value={campaign}>
                            {campaign}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="custom-campaign-name">Campaign Name</Label>
                  <Input
                    id="custom-campaign-name"
                    placeholder="Enter custom campaign name"
                    value={customCampaignName}
                    onChange={(e) => setCustomCampaignName(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Investigators</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add 1-4 investigators for this game ({investigators.length}/4)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddInvestigator}
                  disabled={investigators.length >= 4}
                  className="gap-2"
                >
                  <Plus size={16} />
                  Add Investigator
                </Button>
              </div>

              {investigators.length === 0 ? (
                <div className="p-4 border border-dashed rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    No investigators added yet. Add at least one investigator to log this game.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {investigators.map((inv, index) => (
                    <InvestigatorFormItem
                      key={index}
                      index={index}
                      investigator={inv}
                      availableInvestigators={availableInvestigators}
                      onUpdate={handleUpdateInvestigator}
                      onRemove={handleRemoveInvestigator}
                      canRemove={investigators.length > 1}
                    />
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
          <Button onClick={handleSubmit} disabled={!isFormValid}>
            {editPlaythrough ? 'Save Changes' : 'Log Game'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface InvestigatorFormItemProps {
  index: number
  investigator: InvestigatorAssignment
  availableInvestigators: string[]
  onUpdate: (index: number, field: keyof InvestigatorAssignment, value: string) => void
  onRemove: (index: number) => void
  canRemove: boolean
}

function InvestigatorFormItem({ index, investigator, availableInvestigators, onUpdate, onRemove, canRemove }: InvestigatorFormItemProps) {
  const [investigatorSearchOpen, setInvestigatorSearchOpen] = useState(false)
  const [archetypeSelectOpen, setArchetypeSelectOpen] = useState(false)
  
  const investigatorData = getInvestigatorByName(investigator.investigatorName)
  const needsArchetypeSelection = investigatorData && isDualClassInvestigator(investigator.investigatorName)
  const availableArchetypes = investigatorData?.archetypes || []

  return (
    <div className="p-4 border rounded-lg space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Player {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          className="h-8 w-8 text-destructive hover:text-destructive disabled:opacity-50"
        >
          <Trash size={16} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`player-${index}`}>Player Name</Label>
          <Input
            id={`player-${index}`}
            placeholder="Player name"
            value={investigator.playerName}
            onChange={(e) => onUpdate(index, 'playerName', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`investigator-${index}`}>Investigator</Label>
          <Popover open={investigatorSearchOpen} onOpenChange={setInvestigatorSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                id={`investigator-${index}`}
                className="w-full justify-between"
              >
                {investigator.investigatorName || "Select investigator"}
                <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0">
              <Command>
                <CommandInput placeholder="Search investigators..." />
                <CommandList>
                  <CommandEmpty>No investigator found.</CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-72">
                      {availableInvestigators.map((name) => (
                        <CommandItem
                          key={name}
                          value={name}
                          onSelect={() => {
                            onUpdate(index, 'investigatorName', name)
                            setInvestigatorSearchOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              investigator.investigatorName === name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {name}
                        </CommandItem>
                      ))}
                    </ScrollArea>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {needsArchetypeSelection && (
        <div className="space-y-2">
          <Label htmlFor={`archetype-${index}`}>Class</Label>
          <Select 
            value={investigator.archetype} 
            onValueChange={(value) => onUpdate(index, 'archetype', value)}
            open={archetypeSelectOpen}
            onOpenChange={setArchetypeSelectOpen}
          >
            <SelectTrigger id={`archetype-${index}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableArchetypes.map((archetype) => (
                <SelectItem key={archetype} value={archetype}>
                  {archetype}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {investigatorData && !needsArchetypeSelection && (
        <div className="text-sm text-muted-foreground">
          Class: <span className="font-medium text-foreground">{investigatorData.archetypes[0]}</span>
        </div>
      )}
    </div>
  )
}
