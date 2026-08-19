import { describe, expect, it } from 'vitest'

import {
  BOOTSTRAP_MARKER_COMPLETION_CLOCK_SKEW_MS,
  BOOTSTRAP_MARKER_ID_MAX_CHARS,
  BOOTSTRAP_MARKER_RETENTION_MS,
  BOOTSTRAP_TIMEOUT_MAX_MS,
  hasCompletedBootstrapMarker,
  parseArgs,
  validateBootstrapMarkerId,
} from './bootstrap-community-stats.mjs'

function maxLengthBootstrapMarkerId(seed: string): string {
  const prefix = `bootstrap-${seed}-`
  return `${prefix}${'a'.repeat(BOOTSTRAP_MARKER_ID_MAX_CHARS - prefix.length)}`
}

function completedBootstrapMarker(markerId: string, requestedAtMs: number, completedAtMs: number) {
  return {
    markerId,
    requestedAtMs,
    completedAtMs,
  }
}

describe('bootstrap community stats script marker detection', () => {
  it('validates bootstrap marker ids with a strict ascii-safe max length', () => {
    const nearLimitMarkerId = maxLengthBootstrapMarkerId('script')

    expect(validateBootstrapMarkerId(nearLimitMarkerId)).toBe(nearLimitMarkerId)
    expect(() => validateBootstrapMarkerId('bootstrap-../escape')).toThrow(/bootstrap/i)
    expect(() => validateBootstrapMarkerId('bootstrap-ümlaut')).toThrow(/bootstrap/i)
    expect(() => validateBootstrapMarkerId(`${nearLimitMarkerId}z`)).toThrow(/bootstrap/i)
  })

  it('caps bootstrap timeout so retained completed ids remain observable for the full wait window', () => {
    expect(parseArgs(['--project', 'demo-project', '--timeout-ms', String(BOOTSTRAP_TIMEOUT_MAX_MS)])).toEqual({
      projectId: 'demo-project',
      timeoutMs: BOOTSTRAP_TIMEOUT_MAX_MS,
    })
    expect(() => parseArgs([
      '--project',
      'demo-project',
      '--timeout-ms',
      String(BOOTSTRAP_TIMEOUT_MAX_MS + 1),
    ])).toThrow(/no greater than/i)
  })

  it('accepts an exact marker that remains in completedBootstrapMarkers after a newer marker finishes later', () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 0, 0)
    const state = {
      lastCompletedBootstrapMarkerId: 'bootstrap-newer',
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-older', requestedAtMs, requestedAtMs + 10),
        completedBootstrapMarker('bootstrap-newer', requestedAtMs + 1, requestedAtMs + 11),
      ],
    }

    expect(hasCompletedBootstrapMarker(state, 'bootstrap-older', requestedAtMs + 1)).toBe(true)
    expect(hasCompletedBootstrapMarker(state, 'bootstrap-newer', requestedAtMs + 1)).toBe(true)
  })

  it('does not treat an untracked older marker as complete from a newer completion alone', () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 0, 0)
    const state = {
      lastCompletedBootstrapMarkerId: 'bootstrap-newer',
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-newer', requestedAtMs + 1, requestedAtMs + 2),
      ],
    }

    expect(hasCompletedBootstrapMarker(state, 'bootstrap-older', requestedAtMs + 1)).toBe(false)
  })

  it('retains exact completed ids through the full timeout window and prunes them immediately after expiry', () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 0, 0)
    const completedAtMs = requestedAtMs + 1_000
    const state = {
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-retained', requestedAtMs, completedAtMs),
      ],
    }

    expect(
      hasCompletedBootstrapMarker(
        state,
        'bootstrap-retained',
        completedAtMs + BOOTSTRAP_MARKER_RETENTION_MS - 1,
      ),
    ).toBe(true)
    expect(
      hasCompletedBootstrapMarker(
        state,
        'bootstrap-retained',
        completedAtMs + BOOTSTRAP_MARKER_RETENTION_MS + 1,
      ),
    ).toBe(false)
  })

  it('retains bounded future completion skew through the grace window and drops it after expiry', () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 0, 0)
    const completedAtMs = requestedAtMs + BOOTSTRAP_MARKER_COMPLETION_CLOCK_SKEW_MS
    const state = {
      completedBootstrapMarkers: [
        completedBootstrapMarker('bootstrap-future', requestedAtMs, completedAtMs),
      ],
    }

    expect(hasCompletedBootstrapMarker(state, 'bootstrap-future', requestedAtMs)).toBe(true)
    expect(
      hasCompletedBootstrapMarker(
        state,
        'bootstrap-future',
        completedAtMs + BOOTSTRAP_MARKER_RETENTION_MS - 1,
      ),
    ).toBe(true)
    expect(
      hasCompletedBootstrapMarker(
        state,
        'bootstrap-future',
        completedAtMs + BOOTSTRAP_MARKER_RETENTION_MS + 1,
      ),
    ).toBe(false)
  })

  it('treats legacy markers without a trusted completion timestamp as visible for one finite window', () => {
    const requestedAtMs = Date.UTC(2026, 7, 18, 0, 0, 0)
    const state = {
      completedBootstrapMarkers: [
        {
          markerId: 'bootstrap-legacy',
          requestedAtMs,
        },
      ],
    }

    expect(hasCompletedBootstrapMarker(state, 'bootstrap-legacy', requestedAtMs)).toBe(true)
  })
})
