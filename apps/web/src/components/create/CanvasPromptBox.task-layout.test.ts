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
  const headerStart = nodeSource.indexOf('className="canvas-node-dialog-fixed-header"')
  const bodyStart = nodeSource.indexOf('className="canvas-node-dialog-scroll-content"')
  const footerStart = nodeSource.indexOf('className="canvas-node-dialog-fixed-footer"')

  assert.ok(headerStart >= 0, 'missing fixed header wrapper')
  assert.ok(bodyStart > headerStart, 'scroll content must follow the fixed header')
  assert.ok(footerStart > bodyStart, 'fixed footer must follow the scroll content')
})

test('node task controls stay within their intended surfaces', () => {
  const headerStart = nodeSource.indexOf('className="canvas-node-dialog-fixed-header"')
  const bodyStart = nodeSource.indexOf('className="canvas-node-dialog-scroll-content"')
  const footerStart = nodeSource.indexOf('className="canvas-node-dialog-fixed-footer"')
  const headerSource = nodeSource.slice(headerStart, bodyStart)
  const bodySource = nodeSource.slice(bodyStart, footerStart)
  const footerSource = nodeSource.slice(footerStart)

  assert.match(headerSource, /className="canvas-node-dialog-mode"/)
  assert.match(headerSource, /canvas-node-dialog-expand/)
  assert.match(bodySource, /className="canvas-prompt-input-wrap"/)
  assert.match(footerSource, /className="canvas-prompt-footer-nav"/)
})
