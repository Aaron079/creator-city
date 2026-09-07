import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(directory, 'CanvasBottomDock.tsx'), 'utf8')

test('keeps the bottom dock status-only without a second task launcher', () => {
  assert.match(source, /当前节点/)
  assert.match(source, /个任务节点/)
  assert.doesNotMatch(source, /onOpenGenerationDialog/)
  assert.doesNotMatch(source, />\s*打开任务\s*</)
})
