interface IconProps {
  size?: number
  className?: string
}

export function EdgeOfEarthIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L8 8L12 14L16 8L12 2Z" />
      <path d="M12 14L8 20L12 22L16 20L12 14Z" />
      <circle cx="6" cy="12" r="1.5"/>
      <circle cx="18" cy="12" r="1.5"/>
    </svg>
  )
}
