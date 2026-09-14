import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import Module, { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const load = loader._load
type Identity = { id: string; role: string; status: string }
let user: Identity | null = null
let cachedUser: Identity | null = null
let token: string | undefined = 'session-token'
let sessionError = false
let providerCalls = 0
let persistenceCalls = 0
let persistedUserId: string | undefined
const originalFetch = globalThis.fetch
const testEnv = {
  SCENE_PLUGIN_ENDPOINT: 'https://scene.test/replace',
  SCENE_PLUGIN_API_KEY: 'scene-test-key',
  CHARACTER_FACE_ID_POC_ENABLED: 'true',
  FACE_ID_PROVIDER: 'fal',
  FAL_KEY: 'fal-test-key',
  MEDIA_PERSISTENCE_ENABLED: 'true',
}
const originalEnv = Object.fromEntries(Object.keys(testEnv).map(key => [key, process.env[key]]))
before(() => {
  Object.assign(process.env, testEnv)
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    assert.ok(['https://scene.test/replace', 'https://fal.run/fal-ai/instantid'].includes(url), `Unexpected fetch: ${url}`)
    assert.equal(init?.method, 'POST')
    assert.equal(new Headers(init?.headers).get('Authorization'), url.includes('scene.test') ? 'Bearer scene-test-key' : 'Key fal-test-key')
    providerCalls++
    return Response.json({ imageUrl: 'https://media.test/generated.png', images: [{ url: 'https://media.test/generated.png' }] })
  }
})
after(() => {
  globalThis.fetch = originalFetch
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})
loader._load = function (id, ...args) {
  if (id === '@/lib/auth/current-user') return { getCurrentUser: async () => cachedUser ?? user }
  if (id === '@/lib/auth/cookies') return { getSessionToken: () => token }
  if (id === '@/lib/auth/session') return { getSession: async (value: string) => {
    assert.equal(value, token)
    if (sessionError) throw Object.assign(new Error('private database failure'), { code: 'SESSION_DB_UNAVAILABLE' })
    return user ? { user } : null
  } }
  if (id === '@/lib/ai') {
    const generate = async () => { providerCalls++; return { success: true } }
    return { generate, generateImage: generate, generateVideo: generate, VALID_ROLES: ['director'] }
  }
  if (id === '@/lib/creator-model/runtime') return { runCreatorModel: async () => { providerCalls++; return { mode: 'remote', content: 'OK' } } }
  if (id === '@/lib/assets/persist-generated-media') return { persistGeneratedMedia: async (input: { userId?: string }) => {
    persistenceCalls++
    persistedUserId = input.userId
    return { ok: true, stableUrl: 'https://media.test/persisted.png', assetId: 'asset-test' }
  } }
  return load.call(this, id, ...args)
}
const aliases = ['generate', 'generate-image', 'generate-video', 'agent/chat', 'creator-model/chat', 'creator-agent/chat']
const specialized = ['scene-plugins/replace', 'skills/character-reference/face-id-poc']
const routes = [...aliases, ...specialized].map((route) => require(`../../app/api/${route}/route`) as { POST: (request: Request) => Promise<Response> })
loader._load = load

function generationRequest() {
  return new Request('https://city.test', { method: 'POST', body: JSON.stringify({
    idea: 'test', role: 'director', prompt: 'test', messages: [],
    sourceImageUrl: 'https://media.test/source.png', targetDescription: 'test',
    region: { x: 0, y: 0, width: 1, height: 1 },
  }) })
}

test('legacy and specialized generation reject outsiders before any model or persistence call', async () => {
  for (const identity of [null, { id: 'user', role: 'USER', status: 'ACTIVE' }, { id: 'admin', role: 'ADMIN', status: 'SUSPENDED' }]) {
    user = identity
    for (const route of routes) {
      const response = await route.POST(generationRequest())
      assert.equal(response.status, identity ? 403 : 401)
    }
  }
  assert.equal(providerCalls, 0)
  assert.equal(persistenceCalls, 0)
})

test('administrator can still use the guarded legacy generator', async () => {
  user = { id: 'admin', role: 'ADMIN', status: 'ACTIVE' }
  const route = routes[1]
  assert.ok(route)
  const response = await route.POST(new Request('https://city.test', { method: 'POST', body: JSON.stringify({ prompt: 'test' }) }))
  assert.equal(response.status, 200)
})

for (const [index, name] of specialized.entries()) {
  test(`${name} rejects a non-admin before dispatch`, async () => {
    user = { id: 'user', role: 'USER', status: 'ACTIVE' }
    const before = providerCalls
    const response = await routes[aliases.length + index]!.POST(generationRequest())
    assert.equal(response.status, 403)
    assert.equal(providerCalls, before)
  })
}

