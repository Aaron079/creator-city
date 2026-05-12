#!/usr/bin/env tsx
/**
 * P0 Script: p0-production-smoke.ts
 * Probes a production Vercel deployment to verify the P0 media chain is working.
 *
 * Usage:
 *   pnpm dlx tsx scripts/p0-production-smoke.ts --base-url https://creator-city-vert.vercel.app
 *
 * Does NOT trigger paid generation. Does NOT expose secrets.
 */

const DEFAULT_BASE_URL = 'https://creator-city-vert.vercel.app'

function parseArgs() {
  const args = process.argv.slice(2)
  const idx = args.indexOf('--base-url')
  const baseUrl = idx !== -1 ? args[idx + 1] : DEFAULT_BASE_URL
  return { baseUrl: baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE_URL }
}

async function get(url: string): Promise<{ ok: boolean; status: number; body: string; latencyMs: number; json: unknown }> {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    const body = await res.text()
    let json: unknown = null
    try { json = JSON.parse(body) } catch {}
    return { ok: res.ok, status: res.status, body, latencyMs: Date.now() - start, json }
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e), latencyMs: Date.now() - start, json: null }
  }
}

async function post(url: string, data: unknown): Promise<{ ok: boolean; status: number; body: string; latencyMs: number; json: unknown }> {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15000),
    })
    const body = await res.text()
    let json: unknown = null
    try { json = JSON.parse(body) } catch {}
    return { ok: res.ok, status: res.status, body, latencyMs: Date.now() - start, json }
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e), latencyMs: Date.now() - start, json: null }
  }
}

async function headUrl(url: string): Promise<{ ok: boolean; status: number; contentType: string | null; latencyMs: number }> {
  const start = Date.now()
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
    return { ok: res.ok, status: res.status, contentType: res.headers.get('content-type'), latencyMs: Date.now() - start }
  } catch (e) {
    return { ok: false, status: 0, contentType: null, latencyMs: Date.now() - start }
  }
}

function isJsonResponse(json: unknown): json is Record<string, unknown> {
  return json !== null && typeof json === 'object' && !Array.isArray(json)
}

