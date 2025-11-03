interface IconProps {
  size?: number
  className?: string
}

export function DrownedCityIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M2 12C2 12 4 8 7 8C10 8 12 12 12 12C12 12 14 8 17 8C20 8 22 12 22 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M2 16C2 16 4 20 7 20C10 20 12 16 12 16C12 16 14 20 17 20C20 20 22 16 22 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <rect x="9" y="2" width="6" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M11 5H13M11 7H13" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}
