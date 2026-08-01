import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ToolResultQualityStrip } from './ToolResultQualityStrip'

test('renders preview wording rather than a saved result', () => {
  const html = renderToStaticMarkup(
    <ToolResultQualityStrip
      summary={{
        status: 'preview',
        statusLabel: '预览可用',
        sourceLabel: '主视觉',
        resultLabel: '本地预览已就绪',
        evidence: ['CSS 仅用于本地预览'],
      }}
    />,
  )

  assert.match(html, /预览/)
  assert.doesNotMatch(html, /已保存为资产/)
  assert.doesNotMatch(html, /<button/)
  assert.doesNotMatch(html, /role="status"/)
})

test('renders source and at most two evidence lines without actions', () => {
  const html = renderToStaticMarkup(
    <ToolResultQualityStrip
      summary={{
        status: 'completed',
        statusLabel: '已完成',
        sourceLabel: '节点 A',
        resultLabel: '已创建草案节点',
        evidence: ['证据一', '证据二', '证据三'],
        nextStepLabel: '继续检查',
      }}
    />,
  )

  assert.match(html, /来源/)
  assert.match(html, /证据一/)
  assert.match(html, /证据二/)
  assert.doesNotMatch(html, /证据三/)
  assert.match(html, /继续检查/)
  assert.doesNotMatch(html, /<button/)
})
