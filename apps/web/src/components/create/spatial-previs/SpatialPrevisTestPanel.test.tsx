import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeSpatialPrevis } from '@/lib/spatial-previs/normalize'
import { SpatialPrevisDirectorPanel } from './SpatialPrevisDirectorPanel'
import { SpatialPrevisTestPanel } from './SpatialPrevisTestPanel'

Object.assign(globalThis, { React })

test('shows only the 5 and 10 second choices with a provider-neutral internal test command', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisTestPanel, {
    advisory: '当前覆盖存在提示，仍可运行内部测试。',
    disabled: false,
    status: { kind: 'idle' },
    onRun: () => undefined,
  }))

  assert.match(markup, /5 秒/)
  assert.match(markup, /10 秒/)
  assert.equal((markup.match(/aria-pressed=/g) ?? []).length, 2)
  assert.match(markup, /运行预演测试/)
  assert.match(markup, /当前覆盖存在提示，仍可运行内部测试。/)
  assert.doesNotMatch(markup, /Seedance|seedance|模型|供应商|provider|entitlement/)
})

test('renders submitted and failed internal test status without provider details', () => {
  const submitted = renderToStaticMarkup(createElement(SpatialPrevisTestPanel, {
    advisory: '覆盖提示仅供参考。',
    status: { kind: 'submitted', message: '预演测试已提交。' },
    onRun: () => undefined,
  }))
  const failed = renderToStaticMarkup(createElement(SpatialPrevisTestPanel, {
    advisory: '覆盖提示仅供参考。',
    status: { kind: 'failed', message: '预演测试提交失败。' },
    onRun: () => undefined,
  }))

  assert.match(submitted, /role="status"[^>]*>预演测试已提交。/)
  assert.match(failed, /role="alert"[^>]*>预演测试提交失败。/)
  assert.doesNotMatch(`${submitted}${failed}`, /Seedance|seedance|模型|供应商|provider|entitlement/)
})

test('keeps the internal test command available for a non-destructive retryable status', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisTestPanel, {
    advisory: '覆盖提示仅供参考。',
    status: { kind: 'retryable', message: '三维预演测试仍在生成中，可重新运行测试。' },
    onRun: () => undefined,
  }))

  assert.match(markup, /role="status"[^>]*>三维预演测试仍在生成中，可重新运行测试。/)
  assert.match(markup, /重新运行预演测试/)
  assert.doesNotMatch(markup, /disabled=""/)
  assert.doesNotMatch(markup, /Seedance|seedance|模型|供应商|provider|entitlement/)
})

test('composes the internal test panel outside advanced delivery', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisDirectorPanel, {
    initialState: normalizeSpatialPrevis({ projectId: 'project-test-panel', durationSec: 10 }),
    onSave: () => undefined,
    spatialPrevisTestStatus: { kind: 'retryable', message: '三维预演测试仍在生成中，可重新运行测试。' },
    onRunSpatialPrevisTest: async () => ({ success: true, message: '预演测试已提交。' }),
    onDeliverToSeedance: async () => ({ success: true, message: 'submitted' }),
    onClose: () => undefined,
  }))

  const testPanelIndex = markup.indexOf('aria-label="预演内部测试"')
  const advancedDeliveryIndex = markup.indexOf('<details')
  assert.ok(testPanelIndex >= 0)
  assert.ok(advancedDeliveryIndex > testPanelIndex)
  assert.match(markup, /重新运行预演测试/)
})
