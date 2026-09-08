import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'

let browser: Browser | null = null
let bundlePath = ''
let stylesPath = ''
let tempDirectory = ''
let workspaceSource = ''
const require = createRequire(import.meta.url)
const esbuildBinary = require.resolve('esbuild/bin/esbuild')

function harnessSource() {
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import styles from ${JSON.stringify(path.resolve(process.cwd(), 'src/components/create/canvas.module.css'))}
    import { CanvasPromptBox } from ${JSON.stringify(path.resolve(process.cwd(), 'src/components/create/CanvasPromptBox.tsx'))}
    import { getCanvasNodeContextSurfaceLayout, stabilizeCanvasTaskDialogSizing } from ${JSON.stringify(path.resolve(process.cwd(), 'src/components/create/canvas/canvasWorkspaceLayout.ts'))}
    import { LocalReferenceStrip } from ${JSON.stringify(path.resolve(process.cwd(), 'src/components/create/canvas/task/LocalReferenceStrip.tsx'))}
    import { UpstreamTaskStrip } from ${JSON.stringify(path.resolve(process.cwd(), 'src/components/create/canvas/task/UpstreamTaskStrip.tsx'))}

    const scenario = new URLSearchParams(window.location.search).get('scenario') || 'image-done'
    const isText = scenario === 'text-script'
    const isVideo = scenario === 'video-mode'
    const isByokMissingEndpoint = scenario === 'image-byok-missing-endpoint'
    const isByokEmpty = scenario === 'image-byok-empty'
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
    const longPrompt = Array.from(
      { length: 12 },
      (_, index) => 'Prompt line ' + (index + 1) + ': preserve the subject while refining motion and lighting.',
    ).join('\\n')
    let accountCount = 0
    let applyCount = 0
    let removeCount = 0
    let uploadCount = 0
    let compactFixedControls = false
    let noncompactMeasurements = null
    let nodeRect = { left: 530, top: 64, width: 380, height: 194 }
    let latestStackLayout = null
    const sizingHistory = []

    function billingDetails() {
      if (!isByokMissingEndpoint && !isByokEmpty) {
        return React.createElement(
          'div',
          { className: 'canvas-node-dialog-billing-details' },
          React.createElement('p', { className: 'canvas-node-dialog-billing-note' }, 'Billing detail remains available'),
        )
      }

      if (isByokEmpty) {
        return React.createElement(
          'div',
          { className: 'canvas-node-dialog-billing-details' },
          React.createElement(
            'p',
            { className: 'canvas-node-dialog-billing-empty' },
            '未配置匹配 API 账户。',
            React.createElement(
              'a',
              {
                className: 'canvas-node-dialog-billing-warning-link',
                href: '/account/providers', target: '_blank', rel: 'noopener noreferrer',
              },
              '前往添加',
            ),
          ),
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
            id: 'canvas-stage',
            style: { position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' },
          },
          React.createElement(
            'div',
            {
              id: 'node-navigation',
              style: { position: 'absolute', left: 20, top: 28, width: 350, height: 28 },
            },
            'Task navigation',
          ),
          React.createElement(
            'div',
            {
              id: 'representative-node',
              style: {
                position: 'absolute', left: 530, top: 64, width: 380, height: 194,
                boxSizing: 'border-box',
                background: '#20242b', border: '1px solid rgba(255,255,255,0.12)',
              },
            },
            'Image node',
          ),
          React.createElement(
          'div',
          {
            id: 'task-dialog',
            className: 'canvas-node-dialog create-floating-console',
            style: { position: 'absolute', left: 16, top: 292, width: 358, height: 282 },
          },
          React.createElement(
            'div',
            { id: 'fixed-top', className: 'canvas-node-dialog-fixed-controls is-top' },
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
          React.createElement(CanvasPromptBox, {
            prompt: longPrompt,
            onPromptChange() {},
            model: isVideo ? 'video-model' : isText ? 'text-model' : 'volcengine-seedream-image',
            modelLabel: isVideo ? 'Video model' : isText ? 'Text model' : 'Seedream image',
            models: isVideo ? ['video-model'] : isText ? ['text-model'] : ['volcengine-seedream-image'],
            onModelChange() {},
            placeholder: 'Describe the task',
            layout: 'node',
            onClose() {},
            onGenerate() {},
            generateLabel: 'Generate',
            estimatedCredits: 8,
            ratio: '16:9',
            ratios: ['16:9', '9:16'],
            onRatioChange() {},
            footerItems: [{
              id: 'provider', label: 'Provider', value: 'provider',
              options: [{ value: 'provider', label: 'Provider' }],
              onSelect() {},
            }],
            taskInputModeLabel: isVideo ? undefined : isText ? 'Text task' : 'Image task',
            videoModeInfo: isVideo ? {
              mode: 'image-to-video', sourceNodeTitle: 'Upstream portrait',
            } : undefined,
          }),
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
              billingDetails(),
            ),
          ),
        ),
      ),
      ),
    )

    function applyStackLayout(stageHeight, dialogHeight) {
      const stageElement = document.getElementById('canvas-stage')
      const navigation = document.getElementById('node-navigation')
      const node = document.getElementById('representative-node')
      const dialog = document.getElementById('task-dialog')
      const stage = { left: 0, top: 0, right: window.innerWidth, bottom: stageHeight }
      stageElement.style.height = stageHeight + 'px'

      let layout = getCanvasNodeContextSurfaceLayout({ node: nodeRect, stage, dialogHeight })
      if (layout.panDeltaY !== 0) {
        nodeRect = { ...nodeRect, top: nodeRect.top + layout.panDeltaY }
        layout = getCanvasNodeContextSurfaceLayout({ node: nodeRect, stage, dialogHeight })
      }

      Object.assign(navigation.style, {
        left: layout.navigation.left + 'px', top: layout.navigation.top + 'px',
        width: layout.navigation.width + 'px', height: layout.navigation.height + 'px',
      })
      Object.assign(node.style, {
        left: nodeRect.left + 'px', top: nodeRect.top + 'px',
        width: nodeRect.width + 'px', height: nodeRect.height + 'px',
      })
      Object.assign(dialog.style, {
        left: layout.dialog.left + 'px', top: layout.dialog.top + 'px',
        width: layout.dialog.width + 'px', height: layout.dialog.height + 'px',
      })
      latestStackLayout = layout
      return layout
    }

    function runSizingPass(stageHeight) {
      const dialog = document.getElementById('task-dialog')
      const fixedTop = document.getElementById('fixed-top')
      const fixedBottom = document.getElementById('fixed-bottom')
      const promptHeader = dialog.querySelector('.canvas-node-dialog-fixed-header')
      const promptFooter = dialog.querySelector('.canvas-node-dialog-fixed-footer')
      const measurements = {
        fixedTopHeight: fixedTop.offsetHeight,
        fixedBottomHeight: fixedBottom.offsetHeight,
        promptChromeHeight: promptHeader.offsetHeight + promptFooter.offsetHeight,
      }
      const wasCompact = compactFixedControls
      const sizing = stabilizeCanvasTaskDialogSizing({
        stageHeight,
        measurements,
        compactFixedControls,
        noncompactMeasurements,
      })
      compactFixedControls = sizing.compactFixedControls
      noncompactMeasurements = sizing.noncompactMeasurements
      dialog.style.height = sizing.height + 'px'
      for (const element of [dialog, fixedTop, fixedBottom]) {
        element.classList.toggle('is-compact-fixed-controls', compactFixedControls)
      }
      const stackLayout = applyStackLayout(stageHeight, sizing.height)
      const entry = {
        wasCompact,
        compactFixedControls,
        height: sizing.height,
        measurements,
        isVerticallyConstrained: stackLayout.isVerticallyConstrained,
        minimumStageHeight: stackLayout.minimumStageHeight,
      }
      sizingHistory.push(entry)
      return entry
    }

    async function settleSizing(stageHeight, passCount = 4) {
      for (let pass = 0; pass < passCount; pass += 1) {
        runSizingPass(stageHeight)
        await new Promise((resolve) => window.requestAnimationFrame(resolve))
      }
      return sizingHistory.slice()
    }

    window.__taskDialogHarness = {
      accountCount() { return accountCount }, applyCount() { return applyCount },
      removeCount() { return removeCount }, uploadCount() { return uploadCount },
      settleSizing,
      sizingHistory() { return sizingHistory.slice() },
      stackLayout() { return latestStackLayout },
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
  const build = spawnSync(esbuildBinary, [
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

type HarnessSizingEntry = {
  wasCompact: boolean
  compactFixedControls: boolean
  height: number
  isVerticallyConstrained: boolean
  minimumStageHeight: number
  measurements: {
    fixedTopHeight: number
    fixedBottomHeight: number
    promptChromeHeight: number
  }
}

type TaskDialogHarness = HarnessCounters & {
  settleSizing: (stageHeight: number, passCount?: number) => Promise<HarnessSizingEntry[]>
  sizingHistory: () => HarnessSizingEntry[]
  stackLayout: () => {
    isVerticallyConstrained: boolean
    minimumStageHeight: number
  }
}

async function renderScenario(
  scenario: string,
  viewportHeight = 300,
  viewportWidth = 390,
) {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: viewportWidth, height: viewportHeight } })
  page.setDefaultTimeout(5_000)
  await page.route('http://creator-city.test/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body style="margin:0;background:#111"><div id="root"></div></body></html>',
  }))
  await page.goto(`http://creator-city.test/task-dialog?scenario=${scenario}`)
  await page.addStyleTag({ path: stylesPath })
  await page.addScriptTag({ path: bundlePath })
  await page.locator('#task-dialog').waitFor()
  await page.evaluate(async () => {
    const harness = (window as unknown as { __taskDialogHarness: TaskDialogHarness }).__taskDialogHarness
    await harness.settleSizing(window.innerHeight)
  })
  return page
}

