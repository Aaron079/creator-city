import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import Module, { createRequire } from 'node:module'
import { NextRequest } from 'next/server'
import type { GenerateRequest, GenerateResponse } from '@/lib/providers/types'

const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const originalLoad = loader._load
let allowed = true
let createError = false
let updateError = false
let transientUpdateError = false
let response: GenerateResponse
let currentUserId = 'admin'
let contextError: Error | undefined
let createFailure: Error | undefined
let testProviderId = 'custom-video-gateway'
const events: string[] = []
const created: Record<string, unknown>[] = []
const updates: Record<string, unknown>[] = []
const requests: GenerateRequest[] = []
let finalized = 0
let mediaWrites = 0

loader._load = function (id, ...args) {
  if (id === '@/lib/generation/access') return { generationAccessResponse: async () => allowed ? null : Response.json({ success: false }, { status: 403 }) }
  if (id === '@/lib/auth/current-user') return { getCurrentUser: async () => ({ id: currentUserId, role: 'ADMIN', status: 'ACTIVE' }) }
  if (id === '@/lib/providers/registry') return { getAdapter: () => ({ getJob: async () => response }) }
  if (id === '@/lib/credits/billing-client') return {
    settleCredits: async () => assert.fail('New jobs must not settle credits'),
    refundCredits: async () => assert.fail('New jobs must not refund credits'),
  }
  if (id === '@/lib/credits/billing-middleware') return {
    setupBilling: async () => ({ ok: true, ctx: { userId: 'admin', billingJobId: null, estimatedCredits: 0 } }),
    finalizeBilling: async (raw: GenerateResponse, id: string | null) => { assert.equal(id, null); finalized++; return raw },
  }
  if (id === '@/lib/providers/generate') return { runGenerate: async (request: GenerateRequest) => { events.push('generate'); requests.push(request); return response } }
  if (id === '@/lib/db') return { db: { generationJob: {
    findMany: async ({ where }: { where: { userId: string; providerId: string; OR: { externalJobId?: { in: string[] } }[] } }) => {
      const job: Record<string, unknown> = { ...created[0], ...updates[0], id: 'owned-job', providerJobId: null }
      return job.userId === where.userId && job.providerId === where.providerId
        && where.OR[0]?.externalJobId?.in.includes(job.externalJobId as string) ? [job] : []
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      events.push('create')
      if (createFailure) throw createFailure
      if (createError) throw new Error('private-database-url')
      created.push(data)
      return { ...data, id: 'owned-job' }
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      assert.equal(where.id, 'owned-job')
      events.push('update')
      if (updateError) throw new Error('private-database-url')
      if (transientUpdateError) { transientUpdateError = false; throw new Error('transient-write-error') }
      updates.push(data)
      return { id: where.id, ...data }
    },
    updateMany: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      assert.equal(where.id, 'owned-job')
      updates.push(data)
      return { count: 1 }
    },
  } } }
  if (id === '@/lib/provider-management') return { buildProviderManagementStatus: async () => ({ providers: [{ providerId: testProviderId, available: true, model: 'configured-model' }] }) }
  if (id === '@/lib/executors/executor-gateway') return { getExecutorForProvider: () => ({ providerRegion: 'global', executionRegion: 'global', storageRegion: 'global', executorKind: 'local' }) }
  if (id === '@/lib/generation/generation-context') return {
    stringInput: (value: unknown) => typeof value === 'string' ? value.trim() : '',
    missingGenerationInput: () => [],
    prepareGenerationContext: async () => {
      if (contextError) throw contextError
      return { ok: true, projectId: 'project', workflowId: 'workflow', nodeId: 'node' }
    },
  }
  if (id === '@/lib/assets/persist-generated-media') return { persistGeneratedMedia: async ({ url, metadata }: { url: string; metadata: { generationJobId: string } }) => {
    mediaWrites++
    assert.equal(response.status, 'succeeded')
    assert.equal(metadata.generationJobId, 'owned-job')
    return { ok: true, assetId: 'owned-asset', stableUrl: url }
  } }
  if (id === '@/lib/asset-intelligence') return { analyzeAssetIntelligence: async () => null }
  return originalLoad.call(this, id, ...args)
}
let routes: Record<string, (request: NextRequest) => Promise<Response>>
let poll: typeof import('../../app/api/generate/jobs/[id]/route').GET
try {
  poll = (require('../../app/api/generate/jobs/[id]/route') as typeof import('../../app/api/generate/jobs/[id]/route')).GET
  routes = {
    music: (require('../../app/api/generate/music/route') as typeof import('../../app/api/generate/music/route')).POST,
    audio: (require('../../app/api/generate/audio/route') as typeof import('../../app/api/generate/audio/route')).POST,
    video: (require('../../app/api/generate/video/route') as typeof import('../../app/api/generate/video/route')).POST,
  }
} finally { loader._load = originalLoad }

