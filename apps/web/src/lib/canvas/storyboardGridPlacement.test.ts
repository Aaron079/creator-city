import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { resolveStoryboardGridCellPosition } from './storyboardGridPlacement'

const source = { x: 100, y: 200, width: 380, height: 320 }
const size = { width: 380, height: 320 }

function overlaps(left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }) {
  return !(
    left.x + left.width + 24 < right.x ||
    right.x + right.width + 24 < left.x ||
    left.y + left.height + 24 < right.y ||
    right.y + right.height + 24 < left.y
  )
}

describe('resolveStoryboardGridCellPosition', () => {
  test('keeps same-row cells in distinct columns', () => {
    const left = resolveStoryboardGridCellPosition({ source, cell: { row: 0, col: 0 }, size, occupied: [] })
    const right = resolveStoryboardGridCellPosition({ source, cell: { row: 0, col: 1 }, size, occupied: [] })

    assert.equal(left.y, right.y)
    assert.ok(right.x > left.x)
  })

  test('keeps every 3x2 cell distinct and non-overlapping', () => {
    const positions = [0, 1, 2, 3, 4, 5].map((index) => resolveStoryboardGridCellPosition({
      source,
      cell: { row: Math.floor(index / 2), col: index % 2 },
      size,
      occupied: [],
    }))

    assert.equal(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size, 6)
    for (const [index, position] of positions.entries()) {
      for (const other of positions.slice(index + 1)) {
        assert.equal(overlaps({ ...position, ...size }, { ...other, ...size }), false)
      }
    }
  })

  test('moves a colliding cell to a non-overlapping position', () => {
    const occupied = { x: 720, y: 200, width: 380, height: 320 }
    const position = resolveStoryboardGridCellPosition({
      source,
      cell: { row: 0, col: 0 },
      size,
      occupied: [occupied],
    })

    assert.equal(overlaps({ ...position, ...size }, occupied), false)
  })
})
