import assert from 'node:assert/strict'
import test from 'node:test'
import { nextCanvasToolDockMenu } from './CanvasToolDock'

test('switching canvas dock menus closes the previously open menu', () => {
  assert.equal(nextCanvasToolDockMenu(null, 'add'), 'add')
  assert.equal(nextCanvasToolDockMenu('add', 'director'), 'director')
  assert.equal(nextCanvasToolDockMenu('director', 'prompt'), 'prompt')
  assert.equal(nextCanvasToolDockMenu('prompt', 'prompt'), null)
})
