import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import {
  clearRegisteredToolStateValue,
  copyRegisteredToolState,
  getDefaultRegisteredToolState,
  getNodePromptBoosterKey,
  loadRegisteredToolState,
  saveRegisteredToolStateValue,
} from './tool-plugin-state'
import {
  getNodeCameraSettingsKey,
  getNodeSceneLightingKey,
} from './nodeDirectorContextStorage'

const projectId = 'project-phase-2'
const sourceNodeId = 'node-source'
const childNodeId = 'node-child'
let originalWindowDescriptor: PropertyDescriptor | undefined
let windowOverrideInstalled = false

type StorageOperation = 'getItem' | 'setItem' | 'removeItem'

function installStorage(throwOn?: StorageOperation): Map<string, string> {
  const values = new Map<string, string>()
  if (!windowOverrideInstalled) {
    originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  }
  windowOverrideInstalled = true

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => {
          if (throwOn === 'getItem') throw new Error('getItem unavailable')
          return values.get(key) ?? null
        },
        setItem: (key: string, value: string) => {
          if (throwOn === 'setItem') throw new Error('setItem unavailable')
          values.set(key, value)
        },
        removeItem: (key: string) => {
          if (throwOn === 'removeItem') throw new Error('removeItem unavailable')
          values.delete(key)
        },
      },
    },
  })

  return values
}

afterEach(() => {
  if (!windowOverrideInstalled) return

  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
  } else {
    delete (globalThis as { window?: unknown }).window
  }
  originalWindowDescriptor = undefined
  windowOverrideInstalled = false
})

