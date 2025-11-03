export interface User {
  id: string
  email: string
  createdAt: number
  authProvider?: 'email' | 'google' | 'microsoft'
  displayName?: string
}

export interface AuthSession {
  userId: string
  email: string
  authProvider?: 'email' | 'google' | 'microsoft'
}

const hashPassword = async (password: string, salt: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const generateSalt = (): string => {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const createAccount = async (email: string, password: string): Promise<{ success: boolean; error?: string; userId?: string }> => {
  const normalizedEmail = email.toLowerCase().trim()
  
  if (!normalizedEmail || !password) {
    return { success: false, error: 'Email and password are required' }
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: 'Invalid email address' }
  }
  
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' }
  }
  
  const existingUser = await spark.kv.get<User>(`user:${normalizedEmail}`)
  if (existingUser) {
    return { success: false, error: 'An account with this email already exists' }
  }
  
  const salt = generateSalt()
  const hashedPassword = await hashPassword(password, salt)
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const user: User = {
    id: userId,
    email: normalizedEmail,
    createdAt: Date.now(),
    authProvider: 'email'
  }
  
  await spark.kv.set(`user:${normalizedEmail}`, user)
  await spark.kv.set(`user:${normalizedEmail}:password`, { hash: hashedPassword, salt })
  await spark.kv.set(`email-to-userid:${normalizedEmail}`, userId)
  
  return { success: true, userId }
}

export const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> => {
  const normalizedEmail = email.toLowerCase().trim()
  
  if (!normalizedEmail || !password) {
    return { success: false, error: 'Email and password are required' }
  }
  
  const user = await spark.kv.get<User>(`user:${normalizedEmail}`)
  if (!user) {
    return { success: false, error: 'No account found with this email. Please sign up first.' }
  }
  
  const passwordData = await spark.kv.get<{ hash: string; salt: string }>(`user:${normalizedEmail}:password`)
  if (!passwordData) {
    return { success: false, error: 'No account found with this email. Please sign up first.' }
  }
  
  const hashedPassword = await hashPassword(password, passwordData.salt)
  if (hashedPassword !== passwordData.hash) {
    return { success: false, error: 'Incorrect password. Please try again.' }
  }
  
  return { success: true, user }
}

const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('device-id')
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('device-id', deviceId)
  }
  return deviceId
}

export const getCurrentSession = async (): Promise<AuthSession | null> => {
  const deviceId = getDeviceId()
  const session = await spark.kv.get<AuthSession>(`session:${deviceId}`)
  return session || null
}

export const setCurrentSession = async (user: User): Promise<void> => {
  const deviceId = getDeviceId()
  const session: AuthSession = {
    userId: user.id,
    email: user.email,
    authProvider: user.authProvider
  }
  await spark.kv.set(`session:${deviceId}`, session)
}

export const clearCurrentSession = async (): Promise<void> => {
  const deviceId = getDeviceId()
  await spark.kv.delete(`session:${deviceId}`)
  localStorage.removeItem('device-id')
}

