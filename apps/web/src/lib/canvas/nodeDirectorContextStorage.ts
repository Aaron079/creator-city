import { DEFAULT_CAMERA_SETTINGS, type CameraSettings } from '@/lib/canvas/cameraPromptContext'
import { DEFAULT_SCENE_LIGHTING, type SceneLightingSettings } from '@/lib/canvas/sceneLightingPromptContext'

// Per-node keys — include both projectId and nodeId so each node has isolated settings.
export function getNodeCameraSettingsKey(projectId: string, nodeId: string): string {
  return `creator-city:camera-settings:${projectId}:${nodeId}`
}

export function getNodeSceneLightingKey(projectId: string, nodeId: string): string {
  return `creator-city:scene-lighting:${projectId}:${nodeId}`
}

// Legacy project-level keys — read-only, used only for first-access lazy migration.
function legacyProjectCameraKey(projectId: string): string {
  return `creator-city:camera-settings:${projectId}`
}

function legacyProjectLightingKey(projectId: string): string {
  return `creator-city:scene-lighting:${projectId}`
}

/**
 * Load camera settings for a specific node.
 * On first access writes the legacy project-level value to the node key so subsequent
 * accesses are fast and isolated. Does not delete the legacy key (safe rollback).
 */
export function loadCameraSettingsForNode(projectId: string, nodeId: string): CameraSettings {
  if (typeof window === 'undefined') return DEFAULT_CAMERA_SETTINGS
  try {
    const nodeRaw = window.localStorage.getItem(getNodeCameraSettingsKey(projectId, nodeId))
    if (nodeRaw) return JSON.parse(nodeRaw) as CameraSettings
    // First access: migrate from legacy project key
    const legacyRaw = window.localStorage.getItem(legacyProjectCameraKey(projectId))
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as CameraSettings
      try { window.localStorage.setItem(getNodeCameraSettingsKey(projectId, nodeId), JSON.stringify(legacy)) } catch { /* storage full */ }
      return legacy
    }
  } catch { /* malformed JSON */ }
  return DEFAULT_CAMERA_SETTINGS
}

export function saveCameraSettingsForNode(projectId: string, nodeId: string, settings: CameraSettings): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(getNodeCameraSettingsKey(projectId, nodeId), JSON.stringify(settings)) } catch { /* storage full */ }
}

/**
 * Load scene lighting settings for a specific node.
 * Same lazy-migration strategy as loadCameraSettingsForNode.
 */
export function loadSceneLightingForNode(projectId: string, nodeId: string): SceneLightingSettings {
  if (typeof window === 'undefined') return DEFAULT_SCENE_LIGHTING
  try {
    const nodeRaw = window.localStorage.getItem(getNodeSceneLightingKey(projectId, nodeId))
    if (nodeRaw) return JSON.parse(nodeRaw) as SceneLightingSettings
    // First access: migrate from legacy project key
    const legacyRaw = window.localStorage.getItem(legacyProjectLightingKey(projectId))
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as SceneLightingSettings
      try { window.localStorage.setItem(getNodeSceneLightingKey(projectId, nodeId), JSON.stringify(legacy)) } catch { /* storage full */ }
      return legacy
    }
  } catch { /* malformed JSON */ }
  return DEFAULT_SCENE_LIGHTING
}

export function saveSceneLightingForNode(projectId: string, nodeId: string, settings: SceneLightingSettings): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(getNodeSceneLightingKey(projectId, nodeId), JSON.stringify(settings)) } catch { /* storage full */ }
}
