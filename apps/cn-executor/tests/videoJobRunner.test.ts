import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import Module, { createRequire } from 'node:module'
import type { IncomingMessage, ServerResponse } from 'http'

const require = createRequire(import.meta.url)
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
const originalLoad = loader._load
const jobId = 'job-existing'
let job: Record<string, unknown>
let asset: Record<string, unknown> | null
let submissions: Record<string, unknown>[]
let polled: string[]
let downloads: number
let uploads: number
let assetWrites: number
let claimFails: boolean
let assetFails: boolean
let terminalDuringPoll: boolean
let fetchFails: boolean
let responseStatus: number
let responseHeaders: Record<string, unknown>
let successFails: boolean

loader._load = function (id, ...args) {
  if (id === '../auth') return { isAuthorized: () => true }
  if (id === './generateImage') return { readBody: async () => JSON.stringify({ generationJobId: jobId }) }
  if (id === '../logSafe') return { safeLogVideoJob: () => {} }
  if (id === '../db') return {
    query: async (sql: string) => {
      if (sql.includes('FROM "GenerationJob"')) {
        if (fetchFails) throw new Error('database temporarily unavailable')
        const row = { ...job }
        if (!sql.split('FROM')[0].includes('"providerJobId"')) delete row.providerJobId
        return [row]
      }
      if (sql.includes('FROM "Asset"')) return asset ? [{ ...asset }] : []
      if (sql.includes('FROM "CanvasNode"')) return []
      throw new Error(`Unexpected query: ${sql}`)
    },
    writeQuery: async (sql: string, values: unknown[]) => {
      if (sql.includes("SET status = 'PROCESSING'")) {
        if (claimFails) throw new Error('claim unavailable')
        const guarded = /WHERE[\s\S]*status = 'QUEUED'/.test(sql)
        if (guarded && (job.status !== 'QUEUED' || job.providerJobId)) return 0
        job.status = 'PROCESSING'
        if (sql.includes('input = $1')) job.input = JSON.parse(String(values[0]))
      } else if (sql.includes('SET "providerJobId"')) {
        job.providerJobId = values[0]
      } else if (sql.includes('INSERT INTO "Asset"')) {
        assetWrites++
        if (assetFails) throw new Error('asset unavailable')
        asset = { id: values[0], url: values[9], originalUrl: values[10], storageKey: values[8], metadataJson: JSON.parse(String(values[13])) }
      } else if (sql.includes("SET status = 'SUCCEEDED'")) {
        if (successFails) throw new Error('success write unavailable')
        job.status = 'SUCCEEDED'
        job.outputAssetId = values[0]
        job.output = JSON.parse(String(values[1]))
      } else if (sql.includes("SET status = 'FAILED'")) {
        job.status = 'FAILED'
      } else {
        throw new Error(`Unexpected write: ${sql}`)
      }
      return 1
    },
  }
  if (id === '../seedance') return {
    submitSeedanceTask: async (input: Record<string, unknown>) => {
      submissions.push(input)
      return { success: true, taskId: 'new-paid-task', model: input.model, submittedInput: input, endpoint: 'test' }
    },
    pollSeedanceTaskUntilDone: async (taskId: string) => {
      polled.push(taskId)
      if (terminalDuringPoll) job.status = 'SUCCEEDED'
      return { success: true, status: 'done', videoUrl: 'https://provider.test/result.mp4' }
    },
    downloadVideoBuffer: async () => { downloads++; return Buffer.from('video') },
    buildVideoOssKey: () => 'generated/video.mp4',
  }
  if (id === '../oss') return { uploadToOss: async () => {
    uploads++
    return { success: true, url: 'https://oss.test/result.mp4', storageKey: 'generated/video.mp4' }
  } }
  return originalLoad.call(this, id, ...args)
}
let handleRunVideoJob: typeof import('../src/handlers/videoJobRunner').handleRunVideoJob
try { handleRunVideoJob = require('../src/handlers/videoJobRunner').handleRunVideoJob } finally { loader._load = originalLoad }

beforeEach(() => {
  job = {
    id: jobId, userId: 'owner', projectId: 'project', nodeId: 'node',
    providerId: 'volcengine-seedance-video', status: 'PROCESSING', providerJobId: 'stored-paid-task',
    prompt: 'original prompt', input: { model: 'original-model', workflowId: 'workflow', duration: 5, submittedInput: { model: 'original-model' } },
  }
  asset = null
  submissions = []
  polled = []
  downloads = uploads = assetWrites = 0
  claimFails = assetFails = terminalDuringPoll = false
  fetchFails = false
  responseStatus = 0
  responseHeaders = {}
  successFails = false
})

