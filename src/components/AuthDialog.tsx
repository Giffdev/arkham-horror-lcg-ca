import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createAccount, signIn, signInWithGoogle, resetPassword, User } from '@/lib/auth'
import { toast } from 'sonner'
import { Eye, EyeSlash, Warning, GoogleLogo } from '@phosphor-icons/react'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (user: User) => void
}

export function AuthDialog({ open, onOpenChange, onSuccess }: AuthDialogProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    try {
      if (mode === 'reset') {
        const result = await resetPassword(email)
        if (result.success) {
          toast.success('Password reset email sent! Check your inbox.')
          setMode('signin')
          resetForm()
        } else {
          setErrorMessage(result.error || 'Failed to send reset email')
        }
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          setErrorMessage('Passwords do not match')
          setLoading(false)
          return
        }

        const result = await createAccount(email, password)
        if (result.success && result.userId) {
          // Firebase auto-signs in after createAccount, but we do a signIn
          // to get the user object for the callback
          const signInResult = await signIn(email, password)
          if (signInResult.success && signInResult.user) {
            toast.success('Account created successfully')
            onSuccess(signInResult.user)
            onOpenChange(false)
            resetForm()
          }
        } else {
          setErrorMessage(result.error || 'Failed to create account')
        }
      } else {
        const result = await signIn(email, password)
        if (result.success && result.user) {
          toast.success('Signed in successfully')
          onSuccess(result.user)
          onOpenChange(false)
          resetForm()
        } else {
          setErrorMessage(result.error || 'Failed to sign in. Please try again.')
        }
      }
    } catch (error) {
      setErrorMessage('An unexpected error occurred')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const result = await signInWithGoogle()
      if (result.success && result.user) {
        toast.success('Signed in with Google')
        onSuccess(result.user)
        onOpenChange(false)
        resetForm()
      } else {
        setErrorMessage(result.error || 'Google sign in failed')
      }
    } catch (error) {
      setErrorMessage('An unexpected error occurred')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setErrorMessage(null)
  }

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}</DialogTitle>
          <DialogDescription>
            {mode === 'signin' 
              ? 'Sign in to access your game logs' 
              : mode === 'signup'
              ? 'Create an account to start tracking your games'
              : 'Enter your email and we\'ll send you a reset link'}
          </DialogDescription>
        </DialogHeader>

        {mode !== 'reset' && (
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <GoogleLogo size={18} weight="bold" />
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setErrorMessage(null)
              }}
              required
              autoComplete="email"
            />
          </div>
          {mode !== 'reset' && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrorMessage(null)
                  }}
                  required
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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
              {mode === 'signin' && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => { setMode('reset'); setErrorMessage(null) }}
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}
          {mode === 'signup' && (            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
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
          )}
          
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <Warning size={16} weight="fill" className="text-destructive mt-0.5 flex-shrink-0" />
              <span className="text-sm text-destructive">{errorMessage}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Email'}
            </Button>
            {mode === 'reset' ? (
              <Button type="button" variant="secondary" onClick={() => { setMode('signin'); resetForm() }} disabled={loading} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
                Back to Sign In
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={switchMode} disabled={loading} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
                {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
