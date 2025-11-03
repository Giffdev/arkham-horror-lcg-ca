import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { createAccount, signIn, setCurrentSession, User, signInWithGoogle, signInWithMicrosoft } from '@/lib/auth'
import { toast } from 'sonner'
import { Eye, EyeSlash } from '@phosphor-icons/react'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (user: User) => void
}

export function AuthDialog({ open, onOpenChange, onSuccess }: AuthDialogProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          toast.error('Passwords do not match')
          setLoading(false)
          return
        }

        const result = await createAccount(email, password)
        if (result.success && result.userId) {
          const signInResult = await signIn(email, password)
          if (signInResult.success && signInResult.user) {
            await setCurrentSession(signInResult.user)
            toast.success('Account created successfully')
            onSuccess(signInResult.user)
            onOpenChange(false)
            resetForm()
          }
        } else {
          toast.error(result.error || 'Failed to create account')
        }
      } else {
        const result = await signIn(email, password)
        if (result.success && result.user) {
          await setCurrentSession(result.user)
          toast.success('Signed in successfully')
          onSuccess(result.user)
          onOpenChange(false)
          resetForm()
        } else {
          toast.error(result.error || 'Failed to sign in')
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
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
  }

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    resetForm()
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const result = await signInWithGoogle()
      if (result.success && result.user) {
        await setCurrentSession(result.user)
        toast.success('Signed in with Google successfully')
        onSuccess(result.user)
        onOpenChange(false)
        resetForm()
      } else {
        toast.error(result.error || 'Failed to sign in with Google')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleMicrosoftSignIn = async () => {
    setLoading(true)
    try {
      const result = await signInWithMicrosoft()
      if (result.success && result.user) {
        await setCurrentSession(result.user)
        toast.success('Signed in with Microsoft successfully')
        onSuccess(result.user)
        onOpenChange(false)
        resetForm()
      } else {
        toast.error(result.error || 'Failed to sign in with Microsoft')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'signin' ? 'Sign In' : 'Create Account'}</DialogTitle>
          <DialogDescription>
            {mode === 'signin' 
              ? 'Sign in to access your game logs' 
              : 'Create an account to start tracking your games'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
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
          </div>
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
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
          )}
          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
            <Button type="button" variant="secondary" onClick={switchMode} disabled={loading} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </Button>
          </div>
        </form>

        <div className="relative my-4">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-popover px-2 text-xs text-muted-foreground">
            Or continue with
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleMicrosoftSignIn}
            disabled={loading}
            className="w-full"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 21 21">
              <path fill="#f25022" d="M0 0h10v10H0z" />
              <path fill="#00a4ef" d="M11 0h10v10H11z" />
              <path fill="#7fba00" d="M0 11h10v10H0z" />
              <path fill="#ffb900" d="M11 11h10v10H11z" />
            </svg>
            Sign in with Microsoft
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}
