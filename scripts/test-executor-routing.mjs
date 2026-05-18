/**
 * Executor routing unit tests — no test framework required.
 * Run: node scripts/test-executor-routing.mjs
 *
 * Verifies that every CN provider maps to { providerRegion: 'cn', executorKind: 'aliyun_fc' }
 * and every global provider maps to { providerRegion: 'global', executorKind: 'vercel' }.
 */

import assert from 'node:assert/strict'

// --- Registry (mirrors apps/web/src/lib/regions/registry.ts) ---

const PROVIDER_REGION_REGISTRY = {
  volcengine_seedream: {
    id: 'volcengine_seedream', region: 'cn',
    runtimeProviderIds: ['volcengine-seedream-image'],
  },
  volcengine_seedance: {
    id: 'volcengine_seedance', region: 'cn',
    runtimeProviderIds: ['volcengine-seedance-video'],
  },
  jimeng: {
    id: 'jimeng', region: 'cn',
    runtimeProviderIds: ['jimeng-image', 'jimeng-video', 'jimeng'],
  },
  deepseek: {
    id: 'deepseek', region: 'cn',
    runtimeProviderIds: ['deepseek', 'deepseek-chat', 'deepseek-v3', 'deepseek-r1', 'deepseek-text'],
  },
  openai: {
    id: 'openai', region: 'global',
    runtimeProviderIds: ['openai', 'openai-image', 'openai-video'],
  },
  runway: {
    id: 'runway', region: 'global',
    runtimeProviderIds: ['runway', 'runway-video'],
  },
  replicate: {
    id: 'replicate', region: 'global',
    runtimeProviderIds: ['replicate', 'replicate-image', 'replicate-video'],
  },
  fal: {
    id: 'fal', region: 'global',
    runtimeProviderIds: ['fal', 'fal-ai', 'fal-image', 'fal-video'],
  },
  stability: {
    id: 'stability', region: 'global',
    runtimeProviderIds: ['stability', 'stability-ai', 'stable-diffusion', 'sdxl', 'stability-image'],
  },
  google: {
    id: 'google', region: 'global',
    runtimeProviderIds: ['google', 'google-imagen', 'google-veo', 'google-video', 'google-image'],
  },
  midjourney: {
    id: 'midjourney', region: 'global',
    runtimeProviderIds: ['midjourney', 'midjourney-image', 'midjourney-video'],
  },
  kling_global: {
    id: 'kling_global', region: 'global',
    runtimeProviderIds: [
      'kling', 'kling-video', 'kling-image', 'kling-image-to-video',
      'kling-3-0-omni', 'kling-edit', 'kling-motion-transfer',
      'kling-2-6', 'kling-2-1', 'kling-2-5', 'kling-o1',
    ],
  },
}

// Build reverse map: runtimeProviderId → { adapterId, region }
const RUNTIME_TO_ADAPTER = new Map()
for (const [adapterId, config] of Object.entries(PROVIDER_REGION_REGISTRY)) {
  for (const runtimeId of config.runtimeProviderIds) {
    RUNTIME_TO_ADAPTER.set(runtimeId, { adapterId, region: config.region })
  }
  // Also index by adapterId itself
  RUNTIME_TO_ADAPTER.set(adapterId, { adapterId, region: config.region })
}

function getProviderRegion(providerId) {
  const entry = RUNTIME_TO_ADAPTER.get(providerId)
  return entry ? entry.region : 'global' // unknown → global (with unknownProvider=true)
}

function getExecutorForProvider(providerId, { cnConfigured = true } = {}) {
  const region = getProviderRegion(providerId)
  const knownProvider = RUNTIME_TO_ADAPTER.has(providerId)
  if (region === 'cn') {
    return {
      providerRegion: 'cn',
      executionRegion: 'cn',
      storageRegion: 'cn',
      executorKind: cnConfigured ? 'aliyun_fc' : 'none',
      executor: cnConfigured ? 'cn' : 'none',
      unknownProvider: !knownProvider,
      errorCode: cnConfigured ? undefined : 'executor_region_missing',
    }
  }
  return {
    providerRegion: 'global',
    executionRegion: 'global',
    storageRegion: 'global',
    executorKind: 'vercel',
    executor: 'global',
    unknownProvider: !knownProvider,
  }
}

// --- Tests ---

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

console.log('\n=== executor routing tests ===\n')

// Required by task: cn providers
test('volcengine-seedream-image → cn / aliyun_fc', () => {
  const r = getExecutorForProvider('volcengine-seedream-image')
  assert.equal(r.providerRegion, 'cn')
  assert.equal(r.executorKind, 'aliyun_fc')
  assert.equal(r.unknownProvider, false)
})

