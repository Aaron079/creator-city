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

type RegisteredToolStateSaveArguments =
  | [pluginId: 'camera-control', value: CameraSettings]
  | [pluginId: 'scene-lighting', value: SceneLightingSettings]

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
    camera: { ...loadCameraSettingsForNode(projectId, nodeId) },
    lighting: { ...loadSceneLightingForNode(projectId, nodeId) },
  }
}

export function saveRegisteredToolStateValue(
  projectId: ToolStateIdentity,
  nodeId: ToolStateIdentity,
  pluginId: 'camera-control',
  value: CameraSettings,
): void
export function saveRegisteredToolStateValue(
  projectId: ToolStateIdentity,
  nodeId: ToolStateIdentity,
  pluginId: 'scene-lighting',
  value: SceneLightingSettings,
): void
export function saveRegisteredToolStateValue(
  projectId: ToolStateIdentity,
  nodeId: ToolStateIdentity,
  ...[pluginId, value]: RegisteredToolStateSaveArguments
): void {
  if (!projectId || !nodeId) return

  if (pluginId === 'camera-control') {
    saveCameraSettingsForNode(projectId, nodeId, value)
    return
  }

  saveSceneLightingForNode(projectId, nodeId, value)
}

export function copyRegisteredToolState(
  projectId: ToolStateIdentity,
  sourceNodeId: ToolStateIdentity,
  targetNodeId: ToolStateIdentity,
  pluginId: RegisteredToolStatePluginId,
): void {
  if (!projectId || !sourceNodeId || !targetNodeId) return

  if (pluginId === 'camera-control') {
    const sourceCamera = loadCameraSettingsForNode(projectId, sourceNodeId)
    saveCameraSettingsForNode(projectId, targetNodeId, { ...sourceCamera })
    return
  }

  const sourceLighting = loadSceneLightingForNode(projectId, sourceNodeId)
  saveSceneLightingForNode(projectId, targetNodeId, { ...sourceLighting })
}
