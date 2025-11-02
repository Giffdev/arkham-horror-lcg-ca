import { formatDistanceToNow, format } from 'date-fns'

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysDiff < 7) {
    return formatDistanceToNow(date, { addSuffix: true })
  }
  
  return format(date, 'MMM d, yyyy')
}
