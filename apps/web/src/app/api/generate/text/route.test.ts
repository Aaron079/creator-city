import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import Module, { createRequire } from 'node:module'
import type { NextRequest } from 'next/server'

const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const originalLoad = loader._load
let user: { id: string; role: string; status: string } | null
let accessStatus: number | null = null
let account: { id: string; providerId: string; status: string; encryptedApiKey: string } | null
let accountWhere: unknown
let billingCalls = 0
let gatewayCalls = 0
let providerCalls = 0
let platformAccounts: Array<{ providerId: string; isActive: boolean }> = []
let platformReadError: Error | null = null
let platformReads = 0
loader._load = function (id, ...args) {
  if (id === '@/lib/generation/access') return { generationAccessResponse: async () => accessStatus ? Response.json({ success: false }, { status: accessStatus }) : null }
  if (id === '@/lib/auth/current-user') return { getCurrentUser: async () => user }
  if (id === '@/lib/db') return { db: {
    userProviderAccount: { findFirst: async (query: { where: unknown }) => { accountWhere = query.where; return account } },
    providerAccount: { findMany: async () => { platformReads++; if (platformReadError) throw platformReadError; return platformAccounts } },
  } }
  if (id === '@/lib/credits/billing-middleware') return {
    setupBilling: async () => { billingCalls++; return { ok: true, ctx: { userId: user!.id, billingJobId: null, estimatedCredits: 0 } } },
    finalizeBilling: async (result: unknown) => result,
  }
  if (id === '@/lib/gateway/generate') return { gatewayGenerate: async () => { gatewayCalls++; return { success: false, errorCode: 'PROVIDER_NOT_FOUND' } } }
  if (id === '@/lib/assets/generated-assets') return { attachGeneratedAsset: async (result: unknown) => result }
  if (id === '@/lib/provider-accounts/crypto') return { decryptProviderApiKey: () => 'test-byok' }
  if (id === '@/lib/usage/usage-log') return { safeRecordUsageLog: async () => {} }
  return originalLoad.call(this, id, ...args)
}
const { POST } = require('./route') as typeof import('./route')
loader._load = originalLoad

const originalEnv = process.env
const originalFetch = globalThis.fetch
beforeEach(() => {
  user = { id: 'admin', role: 'ADMIN', status: 'ACTIVE' }
  accessStatus = null
  account = { id: 'owned-account', providerId: 'kimi-multimodal', status: 'active', encryptedApiKey: 'test-ciphertext' }
  accountWhere = undefined
  billingCalls = gatewayCalls = providerCalls = 0
  platformAccounts = []
  platformReadError = null
  platformReads = 0
  process.env = { NODE_ENV: 'test', MOONSHOT_API_KEY: 'test-platform', KIMI_MODEL_MULTIMODAL: 'configured-multimodal', KIMI_MODEL_TEXT: 'configured-text' }
  globalThis.fetch = async () => { providerCalls++; throw new Error('Unexpected network call') }
})
afterEach(() => { process.env = originalEnv; globalThis.fetch = originalFetch })

function request(body: Record<string, unknown>) {
  return new Request('https://city.test/api/generate/text', { method: 'POST', body: JSON.stringify({ providerId: 'kimi-multimodal', prompt: 'actual prompt', ...body }) }) as NextRequest
}

