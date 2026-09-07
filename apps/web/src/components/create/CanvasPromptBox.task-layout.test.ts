import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDirectory, 'CanvasPromptBox.tsx'), 'utf8')
const nodeStart = source.indexOf('return (\n    <div ref={boxRef} className="canvas-prompt-box is-node">')

assert.ok(nodeStart >= 0, 'missing final node layout return branch')

const nodeSource = source.slice(nodeStart)

test('node task layout orders the fixed header, scroll body, and fixed footer', () => {
  const footerPanelIndex = nodeSource.indexOf('{renderFooterPanel()}')
  const headerStart = nodeSource.indexOf('className="canvas-node-dialog-fixed-header"')
  const bodyStart = nodeSource.indexOf('className="canvas-node-dialog-scroll-content"')
  const footerStart = nodeSource.indexOf('className="canvas-node-dialog-fixed-footer"')

  assert.ok(footerPanelIndex >= 0, 'missing footer panel at the node layout root')
  assert.match(
    nodeSource,
    /<div ref=\{boxRef\} className="canvas-prompt-box is-node">\s*\{renderFooterPanel\(\)\}\s*<div className="canvas-node-dialog-fixed-header">/,
  )
  assert.ok(headerStart > footerPanelIndex, 'fixed header must follow the root footer panel')
  assert.ok(bodyStart > headerStart, 'scroll content must follow the fixed header')
  assert.ok(footerStart > bodyStart, 'fixed footer must follow the scroll content')
})

test('node task header owns mode context and the close button', () => {
  const headerStart = nodeSource.indexOf('className="canvas-node-dialog-fixed-header"')
  const bodyStart = nodeSource.indexOf('className="canvas-node-dialog-scroll-content"')
  const headerSource = nodeSource.slice(headerStart, bodyStart)

  assert.match(headerSource, /className="canvas-node-dialog-mode"/)
  assert.match(headerSource, /videoModeInfo && videoModeInfo\.mode !== 'text-to-video'/)
  assert.match(headerSource, /taskInputModeLabel \? \(/)
  assert.match(headerSource, /\{taskInputModeLabel\}/)
  assert.match(headerSource, /canvas-node-dialog-expand/)
  assert.doesNotMatch(headerSource, /canvas-prompt-input-wrap/)
  assert.doesNotMatch(headerSource, /canvas-prompt-footer-nav/)
})

test('node task scroll body exclusively owns prompt content', () => {
  const bodyStart = nodeSource.indexOf('className="canvas-node-dialog-scroll-content"')
  const footerStart = nodeSource.indexOf('className="canvas-node-dialog-fixed-footer"')
  const bodySource = nodeSource.slice(bodyStart, footerStart)

  assert.match(bodySource, /className="canvas-prompt-input-wrap"/)
  assert.match(bodySource, /\{promptInput\}/)
  assert.match(bodySource, /\{resultSummary \? \(/)
  assert.match(bodySource, /\{errorMessage \? \(/)
  assert.doesNotMatch(bodySource, /canvas-node-dialog-expand/)
  assert.doesNotMatch(bodySource, /canvas-prompt-footer-nav/)
})

test('node task fixed footer owns provider status and navigation', () => {
  const footerStart = nodeSource.indexOf('className="canvas-node-dialog-fixed-footer"')
  const footerSource = nodeSource.slice(footerStart)

  assert.match(footerSource, /providerNotice && providerStatus !== 'available'/)
  assert.match(footerSource, /className="canvas-provider-notice"/)
  assert.match(footerSource, /className="canvas-prompt-footer-nav"/)
  assert.doesNotMatch(footerSource, /\{promptInput\}/)
})
