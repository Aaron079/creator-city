import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const route = readFileSync(
  new URL('../apps/web/src/app/api/projects/[projectId]/canvas/route.ts', import.meta.url),
  'utf8',
)
const workspace = readFileSync(
  new URL('../apps/web/src/components/create/VisualCanvasWorkspace.tsx', import.meta.url),
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

test('workspace tracks dirty entities and only clears submitted identities after acknowledgement', () => {
  assert.match(workspace, /buildCanvasEntitySavePayload/)
  assert.match(workspace, /collectChangedEntityIds/)
  assert.match(workspace, /dirtyNodeIdsRef/)
  assert.match(workspace, /dirtyEdgeIdsRef/)
  assert.match(workspace, /forceFullCanvasSaveRef/)
  assert.match(workspace, /const commitNodes[\s\S]*collectChangedEntityIds/)
  assert.match(workspace, /const commitEdges[\s\S]*collectChangedEntityIds/)
  assert.match(workspace, /saveMode: entityPayload\.saveMode/)
  assert.match(workspace, /canvasSaveFailure\(response\.ok, data\)[\s\S]*dirtyNodeIdsRef/)
})