for (const providerId of ['kimi-text', 'kimi-multimodal']) {
  for (const byok of [false, true]) {
    test(`${providerId} invokes the configured text model in ${byok ? 'BYOK' : 'platform'} mode`, async () => {
      account!.providerId = providerId
      const expectedModel = providerId === 'kimi-text' ? 'configured-text' : 'configured-multimodal'
      globalThis.fetch = async (url, init) => {
        providerCalls++
        assert.equal(url, 'https://api.moonshot.cn/v1/chat/completions')
        assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer test-${byok ? 'byok' : 'platform'}`)
        const body = JSON.parse(String(init?.body))
        assert.equal(body.model, expectedModel)
        assert.equal(body.messages[1].content, 'actual prompt')
        assert.equal(body.max_tokens, 77)
        return Response.json({ choices: [{ message: { content: 'final text' } }] })
      }
      const response = await POST(request({ providerId, maxTokens: 77, ...(byok ? { billingMode: 'user_provider_account', userProviderAccountId: 'owned-account' } : {}) }))
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.success, true)
      assert.equal(body.model, expectedModel)
      assert.equal(body.text, 'final text')
      assert.equal(providerCalls, 1)
      assert.equal(gatewayCalls, 0)
      assert.equal(billingCalls, byok ? 0 : 1)
      if (byok) assert.deepEqual(accountWhere, { id: 'owned-account', userId: 'admin' })
    })
  }
}

test('route honors denied access before billing, account lookup or provider dispatch', async () => {
  for (const status of [401, 403, 503]) {
    accessStatus = status
    for (const billingMode of ['platform_credits', 'user_provider_account']) {
      const response = await POST(request({ billingMode, userProviderAccountId: 'owned-account' }))
      assert.equal(response.status, status)
    }
  }
  assert.equal(providerCalls + billingCalls + gatewayCalls, 0)
  assert.equal(accountWhere, undefined)
  assert.equal(platformReads, 0)
})

test('BYOK ownership, provider match and disabled-account checks remain enforced', async () => {
  for (const candidate of [null, { ...account!, providerId: 'kimi-text' }, { ...account!, status: 'disabled' }]) {
    account = candidate
    const response = await POST(request({ billingMode: 'user_provider_account', userProviderAccountId: 'owned-account' }))
    assert.equal(response.status, candidate ? 400 : 404)
    assert.deepEqual(accountWhere, { id: 'owned-account', userId: 'admin' })
  }
  assert.equal(providerCalls + billingCalls + gatewayCalls, 0)
})

test('platform multimodal failures propagate sanitized Kimi cause codes', async () => {
  globalThis.fetch = async () => { throw new TypeError('private-token', { cause: { code: 'ENOTFOUND', hostname: 'private-host' } }) }
  const body = await (await POST(request({}))).json()
  assert.equal(body.success, false)
  assert.equal(body.rawCode, 'ENOTFOUND')
  assert.doesNotMatch(JSON.stringify(body), /private-/)
})

for (const byok of [false, true]) {
  test(`Kimi ${byok ? 'BYOK' : 'platform'} keeps quota and rate-limit failures distinct`, async () => {
    const messages: string[] = []
    for (const code of ['insufficient_quota', 'rate_limit_exceeded']) {
      globalThis.fetch = async () => Response.json({ error: { code, message: code } }, { status: 429 })
      const body = await (await POST(request(byok ? { billingMode: 'user_provider_account', userProviderAccountId: 'owned-account' } : {}))).json()
      assert.equal(body.success, false)
      assert.equal(body.rawCode, code)
      messages.push(body.message)
    }
    assert.notEqual(messages[0], messages[1])
  })
}

for (const providerId of ['kimi-text', 'kimi-multimodal', 'deepseek-text', 'deepseek-reasoner', 'openai-text']) {
  test(`disabled platform ${providerId} cannot dispatch or reactivate its account`, async () => {
    process.env.DEEPSEEK_API_KEY = 'test-only'
    process.env.OPENAI_API_KEY = 'test-only'
    platformAccounts = [{ providerId, isActive: false }]
    const response = await POST(request({ providerId }))
    assert.equal(response.status, 403)
    assert.equal((await response.json()).errorCode, 'PROVIDER_DISABLED')
    assert.equal(providerCalls + gatewayCalls, 0)
    assert.equal(platformReads, 1)
    assert.equal(platformAccounts[0]?.isActive, false)
  })
}

for (const code of ['P1001', 'P2021']) {
  test(`platform status lookup ${code} fails closed before direct or gateway dispatch`, async () => {
    platformReadError = Object.assign(new Error('private database detail'), { code })
    process.env.OPENAI_API_KEY = 'test-only'
    for (const providerId of ['kimi-multimodal', 'openai-text']) {
      const response = await POST(request({ providerId }))
      assert.equal(response.status, 503)
      const body = await response.json()
      assert.equal(body.errorCode, 'PROVIDER_STATUS_UNAVAILABLE')
      assert.doesNotMatch(JSON.stringify(body), /private database detail/)
    }
    assert.equal(providerCalls + gatewayCalls, 0)
  })
}

test('BYOK does not depend on the platform enabled state, keys or status DB lookup', async () => {
  delete process.env.MOONSHOT_API_KEY
  platformAccounts = [{ providerId: 'kimi-multimodal', isActive: false }]
  platformReadError = new Error('platform lookup must not run')
  globalThis.fetch = async (_url, init) => {
    providerCalls++
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-byok')
    return Response.json({ choices: [{ message: { content: 'BYOK result' } }] })
  }
  const body = await (await POST(request({ billingMode: 'user_provider_account', userProviderAccountId: 'owned-account' }))).json()
  assert.equal(body.success, true)
  assert.equal(body.text, 'BYOK result')
  assert.equal(providerCalls, 1)
  assert.equal(platformReads + billingCalls, 0)
  assert.deepEqual(accountWhere, { id: 'owned-account', userId: 'admin' })
})
