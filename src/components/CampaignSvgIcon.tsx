/**
 * CampaignSvgIcon — renders an actual raw SVG from src/components/icons/
 * at a requested size, themed via CSS currentColor.
 *
 * Uses getCampaignSvgRaw from campaign-icon-map (single source of truth).
 * The SVG source files are known internal assets; dangerouslySetInnerHTML
 * is safe here and is the project-consistent way to inline SVG data.
 */
import { useMemo } from 'react'
import type { HTMLAttributes } from 'react'
import { getCampaignSvgRaw } from '@/lib/campaign-icon-map'
import { cn } from '@/lib/utils'

interface CampaignSvgIconProps extends HTMLAttributes<HTMLSpanElement> {
  /** Canonical campaign `set` string from campaign-data.ts, or any campaign name. */
  campaignSet: string
  /** Pixel size for both width and height. Defaults to 16. */
  size?: number
  className?: string
}

/** Strip existing width/height from the <svg> element and inject requested values. */
function injectSize(svgString: string, size: number): string {
  return svgString.replace(
    /<svg\b([^>]*)>/,
    (_, attrs: string) => {
      const stripped = attrs.replace(/\s*(width|height)="[^"]*"/g, '')
      return `<svg${stripped} width="${size}" height="${size}">`
    },
  )
}

export function CampaignSvgIcon({ campaignSet, size = 16, className, ...rest }: CampaignSvgIconProps) {
  const svgHtml = useMemo(
    () => injectSize(getCampaignSvgRaw(campaignSet), size),
    [campaignSet, size],
  )

  return (
    <span
      className={cn('inline-flex flex-shrink-0', className)}
      style={{ width: size, height: size }}
      // SVGs are known internal assets — not user input. Safe to inline.
      dangerouslySetInnerHTML={{ __html: svgHtml }}
      {...rest}
    />
  )
}
