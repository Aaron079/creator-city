import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panel = readFileSync(new URL('../apps/web/src/components/create/StoryboardGridSplitPanel.tsx', import.meta.url), 'utf8')
const detector = readFileSync(new URL('../apps/web/src/lib/canvas/storyboardGridDetect.ts', import.meta.url), 'utf8')

test('storyboard grid split requires a confirmed or explicit layout selection before crop', () => {
  assert.match(detector, /selectionMode: StoryboardGridSelectionMode/)
  assert.match(panel, /useState<StoryboardGridLayoutId \| null>\(null\)/)
  assert.match(panel, /detected\.selectionMode === 'confirmed'/)
  assert.match(panel, /请选择布局后再裁切入库/)
  assert.match(panel, /disabled=\{!hasProjectId \|\| !canUseSource \|\| !layoutId/)
  assert.match(panel, /onClick=\{\(\) => setLayoutId\(layout\.id\)\}/)
})
