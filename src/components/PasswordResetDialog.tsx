import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPasswordReset, resetPassword } from '@/lib/auth'
import { toast } from 'sonner'
import { Eye, EyeSlash, ArrowLeft, EnvelopeSimple, CheckCircle } from '@phosphor-icons/react'

interface PasswordResetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBackToSignIn: () => void
  prefilledEmail?: string
  prefilledToken?: string
}

export function PasswordResetDialog({ open, onOpenChange, onBackToSignIn, prefilledEmail, prefilledToken }: PasswordResetDialogProps) {
  const [step, setStep] = useState<'request' | 'emailSent' | 'reset'>('request')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (prefilledEmail && prefilledToken) {
      setEmail(prefilledEmail)
      setToken(prefilledToken)
      setStep('reset')
    }
  }, [prefilledEmail, prefilledToken])

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
        setStep('emailSent')
        toast.success('Password reset email opened', {
          description: 'Check your email client for the reset link.',
          duration: 6000,
        })
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
            {step === 'request' && 'Reset Password'}
            {step === 'emailSent' && 'Check Your Email'}
            {step === 'reset' && 'Set New Password'}
          </DialogTitle>
          <DialogDescription>
            {step === 'request' && 'Enter your email address to receive a password reset link'}
            {step === 'emailSent' && 'A reset link has been sent to your email'}
            {step === 'reset' && 'Enter your new password below'}
          </DialogDescription>
        </DialogHeader>

        {step === 'request' && (
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
              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? 'Please wait...' : (
                  <>
                    <EnvelopeSimple size={18} weight="duotone" />
                    Send Reset Link
                  </>
                )}
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
        )}

        {step === 'emailSent' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-6 text-center space-y-3">
              <CheckCircle size={48} weight="duotone" className="text-primary mx-auto" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Reset link sent to:</p>
                <p className="text-sm text-muted-foreground break-all">{email}</p>
              </div>
            </div>
            
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Your email client should have opened with a reset link.</p>
              <p>Click the link in the email to continue resetting your password.</p>
              <p className="text-xs">The link will expire in 15 minutes.</p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('request')}
                className="w-full gap-2"
              >
                <ArrowLeft size={16} />
                Try Different Email
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  handleClose()
                  onBackToSignIn()
                }}
                className="w-full gap-2"
              >
                Back to Sign In
              </Button>
            </div>
          </div>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email-confirm">Email</Label>
              <Input
                id="reset-email-confirm"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
        )}
      </DialogContent>
    </Dialog>
  )
}
