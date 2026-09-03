import {
  DEFAULT_CAMERA_SETTINGS,
  type CameraSettings,
} from './cameraPromptContext'
import {
  loadCameraSettingsForNode,
  loadSceneLightingForNode,
  saveCameraSettingsForNode,
  saveSceneLightingForNode,
} from './nodeDirectorContextStorage'
import {
  DEFAULT_SCENE_LIGHTING,
  type SceneLightingSettings,
} from './sceneLightingPromptContext'

export type RegisteredToolStatePluginId = 'camera-control' | 'scene-lighting'

export interface RegisteredToolPluginState {
  camera: CameraSettings
  lighting: SceneLightingSettings
}

export type RegisteredToolStateValue<TPluginId extends RegisteredToolStatePluginId> =
  TPluginId extends 'camera-control' ? CameraSettings : SceneLightingSettings

type ToolStateIdentity = string | null | undefined

export function getDefaultRegisteredToolState(): RegisteredToolPluginState {
  return {
    camera: { ...DEFAULT_CAMERA_SETTINGS },
    lighting: { ...DEFAULT_SCENE_LIGHTING },
  }
}

export function loadRegisteredToolState(
  projectId: ToolStateIdentity,
  nodeId: ToolStateIdentity,
): RegisteredToolPluginState {
  if (!projectId || !nodeId) return getDefaultRegisteredToolState()

  return {
    camera: loadCameraSettingsForNode(projectId, nodeId),
    lighting: loadSceneLightingForNode(projectId, nodeId),
  }
}

export function saveRegisteredToolStateValue<TPluginId extends RegisteredToolStatePluginId>(
  projectId: ToolStateIdentity,
  nodeId: ToolStateIdentity,
  pluginId: TPluginId,
  value: RegisteredToolStateValue<TPluginId>,
): void {
  if (!projectId || !nodeId) return

  if (pluginId === 'camera-control') {
    saveCameraSettingsForNode(projectId, nodeId, value as CameraSettings)
    return
  }

  saveSceneLightingForNode(projectId, nodeId, value as SceneLightingSettings)
}

export function copyRegisteredToolState(
  projectId: ToolStateIdentity,
  sourceNodeId: ToolStateIdentity,
  targetNodeId: ToolStateIdentity,
  pluginId: RegisteredToolStatePluginId,
): void {
  if (!projectId || !sourceNodeId || !targetNodeId) return

  const sourceState = loadRegisteredToolState(projectId, sourceNodeId)
  if (pluginId === 'camera-control') {
    saveCameraSettingsForNode(projectId, targetNodeId, { ...sourceState.camera })
    return
  }

  saveSceneLightingForNode(projectId, targetNodeId, { ...sourceState.lighting })
}
