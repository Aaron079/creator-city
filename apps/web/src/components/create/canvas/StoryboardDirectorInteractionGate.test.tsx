/**
 * Rendered interaction-boundary tests for the Storyboard Director canvas gate.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/StoryboardDirectorInteractionGate.test.tsx
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'

let browser: Browser | null = null
let bundlePath = ''
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
      root.render(React.createElement(
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
            topCommand: React.createElement(
              'nav',
              null,
              link('home-link', '/', 'Home'),
              link('community-link', '/community', 'Community'),
              link('project-center-link', '/projects', 'Project Center'),
              link('assets-link', '/assets', 'Assets'),
              link('dashboard-link', '/dashboard', 'Dashboard'),
              link('external-link', 'https://example.com/docs', 'External'),
              link('new-tab-link', '/community', 'New Tab', { target: '_blank' }),
            ),
            leftRail: React.createElement(
              'nav',
              null,
              link('rail-projects-link', '/projects', 'Rail Projects'),
              link('rail-user-exit-link', '/me', 'Rail User'),
            ),
            showLeftRail: true,
          },
          React.createElement(
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
          ),
        ),
      ))
    }

    function reset() {
      allowNavigation = false
      recovery = null
      calls = []
      render()
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

    await page.locator('#external-link').click()
    await page.locator('#new-tab-link').click()
    assert.deepEqual(
      await harnessCalls(page),
      guardedLinks.map(([, href]) => `guard:${href}`),
      'external and new-tab links should not be blocked by the same-tab app guard',
    )
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
    assert.match(overlayClass ?? '', /(?:^|\s)z-\[5000\](?:\s|$)/)
    await assert.rejects(
      page.locator('#background-action').click({ timeout: 250 }),
      /inert|intercepts pointer events|Timeout/i,
    )
    assert.equal(await page.locator('[data-storyboard-director-guarded-content="true"]').getAttribute('inert'), '')
    assert.equal(await page.locator('[data-storyboard-director-guarded-content="true"]').getAttribute('aria-hidden'), 'true')
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
    assert.equal(await page.locator('[data-storyboard-director-guarded-content="true"]').getAttribute('inert'), null)
    await page.locator('#background-action').click()
    assert.deepEqual(await harnessCalls(page), ['keep-server', 'background-click'])
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
