import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import Module, { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const load = loader._load
const admin = { id: 'admin', role: 'ADMIN', status: 'ACTIVE' }
let user: typeof admin | null = admin
let cachedUser: typeof admin = admin
let token: string | undefined = 'session-token'
let outage = false
let ownsProject = true
let dispatches: unknown[] = []
let databaseCalls = 0
let signingCalls = 0
const env = {
  CREATOR_CN_API_BASE_URL: 'https://executor.test/',
  CREATOR_EXECUTOR_SHARED_SECRET: 'test-executor-secret',
  ASSET_TRANSFORM_ENABLED: 'true',
  ASSET_TRANSFORM_GATEWAY_URL: 'https://gateway.test',
  ASSET_TRANSFORM_OUTPUT_INGESTION_READY: 'true',
}
const originalEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]))
const originalFetch = globalThis.fetch

loader._load = function (id, ...args) {
  // UI identity deliberately stays cached as ADMIN even when fresh authority fails.
  if (id === '@/lib/auth/current-user') return { getCurrentUser: async () => cachedUser }
  if (id === '@/lib/auth/cookies') return { getSessionToken: () => token }
  if (id === '@/lib/auth/session') return { getSession: async () => {
    if (outage) throw Object.assign(new Error('private database failure'), { code: 'SESSION_DB_UNAVAILABLE' })
    return user ? { user } : null
  } }
  if (id === '@/lib/ai/skills') return {
    SKILL_NAMES: ['writer'],
    runSkill: async (...input: unknown[]) => { dispatches.push(input); return { success: true } },
  }
  if (id === '@/lib/db') return { db: {
    canvasWorkflow: { findFirst: async (input: unknown) => {
      databaseCalls++
      assert.deepEqual(input, { where: { projectId: 'project', project: { ownerId: 'admin' } }, select: { id: true } })
      return ownsProject ? { id: 'workflow' } : null
    } },
    canvasNode: { findFirst: async (input: unknown) => {
      databaseCalls++
      assert.deepEqual(input, { where: { workflowId: 'workflow', nodeId: 'node', kind: 'image' }, select: { resultImageUrl: true } })
      return { resultImageUrl: 'https://bucket.oss-cn-shanghai.aliyuncs.com/source.png' }
    } },
  } }
  if (id === '@/lib/asset-transform/assetTransformOss') return {
    extractOssKeyFromUrl: () => 'source.png',
    getTransformSourceGetUrl: async (key: string) => {
      signingCalls++
      assert.equal(key, 'source.png')
      return { signedGetUrl: 'https://storage.test/signed-source' }
    },
    getTransformPresignedPutUrls: async () => {
      signingCalls++
      return { subjectPutUrl: 'https://storage.test/signed-output', maskPutUrl: 'https://storage.test/signed-mask', subjectObjectKey: 'output.png', maskObjectKey: 'mask.png' }
    },
  }
  if (id === '@/lib/asset-transform/gatewayServiceClient') return {
    submitTransform: async (input: { ctid: string }) => {
      dispatches.push(input)
      return { transformId: input.ctid, status: 'queued' }
    },
    getTransformStatus: async (transformId: string) => ({ transformId, status: 'queued' }),
    getCapabilities: async () => [],
  }
  return load.call(this, id, ...args)
}
type Route = { POST: (request: Request) => Promise<Response>; GET: (request: Request) => Promise<Response> }
const skill = require('../../app/api/skill/route') as Route
const probe = require('../../app/api/debug/cn-real-probe/route') as { GET: () => Promise<Response> }
const modelProbe = require('../../app/api/debug/cn-probe/route') as { GET: () => Promise<Response> }
const networkProbe = require('../../app/api/generation/ark-network/route') as { GET: () => Promise<Response> }
const transform = require('../../app/api/asset-transform/route') as Route
loader._load = load

function request(malformed = false) {
  return new Request('https://city.test', { method: 'POST', body: malformed ? '{' : JSON.stringify({
    skill: 'writer', idea: 'test', transformKind: 'remove-background', projectId: 'project', sourceNodeId: 'node',
    sourceUrl: 'https://untrusted.test/input', params: { featherRadius: 99 },
  }) })
}
const routes = [
  { name: 'skill', call: (malformed = false) => skill.POST(request(malformed)) },
  { name: 'debug/cn-real-probe', call: () => probe.GET() },
  { name: 'debug/cn-probe', call: () => modelProbe.GET() },
  { name: 'generation/ark-network', call: () => networkProbe.GET() },
  { name: 'asset-transform', call: (malformed = false) => transform.POST(request(malformed)) },
]

