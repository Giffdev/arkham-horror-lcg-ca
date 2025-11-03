import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Playthrough, InvestigatorAssignment, CAMPAIGN_TYPES, Archetype, CampaignType } from '@/lib/types'
import { getFullCampaignNames, getStandaloneCampaignNames, getCampaignSet } from '@/lib/campaign-data'
import { getAllInvestigatorNames, getInvestigatorByName, isDualClassInvestigator } from '@/lib/investigator-data'
import { Plus, Trash, Sparkle } from '@phosphor-icons/react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, CaretUpDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface PlaythroughFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (playthrough: Omit<Playthrough, 'id'> | Playthrough) => void
  editPlaythrough?: Playthrough | null
}

export function PlaythroughForm({ open, onOpenChange, onSave, editPlaythrough }: PlaythroughFormProps) {
  const [campaignType, setCampaignType] = useState<CampaignType>('Full Campaign')
  const [campaignName, setCampaignName] = useState('')
  const [customCampaignName, setCustomCampaignName] = useState('')
  const [sideStories, setSideStories] = useState<string[]>([])
  const [sideStoriesOpen, setSideStoriesOpen] = useState(false)
  const [investigators, setInvestigators] = useState<InvestigatorAssignment[]>([])

  useEffect(() => {
    if (editPlaythrough) {
      setCampaignType(editPlaythrough.campaignType)
      setCampaignName(editPlaythrough.campaignName === 'Unknown Campaign' ? '' : editPlaythrough.campaignName)
      setCustomCampaignName(editPlaythrough.customCampaignName || '')
      setSideStories(editPlaythrough.sideStories || [])
      setInvestigators(editPlaythrough.investigators.map(inv => ({
        ...inv,
        isUnknown: inv.isUnknown || inv.investigatorName === 'Unknown' || inv.archetype === 'Unknown',
        isCustom: inv.isCustom || false,
        customInvestigatorName: inv.customInvestigatorName || (inv.isCustom ? inv.investigatorName : ''),
        investigatorSet: inv.investigatorSet
      })))
    } else {
      setCampaignType('Full Campaign')
      setCampaignName('')
      setCustomCampaignName('')
      setSideStories([])
      setInvestigators([{ playerName: '', investigatorName: '', archetype: 'Unknown', isUnknown: false, isCustom: false, investigatorSet: undefined }])
    }
  }, [editPlaythrough, open])

  const handleCampaignTypeChange = (value: CampaignType) => {
    setCampaignType(value)
    setCampaignName('')
    setCustomCampaignName('')
    setSideStories([])
  }

  const handleCampaignNameChange = (name: string) => {
    setCampaignName(name)
  }

  const handleAddInvestigator = () => {
    if (investigators.length < 4) {
      setInvestigators([
        ...investigators,
        { playerName: '', investigatorName: '', archetype: 'Unknown', isUnknown: false, isCustom: false }
      ])
    }
  }

  const handleRemoveInvestigator = (index: number) => {
    setInvestigators(investigators.filter((_, i) => i !== index))
  }

  const handleUpdateInvestigator = (index: number, field: keyof InvestigatorAssignment, value: string | boolean) => {
    setInvestigators(investigators.map((inv, i) => {
      if (i !== index) return inv
      
      const updated = { ...inv, [field]: value }
      
      if (field === 'isUnknown' && value === true) {
        updated.investigatorName = 'Unknown'
        updated.archetype = 'Unknown'
        updated.isCustom = false
        updated.customInvestigatorName = ''
        updated.investigatorSet = undefined
      }
      
      if (field === 'isUnknown' && value === false) {
        updated.investigatorName = ''
        updated.investigatorSet = undefined
      }
      
      if (field === 'isCustom' && value === true) {
        updated.investigatorName = ''
        updated.customInvestigatorName = ''
        updated.archetype = 'Unknown'
        updated.isUnknown = false
        updated.investigatorSet = undefined
      }
      
      if (field === 'isCustom' && value === false) {
        updated.customInvestigatorName = ''
        updated.investigatorName = ''
        updated.investigatorSet = undefined
      }
      
      if (field === 'investigatorName' && typeof value === 'string') {
        const investigatorData = getInvestigatorByName(value)
        if (investigatorData) {
          if (investigatorData.archetypes.length === 1) {
            updated.archetype = investigatorData.archetypes[0]
          }
          updated.investigatorSet = investigatorData.set
        }
        updated.isUnknown = false
        updated.isCustom = false
      }
      
      return updated
    }))
  }

  const handleSubmit = () => {
    const finalCampaignName = campaignType === 'Fan-Made' 
      ? customCampaignName 
      : campaignType === 'Unknown'
        ? 'Unknown Campaign'
        : campaignName
    
    if (!finalCampaignName.trim()) return

    if (investigators.length === 0 || investigators.length > 4) return

    const campaignSet = (campaignType === 'Full Campaign' || campaignType === 'Standalone') ? getCampaignSet(finalCampaignName) : undefined

    const playthroughData = {
      ...(editPlaythrough ? { id: editPlaythrough.id } : {}),
      date: editPlaythrough?.date || new Date().toISOString(),
      campaignType,
      campaignName: finalCampaignName,
      ...(campaignSet && { campaignSet }),
      ...(campaignType === 'Fan-Made' && { customCampaignName }),
      ...(sideStories.length > 0 && { sideStories }),
      investigators: investigators.map(inv => ({
        ...inv,
        investigatorName: inv.isUnknown ? 'Unknown' : inv.isCustom ? (inv.customInvestigatorName || 'Custom') : inv.investigatorName,
        archetype: inv.isUnknown ? 'Unknown' : inv.archetype
      }))
    }

    onSave(playthroughData as Playthrough)
    onOpenChange(false)
  }

  const handleToggleSideStory = (storyName: string) => {
    setSideStories((current) =>
      current.includes(storyName)
        ? current.filter((s) => s !== storyName)
        : [...current, storyName]
    )
  }

  const handleRemoveSideStory = (storyName: string) => {
    setSideStories((current) => current.filter((s) => s !== storyName))
  }

  const availableFullCampaigns = getFullCampaignNames()
  const availableStandaloneCampaigns = getStandaloneCampaignNames()
  
  const isBarkhamCampaign = campaignName === 'Barkham Horror: The Meddling of Meowlathotep'
  const allInvestigatorNames = getAllInvestigatorNames()
  const availableInvestigators = allInvestigatorNames.filter(name => {
    const investigator = getInvestigatorByName(name)
    if (!investigator) return true
    
    const isBarkhamInvestigator = investigator.set === 'Barkham Horror'
    
    if (isBarkhamCampaign) {
      return isBarkhamInvestigator
    } else {
      return !isBarkhamInvestigator
    }
  })
  
  const isFormValid = (campaignType === 'Fan-Made' 
    ? customCampaignName.trim() !== ''
    : campaignType === 'Unknown'
      ? true
      : campaignName.trim() !== '') && 
    investigators.length >= 1 && 
    investigators.length <= 4

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

              {campaignType === 'Full Campaign' ? (
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Campaign</Label>
                  <Select value={campaignName} onValueChange={handleCampaignNameChange}>
                    <SelectTrigger id="campaign-name">
                      <SelectValue placeholder="Select a campaign" />
                    </SelectTrigger>
                    <SelectContent align="end" side="bottom" className="max-w-[min(400px,90vw)]">
                      <ScrollArea className="h-72">
                        {availableFullCampaigns.map((campaign) => (
                          <SelectItem key={campaign} value={campaign}>
                            {campaign}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>
              ) : campaignType === 'Standalone' ? (
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Scenario</Label>
                  <Select value={campaignName} onValueChange={handleCampaignNameChange}>
                    <SelectTrigger id="campaign-name">
                      <SelectValue placeholder="Select a scenario" />
                    </SelectTrigger>
                    <SelectContent align="end" side="bottom" className="max-w-[min(400px,90vw)]">
                      <ScrollArea className="h-72">
                        {availableStandaloneCampaigns.map((campaign) => (
                          <SelectItem key={campaign} value={campaign}>
                            {campaign}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>
              ) : campaignType === 'Fan-Made' ? (
                <div className="space-y-2">
                  <Label htmlFor="custom-campaign-name">Campaign Name</Label>
                  <Input
                    id="custom-campaign-name"
                    placeholder="Enter custom campaign name"
                    value={customCampaignName}
                    onChange={(e) => setCustomCampaignName(e.target.value)}
                  />
                </div>
              ) : null}
            </div>

            {campaignType === 'Full Campaign' && campaignName && (
              <Collapsible open={sideStoriesOpen} onOpenChange={setSideStoriesOpen} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkle size={18} weight="duotone" className="text-accent" />
                    <Label className="cursor-pointer">Side Stories ({sideStories.length})</Label>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      {sideStoriesOpen ? 'Hide' : 'Add Side Stories'}
                      <CaretUpDown size={16} />
                    </Button>
                  </CollapsibleTrigger>
                </div>

                {sideStories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {sideStories.map((story) => (
                      <Badge key={story} variant="secondary" className="gap-1.5 pl-3 pr-2 py-1">
                        {story}
                        <button
                          type="button"
                          onClick={() => handleRemoveSideStory(story)}
                          className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                        >
                          <Trash size={12} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <CollapsibleContent className="space-y-3">
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-3">
                      Select standalone scenarios that were played as side stories during this campaign
                    </p>
                    <ScrollArea className="h-48">
                      <div className="space-y-2 pr-4">
                        {availableStandaloneCampaigns.map((scenario) => (
                          <div key={scenario} className="flex items-center space-x-2">
                            <Checkbox
                              id={`side-story-${scenario}`}
                              checked={sideStories.includes(scenario)}
                              onCheckedChange={() => handleToggleSideStory(scenario)}
                            />
                            <Label
                              htmlFor={`side-story-${scenario}`}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {scenario}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

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
  onUpdate: (index: number, field: keyof InvestigatorAssignment, value: string | boolean) => void
  onRemove: (index: number) => void
  canRemove: boolean
}

function InvestigatorFormItem({ index, investigator, availableInvestigators, onUpdate, onRemove, canRemove }: InvestigatorFormItemProps) {
  const [investigatorSearchOpen, setInvestigatorSearchOpen] = useState(false)
  const [archetypeSelectOpen, setArchetypeSelectOpen] = useState(false)
  
  const investigatorData = getInvestigatorByName(investigator.investigatorName)
  const needsArchetypeSelection = investigatorData && isDualClassInvestigator(investigator.investigatorName)
  const availableArchetypes = investigatorData?.archetypes || []
  const isUnknown = investigator.isUnknown || investigator.investigatorName === 'Unknown'
  const isCustom = investigator.isCustom || false

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
          <Label htmlFor={`player-${index}`}>Player Name (Optional)</Label>
          <Input
            id={`player-${index}`}
            placeholder="Player name"
            value={investigator.playerName}
            onChange={(e) => onUpdate(index, 'playerName', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`investigator-${index}`}>Investigator</Label>
          {isCustom ? (
            <Input
              id={`custom-investigator-${index}`}
              placeholder="Enter custom investigator name"
              value={investigator.customInvestigatorName || ''}
              onChange={(e) => onUpdate(index, 'customInvestigatorName', e.target.value)}
            />
          ) : (
            <Popover open={investigatorSearchOpen} onOpenChange={setInvestigatorSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  id={`investigator-${index}`}
                  className="w-full justify-between"
                  disabled={isUnknown}
                >
                  {isUnknown ? "Unknown" : (investigator.investigatorName || "Select investigator")}
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
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`unknown-${index}`}
            checked={isUnknown}
            onCheckedChange={(checked) => onUpdate(index, 'isUnknown', checked as boolean)}
          />
          <Label htmlFor={`unknown-${index}`} className="text-sm font-normal cursor-pointer">
            Investigator unknown
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id={`custom-${index}`}
            checked={isCustom}
            onCheckedChange={(checked) => onUpdate(index, 'isCustom', checked as boolean)}
          />
          <Label htmlFor={`custom-${index}`} className="text-sm font-normal cursor-pointer">
            Custom investigator
          </Label>
        </div>
      </div>

      {isCustom && (
        <div className="space-y-2">
          <Label htmlFor={`custom-archetype-${index}`}>Class</Label>
          <Select 
            value={investigator.archetype} 
            onValueChange={(value) => onUpdate(index, 'archetype', value as Archetype)}
          >
            <SelectTrigger id={`custom-archetype-${index}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['Guardian', 'Seeker', 'Rogue', 'Mystic', 'Survivor', 'Neutral'].map((archetype) => (
                <SelectItem key={archetype} value={archetype}>
                  {archetype}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {needsArchetypeSelection && !isUnknown && !isCustom && (
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
      
      {investigatorData && !needsArchetypeSelection && !isUnknown && !isCustom && (
        <div className="text-sm text-muted-foreground">
          Class: <span className="font-medium text-foreground">{investigatorData.archetypes[0]}</span>
        </div>
      )}
    </div>
  )
}
