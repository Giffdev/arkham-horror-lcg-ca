import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Download, Upload, CheckCircle, Warning } from '@phosphor-icons/react'
import { Playthrough } from '@/lib/types'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'

interface DataExportImportProps {
  playthroughs: Playthrough[]
  onImport: (playthroughs: Playthrough[]) => void
}

export function DataExportImport({ playthroughs, onImport }: DataExportImportProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importData, setImportData] = useState('')
  const [isValidating, setIsValidating] = useState(false)

  const handleExport = () => {
    const dataStr = JSON.stringify(playthroughs, null, 2)
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

  const validateImportData = (jsonString: string): { valid: boolean; data?: Playthrough[]; error?: string } => {
    try {
      const parsed = JSON.parse(jsonString)
      
      if (!Array.isArray(parsed)) {
        return { valid: false, error: 'Data must be an array of playthroughs' }
      }

      for (const item of parsed) {
        if (!item.id || !item.date || !item.campaignName || !item.investigators) {
          return { valid: false, error: 'Invalid playthrough format detected' }
        }
        
        if (!Array.isArray(item.investigators)) {
          return { valid: false, error: 'Investigators must be an array' }
        }
      }

      return { valid: true, data: parsed as Playthrough[] }
    } catch (e) {
      return { valid: false, error: 'Invalid JSON format' }
    }
  }

  const handleImport = () => {
    setIsValidating(true)
    
    const validation = validateImportData(importData)
    
    if (!validation.valid) {
      toast.error(validation.error || 'Import failed')
      setIsValidating(false)
      return
    }

    if (validation.data) {
      onImport(validation.data)
      toast.success(`Successfully imported ${validation.data.length} playthrough${validation.data.length !== 1 ? 's' : ''}`)
      setImportDialogOpen(false)
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
    <div className="flex gap-2 flex-wrap">
      <Button onClick={handleExport} variant="outline" className="gap-2" disabled={!playthroughs || playthroughs.length === 0}>
        <Download size={18} weight="bold" />
        Export Data
      </Button>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Upload size={18} weight="bold" />
            Import Data
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Playthrough Data</DialogTitle>
            <DialogDescription>
              Upload a JSON file or paste your exported data below. This will add the imported playthroughs to your existing data.
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
                placeholder='[{"id": "...", "date": "...", ...}]'
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
                            Ready to import {validation.data?.length} playthrough{validation.data?.length !== 1 ? 's' : ''}
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
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
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
    </div>
  )
}