const run = () => handleRunVideoJob({} as IncomingMessage, {
  setHeader: (name: string, value: unknown) => { responseHeaders[name] = value },
  writeHead: (status: number, headers: Record<string, unknown>) => { responseStatus = status; Object.assign(responseHeaders, headers) },
  end: () => {},
} as unknown as ServerResponse)

test('resumes the stored provider task without a paid submit or changing input/model', async () => {
  const originalInput = structuredClone(job.input)
  await run()
  assert.equal(submissions.length, 0)
  assert.deepEqual(polled, ['stored-paid-task'])
  assert.deepEqual(job.input, originalInput)
  assert.equal(job.status, 'SUCCEEDED')
  assert.equal((job.output as Record<string, unknown>).model, 'original-model')
  assert.equal((job.output as Record<string, unknown>).taskId, 'stored-paid-task')
  assert.equal(assetWrites, 1)
})

test('concurrent queued deliveries atomically claim one paid submission', async () => {
  job.status = 'QUEUED'
  job.providerJobId = null
  await Promise.all([run(), run()])
  assert.equal(submissions.length, 1)
  assert.equal(submissions[0].prompt, 'original prompt')
  assert.equal(submissions[0].model, 'original-model')
  assert.deepEqual(polled, ['new-paid-task'])
  assert.equal(job.providerJobId, 'new-paid-task')
  assert.equal(job.status, 'SUCCEEDED')
})

test('processing without a provider id cannot blindly resubmit', async () => {
  job.providerJobId = null
  await run()
  assert.equal(submissions.length, 0)
  assert.deepEqual(polled, [])
  assert.equal(job.status, 'PROCESSING')
})

test('failed queued claim cannot dispatch a paid task', async () => {
  job.status = 'QUEUED'
  job.providerJobId = null
  claimFails = true
  await run()
  assert.equal(submissions.length, 0)
  assert.deepEqual(polled, [])
  assert.equal(responseStatus, 500)
  assert.equal(responseHeaders['x-fc-status'], '500')
})

test('a failed success write retries with the existing asset and provider task', async () => {
  successFails = true
  await run()
  assert.equal(responseStatus, 500)
  assert.equal(responseHeaders['x-fc-status'], '500')
  assert.equal(job.status, 'PROCESSING')
  assert.equal(assetWrites, 1)
  successFails = false
  await run()
  assert.equal(responseStatus, 200)
  assert.equal(job.status, 'SUCCEEDED')
  assert.equal(submissions.length, 0)
  assert.equal(assetWrites, 1)
  assert.equal(downloads, 1)
})

test('a transient initial database read returns retryable failure, then the same queued job completes once', async () => {
  job.status = 'QUEUED'
  job.providerJobId = null
  fetchFails = true
  await run()
  assert.equal(responseStatus, 500)
  assert.equal(job.status, 'QUEUED')
  assert.equal(submissions.length, 0)
  fetchFails = false
  await run()
  assert.equal(responseStatus, 200)
  assert.equal(job.status, 'SUCCEEDED')
  assert.equal(submissions.length, 1)
})

for (const status of ['SUCCEEDED', 'FAILED', 'CANCELED']) {
  test(`${status} deliveries skip all provider and persistence work`, async () => {
    job.status = status
    await run()
    assert.equal(submissions.length, 0)
    assert.deepEqual(polled, [])
    assert.equal(assetWrites + downloads + uploads, 0)
  })
}

test('a job completed by another delivery while polling is not persisted again', async () => {
  terminalDuringPoll = true
  await run()
  assert.equal(assetWrites + downloads + uploads, 0)
})

test('an existing persisted asset is reused when finalizing a resumed job', async () => {
  asset = { id: 'existing-asset', url: 'https://oss.test/existing.mp4', storageKey: 'existing.mp4', originalUrl: 'https://provider.test/result.mp4' }
  await run()
  assert.equal(submissions.length, 0)
  assert.equal(assetWrites + downloads + uploads, 0)
  assert.equal(job.outputAssetId, 'existing-asset')
  assert.equal((job.output as Record<string, unknown>).stableUrl, 'https://oss.test/existing.mp4')
})

test('asset persistence failure cannot mark success with a nonexistent asset', async () => {
  assetFails = true
  await run()
  assert.equal(job.status, 'PROCESSING')
  assert.equal(job.providerJobId, 'stored-paid-task')
  assert.equal(job.outputAssetId, undefined)
  assert.equal(responseStatus, 500)
  assetFails = false
  await run()
  assert.equal(responseStatus, 200)
  assert.equal(job.status, 'SUCCEEDED')
  assert.equal(submissions.length, 0)
})
