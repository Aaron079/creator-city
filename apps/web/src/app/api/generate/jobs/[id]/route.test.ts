import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import Module, { createRequire } from 'node:module'
import { NextRequest } from 'next/server'
import type { GenerationJob, Prisma } from '@prisma/client'
import type { GenerateResponse, ProviderAdapter } from '@/lib/providers/types'

type Job = Pick<GenerationJob, 'id' | 'userId' | 'providerId' | 'externalJobId' | 'providerJobId' | 'walletId' | 'estimatedCost' | 'billingStatus' | 'status'> & Partial<Pick<GenerationJob, 'output' | 'completedAt'>>
const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const originalLoad = loader._load
let user: { id: string; status: string; role: string } | null
let identityError: Error | null
let databaseError: Error | null
let jobs: Job[]
let result: GenerateResponse
let pollError: Error | null
let actualAdapter: ProviderAdapter | null
let adapterAvailable: boolean
let pollingSupported: boolean
let reconcile: () => Promise<void>
let beforeUpdate: () => void
let writeError: Error | null
const writes: Prisma.GenerationJobUpdateManyArgs[] = []
const queries: Prisma.GenerationJobFindManyArgs[] = []
const polls: string[] = []
const settlements: string[] = []
const refunds: Array<{ id: string; reason?: string }> = []

function matches(job: Job, where: Prisma.GenerationJobWhereInput): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return (value as Prisma.GenerationJobWhereInput[]).some(clause => matches(job, clause))
    const actual = job[key as keyof Job]
    if (value && typeof value === 'object' && 'in' in value) return (value.in as unknown[]).includes(actual)
    return actual === value
  })
}

loader._load = function (id, ...args) {
  if (id === '@/lib/auth/current-user') return { getCurrentUser: async () => {
    if (identityError) throw identityError
    return user
  } }
  if (id === '@/lib/db') return { db: { generationJob: { findMany: async (query: Prisma.GenerationJobFindManyArgs) => {
    queries.push(query)
    if (databaseError) throw databaseError
    return jobs.filter(job => matches(job, query.where ?? {})).slice(0, query.take ?? jobs.length)
  }, updateMany: async (query: Prisma.GenerationJobUpdateManyArgs) => {
    writes.push(query)
    beforeUpdate()
    if (writeError) throw writeError
    const matching = jobs.filter(job => matches(job, query.where ?? {}))
    for (const job of matching) Object.assign(job, query.data)
    return { count: matching.length }
  } } } }
  if (id === '@/lib/providers/registry') return { getAdapter: (adapterId: string) => adapterAvailable ? {
    id: adapterId,
    ...(pollingSupported ? { getJob: async (id: string) => {
      polls.push(id)
      if (pollError) throw pollError
      return actualAdapter?.getJob ? actualAdapter.getJob(id) : result
    } } : {}),
  } : null }
  if (id === '@/lib/credits/billing-client') return {
    settleCredits: async (id: string) => { settlements.push(id); await reconcile() },
    refundCredits: async (id: string, reason?: string) => { refunds.push({ id, reason }); await reconcile() },
  }
  if (id === '@/lib/providers/env') return {
    getEnv: (key: string) => key === 'CUSTOM_VIDEO_PROVIDER_ENDPOINT' ? 'https://gateway.test' : 'test-key',
    getTimeout: () => 1000,
  }
  return originalLoad.call(this, id, ...args)
}
let GET: typeof import('./route').GET
let runwayAdapter: ProviderAdapter
let genericVideoGatewayAdapter: ProviderAdapter
try {
  GET = (require('./route') as typeof import('./route')).GET
  runwayAdapter = (require('@/lib/providers/adapters/runway') as typeof import('@/lib/providers/adapters/runway')).runwayAdapter
  genericVideoGatewayAdapter = (require('@/lib/providers/adapters/generic-video-gateway') as typeof import('@/lib/providers/adapters/generic-video-gateway')).genericVideoGatewayAdapter
} finally { loader._load = originalLoad }

function historical(patch: Partial<Job> = {}): Job {
  return { id: 'billing-owned', userId: 'owner', providerId: 'runway', externalJobId: 'runway:task-owned', providerJobId: null,
    walletId: 'wallet-owned', estimatedCost: 100, billingStatus: 'FROZEN', status: 'PROCESSING', ...patch }
}

