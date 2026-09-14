import assert from 'node:assert/strict'
import { afterEach, beforeEach, mock, test } from 'node:test'
import Module, { createRequire } from 'node:module'

type Write = { where?: { id: string }; data: Record<string, unknown> }

function initialState() {
  return {
    events: [] as string[],
    creates: [] as Write[],
    updates: [] as Write[],
    usage: [] as Record<string, unknown>[],
    persists: [] as Record<string, unknown>[],
    gatewayRequests: [] as Record<string, unknown>[],
    triggers: [] as Record<string, unknown>[],
    finalizations: [] as unknown[],
    createErrors: [] as Error[],
    queueError: false,
    terminalError: false,
    gatewayError: null as Error | null,
    accessStatus: 0,
    billingError: null as { code: string; status: number } | null,
    billingJobId: null as string | null,
    cn: false,
    executor: 'vercel',
    providerResult: {
      success: true, status: 'succeeded', providerId: 'openai-image', mode: 'real',
      message: 'Generated', jobId: 'provider-job', model: 'image-model',
      result: { imageUrl: 'https://provider.test/image.png', metadata: { keep: 'metadata' } },
    } as Record<string, unknown>,
    persistence: { ok: true, stableUrl: 'https://assets.test/image.png', assetId: 'asset-1' } as Record<string, unknown>,
    persistenceError: false,
  }
}

let state = initialState()
const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const originalLoad = loader._load
loader._load = function (id, ...args) {
  const stubs: Record<string, unknown> = {
    '@/lib/generation/access': { generationAccessResponse: async () => state.accessStatus
      ? Response.json({ success: false, errorCode: 'GENERATION_ADMIN_REQUIRED' }, { status: state.accessStatus }) : null },
    '@/lib/auth/current-user': { getCurrentUser: async () => ({ id: 'admin' }) },
    '@/lib/credits/billing-middleware': {
      setupBilling: async () => state.billingError
        ? { ok: false, status: state.billingError.status, errorResponse: {
          success: false, errorCode: state.billingError.code, message: 'City authorization or billing service unavailable',
        } }
        : { ok: true, ctx: { userId: 'admin', billingJobId: state.billingJobId, estimatedCredits: 0 } },
      finalizeBilling: async (result: unknown, id: unknown) => { state.finalizations.push(id); return result },
    },
    '@/lib/provider-management': { buildProviderManagementStatus: async () => ({ providers: [
      { providerId: 'openai-image', available: true, model: 'image-model' },
      { providerId: 'volcengine-seedream-image', available: true, model: 'seedream-model' },
    ] }) },
    '@/lib/generation/generation-context': {
      stringInput: (value: unknown) => typeof value === 'string' ? value.trim() : '',
      missingGenerationInput: () => [],
      prepareGenerationContext: async () => ({ ok: true, projectId: 'project-owned', workflowId: 'workflow-owned', nodeId: 'node-owned' }),
    },
    '@/lib/executors/executor-gateway': { getExecutorForProvider: () => ({
      providerRegion: state.cn ? 'cn' : 'global', executionRegion: state.cn ? 'cn' : 'global',
      storageRegion: 'cn', executor: state.executor, executorKind: state.cn ? 'aliyun_fc' : 'vercel',
    }) },
    '@/lib/provider-accounts/service': { getProviderAccountForByok: async () => ({ ok: true, apiKey: 'test-only-key', endpointId: 'test-endpoint' }) },
    '@/lib/db': { db: { generationJob: {
      create: async (write: Write) => {
        state.events.push('create')
        state.creates.push(write)
        const error = state.createErrors.shift()
        if (error) throw error
        return { id: 'image-job' }
      },
      update: async (write: Write) => {
        state.events.push(`update:${write.data.status}`)
        state.updates.push(write)
        if ((state.queueError && write.data.status === 'QUEUED') || state.terminalError) throw new Error('database write unavailable')
        return { id: write.where?.id }
      },
    } } },
    '@/lib/gateway/generate': { gatewayGenerate: async (request: Record<string, unknown>) => {
      state.events.push('gateway')
      state.gatewayRequests.push(request)
      if (state.gatewayError) throw state.gatewayError
      return state.providerResult
    } },
    '@/lib/assets/persist-generated-media': { persistGeneratedMedia: async (input: Record<string, unknown>) => {
      state.events.push('persist')
      state.persists.push(input)
      if (state.persistenceError) throw new Error('storage unavailable')
      return state.persistence
    } },
    '@/lib/asset-intelligence': { analyzeAssetIntelligence: () => ({ category: 'test' }) },
    '@/lib/usage/usage-log': { safeRecordUsageLog: async (input: Record<string, unknown>) => { state.usage.push(input) } },
  }
  if (id in stubs) return stubs[id]
  if (id.startsWith('@/')) throw new Error(`Unstubbed route boundary: ${id}`)
  return originalLoad.call(this, id, ...args)
}
let POST: (request: Request) => Promise<Response>
try {
  POST = (require('./route') as { POST: typeof POST }).POST
} finally {
  loader._load = originalLoad
}

