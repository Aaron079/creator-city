import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { resolveStoryboardGridCellPosition } from './storyboardGridPlacement'

const source = { x: 100, y: 200, width: 380, height: 320 }
const size = { width: 380, height: 320 }

describe('resolveStoryboardGridCellPosition', () => {
  test('keeps same-row cells in distinct columns', () => {
    const left = resolveStoryboardGridCellPosition({ source, cell: { row: 0, col: 0 }, size, occupied: [] })
    const right = resolveStoryboardGridCellPosition({ source, cell: { row: 0, col: 1 }, size, occupied: [] })

    assert.equal(left.y, right.y)
    assert.ok(right.x > left.x)
  })

  test('keeps every 3x2 cell distinct', () => {
    const positions = [0, 1, 2, 3, 4, 5].map((index) => resolveStoryboardGridCellPosition({
      source,
      cell: { row: Math.floor(index / 2), col: index % 2 },
      size,
      occupied: [],
    }))

    assert.equal(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size, 6)
  })

  test('moves a colliding cell to a non-overlapping position', () => {
    const position = resolveStoryboardGridCellPosition({
      source,
      cell: { row: 0, col: 0 },
      size,
      occupied: [{ x: 720, y: 200, width: 380, height: 320 }],
    })

    assert.notDeepEqual(position, { x: 720, y: 200 })
  })
})
