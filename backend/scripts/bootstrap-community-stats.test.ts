import { describe, expect, it } from 'vitest'

import {
  formatBootstrapCompletion,
  parseArgs,
} from './bootstrap-community-stats.mjs'

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

  it('acknowledges only the expected ready schema publication', () => {
    expect(formatBootstrapCompletion({
      userCount: 73,
      schemaVersion: 4,
      pipelineGeneration: 12,
      refreshState: 'ready',
    }, 'demo-project', 4)).toContain(
      '73 users in project demo-project at schema 4, generation 12',
    )

    expect(() => formatBootstrapCompletion({
      userCount: 73,
      schemaVersion: 3,
      pipelineGeneration: 12,
      refreshState: 'ready',
    }, 'demo-project', 4)).toThrow(/ready schema-4 publication/i)

    expect(() => formatBootstrapCompletion({
      userCount: 73,
      schemaVersion: 4,
      pipelineGeneration: 12,
      refreshState: 'stale',
    }, 'demo-project', 4)).toThrow(/ready schema-4 publication/i)
  })
})
