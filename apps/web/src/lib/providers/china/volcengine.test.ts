import assert from 'node:assert/strict'
import test from 'node:test'
import type { SeedanceCapability } from '../../seedance-previs/capabilities'
import * as volcengine from './volcengine'

type SeedancePrevisRequestBuilder = (input: {
  prompt: string
  imageUrl?: string
  referenceImages?: readonly string[]
  referenceVideos?: readonly string[]
  audioReferences?: readonly string[]
  duration?: number
  aspectRatio?: string
  resolution?: string
  continuation?: boolean
  capability: SeedanceCapability
}) => {
  prompt: string
  imageUrl?: string
  referenceImages: readonly string[]
  referenceVideos: readonly string[]
  audioReferences: readonly string[]
  duration: number
  aspectRatio: string
  resolution?: string
  continuation: boolean
  capability: SeedanceCapability
}

type SeedancePrevisDispatcher = (input: Parameters<SeedancePrevisRequestBuilder>[0]) => Promise<unknown>

const enhancedAdapter = volcengine as typeof volcengine & {
  buildSeedancePrevisRequest?: SeedancePrevisRequestBuilder
  generateSeedancePrevisVideo?: SeedancePrevisDispatcher
}

function capability(supports: Partial<SeedanceCapability['supports']> = {}): SeedanceCapability {
  return {
    providerId: 'volcengine-seedance-video',
    model: 'seedance-2.5',
    entryPoint: 'ark',
    entitlement: 'standard',
    maxSingleDurationSec: 30,
    maxContinuousDurationSec: 30,
    supports: {
      firstFrame: true,
      finalFrame: false,
      imageReferences: true,
      videoReferences: true,
      audioReferences: true,
      continuation: true,
      depth: false,
      segmentation: false,
      layout: false,
      ...supports,
    },
  }
}

async function captureSeedanceRequest(run: () => Promise<unknown>) {
  const previousFetch = globalThis.fetch
  const previousApiKey = process.env.VOLCENGINE_ARK_API_KEY
  const previousModel = process.env.VOLCENGINE_SEEDANCE_MODEL
  let body: Record<string, unknown> | undefined

  process.env.VOLCENGINE_ARK_API_KEY = 'test-api-key'
  process.env.VOLCENGINE_SEEDANCE_MODEL = 'seedance-2.5'
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>
    return new Response(JSON.stringify({ id: 'task-1' }), { status: 202 })
  }) as typeof fetch

  try {
    const result = await run()
    assert.ok(body)
    return { body, result }
  } finally {
    globalThis.fetch = previousFetch
    if (previousApiKey === undefined) delete process.env.VOLCENGINE_ARK_API_KEY
    else process.env.VOLCENGINE_ARK_API_KEY = previousApiKey
    if (previousModel === undefined) delete process.env.VOLCENGINE_SEEDANCE_MODEL
    else process.env.VOLCENGINE_SEEDANCE_MODEL = previousModel
  }
}

test('keeps the legacy first-frame transport as an image_url content entry', async () => {
  const { body } = await captureSeedanceRequest(() => volcengine.generateSeedanceVideo({
    providerId: 'volcengine-seedance-video',
    prompt: 'A slow camera push toward the entrance.',
    imageUrl: 'https://example.com/legacy-first-frame.jpg',
  }))

  assert.deepEqual(body.content, [
    { type: 'text', text: 'A slow camera push toward the entrance.' },
    { type: 'image_url', image_url: { url: 'https://example.com/legacy-first-frame.jpg' } },
  ])
  assert.equal(body.duration, 5)
})

