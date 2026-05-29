/**
 * Global Provider Types
 *
 * Shared input/output shapes for all global (non-CN) AI providers.
 * Adapter-agnostic — usable by OpenAI, Gemini, Claude, DeepSeek global, etc.
 * Server-side only. Do not import from client components.
 */

export type GlobalTextAgentMode =
  | 'prompt_optimize'
  | 'storyboard'
  | 'asset_analysis'
  | 'generic'

export type GlobalTextAgentInput = {
  prompt: string
  systemPrompt?: string
  projectContext?: string
  nodeContext?: string
  mode?: GlobalTextAgentMode
}

export type GlobalTextAgentOutput = {
  text: string
  model: string
  providerId: string
  structuredJson?: unknown
  providerRaw?: unknown
}

export type GlobalImageMode = 'text-to-image' | 'image-to-image' | 'inpaint' | 'restyle'

export type GlobalImageInput = {
  prompt: string
  aspectRatio: string
  imageUrl?: string
  maskUrl?: string
  mode: GlobalImageMode
  projectId?: string
  nodeId?: string
}

export type GlobalImageOutput = {
  imageUrl?: string
  imageBase64?: string
  mimeType: string
  width?: number
  height?: number
  model: string
  providerId: string
  providerRaw?: unknown
}

export type GlobalVideoMode = 'text-to-video' | 'image-to-video'

export type GlobalVideoInput = {
  prompt: string
  imageUrl?: string
  duration: number
  aspectRatio: string
  resolution?: string
  mode: GlobalVideoMode
  projectId?: string
  nodeId?: string
}

export type GlobalVideoOutput = {
  videoUrl?: string
  taskId?: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  model: string
  providerId: string
  providerRaw?: unknown
}
