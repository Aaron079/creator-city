import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const route = readFileSync(
  new URL('../apps/web/src/app/api/projects/[projectId]/canvas/route.ts', import.meta.url),
  'utf8',
)

test('canvas PUT supports validated incremental persistence through bulk upserts', () => {
  assert.match(route, /saveMode\?: 'full' \| 'incremental'/)
  assert.match(route, /buildCanvasNodeBulkUpsert/)
  assert.match(route, /buildCanvasEdgeBulkUpsert/)
  assert.match(route, /db\.\$executeRaw\(nodeStatement\)/)
  assert.match(route, /db\.\$executeRaw\(edgeStatement\)/)
  assert.match(route, /canvasWorkflow\.updateMany/)
  assert.doesNotMatch(route, /db\.canvasNode\.upsert/)
  assert.doesNotMatch(route, /db\.canvasEdge\.upsert/)
})
