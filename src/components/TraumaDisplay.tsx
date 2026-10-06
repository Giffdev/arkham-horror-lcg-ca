import { useMemo } from 'react'
import healthRaw from '@/components/icons/health.svg?raw'
import sanityRaw from '@/components/icons/sanity.svg?raw'
import { cn } from '@/lib/utils'

interface TraumaDisplayProps {
  physical: number
  mental: number
  className?: string
}

function prepareSvg(raw: string): string {
  return raw
    .replace(/\s(width|height)="[^"]*"/g, '')
    .replace(/\sfill="[^"]*"/g, '')
    .replace(/<(path|circle|rect|polygon|polyline|ellipse|line)(\s)/g, '<$1 fill="currentColor"$2')
    .replace(
      /<svg\b/,
      '<svg fill="currentColor" width="13" height="13" aria-hidden="true" focusable="false"',
    )
}

function TraumaIcon({ type }: { type: 'physical' | 'mental' }) {
  const svgHtml = useMemo(
    () => prepareSvg(type === 'physical' ? healthRaw : sanityRaw),
    [type],
  )

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-[13px] w-[13px] flex-shrink-0',
        type === 'physical' ? 'text-red-400' : 'text-sky-400',
      )}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  )
}

export function TraumaDisplay({ physical, mental, className }: TraumaDisplayProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 whitespace-nowrap', className)}
      aria-label={`${physical} physical trauma, ${mental} mental trauma`}
      data-slot="trauma-display"
    >
      <span aria-hidden="true">Trauma</span>
      <span
        aria-hidden="true"
        className="inline-flex items-center gap-0.5 text-red-400"
        data-slot="physical-trauma"
      >
        <TraumaIcon type="physical" />
        {physical}
      </span>
      <span aria-hidden="true">/</span>
      <span
        aria-hidden="true"
        className="inline-flex items-center gap-0.5 text-sky-400"
        data-slot="mental-trauma"
      >
        <TraumaIcon type="mental" />
        {mental}
      </span>
    </span>
  )
}
