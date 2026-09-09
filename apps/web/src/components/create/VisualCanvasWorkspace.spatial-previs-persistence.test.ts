import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceSource = readFileSync(resolve(testDirectory, 'VisualCanvasWorkspace.tsx'), 'utf8')

function sourceBetween(startMarker: string, endMarker: string) {
  const start = workspaceSource.indexOf(startMarker)
  assert.ok(start >= 0, `missing start marker: ${startMarker}`)
  const end = workspaceSource.indexOf(endMarker, start)
  assert.ok(end > start, `missing end marker after ${startMarker}: ${endMarker}`)
  return workspaceSource.slice(start, end)
}

test('initializes spatial previs wherever workflow metadata initializes the shot sequence', () => {
  const pairedWorkflowLoads = workspaceSource.matchAll(
    /setCloudShotSequence\(parseShotSequenceFromWorkflowMetadata\(([^)]+)\)\)\s+setSpatialPrevis\(parseSpatialPrevisMetadata\(\1\)\)/g,
  )

  assert.equal([...pairedWorkflowLoads].length, 2)
})

test('keeps spatial previs saves scoped away from pending canvas deletions', () => {
  const spatialSaveSource = sourceBetween(
    'const handleSaveSpatialPrevis = useCallback',
    'const createGeneratedAsset = useCallback',
  )

  assert.match(
    spatialSaveSource,
    /const saveMode = entityPayload\.saveMode === 'full' && entityPayload\.nodes\.length === 0\s+\? 'incremental'/,
  )
  assert.match(spatialSaveSource, /deletedNodeIds: \[\],\s+deletedEdgeIds: \[\]/)
  assert.match(spatialSaveSource, /workflowMetadata: spatialPrevisMetadata\(\{\}, next\)/)
  assert.doesNotMatch(spatialSaveSource, /deletedNodeIdsRef|deletedEdgeIdsRef/)
})