beforeEach(() => {
  user = { id: 'owner', role: 'USER', status: 'ACTIVE' }
  identityError = databaseError = pollError = null
  jobs = [historical()]
  result = { success: true, providerId: 'runway', mode: 'real', status: 'succeeded', jobId: 'runway:task-owned', message: 'Done' }
  actualAdapter = null
  adapterAvailable = pollingSupported = true
  reconcile = async () => {}
  beforeUpdate = () => {}
  writeError = null
  writes.length = 0
  queries.length = polls.length = settlements.length = refunds.length = 0
})

function poll(id = 'runway:task-owned', billingJobId?: string) {
  const url = new URL(`https://app.test/api/generate/jobs/${encodeURIComponent(id)}`)
  if (billingJobId !== undefined) url.searchParams.set('billingJobId', billingJobId)
  return GET(new NextRequest(url), { params: Promise.resolve({ id }) })
}

function noBilling() {
  assert.deepEqual(settlements, [])
  assert.deepEqual(refunds, [])
}

for (const status of ['succeeded', 'failed'] as const) {
  test(`verified zero-credit ${status} poll persists terminal output once without billing`, async () => {
    jobs = [historical({ walletId: null, estimatedCost: 0, billingStatus: 'PENDING', status: 'QUEUED' })]
    result = { ...result, success: status === 'succeeded', status, result: status === 'succeeded' ? { videoUrl: 'https://media.test/video.mp4' } : undefined }
    assert.equal((await poll()).status, 200)
    assert.equal(jobs[0]!.status, status.toUpperCase())
    assert.deepEqual(jobs[0]!.output, JSON.parse(JSON.stringify(result)))
    assert.ok(jobs[0]!.completedAt instanceof Date)
    const original = structuredClone(jobs[0])
    result = { ...result, message: 'Repeated poll with different payload' }
    assert.equal((await poll()).status, 200)
    assert.deepEqual(jobs[0], original)
    noBilling()
  })
}

test('conditional terminal writes cannot overwrite concurrent completion or a changed association', async () => {
  for (const patch of [{ status: 'CANCELED' as const }, { externalJobId: 'runway:other' }, { userId: 'other' }, { providerId: 'other' }, { providerJobId: 'other' }]) {
    jobs = [historical({ walletId: null, estimatedCost: 0, billingStatus: 'PENDING', status: 'PROCESSING' })]
    beforeUpdate = () => Object.assign(jobs[0]!, patch)
    assert.equal((await poll()).status, 200)
    assert.equal(jobs[0]!.output, undefined)
    assert.equal(jobs[0]!.completedAt, undefined)
  }
  assert.equal(writes.length, 5)
})

test('zero-credit nonterminal, unknown failed, identity mismatch and transport polls never persist', async () => {
  jobs = [historical({ walletId: null, estimatedCost: 0, billingStatus: 'PENDING' })]
  for (const patch of [
    { status: 'queued' as const }, { status: 'running' as const },
    { success: false, status: 'failed' as const, jobId: undefined },
    { mode: 'unavailable' as const }, { jobId: 'runway:foreign' },
  ]) {
    result = { success: true, providerId: 'runway', mode: 'real', status: 'succeeded', jobId: 'runway:task-owned', message: 'Result', ...patch }
    await poll()
  }
  pollError = new Error('Transport failed')
  await poll()
  assert.deepEqual(writes, [])
  noBilling()
})

test('terminal persistence outage retains received output with a tracking warning', async () => {
  jobs = [historical({ walletId: null, estimatedCost: 0, billingStatus: 'PENDING' })]
  result = { ...result, result: { videoUrl: 'https://media.test/video.mp4' } }
  writeError = new Error('private-database-url')
  const response = await poll()
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(body.result, result.result)
  assert.equal(body.jobTrackingWarning.code, 'GENERATION_JOB_TRACKING_FAILED')
  assert.match(body.jobTrackingWarning.message, /已获取模型服务结果/)
  assert.match(body.jobTrackingWarning.message, /请勿重新提交生成请求/)
  assert.doesNotMatch(JSON.stringify(body), /private-database-url/)
  assert.equal(jobs[0]!.status, 'PROCESSING')
  noBilling()
})

