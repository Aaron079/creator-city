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

test('canvas PUT does not return while a detached save continues', () => {
  assert.doesNotMatch(route, /Promise\.race\(\[putImpl\(/)
  assert.doesNotMatch(route, /20 s hard deadline fired/)
  assert.match(route, /CANVAS_SAVE_SERVER_DEADLINE_MS/)
})

test('canvas PUT reserves a workflow version and rejects stale saves', () => {
  assert.match(route, /baseUpdatedAt\?: string/)
  assert.match(
    route,
    /canvasWorkflow\.updateMany\([\s\S]*updatedAt:\s*new Date\(body\.baseUpdatedAt\)/,
  )
  assert.match(route, /CANVAS_SAVE_CONFLICT/)
})

test('canvas PUT fails closed for every partial write stage', () => {
  assert.match(route, /CANVAS_PARTIAL_SAVE/)
  assert.doesNotMatch(route, /partialSave:\s*true/)
  assert.doesNotMatch(route, /deletedNodes failed/)
  assert.doesNotMatch(route, /deletedEdges failed/)
  assert.match(route, /failedNodeIds/)
  assert.match(route, /failedEdgeIds/)
  assert.match(route, /failedDeletionStages/)
})

test('canvas client validates acknowledgement before clearing deletion state', () => {
  assert.match(workspace, /canvasSaveFailure/)
  assert.match(workspace, /baseUpdatedAt:\s*serverSaveVersionRef\.current/)
  assert.match(
    workspace,
    /const saveFailure = canvasSaveFailure\(response\.ok, data\)[\s\S]*if \(saveFailure\)[\s\S]*deletedNodeIdsRef\.current = \[\]/,
  )
})

test('canvas client drains one coalesced save after releasing the lock', () => {
  assert.match(workspace, /consumePendingCanvasSave\(pendingSaveRef\)/)
  assert.match(workspace, /saveCanvasRef\.current\(\)/)
  assert.doesNotMatch(
    workspace,
    /saveInFlightRef\.current = false\s*\n\s*pendingSaveRef\.current = false/,
  )
})
