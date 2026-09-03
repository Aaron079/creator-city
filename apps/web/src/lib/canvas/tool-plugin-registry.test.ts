import assert from 'node:assert/strict'
import { test, describe } from 'node:test'
import {
  appendCameraContextToPrompt,
  buildCameraPromptContext,
  buildCameraSummaryText,
  DEFAULT_CAMERA_SETTINGS,
  type CameraSettings,
} from './cameraPromptContext'
import {
  appendSceneLightingContextToPrompt,
  buildSceneLightingPromptContext,
  buildLightingSummaryText,
  DEFAULT_SCENE_LIGHTING,
  type SceneLightingSettings,
} from './sceneLightingPromptContext'
import {
  CAMERA_LIGHTING_TOOL_PLUGINS,
  composeRegisteredToolPrompt,
  resolveRegisteredToolContributions,
  type CanvasToolPluginNodeKind,
  type RegisteredToolContext,
} from './tool-plugin-registry'

function cloneCamera(overrides: Partial<CameraSettings> = {}): CameraSettings {
  return { ...DEFAULT_CAMERA_SETTINGS, ...overrides }
}

function cloneLighting(overrides: Partial<SceneLightingSettings> = {}): SceneLightingSettings {
  return { ...DEFAULT_SCENE_LIGHTING, ...overrides }
}

describe('CAMERA_LIGHTING_TOOL_PLUGINS', () => {
  test('registers camera then lighting', () => {
    assert.deepEqual(
      CAMERA_LIGHTING_TOOL_PLUGINS.map((plugin) => plugin.id),
      ['camera-control', 'scene-lighting'],
    )
  })
})

describe('resolveRegisteredToolContributions', () => {
  test('invokes each plugin once and drops empty contexts', () => {
    const context: RegisteredToolContext = {
      nodeKind: 'image',
      camera: cloneCamera({ lens: '35mm' }),
      lighting: cloneLighting(),
    }

    const calls: string[] = []
    const originalContributes = CAMERA_LIGHTING_TOOL_PLUGINS.map((plugin) => plugin.contribute)

    try {
      CAMERA_LIGHTING_TOOL_PLUGINS.forEach((plugin, index) => {
        plugin.contribute = (pluginContext) => {
          calls.push(plugin.id)
          return originalContributes[index]!(pluginContext)
        }
      })

      const contributions = resolveRegisteredToolContributions(context)

      assert.deepEqual(calls, ['camera-control', 'scene-lighting'])
      assert.equal(contributions.length, 1)
      assert.equal(contributions[0]?.id, 'camera-control')
      assert.equal(contributions[0]?.promptContext, buildCameraPromptContext(context.camera))
      assert.equal(contributions[0]?.summary, buildCameraSummaryText(context.camera))
    } finally {
      CAMERA_LIGHTING_TOOL_PLUGINS.forEach((plugin, index) => {
        plugin.contribute = originalContributes[index]!
      })
    }
  })

  test('returns lighting contribution when camera is empty', () => {
    const context: RegisteredToolContext = {
      nodeKind: 'video',
      camera: cloneCamera(),
      lighting: cloneLighting({ atmosphere: 'Dreamlike' }),
    }

    const contributions = resolveRegisteredToolContributions(context)

    assert.deepEqual(
      contributions.map((contribution) => contribution.id),
      ['scene-lighting'],
    )
    assert.equal(contributions[0]?.promptContext, buildSceneLightingPromptContext(context.lighting))
    assert.equal(contributions[0]?.summary, buildLightingSummaryText(context.lighting))
  })

  test('returns no contributions for text nodes', () => {
    const context: RegisteredToolContext = {
      nodeKind: 'text',
      camera: cloneCamera({ lens: '35mm' }),
      lighting: cloneLighting({ atmosphere: 'Dreamlike' }),
    }

    const calls: string[] = []
    const originalContributes = CAMERA_LIGHTING_TOOL_PLUGINS.map((plugin) => plugin.contribute)

    try {
      CAMERA_LIGHTING_TOOL_PLUGINS.forEach((plugin, index) => {
        plugin.contribute = (pluginContext) => {
          calls.push(plugin.id)
          return originalContributes[index]!(pluginContext)
        }
      })

      assert.deepEqual(resolveRegisteredToolContributions(context), [])
      assert.deepEqual(calls, [])
    } finally {
      CAMERA_LIGHTING_TOOL_PLUGINS.forEach((plugin, index) => {
        plugin.contribute = originalContributes[index]!
      })
    }
  })
})

describe('composeRegisteredToolPrompt', () => {
  const basePrompt = 'Base prompt'
  const camera = cloneCamera({ cameraBody: 'A7S III', lens: '35mm', aperture: 'f/2.8', focus: 'Eye Focus' })
  const lighting = cloneLighting({
    lightingSetup: 'Soft Window Light',
    timeWeather: 'Golden Hour',
    atmosphere: 'Dreamlike',
    colorMood: 'Warm Amber',
  })

  test('matches legacy image prompt output byte-for-byte', () => {
    const context: RegisteredToolContext = { nodeKind: 'image', camera, lighting }

    const expected = appendSceneLightingContextToPrompt(
      appendCameraContextToPrompt(basePrompt, buildCameraPromptContext(camera)),
      buildSceneLightingPromptContext(lighting),
    )

    assert.equal(composeRegisteredToolPrompt(basePrompt, context), expected)
  })

  test('matches legacy video prompt output byte-for-byte', () => {
    const context: RegisteredToolContext = { nodeKind: 'video', camera, lighting }

    const expected = appendSceneLightingContextToPrompt(
      appendCameraContextToPrompt(basePrompt, buildCameraPromptContext(camera)),
      buildSceneLightingPromptContext(lighting),
    )

    assert.equal(composeRegisteredToolPrompt(basePrompt, context), expected)
  })

  test('text nodes never contribute', () => {
    const context: RegisteredToolContext = { nodeKind: 'text', camera, lighting }

    assert.equal(composeRegisteredToolPrompt(basePrompt, context), basePrompt)
  })

  test('empty context returns the base prompt unchanged', () => {
    const context: RegisteredToolContext = {
      nodeKind: 'image',
      camera: cloneCamera(),
      lighting: cloneLighting(),
    }

    assert.equal(composeRegisteredToolPrompt(basePrompt, context), basePrompt)
  })
})

describe('registered tool contributions', () => {
  test('carry helper-generated summaries for existing contexts', () => {
    const context: RegisteredToolContext = {
      nodeKind: 'image',
      camera: cloneCamera({ lens: '85mm', focus: 'Face Focus' }),
      lighting: cloneLighting({ colorMood: 'Monochrome' }),
    }

    const contributions = resolveRegisteredToolContributions(context)
    assert.equal(contributions.length, 2)
    assert.equal(contributions[0]?.summary, buildCameraSummaryText(context.camera))
    assert.equal(contributions[1]?.summary, buildLightingSummaryText(context.lighting))
  })

  test('exports the supported node kind union shape', () => {
    const kinds: CanvasToolPluginNodeKind[] = ['image', 'video', 'text']
    assert.deepEqual(kinds, ['image', 'video', 'text'])
  })
})