export const signInWithGoogle = async (): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const GOOGLE_CLIENT_ID = '1006855276346-64iq3llg30a08mq9olvu7vbakp9jdl7l.apps.googleusercontent.com'
    const REDIRECT_URI = window.location.origin
    
    const oauth2Endpoint = 'https://accounts.google.com/o/oauth2/v2/auth'
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'token',
      scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      include_granted_scopes: 'true',
      state: 'google_auth'
    })

    return new Promise((resolve) => {
      const width = 500
      const height = 600
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      
      const popup = window.open(
        `${oauth2Endpoint}?${params.toString()}`,
        'Google Sign In',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      const checkPopup = setInterval(async () => {
        try {
          if (!popup || popup.closed) {
            clearInterval(checkPopup)
            resolve({ success: false, error: 'Sign in was cancelled' })
            return
          }

          const popupUrl = popup.location.href
          
          if (popupUrl.includes('access_token')) {
            clearInterval(checkPopup)
            popup.close()

            const hash = new URL(popupUrl).hash.substring(1)
            const params = new URLSearchParams(hash)
            const accessToken = params.get('access_token')

            if (!accessToken) {
              resolve({ success: false, error: 'Failed to get access token' })
              return
            }

            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            })

            if (!userInfoResponse.ok) {
              resolve({ success: false, error: 'Failed to get user information' })
              return
            }

            const userInfo = await userInfoResponse.json()
            const normalizedEmail = userInfo.email.toLowerCase().trim()

            let user = await spark.kv.get<User>(`user:${normalizedEmail}`)
            
            if (!user) {
              const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              user = {
                id: userId,
                email: normalizedEmail,
                createdAt: Date.now(),
                authProvider: 'google',
                displayName: userInfo.name
              }
              await spark.kv.set(`user:${normalizedEmail}`, user)
              await spark.kv.set(`email-to-userid:${normalizedEmail}`, userId)
            }

            resolve({ success: true, user })
          }
        } catch (e) {
          // Ignore cross-origin errors while popup is on Google's domain
        }
      }, 500)
    })
  } catch (error) {
    console.error('Google sign in error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export const signInWithMicrosoft = async (): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const MICROSOFT_CLIENT_ID = 'e3417e01-c277-486c-881e-12eb3b4b12fb'
    const REDIRECT_URI = window.location.origin
    
    const oauth2Endpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'token',
      scope: 'openid email profile',
      state: 'microsoft_auth',
      response_mode: 'fragment'
    })

    return new Promise((resolve) => {
      const width = 500
      const height = 600
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      
      const popup = window.open(
        `${oauth2Endpoint}?${params.toString()}`,
        'Microsoft Sign In',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      const checkPopup = setInterval(async () => {
        try {
          if (!popup || popup.closed) {
            clearInterval(checkPopup)
            resolve({ success: false, error: 'Sign in was cancelled' })
            return
          }

          const popupUrl = popup.location.href
          
          if (popupUrl.includes('access_token')) {
            clearInterval(checkPopup)
            popup.close()

            const hash = new URL(popupUrl).hash.substring(1)
            const params = new URLSearchParams(hash)
            const accessToken = params.get('access_token')

            if (!accessToken) {
              resolve({ success: false, error: 'Failed to get access token' })
              return
            }

            const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
              headers: { Authorization: `Bearer ${accessToken}` }
            })

            if (!userInfoResponse.ok) {
              resolve({ success: false, error: 'Failed to get user information' })
              return
            }

            const userInfo = await userInfoResponse.json()
            const normalizedEmail = userInfo.mail || userInfo.userPrincipalName
            
            if (!normalizedEmail) {
              resolve({ success: false, error: 'Could not retrieve email from Microsoft account' })
              return
            }

            const normalizedEmailLower = normalizedEmail.toLowerCase().trim()

            let user = await spark.kv.get<User>(`user:${normalizedEmailLower}`)
            
            if (!user) {
              const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              user = {
                id: userId,
                email: normalizedEmailLower,
                createdAt: Date.now(),
                authProvider: 'microsoft',
                displayName: userInfo.displayName
              }
              await spark.kv.set(`user:${normalizedEmailLower}`, user)
              await spark.kv.set(`email-to-userid:${normalizedEmailLower}`, userId)
            }

            resolve({ success: true, user })
          }
        } catch (e) {
          // Ignore cross-origin errors while popup is on Microsoft's domain
        }
      }, 500)
    })
  } catch (error) {
    console.error('Microsoft sign in error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

interface PasswordResetToken {
  email: string
  token: string
  expiresAt: number
  used: boolean
}

const generateResetToken = (): string => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

const sendPasswordResetEmail = async (email: string, token: string): Promise<void> => {
  const resetLink = `${window.location.origin}?reset_token=${token}&email=${encodeURIComponent(email)}`
  
  const emailSubject = 'Reset Your Arkham Horror LCG Tracker Password'
  const emailBody = `
Hello,

You requested to reset your password for Arkham Horror LCG Tracker.

Click the link below to reset your password:
${resetLink}

This link will expire in 15 minutes and can only be used once.

If you didn't request this password reset, you can safely ignore this email.

Best regards,
Arkham Horror LCG Tracker Team
  `.trim()

  const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
  
  window.open(mailtoLink, '_blank')
}

export const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
  const normalizedEmail = email.toLowerCase().trim()
  
  if (!normalizedEmail) {
    return { success: false, error: 'Email is required' }
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: 'Invalid email address' }
  }
  
  const user = await spark.kv.get<User>(`user:${normalizedEmail}`)
  if (!user) {
    return { success: true }
  }
  
  if (user.authProvider !== 'email') {
    return { success: false, error: `This account uses ${user.authProvider} authentication. Please sign in with ${user.authProvider}.` }
  }
  
  const token = generateResetToken()
  const resetData: PasswordResetToken = {
    email: normalizedEmail,
    token,
    expiresAt: Date.now() + (15 * 60 * 1000),
    used: false
  }
  
  await spark.kv.set(`password-reset:${normalizedEmail}`, resetData)
  
  await sendPasswordResetEmail(normalizedEmail, token)
  
  return { success: true }
}

export const validateResetToken = async (email: string, token: string): Promise<{ valid: boolean; error?: string }> => {
  const normalizedEmail = email.toLowerCase().trim()
  
  const resetData = await spark.kv.get<PasswordResetToken>(`password-reset:${normalizedEmail}`)
  
  if (!resetData) {
    return { valid: false, error: 'Invalid or expired reset link' }
  }
  
  if (resetData.used) {
    return { valid: false, error: 'This reset link has already been used' }
  }
  
  if (Date.now() > resetData.expiresAt) {
    await spark.kv.delete(`password-reset:${normalizedEmail}`)
    return { valid: false, error: 'This reset link has expired. Please request a new one.' }
  }
  
  if (resetData.token !== token) {
    return { valid: false, error: 'Invalid reset link' }
  }
  
  return { valid: true }
}

export const resetPassword = async (email: string, token: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
  const normalizedEmail = email.toLowerCase().trim()
  
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' }
  }
  
  const validation = await validateResetToken(normalizedEmail, token)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }
  
  const user = await spark.kv.get<User>(`user:${normalizedEmail}`)
  if (!user) {
    return { success: false, error: 'Account not found' }
  }
  
  const salt = generateSalt()
  const hashedPassword = await hashPassword(newPassword, salt)
  
  await spark.kv.set(`user:${normalizedEmail}:password`, { hash: hashedPassword, salt })
  
  const resetData = await spark.kv.get<PasswordResetToken>(`password-reset:${normalizedEmail}`)
  if (resetData) {
    resetData.used = true
    await spark.kv.set(`password-reset:${normalizedEmail}`, resetData)
  }
  
  return { success: true }
}
