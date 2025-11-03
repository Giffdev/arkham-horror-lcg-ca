interface IconProps {
  size?: number
  className?: string
}

export function CarcosaIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z" />
      <circle cx="12" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}
