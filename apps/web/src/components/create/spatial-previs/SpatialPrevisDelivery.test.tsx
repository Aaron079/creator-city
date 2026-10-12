import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type Page } from '@playwright/test'
import type { PrevisDeliveryPackage } from '@/lib/spatial-previs/delivery'

let directory = ''
let server: Server
let browser: Browser
let url = ''
let failAssetSave = false
const requests: string[] = []
const evidence = path.resolve('../../.superpowers/qa/director-provenance-20261012')

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'previs-delivery-'))
  await mkdir(evidence, { recursive: true })
  const cwd = process.cwd()
  const workspace = await readFile('src/components/create/VisualCanvasWorkspace.tsx', 'utf8')
  const start = workspace.indexOf('  const handleCreateSpatialPrevisDeliveryNode = useCallback')
  const end = workspace.indexOf('  const openScriptSegmentation = useCallback', start)
  assert.ok(start >= 0 && end > start)
  // Run the real callbacks verbatim; persistence behind them is a local test fixture.
  const callbacks = workspace.slice(start, end)
  const entry = `
    import React, { useCallback } from 'react'
    import { createRoot } from 'react-dom/client'
    import { _roots } from '@react-three/fiber'
    import { SpatialPrevisDirectorPanel } from '${cwd}/src/components/create/spatial-previs/SpatialPrevisDirectorPanel'
    import { normalizeSpatialPrevis, addDefaultActorTrack } from '${cwd}/src/lib/spatial-previs/normalize'
    const initial = addDefaultActorTrack(normalizeSpatialPrevis({ projectId:'delivery-browser', durationSec:5 }))
    initial.scene.references = [{id:'reference-1',assetId:'asset-1',source:'library',mediaType:'image',title:'Reference',url:location.origin+'/reference.jpg'}]
    initial.scene.assetSets = [{id:'scene-assets',role:'scene',referenceIds:['reference-1']}]
    initial.scene.whitebox.entities = [
      {id:'floor',label:'Floor',kind:'floor',confidence:1,position:{x:0,y:-0.75,z:0},size:{x:16,y:0.1,z:16},rotationY:0,sourceAssetIds:['manual']},
      {id:'wall',label:'Wall',kind:'wall',confidence:1,position:{x:0,y:1.2,z:-4},size:{x:9,y:4,z:0.3},rotationY:0,sourceAssetIds:['asset-1']}
    ]
    window.__deliveryPixelsReady = () => ['[data-spatial-previs-viewport] canvas', '[data-spatial-camera-preview] canvas'].every(selector => {
      const canvas=document.querySelector(selector), store=_roots.get(canvas)?.store.getState()
      if(!store)return false
      store.gl.render(store.scene,store.camera)
      const gl=store.gl.getContext(), pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4)
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels)
      const colors=new Set()
      for(let i=0;i<pixels.length;i+=16)colors.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2])
      return colors.size>30
    })
    let nodes = JSON.parse(localStorage.getItem('delivery-nodes') || '[]')
    const projectId = 'delivery-browser', workflowId = 'delivery-workflow'
    const createNode = (kind, node) => { nodes.push({kind,...node}); return node }
    const flushLocalSnapshot = () => localStorage.setItem('delivery-nodes', JSON.stringify(nodes))
    const scheduleCanvasSave = () => { window.__canvasSaveScheduled = true }
    const showCanvasFeedback = message => { window.__deliveryFeedback = message }
    function App() {
      ${callbacks}
      return <SpatialPrevisDirectorPanel initialState={initial} onSave={()=>'success'} onClose={()=>{}}
        onCreateDeliveryNode={handleCreateSpatialPrevisDeliveryNode}
        onDownloadDeliveryPackage={handleDownloadSpatialPrevisDeliveryPackage}
        onSaveDeliveryPackageToAssets={handleSaveSpatialPrevisDeliveryPackageToAssets}/>
    }
    createRoot(document.getElementById('root')).render(<App/>)
  `
  await writeFile(path.join(directory, 'entry.tsx'), entry)
  const entries = await readdir(path.resolve('../..', 'node_modules/.pnpm'))
  const tsx = entries.find(name => name.startsWith('tsx@'))!
  const esbuild = path.resolve('../..', 'node_modules/.pnpm', tsx, 'node_modules/esbuild/bin/esbuild')
  const baseline = path.join(evidence, 'delivery.before.ts')
  // The optional recorded baseline permits a same-code, same-fixture visual comparison.
  for (const variant of ['current', 'baseline']) {
    const args = [path.join(directory, 'entry.tsx'), '--bundle', '--platform=browser', '--format=iife', '--jsx=automatic',
      `--outfile=${directory}/${variant}.js`, `--tsconfig=${cwd}/tsconfig.json`, '--define:process.env.NODE_ENV="test"']
    if (variant === 'baseline') {
      // Future runs can compare by removing only the additive field from the current builder.
      const original = await readFile(baseline, 'utf8').catch(async () => (await readFile('src/lib/spatial-previs/delivery.ts', 'utf8'))
        .replace("import { buildDeliveryProvenance } from './delivery-provenance'\n", '')
        .replace(/\s*provenance: buildDeliveryProvenance\(state\),/, ''))
      await writeFile(path.join(directory, 'baseline-delivery.ts'), original)
      args.push(`--alias:@/lib/spatial-previs/delivery=${directory}/baseline-delivery.ts`)
    }
    const result = spawnSync(esbuild, args, { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
  const css = spawnSync(path.resolve('node_modules/.bin/tailwindcss'), ['-i', 'src/app/globals.css', '-o', `${directory}/style.css`, '-c', 'tailwind.config.ts', '--minify'], { encoding: 'utf8' })
  assert.equal(css.status, 0, css.stderr)
  server = createServer(async (req, res) => {
    const pathname = new URL(req.url!, 'http://localhost').pathname
    if (pathname.startsWith('/api/')) {
      requests.push(`${req.method} ${pathname}`)
      res.setHeader('content-type', 'application/json')
      if (pathname === '/api/projects/delivery-browser/assets') {
        if (req.method === 'POST') {
          let body = ''; for await (const chunk of req) body += chunk
          if (failAssetSave) { res.statusCode = 503; res.end('{}'); return }
          await writeFile(path.join(directory, 'asset.json'), body)
          res.end('{"success":true}'); return
        }
        res.end(await readFile(path.join(directory, 'asset.json'), 'utf8')); return
      }
      res.statusCode = 404; res.end('{}'); return
    }
    if (['/current.js', '/baseline.js', '/style.css'].includes(pathname)) {
      res.setHeader('content-type', pathname.endsWith('.js') ? 'text/javascript' : 'text/css')
      res.end(await readFile(path.join(directory, pathname))); return
    }
    if (pathname === '/reference.jpg') {
      res.setHeader('content-type', 'image/jpeg')
      res.end(await readFile('public/brand/home-cinema-portal-bg.jpg')); return
    }
    const variant = pathname === '/baseline' ? 'baseline' : 'current'
    res.setHeader('content-type', 'text/html')
    res.end(`<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body style="margin:0;background:#101316"><div id="root"></div><script src="/${variant}.js"></script></body></html>`)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  browser = await chromium.launch({ headless: true })
})

after(async () => {
  await browser?.close()
  if (server) await new Promise<void>(resolve => server.close(() => resolve()))
  if (directory) await rm(directory, { recursive: true, force: true })
})

async function open(page: Page, variant = 'current') {
  await page.goto(`${url}/${variant}`)
  await page.locator('[data-spatial-camera-preview] canvas').waitFor()
  await page.getByRole('button', { name: '生成预演节点', exact: true }).waitFor()
  await page.waitForFunction(() => Reflect.get(window, '__deliveryPixelsReady')())
}

test('existing delivery buttons preserve one snapshot through node, download and local asset readback', { timeout: 90_000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await open(page)
    await page.getByRole('button', { name: '生成预演节点', exact: true }).click()
    const node = await page.evaluate(() => JSON.parse(localStorage.getItem('delivery-nodes')!)[0])
    const delivery: PrevisDeliveryPackage = node.metadataJson.previsDelivery
    assert.equal(delivery.provenance?.references[0]?.assetId, 'asset-1')
    assert.equal(delivery.provenance?.references[0]?.status, 'unverified')
    assert.equal(await page.evaluate(() => Reflect.get(window, '__canvasSaveScheduled')), true)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '下载交付包', exact: true }).click()
    const download = await downloadPromise
    const filename = path.join(evidence, download.suggestedFilename())
    await download.saveAs(filename)
    assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')), delivery)
    await page.getByRole('button', { name: '保存到素材库', exact: true }).click()
    await page.getByText('预演交付包已保存到素材库。', { exact: true }).waitFor()
    const asset = await (await page.request.get(`${url}/api/projects/delivery-browser/assets`)).json()
    assert.equal(asset.mimeType, 'application/json')
    assert.deepEqual(asset.metadataJson.previsDelivery, delivery)
    assert.deepEqual(JSON.parse(asset.dataUrl), delivery)
    await writeFile(path.join(evidence, 'local-asset-readback.json'), JSON.stringify(asset, null, 2))
    await page.getByRole('button', { name: '添加人物', exact: true }).click()
    await page.getByRole('button', { name: '生成预演节点', exact: true }).click()
    const nodes = await page.evaluate(() => JSON.parse(localStorage.getItem('delivery-nodes')!))
    assert.deepEqual(nodes[0].metadataJson.previsDelivery, delivery)
    assert.equal(nodes[1].metadataJson.previsDelivery.provenance.actors.length, delivery.provenance!.actors.length + 1)
    await page.reload()
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('delivery-nodes')!)[0].metadataJson.previsDelivery), delivery)
    failAssetSave = true
    await page.getByRole('button', { name: '保存到素材库', exact: true }).click()
    await page.getByText('预演交付包保存失败。', { exact: true }).waitFor()
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'asset.json'), 'utf8')).metadataJson.previsDelivery, delivery)
    assert.deepEqual(errors, [])
    assert.equal(requests.some(request => /generate|jobs|seedance.*POST/.test(request)), false)
  } finally { failAssetSave = false; await page.close() }
})

test('desktop and mobile default controls have identical geometry and text before and after', { timeout: 90_000 }, async () => {
  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport })
    try {
      const layouts = []
      for (const variant of ['baseline', 'current']) {
        await open(page, variant)
        const controls = await page.locator('button, input, select, [role="tab"]').evaluateAll(elements => elements.map(element => {
          const box = element.getBoundingClientRect()
          return { text: element.textContent, label: element.getAttribute('aria-label'), x: box.x, y: box.y, width: box.width, height: box.height }
        }))
        layouts.push(controls)
        await page.screenshot({ path: path.join(evidence, `${viewport.width}-${variant}.png`), fullPage: true })
      }
      assert.deepEqual(layouts[1], layouts[0])
    } finally { await page.close() }
  }
})
