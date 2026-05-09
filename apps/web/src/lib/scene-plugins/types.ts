export type ScenePluginId =
  | 'scene-replace'
  | 'scene-preserve'
  | 'scene-remove'
  | 'scene-weather-time'
  | 'scene-space-structure'

export type ScenePluginRegion = {
  x: number
  y: number
  width: number
  height: number
}

export type ScenePluginRun = {
  id: string
  pluginId: ScenePluginId
  sourceNodeId: string
  sourceImageUrl?: string
  targetNodeId?: string
  region: ScenePluginRegion
  targetDescription?: string
  preserveInstruction?: string
  negativeInstruction?: string
  styleInheritance?: 'low' | 'medium' | 'high'
  prompt?: string
  resultImageUrl?: string
  pluginProvider?: string
  pluginResult?: unknown
  status: 'draft' | 'applied' | 'done'
  createdAt: string
  updatedAt?: string
}

export type SceneReplaceSourceNode = {
  id: string
  title?: string
  prompt?: string
  resultImageUrl?: string
}
