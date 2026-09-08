import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  SECONDARY_CLICK_INTERVAL_MS,
  registerSecondaryClick,
} from './secondaryClickSequence'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceSource = readFileSync(resolve(testDirectory, '../VisualCanvasWorkspace.tsx'), 'utf8')
const nodeCardSource = readFileSync(resolve(testDirectory, '../CanvasNodeCard.tsx'), 'utf8')
const nodeLayerSource = readFileSync(resolve(testDirectory, 'CanvasNodeLayer.tsx'), 'utf8')

test('waits for a second right-click on the same target before opening a picker', () => {
  const first = registerSecondaryClick(null, {
    target: 'canvas',
    occurredAt: 1_000,
  })

  assert.deepEqual(first, {
    shouldOpenPicker: false,
    next: { target: 'canvas', occurredAt: 1_000 },
  })

  const second = registerSecondaryClick(first.next, {
    target: 'canvas',
    occurredAt: 1_000 + SECONDARY_CLICK_INTERVAL_MS - 1,
  })

  assert.deepEqual(second, {
    shouldOpenPicker: true,
    next: null,
  })
})

test('treats a delayed or differently targeted right-click as a new first click', () => {
  const first = { target: 'node:source', occurredAt: 2_000 }

  assert.deepEqual(
    registerSecondaryClick(first, {
      target: 'node:source',
      occurredAt: 2_000 + SECONDARY_CLICK_INTERVAL_MS + 1,
    }),
    {
      shouldOpenPicker: false,
      next: {
        target: 'node:source',
        occurredAt: 2_000 + SECONDARY_CLICK_INTERVAL_MS + 1,
      },
    },
  )

  assert.deepEqual(
    registerSecondaryClick(first, {
      target: 'node:other',
      occurredAt: 2_050,
    }),
    {
      shouldOpenPicker: false,
      next: { target: 'node:other', occurredAt: 2_050 },
    },
  )
})

test('routes Canvas and node-card secondary clicks to creation pickers while retaining explicit node management', () => {
  assert.match(workspaceSource, /onContextMenu=\{handleCanvasSecondaryClick\}/)
  assert.match(workspaceSource, /target: 'canvas'/)
  assert.match(workspaceSource, /setNodeCreateMenu\(\{ \.\.\.position, worldX: worldPoint\.x, worldY: worldPoint\.y \}\)/)
  assert.match(workspaceSource, /onSecondaryClick: \(event\) => handleNodeSecondaryClick\(node\.id, event\)/)
  assert.match(workspaceSource, /target: `node:\$\{nodeId\}`/)
  assert.match(workspaceSource, /openNodeAddMenu\(nodeId, 'out'\)/)

  assert.match(nodeCardSource, /onContextMenu=\{\(event\) => \{[\s\S]*?onSecondaryClick\(event\)/)
  assert.match(nodeCardSource, /onClick=\{\(event\) => \{[\s\S]*?onOpenContextMenu\(event\)[\s\S]*?className="canvas-node-more"/)
  assert.match(nodeLayerSource, /onSecondaryClick=\{\(event\) => latestCardProps\(\)\.onSecondaryClick\(event\)\}/)
})
