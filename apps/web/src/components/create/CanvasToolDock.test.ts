import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isCanvasToolDockMenuOpen,
  nextCanvasToolDockMenu,
} from './CanvasToolDock'

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
