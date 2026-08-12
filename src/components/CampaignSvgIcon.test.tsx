/**
 * CampaignSvgIcon — regression tests
 *
 * Lambert — Tester | 2026-08-11
 *
 * Covers the CampaignSvgIcon component contract:
 *  1. Renders an inline SVG (non-empty dangerouslySetInnerHTML output)
 *  2. Applies requested size to both the container span and the injected SVG
 *  3. Applies the className prop to the root element (required for h-full / equal-height grid)
 *  4. Accepts and propagates aria-hidden for decorative call sites
 *
 * Production owner: Dallas (CampaignSvgIcon.tsx)
 */

import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CampaignSvgIcon } from './CampaignSvgIcon'

// ─── 1–4. CampaignSvgIcon component contract ──────────────────────────────────

describe('CampaignSvgIcon — rendering contract', () => {
  it('renders a container span with an inline SVG', () => {
    const { container } = render(<CampaignSvgIcon campaignSet="Core" />)
    const span = container.querySelector('span')
    expect(span).toBeInTheDocument()
    // The span must contain an SVG element injected via dangerouslySetInnerHTML.
    expect(span?.querySelector('svg')).toBeInTheDocument()
  })

  it('applies default size 16 to the container span', () => {
    const { container } = render(<CampaignSvgIcon campaignSet="Core" />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.width).toBe('16px')
    expect(span.style.height).toBe('16px')
  })

  it('applies explicit size to the container span', () => {
    const { container } = render(<CampaignSvgIcon campaignSet="Core" size={32} />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.width).toBe('32px')
    expect(span.style.height).toBe('32px')
  })

  it('injects width and height attributes onto the SVG element matching size prop', () => {
    const { container } = render(<CampaignSvgIcon campaignSet="Core" size={24} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('24')
    expect(svg?.getAttribute('height')).toBe('24')
  })

  it('applies className to the root span', () => {
    const { container } = render(
      <CampaignSvgIcon campaignSet="Core" className="text-primary custom-class" />,
    )
    const span = container.querySelector('span')
    expect(span?.className).toContain('custom-class')
  })

  it('renders without crashing for an unknown campaign set', () => {
    expect(() => render(<CampaignSvgIcon campaignSet="Totally Unknown Campaign" />)).not.toThrow()
  })

  it('renders a non-empty SVG even for unknown campaign set (uses fallback)', () => {
    const { container } = render(<CampaignSvgIcon campaignSet="Unknown" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('rendered SVG carries fill="currentColor" for theme integration', () => {
    const { container } = render(<CampaignSvgIcon campaignSet="Core" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('fill')).toBe('currentColor')
  })
})

// ─── aria-hidden contract for decorative call sites ───────────────────────────
//
// CampaignSvgIcon icons are purely decorative in all current call sites;
// the adjacent text (campaign name) carries the accessible label.
// The component must accept aria-hidden="true" and apply it to its root element
// so screen readers skip the redundant icon.
//
// [EXPECTED FAIL — pending Dallas] until CampaignSvgIcon spreads rest props
// onto the root <span> (e.g., adds `...rest` to the interface and spreads it).

describe('CampaignSvgIcon — aria-hidden propagation for decorative use', () => {
  it('accepts aria-hidden="true" and applies it to the root span', () => {
    const { container } = render(
      // @ts-expect-error — prop not yet declared; test documents the required contract
      <CampaignSvgIcon campaignSet="Core" aria-hidden="true" />,
    )
    const span = container.querySelector('span')
    expect(
      span?.getAttribute('aria-hidden'),
      'Root span must carry aria-hidden="true" at decorative call sites',
    ).toBe('true')
  })

  it('does not default to aria-hidden so labelled uses are not silenced', () => {
    const { container } = render(<CampaignSvgIcon campaignSet="Core" />)
    const span = container.querySelector('span')
    // When no aria-hidden is passed the attribute must not be set automatically.
    expect(span?.getAttribute('aria-hidden')).toBeNull()
  })
})

// ─── 5. (Community layout tests are in community-layout-regression.test.tsx) ──