const originalEnv = { ...process.env }
beforeEach(() => {
  state = initialState()
  process.env.GENERATION_DISABLED = 'false'
  process.env.MEDIA_PERSISTENCE_ENABLED = 'true'
  process.env.VOLCENGINE_SEEDREAM_MODEL = 'seedream-model'
  process.env.CREATOR_CN_API_BASE_URL = 'https://executor.test'
  process.env.CREATOR_EXECUTOR_SHARED_SECRET = 'test-secret'
  mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    state.events.push('trigger')
    state.triggers.push(JSON.parse(String(init.body)))
    return new Response('{}', { status: 200 })
  })
  mock.method(console, 'warn', () => {})
  mock.method(console, 'error', () => {})
  mock.method(console, 'log', () => {})
})
afterEach(() => {
  mock.restoreAll()
  for (const key of ['GENERATION_DISABLED', 'MEDIA_PERSISTENCE_ENABLED', 'VOLCENGINE_SEEDREAM_MODEL', 'CREATOR_CN_API_BASE_URL', 'CREATOR_EXECUTOR_SHARED_SECRET']) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

async function post(overrides: Record<string, unknown> = {}) {
  const response = await POST(new Request('https://city.test/api/generate/image', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      providerId: 'openai-image', prompt: '  A test image  ', projectId: 'project', nodeId: 'node',
      workflowId: 'workflow', aspectRatio: '4:3', size: '1024x768', inputAssets: [], ...overrides,
    }),
  }))
  return { response, body: await response.json() }
}

test('keeps the existing admin and disable guards before any job or dispatch', async () => {
  state.accessStatus = 403
  assert.equal((await post()).response.status, 403)
  state.accessStatus = 0
  process.env.GENERATION_DISABLED = 'true'
  assert.equal((await post()).body.errorCode, 'GENERATION_DISABLED')
  assert.deepEqual(state.events, [])
})

test('creates an independent zero-credit direct job before dispatch and links the persisted result and usage', async () => {
  const result = await post()
  assert.equal(result.body.success, true)
  assert.deepEqual(state.events, ['create', 'gateway', 'persist', 'update:SUCCEEDED'])
  assert.equal(state.creates.length, 1)
  const created = state.creates[0]!.data
  assert.equal(created.status, 'PROCESSING')
  assert.equal(created.estimatedCost, 0)
  assert.equal(created.actualCost, 0)
  assert.equal(created.walletId, undefined)
  assert.equal(created.projectId, 'project-owned')
  assert.equal(created.nodeId, 'node-owned')
  const input = created.input as Record<string, unknown>
  assert.equal(input.prompt, 'A test image')
  assert.equal(input.model, 'image-model')
  assert.deepEqual(input.params, { ratio: '4:3', aspectRatio: '4:3', size: '1024x768' })
  assert.deepEqual(state.finalizations, [null])
  assert.equal(result.body.generationJobId, 'image-job')
  assert.equal((state.persists[0]!.metadata as Record<string, unknown>).generationJobId, 'image-job')
  assert.equal(state.usage[0]!.generationJobId, 'image-job')
  const saved = state.updates[0]!
  assert.equal(saved.where?.id, 'image-job')
  assert.equal(saved.data.outputAssetId, 'asset-1')
  assert.ok(saved.data.completedAt instanceof Date)
  assert.equal((saved.data.output as Record<string, unknown>).stableUrl, 'https://assets.test/image.png')
  assert.equal((saved.data.output as Record<string, unknown>).status, 'succeeded')
  assert.equal((saved.data.output as Record<string, unknown>).url, 'https://assets.test/image.png')
})

