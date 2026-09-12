import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type Page } from '@playwright/test'

let directory = ''
let server: Server
let browser: Browser
let url = ''
const evidence = path.resolve('../../.superpowers/qa/spatial-studio')

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'spatial-studio-'))
  await mkdir(evidence, { recursive: true })
  const cwd = process.cwd()
  const entry = `
    import React, { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import { _roots } from '@react-three/fiber'
    import { Vector3 } from 'three'
    import { SpatialPrevisViewport } from '${cwd}/src/components/create/spatial-previs/SpatialPrevisViewport'
    import { normalizeSpatialPrevis, addDefaultActorTrack } from '${cwd}/src/lib/spatial-previs/normalize'
    import { parseSpatialPrevisMetadata } from '${cwd}/src/lib/spatial-previs/persistence'
    import { buildPrevisDeliveryPackage } from '${cwd}/src/lib/spatial-previs/delivery'
    import { exportPrevisWebM } from '${cwd}/src/lib/spatial-previs/video-export'
    let initial = addDefaultActorTrack(normalizeSpatialPrevis({projectId:'studio-browser-test',durationSec:5}))
    initial.scene.references = [{id:'ref-1',assetId:'image-1',title:'参考场景',mediaType:'image',source:'upload',url:location.origin+'/reference.jpg'}]
    initial.scene.whitebox.entities = [
      {id:'floor',label:'地面',kind:'floor',confidence:1,position:{x:0,y:-0.75,z:0},size:{x:16,y:0.1,z:16},rotationY:0,sourceAssetIds:['manual']},
      {id:'wall',label:'后墙',kind:'wall',confidence:1,position:{x:0,y:1.2,z:-4},size:{x:9,y:4,z:0.3},rotationY:0,sourceAssetIds:['image-1']},
      {id:'table',label:'桌子',kind:'furniture',confidence:1,position:{x:1,y:0,z:0},size:{x:2,y:1.4,z:1},rotationY:0,sourceAssetIds:['manual']}
    ]
    function App(){
      const [state,setState]=useState(initial),[time,setTime]=useState(0),[canvas,setCanvas]=useState(null),[busy,setBusy]=useState(false)
      window.__studioState=()=>state
      window.__studioTime=()=>time
      window.__studioPixel=()=>{
        const el=document.querySelector('[data-spatial-camera-preview] canvas')
        const store=_roots.get(el)?.store.getState()
        if(!store)return null
        store.gl.render(store.scene,store.camera)
        const gl=store.gl.getContext(), pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4)
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels)
        let total=0;for(let i=0;i<pixels.length;i+=4)total+=pixels[i]+pixels[i+1]+pixels[i+2]
        return total
      }
      window.__studioSnapshot=()=>JSON.stringify(buildPrevisDeliveryPackage(state))
      window.__studioAnchor=()=>{
        const canvas=document.querySelector('[data-spatial-previs-viewport] canvas'), store=_roots.get(canvas)?.store.getState()
        const anchor=store?.scene.getObjectByName('studio-transform-anchor');if(!anchor)return null
        const p=anchor.getWorldPosition(new Vector3()).project(store.camera),r=canvas.getBoundingClientRect()
        return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2}
      }
      return <main><div className="flex gap-3 p-2 text-white">
        <label>验收时间<input aria-label="验收时间" type="number" value={time} onChange={e=>setTime(Number(e.target.value))}/></label>
        <button onClick={()=>localStorage.setItem('studio',JSON.stringify({spatialPrevis:state}))}>验收保存</button>
        <button onClick={()=>setState(parseSpatialPrevisMetadata(JSON.parse(localStorage.getItem('studio'))))}>验收重载</button>
        <button disabled={busy} onClick={async()=>{setBusy(true);try{const blob=await exportPrevisWebM({canvas,durationSec:5,fps:15,onTime:setTime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='studio-test.webm';a.click()}finally{setBusy(false)}}}>验收导出</button>
      </div><SpatialPrevisViewport state={state} currentTimeSec={time} onChange={setState} onCurrentTimeChange={setTime} onLiveCanvas={setCanvas} disabled={busy} isExportingVideo={busy}/></main>
    }
    createRoot(document.getElementById('root')).render(<App/>)
  `
  const entryPath = path.join(directory, 'entry.tsx')
  await writeFile(entryPath, entry)
  const entries = await readdir(path.resolve('../..', 'node_modules/.pnpm'))
  const tsx = entries.find(e => e.startsWith('tsx@'))!
  const esbuild = path.resolve('../..', 'node_modules/.pnpm', tsx, 'node_modules/esbuild/bin/esbuild')
  const bundle = spawnSync(esbuild, [entryPath, '--bundle', '--platform=browser', '--format=iife', '--jsx=automatic', `--outfile=${directory}/bundle.js`, `--tsconfig=${cwd}/tsconfig.json`, '--define:process.env.NODE_ENV="test"'], { encoding: 'utf8' })
  assert.equal(bundle.status, 0, bundle.stderr)
  const css = spawnSync(path.resolve('node_modules/.bin/tailwindcss'), ['-i', 'src/app/globals.css', '-o', `${directory}/style.css`, '-c', 'tailwind.config.ts', '--minify'], { encoding: 'utf8' })
  assert.equal(css.status, 0, css.stderr)
  server = createServer(async (req, res) => {
    if (req.url === '/bundle.js' || req.url === '/style.css') {
      res.setHeader('content-type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(await readFile(path.join(directory, req.url))); return
    }
    if (req.url === '/reference.jpg') { res.setHeader('content-type', 'image/jpeg'); res.end(await readFile(path.resolve('public/brand/home-cinema-portal-bg.jpg'))); return }
    res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body style="margin:0;padding:12px;background:#101316"><div id="root"></div><script src="/bundle.js"></script></body></html>')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }; url = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); await new Promise<void>(resolve => server?.close(() => resolve())); if (directory) await rm(directory, { recursive: true, force: true }) })

async function state(page: Page) { return page.evaluate(() => (window as any).__studioState()) }
async function pixel(page: Page) { return page.evaluate(() => (window as any).__studioPixel() as number) }
async function open(page: Page, name: string) { await page.getByRole('button', { name, exact: true }).click() }
async function dragStudioAxis(page: Page, axis: 'X' | 'Y') {
  const canvas = page.locator('[data-spatial-previs-viewport] canvas').first()
  const anchor = await page.evaluate(() => (window as any).__studioAnchor() as { x: number; y: number })
  assert.ok(anchor)
  let hit: { x: number; y: number } | null = null
  for (let r = 16; r <= 80 && !hit; r += 8) {
    for (const [dx, dy] of axis === 'Y' ? [[0, -r], [-3, -r], [3, -r]] : [[r, 0], [r, r * 0.25], [r, -r * 0.25], [-r, 0]]) {
      await page.mouse.move(anchor.x + dx!, anchor.y + dy!)
      if (await canvas.getAttribute('data-studio-transform-axis') === axis) { hit = { x: anchor.x + dx!, y: anchor.y + dy! }; break }
    }
  }
  assert.ok(hit, `visible ${axis} transform handle`)
  await page.mouse.down()
  await page.mouse.move(hit.x + (axis === 'X' ? 32 : 0), hit.y - (axis === 'Y' ? 32 : 0), { steps: 8 })
  await page.mouse.up()
}

test('all five studio tools edit real geometry, preserve metadata, and export playable video', { timeout: 180_000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true })
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  try {
    await page.goto(url)
    await page.locator('[data-spatial-camera-preview] canvas').waitFor()
    await page.waitForFunction(() => (window as any).__studioPixel() > 100000)
    await open(page, '场景校准')
    await page.getByLabel('校准参考图').selectOption('ref-1')
    await page.getByAltText('校准叠图').waitFor()
    await page.getByLabel('校准实体', { exact: true }).selectOption('wall')
    await page.getByLabel('实体尺寸 X', { exact: true }).fill('7')
    await open(page, '确认此实体对齐')
    assert.equal((await state(page)).scene.whitebox.entities.find((e: any) => e.id === 'wall').size.x, 7)
    assert.deepEqual((await state(page)).studio.calibration.verifiedEntityIds, ['wall'])
    await page.screenshot({ path: path.join(evidence, '01-calibration.png'), fullPage: true })
    await open(page, '场景校准')
    assert.equal(await page.getByLabel('校准参考图').count(), 0)

    const originalPixels = await pixel(page)
    await open(page, '三维布光')
    await open(page, '聚光灯')
    await page.getByLabel('光强', { exact: true }).fill('220')
    await page.getByLabel('灯具位置 X', { exact: true }).fill('-3')
    await page.getByLabel('灯具位置 X', { exact: true }).fill('')
    await page.getByLabel('灯具位置 X', { exact: true }).pressSequentially('-3.5')
    await page.getByLabel('灯具位置 X', { exact: true }).blur()
    assert.equal((await state(page)).studio.lighting.lights[0].position.x, -3.5)
    await page.getByLabel('色温 K', { exact: true }).fill('3000')
    await page.waitForFunction(() => (window as any).__studioState().studio.lighting.lights[0].temperature === 3000)
    const litPixels = await pixel(page)
    assert.ok(Math.abs(litPixels - originalPixels) > 10000, 'lighting must change actual LIVE pixels')
    const lightY = (await state(page)).studio.lighting.lights[0].position.y
    await dragStudioAxis(page, 'Y')
    assert.notEqual((await state(page)).studio.lighting.lights[0].position.y, lightY)
    await page.screenshot({ path: path.join(evidence, '02-lighting.png'), fullPage: true })

    await open(page, '人物动作')
    await page.getByLabel('动作演员').selectOption('actor-track-1')
    await open(page, '站立')
    await page.getByLabel('验收时间').fill('5')
    await open(page, '伸手')
    await page.getByLabel('关节位置 Z', { exact: true }).fill('0.7')
    assert.equal((await state(page)).studio.performances[0].keys.length, 2)
    await page.getByLabel('验收时间').fill('2.5')
    const handX = (await state(page)).studio.performances[0].keys.at(-1).pose.rightHand.x
    await dragStudioAxis(page, 'X')
    const middlePose = (await state(page)).studio.performances[0].keys.find((k: any) => k.timeSec === 2.5)
    assert.ok(middlePose)
    assert.notEqual(middlePose.pose.rightHand.x, handX)
    await page.screenshot({ path: path.join(evidence, '03-performance.png'), fullPage: true })

    await open(page, '多机位剪辑')
    await open(page, '从当前机位添加')
    await page.getByLabel('验收时间').fill('0')
    await open(page, '切入 机位 1')
    await open(page, '从当前机位添加')
    await page.getByLabel('验收时间').fill('2.5')
    const originalTrack = (await state(page)).masterTake.cameraTrack
    await open(page, '镜头参数')
    await open(page, '选择 50 mm')
    assert.equal((await state(page)).studio.cameras[1].track.keyframes.find((k: any) => k.timeSec === 2.5).focalLengthMm, 50)
    assert.deepEqual((await state(page)).masterTake.cameraTrack, originalTrack)
    await page.keyboard.press('Escape')
    await open(page, '多机位剪辑')
    await open(page, '切入 机位 2')
    assert.equal((await state(page)).studio.cuts.length, 2)
    assert.equal((await state(page)).studio.programEnabled, true)
    await page.getByLabel('机位 2 切入秒').fill('3')
    assert.equal(await page.locator('[aria-label="多机位监看"] canvas').count(), 2)
    await page.screenshot({ path: path.join(evidence, '04-multicamera.png'), fullPage: true })
    await open(page, '验收保存')
    const saved = await state(page)
    await open(page, '验收重载')
    assert.deepEqual(await state(page), JSON.parse(JSON.stringify(saved)))
    const downloadPromise = page.waitForEvent('download')
    await open(page, '验收导出')
    const download = await downloadPromise
    const videoPath = path.join(evidence, 'studio-test.webm')
    await download.saveAs(videoPath)
    assert.ok((await readFile(videoPath)).byteLength > 1000)
    await page.getByRole('button', { name: '验收导出' }).waitFor({ state: 'visible' })

    await open(page, '结果对照')
    await page.locator('input[type=file]').setInputFiles(videoPath)
    await page.waitForFunction(() => { const v = document.querySelector('video'); return v && v.readyState >= 2 && v.duration > 0 })
    const aspect = await page.locator('video').evaluate((v: HTMLVideoElement) => {
      const frame = v.parentElement!.getBoundingClientRect()
      return { actual: frame.width / frame.height, expected: v.videoWidth / v.videoHeight }
    })
    assert.ok(Math.abs(aspect.actual - aspect.expected) < 0.01, 'comparison must preserve the source video aspect ratio')
    await page.getByLabel('验收时间').fill('1')
    await page.getByLabel('偏差描述').fill('人物伸手应晚半秒')
    await page.getByLabel('偏差结束秒').fill('2')
    await open(page, '记录偏差')
    assert.equal((await state(page)).studio.review.notes.length, 1)
    await open(page, '播放对照')
    await page.waitForFunction(() => (window as any).__studioTime() > 1.5)
    await open(page, '暂停对照')
    assert.ok(Math.abs(await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime) - await page.evaluate(() => (window as any).__studioTime())) < 0.3)
    await page.screenshot({ path: path.join(evidence, '05-comparison.png'), fullPage: true })
    const reportPromise = page.waitForEvent('download'); await open(page, '导出偏差清单'); const report = await reportPromise
    const reportPath = path.join(evidence, 'comparison.json'); await report.saveAs(reportPath)
    assert.equal(JSON.parse(await readFile(reportPath, 'utf8')).notes[0].text, '人物伸手应晚半秒')
    await open(page, '验收保存'); await open(page, '验收重载')
    assert.equal((await state(page)).studio.review.notes.length, 1)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('mobile tools fit the viewport and toggle or Escape close', { timeout: 60_000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  try {
    await page.goto(url)
    await page.locator('[data-spatial-camera-preview] canvas').waitFor()
    for (const name of ['场景校准', '三维布光', '人物动作', '多机位剪辑', '结果对照']) {
      await open(page, name)
      assert.equal(await page.getByRole('button', { name, exact: true }).getAttribute('aria-expanded'), 'true')
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('button', { name, exact: true }).getAttribute('aria-expanded'), 'false')
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const modeTextHeight = await page.getByRole('button', { name: '航拍', exact: true }).evaluate(button => {
      const range = document.createRange(); range.selectNodeContents(button)
      return range.getBoundingClientRect().height
    })
    assert.ok(modeTextHeight < 20, 'the aerial mode label must stay on one line after adding actor controls')
    await page.screenshot({ path: path.join(evidence, '06-mobile.png'), fullPage: true })
  } finally { await page.close() }
})
