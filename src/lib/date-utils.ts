import { formatDistanceToNow, format } from 'date-fns'

/**
 * Normalise any stored date string to the `YYYY-MM-DD` value required by
 * `<input type="date">`. Extraction is done lexically (no Date parsing) to
 * avoid UTC → local-timezone day shifts.
 *
 * Handles:
 *  - `YYYY-MM-DD`           → returned as-is
 *  - `YYYY-MM-DDTHH:…`      → first 10 chars taken (ISO datetime / Firestore)
 *  - `MM/DD/YYYY`           → re-ordered (legacy import format)
 *  - anything else          → returned as-is (form validation catches it)
 */
export function toDateInputValue(raw: string | null | undefined): string {
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10)
  const mmddyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mmddyyyy) {
    return `${mmddyyyy[3]}-${mmddyyyy[1].padStart(2, '0')}-${mmddyyyy[2].padStart(2, '0')}`
  }
  return raw
}

export function todayDateInputValue(now = new Date()): string {
  return format(now, 'yyyy-MM-dd')
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysDiff < 7) {
    return formatDistanceToNow(date, { addSuffix: true })
  }
  
  return format(date, 'MMM d, yyyy')
}