test('volcengine-seedance-video → cn / aliyun_fc', () => {
  const r = getExecutorForProvider('volcengine-seedance-video')
  assert.equal(r.providerRegion, 'cn')
  assert.equal(r.executorKind, 'aliyun_fc')
  assert.equal(r.unknownProvider, false)
})

test('jimeng-image → cn / aliyun_fc', () => {
  const r = getExecutorForProvider('jimeng-image')
  assert.equal(r.providerRegion, 'cn')
  assert.equal(r.executorKind, 'aliyun_fc')
  assert.equal(r.unknownProvider, false)
})

test('jimeng-video → cn / aliyun_fc', () => {
  const r = getExecutorForProvider('jimeng-video')
  assert.equal(r.providerRegion, 'cn')
  assert.equal(r.executorKind, 'aliyun_fc')
  assert.equal(r.unknownProvider, false)
})

test('deepseek → cn / aliyun_fc', () => {
  const r = getExecutorForProvider('deepseek')
  assert.equal(r.providerRegion, 'cn')
  assert.equal(r.executorKind, 'aliyun_fc')
  assert.equal(r.unknownProvider, false)
})

test('deepseek-chat → cn / aliyun_fc', () => {
  const r = getExecutorForProvider('deepseek-chat')
  assert.equal(r.providerRegion, 'cn')
  assert.equal(r.executorKind, 'aliyun_fc')
})

test('deepseek-v3 → cn / aliyun_fc', () => {
  const r = getExecutorForProvider('deepseek-v3')
  assert.equal(r.providerRegion, 'cn')
  assert.equal(r.executorKind, 'aliyun_fc')
})

test('deepseek-r1 → cn / aliyun_fc', () => {
  const r = getExecutorForProvider('deepseek-r1')
  assert.equal(r.providerRegion, 'cn')
  assert.equal(r.executorKind, 'aliyun_fc')
})

// Required by task: global providers
test('openai → global / vercel', () => {
  const r = getExecutorForProvider('openai')
  assert.equal(r.providerRegion, 'global')
  assert.equal(r.executorKind, 'vercel')
  assert.equal(r.unknownProvider, false)
})

test('runway → global / vercel', () => {
  const r = getExecutorForProvider('runway')
  assert.equal(r.providerRegion, 'global')
  assert.equal(r.executorKind, 'vercel')
  assert.equal(r.unknownProvider, false)
})

test('replicate → global / vercel', () => {
  const r = getExecutorForProvider('replicate')
  assert.equal(r.providerRegion, 'global')
  assert.equal(r.executorKind, 'vercel')
  assert.equal(r.unknownProvider, false)
})

test('fal → global / vercel', () => {
  const r = getExecutorForProvider('fal')
  assert.equal(r.providerRegion, 'global')
  assert.equal(r.executorKind, 'vercel')
  assert.equal(r.unknownProvider, false)
})

// Required by task: unknown provider → global / vercel + unknownProvider=true
test('unknown-provider → global / vercel + unknownProvider=true', () => {
  const r = getExecutorForProvider('some-unknown-provider-xyz')
  assert.equal(r.providerRegion, 'global')
  assert.equal(r.executorKind, 'vercel')
  assert.equal(r.unknownProvider, true)
})

// Error code tests
test('cn provider without cn executor → executor_region_missing', () => {
  const r = getExecutorForProvider('volcengine-seedream-image', { cnConfigured: false })
  assert.equal(r.providerRegion, 'cn')
  assert.equal(r.executorKind, 'none')
  assert.equal(r.errorCode, 'executor_region_missing')
})

// Exhaustive: all cn providers in registry must resolve to cn
test('all registry cn providers resolve to cn/aliyun_fc', () => {
  const cnAdapters = Object.values(PROVIDER_REGION_REGISTRY).filter(p => p.region === 'cn')
  for (const adapter of cnAdapters) {
    for (const runtimeId of adapter.runtimeProviderIds) {
      const r = getExecutorForProvider(runtimeId)
      assert.equal(r.providerRegion, 'cn', `${runtimeId} should be cn`)
      assert.equal(r.executorKind, 'aliyun_fc', `${runtimeId} should use aliyun_fc`)
    }
  }
})

// Exhaustive: all global providers in registry must resolve to global
test('all registry global providers resolve to global/vercel', () => {
  const globalAdapters = Object.values(PROVIDER_REGION_REGISTRY).filter(p => p.region === 'global')
  for (const adapter of globalAdapters) {
    for (const runtimeId of adapter.runtimeProviderIds) {
      const r = getExecutorForProvider(runtimeId)
      assert.equal(r.providerRegion, 'global', `${runtimeId} should be global`)
      assert.equal(r.executorKind, 'vercel', `${runtimeId} should use vercel`)
    }
  }
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
