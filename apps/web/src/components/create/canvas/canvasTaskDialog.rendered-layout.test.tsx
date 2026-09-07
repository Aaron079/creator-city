import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'

let browser: Browser | null = null
let bundlePath = ''
let stylesPath = ''
let tempDirectory = ''
let workspaceSource = ''

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

    const scenario = new URLSearchParams(window.location.search).get('scenario') || 'image-done'
    const isText = scenario === 'text-script'
    const isVideo = scenario === 'video-mode'
    const isByokMissingEndpoint = scenario === 'image-byok-missing-endpoint'
    const refStatus = scenario === 'image-uploading' ? 'uploading' : 'done'
    const upstreamNode = {
      id: 'source-image', type: 'image', kind: 'image', title: 'Upstream portrait',
      subtitle: '', prompt: '', model: '', providerId: '', stage: '', status: 'done',
      x: 0, y: 0, width: 248, height: 220, createdAt: 1,
    }
    const refs = isText ? [] : [{
      inputId: 'local-reference', status: refStatus,
      originalFileName: 'portrait-reference-with-a-long-name.png', mimeType: 'image/png',
    }]
    const scriptInputs = isText ? [{
      inputId: 'script-reference', fileName: 'scene-outline.fountain', mimeType: 'text/plain',
      textPreview: 'INT. CREATOR CITY - NIGHT\\nA compact scene begins.',
      fullText: 'INT. CREATOR CITY - NIGHT', importedAt: '2026-09-07T00:00:00.000Z', charCount: 25,
    }] : []
    let accountCount = 0
    let applyCount = 0
    let removeCount = 0
    let uploadCount = 0

    function billingDetails() {
      if (!isByokMissingEndpoint) {
        return React.createElement(
          'div',
          { className: 'canvas-node-dialog-billing-details' },
          React.createElement('p', { className: 'canvas-node-dialog-billing-note' }, 'Billing detail remains available'),
        )
      }

      return React.createElement(
        'div',
        { className: 'canvas-node-dialog-billing-details' },
        React.createElement(
          'div',
          { className: 'canvas-node-dialog-billing-account-state space-y-1.5' },
          React.createElement(
            'p',
            {
              className: 'canvas-node-dialog-billing-note text-[9px] text-violet-300/45 leading-relaxed',
              style: { margin: '0 0 6px', lineHeight: '18px' },
            },
            'Seedream image - billed to Volcengine - Creator City does not deduct credits',
          ),
          React.createElement(
            'div',
            {
              className: 'canvas-node-dialog-account-list space-y-1',
              style: { display: 'flex', overflowX: 'auto', paddingBottom: 2 },
            },
            React.createElement(
              'button',
              {
                className: 'canvas-node-dialog-account-card w-full rounded-xl border px-3 py-2 text-left transition flex items-center justify-between gap-2',
                type: 'button',
                style: {
                  width: 260, minWidth: 260, padding: '8px 12px', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between',
                },
                onClick() { accountCount += 1 },
              },
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
                React.createElement('span', null, 'Volcengine production'),
                React.createElement('span', null, '.... 4821 - missing Endpoint ID'),
              ),
              React.createElement('div', null, '✓'),
            ),
          ),
          React.createElement(
            'p',
            {
              className: 'canvas-node-dialog-billing-warning text-[11px] text-amber-400/70',
              style: { margin: '6px 0 0', lineHeight: '18px' },
            },
            'Missing Endpoint ID, update it in ',
            React.createElement(
              'a',
              {
                className: 'canvas-node-dialog-billing-warning-link ml-1 underline hover:text-amber-300',
                href: '/account/providers', target: '_blank', rel: 'noopener noreferrer',
              },
              'My API accounts',
            ),
            '.',
          ),
        ),
      )
    }

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
            { id: 'fixed-top', className: 'canvas-node-dialog-fixed-controls is-top is-compact-fixed-controls' },
            React.createElement(UpstreamTaskStrip, {
              targetNodeId: 'target-node', nodes: [upstreamNode],
              edges: [{ id: 'edge-1', fromNodeId: 'source-image', toNodeId: 'target-node' }],
            }),
            React.createElement(LocalReferenceStrip, {
              nodeKind: isText ? 'text' : isVideo ? 'video' : 'image', refs, scriptInputs,
              onImageUpload() { uploadCount += 1 },
              onRemoveRef() { removeCount += 1 },
              onScriptUpload() {},
              onRemoveScript() { removeCount += 1 },
              onApplyScript() { applyCount += 1 },
            }),
          ),
          React.createElement(
            'div',
            { className: 'canvas-prompt-box is-node' },
            React.createElement(
              'div',
              { id: 'prompt-header', className: 'canvas-node-dialog-fixed-header' },
              React.createElement(
                'span',
                { id: 'prompt-mode', className: 'canvas-node-dialog-mode' },
                isVideo ? 'Video task' : isText ? 'Text task' : 'Image task',
              ),
              React.createElement('button', { type: 'button', 'aria-label': 'Close' }, 'x'),
            ),
            React.createElement(
              'div',
              { id: 'prompt-body', className: 'canvas-node-dialog-scroll-content' },
              React.createElement('textarea', {
                className: 'canvas-prompt-input', defaultValue: 'Prompt body remains scrollable',
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
            { id: 'fixed-bottom', className: 'canvas-node-dialog-fixed-controls is-bottom is-compact-fixed-controls' },
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
              billingDetails(),
            ),
          ),
        ),
      ),
    )

    window.__taskDialogHarness = {
      accountCount() { return accountCount }, applyCount() { return applyCount },
      removeCount() { return removeCount }, uploadCount() { return uploadCount },
    }
  `
}

before(async () => {
  workspaceSource = await readFile(
    path.resolve(process.cwd(), 'src/components/create/VisualCanvasWorkspace.tsx'),
    'utf8',
  )
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

type HarnessCounters = {
  accountCount: () => number
  applyCount: () => number
  removeCount: () => number
  uploadCount: () => number
}

async function renderScenario(scenario: string) {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 390, height: 300 } })
  page.setDefaultTimeout(5_000)
  await page.route('http://creator-city.test/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body style="margin:0;background:#111"><div id="root"></div></body></html>',
  }))
  await page.goto(`http://creator-city.test/task-dialog?scenario=${scenario}`)
  await page.addStyleTag({ path: stylesPath })
  await page.addScriptTag({ path: bundlePath })
  return page
}

