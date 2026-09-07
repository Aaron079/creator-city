/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/PromptBoosterPanel.test.tsx
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'
import { analyzePromptBoost } from '@/lib/canvas/prompt-booster'
import { restorePromptBoosterSelection } from './PromptBoosterPanel'

declare global {
  interface Window {
    __promptBoosterHarness: {
      mount: (persistedSelection: { suggestionId: string; title: string } | null) => void
      rerender: (persistedSelection: { suggestionId: string; title: string } | null) => void
      calls: () => Array<{ suggestionId: string; title: string } | null>
    }
  }
}

const nodeFixture = {
  id: 'image-node-1',
  kind: 'image',
  title: 'City portrait',
  prompt: 'portrait of a woman in a city street',
}

let browser: Browser | null = null
let temporaryDirectory = ''
let bundlePath = ''

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
  const componentPath = path.resolve(process.cwd(), 'src/components/create/PromptBoosterPanel.tsx')
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { PromptBoosterPanel } from ${JSON.stringify(componentPath)}

    const nodes = ${JSON.stringify([nodeFixture])}
    let root = null
    let selectionCalls = []

    function renderPanel(persistedSelection) {
      root.render(React.createElement(PromptBoosterPanel, {
        nodes,
        lockedNodeId: 'image-node-1',
        persistedSelection,
        onSelectionChange(selection) {
          selectionCalls.push(selection ? structuredClone(selection) : null)
        },
        onAppendPrompt() {},
        onCreateDerived() {},
        onClose() {},
      }))
    }

    function mount(persistedSelection) {
      root?.unmount()
      document.getElementById('root').replaceChildren()
      root = createRoot(document.getElementById('root'))
      selectionCalls = []
      renderPanel(persistedSelection)
    }

    function rerender(persistedSelection) {
      if (!root) throw new Error('Prompt Booster must be mounted before rerendering')
      renderPanel(persistedSelection)
    }

    window.__promptBoosterHarness = {
      mount,
      rerender,
      calls: () => structuredClone(selectionCalls),
    }
  `
}

async function mountPanel(
  page: Page,
  persistedSelection: { suggestionId: string; title: string } | null,
) {
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
  await page.addScriptTag({ path: bundlePath })
  await page.evaluate((selection) => window.__promptBoosterHarness.mount(selection), persistedSelection)
  await page.getByRole('dialog', { name: '提示词增强 / Prompt Booster' }).waitFor()
}

function suggestionCard(page: Page, title: string) {
  return page.getByRole('group', { name: `增强建议：${title}` })
}

test.before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'prompt-booster-panel-'))
  const entryPath = path.join(temporaryDirectory, 'entry.tsx')
  bundlePath = path.join(temporaryDirectory, 'bundle.js')
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
  ], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(build.status, 0, build.stderr || build.stdout)
  browser = await chromium.launch({ headless: true })
})

test.after(async () => {
  await browser?.close()
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
})

test('restore helper accepts only current suggestions and canonicalizes their title', () => {
  const report = analyzePromptBoost({ kind: 'image', prompt: nodeFixture.prompt })

  assert.deepEqual(
    restorePromptBoosterSelection(report, {
      suggestionId: 'sugg-img-lighting',
      title: 'Old persisted title',
    }),
    { suggestionId: 'sugg-img-lighting', title: '补充光线描述' },
  )
  assert.equal(
    restorePromptBoosterSelection(report, {
      suggestionId: 'retired-rule',
      title: 'Retired rule',
    }),
    null,
  )
  assert.equal(restorePromptBoosterSelection(report, null), null)
})

test('restores a current persisted selection without emitting and keeps it through reanalysis', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  try {
    await mountPanel(page, {
      suggestionId: 'sugg-img-lighting',
      title: 'Old persisted title',
    })

    const selectedCard = suggestionCard(page, '补充光线描述')
    await selectedCard.getByRole('button', { name: '✓ 已选择' }).waitFor()
    assert.equal(await page.getByRole('button', { name: '创建增强版本' }).isEnabled(), true)
    assert.deepEqual(await page.evaluate(() => window.__promptBoosterHarness.calls()), [])

    await page.getByRole('button', { name: '重新分析' }).click()
    await selectedCard.getByRole('button', { name: '✓ 已选择' }).waitFor()
    assert.deepEqual(await page.evaluate(() => window.__promptBoosterHarness.calls()), [])
  } finally {
    await page.close()
  }
})

test('leaves a stale persisted selection inert without rewriting it', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  try {
    await mountPanel(page, { suggestionId: 'retired-rule', title: 'Retired rule' })

    assert.equal(await page.getByRole('button', { name: '创建增强版本' }).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: '✓ 已选择' }).count(), 0)
    assert.deepEqual(await page.evaluate(() => window.__promptBoosterHarness.calls()), [])
  } finally {
    await page.close()
  }
})

test('synchronizes controlled persisted selection changes without emitting callbacks', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  try {
    await mountPanel(page, {
      suggestionId: 'sugg-img-lighting',
      title: '补充光线描述',
    })
    const lightingCard = suggestionCard(page, '补充光线描述')
    const styleCard = suggestionCard(page, '补充视觉风格')
    await lightingCard.getByRole('button', { name: '✓ 已选择' }).waitFor()

    await page.evaluate(() => window.__promptBoosterHarness.rerender(null))
    await lightingCard.getByRole('button', { name: '选择此建议' }).waitFor()
    assert.equal(await page.getByRole('button', { name: '创建增强版本' }).isDisabled(), true)

    await page.evaluate(() => window.__promptBoosterHarness.rerender({
      suggestionId: 'sugg-img-style',
      title: 'Old persisted title',
    }))
    await styleCard.getByRole('button', { name: '✓ 已选择' }).waitFor()

    await page.evaluate(() => window.__promptBoosterHarness.rerender({
      suggestionId: 'retired-rule',
      title: 'Retired rule',
    }))
    await styleCard.getByRole('button', { name: '选择此建议' }).waitFor()
    assert.equal(await page.getByRole('button', { name: '创建增强版本' }).isDisabled(), true)

    await page.evaluate(() => window.__promptBoosterHarness.rerender({
      suggestionId: 'sugg-img-lighting',
      title: 'Old persisted title',
    }))
    await lightingCard.getByRole('button', { name: '✓ 已选择' }).waitFor()
    assert.equal(await styleCard.getByRole('button', { name: '选择此建议' }).isVisible(), true)
    assert.deepEqual(await page.evaluate(() => window.__promptBoosterHarness.calls()), [])
  } finally {
    await page.close()
  }
})

test('emits canonical selection changes when a current suggestion is toggled', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  try {
    await mountPanel(page, null)
    const styleCard = suggestionCard(page, '补充视觉风格')
    const toggle = styleCard.getByRole('button', { name: '选择此建议' })

    assert.equal(await styleCard.count(), 1)
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false')
    await toggle.click()
    assert.equal(
      await styleCard.getByRole('button', { name: '✓ 已选择' }).getAttribute('aria-pressed'),
      'true',
    )
    assert.deepEqual(await page.evaluate(() => window.__promptBoosterHarness.calls()), [
      { suggestionId: 'sugg-img-style', title: '补充视觉风格' },
    ])

    await styleCard.getByRole('button', { name: '✓ 已选择' }).click()
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false')
    assert.deepEqual(await page.evaluate(() => window.__promptBoosterHarness.calls()), [
      { suggestionId: 'sugg-img-style', title: '补充视觉风格' },
      null,
    ])
  } finally {
    await page.close()
  }
})

test('clear and dismiss emit null only when they remove the active selection', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  try {
    await mountPanel(page, {
      suggestionId: 'sugg-img-lighting',
      title: '补充光线描述',
    })

    await suggestionCard(page, '补充视觉风格').getByRole('button', { name: '忽略' }).click()
    assert.deepEqual(await page.evaluate(() => window.__promptBoosterHarness.calls()), [])

    await page.getByRole('button', { name: '清除设定' }).click()
    assert.deepEqual(await page.evaluate(() => window.__promptBoosterHarness.calls()), [null])

    await mountPanel(page, {
      suggestionId: 'sugg-img-lighting',
      title: '补充光线描述',
    })
    await suggestionCard(page, '补充光线描述').getByRole('button', { name: '忽略' }).click()
    assert.deepEqual(await page.evaluate(() => window.__promptBoosterHarness.calls()), [null])
  } finally {
    await page.close()
  }
})
