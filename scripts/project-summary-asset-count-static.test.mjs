import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routePath = new URL('../apps/web/src/app/api/projects/route.ts', import.meta.url)

async function readRoute() {
  return readFile(routePath, 'utf8')
}

test('project summaries group direct assets by project', async () => {
  const source = await readRoute()

  assert.match(source, /db\.asset\.groupBy\(/)
  assert.match(source, /ownerId: userId/)
  assert.match(source, /projectId: \{ in: \[\.\.\.projectIds\] \}/)
  assert.match(source, /toProjectAssetCountMap\(rows\)/)
})

test('project summaries use canonical asset counts in every list path', async () => {
  const source = await readRoute()
  const canonicalCountUses = source.match(
    /assetCount: countProjectAssets\(project\.id, assetCounts\)/g,
  ) ?? []

  assert.equal(canonicalCountUses.length, 3)
  assert.doesNotMatch(source, /assetCount: 0/)
  assert.doesNotMatch(source, /generatedAssets: true, assets: true/)
})
