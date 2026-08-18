import { useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, Upload, CheckCircle, Warning } from '@phosphor-icons/react'
import { CampaignRun, Playthrough } from '@/lib/types'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import {
  type NormalizedImportPayload,
  parseImportJson,
  stringifyExportEnvelopeV2,
} from '@/lib/import-export'

interface DataExportImportProps {
  playthroughs: Playthrough[]
  campaignRuns: CampaignRun[]
  onImport: (payload: NormalizedImportPayload) => Promise<void> | void
}

interface DataImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (payload: NormalizedImportPayload) => Promise<void> | void
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>['onCloseAutoFocus']
}

interface ValidationResult {
  valid: boolean
  payload?: NormalizedImportPayload
  error?: string
}

function validateImportData(jsonString: string): ValidationResult {
  try {
    const payload = parseImportJson(jsonString)
    return { valid: true, payload }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed'
    return { valid: false, error: message }
  }
}

export function exportData(playthroughs: Playthrough[], campaignRuns: CampaignRun[]) {
  const dataStr = stringifyExportEnvelopeV2({
    playthroughs,
    campaignRuns,
  })
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `arkham-tracker-export-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success('Data exported successfully')
}

export function DataImportDialog({ open, onOpenChange, onImport, onCloseAutoFocus }: DataImportDialogProps) {
  const [importData, setImportData] = useState('')
  const [isValidating, setIsValidating] = useState(false)

  const handleImport = async () => {
    setIsValidating(true)

    const validation = validateImportData(importData)

    if (!validation.valid) {
      toast.error(validation.error || 'Import failed')
      setIsValidating(false)
      return
    }

    if (validation.payload) {
      try {
        await onImport(validation.payload)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Import failed'
        toast.error(message)
        setIsValidating(false)
        return
      }

      const playthroughCount = validation.payload.playthroughs.length
      const runCount = validation.payload.campaignRuns.length
      const importedEnvelopeLabel = validation.payload.version === 2 ? 'v2 export envelope' : 'legacy v1 array'
      toast.success(
        `Imported ${playthroughCount} playthrough${playthroughCount !== 1 ? 's' : ''} and ${runCount} campaign run${runCount !== 1 ? 's' : ''} (${importedEnvelopeLabel}).`,
      )
      onOpenChange(false)
      setImportData('')
    }

    setIsValidating(false)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setImportData(text)
    }
    reader.readAsText(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Import Playthrough Data</DialogTitle>
          <DialogDescription>
            Upload a JSON file or paste your exported data below. Legacy v1 arrays and v2 export envelopes are both supported.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload File</label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or paste JSON
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">JSON Data</label>
            <Textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder='{"version":2,"playthroughs":[...],"campaignRuns":[...]}'
              className="font-mono text-xs min-h-[200px]"
            />
          </div>

          {importData && (
            <Card className="p-3 border-muted">
              <div className="flex items-start gap-2 text-sm">
                {(() => {
                  const validation = validateImportData(importData)
                  return validation.valid ? (
                    <>
                      <CheckCircle size={20} weight="fill" className="text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-500">Valid data format</p>
                        <p className="text-muted-foreground">
                          Ready to import {validation.payload?.playthroughs.length ?? 0} playthrough{validation.payload?.playthroughs.length !== 1 ? 's' : ''} and {validation.payload?.campaignRuns.length ?? 0} campaign run{validation.payload?.campaignRuns.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Warning size={20} weight="fill" className="text-destructive flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-destructive">Invalid data format</p>
                        <p className="text-muted-foreground">{validation.error}</p>
                      </div>
                    </>
                  )
                })()}
              </div>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importData || isValidating}
            >
              {isValidating ? 'Validating...' : 'Import'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DataExportImport({ playthroughs, campaignRuns, onImport }: DataExportImportProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={() => exportData(playthroughs, campaignRuns)}
          variant="outline"
          className="gap-2"
          disabled={(playthroughs?.length ?? 0) + (campaignRuns?.length ?? 0) === 0}
        >
          <Download size={18} weight="bold" />
          Export Data
        </Button>

        <Button variant="outline" className="gap-2" onClick={() => setImportDialogOpen(true)}>
          <Upload size={18} weight="bold" />
          Import Data
        </Button>
      </div>

      <DataImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={onImport}
      />
    </>
  )
}