async function assertStackOrdering(page: Page, expectedConstrained: boolean) {
  const geometry = await page.evaluate(() => {
    const stageRect = document.getElementById('canvas-stage')?.getBoundingClientRect()
    const navigationRect = document.getElementById('node-navigation')?.getBoundingClientRect()
    const nodeRect = document.getElementById('representative-node')?.getBoundingClientRect()
    const dialogRect = document.getElementById('task-dialog')?.getBoundingClientRect()
    if (!stageRect || !navigationRect || !nodeRect || !dialogRect) throw new Error('missing stack surface')
    const harness = (window as unknown as { __taskDialogHarness: TaskDialogHarness }).__taskDialogHarness
    return {
      stage: { top: stageRect.top, bottom: stageRect.bottom },
      navigation: { top: navigationRect.top, bottom: navigationRect.bottom },
      node: { top: nodeRect.top, bottom: nodeRect.bottom },
      dialog: { top: dialogRect.top, bottom: dialogRect.bottom },
      layout: harness.stackLayout(),
    }
  })

  assert.equal(geometry.layout.isVerticallyConstrained, expectedConstrained)
  assert.ok(geometry.navigation.bottom <= geometry.node.top)
  assert.ok(geometry.node.bottom <= geometry.dialog.top)
  assert.ok(geometry.dialog.top >= geometry.stage.top + 16)
  assert.ok(geometry.dialog.bottom <= geometry.stage.bottom - 16)

  if (expectedConstrained) {
    assert.ok(geometry.layout.minimumStageHeight > geometry.stage.bottom - geometry.stage.top)
    assert.ok(geometry.navigation.top < geometry.stage.top)
  } else {
    assert.ok(geometry.layout.minimumStageHeight <= geometry.stage.bottom - geometry.stage.top)
    assert.ok(geometry.navigation.top >= geometry.stage.top + 16)
    assert.ok(geometry.node.bottom <= geometry.stage.bottom - 16)
  }

  return geometry
}

