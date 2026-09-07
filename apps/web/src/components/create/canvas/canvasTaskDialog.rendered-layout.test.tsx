import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { chromium, type Browser } from '@playwright/test'

let browser: Browser | null = null
let bundlePath = ''
let stylesPath = ''
let tempDirectory = ''

async function findEsbuildBinary() {
  const pnpmDirectory = path.resolve(process.cwd(), '../..', 'node_modules/.pnpm')
  const entries = (await readdir(pnpmDirectory)).filter((entry) => entry.startsWith('tsx@')).sort()
  for (const entry of entries) {
    const candidate = path.join(pnpmDirectory, entry, 'node_modules/esbuild/bin/esbuild')
    try {
      await access(candidate)
      return candidate
    } catch {
      // Keep looking for the existing tsx installation that owns esbuild.
    }
  }
  throw new Error('Unable to locate the existing tsx esbuild binary')
}

function harnessSource() {
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import styles from ${JSON.stringify(path.resolve(process.cwd(), 'src/components/create/canvas.module.css'))}
    import { LocalReferenceStrip } from ${JSON.stringify(path.resolve(process.cwd(), 'src/components/create/canvas/task/LocalReferenceStrip.tsx'))}
    import { UpstreamTaskStrip } from ${JSON.stringify(path.resolve(process.cwd(), 'src/components/create/canvas/task/UpstreamTaskStrip.tsx'))}

    const upstreamNode = {
      id: 'source-image',
      type: 'image',
      kind: 'image',
      title: 'Upstream portrait',
      subtitle: '',
      prompt: '',
      model: '',
      providerId: '',
      stage: '',
      status: 'done',
      x: 0,
      y: 0,
      width: 248,
      height: 220,
      createdAt: 1,
    }
    const refs = [{
      inputId: 'local-reference',
      status: 'error',
      originalFileName: 'portrait-reference-with-a-long-name.png',
      mimeType: 'image/png',
      errorMessage: 'UPLOAD_TIMEOUT',
    }]
    let removeCount = 0

    createRoot(document.getElementById('root')).render(
      React.createElement(
        'div',
        { className: styles.scope },
        React.createElement(
          'div',
          {
            id: 'task-dialog',
            className: 'canvas-node-dialog create-floating-console is-compact-fixed-controls',
            style: { width: 358, height: 232 },
          },
          React.createElement(
            'div',
            {
              id: 'fixed-top',
              className: 'canvas-node-dialog-fixed-controls is-top is-compact-fixed-controls',
            },
            React.createElement(UpstreamTaskStrip, {
              targetNodeId: 'target-video',
              nodes: [upstreamNode],
              edges: [{ id: 'edge-1', fromNodeId: 'source-image', toNodeId: 'target-video' }],
            }),
            React.createElement(LocalReferenceStrip, {
              nodeKind: 'video',
              refs,
              scriptInputs: [],
              onImageUpload() {},
              onRemoveRef() { removeCount += 1 },
              onScriptUpload() {},
              onRemoveScript() {},
              onApplyScript() {},
            }),
          ),
          React.createElement(
            'div',
            { className: 'canvas-prompt-box is-node' },
            React.createElement(
              'div',
              { id: 'prompt-header', className: 'canvas-node-dialog-fixed-header' },
              React.createElement('span', { className: 'canvas-node-dialog-mode' }, 'Video task'),
              React.createElement('button', { type: 'button', 'aria-label': 'Close' }, 'x'),
            ),
            React.createElement(
              'div',
              { id: 'prompt-body', className: 'canvas-node-dialog-scroll-content' },
              React.createElement('textarea', {
                className: 'canvas-prompt-input',
                defaultValue: 'Prompt body remains scrollable',
              }),
            ),
            React.createElement(
              'div',
              { id: 'prompt-footer', className: 'canvas-node-dialog-fixed-footer' },
              React.createElement(
                'div',
                { className: 'canvas-prompt-footer-nav' },
                React.createElement(
                  'div',
                  { className: 'canvas-prompt-footer-row1' },
                  React.createElement('button', { type: 'button' }, 'Provider'),
                  React.createElement('button', { type: 'button' }, 'Generate'),
                ),
                React.createElement(
                  'div',
                  { className: 'canvas-prompt-footer-row2' },
                  React.createElement('button', { type: 'button' }, 'Parameters'),
                ),
              ),
            ),
          ),
          React.createElement(
            'div',
            { id: 'fixed-bottom', className: 'canvas-node-dialog-fixed-controls is-bottom' },
            React.createElement(
              'div',
              { className: 'canvas-node-dialog-billing-controls' },
              React.createElement('p', { className: 'canvas-node-dialog-billing-title' }, 'API source'),
              React.createElement(
                'div',
                { className: 'canvas-node-dialog-billing-modes' },
                React.createElement('button', { type: 'button' }, 'Own account'),
                React.createElement('button', { type: 'button' }, 'Credits'),
              ),
              React.createElement(
                'div',
                { className: 'canvas-node-dialog-billing-details' },
                'Billing detail remains available',
              ),
            ),
          ),
        ),
      ),
    )

    window.__taskDialogHarness = {
      removeCount() { return removeCount },
    }
  `
}

before(async () => {
  tempDirectory = await mkdtemp(path.join(tmpdir(), 'canvas-task-dialog-'))
  const entryPath = path.join(tempDirectory, 'entry.tsx')
  bundlePath = path.join(tempDirectory, 'bundle.js')
  stylesPath = path.join(tempDirectory, 'bundle.css')
  await writeFile(entryPath, harnessSource(), 'utf8')
  const build = spawnSync(await findEsbuildBinary(), [
    entryPath,
    '--bundle',
    '--platform=browser',
    '--format=iife',
    '--jsx=automatic',
    '--external:/brand/*',
    `--outfile=${bundlePath}`,
    `--tsconfig=${path.resolve(process.cwd(), 'tsconfig.json')}`,
    '--define:process.env.NODE_ENV="test"',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  assert.equal(build.status, 0, build.stderr || build.stdout)
  await access(stylesPath)
  browser = await chromium.launch({ headless: true })
})

after(async () => {
  await browser?.close()
  if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true })
})

test('keeps compact task references and prompt fixed surfaces reachable at 390x300', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 390, height: 300 } })
  page.setDefaultTimeout(5_000)
  await page.route('http://creator-city.test/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body style="margin:0;background:#111"><div id="root"></div></body></html>',
  }))
  await page.goto('http://creator-city.test/task-dialog')
  await page.addStyleTag({ path: stylesPath })
  await page.addScriptTag({ path: bundlePath })

  const top = page.locator('#fixed-top')
  const promptBody = page.locator('#prompt-body')
  const dialogBox = await page.locator('#task-dialog').boundingBox()
  const topBox = await top.boundingBox()
  const bodyBox = await promptBody.boundingBox()
  const bottomBox = await page.locator('#fixed-bottom').boundingBox()
  const headerBox = await page.locator('#prompt-header').boundingBox()
  const footerBox = await page.locator('#prompt-footer').boundingBox()

  assert.ok(dialogBox)
  assert.ok(topBox)
  assert.ok(bodyBox)
  assert.ok(bottomBox)
  assert.ok(headerBox)
  assert.ok(footerBox)
  assert.ok(topBox.height <= 72, `compact fixed top was ${topBox.height}px tall`)
  assert.ok(bodyBox.height > 0, `prompt body was ${bodyBox.height}px tall`)
  assert.ok(Math.abs(topBox.y - bottomBox.y) < 1, 'fixed controls must share the compact top row')
  for (const box of [topBox, bottomBox, headerBox, bodyBox, footerBox]) {
    assert.ok(box.y >= dialogBox.y)
    assert.ok(box.y + box.height <= dialogBox.y + dialogBox.height)
  }
  assert.equal(await page.locator('.canvas-task-upstream-strip').count(), 1)
  assert.equal(await page.locator('.canvas-task-upstream-item').count(), 1)
  assert.equal(await page.locator('.canvas-task-local-reference-strip').count(), 1)
  assert.equal(await page.locator('.canvas-task-reference-card').count(), 1)
  assert.equal(await page.locator('#prompt-header').isVisible(), true)
  assert.equal(await page.locator('#prompt-footer').isVisible(), true)
  assert.equal(await page.locator('#fixed-bottom').isVisible(), true)

  const upstreamItem = page.locator('.canvas-task-upstream-item')
  await upstreamItem.scrollIntoViewIfNeeded()
  const upstreamBox = await upstreamItem.boundingBox()
  assert.ok(upstreamBox)
  assert.ok(upstreamBox.y >= topBox.y)
  assert.ok(upstreamBox.y + upstreamBox.height <= topBox.y + topBox.height)

  const overflow = await top.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
    }
  })
  assert.equal(overflow.overflowX, 'auto')
  assert.equal(overflow.overflowY, 'hidden')
  assert.ok(overflow.scrollWidth > overflow.clientWidth)

  const uploadButton = page.locator('.canvas-task-reference-upload')
  await uploadButton.scrollIntoViewIfNeeded()
  const uploadBox = await uploadButton.boundingBox()
  assert.ok(uploadBox)
  assert.ok(uploadBox.y >= topBox.y)
  assert.ok(uploadBox.y + uploadBox.height <= topBox.y + topBox.height)

  const removeButton = page.locator('.canvas-task-reference-card button[aria-label="移除"]')
  await removeButton.scrollIntoViewIfNeeded()
  await removeButton.click()
  assert.equal(await page.evaluate(() => (
    window as unknown as { __taskDialogHarness: { removeCount: () => number } }
  ).__taskDialogHarness.removeCount()), 1)

  await page.close()
})