describe('tool plugin state', () => {
  test('returns defaults without a project or node identity', () => {
    assert.deepEqual(loadRegisteredToolState(null, null), getDefaultRegisteredToolState())
  })

  test('builds a node-scoped Prompt Booster storage key', () => {
    assert.equal(
      getNodePromptBoosterKey(projectId, sourceNodeId),
      `creator-city:prompt-booster:${projectId}:${sourceNodeId}`,
    )
  })

  test('returns null Prompt Booster state during SSR and when storage has no value', () => {
    assert.equal(loadRegisteredToolState(projectId, sourceNodeId).promptBooster, null)

    installStorage()

    assert.equal(loadRegisteredToolState(projectId, sourceNodeId).promptBooster, null)
  })

  test('returns null Prompt Booster state when storage reads throw', () => {
    installStorage('getItem')

    assert.equal(loadRegisteredToolState(projectId, sourceNodeId).promptBooster, null)
  })

  test('does not throw when Prompt Booster storage writes fail', () => {
    installStorage('setItem')

    assert.doesNotThrow(() => {
      saveRegisteredToolStateValue(projectId, sourceNodeId, 'prompt-booster', {
        suggestionId: 'suggestion-source',
        title: 'Cinematic reveal',
      })
    })
  })

  test('does not throw when clearing Prompt Booster storage fails', () => {
    installStorage('removeItem')

    assert.doesNotThrow(() => {
      clearRegisteredToolStateValue(projectId, sourceNodeId, 'prompt-booster')
    })
  })

  test('does not throw when Prompt Booster storage reads or writes fail during copy', () => {
    for (const operation of ['getItem', 'setItem'] as const) {
      const values = installStorage(operation)
      values.set(
        getNodePromptBoosterKey(projectId, sourceNodeId),
        JSON.stringify({ suggestionId: 'suggestion-source', title: 'Cinematic reveal' }),
      )

      assert.doesNotThrow(() => {
        copyRegisteredToolState(projectId, sourceNodeId, childNodeId, 'prompt-booster')
      })
    }
  })

  test('keeps Prompt Booster selections isolated per node and restores them from storage', () => {
    const values = installStorage()

    saveRegisteredToolStateValue(projectId, sourceNodeId, 'prompt-booster', {
      suggestionId: '  suggestion-source  ',
      title: '  Cinematic reveal  ',
    })
    values.set(
      getNodePromptBoosterKey(projectId, childNodeId),
      JSON.stringify({ suggestionId: 'suggestion-child', title: 'Quiet close-up' }),
    )

    assert.deepEqual(
      JSON.parse(values.get(getNodePromptBoosterKey(projectId, sourceNodeId)) ?? 'null'),
      {
        suggestionId: 'suggestion-source',
        title: 'Cinematic reveal',
      },
    )
    assert.deepEqual(loadRegisteredToolState(projectId, sourceNodeId).promptBooster, {
      suggestionId: 'suggestion-source',
      title: 'Cinematic reveal',
    })
    assert.deepEqual(loadRegisteredToolState(projectId, childNodeId).promptBooster, {
      suggestionId: 'suggestion-child',
      title: 'Quiet close-up',
    })
  })

  test('rejects malformed, wrong, and blank Prompt Booster state', () => {
    const values = installStorage()
    const key = getNodePromptBoosterKey(projectId, sourceNodeId)

    for (const value of [
      '{broken',
      JSON.stringify(null),
      JSON.stringify([]),
      JSON.stringify({ suggestionId: 42, title: 'Valid title' }),
      JSON.stringify({ suggestionId: 'valid-id', title: false }),
      JSON.stringify({ suggestionId: '   ', title: 'Valid title' }),
      JSON.stringify({ suggestionId: 'valid-id', title: '   ' }),
    ]) {
      values.set(key, value)
      assert.equal(loadRegisteredToolState(projectId, sourceNodeId).promptBooster, null)
    }
  })

  test('does not save blank Prompt Booster selections', () => {
    const values = installStorage()
    const key = getNodePromptBoosterKey(projectId, sourceNodeId)

    saveRegisteredToolStateValue(projectId, sourceNodeId, 'prompt-booster', {
      suggestionId: '   ',
      title: 'Cinematic reveal',
    })

    assert.equal(values.has(key), false)
  })

  test('clears only the selected node Prompt Booster state', () => {
    const values = installStorage()
    const sourceKey = getNodePromptBoosterKey(projectId, sourceNodeId)
    const childKey = getNodePromptBoosterKey(projectId, childNodeId)
    values.set(sourceKey, JSON.stringify({ suggestionId: 'source', title: 'Source' }))
    values.set(childKey, JSON.stringify({ suggestionId: 'child', title: 'Child' }))
    values.set(getNodeCameraSettingsKey(projectId, sourceNodeId), '{"lens":"50mm"}')

    clearRegisteredToolStateValue(projectId, sourceNodeId, 'prompt-booster')

    assert.equal(values.has(sourceKey), false)
    assert.equal(values.has(childKey), true)
    assert.equal(values.has(getNodeCameraSettingsKey(projectId, sourceNodeId)), true)
  })

  test('copies Prompt Booster only to the child without rewriting the source', () => {
    const values = installStorage()
    const sourceKey = getNodePromptBoosterKey(projectId, sourceNodeId)
    const childKey = getNodePromptBoosterKey(projectId, childNodeId)
    const sourceValue = '{"suggestionId":" suggestion-source ","title":" Source title "}'
    values.set(sourceKey, sourceValue)
    values.set(getNodeCameraSettingsKey(projectId, childNodeId), '{"lens":"85mm"}')

    copyRegisteredToolState(projectId, sourceNodeId, childNodeId, 'prompt-booster')

    assert.equal(values.get(sourceKey), sourceValue)
    assert.deepEqual(JSON.parse(values.get(childKey) ?? 'null'), {
      suggestionId: 'suggestion-source',
      title: 'Source title',
    })
    assert.equal(values.get(getNodeCameraSettingsKey(projectId, childNodeId)), '{"lens":"85mm"}')
  })

  test('keeps Camera and Lighting independently stored for one node', () => {
    installStorage()

    saveRegisteredToolStateValue(projectId, sourceNodeId, 'scene-lighting', {
      lightingSetup: 'Backlight',
      timeWeather: '',
      atmosphere: '',
      colorMood: '',
    })
    saveRegisteredToolStateValue(projectId, sourceNodeId, 'camera-control', {
      cameraBody: 'sony-venice-2',
      lens: '35mm',
      aperture: '',
      focus: '',
    })

    const state = loadRegisteredToolState(projectId, sourceNodeId)

    assert.equal(state.camera.lens, '35mm')
    assert.equal(state.lighting.lightingSetup, 'Backlight')
  })

  test('copies only Camera to a child node without changing Lighting or the source', () => {
    installStorage()

    saveRegisteredToolStateValue(projectId, sourceNodeId, 'camera-control', {
      cameraBody: '',
      lens: '85mm',
      aperture: '',
      focus: '',
    })
    saveRegisteredToolStateValue(projectId, sourceNodeId, 'scene-lighting', {
      lightingSetup: 'Low Key',
      timeWeather: '',
      atmosphere: '',
      colorMood: '',
    })

    copyRegisteredToolState(projectId, sourceNodeId, childNodeId, 'camera-control')

    assert.equal(loadRegisteredToolState(projectId, childNodeId).camera.lens, '85mm')
    assert.deepEqual(
      loadRegisteredToolState(projectId, childNodeId).lighting,
      getDefaultRegisteredToolState().lighting,
    )
    assert.equal(loadRegisteredToolState(projectId, sourceNodeId).camera.lens, '85mm')
    assert.equal(loadRegisteredToolState(projectId, sourceNodeId).lighting.lightingSetup, 'Low Key')
  })

  test('does not migrate source Lighting when copying only Camera', () => {
    const values = installStorage()
    saveRegisteredToolStateValue(projectId, sourceNodeId, 'camera-control', {
      cameraBody: '',
      lens: '50mm',
      aperture: '',
      focus: '',
    })
    values.set(
      `creator-city:scene-lighting:${projectId}`,
      JSON.stringify({ lightingSetup: 'Backlight', timeWeather: '', atmosphere: '', colorMood: '' }),
    )

    copyRegisteredToolState(projectId, sourceNodeId, childNodeId, 'camera-control')

    assert.equal(values.has(getNodeSceneLightingKey(projectId, sourceNodeId)), false)
    assert.equal(values.has(getNodeSceneLightingKey(projectId, childNodeId)), false)
  })

  test('copies legacy Camera state without migrating the source node', () => {
    const values = installStorage()
    values.set(
      `creator-city:camera-settings:${projectId}`,
      JSON.stringify({ cameraBody: '', lens: '50mm', aperture: '', focus: '' }),
    )

    copyRegisteredToolState(projectId, sourceNodeId, childNodeId, 'camera-control')

    assert.equal(values.has(getNodeCameraSettingsKey(projectId, sourceNodeId)), false)
    assert.match(values.get(getNodeCameraSettingsKey(projectId, childNodeId)) ?? '', /50mm/)
  })

  test('copies legacy Lighting state without migrating the source node', () => {
    const values = installStorage()
    values.set(
      `creator-city:scene-lighting:${projectId}`,
      JSON.stringify({ lightingSetup: 'Backlight', timeWeather: '', atmosphere: '', colorMood: '' }),
    )

    copyRegisteredToolState(projectId, sourceNodeId, childNodeId, 'scene-lighting')

    assert.equal(values.has(getNodeSceneLightingKey(projectId, sourceNodeId)), false)
    assert.match(values.get(getNodeSceneLightingKey(projectId, childNodeId)) ?? '', /Backlight/)
  })

  test('delegates Camera legacy project-key migration to the existing storage helper', () => {
    const values = installStorage()
    values.set(
      `creator-city:camera-settings:${projectId}`,
      JSON.stringify({ cameraBody: '', lens: '50mm', aperture: '', focus: '' }),
    )

    assert.equal(loadRegisteredToolState(projectId, sourceNodeId).camera.lens, '50mm')
    assert.match(values.get(getNodeCameraSettingsKey(projectId, sourceNodeId)) ?? '', /50mm/)
  })

  test('returns Camera defaults when node storage contains malformed JSON', () => {
    const values = installStorage()
    values.set(getNodeCameraSettingsKey(projectId, childNodeId), '{broken')

    assert.deepEqual(
      loadRegisteredToolState(projectId, childNodeId).camera,
      getDefaultRegisteredToolState().camera,
    )
  })

  test('clones loaded fallback state before returning it to callers', () => {
    const values = installStorage()
    values.set(getNodeCameraSettingsKey(projectId, childNodeId), '{broken')

    const fallbackState = loadRegisteredToolState(projectId, childNodeId)
    fallbackState.camera.lens = '135mm'
    fallbackState.lighting.lightingSetup = 'Backlight'

    assert.equal(getDefaultRegisteredToolState().camera.lens, '')
    assert.equal(getDefaultRegisteredToolState().lighting.lightingSetup, '')
    assert.equal(loadRegisteredToolState(projectId, childNodeId).camera.lens, '')
    assert.equal(loadRegisteredToolState(projectId, childNodeId).lighting.lightingSetup, '')
  })
})
