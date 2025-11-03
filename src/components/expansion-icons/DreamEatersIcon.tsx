interface IconProps {
  size?: number
  className?: string
}

export function DreamEatersIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <ellipse cx="12" cy="12" rx="8" ry="5" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="12" cy="12" rx="5" ry="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="2.5"/>
    </svg>
  )
}
