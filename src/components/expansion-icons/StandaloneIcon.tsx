interface IconProps {
  size?: number
  className?: string
}

export function StandaloneIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L10 10H14L12 2Z" />
      <ellipse cx="12" cy="13" rx="7" ry="4" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M7 17L6 22M17 17L18 22M12 17V22" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}
