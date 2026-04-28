import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { User as AuthUser } from '@/lib/auth'

interface PasswordLinkDialogProps {
  currentUser: AuthUser
  open: boolean
  onOpenChange: (open: boolean) => void
  password: string
  onPasswordChange: (value: string) => void
  passwordConfirm: string
  onPasswordConfirmChange: (value: string) => void
  loading: boolean
  onSubmit: () => void
}

export function PasswordLinkDialog({
  currentUser,
  open,
  onOpenChange,
  password,
  onPasswordChange,
  passwordConfirm,
  onPasswordConfirmChange,
  loading,
  onSubmit,
}: PasswordLinkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) { onPasswordChange(''); onPasswordConfirmChange(''); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Password</DialogTitle>
          <DialogDescription>
            Add a password to your Google account so you can also sign in with email and password.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input value={currentUser.email} disabled className="opacity-70" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <Input 
              type="password" 
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm Password</label>
            <Input 
              type="password" 
              placeholder="Re-enter password"
              value={passwordConfirm}
              onChange={(e) => onPasswordConfirmChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSubmit() }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? 'Linking...' : 'Set Password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
