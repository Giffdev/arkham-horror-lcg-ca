interface IconProps {
  size?: number
  className?: string
}

export function ScarletKeysIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M11 8H20" stroke="currentColor" strokeWidth="2"/>
      <path d="M16 5V11M14 8H18" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
}
