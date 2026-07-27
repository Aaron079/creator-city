/**
 * Rendered interaction-boundary tests for the Storyboard Director canvas gate.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/StoryboardDirectorInteractionGate.test.tsx
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
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
      await readdir(path.dirname(candidate))
      return candidate
    } catch {
      // Keep looking for the tsx installation that owns esbuild.
    }
  }
  throw new Error('Unable to locate the existing tsx esbuild binary')
}

function harnessSource() {
  const gatePath = path.resolve(
    process.cwd(),
    'src/components/create/canvas/StoryboardDirectorInteractionGate.tsx',
  )
  const shellPath = path.resolve(
    process.cwd(),
    'src/components/canvas/shell/CanvasWorkspaceShell.tsx',
  )
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { CanvasWorkspaceShell } from ${JSON.stringify(shellPath)}
    import { StoryboardDirectorInteractionGate } from ${JSON.stringify(gatePath)}

    let root = createRoot(document.getElementById('root'))
    let allowNavigation = false
    let recovery = null
    let calls = []
    let geometryMode = false

    const link = (id, href, label, extra = {}) => React.createElement(
      'a',
      {
        id,
        href,
        onClick(event) { event.preventDefault() },
        ...extra,
      },
      label,
    )

    function render() {
      const topCommand = geometryMode ? null : React.createElement(
        'nav',
        null,
        link('home-link', '/', 'Home'),
        link('community-link', '/community', 'Community'),
        link('project-center-link', '/projects', 'Project Center'),
        link('assets-link', '/assets', 'Assets'),
        link('dashboard-link', '/dashboard', 'Dashboard'),
        link('empty-target-link', '/settings', 'Empty target', { target: '' }),
        link('top-target-link', '/projects', 'Top target', { target: '_top' }),
        link('parent-target-link', '/assets', 'Parent target', { target: '_parent' }),
        link('external-link', 'https://example.com/docs', 'External'),
        link('new-tab-link', '/community', 'New Tab', { target: '_blank' }),
        link('download-link', '/assets/export.zip', 'Download', { download: 'export.zip' }),
        link('modifier-link', '/dashboard', 'Modified navigation'),
      )
      const leftRail = geometryMode ? null : React.createElement(
        'nav',
        null,
        link('rail-projects-link', '/projects', 'Rail Projects'),
        link('rail-user-exit-link', '/me', 'Rail User'),
      )
      const stage = geometryMode
        ? React.createElement('div', { id: 'geometry-stage-content', style: { height: '100%' } })
        : React.createElement(
          'main',
          null,
          link('stage-link', '/tasks', 'Stage Tasks'),
          React.createElement(
            'button',
            {
              id: 'background-action',
              type: 'button',
              onClick() { calls.push('background-click') },
            },
            'Background action',
          ),
        )
      root.render(React.createElement(
        'div',
        {
          id: 'geometry-host',
          style: { display: 'flex', flexDirection: 'column', height: '900px' },
        },
        React.createElement(
          StoryboardDirectorInteractionGate,
          {
            recovery,
            onBeforeInternalNavigation(href) {
              calls.push('guard:' + href)
              return allowNavigation
            },
            onRestore() {
              calls.push('restore')
              recovery = null
              render()
            },
            onKeepServer() {
              calls.push('keep-server')
              recovery = null
              render()
            },
          },
          React.createElement(
            CanvasWorkspaceShell,
            {
              topCommand,
              leftRail,
              showLeftRail: !geometryMode,
            },
            stage,
          ),
        ),
      ))
    }

    function reset() {
      allowNavigation = false
      recovery = null
      calls = []
      geometryMode = false
      render()
    }

    const recordDocumentKey = (event) => calls.push('document-key:' + event.key)
    const recordWindowKey = (event) => calls.push('window-key:' + event.key)
    document.addEventListener('keydown', recordDocumentKey)
    window.addEventListener('keydown', recordWindowKey)

    function addBodyPortal(id, priorAriaHidden = null) {
      const portal = document.createElement('div')
      portal.id = id
      portal.style.position = 'fixed'
      portal.style.inset = '0'
      portal.style.zIndex = '9999999'
      if (priorAriaHidden !== null) portal.setAttribute('aria-hidden', priorAriaHidden)
      const button = document.createElement('button')
      button.id = id + '-button'
      button.textContent = id + ' action'
      button.addEventListener('click', () => calls.push(id + '-click'))
      button.addEventListener('keydown', (event) => calls.push(id + '-key:' + event.key))
      portal.append(button)
      document.body.append(portal)
    }

    window.__interactionGateHarness = {
      reset,
      allowNavigation(value) {
        allowNavigation = value
      },
      openRecovery(status) {
        recovery = {
          source: 'draft',
          nodeCount: 42,
          stageCRecoveryBatchIds: ['batch-a', 'batch-b'],
          stageCRecoveryStatus: status,
        }
        render()
      },
      mountGeometry() {
        recovery = null
        geometryMode = true
        calls = []
        render()
      },
      addBodyPortal,
      unmount() {
        root.unmount()
      },
      calls() {
        return calls.slice()
      },
    }
    render()
  `
}

before(async () => {
  tempDirectory = await mkdtemp(path.join(tmpdir(), 'storyboard-director-gate-'))
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

type InteractionGateHarness = {
  reset: () => void
  allowNavigation: (allow: boolean) => void
  openRecovery: (status: 'none' | 'merged' | 'blocked') => void
  mountGeometry: () => void
  addBodyPortal: (id: string, priorAriaHidden?: string | null) => void
  unmount: () => void
  calls: () => string[]
}

async function renderPage() {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(5_000)
  await page.route('http://creator-city.test/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body><div id="root"></div></body></html>',
  }))
  await page.goto('http://creator-city.test/canvas')
  await page.addStyleTag({ path: stylesPath })
  await page.addScriptTag({ path: bundlePath })
  await page.waitForSelector('[data-storyboard-director-interaction-shell="true"]')
  return page
}

async function harnessCalls(page: Page) {
  return page.evaluate(() => (
    window as unknown as { __interactionGateHarness: InteractionGateHarness }
  ).__interactionGateHarness.calls())
}

describe('StoryboardDirectorInteractionGate rendered boundary', () => {
  test('the production shell routes stage, top command, and left rail app links through one guard', async () => {
    const page = await renderPage()
    const gateClass = await page.locator('[data-storyboard-director-interaction-shell="true"]').getAttribute('class')
    assert.match(gateClass ?? '', /(?:^|\s)h-full(?:\s|$)/)
    assert.match(gateClass ?? '', /(?:^|\s)min-h-0(?:\s|$)/)
    const guardedLinks = [
      ['home-link', '/'],
      ['community-link', '/community'],
      ['project-center-link', '/projects'],
      ['assets-link', '/assets'],
      ['dashboard-link', '/dashboard'],
      ['empty-target-link', '/settings'],
      ['top-target-link', '/projects'],
      ['parent-target-link', '/assets'],
      ['rail-projects-link', '/projects'],
      ['rail-user-exit-link', '/me'],
      ['stage-link', '/tasks'],
    ] as const
    const initialUrl = page.url()

    for (const [id] of guardedLinks) {
      await page.locator(`#${id}`).click()
      assert.equal(page.url(), initialUrl)
    }
    assert.deepEqual(
      await harnessCalls(page),
      guardedLinks.map(([, href]) => `guard:${href}`),
    )

    for (const id of ['external-link', 'new-tab-link', 'download-link']) {
      await page.locator(`#${id}`).click()
    }
    for (const modifier of ['Alt', 'Control', 'Meta', 'Shift'] as const) {
      await page.locator('#modifier-link').click({ modifiers: [modifier] })
    }
    assert.deepEqual(
      (await harnessCalls(page)).filter((call) => call.startsWith('guard:')),
      guardedLinks.map(([, href]) => `guard:${href}`),
      'external and new-tab links should not be blocked by the same-tab app guard',
    )
    await page.close()
  })

  test('the gate and production shell preserve a 900px flex percentage-height chain', async () => {
    const page = await renderPage()
    await page.evaluate(() => (
      window as unknown as { __interactionGateHarness: InteractionGateHarness }
    ).__interactionGateHarness.mountGeometry())
    const boxes = await page.evaluate(() => {
      const ids = {
        host: document.querySelector('#geometry-host'),
        gate: document.querySelector('[data-storyboard-director-interaction-shell="true"]'),
        shell: document.querySelector('[data-canvas-shell="true"]'),
        stage: document.querySelector('[data-canvas-region="stage"]'),
      }
      return Object.fromEntries(Object.entries(ids).map(([key, element]) => {
        const rect = element?.getBoundingClientRect()
        return [key, rect ? { height: rect.height, top: rect.top, bottom: rect.bottom } : null]
      }))
    })
    for (const key of ['host', 'gate', 'shell', 'stage'] as const) {
      assert.equal(boxes[key]?.height, 900, `${key} should fill the 900px host`)
      assert.equal(boxes[key]?.top, boxes.host?.top)
      assert.equal(boxes[key]?.bottom, boxes.host?.bottom)
    }
    await page.close()
  })

  test('recovery is a fail-closed modal with focus trapping and access restoration', async () => {
    const page = await renderPage()
    await page.locator('#background-action').focus()
    await page.evaluate(() => (
      window as unknown as { __interactionGateHarness: InteractionGateHarness }
    ).__interactionGateHarness.openRecovery('blocked'))

    const dialog = page.getByRole('alertdialog')
    await dialog.waitFor()
    const overlay = page.locator('[data-storyboard-director-recovery-overlay="true"]')
    const overlayClass = await overlay.getAttribute('class')
    assert.match(overlayClass ?? '', /\bfixed\b/)
    assert.match(overlayClass ?? '', /\binset-0\b/)
    assert.equal(await overlay.evaluate((element) => getComputedStyle(element).zIndex), '2147483647')
    assert.equal(await overlay.evaluate((element) => element.parentElement === document.body), true)
    await assert.rejects(
      page.locator('#background-action').click({ timeout: 250 }),
      /inert|intercepts pointer events|Timeout/i,
    )
    assert.equal(await page.locator('#root').getAttribute('inert'), '')
    assert.equal(await page.locator('#root').getAttribute('aria-hidden'), 'true')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), '恢复草稿')

    const keepServer = page.getByRole('button', { name: '确认风险并使用服务器版本' })
    await keepServer.focus()
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), '恢复草稿')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), '确认风险并使用服务器版本')

    await page.keyboard.press('Escape')
    assert.equal(await dialog.count(), 1, 'Escape must not dismiss fail-closed recovery')
    assert.doesNotMatch(await dialog.innerText(), /已合并/)
    assert.match(await dialog.innerText(), /交互已锁定/)
    assert.deepEqual(await harnessCalls(page), [])

    await keepServer.click()
    await dialog.waitFor({ state: 'detached' })
    await page.waitForFunction(() => document.activeElement?.id === 'background-action')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'background-action')
    assert.equal(await page.locator('#root').getAttribute('inert'), null)
    await page.locator('#background-action').click()
    assert.deepEqual(await harnessCalls(page), ['keep-server', 'background-click'])
    await page.close()
  })

  test('recovery blocks global key handlers while preserving dialog button activation', async () => {
    const page = await renderPage()
    await page.evaluate(() => (
      window as unknown as { __interactionGateHarness: InteractionGateHarness }
    ).__interactionGateHarness.openRecovery('blocked'))
    const dialog = page.getByRole('alertdialog')
    await dialog.focus()
    for (const shortcut of [
      'Delete',
      'Backspace',
      'Space',
      '+',
      '-',
      '0',
      'Control+z',
      'Meta+z',
    ]) {
      await page.keyboard.press(shortcut)
    }
    await page.keyboard.press('Escape')
    assert.deepEqual(await harnessCalls(page), [])
    assert.equal(await dialog.count(), 1)

    await page.getByRole('button', { name: '确认风险并使用服务器版本' }).focus()
    await page.keyboard.press('Enter')
    await dialog.waitFor({ state: 'detached' })
    assert.deepEqual(await harnessCalls(page), ['keep-server'])

    await page.evaluate(() => (
      window as unknown as { __interactionGateHarness: InteractionGateHarness }
    ).__interactionGateHarness.openRecovery('blocked'))
    await page.getByRole('button', { name: '确认风险并使用服务器版本' }).focus()
    await page.keyboard.press('Space')
    await page.getByRole('alertdialog').waitFor({ state: 'detached' })
    assert.deepEqual(await harnessCalls(page), ['keep-server', 'keep-server'])
    await page.close()
  })

  test('recovery isolates existing and late body portals and restores their prior accessibility state', async () => {
    const page = await renderPage()
    await page.evaluate(() => {
      const harness = (
        window as unknown as { __interactionGateHarness: InteractionGateHarness }
      ).__interactionGateHarness
      harness.addBodyPortal('before-portal', 'false')
      document.querySelector<HTMLElement>('#before-portal-button')?.focus()
      harness.openRecovery('blocked')
    })
    await page.getByRole('alertdialog').waitFor()
    await page.waitForFunction(() => document.querySelector('#before-portal')?.hasAttribute('inert'))
    await page.evaluate(() => (
      window as unknown as { __interactionGateHarness: InteractionGateHarness }
    ).__interactionGateHarness.addBodyPortal('late-portal'))
    await page.waitForFunction(() => (
      document.querySelector('#before-portal')?.hasAttribute('inert')
      && document.querySelector('#late-portal')?.hasAttribute('inert')
    ))
    for (const id of ['before-portal', 'late-portal']) {
      assert.equal(await page.locator(`#${id}`).getAttribute('inert'), '')
      assert.equal(await page.locator(`#${id}`).getAttribute('aria-hidden'), 'true')
      await page.evaluate((portalId) => {
        const button = document.querySelector<HTMLButtonElement>(`#${portalId}-button`)
        button?.focus()
        button?.click()
        button?.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Delete',
        }))
      }, id)
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), '恢复草稿')
    }
    assert.deepEqual(await harnessCalls(page), [])

    await page.getByRole('button', { name: '确认风险并使用服务器版本' }).click()
    await page.getByRole('alertdialog').waitFor({ state: 'detached' })
    assert.equal(await page.locator('#before-portal').getAttribute('inert'), null)
    assert.equal(await page.locator('#before-portal').getAttribute('aria-hidden'), 'false')
    assert.equal(await page.locator('#late-portal').getAttribute('inert'), null)
    assert.equal(await page.locator('#late-portal').getAttribute('aria-hidden'), null)
    await page.locator('#late-portal-button').click()
    await page.locator('#late-portal-button').press('Delete')
    assert.deepEqual(await harnessCalls(page), [
      'keep-server',
      'late-portal-click',
      'late-portal-key:Delete',
      'document-key:Delete',
      'window-key:Delete',
    ])
    await page.close()
  })

  test('recovery safely handles an empty prior focus target', async () => {
    const page = await renderPage()
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      ;(
        window as unknown as { __interactionGateHarness: InteractionGateHarness }
      ).__interactionGateHarness.openRecovery('blocked')
    })
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), '恢复草稿')
    await page.getByRole('button', { name: '确认风险并使用服务器版本' }).click()
    await page.getByRole('alertdialog').waitFor({ state: 'detached' })
    assert.equal(await page.locator('#root').getAttribute('inert'), null)
    await page.close()
  })

  test('unmount restores body portal accessibility state and removes the recovery portal', async () => {
    const page = await renderPage()
    await page.evaluate(() => {
      const harness = (
        window as unknown as { __interactionGateHarness: InteractionGateHarness }
      ).__interactionGateHarness
      harness.addBodyPortal('unmount-portal', 'false')
      harness.openRecovery('blocked')
    })
    await page.waitForFunction(() => document.querySelector('#unmount-portal')?.hasAttribute('inert'))
    await page.evaluate(() => (
      window as unknown as { __interactionGateHarness: InteractionGateHarness }
    ).__interactionGateHarness.unmount())
    await page.waitForFunction(() => !document.querySelector('[data-storyboard-director-recovery-overlay="true"]'))
    assert.equal(await page.locator('#unmount-portal').getAttribute('inert'), null)
    assert.equal(await page.locator('#unmount-portal').getAttribute('aria-hidden'), 'false')
    await page.close()
  })

  test('merged recovery copy truthfully distinguishes a completed risk merge', async () => {
    const page = await renderPage()
    await page.evaluate(() => (
      window as unknown as { __interactionGateHarness: InteractionGateHarness }
    ).__interactionGateHarness.openRecovery('merged'))
    const dialog = page.getByRole('alertdialog')
    await dialog.waitFor()
    assert.match(await dialog.innerText(), /恢复标记已合并/)
    assert.doesNotMatch(await dialog.innerText(), /无法安全合并/)
    await page.close()
  })
})