test('does not dispatch or persist when direct job creation fails', async () => {
  state.createErrors = [new Error('database unavailable')]
  const result = await post()
  assert.equal(result.body.success, false)
  assert.equal(result.body.errorCode, 'generation_job_create_failed')
  assert.deepEqual(state.events, ['create'])
  assert.deepEqual(state.usage, [])
})

test('retains the legacy optional-column insert fallback before direct dispatch', async () => {
  state.createErrors = [new Error('The column `kind` does not exist in the current database.')]
  assert.equal((await post()).body.success, true)
  assert.deepEqual(state.events.slice(0, 3), ['create', 'create', 'gateway'])
  assert.equal(state.creates[1]!.data.kind, undefined)
})

test('preserves City setup errors and HTTP statuses without provider quota/env remapping', async () => {
  for (const [code, status] of [['UNAUTHORIZED', 401], ['GENERATION_ADMIN_REQUIRED', 403], ['GENERATION_ACCESS_UNAVAILABLE', 503], ['BILLING_ERROR', 500]] as const) {
    state.billingError = { code, status }
    const result = await post()
    assert.equal(result.body.errorCode, code)
    assert.equal(result.response.status, status)
  }
  assert.deepEqual(state.events, [])
})

for (const [code, expected] of [
  ['OPENAI_RATE_LIMITED', 'provider_rate_limited'],
  ['OPENAI_INSUFFICIENT_QUOTA', 'provider_quota_or_billing_error'],
  ['UPSTREAM_REJECTED', 'UPSTREAM_REJECTED'],
] as const) {
  test(`classifies ${code} by explicit code, not ambiguous 429 or rate/quota text`, async () => {
    state.providerResult = {
      success: false, status: 'failed', errorCode: code, upstreamStatus: 429,
      message: 'Rate limit or quota/billing issue', rawCode: code,
    }
    const result = await post()
    assert.equal(result.body.errorCode, expected)
    assert.equal(result.body.rawCode, code)
    assert.equal(result.body.upstreamStatus, 429)
    assert.equal(state.usage[0]!.errorCode, expected)
    assert.equal((state.updates[0]!.data.output as Record<string, unknown>).errorCode, expected)
    if (code !== 'OPENAI_INSUFFICIENT_QUOTA') assert.notEqual(result.body.errorCode, 'provider_quota_or_billing_error')
  })
}

test('stores direct provider failure and keeps its original code in response and usage', async () => {
  state.providerResult = { success: false, status: 'failed', errorCode: 'PROVIDER_AUTH_ERROR', message: 'denied', upstreamStatus: 403 }
  const result = await post()
  assert.equal(result.body.errorCode, 'PROVIDER_AUTH_ERROR')
  assert.equal(result.body.generationJobId, 'image-job')
  assert.equal(state.usage[0]!.errorCode, 'PROVIDER_AUTH_ERROR')
  assert.equal(state.usage[0]!.generationJobId, 'image-job')
  assert.deepEqual(state.events, ['create', 'gateway', 'update:FAILED'])
  assert.equal((state.updates[0]!.data.output as Record<string, unknown>).errorCode, 'PROVIDER_AUTH_ERROR')
  assert.equal(state.updates[0]!.data.errorMessage, 'denied')
})

test('records a thrown direct gateway error against the precreated job', async () => {
  state.gatewayError = Object.assign(new Error('gateway unavailable'), { code: 'PROVIDER_NETWORK_FAILED' })
  const result = await post()
  assert.equal(result.body.errorCode, 'PROVIDER_NETWORK_FAILED')
  assert.equal(result.body.generationJobId, 'image-job')
  assert.equal(state.updates[0]!.data.status, 'FAILED')
  assert.equal(state.usage[0]!.status, 'failed')
  assert.equal(state.usage[0]!.generationJobId, 'image-job')
})

test('records missing image URL as a failed job and usage without media persistence', async () => {
  state.providerResult.result = { metadata: {} }
  const result = await post()
  assert.equal(result.body.errorCode, 'provider_no_download_url')
  assert.equal(result.body.generationJobId, 'image-job')
  assert.equal(state.updates[0]!.data.status, 'FAILED')
  assert.equal(state.usage[0]!.errorCode, 'provider_no_download_url')
  assert.deepEqual(state.persists, [])
})