async function harnessCount(page: Page, key: keyof HarnessCounters) {
  return page.evaluate((counterKey) => {
    const harness = (window as unknown as { __taskDialogHarness: TaskDialogHarness }).__taskDialogHarness
    return harness[counterKey]()
  }, key)
}

async function assertConstrainedSurface(page: Page) {
  await assertStackOrdering(page, true)
  const dialogBox = await page.locator('#task-dialog').boundingBox()
  const topBox = await page.locator('#fixed-top').boundingBox()
  const bottomBox = await page.locator('#fixed-bottom').boundingBox()
  const promptBox = page.locator('#task-dialog .canvas-prompt-box.is-node')
  const headerBox = await promptBox.locator('.canvas-node-dialog-fixed-header').boundingBox()
  const bodyBox = await promptBox.locator('.canvas-node-dialog-scroll-content').boundingBox()
  const footerBox = await promptBox.locator('.canvas-node-dialog-fixed-footer').boundingBox()
  const scrollMetrics = await promptBox.locator('.canvas-prompt-input').evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  const sizingHistory = await page.evaluate(() => {
    const harness = (window as unknown as { __taskDialogHarness: TaskDialogHarness }).__taskDialogHarness
    return harness.sizingHistory()
  })

  assert.ok(dialogBox)
  assert.ok(topBox)
  assert.ok(bottomBox)
  assert.ok(headerBox)
  assert.ok(bodyBox)
  assert.ok(footerBox)
  assert.equal(sizingHistory[0]?.wasCompact, false, 'first pass must begin from the regular sizing state')
  assert.ok(
    sizingHistory.slice(1).every((entry) => entry.compactFixedControls === sizingHistory.at(-1)?.compactFixedControls),
    'fixed-rail remeasurement must settle without toggling layout modes',
  )
  assert.equal(sizingHistory.at(-1)?.height, sizingHistory.at(-2)?.height)
  assert.ok(topBox.height <= 56, `fixed top rail was ${topBox.height}px tall`)
  assert.ok(bottomBox.height <= 56, `fixed bottom rail was ${bottomBox.height}px tall`)
  assert.ok(
    bodyBox.height >= 32,
    `prompt body was only ${bodyBox.height}px tall (dialog=${dialogBox.height}px, top=${topBox.height}px, header=${headerBox.height}px, footer=${footerBox.height}px, bottom=${bottomBox.height}px)`,
  )
  assert.ok(
    scrollMetrics.scrollHeight > scrollMetrics.clientHeight,
    `prompt body did not scroll (${scrollMetrics.scrollHeight}px <= ${scrollMetrics.clientHeight}px)`,
  )
  const scrollTop = await promptBox.locator('.canvas-prompt-input').evaluate((element) => {
    element.scrollTop = element.scrollHeight
    return element.scrollTop
  })
  assert.ok(scrollTop > 0, 'long prompt did not produce a usable scroll offset')
  assert.ok(topBox.y + topBox.height <= headerBox.y, 'top context rail must precede the prompt header')
  assert.ok(footerBox.y + footerBox.height <= bottomBox.y, 'billing rail must follow the prompt footer')
  assert.ok(
    Math.abs(topBox.width - dialogBox.width) <= 2,
    `top context rail must use full dialog width (${topBox.width}px of ${dialogBox.width}px)`,
  )
  assert.ok(
    Math.abs(bottomBox.width - dialogBox.width) <= 2,
    `billing rail must use full dialog width (${bottomBox.width}px of ${dialogBox.width}px)`,
  )
  for (const box of [topBox, bottomBox, headerBox, bodyBox, footerBox]) {
    assert.ok(box.y >= dialogBox.y)
    assert.ok(box.y + box.height <= dialogBox.y + dialogBox.height)
  }

  return {
    fixedTopHeight: topBox.height,
    fixedBottomHeight: bottomBox.height,
    promptHeaderHeight: headerBox.height,
    promptBodyHeight: bodyBox.height,
    promptFooterHeight: footerBox.height,
  }
}

