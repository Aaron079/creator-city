/**
 * Unit tests for shared-cost-rules.ts
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/credits/shared-cost-rules.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { estimateStaticCredits } from './shared-cost-rules'
import { estimateGenerationCredits } from '../billing/estimate'
import { estimateCreditCost } from './cost-rules'

describe('estimateStaticCredits', () => {
  test('text default = 5', () => {
    assert.equal(estimateStaticCredits({ nodeType: 'text' }).credits, 5)
  })

  test('image default = 20', () => {
    assert.equal(estimateStaticCredits({ nodeType: 'image' }).credits, 20)
  })

  test('video standard 5s = 120', () => {
    assert.equal(
      estimateStaticCredits({ nodeType: 'video', providerId: 'custom-video-gateway' }).credits,
      120,
    )
  })

  test('video standard 10s = 240', () => {
    assert.equal(
      estimateStaticCredits({ nodeType: 'video', providerId: 'custom-video-gateway', durationSeconds: 10 }).credits,
      240,
    )
  })

  test('video high quality 5s = 300', () => {
    assert.equal(
      estimateStaticCredits({ nodeType: 'video', providerId: 'runway' }).credits,
      300,
    )
  })

  test('video high quality 10s = 600', () => {
    assert.equal(
      estimateStaticCredits({ nodeType: 'video', providerId: 'runway', durationSeconds: 10 }).credits,
      600,
    )
  })

  test('audio default (1 min) = 20', () => {
    assert.equal(estimateStaticCredits({ nodeType: 'audio' }).credits, 20)
  })

  test('audio 2 min = 40', () => {
    assert.equal(estimateStaticCredits({ nodeType: 'audio', durationSeconds: 120 }).credits, 40)
  })

  test('udio provider override = 40', () => {
    assert.equal(estimateStaticCredits({ nodeType: 'music', providerId: 'udio' }).credits, 40)
  })

  test('unknown nodeType = 5', () => {
    assert.equal(estimateStaticCredits({ nodeType: 'unknown' }).credits, 5)
  })
})

describe('estimate.ts and cost-rules.ts produce consistent results', () => {
  const cases: Array<{ providerId: string; nodeType: string }> = [
    { providerId: 'custom-video-gateway', nodeType: 'video' },
    { providerId: 'runway', nodeType: 'video' },
    { providerId: 'openai-images', nodeType: 'image' },
    { providerId: 'openai-text', nodeType: 'text' },
    { providerId: 'udio', nodeType: 'music' },
    { providerId: 'elevenlabs', nodeType: 'audio' },
  ]

  for (const { providerId, nodeType } of cases) {
    test(`${providerId}/${nodeType}: estimate vs display are equal`, () => {
      const serverCredits = estimateGenerationCredits({ nodeType, providerId })
      const displayCredits = estimateCreditCost(providerId, nodeType)
      assert.equal(
        serverCredits,
        displayCredits,
        `Mismatch for ${providerId}/${nodeType}: server=${serverCredits} display=${displayCredits}`,
      )
    })
  }
})