beforeEach(() => {
  user = admin
  cachedUser = admin
  token = 'session-token'
  outage = false
  ownsProject = true
  dispatches = []
  databaseCalls = 0
  signingCalls = 0
  Object.assign(process.env, env)
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    assert.equal(url.origin, 'https://executor.test')
    assert.ok(['/debug/seedream-real-probe', '/debug/seedream-model-probe', '//debug/ark-network'].includes(url.pathname))
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('x-creator-executor-secret'), env.CREATOR_EXECUTOR_SHARED_SECRET)
    if (url.pathname.endsWith('/ark-network')) assert.equal(init?.method, 'GET')
    else assert.equal(headers.get('Authorization'), `Bearer ${env.CREATOR_EXECUTOR_SHARED_SECRET}`)
    dispatches.push(String(input))
    return Response.json({ success: true })
  }
})
after(() => {
  globalThis.fetch = originalFetch
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

for (const route of routes) {
  test(`${route.name}: fresh authority rejects anonymous, non-admin and inactive users before dispatch`, async () => {
    for (const identity of [null, { ...admin, role: 'USER' }, { ...admin, status: 'SUSPENDED' }]) {
      user = identity
      assert.equal((await route.call()).status, identity ? 403 : 401)
    }
    assert.equal(dispatches.length, 0)
    assert.equal(databaseCalls, 0)
    assert.equal(signingCalls, 0)
  })

  test(`${route.name}: cached administrator cannot dispatch during session DB outage`, async () => {
    outage = true
    const response = await route.call()
    assert.equal(response.status, 503)
    const body = await response.json()
    assert.equal(body.errorCode, 'GENERATION_AUTH_UNAVAILABLE')
    assert.doesNotMatch(JSON.stringify(body), /private database|session-token|test-executor-secret/)
    assert.equal(dispatches.length, 0)
    assert.equal(databaseCalls, 0)
    assert.equal(signingCalls, 0)
  })

  test(`${route.name}: missing cookie blocks before parsing or feature configuration`, async () => {
    token = undefined
    delete process.env.CREATOR_CN_API_BASE_URL
    process.env.ASSET_TRANSFORM_ENABLED = 'false'
    assert.equal((await route.call(true)).status, 401)
    assert.equal(dispatches.length, 0)
  })

  test(`${route.name}: fresh active admin retains dispatch`, async () => {
    const response = await route.call()
    assert.equal(response.status, 200)
    assert.equal(dispatches.length, 1)
    assert.doesNotMatch(await response.text(), /test-executor-secret|signed-source|signed-output|signed-mask/)
    if (route.name === 'asset-transform') {
      assert.equal(databaseCalls, 2)
      assert.equal(signingCalls, 2)
      assert.deepEqual(dispatches[0], {
        ctid: (dispatches[0] as { ctid: string }).ctid, userId: 'admin', projectId: 'project', nodeId: 'node',
        sourceUrl: 'https://storage.test/signed-source', outputKey: 'output.png', outputPutUrl: 'https://storage.test/signed-output',
        maskKey: 'mask.png', maskPutUrl: 'https://storage.test/signed-mask', transformKind: 'remove-background',
        params: { mode: 'auto', featherRadius: 10 },
      })
    }
  })
}

test('asset transform preserves feature, ingestion and project ownership gates', async () => {
  for (const key of ['ASSET_TRANSFORM_ENABLED', 'ASSET_TRANSFORM_OUTPUT_INGESTION_READY']) {
    process.env[key] = 'false'
    assert.equal((await transform.POST(request())).status, 503)
    process.env[key] = 'true'
  }
  assert.equal(databaseCalls, 0)
  ownsProject = false
  const denied = await transform.POST(request())
  assert.equal(denied.status, 403)
  assert.equal((await denied.json()).errorCode, 'TRANSFORM_PROJECT_FORBIDDEN')
  assert.equal(signingCalls, 0)
  assert.equal(dispatches.length, 0)
})

test('asset status and capability reads do not require fresh generation authority or submit jobs', async () => {
  user = { ...admin, role: 'USER' }
  cachedUser = user
  outage = true
  for (const url of ['https://city.test?transformId=ct-test', 'https://city.test']) {
    assert.equal((await transform.GET(new Request(url))).status, 200)
  }
  assert.equal(dispatches.length, 0)
  assert.equal(signingCalls, 0)
})
