interface IconProps {
  size?: number
  className?: string
}

export function InnsmouthIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M3 12C3 12 5 8 8 8C11 8 12 11 12 11C12 11 13 8 16 8C19 8 21 12 21 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M3 15C3 15 5 19 8 19C11 19 12 16 12 16C12 16 13 19 16 19C19 19 21 15 21 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="8" cy="13.5" r="1"/>
      <circle cx="16" cy="13.5" r="1"/>
    </svg>
  )
}