async function harnessCount(page: Page, key: keyof HarnessCounters) {
  return page.evaluate((counterKey) => {
    const harness = (window as unknown as { __taskDialogHarness: HarnessCounters }).__taskDialogHarness
    return harness[counterKey]()
  }, key)
}

async function assertConstrainedSurface(page: Page) {
  const dialogBox = await page.locator('#task-dialog').boundingBox()
  const topBox = await page.locator('#fixed-top').boundingBox()
  const bottomBox = await page.locator('#fixed-bottom').boundingBox()
  const headerBox = await page.locator('#prompt-header').boundingBox()
  const bodyBox = await page.locator('#prompt-body').boundingBox()
  const footerBox = await page.locator('#prompt-footer').boundingBox()

  assert.ok(dialogBox)
  assert.ok(topBox)
  assert.ok(bottomBox)
  assert.ok(headerBox)
  assert.ok(bodyBox)
  assert.ok(footerBox)
  assert.ok(topBox.height <= 72, `compact fixed top was ${topBox.height}px tall`)
  assert.ok(bottomBox.height <= 72, `compact fixed bottom was ${bottomBox.height}px tall`)
  assert.ok(bodyBox.height > 0, `prompt body was ${bodyBox.height}px tall`)
  assert.ok(Math.abs(topBox.y - bottomBox.y) < 1, 'fixed controls must share the compact top row')
  for (const box of [topBox, bottomBox, headerBox, bodyBox, footerBox]) {
    assert.ok(box.y >= dialogBox.y)
    assert.ok(box.y + box.height <= dialogBox.y + dialogBox.height)
  }
}

test('keeps an uploading image reference and upload action reachable at 390x300', async () => {
  const page = await renderScenario('image-uploading')
  await assertConstrainedSurface(page)
  assert.equal(await page.getByText('上传中').isVisible(), true)
  const uploadButton = page.locator('.canvas-task-reference-upload')
  await uploadButton.scrollIntoViewIfNeeded()
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    uploadButton.click(),
  ])
  await fileChooser.setFiles({
    name: 'replacement.png', mimeType: 'image/png', buffer: Buffer.from('image'),
  })
  assert.equal(await harnessCount(page, 'uploadCount'), 1)
  await page.close()
})

test('keeps a completed image reference and remove action reachable at 390x300', async () => {
  const page = await renderScenario('image-done')
  await assertConstrainedSurface(page)
  assert.equal(await page.getByText('已上传').isVisible(), true)
  const removeButton = page.locator('.canvas-task-reference-card button[aria-label="移除"]')
  await removeButton.scrollIntoViewIfNeeded()
  await removeButton.click()
  assert.equal(await harnessCount(page, 'removeCount'), 1)
  await page.close()
})

test('keeps ScriptCard and Apply to Prompt reachable at 390x300', async () => {
  const page = await renderScenario('text-script')
  await assertConstrainedSurface(page)
  const applyButton = page.locator('.canvas-task-script-card-apply')
  await applyButton.scrollIntoViewIfNeeded()
  await applyButton.click()
  assert.equal(await harnessCount(page, 'applyCount'), 1)
  await page.close()
})

test('keeps the video mode header visible at 390x300', async () => {
  const page = await renderScenario('video-mode')
  await assertConstrainedSurface(page)
  assert.equal(await page.locator('#prompt-mode').textContent(), 'Video task')
  assert.equal(await page.locator('#prompt-mode').isVisible(), true)
  await page.close()
})

test('keeps selected image BYOK account and missing-endpoint warning reachable at 390x300', async () => {
  const page = await renderScenario('image-byok-missing-endpoint')
  await assertConstrainedSurface(page)
  const accountCard = page.locator('.canvas-node-dialog-account-card')
  await accountCard.scrollIntoViewIfNeeded()
  await accountCard.click()
  assert.equal(await harnessCount(page, 'accountCount'), 1)
  const warningLink = page.locator('.canvas-node-dialog-billing-warning-link')
  await warningLink.scrollIntoViewIfNeeded()
  assert.equal(await warningLink.getAttribute('href'), '/account/providers')
  assert.equal(await warningLink.isVisible(), true)
  await warningLink.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true })
  })
  await warningLink.click()
  await page.close()
})

test('locks the rendered BYOK fixture to semantic billing account-state markup', () => {
  assert.match(workspaceSource, /className="canvas-node-dialog-billing-account-state space-y-1\.5"/)
  assert.match(workspaceSource, /className="canvas-node-dialog-billing-note text-\[9px\]/)
  assert.match(workspaceSource, /className="canvas-node-dialog-billing-loading text-\[11px\]/)
  assert.match(workspaceSource, /className="canvas-node-dialog-billing-empty text-\[11px\]/)
  assert.match(workspaceSource, /className=\{`canvas-node-dialog-account-card w-full/)
  assert.match(workspaceSource, /className="canvas-node-dialog-billing-warning text-\[11px\]/)
  assert.match(workspaceSource, /className="canvas-node-dialog-billing-warning-link ml-1 underline/)
})