beforeEach(() => {
  allowed = true
  contextError = undefined
  createFailure = undefined
  testProviderId = 'custom-video-gateway'
  currentUserId = 'admin'
  createError = updateError = false
  transientUpdateError = false
  finalized = mediaWrites = 0
  events.length = created.length = updates.length = requests.length = 0
  response = { success: true, providerId: 'custom-video-gateway', mode: 'real', status: 'queued', jobId: 'custom-video-gateway:task-new', message: 'Queued' }
})

test('Seedance dispatch uses durable FC async acceptance and sends the owned job once', async () => {
  testProviderId = 'volcengine-seedance-video'
  const previousBase = process.env.CREATOR_CN_API_BASE_URL
  const previousFetch = globalThis.fetch
  process.env.CREATOR_CN_API_BASE_URL = 'https://preview.cn-beijing.fcapp.run'
  let calls = 0
  globalThis.fetch = async (url, init) => {
    calls++
    assert.equal(String(url), 'https://preview.cn-beijing.fcapp.run/api/jobs/run-video')
    assert.equal(new Headers(init?.headers).get('x-fc-invocation-type'), 'Async')
    assert.deepEqual(JSON.parse(String(init?.body)), { generationJobId: 'owned-job' })
    return new Response(null, { status: 202 })
  }
  try {
    const result = await submit('video')
    const body = await result.json()
    assert.equal(body.success, true)
    assert.equal(body.status, 'queued')
    assert.equal(body.generationJobId, 'owned-job')
    assert.equal(calls, 1)
    assert.equal(created.length, 1)
  } finally {
    globalThis.fetch = previousFetch
    if (previousBase === undefined) delete process.env.CREATOR_CN_API_BASE_URL
    else process.env.CREATOR_CN_API_BASE_URL = previousBase
  }
})

