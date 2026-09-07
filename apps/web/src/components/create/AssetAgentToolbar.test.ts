import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  resolveToolbarMenuPlacement,
  resolveToolbarViewportCenter,
} from './AssetAgentToolbar'

describe('resolveToolbarMenuPlacement', () => {
  test('opens down when the menu fits below the toolbar', () => {
    assert.equal(resolveToolbarMenuPlacement({
      spaceAbove: 500,
      spaceBelow: 240,
      menuHeight: 200,
    }), 'down')
  })

  test('flips up when only the space above can contain the menu', () => {
    assert.equal(resolveToolbarMenuPlacement({
      spaceAbove: 500,
      spaceBelow: 40,
      menuHeight: 200,
    }), 'up')
  })

  test('uses the larger side when the menu cannot fully fit either way', () => {
    assert.equal(resolveToolbarMenuPlacement({
      spaceAbove: 160,
      spaceBelow: 80,
      menuHeight: 200,
    }), 'up')
  })
})

describe('resolveToolbarViewportCenter', () => {
  test('keeps the toolbar reachable when its selected node is beyond the right edge', () => {
    assert.equal(resolveToolbarViewportCenter({
      preferredCenterX: 1_934,
      viewportWidth: 1_920,
    }), 1_536)
  })

  test('keeps the toolbar reachable when its selected node is beyond the left edge', () => {
    assert.equal(resolveToolbarViewportCenter({
      preferredCenterX: -120,
      viewportWidth: 1_920,
    }), 384)
  })

  test('centers within a narrow viewport while preserving the viewport gutter', () => {
    assert.equal(resolveToolbarViewportCenter({
      preferredCenterX: 10,
      viewportWidth: 360,
    }), 180)
  })
})