test('keeps the complete navigation-node-dialog stack inside a supported stage', async () => {
  const page = await renderScenario('image-done', 800)
  await assertStackOrdering(page, false)
  await page.close()
})

test('renders the approved creative-workbench stack with compact one-line rails', async () => {
  const page = await renderScenario('image-done', 900, 1440)
  const dialog = await page.locator('#task-dialog').boundingBox()
  const topRail = await page.locator('#fixed-top').boundingBox()
  const navigation = await page.locator('#node-navigation').boundingBox()
  const footerRow1 = await page.locator('.canvas-node-dialog-fixed-footer .canvas-prompt-footer-row1').boundingBox()
  const footerRow2 = await page.locator('.canvas-node-dialog-fixed-footer .canvas-prompt-footer-row2').boundingBox()
  const promptHeader = await page.locator('.canvas-node-dialog-fixed-header').boundingBox()
  const bottomRail = await page.locator('#fixed-bottom').boundingBox()
  const billingDetails = await page.locator('.canvas-node-dialog-billing-details').boundingBox()
  const closeButton = await page.getByRole('button', { name: '关闭节点面板' }).boundingBox()
  const modelControl = await page.locator('.canvas-footer-button.is-primary-pill').boundingBox()
  const parameterControl = await page.locator('.canvas-footer-button.is-reference-pill').boundingBox()
  const generateControl = await page.locator('.canvas-generate-button').boundingBox()
  const footerLayout = await page.locator('.canvas-node-dialog-fixed-footer .canvas-prompt-footer-nav').evaluate((element) => ({
    display: getComputedStyle(element).display,
    direction: getComputedStyle(element).flexDirection,
  }))
  const scrollOwnership = await page.locator('#task-dialog .canvas-node-dialog-scroll-content').evaluate((element) => {
    const input = element.querySelector<HTMLElement>('.canvas-prompt-input')
    return {
      content: getComputedStyle(element).overflowY,
      input: input ? getComputedStyle(input).overflowY : null,
    }
  })

  assert.ok(dialog)
  assert.ok(topRail)
  assert.ok(navigation)
  assert.ok(footerRow1)
  assert.ok(footerRow2)
  assert.ok(promptHeader)
  assert.ok(bottomRail)
  assert.ok(billingDetails)
  assert.ok(closeButton)
  assert.ok(modelControl)
  assert.ok(parameterControl)
  assert.ok(generateControl)
  assert.equal(await page.locator('#task-dialog').evaluate((element) => (
    element.classList.contains('is-compact-fixed-controls')
  )), false)
  assert.equal(Math.round(navigation.width), 380)
  assert.equal(Math.round(dialog.width), 760)
  assert.ok(Math.abs((dialog.x + dialog.width / 2) - (navigation.x + navigation.width / 2)) <= 2)
  assert.ok(Math.abs(topRail.width - dialog.width) <= 2)
  assert.deepEqual(footerLayout, { display: 'flex', direction: 'row' })
  assert.ok(
    Math.abs(footerRow1.y - footerRow2.y) <= 2,
    `model and parameter controls must share one rail (${footerRow1.y}px and ${footerRow2.y}px)`,
  )
  assert.ok(modelControl.x + modelControl.width <= parameterControl.x)
  assert.ok(parameterControl.x + parameterControl.width <= generateControl.x)
  assert.equal(Math.round(topRail.height), 44, `desktop top rail was ${topRail.height}px tall`)
  assert.equal(Math.round(bottomRail.height), 38, `desktop billing rail was ${bottomRail.height}px tall`)
  assert.ok(Math.round(footerRow1.height) <= 48, `fixed control rail was ${footerRow1.height}px tall`)
  assert.equal(scrollOwnership.content, 'hidden')
  assert.equal(scrollOwnership.input, 'auto')
  assert.ok(promptHeader.height <= 1, `desktop header consumed ${promptHeader.height}px above the prompt`)
  assert.ok(closeButton.y >= topRail.y && closeButton.y + closeButton.height <= topRail.y + topRail.height)
  if (process.env.CANVAS_TASK_DIALOG_SCREENSHOT) {
    await page.screenshot({ path: process.env.CANVAS_TASK_DIALOG_SCREENSHOT })
  }
  await page.close()
})

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

