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

export const resetPasswordForEmail = async (email: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
  try {
    const normalizedEmail = email.toLowerCase().trim()
    
    const user = await spark.kv.get(`user:${normalizedEmail}`)
    if (!user) {
      return { success: false, message: `No user found with email: ${normalizedEmail}` }
    }
    
    const salt = generateSalt()
    const hashedPassword = await hashPassword(newPassword, salt)
    
    await spark.kv.set(`user:${normalizedEmail}:password`, { hash: hashedPassword, salt })
    
    return { success: true, message: `Password successfully reset for ${normalizedEmail}` }
  } catch (error) {
    return { success: false, message: `Error resetting password: ${error}` }
  }
}
