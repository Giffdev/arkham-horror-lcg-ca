import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/che
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Playthrough, InvestigatorAssignment, CAMPAIGN_TYPES, Archetype, CampaignType, DreamEatersCampaignPath } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
interface PlaythroughFormProps {
  onOpenChange: (open: boolean) => void
  editPlaythrough?: Playthrough | null

  const [campaignType, setCampaignType] = useState<CampaignType>('Full Campaign')
  const [customCampaignName, setCustomCampaignName] = useS
  const [sideStoriesOpen, setSid
import { Badge } from '@/components/ui/badge'

interface PlaythroughFormProps {
      setCustom
  onOpenChange: (open: boolean) => void
      setInvestigators(editPlaythrough.investigators.map(inv => ({
  editPlaythrough?: Playthrough | null
 

    } else {
  const [campaignType, setCampaignType] = useState<CampaignType>('Full Campaign')
      setSideStories([])
      setInvestigators([{ 
        investigatorName: '', 
        isUnknown: false, 
        investigatorSet: undefined 
    }

    setCampaignType
    setCustomCampaignName(
  }
  const handleCampaignNameChange = (name: string) => {
    setCampaignSearchOpen(false)

      setSideStories(stories)
      setInvestigators([
      setInvestigators(editPlaythrough.investigators.map(inv => ({
          inves
          isUnknown: false, 
          ...(campaignName === 'The Drea
      ])
  }
  const handleRemoveInvestigator = (index: n
  }
    } else {
      if (i !== index) return inv
      setCampaignName('')
      if (field === 'isUnknown'
      setSideStories([])
        updated.customInvestiga
      setInvestigators([{ 
      if (field === 'isU
        investigatorName: '', 
      
        isUnknown: false, 
        updated.archetype
        investigatorSet: undefined 
      
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
    setCampaignSearchOpen(false)
  }

  const handleAddInvestigator = () => {
    const maxInvestigators = campaignName === 'The Dream-Eaters' ? 8 : 4
    if (investigators.length < maxInvestigators) {
      setInvestigators([
        ...investigators,
        { 
          playerName: '', 
          investigatorName: '', 
          archetype: 'Unknown', 
          isUnknown: false, 
          isCustom: false,
          ...(campaignName === 'The Dream-Eaters' && { dreamEatersPath: 'A: The Dream-Quest' as DreamEatersCampaignPath })
        }
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
  const isBarkhamCampaign = campaignName === 'Barkham Horror:
        if (investigatorData) {
          if (investigatorData.archetypes.length === 1) {
            updated.archetype = investigatorData.archetypes[0]
            updated.archetypes = investigatorData.archetypes
          } else {
            updated.archetype = investigatorData.archetypes[0]
            updated.archetypes = investigatorData.archetypes
      retur
          updated.investigatorSet = investigatorData.set
        }
        updated.isUnknown = false
        updated.isCustom = false
      }
  cons
      return updated
    dre
  }

  const handleSubmit = () => {
    const finalCampaignName = campaignType === 'Fan-Made' 
      ? customCampaignName 
      : campaignType === 'Unknown'
        ? 'Unknown Campaign'
    )
    
      const uniqueDuplicates = Array.from

    const maxInvestigators = finalCampaignName === 'The Dream-Eaters' ? 8 : 4
    if (investigators.length === 0 || investigators.length > maxInvestigators) return

    const campaignSet = (campaignType === 'Full Campaign' || campaignType === 'Standalone') ? getCampaignSet(finalCampaignName) : undefined

    const playthroughData = {
      ...(editPlaythrough ? { id: editPlaythrough.id } : {}),
      date: editPlaythrough?.date || new Date().toISOString(),
    !dreamEatersPat
      campaignName: finalCampaignName,
      ...(campaignSet && { campaignSet }),
      ...(campaignType === 'Fan-Made' && { customCampaignName }),
      ...(sideStories.length > 0 && { sideStories }),
      investigators: investigators.map(inv => ({
          </Dia
        investigatorName: inv.isUnknown ? 'Unknown' : inv.isCustom ? (inv.customInvestigatorName || 'Custom') : inv.investigatorName,
        archetype: inv.isUnknown ? 'Unknown' : inv.archetype
      }))
     

    onSave(playthroughData as Playthrough)
    onOpenChange(false)
   

  const handleToggleSideStory = (storyName: string) => {
    setSideStories((current) =>
      current.includes(storyName)
        ? current.filter((s) => s !== storyName)
        : [...current, storyName]
    )
   

                      <Button
    setSideStories((current) => current.filter((s) => s !== storyName))
   

  const availableFullCampaigns = getFullCampaignNames()
  const availableStandaloneCampaigns = getStandaloneCampaignNames()
  
  const isBarkhamCampaign = campaignName === 'Barkham Horror: The Meddling of Meowlathotep'
  const isDreamEatersCampaign = campaignName === 'The Dream-Eaters'
  const allInvestigatorNames = getAllInvestigatorNames()
  const availableInvestigators = allInvestigatorNames.filter(name => {
    const investigator = getInvestigatorByName(name)
    if (!investigator) return true
    
    const isBarkhamInvestigator = investigator.set === 'Barkham Horror'
    
    if (isBarkhamCampaign) {
      return isBarkhamInvestigator
            
      return !isBarkhamInvestigator
     
  })
  
  const dreamEatersPathCounts = isDreamEatersCampaign ? {
    'A: The Dream-Quest': investigators.filter(inv => (inv.dreamEatersPath || 'A: The Dream-Quest') === 'A: The Dream-Quest').length,
    'B: The Web of Dreams': investigators.filter(inv => inv.dreamEatersPath === 'B: The Web of Dreams').length
          

  const dreamEatersPathError = isDreamEatersCampaign && dreamEatersPathCounts && (
    dreamEatersPathCounts['A: The Dream-Quest'] > 4 || dreamEatersPathCounts['B: The Web of Dreams'] > 4
       
    dreamEatersPathCounts['A: The Dream-Quest'] > 4 
      ? `Too many investigators in Path A (${dreamEatersPathCounts['A: The Dream-Quest']}/4). Maximum 4 per path.`
      : `Too many investigators in Path B (${dreamEatersPathCounts['B: The Web of Dreams']}/4). Maximum 4 per path.`
          
  
  const duplicateInvestigatorError = (() => {
    const investigatorNames = investigators
      .filter(inv => !inv.isUnknown && !inv.isCustom && inv.investigatorName.trim() !== '')
      .map(inv => inv.investigatorName)
    
    const duplicates = investigatorNames.filter((name, index) => 
      investigatorNames.indexOf(name) !== index
    )
    
    if (duplicates.length > 0) {
      const uniqueDuplicates = Array.from(new Set(duplicates))
      return `Duplicate investigator${uniqueDuplicates.length > 1 ? 's' : ''} found: ${uniqueDuplicates.join(', ')}. Each investigator can only be selected once.`
     
    
               
  })()
  
  const maxInvestigators = isDreamEatersCampaign ? 8 : 4
  const isFormValid = (campaignType === 'Fan-Made' 
    ? customCampaignName.trim() !== ''
    : campaignType === 'Unknown'
      ? true
      : campaignName.trim() !== '') && 
    investigators.length >= 1 && 
                            }
    !dreamEatersPathError &&
                      >

          
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {editPlaythrough ? 'Edit Playthrough' : 'Log New Game'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
                                  {ca
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-type">Campaign Type</Label>
                <Select value={campaignType} onValueChange={handleCampaignTypeChange}>
                  <SelectTrigger id="campaign-type">
                </div>
                  </SelectTrigger>
                  <Label htmlFor=
                    {CAMPAIGN_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                  />
                    ))}
            </div>
                </Select>
              </div>

                    <Sparkle size={18} weight="duot
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Campaign</Label>
                  <Popover open={campaignSearchOpen} onOpenChange={setCampaignSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        id="campaign-name"
                        className="w-full justify-between"
                      >
                        {campaignName || "Select a campaign"}
                        <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="end">
                      <Command
                        onKeyDown={(e) => {
                          if (e.key === 'Tab') {
                            e.preventDefault()
                            const selected = (e.target as HTMLElement).closest('[data-selected="true"]')
                            if (selected) {
                              const value = selected.getAttribute('data-value')
                              if (value) {
                                handleCampaignNameChange(value)
                                setTimeout(() => {
                                  const firstInvestigatorInput = document.querySelector('#player-0') as HTMLInputElement
                                  if (firstInvestigatorInput) {
                                    firstInvestigatorInput.focus()
                                  }
                                }, 100)
                              }
                            }
                          }
                          
                      >
                        <CommandInput placeholder="Search campaigns..." />
                        <CommandList>
                )}
                          <CommandGroup>

                              {availableFullCampaigns.map((campaign) => (
                                <CommandItem
                                  key={campaign}
                    {isDreamEatersCampaign 
                                  onSelect={() => handleCampaignNameChange(campaign)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      campaignName === campaign ? "opacity-100" : "opacity-0"
                                    )}
                      {dreamEatersPa
                                  {campaign}
                                </CommandItem>
                              ))}
                            </ScrollArea>
                          </CommandGroup>
                <Button
                      </Command>
                  size="sm"
                  </Popover>
                  clas
              ) : campaignType === 'Standalone' ? (
                  Add Investigator
                  <Label htmlFor="campaign-name">Scenario</Label>
                  <Popover open={campaignSearchOpen} onOpenChange={setCampaignSearchOpen}>
                    <PopoverTrigger asChild>
                  <p classNam
                        variant="outline"
                </div>
                        id="campaign-name"
                        className="w-full justify-between"
                      >
                        {campaignName || "Select a scenario"}
                        <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="end">
                      <Command
                        onKeyDown={(e) => {
                          if (e.key === 'Tab') {
                            e.preventDefault()
                            const selected = (e.target as HTMLElement).closest('[data-selected="true"]')
                            if (selected) {
                              const value = selected.getAttribute('data-value')
          </Button>
                                handleCampaignNameChange(value)
                                setTimeout(() => {
                                  const firstInvestigatorInput = document.querySelector('#player-0') as HTMLInputElement
                                  if (firstInvestigatorInput) {
                                    firstInvestigatorInput.focus()

                                }, 100)
  investigator: InvestigatorAss
                            }
                          }
                        }}
                      >
                        <CommandInput placeholder="Search scenarios..." />
                        <CommandList>
                          <CommandEmpty>No scenario found.</CommandEmpty>
  const investigatorData = getInvestigat
                            <ScrollArea className="h-72">
                              {availableStandaloneCampaigns.map((campaign) => (
                                <CommandItem
                                  key={campaign}
                                  value={campaign}
                                  onSelect={() => handleCampaignNameChange(campaign)}
                                >
  }
                                    className={cn(
    <div className="p-4 border rounded-lg space-y-3 b
                                      campaignName === campaign ? "opacity-100" : "opacity-0"
                                    )}
                                  />
          type="button"
                                </CommandItem>
          onClick={() => onRemove
                            </ScrollArea>
        >
                        </CommandList>
      </div>
                    </PopoverContent>
        <div className="spac
                </div>
              ) : campaignType === 'Fan-Made' ? (
                <div className="space-y-2">
                  <Label htmlFor="custom-campaign-name">Campaign Name</Label>
                  <Input

                    placeholder="Enter custom campaign name"
                    value={customCampaignName}
                    onChange={(e) => setCustomCampaignName(e.target.value)}
              placeh
                </div>
            />
            </div>

            {campaignType === 'Full Campaign' && campaignName && (
              <div className="space-y-3 p-4 border rounded-lg bg-card/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkle size={18} weight="duotone" className="text-accent" />
                    <Label className="text-base font-semibold">Side Stories ({sideStories.length})</Label>
                  </div>
                  <Button 
                    variant="outline" 
                  onKeyDown={(
                    className="gap-2"
                      const selected = (e.target as HTMLElement).closest
                    type="button"
                   
                    {sideStoriesOpen ? 'Hide' : 'Show'}
                    <CaretUpDown size={16} className={cn("transition-transform", sideStoriesOpen && "rotate-180")} />
                  </Button>
                </div>

                        }
                  <div className="flex flex-wrap gap-2">
                  }}
                      <Badge key={story} variant="secondary" className="gap-1.5 pl-3 pr-2 py-1">
                        {story}
                        <button
                      <ScrollArea class
                          onClick={() => handleRemoveSideStory(story)}
                          return (
                        >
                              value={name}
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {sideStoriesOpen && (
                  <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Select standalone scenarios that were played as side stories during this campaign
                    </p>
                    <ScrollArea className="h-48">
                      <div className="space-y-2 pr-4">
                        {availableStandaloneCampaigns.map((scenario) => (
                          <div key={scenario} className="flex items-center space-x-2">
                      </ScrollArea>
                              id={`side-story-${scenario}`}
                              checked={sideStories.includes(scenario)}
                              onCheckedChange={() => handleToggleSideStory(scenario)}
                            />
                            <Label
                              htmlFor={`side-story-${scenario}`}
                              className="text-sm font-normal cursor-pointer flex-1"
          <Label htmlFor={`dr
                              {scenario}
            onValueChange={(value) =
                          </div>
              <SelectValue 
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>


            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Investigators</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isDreamEatersCampaign 
                      ? `Add 1-8 investigators for this game (${investigators.length}/8)` 
                      : `Add 1-4 investigators for this game (${investigators.length}/4)`
            id={`cust
                  </p>
                  {isDreamEatersCampaign && dreamEatersPathCounts && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Path A: {dreamEatersPathCounts['A: The Dream-Quest']}/4 • Path B: {dreamEatersPathCounts['B: The Web of Dreams']}/4
                    </p>

                  {dreamEatersPathError && (
                    <p className="text-xs text-destructive mt-1 font-medium">
                      {dreamEatersPathError}
            onValueChang
                  )}
                  {duplicateInvestigatorError && (
                    <p className="text-xs text-destructive mt-1 font-medium">
                      {duplicateInvestigatorError}
                    </p>
                  )}
                </div>
                <Button
                  type="button"

                  size="sm"
          <Label htmlFor={`archetype-${index}`}>C
                  disabled={investigators.length >= maxInvestigators}
                  className="gap-2"
                >
          >
                  Add Investigator
            </SelectTrigg
              </div>

              {investigators.length === 0 ? (
                <div className="p-4 border border-dashed rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    No investigators added yet. Add at least one investigator to log this game.
                  </p>
      {investigatorDat
              ) : (
                <div className="space-y-4">
                  {investigators.map((inv, index) => (
  )
                      key={index}

                      investigator={inv}
                      availableInvestigators={availableInvestigators}
                      onUpdate={handleUpdateInvestigator}

                      canRemove={investigators.length > 1}
                      isDreamEaters={campaignName === 'The Dream-Eaters'}
                    />

                </div>

            </div>

        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel

          <Button onClick={handleSubmit} disabled={!isFormValid}>
            {editPlaythrough ? 'Save Changes' : 'Log Game'}
          </Button>

      </DialogContent>

  )
}

interface InvestigatorFormItemProps {
  index: number
  investigator: InvestigatorAssignment
  availableInvestigators: string[]
  onUpdate: (index: number, field: keyof InvestigatorAssignment, value: string | boolean) => void
  onRemove: (index: number) => void

  isDreamEaters: boolean
}

function InvestigatorFormItem({ index, investigator, availableInvestigators, onUpdate, onRemove, canRemove, isDreamEaters }: InvestigatorFormItemProps) {
  const [investigatorSearchOpen, setInvestigatorSearchOpen] = useState(false)
  const [archetypeSelectOpen, setArchetypeSelectOpen] = useState(false)
  
  const investigatorData = getInvestigatorByName(investigator.investigatorName)
  const needsArchetypeSelection = investigatorData && isDualClassInvestigator(investigator.investigatorName)
  const availableArchetypes = investigatorData?.archetypes || []
  const isUnknown = investigator.isUnknown || investigator.investigatorName === 'Unknown'
  const isCustom = investigator.isCustom || false

  const handleInvestigatorTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (isUnknown) return

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setInvestigatorSearchOpen(true)
    }



    <div className="p-4 border rounded-lg space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">

        </span>

          type="button"

          size="icon"

          disabled={!canRemove}
          className="h-8 w-8 text-destructive hover:text-destructive disabled:opacity-50"
        >

        </Button>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">

          <Input

            placeholder="Player name"

            onChange={(e) => onUpdate(index, 'playerName', e.target.value)}

        </div>

        <div className="space-y-2">
          <Label htmlFor={`investigator-${index}`}>Investigator</Label>
          {isCustom ? (

              id={`custom-investigator-${index}`}
              placeholder="Enter investigator name"
              value={investigator.customInvestigatorName || ''}
              onChange={(e) => onUpdate(index, 'customInvestigatorName', e.target.value)}
            />

            <Popover open={investigatorSearchOpen} onOpenChange={setInvestigatorSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  id={`investigator-${index}`}
                  className="w-full justify-between"
                  disabled={isUnknown}
                  onKeyDown={handleInvestigatorTriggerKeyDown}

                  {isUnknown ? "Unknown" : (investigator.investigatorName || "Select investigator")}
                  <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>

              <PopoverContent className="w-[250px] p-0">

                  onKeyDown={(e) => {

                      e.preventDefault()
                      const selected = (e.target as HTMLElement).closest('[data-selected="true"]')
                      if (selected) {
                        const value = selected.getAttribute('data-value')
                        if (value) {
                          onUpdate(index, 'investigatorName', value)
                          setInvestigatorSearchOpen(false)

                            const nextInput = document.querySelector(`#player-${index + 1}`) as HTMLInputElement

                              nextInput.focus()

                          }, 100)

                      }

                  }}

                  <CommandInput placeholder="Search investigators..." />

                    <CommandEmpty>No investigator found.</CommandEmpty>

                      <ScrollArea className="h-72">
                        {availableInvestigators.map((name) => {
                          const invData = getInvestigatorByName(name)

                            <CommandItem

                              value={name}
                              onSelect={() => {
                                onUpdate(index, 'investigatorName', name)
                                setInvestigatorSearchOpen(false)
                              }}

                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  investigator.investigatorName === name ? "opacity-100" : "opacity-0"
                                )}

                              <span className="flex-1">{name}</span>
                              {invData?.chapter && invData.chapter !== 'Other' && (
                                <Badge 
                                  variant={invData.chapter === 'Chapter 2' ? 'default' : 'secondary'}
                                  className="ml-2 text-xs shrink-0"

                                  {invData.chapter === 'Chapter 2' ? 'Ch. 2' : 'Ch. 1'}

                              )}

                          )

                      </ScrollArea>

                  </CommandList>

              </PopoverContent>

          )}
        </div>
      </div>

      {isDreamEaters && (

          <Label htmlFor={`dream-eaters-path-${index}`}>Campaign Path</Label>

            value={investigator.dreamEatersPath || 'A: The Dream-Quest'} 
            onValueChange={(value) => onUpdate(index, 'dreamEatersPath', value as DreamEatersCampaignPath)}
          >

              <SelectValue />

            <SelectContent>
              <SelectItem value="A: The Dream-Quest">A: The Dream-Quest</SelectItem>
              <SelectItem value="B: The Web of Dreams">B: The Web of Dreams</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox

            checked={isUnknown}

          />
          <Label htmlFor={`unknown-${index}`} className="text-sm font-normal cursor-pointer">
            Investigator unknown

        </div>

        <div className="flex items-center space-x-2">

            id={`custom-${index}`}

            onCheckedChange={(checked) => onUpdate(index, 'isCustom', checked as boolean)}

          <Label htmlFor={`custom-${index}`} className="text-sm font-normal cursor-pointer">

          </Label>

      </div>

      {isCustom && (

          <Label htmlFor={`custom-archetype-${index}`}>Class</Label>


            onValueChange={(value) => onUpdate(index, 'archetype', value as Archetype)}

            <SelectTrigger id={`custom-archetype-${index}`}>

            </SelectTrigger>

              {['Guardian', 'Seeker', 'Rogue', 'Mystic', 'Survivor', 'Neutral'].map((archetype) => (
                <SelectItem key={archetype} value={archetype}>
                  {archetype}

              ))}

          </Select>

      )}

      {needsArchetypeSelection && !isUnknown && !isCustom && (
        <div className="space-y-2">
          <Label htmlFor={`archetype-${index}`}>Class</Label>

            value={investigator.archetype} 

            open={archetypeSelectOpen}

          >

              <SelectValue />

            <SelectContent>



                </SelectItem>

            </SelectContent>

        </div>

      



        </div>

    </div>

}
