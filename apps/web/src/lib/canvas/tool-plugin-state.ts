import {
  DEFAULT_CAMERA_SETTINGS,
  type CameraSettings,
} from './cameraPromptContext'
import {
  loadCameraSettingsForNode,
  loadSceneLightingForNode,
  readCameraSettingsForNodeWithoutMigration,
  readSceneLightingForNodeWithoutMigration,
  saveCameraSettingsForNode,
  saveSceneLightingForNode,
} from './nodeDirectorContextStorage'
import {
  DEFAULT_SCENE_LIGHTING,
  type SceneLightingSettings,
} from './sceneLightingPromptContext'

export type PromptBoosterSelection = Readonly<{
  suggestionId: string
  title: string
}>

export type PromptBoosterStateTarget = Readonly<{
  projectId: string | null | undefined
  nodeId: string | null | undefined
}>

export type RegisteredToolStatePluginId =
  | 'camera-control'
  | 'scene-lighting'
  | 'prompt-booster'

export interface RegisteredToolPluginState {
  camera: CameraSettings
  lighting: SceneLightingSettings
  promptBooster: PromptBoosterSelection | null
}

export type RegisteredToolStateValue<TPluginId extends RegisteredToolStatePluginId> =
  TPluginId extends 'camera-control'
    ? CameraSettings
    : TPluginId extends 'scene-lighting'
      ? SceneLightingSettings
      : PromptBoosterSelection

type RegisteredToolStateSaveArguments =
  | [pluginId: 'camera-control', value: CameraSettings]
  | [pluginId: 'scene-lighting', value: SceneLightingSettings]
  | [pluginId: 'prompt-booster', value: PromptBoosterSelection]

type ToolStateIdentity = string | null | undefined

export function getNodePromptBoosterKey(projectId: string, nodeId: string): string {
  return `creator-city:prompt-booster:${projectId}:${nodeId}`
}

function normalizePromptBoosterSelection(value: unknown): PromptBoosterSelection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const { suggestionId, title } = value as Record<string, unknown>
  if (typeof suggestionId !== 'string' || typeof title !== 'string') return null

  const normalizedSuggestionId = suggestionId.trim()
  const normalizedTitle = title.trim()
  if (!normalizedSuggestionId || !normalizedTitle) return null

  return {
    suggestionId: normalizedSuggestionId,
    title: normalizedTitle,
  }
}

function parsePromptBoosterSelection(raw: string | null): PromptBoosterSelection | null {
  if (!raw) return null

  try {
    return normalizePromptBoosterSelection(JSON.parse(raw))
  } catch {
    return null
  }
}

function readPromptBoosterSelectionForNode(
  projectId: string,
  nodeId: string,
): PromptBoosterSelection | null {
  if (typeof window === 'undefined') return null

  try {
    return parsePromptBoosterSelection(
      window.localStorage.getItem(getNodePromptBoosterKey(projectId, nodeId)),
    )
  } catch {
    return null
  }
}

function savePromptBoosterSelectionForNode(
  projectId: string,
  nodeId: string,
  value: PromptBoosterSelection,
): void {
  if (typeof window === 'undefined') return

  const selection = normalizePromptBoosterSelection(value)
  if (!selection) return

  try {
    window.localStorage.setItem(
      getNodePromptBoosterKey(projectId, nodeId),
      JSON.stringify(selection),
    )
  } catch {
    // Storage may be unavailable or full.
  }
}

export function getDefaultRegisteredToolState(): RegisteredToolPluginState {
  return {
    camera: { ...DEFAULT_CAMERA_SETTINGS },
    lighting: { ...DEFAULT_SCENE_LIGHTING },
    promptBooster: null,
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
    promptBooster: readPromptBoosterSelectionForNode(projectId, nodeId),
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
  pluginId: 'prompt-booster',
  value: PromptBoosterSelection,
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

  if (pluginId === 'prompt-booster') {
    savePromptBoosterSelectionForNode(projectId, nodeId, value)
    return
  }

  saveSceneLightingForNode(projectId, nodeId, value)
}

export function clearRegisteredToolStateValue(
  projectId: ToolStateIdentity,
  nodeId: ToolStateIdentity,
  pluginId: 'prompt-booster',
): void {
  if (!projectId || !nodeId || pluginId !== 'prompt-booster' || typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(getNodePromptBoosterKey(projectId, nodeId))
  } catch {
    // Storage may be unavailable.
  }
}

export function persistPromptBoosterSelectionForTarget(
  target: PromptBoosterStateTarget,
  selection: PromptBoosterSelection | null,
): void {
  const { projectId, nodeId } = target
  if (!projectId || !nodeId) return

  if (selection) {
    saveRegisteredToolStateValue(projectId, nodeId, 'prompt-booster', selection)
    return
  }

  clearRegisteredToolStateValue(projectId, nodeId, 'prompt-booster')
}

export function copyRegisteredToolState(
  projectId: ToolStateIdentity,
  sourceNodeId: ToolStateIdentity,
  targetNodeId: ToolStateIdentity,
  pluginId: RegisteredToolStatePluginId,
): void {
  if (!projectId || !sourceNodeId || !targetNodeId) return

  if (pluginId === 'camera-control') {
    const sourceCamera = readCameraSettingsForNodeWithoutMigration(projectId, sourceNodeId)
    saveCameraSettingsForNode(projectId, targetNodeId, { ...sourceCamera })
    return
  }

  if (pluginId === 'prompt-booster') {
    const sourceSelection = readPromptBoosterSelectionForNode(projectId, sourceNodeId)
    if (!sourceSelection) return

    savePromptBoosterSelectionForNode(projectId, targetNodeId, { ...sourceSelection })
    return
  }

  const sourceLighting = readSceneLightingForNodeWithoutMigration(projectId, sourceNodeId)
  saveSceneLightingForNode(projectId, targetNodeId, { ...sourceLighting })
}
