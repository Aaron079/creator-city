/**
 * Unit tests for global-providers/openaiText.ts
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/global-providers/openaiText.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildSystemPrompt } from './openaiText'

describe('buildSystemPrompt', () => {
  test('generic mode returns generic prompt', () => {
    const prompt = buildSystemPrompt('generic')
    assert.ok(prompt.includes('Creator City'), 'should mention Creator City')
    assert.ok(prompt.length > 10, 'should be non-trivial')
  })

  test('prompt_optimize mode returns prompt optimization instruction', () => {
    const prompt = buildSystemPrompt('prompt_optimize')
    assert.ok(prompt.includes('Prompt'), 'should mention Prompt')
    assert.ok(prompt.includes('版权') || prompt.includes('IP'), 'should mention IP/copyright restriction')
  })

  test('storyboard mode returns storyboard instruction', () => {
    const prompt = buildSystemPrompt('storyboard')
    assert.ok(prompt.includes('镜头') || prompt.includes('分镜'), 'should mention storyboard/shots')
  })

  test('asset_analysis mode returns analysis instruction', () => {
    const prompt = buildSystemPrompt('asset_analysis')
    assert.ok(prompt.includes('素材') || prompt.includes('分析'), 'should mention analysis')
  })

  test('undefined mode returns generic prompt', () => {
    const prompt = buildSystemPrompt(undefined)
    assert.ok(prompt.includes('Creator City'), 'should fall through to generic')
  })
})
