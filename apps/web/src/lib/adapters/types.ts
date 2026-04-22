export type ToolAdapterCategory =
  | 'audio'
  | 'lip-sync'
  | 'timeline'
  | 'storyboard'
  | 'environment'
  | 'finishing'

export type ToolAdapterProviderType = 'api' | 'export' | 'import' | 'bridge'
export type ToolAdapterStatus = 'available' | 'experimental' | 'bridge-only'

export type ToolAdapterCapability =
  | 'voice'
  | 'music'
  | 'sfx'
  | 'dubbing'
  | 'transcription'
  | 'lipsync'
  | 'timeline-export'
  | 'timeline-import'
  | 'storyboard-export'
  | 'storyboard-import'
  | 'environment-export'
  | 'finishing-export'

export type ToolAdapterTargetPanel =
  | 'audio-desk'
  | 'storyboard-previs'
  | 'editor-desk'
  | 'delivery'
  | 'scene-panel'
  | 'color-panel'

export interface ToolAdapter {
  id: string
  name: string
  category: ToolAdapterCategory
  providerType: ToolAdapterProviderType
  status: ToolAdapterStatus
  supports: ToolAdapterCapability[]
  targetPanels: ToolAdapterTargetPanel[]
}