test('builds a capability-aware enhanced previs request with the official duration range', () => {
  assert.equal(typeof enhancedAdapter.buildSeedancePrevisRequest, 'function')
  if (!enhancedAdapter.buildSeedancePrevisRequest) return

  const request = enhancedAdapter.buildSeedancePrevisRequest({
    prompt: 'Hold the building and actor identity through the dolly.',
    imageUrl: 'https://example.com/first-frame.jpg',
    referenceImages: ['https://example.com/building.jpg'],
    referenceVideos: ['https://example.com/movement.mp4'],
    audioReferences: ['https://example.com/ambience.mp3'],
    duration: 30,
    aspectRatio: '9:16',
    resolution: '1080P',
    continuation: true,
    capability: capability(),
  })

  assert.equal(request.duration, 30)
  assert.equal(request.aspectRatio, '9:16')
  assert.equal(request.resolution, '1080p')
  assert.deepEqual(request.referenceImages, ['https://example.com/building.jpg'])
  assert.deepEqual(request.referenceVideos, ['https://example.com/movement.mp4'])
  assert.deepEqual(request.audioReferences, ['https://example.com/ambience.mp3'])
  assert.equal(request.continuation, true)

  assert.equal(enhancedAdapter.buildSeedancePrevisRequest({
    prompt: 'A four-second handoff.',
    duration: 4,
    capability: capability(),
  }).duration, 4)
  assert.throws(() => enhancedAdapter.buildSeedancePrevisRequest!({
    prompt: 'An unsupported standard take.',
    duration: 31,
    capability: capability(),
  }), /30 seconds/)
  assert.equal(enhancedAdapter.buildSeedancePrevisRequest({
    prompt: 'An entitled long take.',
    duration: 180,
    capability: {
      ...capability(),
      entitlement: 'long-take-beta',
      maxContinuousDurationSec: 180,
    },
  }).duration, 180)
})

test('uses official multimodal content entries for enhanced previs references', async () => {
  assert.equal(typeof enhancedAdapter.generateSeedancePrevisVideo, 'function')
  if (!enhancedAdapter.generateSeedancePrevisVideo) return

  const { body } = await captureSeedanceRequest(() => enhancedAdapter.generateSeedancePrevisVideo!({
    prompt: 'Continue the walk through the lobby.',
    imageUrl: 'https://example.com/first-frame.jpg',
    referenceImages: ['https://example.com/building.jpg'],
    referenceVideos: ['https://example.com/movement.mp4'],
    audioReferences: ['https://example.com/ambience.mp3'],
    duration: 30,
    aspectRatio: '16:9',
    resolution: '720p',
    continuation: true,
    capability: capability(),
  }))

  assert.deepEqual(body.content, [
    { type: 'text', text: 'Continue the walk through the lobby.' },
    { type: 'image_url', image_url: { url: 'https://example.com/first-frame.jpg' }, role: 'first_frame' },
    { type: 'image_url', image_url: { url: 'https://example.com/building.jpg' }, role: 'reference_image' },
    { type: 'video_url', video_url: { url: 'https://example.com/movement.mp4' }, role: 'reference_video' },
    { type: 'audio_url', audio_url: { url: 'https://example.com/ambience.mp3' }, role: 'reference_audio' },
  ])
  assert.equal(body.return_last_frame, true)
  assert.equal(body.duration, 30)
  assert.equal('referenceImages' in body, false)
  assert.equal('referenceVideos' in body, false)
  assert.equal('audioReferences' in body, false)
})

test('omits unsupported enhanced references and continuation fields', () => {
  assert.equal(typeof enhancedAdapter.buildSeedancePrevisRequest, 'function')
  if (!enhancedAdapter.buildSeedancePrevisRequest) return

  const request = enhancedAdapter.buildSeedancePrevisRequest({
    prompt: 'Keep the continuation stable.',
    imageUrl: 'https://example.com/first-frame.jpg',
    referenceImages: ['https://example.com/building.jpg'],
    referenceVideos: ['https://example.com/movement.mp4'],
    audioReferences: ['https://example.com/ambience.mp3'],
    continuation: true,
    capability: capability({
      firstFrame: false,
      imageReferences: false,
      videoReferences: false,
      audioReferences: false,
      continuation: false,
    }),
  })

  assert.equal(request.imageUrl, undefined)
  assert.deepEqual(request.referenceImages, [])
  assert.deepEqual(request.referenceVideos, [])
  assert.deepEqual(request.audioReferences, [])
  assert.equal(request.continuation, false)
})
