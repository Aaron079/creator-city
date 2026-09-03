import type { CameraSettings } from './cameraPromptContext'
import {
  appendCameraContextToPrompt,
  buildCameraPromptContext,
  buildCameraSummaryText,
} from './cameraPromptContext'
import type { SceneLightingSettings } from './sceneLightingPromptContext'
import {
  appendSceneLightingContextToPrompt,
  buildSceneLightingPromptContext,
  buildLightingSummaryText,
} from './sceneLightingPromptContext'

export type CanvasToolPluginNodeKind = 'image' | 'video' | 'text'

export interface RegisteredToolContribution {
  id: string
  promptContext: string
  summary: string
}

export interface RegisteredToolContext {
  nodeKind: CanvasToolPluginNodeKind
  camera: CameraSettings
  lighting: SceneLightingSettings
}

export interface CanvasToolPlugin {
  id: string
  label: string
  labelZh: string
  supportedNodeKinds: readonly CanvasToolPluginNodeKind[]
  contribute(context: RegisteredToolContext): RegisteredToolContribution | null
}

const CAMERA_CONTROL_SUPPORTED_NODE_KINDS: readonly CanvasToolPluginNodeKind[] = ['image', 'video']
const SCENE_LIGHTING_SUPPORTED_NODE_KINDS: readonly CanvasToolPluginNodeKind[] = ['image', 'video']

function createCameraContribution(context: RegisteredToolContext): RegisteredToolContribution | null {
  if (!CAMERA_CONTROL_SUPPORTED_NODE_KINDS.includes(context.nodeKind)) return null

  const promptContext = buildCameraPromptContext(context.camera)
  if (!promptContext.trim()) return null

  return {
    id: 'camera-control',
    promptContext,
    summary: buildCameraSummaryText(context.camera),
  }
}

function createLightingContribution(context: RegisteredToolContext): RegisteredToolContribution | null {
  if (!SCENE_LIGHTING_SUPPORTED_NODE_KINDS.includes(context.nodeKind)) return null

  const promptContext = buildSceneLightingPromptContext(context.lighting)
  if (!promptContext.trim()) return null

  return {
    id: 'scene-lighting',
    promptContext,
    summary: buildLightingSummaryText(context.lighting),
  }
}

export const CAMERA_LIGHTING_TOOL_PLUGINS: readonly CanvasToolPlugin[] = [
  {
    id: 'camera-control',
    label: 'Camera Control',
    labelZh: '摄影机控制',
    supportedNodeKinds: CAMERA_CONTROL_SUPPORTED_NODE_KINDS,
    contribute: createCameraContribution,
  },
  {
    id: 'scene-lighting',
    label: 'Scene Lighting',
    labelZh: '场景光线',
    supportedNodeKinds: SCENE_LIGHTING_SUPPORTED_NODE_KINDS,
    contribute: createLightingContribution,
  },
]

export function resolveRegisteredToolContributions(context: RegisteredToolContext): RegisteredToolContribution[] {
  const contributions: RegisteredToolContribution[] = []

  for (const plugin of CAMERA_LIGHTING_TOOL_PLUGINS) {
    if (!plugin.supportedNodeKinds.includes(context.nodeKind)) continue

    const contribution = plugin.contribute(context)
    if (contribution && contribution.promptContext.trim()) {
      contributions.push(contribution)
    }
  }

  return contributions
}

export function composeRegisteredToolPrompt(basePrompt: string, context: RegisteredToolContext): string {
  let prompt = basePrompt

  for (const contribution of resolveRegisteredToolContributions(context)) {
    prompt =
      contribution.id === 'camera-control'
        ? appendCameraContextToPrompt(prompt, contribution.promptContext)
        : appendSceneLightingContextToPrompt(prompt, contribution.promptContext)
  }

  return prompt
}
