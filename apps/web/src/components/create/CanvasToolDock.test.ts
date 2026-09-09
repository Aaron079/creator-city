import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  isCanvasToolDockMenuOpen,
  nextCanvasToolDockMenu,
} from './CanvasToolDock'

const dockSource = readFileSync(new URL('./CanvasToolDock.tsx', import.meta.url), 'utf8')

test('switching canvas dock menus closes the previously open menu', () => {
  assert.equal(nextCanvasToolDockMenu(null, 'add'), 'add')
  assert.equal(nextCanvasToolDockMenu('add', 'director'), 'director')
  assert.equal(nextCanvasToolDockMenu('director', 'prompt'), 'prompt')
  assert.equal(nextCanvasToolDockMenu('prompt', 'prompt'), null)
})

test('only the selected canvas dock menu is rendered', () => {
  assert.equal(isCanvasToolDockMenuOpen('add', 'add'), true)
  assert.equal(isCanvasToolDockMenuOpen('director', 'add'), false)
  assert.equal(isCanvasToolDockMenuOpen('prompt', 'add'), false)
})

test('director tools expose spatial previs through the established callback', () => {
  assert.match(
    dockSource,
    /onOpenDirectorTool: \(tool: 'shot-list-builder' \| 'continuity-checker' \| 'character-bible' \| 'scene-bible' \| 'shot-sequencer' \| 'spatial-previs'\) => void/,
  )
  assert.match(dockSource, /onOpenDirectorTool\('spatial-previs'\)/)
  assert.match(dockSource, /<span>空间预演<\/span>/)
})