async function main() {
  const { baseUrl } = parseArgs()
  console.log(`\n=== P0 Production Smoke Test ===`)
  console.log(`Target: ${baseUrl}`)
  console.log(`Time:   ${new Date().toISOString()}\n`)

  let passed = 0
  let failed = 0

  function pass(label: string, detail = '') {
    passed++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  }

  function fail(label: string, detail = '') {
    failed++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }

  // 1. Basic connectivity
  console.log('--- 1. Basic connectivity ---')
  const home = await get(`${baseUrl}/`)
  if (home.status === 200 || home.status === 302 || home.status === 307) {
    pass('Home page reachable', `HTTP ${home.status} in ${home.latencyMs}ms`)
  } else {
    fail('Home page', `HTTP ${home.status}`)
  }

  // 2. resolve-batch API — empty assetIds must be a stable 200 JSON response.
  console.log('\n--- 2. /api/assets/resolve-batch ---')
  const resolveEmpty = await post(`${baseUrl}/api/assets/resolve-batch`, { assetIds: [] })
  if (resolveEmpty.ok && isJsonResponse(resolveEmpty.json)) {
    pass('resolve-batch responds with 200', `latency ${resolveEmpty.latencyMs}ms`)
    const json = resolveEmpty.json as Record<string, unknown>
    if (Array.isArray(json.assets) && json.assets.length === 0) {
      pass('resolve-batch empty request returns assets=[]')
    } else {
      fail('resolve-batch missing assets field', JSON.stringify(resolveEmpty.json).slice(0, 200))
    }
  } else {
    fail(`resolve-batch returned HTTP ${resolveEmpty.status}`, resolveEmpty.body.slice(0, 300))
    if (resolveEmpty.body.includes('Cannot find module')) {
      fail('CRITICAL: Next.js serverless runtime module not found — Lambda is broken')
    }
  }

  // 2b. media proxy diagnostics — errors must be JSON and specific.
  console.log('\n--- 2b. /api/media/proxy diagnostics ---')
  const proxyMissingUrl = await get(`${baseUrl}/api/media/proxy`)
  if (proxyMissingUrl.status === 400 && isJsonResponse(proxyMissingUrl.json) && (proxyMissingUrl.json as Record<string, unknown>).errorCode === 'proxy_url_missing') {
    pass('media/proxy without url returns JSON proxy_url_missing', `latency ${proxyMissingUrl.latencyMs}ms`)
  } else {
    fail(`media/proxy without url HTTP ${proxyMissingUrl.status}`, proxyMissingUrl.body.slice(0, 300))
  }

  const proxyExample = await get(`${baseUrl}/api/media/proxy?url=${encodeURIComponent('https://example.com')}`)
  if (proxyExample.status !== 500 && isJsonResponse(proxyExample.json)) {
    const json = proxyExample.json as Record<string, unknown>
    if (typeof json.errorCode === 'string') {
      pass('media/proxy disallowed URL returns JSON errorCode', `${json.errorCode}`)
    } else {
      fail('media/proxy disallowed URL JSON missing errorCode', proxyExample.body.slice(0, 300))
    }
  } else {
    fail(`media/proxy disallowed URL HTTP ${proxyExample.status}`, proxyExample.body.slice(0, 300))
  }

  // 3. generate/image API — GET is a provider health check and does not spend credits.
  console.log('\n--- 3. /api/generate/image (health check, no paid generation) ---')
  const imageStatus = await get(`${baseUrl}/api/generate/image`)
  if (imageStatus.ok && isJsonResponse(imageStatus.json)) {
    pass('generate/image GET OK', `latency ${imageStatus.latencyMs}ms`)
    const json = imageStatus.json as Record<string, unknown>
    const providers = Array.isArray(json.providers) ? json.providers as Array<Record<string, unknown>> : []
    const missing = providers.flatMap((provider) => Array.isArray(provider.missingEnvKeys) ? provider.missingEnvKeys as string[] : [])
    console.log(`    defaultProviderId: ${json.defaultProviderId ?? '(none)'}`)
    console.log(`    configured providers: ${providers.filter((provider) => provider.available === true).length}/${providers.length}`)
    if (missing.length) console.log(`    missing env keys: ${[...new Set(missing)].join(', ')}`)
  } else if (imageStatus.status === 401 || imageStatus.status === 405 || imageStatus.status === 404) {
    // Route exists and Lambda responds — just needs auth or POST method
    pass(`generate/image Lambda alive (HTTP ${imageStatus.status} expected for unauthenticated GET)`, `latency ${imageStatus.latencyMs}ms`)
  } else if (imageStatus.status === 0) {
    // Network-level failure — check if it's a timeout or ECONNREFUSED
    fail(`generate/image fetch failed (network error)`, imageStatus.body.slice(0, 200))
    if (imageStatus.body.includes('Cannot find module')) {
      fail('CRITICAL: Lambda runtime broken for generate/image')
    }
  } else {
    fail(`generate/image HTTP ${imageStatus.status}`, imageStatus.body.slice(0, 200))
  }

  // 4. generate/video API — GET is a provider health check and does not spend credits.
  console.log('\n--- 4. /api/generate/video (health check, no paid generation) ---')
  const videoStatus = await get(`${baseUrl}/api/generate/video`)
  if (videoStatus.ok && isJsonResponse(videoStatus.json)) {
    pass('generate/video GET OK', `latency ${videoStatus.latencyMs}ms`)
    const json = videoStatus.json as Record<string, unknown>
    const providers = Array.isArray(json.providers) ? json.providers as Array<Record<string, unknown>> : []
    const missing = providers.flatMap((provider) => Array.isArray(provider.missingEnvKeys) ? provider.missingEnvKeys as string[] : [])
    console.log(`    defaultProviderId: ${json.defaultProviderId ?? '(none)'}`)
    console.log(`    configured providers: ${providers.filter((provider) => provider.available === true).length}/${providers.length}`)
    if (missing.length) console.log(`    missing env keys: ${[...new Set(missing)].join(', ')}`)
  } else if (videoStatus.status === 401 || videoStatus.status === 405 || videoStatus.status === 404) {
    pass(`generate/video Lambda alive (HTTP ${videoStatus.status} expected for unauthenticated GET)`, `latency ${videoStatus.latencyMs}ms`)
  } else if (videoStatus.status === 0) {
    fail(`generate/video fetch failed (network error)`, videoStatus.body.slice(0, 200))
    if (videoStatus.body.includes('Cannot find module')) {
      fail('CRITICAL: Lambda runtime broken for generate/video')
    }
  } else {
    fail(`generate/video HTTP ${videoStatus.status}`, videoStatus.body.slice(0, 200))
  }

  // 5. /create should be reachable and enter the app/auth flow.
  console.log('\n--- 5. /create login/app flow ---')
  const createPage = await get(`${baseUrl}/create`)
  if (createPage.status === 200 || createPage.status === 302 || createPage.status === 307) {
    pass('/create reachable', `HTTP ${createPage.status} in ${createPage.latencyMs}ms`)
    if (/auth\/login|登录|Sign in|Create|canvas|__NEXT_DATA__/i.test(createPage.body)) {
      pass('/create returns login protection or app shell')
    } else {
      fail('/create body did not look like login/app flow', createPage.body.slice(0, 200))
    }
  } else {
    fail(`/create HTTP ${createPage.status}`, createPage.body.slice(0, 200))
  }

  // 6. P0 admin debug must be protected without a token.
  console.log('\n--- 6. /api/admin/p0-media-debug protection ---')
  const debug = await get(`${baseUrl}/api/admin/p0-media-debug`)
  if (debug.status === 401 || debug.status === 403 || debug.status === 404) {
    pass('p0-media-debug protected without token', `HTTP ${debug.status}`)
  } else {
    fail(`p0-media-debug should be protected, got HTTP ${debug.status}`, debug.body.slice(0, 200))
  }

  // 7. skills API (was 500 before fix)
  console.log('\n--- 7. /api/skills ---')
  const skills = await get(`${baseUrl}/api/skills`)
  if (skills.ok && isJsonResponse(skills.json)) {
    pass('skills API OK', `latency ${skills.latencyMs}ms`)
  } else {
    fail(`skills API HTTP ${skills.status}`)
  }

  // 8. resolve known assetIds (if any provided via env)
  const testAssetId = process.env.SMOKE_TEST_ASSET_ID
  if (testAssetId) {
    console.log(`\n--- 8. Resolve test asset ${testAssetId} ---`)
    const resolve = await post(`${baseUrl}/api/assets/resolve-batch`, { assetIds: [testAssetId] })
    if (resolve.ok && isJsonResponse(resolve.json)) {
      const assets = Array.isArray((resolve.json as Record<string, unknown>).assets)
        ? (resolve.json as Record<string, unknown>).assets as unknown[]
        : []
      if (assets.length > 0 && isJsonResponse(assets[0])) {
        const asset = assets[0] as Record<string, unknown>
        console.log(`    status: ${asset.status}`)
        console.log(`    resolvedUrl: ${asset.resolvedUrl ?? '(none)'}`)
        if (asset.status === 'ready' && asset.resolvedUrl) {
          pass('Asset resolved to ready', String(asset.resolvedUrl).slice(0, 80))
          const head = await headUrl(String(asset.resolvedUrl))
          if (head.ok) {
            pass(`resolvedUrl is accessible`, `HTTP ${head.status} content-type=${head.contentType}`)
          } else {
            fail(`resolvedUrl HEAD failed`, `HTTP ${head.status}`)
          }
        } else {
          fail(`Asset not ready`, `status=${asset.status} reason=${asset.error ?? asset.recoveryStatus}`)
        }
      } else {
        fail('resolve-batch returned empty assets')
      }
    } else {
      fail(`resolve-batch HTTP ${resolve.status}`)
    }
  } else {
    console.log('\n--- 8. Resolve test asset [SKIP] ---')
    console.log('    Set SMOKE_TEST_ASSET_ID=<id> env var to test specific asset resolution.')
  }

  console.log('\n--- P0 page-level verification note ---')
  console.log('    Authenticated users can open /create → P0 媒体自检 to diagnose current real canvas nodes without P0_DEBUG_TOKEN.')

  // Summary
  console.log(`\n${'='.repeat(50)}`)
  console.log(`RESULT: ${passed} passed, ${failed} failed`)
  if (failed === 0) {
    console.log('✓ P0 smoke test PASSED')
  } else {
    console.log('✗ P0 smoke test FAILED')
  }
  console.log()

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('[ERROR]', e instanceof Error ? e.message : e)
  process.exit(1)
})
