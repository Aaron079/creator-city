import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import {
  copyRegisteredToolState,
  getDefaultRegisteredToolState,
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

function installStorage(): Map<string, string> {
  const values = new Map<string, string>()
  originalWindowDescriptor ??= Object.getOwnPropertyDescriptor(globalThis, 'window')
  windowOverrideInstalled = true

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
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
