import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, test } from 'node:test'

import { validateRegistry, verifyRegistry } from './verify-confirmed-experience-locks.mjs'

const registryPath = 'docs/CONFIRMED_EXPERIENCE_LOCKS.json'

const lockDefinitions = [
  ['node-editor-anchor', ['apps/web/src/components/create/VisualCanvasWorkspace.tsx', 'apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts'], ['apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx']],
  ['prompt-editor-fixed-regions', ['apps/web/src/components/create/CanvasPromptBox.tsx', 'apps/web/src/components/create/canvas.module.css'], ['apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx']],
  ['node-editor-coupled-drag', ['apps/web/src/components/create/VisualCanvasWorkspace.tsx', 'apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts'], ['apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx']],
  ['four-edge-resize-without-handles', ['apps/web/src/components/create/CanvasNodeCard.tsx', 'apps/web/src/components/create/CanvasPromptBox.tsx', 'apps/web/src/components/create/VisualCanvasWorkspace.tsx', 'apps/web/src/components/create/canvas/canvasResizeGeometry.ts', 'apps/web/src/components/create/canvas.module.css'], ['apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx', 'apps/web/src/components/create/canvas/secondaryClickSequence.test.ts']],
  ['node-context-menu-actions', ['apps/web/src/components/create/VisualCanvasWorkspace.tsx', 'apps/web/src/components/create/CanvasNodeCard.tsx'], ['apps/web/src/components/create/canvas/secondaryClickSequence.test.ts', 'apps/web/tests/e2e/canvas-context-menus.spec.ts']],
  ['canvas-context-menu-actions', ['apps/web/src/components/create/VisualCanvasWorkspace.tsx'], ['apps/web/src/components/create/canvas/secondaryClickSequence.test.ts', 'apps/web/tests/e2e/canvas-context-menus.spec.ts']],
  ['safari-canvas-context-menu-capture', ['apps/web/src/components/create/VisualCanvasWorkspace.tsx', 'apps/web/src/components/create/CanvasNodeCard.tsx'], ['apps/web/src/components/create/canvas/secondaryClickSequence.test.ts', 'apps/web/tests/e2e/canvas-context-menus.spec.ts']],
]

function canonicalRegistry() {
  return {
    version: 1,
    policy: 'Founder-approved canvas experience is additive-only unless a documented exception is approved.',
    declaration: {
      unaffected: 'Confirmed experience impact: none',
      exception: 'Confirmed experience exception: <lock id>\nFounder approval: <approval record or task link>',
    },
    locks: lockDefinitions.map(([id, owners, checks]) => ({
      id,
      title: id.replaceAll('-', ' '),
      owners,
      checks,
    })),
  }
}

const temporaryRoots = []

function createFixture(registry = canonicalRegistry()) {
  const root = mkdtempSync(join(tmpdir(), 'confirmed-experience-locks-'))
  temporaryRoots.push(root)
  for (const lock of registry.locks ?? []) {
    for (const path of [...(lock.owners ?? []), ...(lock.checks ?? [])]) {
      if (path.startsWith('apps/web/')) {
        const filePath = join(root, path)
        mkdirSync(dirname(filePath), { recursive: true })
        writeFileSync(filePath, '')
      }
    }
  }
  const filePath = join(root, registryPath)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(registry))
  return root
}

afterEach(() => {
  while (temporaryRoots.length) rmSync(temporaryRoots.pop(), { recursive: true, force: true })
})

describe('confirmed experience lock verifier', () => {
  test('accepts the canonical registry when every referenced file exists', () => {
    const root = createFixture()

    assert.deepEqual(validateRegistry(canonicalRegistry()), [])
    assert.deepEqual(verifyRegistry({ root, registryPath }), [])
  })

  test('reports a missing lock id', () => {
    const registry = canonicalRegistry()
    registry.locks[0].id = ''

    assert.deepEqual(validateRegistry(registry), ['Lock is missing id.'])
  })

  test('reports a duplicate lock id', () => {
    const registry = canonicalRegistry()
    registry.locks[1].id = registry.locks[0].id

    assert.deepEqual(validateRegistry(registry), ['Duplicate lock id: node-editor-anchor'])
  })

  test('reports missing owner and check files', () => {
    const root = createFixture()
    rmSync(join(root, 'apps/web/src/components/create/VisualCanvasWorkspace.tsx'))
    rmSync(join(root, 'apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx'))

    assert.deepEqual(verifyRegistry({ root, registryPath }), [
      'node-editor-anchor: missing owner file: apps/web/src/components/create/VisualCanvasWorkspace.tsx',
      'node-editor-anchor: missing check file: apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx',
      'prompt-editor-fixed-regions: missing check file: apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx',
      'node-editor-coupled-drag: missing owner file: apps/web/src/components/create/VisualCanvasWorkspace.tsx',
      'node-editor-coupled-drag: missing check file: apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx',
      'four-edge-resize-without-handles: missing owner file: apps/web/src/components/create/VisualCanvasWorkspace.tsx',
      'four-edge-resize-without-handles: missing check file: apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx',
      'node-context-menu-actions: missing owner file: apps/web/src/components/create/VisualCanvasWorkspace.tsx',
      'canvas-context-menu-actions: missing owner file: apps/web/src/components/create/VisualCanvasWorkspace.tsx',
      'safari-canvas-context-menu-capture: missing owner file: apps/web/src/components/create/VisualCanvasWorkspace.tsx',
    ])
  })

  test('rejects paths that escape the repository root', () => {
    const registry = canonicalRegistry()
    registry.locks[0].owners = ['../outside.ts']
    const root = createFixture(registry)

    assert.deepEqual(verifyRegistry({ root, registryPath }), [
      'node-editor-anchor: path escapes repository root: ../outside.ts',
    ])
  })
})
