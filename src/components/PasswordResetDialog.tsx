import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPasswordReset, resetPassword } from '@/lib/auth'
import { toast } from 'sonner'
import { Eye, EyeSlash, ArrowLeft } from '@phosphor-icons/react'

interface PasswordResetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBackToSignIn: () => void
}

export function PasswordResetDialog({ open, onOpenChange, onBackToSignIn }: PasswordResetDialogProps) {
  const [step, setStep] = useState<'request' | 'reset'>('request')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const resetForm = () => {
    setEmail('')
    setToken('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setStep('request')
  }

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await requestPasswordReset(email)
      if (result.success) {
        if (result.token) {
          setToken(result.token)
          setStep('reset')
          toast.success('Password reset link generated', {
            description: 'You can now reset your password below.',
            duration: 5000,
          })
        } else {
          toast.success('If an account exists with this email, a reset link has been generated', {
            description: 'Please check the information below to continue.',
            duration: 5000,
          })
        }
      } else {
        toast.error(result.error || 'Failed to request password reset')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const result = await resetPassword(email, token, newPassword)
      if (result.success) {
        toast.success('Password reset successfully', {
          description: 'You can now sign in with your new password.',
          duration: 5000,
        })
        resetForm()
        onOpenChange(false)
        onBackToSignIn()
      } else {
        toast.error(result.error || 'Failed to reset password')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'request' ? 'Reset Password' : 'Set New Password'}
          </DialogTitle>
          <DialogDescription>
            {step === 'request'
              ? 'Enter your email address to reset your password'
              : 'Enter your new password below'}
          </DialogDescription>
        </DialogHeader>

        {step === 'request' ? (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Please wait...' : 'Request Reset'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  handleClose()
                  onBackToSignIn()
                }}
                disabled={loading}
                className="w-full gap-2"
              >
                <ArrowLeft size={16} />
                Back to Sign In
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                For security, copy this reset token and save it somewhere safe:
              </p>
              <code className="block text-xs bg-background p-2 rounded border break-all">
                {token}
              </code>
              <p className="text-xs text-muted-foreground">
                This token expires in 15 minutes and can only be used once.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-token">Reset Token</Label>
              <Input
                id="reset-token"
                type="text"
                placeholder="Paste your reset token here"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlash size={18} className="text-muted-foreground" />
                  ) : (
                    <Eye size={18} className="text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-new-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeSlash size={18} className="text-muted-foreground" />
                  ) : (
                    <Eye size={18} className="text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Please wait...' : 'Reset Password'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('request')}
                disabled={loading}
                className="w-full gap-2"
              >
                <ArrowLeft size={16} />
                Back
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
