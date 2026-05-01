export type ProviderCategory =
  | 'text'
  | 'script'
  | 'image'
  | 'image-to-video'
  | 'text-to-video'
  | 'video-edit'
  | 'voice'
  | 'dubbing'
  | 'audio-cleanup'
  | 'music'
  | 'world'
  | 'delivery'
  | 'agent'

export type ProviderStatus =
  | 'available'
  | 'not-configured'
  | 'mock'
  | 'bridge-only'
  | 'coming-soon'
  | 'error'

export type ProviderRuntimeMode = 'real' | 'mock' | 'bridge' | 'unavailable'

export type GenerateNodeType = 'text' | 'image' | 'video' | 'audio' | 'music'

export type GenerateJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'not-configured'

export interface GenerateRequest {
  providerId: string
  nodeType: GenerateNodeType
  prompt: string
  inputAssets?: Array<{ id: string; type: string; url?: string }>
  params?: Record<string, string | number | boolean | undefined>
  projectId?: string
  nodeId?: string
}

export interface GenerateResult {
  text?: string
  imageUrl?: string
  videoUrl?: string
  audioUrl?: string
  musicUrl?: string
  previewUrl?: string
  metadata?: Record<string, unknown>
}

export interface GenerateResponse {
  success: boolean
  providerId: string
  mode: ProviderRuntimeMode
  jobId?: string
  status: GenerateJobStatus
  result?: GenerateResult
  message: string
  errorCode?: string
  billingJobId?: string
}

export interface ProviderAdapter {
  id: string
  testConnection(): Promise<{ ok: boolean; message: string }>
  generateText?(request: GenerateRequest): Promise<GenerateResponse>
  generateImage?(request: GenerateRequest): Promise<GenerateResponse>
  generateVideo?(request: GenerateRequest): Promise<GenerateResponse>
  generateAudio?(request: GenerateRequest): Promise<GenerateResponse>
  generateMusic?(request: GenerateRequest): Promise<GenerateResponse>
  getJob?(jobId: string): Promise<GenerateResponse>
  cancelJob?(jobId: string): Promise<void>
}
