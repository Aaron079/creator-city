/**
 * Unit tests for taskInputMode.ts
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/canvas/taskInputMode.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  getTaskInputMode,
  getTaskInputModeLabel,
  CURRENT_PROVIDER_CAPABILITIES,
  type TaskInputCapabilities,
} from './taskInputMode'

const CAPS_FULL: TaskInputCapabilities = { supportsReferenceImage: true, supportsImageToVideo: true }
const CAPS_NONE: TaskInputCapabilities = { supportsReferenceImage: false, supportsImageToVideo: false }
const CAPS_VIDEO_ONLY: TaskInputCapabilities = { supportsReferenceImage: false, supportsImageToVideo: true }
const CAPS_IMAGE_ONLY: TaskInputCapabilities = { supportsReferenceImage: true, supportsImageToVideo: false }

describe('getTaskInputMode — text nodes', () => {
  test('text node, no inputs → text-to-text', () => {
    assert.equal(getTaskInputMode('text', false, false, CAPS_FULL), 'text-to-text')
  })

  test('text node, upstream image present → still text-to-text (text nodes never generate images)', () => {
    assert.equal(getTaskInputMode('text', true, false, CAPS_FULL), 'text-to-text')
  })

  test('text node, local reference → still text-to-text', () => {
    assert.equal(getTaskInputMode('text', false, true, CAPS_FULL), 'text-to-text')
  })

  test('text node, capabilities none → text-to-text', () => {
    assert.equal(getTaskInputMode('text', false, false, CAPS_NONE), 'text-to-text')
  })
})

describe('getTaskInputMode — image nodes', () => {
  test('image node, no inputs, caps none → text-to-image', () => {
    assert.equal(getTaskInputMode('image', false, false, CAPS_NONE), 'text-to-image')
  })

  test('image node, no inputs, caps full → text-to-image (no reference, no upstream)', () => {
    assert.equal(getTaskInputMode('image', false, false, CAPS_FULL), 'text-to-image')
  })

  test('image node, upstream image, caps support reference → image-to-image', () => {
    assert.equal(getTaskInputMode('image', true, false, CAPS_FULL), 'image-to-image')
  })

  test('image node, local reference, caps support reference → image-to-image', () => {
    assert.equal(getTaskInputMode('image', false, true, CAPS_FULL), 'image-to-image')
  })

  test('image node, upstream + local reference, caps support → image-to-image', () => {
    assert.equal(getTaskInputMode('image', true, true, CAPS_FULL), 'image-to-image')
  })

  test('image node, upstream image, caps NO reference support → text-to-image (context saved only)', () => {
    assert.equal(getTaskInputMode('image', true, false, CAPS_NONE), 'text-to-image')
  })

  test('image node, local reference, caps NO reference support → text-to-image (Seedream does not support)', () => {
    assert.equal(getTaskInputMode('image', false, true, CAPS_NONE), 'text-to-image')
  })

  test('image node, local ref, CURRENT_PROVIDER_CAPABILITIES → text-to-image (Seedream unsupported)', () => {
    assert.equal(getTaskInputMode('image', false, true, CURRENT_PROVIDER_CAPABILITIES), 'text-to-image')
  })
})

describe('getTaskInputMode — video nodes', () => {
  test('video node, no inputs, caps none → text-to-video', () => {
    assert.equal(getTaskInputMode('video', false, false, CAPS_NONE), 'text-to-video')
  })

  test('video node, no inputs, caps video → text-to-video (no reference)', () => {
    assert.equal(getTaskInputMode('video', false, false, CAPS_VIDEO_ONLY), 'text-to-video')
  })

  test('video node, upstream image, caps video → image-to-video', () => {
    assert.equal(getTaskInputMode('video', true, false, CAPS_VIDEO_ONLY), 'image-to-video')
  })

  test('video node, local reference, caps video → image-to-video', () => {
    assert.equal(getTaskInputMode('video', false, true, CAPS_VIDEO_ONLY), 'image-to-video')
  })

  test('video node, upstream image, caps NO video → text-to-video (context saved)', () => {
    assert.equal(getTaskInputMode('video', true, false, CAPS_NONE), 'text-to-video')
  })

  test('video node, local reference, caps NO video → text-to-video', () => {
    assert.equal(getTaskInputMode('video', false, true, CAPS_NONE), 'text-to-video')
  })

  test('video node, upstream + local, caps full → image-to-video', () => {
    assert.equal(getTaskInputMode('video', true, true, CAPS_FULL), 'image-to-video')
  })

  test('video node, local ref, CURRENT_PROVIDER_CAPABILITIES → image-to-video (Seedance supported)', () => {
    assert.equal(getTaskInputMode('video', false, true, CURRENT_PROVIDER_CAPABILITIES), 'image-to-video')
  })

  test('video node, upstream, CURRENT_PROVIDER_CAPABILITIES → image-to-video', () => {
    assert.equal(getTaskInputMode('video', true, false, CURRENT_PROVIDER_CAPABILITIES), 'image-to-video')
  })
})

describe('getTaskInputMode — CURRENT_PROVIDER_CAPABILITIES reflects real state', () => {
  test('image-to-image NOT supported (Seedream has no referenceImages)', () => {
    assert.equal(CURRENT_PROVIDER_CAPABILITIES.supportsReferenceImage, false)
  })

  test('image-to-video IS supported (Seedance accepts imageUrl)', () => {
    assert.equal(CURRENT_PROVIDER_CAPABILITIES.supportsImageToVideo, true)
  })
})

describe('getTaskInputModeLabel', () => {
  test('text-to-text → 文生文', () => {
    assert.equal(getTaskInputModeLabel('text-to-text'), '文生文')
  })

  test('text-to-image → 文生图', () => {
    assert.equal(getTaskInputModeLabel('text-to-image'), '文生图')
  })

  test('image-to-image → 图生图', () => {
    assert.equal(getTaskInputModeLabel('image-to-image'), '图生图')
  })

  test('text-to-video → 文生视频', () => {
    assert.equal(getTaskInputModeLabel('text-to-video'), '文生视频')
  })

  test('image-to-video → 图生视频', () => {
    assert.equal(getTaskInputModeLabel('image-to-video'), '图生视频')
  })

  test('unsupported → 不支持', () => {
    assert.equal(getTaskInputModeLabel('unsupported'), '不支持')
  })
})
