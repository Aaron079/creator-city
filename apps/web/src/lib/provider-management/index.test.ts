import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import Module, { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const originalLoad = loader._load
let accounts: Array<{ providerId: string; isActive: boolean; lastCheckedAt: Date | null }> = []
let writes: Array<{ where: { providerId: string }; create: { isActive: boolean }; update: { isActive: boolean } }> = []
loader._load = function (id, ...args) {
  if (id === '@/lib/db') return { db: { providerAccount: {
    findMany: async () => accounts,
    upsert: async (query: typeof writes[number]) => {
      writes.push(query)
      const existing = accounts.find((account) => account.providerId === query.where.providerId)
      if (existing) existing.isActive = query.update.isActive
      else accounts.push({ providerId: query.where.providerId, isActive: query.create.isActive, lastCheckedAt: null })
      return accounts.find((account) => account.providerId === query.where.providerId)
    },
  } } }
  if (id === '@/lib/gateway/pricing') return { getGatewayPricing: () => ({ estimatedCostUsd: 0, creditsPerCall: 0 }) }
  return originalLoad.call(this, id, ...args)
}
const { buildProviderManagementStatus, testProviderConnection, setProviderEnabled } = require('./index') as typeof import('./index')
loader._load = originalLoad

const originalEnv = process.env
const originalFetch = globalThis.fetch
beforeEach(() => {
  accounts = []
  writes = []
  process.env = { NODE_ENV: 'test' }
  globalThis.fetch = async () => { throw new Error('Unexpected network call') }
})
afterEach(() => { process.env = originalEnv; globalThis.fetch = originalFetch })

for (const [providerId, key, defaultModel] of [
  ['openai-text', 'OPENAI_TEXT_MODEL', 'gpt-4.1-mini'],
  ['openai-image', 'OPENAI_IMAGE_MODEL', 'gpt-image-1'],
] as const) {
  test(`${providerId} reports adapter defaults and configured model overrides`, async () => {
    process.env.OPENAI_API_KEY = 'test-only'
    for (const model of [undefined, 'configured-model']) {
      if (model) process.env[key] = model
      const row = (await buildProviderManagementStatus()).providers.find((row) => row.providerId === providerId)!
      assert.equal(row.model, model || defaultModel)
      assert.equal(row.baseUrl, 'https://api.openai.com/v1')
      assert.equal(row.available, true)
      const probe = await testProviderConnection(providerId)
      assert.equal(probe.model, row.model)
      assert.equal(probe.baseUrl, row.baseUrl)
    }
  })
}

test('Kimi multimodal metadata and env-only probes match text-model fallback and normalized endpoint', async () => {
  process.env.MOONSHOT_API_KEY = 'test-only'
  process.env.MOONSHOT_BASE_URL = 'https://example.test/v1///'
  process.env.KIMI_MODEL_TEXT = 'configured-text'
  for (const model of [undefined, 'configured-multimodal']) {
    if (model) process.env.KIMI_MODEL_MULTIMODAL = model
    const row = (await buildProviderManagementStatus()).providers.find((row) => row.providerId === 'kimi-multimodal')!
    assert.equal(row.model, model || 'configured-text')
    assert.equal(row.baseUrl, 'https://example.test/v1')
    const probe = await testProviderConnection('kimi-multimodal')
    assert.equal(probe.model, row.model)
    assert.equal(probe.baseUrl, row.baseUrl)
  }
})

test('Seedream requires a nonblank model in status and env-only checks', async () => {
  process.env.VOLCENGINE_ARK_API_KEY = 'test-only'
  for (const model of [undefined, '   ', 'configured-seedream']) {
    if (model) process.env.VOLCENGINE_SEEDREAM_MODEL = model
    const row = (await buildProviderManagementStatus()).providers.find((row) => row.providerId === 'volcengine-seedream-image')!
    const probe = await testProviderConnection('volcengine-seedream-image')
    const configured = model === 'configured-seedream'
    assert.equal(row.available, configured)
    assert.equal(probe.ok, configured)
    assert.deepEqual(row.missingEnv, configured ? [] : ['VOLCENGINE_SEEDREAM_MODEL'])
    assert.deepEqual(probe.missingEnv, row.missingEnv)
  }
})

test('configuration and a check timestamp do not fabricate a passed invocation', async () => {
  process.env.OPENAI_API_KEY = 'test-only'
  accounts = [{ providerId: 'openai-image', isActive: false, lastCheckedAt: new Date('2026-09-14T00:00:00Z') }]
  const row = (await buildProviderManagementStatus()).providers.find((row) => row.providerId === 'openai-image')!
  assert.equal(row.configured, true)
  assert.equal(row.available, false)
  assert.equal(row.lastTestStatus, 'untested')
  assert.equal(row.lastCheckedAt, '2026-09-14T00:00:00.000Z')
})

test('Kimi text-ping returns only sanitized transport cause evidence', async () => {
  process.env.MOONSHOT_API_KEY = 'test-only'
  globalThis.fetch = async () => { throw new TypeError('private-token', { cause: { code: 'ECONNREFUSED' } }) }
  const probe = await testProviderConnection('kimi-multimodal', 'text-ping')
  assert.equal(probe.ok, false)
  assert.equal(probe.rawCode, 'ECONNREFUSED')
  assert.doesNotMatch(JSON.stringify(probe), /private-token/)
})

for (const model of [undefined, '   ']) {
  test(`active Seedream with ${model === undefined ? 'missing' : 'blank'} model can be disabled but not re-enabled`, async () => {
    process.env.VOLCENGINE_ARK_API_KEY = 'test-only'
    if (model !== undefined) process.env.VOLCENGINE_SEEDREAM_MODEL = model
    accounts = [{ providerId: 'volcengine-seedream-image', isActive: true, lastCheckedAt: null }]
    const disabled = await setProviderEnabled('volcengine-seedream-image', false)
    assert.equal(disabled.ok, true)
    assert.equal(accounts[0]?.isActive, false)
    assert.equal(writes.length, 1)
    assert.equal(writes[0]?.update.isActive, false)
    assert.equal((await setProviderEnabled('volcengine-seedream-image', true)).ok, false)
    assert.equal(writes.length, 1)
    process.env.VOLCENGINE_SEEDREAM_MODEL = 'restored-model'
    const row = (await buildProviderManagementStatus()).providers.find((item) => item.providerId === 'volcengine-seedream-image')!
    assert.equal(row.enabled, false)
    assert.equal(row.available, false)
    assert.equal(accounts[0]?.isActive, false)
  })
}

test('missing-key metadata preserves the active switch and only permits disabling', async () => {
  accounts = [{ providerId: 'openai-text', isActive: true, lastCheckedAt: null }]
  let row = (await buildProviderManagementStatus()).providers.find((item) => item.providerId === 'openai-text')!
  assert.equal(row.configured, false)
  assert.equal(row.available, false)
  assert.equal(row.enabled, true)
  assert.equal(row.canToggle, true)
  assert.equal((await setProviderEnabled('openai-text', true)).ok, false)
  assert.equal(writes.length, 0)
  assert.equal((await setProviderEnabled('openai-text', false)).ok, true)
  row = (await buildProviderManagementStatus()).providers.find((item) => item.providerId === 'openai-text')!
  assert.equal(row.enabled, false)
  assert.equal(row.canToggle, false)
  assert.equal((await setProviderEnabled('openai-text', true)).ok, false)
  assert.equal(accounts[0]?.isActive, false)
})
