import { useState, useEffect } from 'react'
import { User as AuthUser, linkEmailPassword, getLinkedProviders } from '@/lib/auth'
import { toast } from 'sonner'

export function usePasswordLink(currentUser: AuthUser) {
  const [linkPasswordOpen, setLinkPasswordOpen] = useState(false)
  const [linkPassword, setLinkPassword] = useState('')
  const [linkPasswordConfirm, setLinkPasswordConfirm] = useState('')
  const [linkPasswordLoading, setLinkPasswordLoading] = useState(false)
  const [linkedProviders, setLinkedProviders] = useState<string[]>([])

  useEffect(() => {
    setLinkedProviders(getLinkedProviders())
  }, [currentUser])

  const hasPasswordLinked = linkedProviders.includes('password')
  const isGoogleUser = currentUser.authProvider === 'google'

  const handleLinkPassword = async () => {
    if (linkPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (linkPassword !== linkPasswordConfirm) {
      toast.error('Passwords do not match')
      return
    }
    setLinkPasswordLoading(true)
    const result = await linkEmailPassword(linkPassword)
    setLinkPasswordLoading(false)
    if (result.success) {
      toast.success('Password linked! You can now sign in with email/password too.')
      setLinkPasswordOpen(false)
      setLinkPassword('')
      setLinkPasswordConfirm('')
      setLinkedProviders(getLinkedProviders())
    } else {
      toast.error(result.error || 'Failed to link password')
    }
  }

  return {
    linkPasswordOpen,
    setLinkPasswordOpen,
    linkPassword,
    setLinkPassword,
    linkPasswordConfirm,
    setLinkPasswordConfirm,
    linkPasswordLoading,
    handleLinkPassword,
    hasPasswordLinked,
    isGoogleUser,
  }
}
