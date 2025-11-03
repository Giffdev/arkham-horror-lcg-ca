interface IconProps {
  size?: number
  className?: string
}

export function HemlockValeIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L6 8L8 14L12 12L16 14L18 8L12 2Z" />
      <path d="M8 14L6 20L12 18L18 20L16 14" />
      <circle cx="12" cy="9" r="1.5"/>
    </svg>
  )
}
