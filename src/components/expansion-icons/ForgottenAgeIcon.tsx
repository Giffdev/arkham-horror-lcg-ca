interface IconProps {
  size?: number
  className?: string
}

export function ForgottenAgeIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L4 7.5V16.5L12 22L20 16.5V7.5L12 2Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 2L12 22M4 7.5L20 16.5M20 7.5L4 16.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}
