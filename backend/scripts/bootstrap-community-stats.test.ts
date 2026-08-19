import { describe, expect, it } from 'vitest'

import { parseArgs } from './bootstrap-community-stats.mjs'

describe('community stats contribution bootstrap arguments', () => {
  it('requires an explicit project', () => {
    expect(() => parseArgs([])).toThrow(/--project/)
  })

  it('parses the explicit project', () => {
    expect(parseArgs(['--project', 'demo-project'])).toEqual({
      projectId: 'demo-project',
    })
  })

  it('rejects unknown arguments', () => {
    expect(() => parseArgs(['--force'])).toThrow(/unknown argument/i)
  })
})
