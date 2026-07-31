import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const workspace = readFileSync(resolve(root, 'apps/web/src/components/create/VisualCanvasWorkspace.tsx'), 'utf8')

describe('canvas tool semantic integrity boundary', () => {
  test('removes the legacy editor that produced completed textual-only media', () => {
    assert.equal(existsSync(resolve(root, 'apps/web/src/components/create/ImageEditorPanel.tsx')), false)
    assert.doesNotMatch(workspace, /ImageEditorPanel/)
    assert.doesNotMatch(workspace, /handleApplyImageEdit/)
    assert.doesNotMatch(workspace, /图片编辑器节点|姿势生成器|涂鸦生视频|涂鸦生图/)
  })
})
