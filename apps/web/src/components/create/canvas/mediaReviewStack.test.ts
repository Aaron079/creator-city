import assert from 'node:assert/strict'
import test from 'node:test'
import { MEDIA_REVIEW_STACK_MAX_INDEX, prioritizeMediaReview } from './mediaReviewStack'

test('renormalizes a long-lived floating review stack below the spatial overlay layer', () => {
  const result = prioritizeMediaReview([
    { id: 'image', zIndex: 298 },
    { id: 'video', zIndex: 299 },
  ], 'image', 300)

  assert.equal(result.nextZIndex, 2)
  assert.deepEqual(result.items, [
    { id: 'image', zIndex: 2 },
    { id: 'video', zIndex: 1 },
  ])
  assert.ok(result.items.every((item) => item.zIndex < MEDIA_REVIEW_STACK_MAX_INDEX + 1))
})

test('keeps the focused floating review above the rest of the bounded stack', () => {
  const result = prioritizeMediaReview([
    { id: 'image', zIndex: 2 },
    { id: 'video', zIndex: 3 },
  ], 'image', 4)

  assert.equal(result.nextZIndex, 4)
  assert.equal(result.items.find((item) => item.id === 'image')?.zIndex, 4)
})