async function submit(kind: string) {
  const original = process.env.ENABLE_PLATFORM_VIDEO_GENERATION
  const disabled = process.env.GENERATION_DISABLED
  process.env.ENABLE_PLATFORM_VIDEO_GENERATION = 'true'
  delete process.env.GENERATION_DISABLED
  try {
    return await routes[kind]!(new NextRequest(`https://app.test/api/generate/${kind}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: testProviderId, prompt: 'test', projectId: 'project', nodeId: 'node', userId: 'attacker', billingJobId: 'foreign' }),
    }))
  } finally {
    if (original === undefined) delete process.env.ENABLE_PLATFORM_VIDEO_GENERATION
    else process.env.ENABLE_PLATFORM_VIDEO_GENERATION = original
    if (disabled === undefined) delete process.env.GENERATION_DISABLED
    else process.env.GENERATION_DISABLED = disabled
  }
}

for (const kind of ['music', 'audio', 'video']) {
  test(`${kind} preserves completed paid media with a warning when the job update fails`, async () => {
    updateError = true
    response = { ...response, status: 'succeeded', message: 'Generated', result: { videoUrl: 'https://media.test/video.mp4', audioUrl: 'https://media.test/audio.mp3', musicUrl: 'https://media.test/music.mp3' } }
    const result = await submit(kind)
    const body = await result.json()
    assert.equal(result.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.status, 'succeeded')
    for (const [key, value] of Object.entries(response.result!)) assert.deepEqual(body.result[key], value)
    assert.equal(body.generationJobId, 'owned-job')
    assert.equal(body.billingJobId, undefined)
    assert.equal(body.errorCode, undefined)
    assert.equal(body.jobTrackingWarning.code, 'GENERATION_JOB_TRACKING_FAILED')
    assert.match(body.jobTrackingWarning.message, /已生成/)
    assert.match(body.jobTrackingWarning.message, /请勿重新生成/)
    assert.doesNotMatch(JSON.stringify(body), /private-database-url/)
    assert.deepEqual(events, ['create', 'generate', 'update'])
    assert.equal(requests.length, 1)
  })

  test(`${kind} submitted zero-credit job supports owner-only polling without a billing hint`, async () => {
    const submitted = await (await submit(kind)).json()
    response = { ...response, status: 'succeeded', result: { audioUrl: 'https://media.test/result.mp3' } }
    const request = new NextRequest(`https://app.test/api/generate/jobs/${encodeURIComponent(submitted.jobId)}`)
    const params = Promise.resolve({ id: submitted.jobId as string })
    const result = await poll(request, { params })
    const body = await result.json()
    assert.equal(result.status, 200)
    assert.equal(body.status, 'succeeded')
    assert.equal(body.generationJobId, submitted.generationJobId)
    assert.equal(body.jobTrackingWarning, undefined)
    assert.equal(body.billingJobId, undefined)
    currentUserId = 'other-user'
    assert.equal((await poll(request, { params })).status, 404)
  })

  test(`${kind} creates an independent zero-credit owner record before provider submission`, async () => {
    const result = await submit(kind)
    const body = await result.json()
    assert.equal(result.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.status, 'queued')
    assert.equal(body.jobId, 'custom-video-gateway:task-new')
    assert.equal(body.generationJobId, 'owned-job')
    assert.equal(body.billingJobId, undefined)
    assert.deepEqual(events, ['create', 'generate', 'update'])
    assert.equal(created[0]!.userId, 'admin')
    assert.equal(created[0]!.nodeType, kind)
    assert.equal(created[0]!.estimatedCost, 0)
    assert.equal(created[0]!.walletId, null)
    assert.equal(created[0]!.billingStatus, 'PENDING')
    assert.equal(updates[0]!.externalJobId, body.jobId)
    assert.equal(mediaWrites, 0)
    assert.equal(finalized, 0)
  })

  test(`${kind} authorization fails before job creation and provider submission`, async () => {
    allowed = false
    assert.equal((await submit(kind)).status, 403)
    assert.deepEqual(events, [])
  })

  test(`${kind} cannot submit when the ownership record cannot be created`, async () => {
    createError = true
    const result = await submit(kind)
    const body = await result.json()
    assert.equal(body.success, false)
    assert.equal(body.errorCode, 'GENERATION_JOB_TRACKING_FAILED')
    assert.match(body.message, /尚未向模型服务发送生成请求/)
    assert.deepEqual(requests, [])
    assert.doesNotMatch(JSON.stringify(body), /private-database-url/)
  })
}

test('tracking failure after provider submission exposes a separate error without resubmitting or billing', async () => {
  updateError = true
  const body = await (await submit('audio')).json()
  assert.equal(body.success, false)
  assert.equal(body.errorCode, 'GENERATION_JOB_TRACKING_FAILED')
  assert.equal(body.generationJobId, 'owned-job')
  assert.equal(body.jobId, response.jobId)
  assert.match(body.message, /任务关联暂不可用/)
  assert.match(body.message, /仅供排查/)
  assert.match(body.message, /无法确认能否恢复查询/)
  assert.deepEqual(events, ['create', 'generate', 'update', 'update'])
  assert.match(body.message, /请勿重新提交/)
  assert.equal(requests.length, 1)
  assert.equal(finalized, 0)
  assert.doesNotMatch(JSON.stringify(body), /private-database-url/)
})

test('async association write retries once without redispatch and recovers owner polling', async () => {
  for (const status of ['queued', 'running'] as const) {
    events.length = updates.length = requests.length = 0
    transientUpdateError = true
    response = { ...response, status }
    const result = await submit('audio')
    const body = await result.json()
    assert.equal(result.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.status, status)
    assert.equal(body.jobId, response.jobId)
    assert.equal(body.generationJobId, 'owned-job')
    assert.equal(body.jobTrackingWarning, undefined)
    assert.equal(updates[0]!.externalJobId, response.jobId)
    assert.equal(updates[0]!.status, status === 'queued' ? 'QUEUED' : 'PROCESSING')
    assert.deepEqual(events, ['create', 'generate', 'update', 'update'])
    assert.equal(requests.length, 1)
    assert.equal((await poll(new NextRequest('https://app.test/api/generate/jobs/test'), { params: Promise.resolve({ id: response.jobId! }) })).status, 200)
  }
})

test('synchronous audio success and explicit provider failure retain their result semantics', async () => {
  for (const status of ['succeeded', 'failed'] as const) {
    events.length = updates.length = 0
    response = { ...response, status, success: status === 'succeeded', jobId: undefined, result: status === 'succeeded' ? { audioUrl: 'https://media.test/audio.mp3' } : undefined }
    const body = await (await submit('audio')).json()
    assert.equal(body.status, status)
    assert.equal(body.success, response.success)
    assert.deepEqual(body.result, response.result)
    assert.equal(body.generationJobId, 'owned-job')
    assert.equal(updates[0]!.status, status.toUpperCase())
  }
})

test('synchronous video returns the internal generation job ID after media persistence', async () => {
  response = { ...response, status: 'succeeded', result: { videoUrl: 'https://media.test/video.mp4' } }
  const body = await (await submit('video')).json()
  assert.equal(body.success, true)
  assert.equal(body.generationJobId, 'owned-job')
  assert.equal(body.jobTrackingWarning, undefined)
  assert.equal(mediaWrites, 1)
})

test('video database pool exhaustion is a sanitized platform 503, never a provider failure or a paid retry', async () => {
  contextError = Object.assign(new Error('Timed out fetching a new connection from the connection pool. private-database-url'), { code: 'P2024' })
  const result = await submit('video')
  const body = await result.json()
  assert.equal(result.status, 503)
  assert.equal(body.errorCode, 'DB_CONNECTION_UNAVAILABLE')
  assert.equal(body.errorStage, 'database')
  assert.match(body.message, /数据库/)
  assert.doesNotMatch(JSON.stringify(body), /private-database-url|provider_timeout|provider_network_failed/)
  assert.deepEqual(events, [])
  assert.equal(requests.length, 0)
})

test('Seedance job-create pool exhaustion returns a platform 503 without contacting the executor', async () => {
  testProviderId = 'volcengine-seedance-video'
  createFailure = Object.assign(new Error('Timed out fetching a new connection from the connection pool. private-database-url'), { code: 'P2024' })
  const fetch = globalThis.fetch
  let dispatches = 0
  globalThis.fetch = async () => { dispatches++; throw new Error('Unexpected executor dispatch') }
  try {
    const result = await submit('video')
    const body = await result.json()
    assert.equal(result.status, 503)
    assert.equal(body.errorCode, 'DB_CONNECTION_UNAVAILABLE')
    assert.equal(body.errorStage, 'database')
    assert.doesNotMatch(JSON.stringify(body), /private-database-url/)
    assert.deepEqual(events, ['create'])
    assert.equal(dispatches, 0)
  } finally { globalThis.fetch = fetch }
})