test('anonymous polling cannot query providers or mutate caller-selected billing jobs', async () => {
  user = null
  assert.equal((await poll(undefined, 'billing-owned')).status, 401)
  assert.deepEqual(queries, [])
  assert.deepEqual(polls, [])
  noBilling()
})

test('inactive owners cannot poll', async () => {
  user!.status = 'SUSPENDED'
  assert.equal((await poll()).status, 403)
  assert.deepEqual(polls, [])
  noBilling()
})

test('foreign and unrecorded external jobs fail closed before polling', async () => {
  for (const records of [[historical({ userId: 'someone-else' })], []]) {
    jobs = records
    assert.equal((await poll()).status, 404)
    assert.deepEqual(polls, [])
    noBilling()
  }
})

test('billing hint must match both authenticated owner and requested external job', async () => {
  jobs.push(historical({ id: 'other-owned', externalJobId: 'runway:other-task' }), historical({ id: 'foreign', userId: 'someone-else' }))
  for (const hint of ['other-owned', 'foreign', 'missing', '']) {
    assert.ok([400, 404].includes((await poll(undefined, hint)).status))
    assert.deepEqual(polls, [])
    noBilling()
  }
})

test('provider mismatch and conflicting stored external identifiers cannot authorize polling', async () => {
  for (const record of [historical({ providerId: 'custom-video-gateway' }), historical({ providerJobId: 'other-task' }), historical({ externalJobId: 'custom-video-gateway:task-owned', providerJobId: 'task-owned' })]) {
    jobs = [record]
    assert.equal((await poll()).status, 404)
    assert.deepEqual(polls, [])
    noBilling()
  }
})

test('ambiguous owner/external mapping requires an exact matching billing hint', async () => {
  jobs.push(historical({ id: 'duplicate' }))
  assert.equal((await poll()).status, 409)
  assert.deepEqual(polls, [])
  noBilling()
  assert.equal((await poll(undefined, 'billing-owned')).status, 200)
  assert.deepEqual(settlements, ['billing-owned'])
})

test('stored prefixed and raw external/provider job IDs resolve without caller billing hints', async () => {
  for (const patch of [
    { externalJobId: 'runway:task-owned' },
    { externalJobId: 'task-owned' },
    { externalJobId: null, providerJobId: 'task-owned' },
    { externalJobId: null, providerJobId: 'runway:task-owned' },
    { externalJobId: 'runway:task-owned', providerJobId: 'task-owned' },
  ]) {
    jobs = [historical(patch)]
    const response = await poll('runway%3Atask-owned')
    assert.equal(response.status, 200)
    assert.equal((await response.json()).billingJobId, 'billing-owned')
  }
  assert.deepEqual(polls, Array(5).fill('runway:task-owned'))
  assert.deepEqual(settlements, Array(5).fill('billing-owned'))
  assert.deepEqual(refunds, [])
})

test('a verified terminal failure refunds only the associated historical job', async () => {
  result = { ...result, success: false, status: 'failed', message: 'Task cancelled' }
  assert.equal((await poll()).status, 200)
  assert.deepEqual(refunds, [{ id: 'billing-owned', reason: 'Task cancelled' }])
  assert.deepEqual(settlements, [])
})

test('new zero-credit and already reconciled jobs never invoke billing', async () => {
  for (const patch of [
    { walletId: null, estimatedCost: 0, billingStatus: 'PENDING' as const },
    { walletId: null }, { estimatedCost: 0 },
    { billingStatus: 'SETTLED' as const }, { billingStatus: 'REFUNDED' as const }, { billingStatus: 'PENDING' as const },
  ]) {
    jobs = [historical(patch)]
    assert.equal((await poll(undefined, 'billing-owned')).status, 200)
    noBilling()
  }
})

test('queued, running, unavailable, and inconsistent success results do not reconcile', async () => {
  for (const status of ['queued', 'running', 'not-configured', 'succeeded'] as const) {
    result = { ...result, status, success: false }
    await poll(undefined, 'billing-owned')
    noBilling()
  }
})

