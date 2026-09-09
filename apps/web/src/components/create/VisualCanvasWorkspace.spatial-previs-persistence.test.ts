import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceSource = readFileSync(resolve(testDirectory, 'VisualCanvasWorkspace.tsx'), 'utf8')

test('initializes spatial previs wherever workflow metadata initializes the shot sequence', () => {
  const pairedWorkflowLoads = workspaceSource.matchAll(
    /setCloudShotSequence\(parseShotSequenceFromWorkflowMetadata\(([^)]+)\)\)\s+setSpatialPrevis\(parseSpatialPrevisMetadata\(\1\)\)/g,
  )

  assert.equal([...pairedWorkflowLoads].length, 2)
})