test('stale UI administrator identity cannot authorize paid dispatch during a session outage', async () => {
  cachedUser = { id: 'admin', role: 'ADMIN', status: 'ACTIVE' }
  sessionError = true
  const before = providerCalls
  try {
    for (const route of routes) {
      const response = await route.POST(generationRequest())
      assert.equal(response.status, 503)
      const body = await response.json()
      assert.equal(body.errorCode, 'GENERATION_AUTH_UNAVAILABLE')
      assert.doesNotMatch(JSON.stringify(body), /private database|session-token/)
    }
    assert.equal(providerCalls, before)
  } finally {
    cachedUser = null
    sessionError = false
  }
})

test('fresh session revocation, role and status override a cached active administrator', async () => {
  cachedUser = { id: 'admin', role: 'ADMIN', status: 'ACTIVE' }
  const before = providerCalls
  try {
    for (const identity of [null, { id: 'admin', role: 'USER', status: 'ACTIVE' }, { id: 'admin', role: 'ADMIN', status: 'SUSPENDED' }]) {
      user = identity
      for (const route of routes) {
        const response = await route.POST(generationRequest())
        assert.equal(response.status, identity ? 403 : 401)
      }
    }
    assert.equal(providerCalls, before)
  } finally { cachedUser = null }
})

test('missing session cookie cannot reuse a cached administrator identity', async () => {
  cachedUser = { id: 'admin', role: 'ADMIN', status: 'ACTIVE' }
  token = undefined
  const before = providerCalls
  try {
    for (const route of routes) {
      const response = await route.POST(generationRequest())
      assert.equal(response.status, 401)
    }
    assert.equal(providerCalls, before)
  } finally {
    cachedUser = null
    token = 'session-token'
  }
})

test('active administrator retains specialized dispatch and scene result persistence', async () => {
  user = { id: 'admin', role: 'ADMIN', status: 'ACTIVE' }
  for (const route of routes.slice(aliases.length)) {
    const before = providerCalls
    const response = await route.POST(generationRequest())
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(providerCalls, before + 1)
    assert.doesNotMatch(JSON.stringify(body), /scene-test-key|fal-test-key/)
  }
  assert.equal(persistedUserId, 'admin')
  assert.ok(persistenceCalls > 0)
})

test('specialized authorization runs before request parsing and provider configuration checks', async () => {
  user = null
  delete process.env.SCENE_PLUGIN_ENDPOINT
  process.env.CHARACTER_FACE_ID_POC_ENABLED = 'false'
  const before = providerCalls
  try {
    for (const route of routes.slice(aliases.length)) {
      const response = await route.POST(new Request('https://city.test', { method: 'POST', body: '{' }))
      assert.equal(response.status, 401)
    }
    assert.equal(providerCalls, before)
  } finally { Object.assign(process.env, testEnv) }
})

test('specialized feature and configuration gates still block authorized dispatch', async () => {
  user = { id: 'admin', role: 'ADMIN', status: 'ACTIVE' }
  delete process.env.SCENE_PLUGIN_ENDPOINT
  process.env.CHARACTER_FACE_ID_POC_ENABLED = 'false'
  const before = providerCalls
  try {
    const scene = await routes[aliases.length]!.POST(generationRequest())
    assert.equal((await scene.json()).errorCode, 'SCENE_PLUGIN_NOT_CONFIGURED')
    const face = await routes[aliases.length + 1]!.POST(generationRequest())
    assert.equal(face.status, 501)
    assert.equal((await face.json()).errorCode, 'FACE_ID_POC_DISABLED')
    assert.equal(providerCalls, before)
  } finally { Object.assign(process.env, testEnv) }
})

test('inventoried paid browser entry points carry the shared guard', () => {
  const guarded = [...aliases.filter(route => route !== 'creator-agent/chat'), ...specialized, 'skill', 'debug/cn-real-probe', 'debug/cn-probe', 'generation/ark-network', 'asset-transform', 'agents/text', 'generate/text', 'generate/image', 'generate/video', 'generate/music', 'generate/audio', 'generate/character-reference', 'lab/generate', 'generate/seedance-previs', 'generate/seedance-previs/[deliveryId]/retry', 'admin/providers/test']
  for (const route of guarded) {
    const source = readFileSync(path.join(process.cwd(), 'src/app/api', route, 'route.ts'), 'utf8')
    assert.match(source, /generationAccessResponse/, route)
  }
})
