import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Playthrough, InvestigatorAssignment, CAMPAIGN_TYPES, Archetype, CampaignType, DreamEatersCampaignPath } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { FULL_CAMPAIGNS, SCENARIO_PACK_SCENARIOS, SMALL_CAMPAIGNS } from '@/lib/campaign-data'
import { INVESTIGATORS, getInvestigatorById, getInvestigatorDisplayName, getChapterBadgeLabel, isChapterBadgeSpecial, type Investigator } from '@/lib/investigator-data'
import { Check, CaretDown, X, Plus, Trash, Sparkle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface PlaythroughFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (playthrough: Omit<Playthrough, 'id'> | Playthrough) => void
  editPlaythrough?: Playthrough | null
  knownPlayerNames?: string[]
}

export function PlaythroughForm({ open, onOpenChange, onSave, editPlaythrough, knownPlayerNames = [] }: PlaythroughFormProps) {
  const [campaignType, setCampaignType] = useState<CampaignType>('Full Campaign')
  const [customCampaignName, setCustomCampaignName] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [campaignSet, setCampaignSet] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [investigators, setInvestigators] = useState<InvestigatorAssignment[]>([])
  const [sideStories, setSideStories] = useState<string[]>([])
  const [sideStoriesOpen, setSideStoriesOpen] = useState(false)
  const [campaignSearchOpen, setCampaignSearchOpen] = useState(false)

  useEffect(() => {
    if (open && editPlaythrough) {
      setCampaignType(editPlaythrough.campaignType)
      setCampaignName(editPlaythrough.campaignName)
      setCampaignSet(editPlaythrough.campaignSet || '')
      setCustomCampaignName(editPlaythrough.customCampaignName || '')
      setDate(editPlaythrough.date)
      setSideStories(editPlaythrough.sideStories || [])
      setInvestigators(editPlaythrough.investigators.map(inv => ({
        ...inv,
        archetypes: inv.archetypes || [inv.archetype]
      })))
    } else if (open) {
      setCampaignType('Full Campaign')
      setCampaignName('')
      setCampaignSet('')
      setCustomCampaignName('')
      setDate(new Date().toISOString().split('T')[0])
      setSideStories([])
      setInvestigators([{ 
        playerName: '', 
        investigatorName: '', 
        archetype: 'Unknown',
        isUnknown: false, 
        investigatorSet: undefined 
      }])
    }
  }, [open, editPlaythrough])

  const handleCampaignNameChange = (name: string) => {
    setCampaignSearchOpen(false)
    setCampaignName(name)
    
    const selectedCampaign = [...FULL_CAMPAIGNS, ...SMALL_CAMPAIGNS, ...SCENARIO_PACK_SCENARIOS].find(c => c.name === name)
    if (selectedCampaign) {
      setCampaignSet(selectedCampaign.set)
    }
  }

  const handleAddInvestigator = () => {
    const isDreamEaters = campaignName === 'The Dream-Eaters'
    setInvestigators([...investigators, { 
      playerName: '', 
      investigatorName: '', 
      archetype: 'Unknown',
      isUnknown: false, 
      investigatorSet: undefined,
      ...(isDreamEaters ? { dreamEatersPath: undefined } : {})
    }])
  }

  const handleRemoveInvestigator = (index: number) => {
    setInvestigators(investigators.filter((_, i) => i !== index))
  }

  const handleInvestigatorChange = (index: number, field: keyof InvestigatorAssignment, value: any) => {
    const updatedInvestigators = investigators.map((inv, i) => {
      if (i !== index) return inv

      if (field === 'investigatorName') {
        // value is the investigator ID from the picker
        const investigatorData = getInvestigatorById(value)
        if (investigatorData) {
          return {
            ...inv,
            investigatorName: investigatorData.name,
            investigatorId: investigatorData.id,
            chapter: investigatorData.chapter,
            archetype: investigatorData.archetypes[0],
            archetypes: investigatorData.archetypes,
            investigatorSet: investigatorData.set,
            isUnknown: false,
            isCustom: false
          }
        } else {
          return {
            ...inv,
            investigatorName: value,
            investigatorId: undefined,
            chapter: undefined,
            isCustom: true,
            archetype: 'Unknown',
            archetypes: ['Unknown'],
            investigatorSet: undefined
          }
        }
      }

      if (field === 'isUnknown') {
        return {
          ...inv,
          isUnknown: value,
          investigatorName: value ? 'Unknown' : '',
          archetype: value ? 'Unknown' : 'Unknown',
          archetypes: value ? ['Unknown'] : ['Unknown'],
          investigatorSet: undefined
        }
      }

      return { ...inv, [field]: value }
    })

    setInvestigators(updatedInvestigators)
  }

  const handleToggleSideStory = (story: string) => {
    setSideStories(current => 
      current.includes(story) 
        ? current.filter(s => s !== story)
        : [...current, story]
    )
  }

  const handleSubmit = () => {
    if (!campaignName && campaignType !== 'Unknown' && campaignType !== 'Fan-Made') {
      toast.error('Please select a campaign')
      return
    }

    if (campaignType === 'Fan-Made' && !customCampaignName) {
      toast.error('Please enter a custom campaign name')
      return
    }

    if (investigators.length === 0) {
      toast.error('Please add at least one investigator')
      return
    }

    const investigatorIds = investigators
      .filter(inv => !inv.isUnknown && inv.investigatorId)
      .map(inv => inv.investigatorId!)
    const duplicates = investigatorIds.filter((id, index) => investigatorIds.indexOf(id) !== index)
    
    if (duplicates.length > 0) {
      const dupInv = getInvestigatorById(duplicates[0])
      toast.error(`The same investigator (${dupInv?.name || duplicates[0]}) cannot be selected more than once`)
      return
    }

    if (campaignName === 'The Dream-Eaters') {
      const pathA = investigators.filter(inv => inv.dreamEatersPath === 'A: The Dream-Quest')
      const pathB = investigators.filter(inv => inv.dreamEatersPath === 'B: The Web of Dreams')
      
      if (pathA.length > 4) {
        toast.error('Cannot assign more than 4 investigators to A: The Dream-Quest')
        return
      }
      
      if (pathB.length > 4) {
        toast.error('Cannot assign more than 4 investigators to B: The Web of Dreams')
        return
      }
    }

    const playthrough: Omit<Playthrough, 'id'> | Playthrough = {
      ...(editPlaythrough ? { id: editPlaythrough.id } : {}),
      date,
      campaignName: campaignType === 'Unknown' ? 'Unknown Campaign' : campaignName,
      campaignType,
      ...(campaignSet ? { campaignSet } : {}),
      ...(campaignType === 'Fan-Made' && customCampaignName ? { customCampaignName } : {}),
      ...(campaignType === 'Full Campaign' && sideStories.length > 0 ? { sideStories } : {}),
      investigators: investigators.map(inv => ({
        playerName: inv.playerName,
        investigatorName: inv.isUnknown ? 'Unknown' : inv.investigatorName,
        archetype: inv.archetype,
        archetypes: inv.archetypes,
        investigatorSet: inv.investigatorSet,
        isUnknown: inv.isUnknown,
        isCustom: inv.isCustom,
        ...(inv.customInvestigatorName ? { customInvestigatorName: inv.customInvestigatorName } : {}),
        ...(inv.dreamEatersPath ? { dreamEatersPath: inv.dreamEatersPath } : {})
      }))
    }

    onSave(playthrough as any)
    onOpenChange(false)
  }

  const availableCampaigns = 
    campaignType === 'Full Campaign' ? FULL_CAMPAIGNS :
    campaignType === 'Small Campaign' ? SMALL_CAMPAIGNS :
    SCENARIO_PACK_SCENARIOS

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{editPlaythrough ? 'Edit Playthrough' : 'Log New Playthrough'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto flex-1 min-h-0 pr-1">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-type">Campaign Type</Label>
            <Select value={campaignType} onValueChange={(value) => {
              setCampaignType(value as CampaignType)
              setCampaignName('')
              setCampaignSet('')
              setCustomCampaignName('')
              setSideStories([])
            }}>
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

          {campaignType !== 'Unknown' && campaignType !== 'Fan-Made' && (
            <div className="space-y-2">
              <Label>Campaign</Label>
              <Popover open={campaignSearchOpen} onOpenChange={setCampaignSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {campaignName || 'Select campaign...'}
                    <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command filter={(value, search) => {
                    if (!search) return 1
                    return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }}>
                    <CommandInput placeholder="Search campaigns..." />
                    <CommandEmpty>No campaign found.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {availableCampaigns.map((campaign) => (
                          <CommandItem
                            key={campaign.name}
                            value={campaign.name}
                            onSelect={() => handleCampaignNameChange(campaign.name)}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                campaignName === campaign.name ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {campaign.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {campaignType === 'Fan-Made' && (
            <div className="space-y-2">
              <Label htmlFor="custom-campaign">Custom Campaign Name</Label>
              <Input
                id="custom-campaign"
                value={customCampaignName}
                onChange={(e) => setCustomCampaignName(e.target.value)}
                placeholder="Enter custom campaign name"
              />
            </div>
          )}

          {campaignType === 'Full Campaign' && campaignName && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => setSideStoriesOpen(!sideStoriesOpen)}
              >
                <span className="flex items-center gap-2">
                  <Sparkle size={16} weight="duotone" />
                  Side Stories {sideStories.length > 0 && `(${sideStories.length})`}
                </span>
                <CaretDown className={cn("h-4 w-4 transition-transform", sideStoriesOpen && "rotate-180")} />
              </Button>
              
              {sideStoriesOpen && (
                <div className="border rounded-md p-4 space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Select any standalone scenarios played during this campaign
                  </div>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {SCENARIO_PACK_SCENARIOS.map((scenario) => (
                        <div key={scenario.name} className="flex items-center space-x-2">
                          <Checkbox
                            id={`side-${scenario.name}`}
                            checked={sideStories.includes(scenario.name)}
                            onCheckedChange={() => handleToggleSideStory(scenario.name)}
                          />
                          <Label
                            htmlFor={`side-${scenario.name}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {scenario.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Investigators</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddInvestigator}
                disabled={campaignName === 'The Dream-Eaters' && investigators.length >= 8}
              >
                <Plus size={16} weight="bold" />
                <span className="ml-2">Add Investigator</span>
              </Button>
            </div>

            <div className="space-y-3">
              {investigators.map((inv, index) => (
                <InvestigatorRow
                  key={index}
                  investigator={inv}
                  index={index}
                  isDreamEaters={campaignName === 'The Dream-Eaters'}
                  onRemove={() => handleRemoveInvestigator(index)}
                  onChange={(field, value) => handleInvestigatorChange(index, field, value)}
                  canRemove={investigators.length > 1}
                  knownPlayerNames={knownPlayerNames}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {editPlaythrough ? 'Update' : 'Save'} Playthrough
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface InvestigatorRowProps {
  investigator: InvestigatorAssignment
  index: number
  isDreamEaters: boolean
  onRemove: () => void
  onChange: (field: keyof InvestigatorAssignment, value: any) => void
  canRemove: boolean
  knownPlayerNames: string[]
}

function InvestigatorRow({ investigator, index, isDreamEaters, onRemove, onChange, canRemove, knownPlayerNames }: InvestigatorRowProps) {
  const [invSearchOpen, setInvSearchOpen] = useState(false)
  const [playerSearchOpen, setPlayerSearchOpen] = useState(false)
  const [chapterFilter, setChapterFilter] = useState<1 | 2 | null>(null)
  const investigatorData = investigator.investigatorId ? getInvestigatorById(investigator.investigatorId) : null

  const filteredInvestigators = chapterFilter
    ? INVESTIGATORS.filter(inv => inv.chapter === chapterFilter)
    : INVESTIGATORS

  const displayName = investigatorData 
    ? getInvestigatorDisplayName(investigatorData) 
    : investigator.investigatorName || 'Select investigator...'

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Player Name (Optional)</Label>
            <Popover open={playerSearchOpen} onOpenChange={setPlayerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={playerSearchOpen}
                  className="w-full justify-between font-normal"
                  disabled={investigator.isUnknown}
                >
                  {investigator.playerName || 'Player name'}
                  <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <Command filter={(value, search) => {
                  if (!search) return 1
                  return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                }}>
                  <CommandInput
                    placeholder="Search or type new..."
                    value={investigator.playerName}
                    onValueChange={(v) => onChange('playerName', v)}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {investigator.playerName ? (
                        <button
                          className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded cursor-pointer"
                          onClick={() => setPlayerSearchOpen(false)}
                        >
                          Use "{investigator.playerName}"
                        </button>
                      ) : (
                        'Type a player name'
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {knownPlayerNames
                        .filter(name => name.toLowerCase().includes((investigator.playerName || '').toLowerCase()))
                        .map(name => (
                          <CommandItem
                            key={name}
                            value={name}
                            onSelect={() => {
                              onChange('playerName', name)
                              setPlayerSearchOpen(false)
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', investigator.playerName === name ? 'opacity-100' : 'opacity-0')} />
                            {name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Investigator</Label>
            <Popover open={invSearchOpen} onOpenChange={setInvSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                  disabled={investigator.isUnknown}
                >
                  <span className="truncate">{displayName}</span>
                  <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command filter={(value, search) => {
                  if (!search) return 1
                  return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                }}>
                  <CommandInput placeholder="Search investigators..." />
                  <div className="flex gap-1 px-2 py-1.5 border-b">
                    {([null, 1, 2] as const).map((ch) => (
                      <button
                        key={ch ?? 'all'}
                        onClick={() => setChapterFilter(ch)}
                        className={cn(
                          'px-2 py-0.5 text-xs rounded-full border transition-colors',
                          chapterFilter === ch
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/50 hover:bg-muted'
                        )}
                      >
                        {ch === null ? 'All' : `Ch. ${ch}`}
                      </button>
                    ))}
                  </div>
                  <CommandEmpty>No investigator found.</CommandEmpty>
                  <CommandList>
                    <CommandGroup>
                      {filteredInvestigators.map((inv) => (
                        <CommandItem
                          key={inv.id}
                          value={`${inv.name} ${inv.chapter === 2 ? 'chapter 2 ch2' : 'chapter 1 ch1'} ${inv.set}`}
                          onSelect={() => {
                            onChange('investigatorName', inv.id)
                            setInvSearchOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              investigator.investigatorId === inv.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <span className="flex-1">{inv.name}</span>
                          <span className={cn(
                            'ml-2 text-xs font-medium',
                            isChapterBadgeSpecial(inv)
                              ? 'text-violet-400'
                              : 'text-muted-foreground opacity-60'
                          )}>
                            · {getChapterBadgeLabel(inv)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="shrink-0 mt-7"
          >
            <Trash size={16} weight="bold" />
          </Button>
        )}
      </div>

      {investigatorData && investigatorData.archetypes.length > 1 && !investigator.isUnknown && (
        <div className="space-y-2">
          <Label>Class</Label>
          <Select
            value={investigator.archetype}
            onValueChange={(value) => onChange('archetype', value as Archetype)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {investigatorData.archetypes.map((archetype) => (
                <SelectItem key={archetype} value={archetype}>
                  {archetype}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isDreamEaters && !investigator.isUnknown && (
        <div className="space-y-2">
          <Label>Campaign Path</Label>
          <Select
            value={investigator.dreamEatersPath || ''}
            onValueChange={(value) => onChange('dreamEatersPath', value as DreamEatersCampaignPath)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select path..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A: The Dream-Quest">A: The Dream-Quest</SelectItem>
              <SelectItem value="B: The Web of Dreams">B: The Web of Dreams</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id={`unknown-${index}`}
          checked={investigator.isUnknown || false}
          onCheckedChange={(checked) => onChange('isUnknown', checked)}
        />
        <Label htmlFor={`unknown-${index}`} className="text-sm font-normal cursor-pointer">
          Mark as unknown investigator
        </Label>
      </div>
    </div>
  )
}
