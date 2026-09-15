/**
 * Video generation safety contracts.
 *
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/videoGenerationReliabilityBoundary.test.ts
 *
 * These tests intentionally avoid a provider, billing mutation, database, and
 * browser session. They lock the local boundaries that must hold before any
 * Preview-only UI check is attempted.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

import {
  classifyGenerationFailure,
  getGenerationPhase,
} from '@/lib/canvas/generationReliabilityLayer'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceSource = readFileSync(resolve(testDirectory, '../VisualCanvasWorkspace.tsx'), 'utf8')
const videoRouteSource = readFileSync(resolve(testDirectory, '../../../app/api/generate/video/route.ts'), 'utf8')

test('uses the server video gate instead of unconditionally disabling every video node', () => {
  const disabled = workspaceSource.slice(workspaceSource.indexOf('generateDisabled={'), workspaceSource.indexOf('generateLabel={'))
  assert.doesNotMatch(disabled, /\|\|\s*editingNode\.kind === 'video'\s*\}/)
  assert.match(workspaceSource, /\[platformVideoGenerationEnabled, setPlatformVideoGenerationEnabled\] = useState\(false\)/)
  assert.match(workspaceSource, /setPlatformVideoGenerationEnabled\(data\.platformGenerationEnabled === true\)/)
  assert.match(workspaceSource, /!platformVideoGenerationEnabled \|\| billingMode === 'user_provider_account'/)
  assert.match(videoRouteSource, /platformGenerationEnabled: process\.env\.ENABLE_PLATFORM_VIDEO_GENERATION === 'true' && process\.env\.GENERATION_DISABLED !== 'true'/)
})

test('keeps the platform video gate ahead of billing and provider dispatch', () => {
  const gateIndex = videoRouteSource.indexOf("errorCode: 'VIDEO_GENERATION_NOT_READY'")
  const billingIndex = videoRouteSource.indexOf('const billing = await setupBilling(')
  const providerIndex = videoRouteSource.indexOf('const raw = await runOwnedGeneration(')
  const finalizeIndex = videoRouteSource.indexOf('const result = await finalizeBilling(')

  assert.ok(gateIndex >= 0, 'platform video gate must remain present')
  assert.ok(billingIndex >= 0, 'video billing call must remain identifiable')
  assert.ok(providerIndex >= 0, 'video provider dispatch must remain identifiable')
  assert.ok(finalizeIndex >= 0, 'video billing finalization must remain identifiable')
  assert.ok(gateIndex < billingIndex, 'platform gate must run before billing')
  assert.ok(gateIndex < providerIndex, 'platform gate must run before provider dispatch')
  assert.ok(gateIndex < finalizeIndex, 'platform gate must run before billing finalization')
})

test('video button opens only for an enabled platform with an available provider', () => {
  const start = workspaceSource.indexOf('const videoGenerateDisabled = ') + 'const videoGenerateDisabled = '.length
  const end = workspaceSource.indexOf('\n\n', start)
  const disabled = new Function('editingNode', 'platformVideoGenerationEnabled', 'billingMode', 'selectedVideoProviderStatus', 'defaultVideoProviderId', 'normalizedPromptModel', 'metadataRecord', `return ${workspaceSource.slice(start, end)}`)
  const node = { kind: 'video', status: 'idle' }
  const check = (enabled: boolean, mode = 'platform_credits', status = 'available', fallback: string | null = null) =>
    disabled(node, enabled, mode, status, fallback, 'volcengine-seedance-video', () => ({}))
  assert.equal(check(true), false)
  assert.equal(check(false), true)
  assert.equal(check(true, 'user_provider_account'), true)
  assert.equal(check(true, 'platform_credits', 'not-configured'), true)
  assert.equal(check(true, 'platform_credits', 'not-configured', 'volcengine-seedance-video'), false)
})

test('caps video polling and exits immediately after cancellation', () => {
  const loopStart = workspaceSource.indexOf('let videoPolls = 0')
  const loopEnd = workspaceSource.indexOf('// Loop exited:', loopStart)
  const loopSource = workspaceSource.slice(loopStart, loopEnd)

  assert.match(workspaceSource, /const MAX_VIDEO_GENERATION_POLLS = 120/)
  assert.match(loopSource, /while \(videoPolls < MAX_VIDEO_GENERATION_POLLS && !generationController\?\.signal\.aborted\)/)
  assert.match(loopSource, /generationAbortContext\(generationController\.signal\) !== null\) return/)
  assert.match(
    workspaceSource,
    /if \(videoPolls >= MAX_VIDEO_GENERATION_POLLS && !generationController\?\.signal\.aborted\) \{/,
  )
})

test('polling ceiling preserves the original running job without a false failure', () => {
  const start = workspaceSource.indexOf('if (videoPolls >= MAX_VIDEO_GENERATION_POLLS')
  const end = workspaceSource.indexOf('\n        return\n      }', start)
  let patch: Record<string, unknown> | undefined
  const runningMeta = { generationJobId: 'job-1', taskId: 'task-1', loading: true }
  const run = new Function('videoPolls', 'MAX_VIDEO_GENERATION_POLLS', 'generationController', 'handleNodePatch', 'nodeSnapshot', 'runningMeta', 'showCanvasFeedback', 'setDialogError', 'videoErrorMetadata', 'generationNodeSnapshot', 'result', 'generationProviderId', workspaceSource.slice(start, end))
  run(120, 120, undefined, (_id: string, value: Record<string, unknown>) => { patch = value }, { id: 'node-1' }, runningMeta, () => {}, () => {}, () => ({}), {}, {}, 'volcengine-seedance-video')
  assert.equal(patch?.status, 'running')
  assert.equal(patch?.errorMessage, undefined)
  assert.equal((patch?.metadataJson as Record<string, unknown>).generationJobId, 'job-1')
  assert.equal((patch?.metadataJson as Record<string, unknown>).taskId, 'task-1')
})

test('task center queries the existing database job instead of resubmitting or using a provider task id', () => {
  const start = workspaceSource.indexOf('const handleQueryGenerationTask = ')
  const end = workspaceSource.indexOf('const normalizedStatus = ', start)
  const source = workspaceSource.slice(start, end)
  assert.match(source, /currentMetadata\.generationJobId/)
  assert.match(source, /await pollVideoGenerationTask\(task\.providerId, generationJobId\)/)
  assert.doesNotMatch(source, /await pollSeedanceVideoTask/)
})

test('task-center completion replaces stale video URLs and running flags', () => {
  const handlerStart = workspaceSource.indexOf('const handleQueryGenerationTask = ')
  const start = workspaceSource.indexOf('const completedAt = ', handlerStart)
  const end = workspaceSource.indexOf('      handleNodePatch(', start)
  const helperStart = workspaceSource.indexOf('function videoSuccessMetadata(')
  const helperEnd = workspaceSource.indexOf('\nfunction ', helperStart + 1)
  const compiled = ts.transpile(workspaceSource.slice(helperStart, helperEnd))
  const normalize = new Function('metadataRecord', 'persistenceFromGenerateResult', 'isPersistencePendingResult', 'displayUrlFromGenerateResult', 'stringValue', `${compiled}; return videoSuccessMetadata`)(
    (value: unknown) => value || {}, () => ({}), () => false,
    (result: { videoUrl: string }) => result.videoUrl, (value: unknown) => typeof value === 'string' ? value : '',
  )
  const old = { resolvedUrl: 'old.mp4', stableUrl: 'old.mp4', loading: true, isRegenerating: true }
  const result = { success: true, status: 'done', videoUrl: 'new.mp4', assetId: 'asset-new' }
  const run = new Function('currentMetadata', 'statusResult', 'task', 'generationJobId', 'checkedAt', 'videoUrl', 'nodeSnapshot', 'videoSuccessMetadata', `${workspaceSource.slice(start, end)}; return metadataJson`)
  const metadata = run(old, result, { taskId: 'provider-task', providerId: 'volcengine-seedance-video' }, 'job-1', 'now', 'new.mp4', { metadataJson: old }, normalize)
  assert.equal(metadata.resolvedUrl, 'new.mp4')
  assert.equal(metadata.stableUrl, 'new.mp4')
  assert.equal(metadata.loading, false)
  assert.equal(metadata.isRegenerating, false)
})

test('classifies video gating, cancellation, and polling timeout for stable UI feedback', () => {
  assert.equal(classifyGenerationFailure('VIDEO_GENERATION_NOT_READY'), 'video_not_enabled')
  assert.equal(classifyGenerationFailure('generation_cancelled_by_user'), 'cancelled')
  assert.equal(classifyGenerationFailure('generation_polling_timeout'), 'polling_timeout')
  assert.equal(getGenerationPhase('failed', 'generation_cancelled_by_user'), 'cancelled')
})
