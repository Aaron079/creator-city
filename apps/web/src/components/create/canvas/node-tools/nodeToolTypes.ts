export type NodeToolCategory = 'prompt-direction' | 'image-edit' | 'analysis-preview'
export type NodeToolExecutionType = 'panel' | 'preview' | 'dialog'
export type NodeToolOutputKind =
  | 'configuration'
  | 'structured-text'
  | 'derived-image'
  | 'derived-video'
  | 'analysis'
  | 'preview'
  | 'generation'

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
  outputKind: NodeToolOutputKind
  outputLabel: string
  primaryActionLabel: string
  unavailableReason?: string
}
