import { GoogleAuth } from 'google-auth-library'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function parseArgs(argv) {
  let projectId = null
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--project') {
      projectId = argv[index + 1]?.trim() || null
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${argv[index]}`)
  }
  if (!projectId) {
    throw new Error('Usage: npm run backend:bootstrap -- --project <firebase-project-id>')
  }
  return { projectId }
}

export function formatBootstrapCompletion(result, projectId, expectedSchemaVersion) {
  if (
    !result ||
    !Number.isSafeInteger(result.userCount) ||
    result.userCount < 0 ||
    result.schemaVersion !== expectedSchemaVersion ||
    !Number.isSafeInteger(result.pipelineGeneration) ||
    result.pipelineGeneration < 1 ||
    result.refreshState !== 'ready'
  ) {
    throw new Error(
      `Community stats bootstrap did not acknowledge a ready schema-${expectedSchemaVersion} publication.`,
    )
  }
  return (
    `Community stats contribution bootstrap complete for ${result.userCount} users ` +
    `in project ${projectId} at schema ${result.schemaVersion}, ` +
    `generation ${result.pipelineGeneration}.`
  )
}

async function authenticatedProjectId() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  return auth.getProjectId()
}

async function main() {
  const { projectId } = parseArgs(process.argv.slice(2))
  const authenticated = await authenticatedProjectId()
  if (!authenticated || authenticated !== projectId) {
    throw new Error(
      `Refusing bootstrap: requested project "${projectId}" does not match ` +
      `authenticated project "${authenticated || 'unresolved'}".`,
    )
  }

  process.env.COMMUNITY_STATS_FIREBASE_PROJECT_ID = projectId
  const contributionModule =
    new URL('../lib/backend/community-stats-contributions.js', import.meta.url).href
  const {
    bootstrapCommunityStatsContributions,
    COMMUNITY_STATS_SCHEMA_VERSION,
  } =
    await import(/* @vite-ignore */ contributionModule)
  const result = await bootstrapCommunityStatsContributions()
  console.log(formatBootstrapCompletion(
    result,
    projectId,
    COMMUNITY_STATS_SCHEMA_VERSION,
  ))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