test('keeps a completed image reference and remove action reachable at 390x300', async (t) => {
  const page = await renderScenario('image-done')
  await assertConstrainedSurface(page)
  assert.equal(await page.getByText('已上传').isVisible(), true)
  const removeButton = page.locator('.canvas-task-reference-card button[aria-label="移除"]')
  await removeButton.scrollIntoViewIfNeeded()
  const [removeBox, closeBox] = await Promise.all([
    removeButton.boundingBox(),
    page.getByRole('button', { name: '关闭节点面板' }).boundingBox(),
  ])
  assert.ok(removeBox)
  assert.ok(closeBox)
  assert.ok(
    removeBox.x + removeBox.width <= closeBox.x || closeBox.x + closeBox.width <= removeBox.x,
    `reference remove and close actions overlap (${removeBox.x}-${removeBox.x + removeBox.width} vs ${closeBox.x}-${closeBox.x + closeBox.width})`,
  )
  t.diagnostic(`reference actions: remove=${removeBox.x},${removeBox.y},${removeBox.width}x${removeBox.height}; close=${closeBox.x},${closeBox.y},${closeBox.width}x${closeBox.height}`)
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

test('keeps the real image-to-video mode header visible at 390x300', async (t) => {
  const page = await renderScenario('video-mode')
  const geometry = await assertConstrainedSurface(page)
  const videoModeBar = page.locator('.canvas-video-mode-bar.is-image-to-video')
  assert.equal(await videoModeBar.isVisible(), true)
  await assert.doesNotReject(videoModeBar.getByText('图生视频').waitFor())
  await assert.doesNotReject(videoModeBar.getByText('参考图：Upstream portrait').waitFor())
  assert.equal(await page.getByText('Video model', { exact: true }).isVisible(), true)
  assert.equal(await page.getByRole('button', { name: '参数' }).isVisible(), true)
  assert.equal(await page.getByText('8 credits', { exact: true }).isVisible(), true)
  assert.equal(await page.getByRole('button', { name: 'Generate' }).isVisible(), true)
  assert.equal(await page.getByRole('button', { name: '关闭节点面板' }).isVisible(), true)
  assert.ok(
    geometry.promptHeaderHeight >= 40,
    `expected the production video header, measured ${geometry.promptHeaderHeight}px`,
  )
  t.diagnostic(
    `video compact geometry: fixedTop=${geometry.fixedTopHeight}px, fixedBottom=${geometry.fixedBottomHeight}px, `
      + `header=${geometry.promptHeaderHeight}px, body=${geometry.promptBodyHeight}px, footer=${geometry.promptFooterHeight}px`,
  )
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
  if (process.env.CANVAS_TASK_DIALOG_BYOK_SCREENSHOT) {
    await page.screenshot({ path: process.env.CANVAS_TASK_DIALOG_BYOK_SCREENSHOT })
  }
  await warningLink.click()
  await page.close()
})

test('keeps the empty BYOK account state readable in the fixed bottom rail', async () => {
  const page = await renderScenario('image-byok-empty')
  await assertConstrainedSurface(page)
  const bottomRail = await page.locator('#fixed-bottom').boundingBox()
  const billingDetails = await page.locator('.canvas-node-dialog-billing-details').boundingBox()
  const status = page.getByText(/未配置匹配 API 账户/)
  const link = page.getByText('前往添加', { exact: true })
  const statusBox = await status.boundingBox()
  const linkBox = await link.boundingBox()

  assert.ok(bottomRail)
  assert.ok(billingDetails)
  assert.ok(statusBox)
  assert.ok(linkBox)
  assert.ok(statusBox.y >= bottomRail.y && statusBox.y + statusBox.height <= bottomRail.y + bottomRail.height)
  assert.ok(
    linkBox.x + linkBox.width <= bottomRail.x + bottomRail.width,
    `BYOK link escaped the rail: link right ${linkBox.x + linkBox.width}px, rail right ${bottomRail.x + bottomRail.width}px; details ${billingDetails.x}-${billingDetails.x + billingDetails.width}px`,
  )
  if (process.env.CANVAS_TASK_DIALOG_EMPTY_BYOK_SCREENSHOT) {
    await page.screenshot({ path: process.env.CANVAS_TASK_DIALOG_EMPTY_BYOK_SCREENSHOT })
  }
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
