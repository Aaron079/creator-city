import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { before, after, test } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'

let browser: Browser
let directory = ''
let script = ''
const require = createRequire(import.meta.url)

before(async () => {
  const source = await readFile('src/components/create/VisualCanvasWorkspace.tsx', 'utf8')
  const constants = [...source.matchAll(/^const (?:MIN_CANVAS_ZOOM|MAX_CANVAS_ZOOM) = .+$/gm)].map(match => match[0]).join('\n')
  const initial = source.match(/const \[canvasZoom, setCanvasZoom\] = useState\(([^)]+)\)/)![1]
  const handlers = source.slice(source.indexOf('  const setZoomAroundPoint = useCallback'), source.indexOf('  const showCanvasFeedback = useCallback'))
  const toolbar = source.slice(source.indexOf('      <div className="canvas-zoom-controls">'), source.lastIndexOf('\n    </div>\n    </div>\n    </CanvasWorkspaceShell>'))
  assert.ok(handlers.includes('const resetCanvasView'))
  assert.ok(toolbar.includes('Canvas zoom'))
  directory = await mkdtemp(path.join(tmpdir(), 'canvas-zoom-baseline-'))
  const viewportImport = source.includes("from '@/lib/canvas/viewport'")
    ? `import { CANVAS_BASE_ZOOM, canvasZoomPercent } from '${process.cwd()}/src/lib/canvas/viewport'`
    : ''
  await writeFile(path.join(directory, 'entry.tsx'), `
    import React, { useCallback, useRef, useState } from 'react'
    import { createRoot } from 'react-dom/client'
    ${viewportImport}
    ${constants}
    const clampCanvasZoom = value => Math.max(MIN_CANVAS_ZOOM, Math.min(value, MAX_CANVAS_ZOOM))
    function App() {
      const saved = new URLSearchParams(location.search).get('saved')
      const [canvasZoom, setCanvasZoom] = useState(saved ? Number(saved) : ${initial})
      const [canvasPan, setCanvasPan] = useState({x:0,y:0})
      const viewportRef = useRef(null)
      ${handlers}
      return <><div ref={viewportRef} data-testid="viewport" style={{position:'relative',width:1000,height:600}}>
        <div data-testid="surface" style={{transformOrigin:'0 0',transform:'translate('+canvasPan.x+'px,'+canvasPan.y+'px) scale('+canvasZoom+')'}}>
          <div data-testid="node" style={{position:'absolute',left:200,top:120,width:380,height:194,background:'#333'}}/>
          <svg style={{overflow:'visible'}}><path data-testid="edge" d="M 580 217 L 720 217"/></svg>
        </div></div>
        ${toolbar}
        <div data-testid="dialog" style={{width:560,fontSize:14}}>Unscaled dialog</div>
      </>
    }
    createRoot(document.getElementById('root')).render(<App/>);
  `)
  const build = spawnSync(require.resolve('esbuild/bin/esbuild'), [path.join(directory, 'entry.tsx'), '--bundle', '--platform=browser', '--jsx=automatic', `--outfile=${directory}/bundle.js`], { encoding: 'utf8', env: { ...process.env, NODE_PATH: path.resolve('node_modules') } })
  assert.equal(build.status, 0, build.stderr)
  script = await readFile(path.join(directory, 'bundle.js'), 'utf8')
  browser = await chromium.launch({ headless: true })
})

after(async () => { await browser?.close(); if (directory) await rm(directory, { recursive: true, force: true }) })

async function open(saved?: number) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  await page.route('http://zoom.test/**', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0"><div id="root"></div></body>' }))
  await page.goto(`http://zoom.test/${saved ? '?saved=' + saved : ''}`)
  await page.addScriptTag({ content: script })
  await page.getByLabel('Canvas zoom').waitFor()
  return page
}

async function changeZoom(page: Page, value: number) {
  await page.getByLabel('Canvas zoom').evaluate((input: HTMLInputElement, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

test('new canvas shows 100% at the approved 46% physical scale', async () => {
  const page = await open()
  try {
    assert.equal(await page.getByLabel('Canvas zoom').inputValue(), '0.46')
    assert.equal(await page.getByRole('button', { name: '100%', exact: true }).count(), 1)
    const node = await page.getByTestId('node').boundingBox()
    assert.ok(Math.abs(node!.width - 380 * 0.46) < 0.05)
    assert.ok(Math.abs(node!.height - 194 * 0.46) < 0.05)
  } finally { await page.close() }
})

test('saved zoom is not migrated and reset changes only viewport', async () => {
  const page = await open(0.92)
  try {
    assert.equal(await page.getByRole('button', { name: '200%', exact: true }).count(), 1)
    const geometry = await page.getByTestId('node').getAttribute('style')
    const edge = await page.getByTestId('edge').getAttribute('d')
    const dialog = await page.getByTestId('dialog').boundingBox()
    await page.getByRole('button', { name: '200%', exact: true }).click()
    assert.equal(await page.getByLabel('Canvas zoom').inputValue(), '0.46')
    assert.equal(await page.getByTestId('node').getAttribute('style'), geometry)
    assert.equal(await page.getByTestId('edge').getAttribute('d'), edge)
    assert.deepEqual(await page.getByTestId('dialog').boundingBox(), dialog)
  } finally { await page.close() }
})

test('zoom keeps focal point stable and reset returns the approved size', async () => {
  const page = await open(0.46)
  try {
    await changeZoom(page, 0.92)
    const matrix = await page.getByTestId('surface').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).toJSON())
    assert.ok(Math.abs(matrix.a - 0.92) < 0.001)
    assert.ok(Math.abs(matrix.e + 500) < 0.001)
    assert.ok(Math.abs(matrix.f + 300) < 0.001)
    await page.getByRole('button', { name: '200%', exact: true }).click()
    assert.equal(await page.getByLabel('Canvas zoom').inputValue(), '0.46')
  } finally { await page.close() }
})

test('legacy physical 1x view is retained and labelled against the new baseline', async () => {
  const page = await open(1)
  try {
    assert.equal(await page.getByLabel('Canvas zoom').inputValue(), '1')
    assert.equal(await page.getByRole('button', { name: '217%', exact: true }).count(), 1)
    assert.equal(await page.getByLabel('Canvas zoom').getAttribute('aria-valuetext'), '217%')
    assert.equal((await page.getByTestId('node').boundingBox())!.width, 380)
  } finally { await page.close() }
})

test('project creation and missing-viewport defaults share the baseline without migrating stored values', async () => {
  for (const file of [
    'src/components/projects/NewProjectDialog.tsx',
    'src/lib/projects/ensure-active-project.ts',
    'src/app/api/projects/route.ts',
    'src/app/api/projects/[projectId]/canvas/route.ts',
  ]) {
    const source = await readFile(file, 'utf8')
    assert.match(source, /import \{ CANVAS_BASE_ZOOM \} from '@\/lib\/canvas\/viewport'/, file)
    assert.match(source, /zoom: CANVAS_BASE_ZOOM/, file)
    assert.doesNotMatch(source, /zoom: 1\b/, file)
  }
  const workspace = await readFile('src/components/create/VisualCanvasWorkspace.tsx', 'utf8')
  assert.match(workspace, /setCanvasZoom\(Number\(viewport\?\.zoom \?\? CANVAS_BASE_ZOOM\)\)/)
  assert.doesNotMatch(workspace, /zoom: 1\b|setCanvasZoom\(1\)|useState\(1\).*canvasZoom/)
})
