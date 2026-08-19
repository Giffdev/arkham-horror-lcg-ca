import { access } from 'node:fs/promises'

const artifactPath = new URL('../lib/api/community-stats/process.js', import.meta.url)

await access(artifactPath)
const artifact = await import(artifactPath.href)

if (typeof artifact.default !== 'function') {
  throw new Error('Built community stats function does not export a default handler.')
}

console.log('Built community stats function imports successfully.')
