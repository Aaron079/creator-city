export type NodeToolCategory = 'prompt-direction' | 'image-edit' | 'analysis-preview'
export type NodeToolExecutionType = 'panel' | 'preview' | 'dialog'

export interface NodeToolEntry {
  id: string
  label: string
  icon: string
  description: string
  category: NodeToolCategory
  executionType: NodeToolExecutionType
  supportedKinds: string[]
  requiresMedia: boolean
  requiresAsset: boolean
  capabilityKey?: string
  available: boolean
  openActionId: string
}