test('returned provider/job identity mismatch cannot reconcile', async () => {
  for (const patch of [{ providerId: 'custom-video-gateway' }, { jobId: 'runway:other-task' }]) {
    result = { ...result, providerId: 'runway', jobId: 'runway:task-owned', ...patch }
    assert.equal((await poll(undefined, 'billing-owned')).status, 502)
    noBilling()
  }
})

test('unknown failed response without terminal job identity never refunds', async () => {
  result = { ...result, providerId: 'custom-video-gateway', jobId: undefined, success: false, status: 'failed', message: 'Unrecognized response' }
  jobs = [historical({ providerId: 'custom-video-gateway', externalJobId: 'custom-video-gateway:task-owned' })]
  await poll('custom-video-gateway:task-owned', 'billing-owned')
  noBilling()
})

test('a stored terminal failure permits historical reconciliation when adapter omits job identity', async () => {
  jobs = [historical({ status: 'FAILED' })]
  result = { ...result, jobId: undefined, status: 'failed', success: false }
  await poll()
  assert.deepEqual(refunds, [{ id: 'billing-owned', reason: result.message }])
})

test('poll transport exceptions never refund or settle', async () => {
  pollError = new Error('Timed out while polling')
  assert.equal((await poll(undefined, 'billing-owned')).status, 500)
  noBilling()
})

test('identity/database outages fail closed with no private error details', async () => {
  for (const boundary of ['identity', 'database']) {
    identityError = boundary === 'identity' ? new Error('private-connection-string') : null
    databaseError = boundary === 'database' ? new Error('private-connection-string') : null
    const response = await poll(undefined, 'billing-owned')
    assert.equal(response.status, 503)
    assert.doesNotMatch(await response.text(), /private-connection-string/)
    assert.deepEqual(polls, [])
    noBilling()
  }
})

test('malformed IDs return 400 instead of throwing or invoking providers', async () => {
  for (const id of ['', 'runway', ':task', 'runway:', 'runway:%ZZ', 'runway:../other', 'runway:task?other']) {
    assert.equal((await poll(id, 'billing-owned')).status, 400)
    assert.deepEqual(polls, [])
    noBilling()
  }
})

test('unsupported adapters retain explicit route errors without billing', async () => {
  adapterAvailable = false
  assert.equal((await poll()).status, 404)
  adapterAvailable = true
  pollingSupported = false
  assert.equal((await poll()).status, 501)
  noBilling()
})

test('reconciliation is awaited and its failure is never converted into a refund', async () => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  reconcile = () => gate
  let responded = false
  const pending = poll(undefined, 'billing-owned').then(response => { responded = true; return response })
  try {
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(settlements, ['billing-owned'])
    assert.equal(responded, false)
  } finally { release(); await pending }
  reconcile = async () => { throw new Error('Settlement unavailable') }
  assert.equal((await poll(undefined, 'billing-owned')).status, 500)
  assert.deepEqual(refunds, [])
})

test('real Runway normalization refunds terminal cancellation but not HTTP polling errors', async (t) => {
  actualAdapter = runwayAdapter
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'task-owned', status: 'CANCELLED' }))
  assert.equal((await poll()).status, 200)
  assert.equal(refunds.length, 1)
  refunds.length = 0
  fetch.mock.mockImplementation(async () => Response.json({ message: 'Rate limited' }, { status: 429 }))
  assert.equal((await poll(undefined, 'billing-owned')).status, 500)
  noBilling()
})

test('real gateway normalization supports success without ID but unknown HTTP-200 bodies cannot refund', async (t) => {
  actualAdapter = genericVideoGatewayAdapter
  jobs = [historical({ providerId: 'custom-video-gateway', externalJobId: 'custom-video-gateway:task-owned' })]
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ videoUrl: 'https://media.test/video.mp4' }))
  assert.equal((await poll('custom-video-gateway:task-owned')).status, 200)
  assert.deepEqual(settlements, ['billing-owned'])
  settlements.length = 0
  fetch.mock.mockImplementation(async () => Response.json({ maintenance: true }))
  await poll('custom-video-gateway:task-owned', 'billing-owned')
  noBilling()
})
