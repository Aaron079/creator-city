/**
 * Rendered geometry and dismissal tests for the responsive Canvas inspector shell.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/canvas/shell/CanvasWorkspaceShell.test.tsx
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'

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
  const shellPath = path.resolve(
    process.cwd(),
    'src/components/canvas/shell/CanvasWorkspaceShell.tsx',
  )
  return `
    import * as React from 'react'
    import { flushSync } from 'react-dom'
    import { createRoot } from 'react-dom/client'
    import { CanvasWorkspaceShell } from ${JSON.stringify(shellPath)}

    const root = createRoot(document.getElementById('root'))
    let dismissCount = 0
    let isInspectorOpen = false
    let shouldRestoreFocus = true

    function render() {
      root.render(React.createElement(
        'div',
        { style: { width: '100vw', height: '100vh' } },
        React.createElement('button', { id: 'background-button', type: 'button' }, 'Background action'),
        React.createElement(
          CanvasWorkspaceShell,
          {
            showRightInspector: isInspectorOpen,
            rightInspector: React.createElement(
              'div',
              { id: 'inspector-content' },
              React.createElement('button', { id: 'inspector-first', type: 'button' }, 'First action'),
              React.createElement('button', { id: 'inspector-last', type: 'button' }, 'Last action'),
            ),
            onDismissRightInspector() {
              dismissCount += 1
              isInspectorOpen = false
              render()
            },
            shouldRestoreInspectorFocus() { return shouldRestoreFocus },
            onInspectorFocusRestoreHandled() { shouldRestoreFocus = true },
          },
          React.createElement('main', { id: 'stage-content' }, 'Canvas stage'),
        ),
      ))
    }

    window.__canvasWorkspaceShellHarness = {
      dismissCount() { return dismissCount },
      openInspector() {
        isInspectorOpen = true
        flushSync(render)
      },
      openInspectorWithHigherLayerFocus() {
        isInspectorOpen = true
        flushSync(render)
        const higherLayerModal = document.createElement('button')
        higherLayerModal.id = 'higher-layer-modal'
        higherLayerModal.type = 'button'
        document.body.append(higherLayerModal)
        higherLayerModal.focus()
      },
      handoffInspectorToHigherLayer() {
        shouldRestoreFocus = false
        const higherLayerModal = document.createElement('button')
        higherLayerModal.id = 'overlay-focus-handoff'
        higherLayerModal.type = 'button'
        document.body.append(higherLayerModal)
        higherLayerModal.focus()
        isInspectorOpen = false
        flushSync(render)
      },
      unmount() { root.unmount() },
    }
    render()
  `
}

before(async () => {
  tempDirectory = await mkdtemp(path.join(tmpdir(), 'canvas-workspace-shell-'))
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

type CanvasWorkspaceShellHarness = {
  dismissCount: () => number
  handoffInspectorToHigherLayer: () => void
  openInspector: () => void
  openInspectorWithHigherLayerFocus: () => void
  unmount: () => void
}

async function renderPage(viewport: { width: number; height: number }) {
  assert.ok(browser)
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(5_000)
  await page.route('http://creator-city.test/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body style="margin:0"><div id="root"></div></body></html>',
  }))
  await page.goto('http://creator-city.test/canvas')
  await page.addStyleTag({ path: stylesPath })
  await page.addScriptTag({ path: bundlePath })
  return page
}

async function dismissCount(page: Page) {
  return page.evaluate(() => (
    window as unknown as { __canvasWorkspaceShellHarness: CanvasWorkspaceShellHarness }
  ).__canvasWorkspaceShellHarness.dismissCount())
}

async function openInspector(page: Page) {
  await page.evaluate(() => (
    window as unknown as { __canvasWorkspaceShellHarness: CanvasWorkspaceShellHarness }
  ).__canvasWorkspaceShellHarness.openInspector())
  await page.waitForSelector('[data-canvas-region="right-inspector"]')
}

async function waitForAnimationFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())))
}

describe('CanvasWorkspaceShell responsive inspector', () => {
  test('renders the inspector as a bounded desktop aside', async () => {
    const page = await renderPage({ width: 1280, height: 720 })
    await openInspector(page)
    const inspector = await page.locator('[data-canvas-region="right-inspector"]').boundingBox()

    assert.ok(inspector)
    assert.ok(inspector.width >= 320 && inspector.width <= 420)
    assert.equal(inspector.height, 720)
    assert.equal(await page.locator('[data-canvas-inspector-backdrop="true"]').count(), 1)
    await page.close()
  })

  test('renders an accessible mobile sheet with contained focus and panel-local dismissal', async () => {
    const page = await renderPage({ width: 390, height: 844 })
    await page.locator('#background-button').focus()
    await openInspector(page)
    const panel = await page.locator('[data-canvas-inspector-panel="true"]').boundingBox()

    assert.ok(panel)
    assert.equal(panel.x, 16)
    assert.equal(panel.y, 16)
    assert.equal(panel.width, 358)
    assert.equal(panel.height, 812)
    assert.equal(await page.locator('[data-canvas-inspector-panel="true"]').getAttribute('role'), 'dialog')
    assert.equal(await page.locator('[data-canvas-inspector-panel="true"]').getAttribute('aria-modal'), 'true')
    await waitForAnimationFrame(page)
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'inspector-first')

    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'inspector-last')
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'inspector-first')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'inspector-last')

    await page.locator('[data-canvas-inspector-backdrop="true"]').click({ position: { x: 4, y: 4 } })
    assert.equal(await dismissCount(page), 1)
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'background-button')

    await page.evaluate(() => (
      window as unknown as { __canvasWorkspaceShellHarness: CanvasWorkspaceShellHarness }
    ).__canvasWorkspaceShellHarness.openInspectorWithHigherLayerFocus())
    await page.waitForSelector('[data-canvas-region="right-inspector"]')
    await waitForAnimationFrame(page)
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'higher-layer-modal')
    await page.keyboard.press('Escape')
    assert.equal(await dismissCount(page), 1)

    await page.locator('#inspector-first').focus()
    await page.keyboard.press('Escape')
    assert.equal(await dismissCount(page), 2)
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'background-button')

    await page.locator('#background-button').focus()
    await openInspector(page)
    await waitForAnimationFrame(page)
    await page.evaluate(() => (
      window as unknown as { __canvasWorkspaceShellHarness: CanvasWorkspaceShellHarness }
    ).__canvasWorkspaceShellHarness.handoffInspectorToHigherLayer())
    await waitForAnimationFrame(page)
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'overlay-focus-handoff')
    assert.equal(await page.locator('[data-canvas-region="right-inspector"]').count(), 0)

    await page.locator('#background-button').focus()
    await openInspector(page)
    await waitForAnimationFrame(page)
    await page.locator('[data-canvas-inspector-backdrop="true"]').click({ position: { x: 4, y: 4 } })
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'background-button')
    await page.close()
  })

  test('closes the inspector before opening known overlapping canvas overlays', async () => {
    const workspacePath = path.resolve(process.cwd(), 'src/components/create/VisualCanvasWorkspace.tsx')
    const source = await readFile(workspacePath, 'utf8')

    for (const entryPoint of [
      'openCanvasPanel',
      'openNodePreview',
      'openPromptInspector',
      'openMediaDiagnostics',
      'openEdgeDirector',
    ]) {
      const start = source.indexOf(`const ${entryPoint} = useCallback`)
      assert.notEqual(start, -1, `Missing ${entryPoint}`)
      const body = source.slice(start, start + 320)
      assert.match(
        body,
        /dismissInspectorForOverlay\(\)/,
        `${entryPoint} must dismiss the inspector before opening its overlay`,
      )
    }
  })
})