test('retains generated output when media persistence is pending, failed, or disabled', async () => {
  for (const mode of ['pending', 'failed', 'throw', 'disabled']) {
    state = initialState()
    process.env.MEDIA_PERSISTENCE_ENABLED = mode === 'disabled' ? 'false' : 'true'
    state.persistenceError = mode === 'throw'
    state.persistence = { ok: false, assetId: 'asset-pending', persistenceStatus: mode === 'pending' ? 'pending_persistence' : 'persistence_failed', errorCode: 'storage_unavailable', temporaryUrl: 'https://provider.test/image.png' }
    const result = await post()
    assert.equal(result.body.success, true, mode)
    assert.equal(result.body.imageUrl, 'https://provider.test/image.png')
    assert.equal(result.body.generationJobId, 'image-job')
    assert.equal(state.updates[0]!.data.status, 'SUCCEEDED')
    assert.equal((state.updates[0]!.data.output as Record<string, unknown>).persistenceStatus, result.body.persistenceStatus)
    assert.equal((state.updates[0]!.data.output as Record<string, unknown>).status, result.body.status)
    assert.equal((state.updates[0]!.data.output as Record<string, unknown>).url, result.body.imageUrl)
    assert.equal((state.updates[0]!.data.output as Record<string, unknown>).errorCode, result.body.persistenceError)
    assert.equal(state.usage[0]!.status, 'succeeded')
  }
})

test('reports terminal job write failure without hiding already-generated media or redispatching', async () => {
  state.terminalError = true
  const result = await post()
  assert.equal(result.body.success, true)
  assert.equal(result.body.imageUrl, 'https://assets.test/image.png')
  assert.equal(result.body.generationJobPersistenceError, 'generation_job_update_failed')
  assert.equal(state.gatewayRequests.length, 1)
})

for (const urls of ['stable', 'resolved', 'both']) {
  for (const retryPersistenceAvailable of [true, false]) {
    test(`retains post-upload ${urls} URL and consistent failure states with retry=${retryPersistenceAvailable}`, async () => {
      const stableUrl = urls === 'resolved' ? undefined : 'https://assets.test/uploaded.png'
      const resolvedUrl = urls === 'stable' ? undefined : 'https://assets.test/resolved.png'
      const retainedUrl = stableUrl ?? resolvedUrl
      state.persistence = {
        ok: false, stage: 'generation_job_update', generationStage: 'generation_job_update',
        generationStatus: 'generation_success', persistenceStatus: 'persistence_failed', assetStatus: 'failed',
        assetId: 'uploaded-asset', stableUrl, resolvedUrl, storageKey: 'uploaded.png',
        providerOriginalUrl: 'https://provider.test/image.png', temporaryUrl: 'https://provider.test/image.png',
        errorCode: 'asset_persistence_error', errorMessage: 'Asset link write failed', retryPersistenceAvailable,
      }
      const { body } = await post()
      const metadata = body.result.metadata
      const output = state.updates[0]!.data.output as Record<string, unknown>
      assert.equal(body.success, true)
      assert.equal(body.status, 'succeeded_with_persistence_failed')
      for (const value of [body.imageUrl, body.displayUrl, body.result.imageUrl, body.asset.url, output.url]) {
        assert.equal(value, retainedUrl)
      }
      for (const value of [body, metadata, output]) {
        assert.equal(value.stableUrl, retainedUrl)
        assert.equal(value.resolvedUrl, resolvedUrl ?? retainedUrl)
        assert.equal(value.providerOriginalUrl, 'https://provider.test/image.png')
        assert.equal(value.persistenceStatus, 'persistence_failed')
        assert.equal(value.assetStatus, 'failed')
        assert.equal(value.retryPersistenceAvailable, retryPersistenceAvailable)
        assert.equal(value.nextAction, retryPersistenceAvailable ? 'retry_persistence' : 'show_media')
      }
      assert.equal(body.asset.status, 'failed')
      assert.equal(body.mediaPersistence.retryPersistenceAvailable, retryPersistenceAvailable)
      if (!retryPersistenceAvailable) assert.doesNotMatch(body.warning, /重试/)
      assert.equal(state.updates[0]!.data.status, 'SUCCEEDED')
      assert.equal(state.usage[0]!.status, 'succeeded')
      assert.equal(state.gatewayRequests.length, 1)
    })
  }
}

