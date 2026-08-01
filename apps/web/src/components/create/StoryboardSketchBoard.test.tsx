/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/StoryboardSketchBoard.test.tsx
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium, type Browser } from '@playwright/test'
import { StoryboardSketchBoard } from './StoryboardSketchBoard'

declare global {
  interface Window {
    __storyboardSketchBoardHarness: {
      render: (disabled?: boolean) => void
      calls: () => Array<{
        type: 'patch' | 'regenerate'
        shotId: string
        patch?: { movement: string }
      }>
      fetchCount: () => number
    }
  }
}

type FrameFixture = Parameters<typeof StoryboardSketchBoard>[0]['board']['frames'][number]

function frame(overrides: Partial<FrameFixture> = {}): FrameFixture {
  return {
    shotId: 'shot-001',
    renderKey: 'csf1_frame_001',
    status: 'ready',
    composition: 'single',
    camera: { label: '中景', angle: 'eye-level' },
    subjects: [{ label: 'Maya', anchor: 'lower-center' }],
    actionLine: 'left-to-right',
    movement: 'static',
    notes: [],
    ...overrides,
  }
}

const board = {
  version: 1 as const,
  recipeRevision: 'sdr1_recipe_revision',
  updatedAt: '2026-08-01T09:00:00.000Z',
  frames: [
    frame(),
    frame({
      shotId: 'shot-002',
      renderKey: 'csf1_frame_002',
      status: 'needs-review',
      composition: 'two-shot',
      subjects: [
        { label: 'Maya', anchor: 'lower-left' },
        { label: 'Letter', anchor: 'lower-right' },
      ],
      notes: ['主体需要确认'],
    }),
    frame({
      shotId: 'shot-003',
      renderKey: 'csf1_frame_003',
      status: 'stale',
      movement: 'pan',
    }),
  ],
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
  const componentPath = path.resolve(process.cwd(), 'src/components/create/StoryboardSketchBoard.tsx')
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { StoryboardSketchBoard } from ${JSON.stringify(componentPath)}

    const board = ${JSON.stringify(board)}
    const calls = []
    let fetchCount = 0
    globalThis.fetch = (...args) => {
      fetchCount += 1
      throw new Error('Network must not be used by StoryboardSketchBoard')
    }
    const root = createRoot(document.getElementById('root'))

    function render(disabled = false) {
      root.render(React.createElement(StoryboardSketchBoard, {
        board,
        disabled,
        onPatchFrame(shotId, patch) { calls.push({ type: 'patch', shotId, patch }) },
        onRegenerateFrame(shotId) { calls.push({ type: 'regenerate', shotId }) },
      }))
    }

    window.__storyboardSketchBoardHarness = {
      render,
      calls: () => structuredClone(calls),
      fetchCount: () => fetchCount,
    }
  `
}

test.before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'storyboard-sketch-board-'))
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

test('renders shot labels, honest status labels, and deterministic local SVG frames', () => {
  const markup = renderToStaticMarkup(createElement(StoryboardSketchBoard, {
    board,
    onPatchFrame() {},
    onRegenerateFrame() {},
  }))

  assert.match(markup, /镜头 1/)
  assert.match(markup, /镜头 2/)
  assert.match(markup, /草图/)
  assert.match(markup, /需审核/)
  assert.match(markup, /已变更，待恢复本地推演/)
  assert.match(markup, /<svg /)
  assert.match(markup, /运镜: static/)
})

test('disabled state keeps stale frames visibly honest and prevents controls from acting', async () => {
  const page = await browser!.newPage()
  await page.setContent(`<div id="root"></div><script>${await (await import('node:fs/promises')).readFile(bundlePath, 'utf8')}</script>`)
  await page.evaluate(() => window.__storyboardSketchBoardHarness.render(true))

  await assert.rejects(
    page.getByRole('button', { name: '恢复本地推演镜头 3' }).click({ timeout: 300 }),
  )
  assert.equal(await page.getByText('已变更，待恢复本地推演').count(), 1)
  assert.equal(await page.getByLabel('镜头 3 运镜').isDisabled(), true)
  assert.deepEqual(await page.evaluate(() => window.__storyboardSketchBoardHarness.calls()), [])
  assert.equal(await page.evaluate(() => window.__storyboardSketchBoardHarness.fetchCount()), 0)
  await page.close()
})

test('movement changes patch only the targeted frame without network activity', async () => {
  const page = await browser!.newPage()
  await page.setContent(`<div id="root"></div><script>${await (await import('node:fs/promises')).readFile(bundlePath, 'utf8')}</script>`)
  await page.evaluate(() => window.__storyboardSketchBoardHarness.render())

  await page.getByLabel('镜头 2 运镜').selectOption('dolly')

  assert.deepEqual(await page.evaluate(() => window.__storyboardSketchBoardHarness.calls()), [{
    type: 'patch',
    shotId: 'shot-002',
    patch: { movement: 'dolly' },
  }])
  assert.equal(await page.evaluate(() => window.__storyboardSketchBoardHarness.fetchCount()), 0)
  await page.close()
})
