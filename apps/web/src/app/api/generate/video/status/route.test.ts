import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  internalSpatialPrevisTestStatusPayload,
  sanitizeInternalSpatialPrevisNodeMetadata,
} from './spatial-previs-test-status'

const directory = dirname(fileURLToPath(import.meta.url))
const routeSource = readFileSync(resolve(directory, 'route.ts'), 'utf8')

test('writes a completed video result only when the canvas node still belongs to that generation job', () => {
  const writeSource = routeSource.slice(
    routeSource.indexOf('async function writeCanvasNodeVideoResult'),
    routeSource.indexOf('export async function GET'),
  )

  assert.match(writeSource, /db\.canvasNode\.updateMany\(/)
  assert.match(writeSource, /metadataJson:\s*\{\s*path:\s*\['generationJobId'\],\s*equals:\s*args\.generationJobId,?\s*\}/)
  assert.match(writeSource, /const isSpatialPrevisTest = args\.internalSpatialPrevisTest \|\| metadata\.spatialPrevisTest === true/)
  assert.doesNotMatch(writeSource, /db\.canvasNode\.update\(/)
})

test('requires an authenticated owner lookup for video status jobs', () => {
  const getSource = routeSource.slice(routeSource.indexOf('export async function GET'))

  assert.match(getSource, /if \(!currentUser\)[\s\S]*status:\s*401/)
  assert.match(getSource, /db\.generationJob\.findFirst\(\{ where: \{ id: generationJobId, userId: currentUser\.id \} \}\)/)
  assert.doesNotMatch(getSource, /findFirst\(\{ where: \{ id: generationJobId \} \}\)/)
})

test('uses provider-free internal test payloads and preserves only app asset results', () => {
  const asset = { id: 'asset-1', url: 'https://app.example/assets/asset-1.mp4', projectId: 'project-1', workflowId: 'workflow-1', nodeId: 'node-1' }
  const success = internalSpatialPrevisTestStatusPayload({
    generationJobId: 'job-1',
    status: 'SUCCEEDED',
    asset,
  })
  const failed = internalSpatialPrevisTestStatusPayload({ generationJobId: 'job-1', status: 'FAILED' })
  const running = internalSpatialPrevisTestStatusPayload({ generationJobId: 'job-1', status: 'QUEUED' })

  assert.deepEqual(success, {
    success: true,
    status: 'succeeded',
    generationJobId: 'job-1',
    assetId: 'asset-1',
    outputAssetId: 'asset-1',
    asset: { id: 'asset-1', type: 'VIDEO', url: 'https://app.example/assets/asset-1.mp4' },
    resultVideoUrl: 'https://app.example/assets/asset-1.mp4',
    videoUrl: 'https://app.example/assets/asset-1.mp4',
    stableUrl: 'https://app.example/assets/asset-1.mp4',
    message: '三维预演测试已完成',
  })
  assert.deepEqual(failed, {
    success: false,
    status: 'failed',
    generationJobId: 'job-1',
    errorCode: 'spatial_previs_test_failed',
    message: '三维预演测试未能完成。',
  })
  assert.deepEqual(running, {
    success: true,
    status: 'running',
    generationJobId: 'job-1',
    message: '三维预演测试生成中',
  })

  const metadata = sanitizeInternalSpatialPrevisNodeMetadata({
    spatialPrevisTest: true,
    model: 'provider-model',
    providerId: 'provider',
    providerOriginalUrl: 'https://provider.example/raw.mp4',
    originalProviderVideoUrl: 'https://provider.example/original.mp4',
    temporaryUrl: 'https://provider.example/temp.mp4',
    providerRegion: 'cn',
    executionRegion: 'cn',
    storageRegion: 'cn',
    sourceProviderRegion: 'cn',
    executorKind: 'remote',
    taskId: 'provider-task',
    providerResponse: { secret: true },
    mediaPersistence: { storageProvider: 'provider-storage', storageKey: 'raw-key' },
    generationJob: { id: 'job-1', providerId: 'provider' },
  })
  assert.deepEqual(metadata, { spatialPrevisTest: true })
})

test('exports only Next.js route configuration and HTTP methods from the route module', () => {
  assert.doesNotMatch(routeSource, /export function (?:sanitizeInternalSpatialPrevisNodeMetadata|internalSpatialPrevisTestStatusPayload)/)
})