test('pending persistence with retry disabled does not advertise a retry or a ready asset', async () => {
  state.persistence = {
    ok: false, persistenceStatus: 'pending_persistence', assetStatus: 'failed', assetId: 'pending-asset',
    errorCode: 'storage_unavailable', temporaryUrl: 'https://provider.test/image.png', retryPersistenceAvailable: false,
  }
  const { body } = await post()
  assert.equal(body.success, true)
  assert.equal(body.imageUrl, 'https://provider.test/image.png')
  assert.equal(body.asset.status, 'failed')
  for (const value of [body, body.result.metadata]) {
    assert.equal(value.assetStatus, 'failed')
    assert.equal(value.retryPersistenceAvailable, false)
    assert.equal(value.nextAction, 'show_media')
  }
})

test('CN full-input QUEUED write failure blocks dispatch for both new and existing jobs', async () => {
  for (const billingJobId of [null, 'existing-job']) {
    state = initialState()
    Object.assign(state, { cn: true, executor: 'cn', queueError: true, billingJobId })
    const result = await post({ providerId: 'volcengine-seedream-image' })
    assert.equal(result.body.success, false)
    assert.equal(result.body.errorCode, 'generation_job_update_failed')
    assert.equal(result.body.generationJobId, billingJobId ?? 'image-job')
    assert.deepEqual(state.triggers, [])
    assert.deepEqual(state.gatewayRequests, [])
  }
})

test('CN platform submission still saves full regional input before its executor trigger', async () => {
  Object.assign(state, { cn: true, executor: 'cn' })
  const result = await post({ providerId: 'volcengine-seedream-image' })
  assert.equal(result.body.status, 'queued')
  assert.deepEqual(state.events, ['create', 'update:QUEUED', 'trigger'])
  const input = state.updates[0]!.data.input as Record<string, unknown>
  assert.equal(input.providerRegion, 'cn')
  assert.equal(input.workflowId, 'workflow-owned')
  assert.equal(input.model, 'seedream-model')
  assert.deepEqual(state.triggers, [{ generationJobId: 'image-job' }])
})

test('BYOK keeps credentials out of job data and fails closed if its QUEUED update fails', async () => {
  for (const queueError of [false, true]) {
    state = initialState()
    Object.assign(state, { cn: true, executor: 'cn', queueError })
    const result = await post({ providerId: 'volcengine-seedream-image', billingMode: 'user_provider_account', userProviderAccountId: 'account-1' })
    assert.equal(result.body.success, !queueError)
    assert.equal(state.triggers.length, queueError ? 0 : 1)
    assert.doesNotMatch(JSON.stringify([...state.creates, ...state.updates]), /test-only-key/)
    if (!queueError) assert.deepEqual(state.triggers[0]!.userCredential, { apiKey: 'test-only-key', endpointId: 'test-endpoint' })
  }
})

test('CN providers cannot fall through to the direct gateway', async () => {
  state.cn = true
  const result = await post({ providerId: 'volcengine-seedream-image' })
  assert.equal(result.body.errorCode, 'executor_region_missing')
  assert.deepEqual(state.events, [])
})

test('preserves platform and BYOK trigger failure and timeout behavior without direct fallback', async () => {
  for (const byok of [false, true]) {
    for (const failure of ['http', 'network', 'timeout']) {
      state = initialState()
      Object.assign(state, { cn: true, executor: 'cn' })
      mock.method(globalThis, 'fetch', async () => {
        if (failure === 'http') return new Response('{}', { status: 503 })
        throw Object.assign(new Error('executor unavailable'), { name: failure === 'timeout' ? 'TimeoutError' : 'Error' })
      })
      const result = await post({
        providerId: 'volcengine-seedream-image',
        ...(byok ? { billingMode: 'user_provider_account', userProviderAccountId: 'account-1' } : {}),
      })
      assert.equal(result.body.success, failure === 'timeout')
      assert.equal(result.body.generationJobId, 'image-job')
      assert.equal(state.updates.at(-1)!.data.status, failure === 'timeout' ? 'QUEUED' : 'FAILED')
      assert.deepEqual(state.gatewayRequests, [])
    }
  }
})

test('keeps the provider failure code and job ID even if the terminal failure write is unavailable', async () => {
  state.terminalError = true
  state.providerResult = { success: false, errorCode: 'PROVIDER_QUOTA_EXCEEDED', message: 'provider quota exceeded' }
  const result = await post()
  assert.equal(result.body.errorCode, 'PROVIDER_QUOTA_EXCEEDED')
  assert.equal(result.body.generationJobId, 'image-job')
  assert.equal(result.body.generationJobPersistenceError, 'generation_job_update_failed')
  assert.equal(state.usage[0]!.generationJobId, 'image-job')
  assert.equal(state.gatewayRequests.length, 1)
})
