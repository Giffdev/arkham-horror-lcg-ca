interface IconProps {
  size?: number
  className?: string
}

export function BarkhamIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L8 6L9 10L12 8L15 10L16 6L12 2Z"/>
      <circle cx="12" cy="14" r="6" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="10" cy="13" r="1"/>
      <circle cx="14" cy="13" r="1"/>
      <path d="M10 16C10 16 11 17 12 17C13 17 14 16 14 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
