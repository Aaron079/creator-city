export type CreatorModelMessageRole = 'system' | 'user' | 'assistant'
export type CreatorModelMode = 'local' | 'remote' | 'error'

export interface CreatorModelMessage {
  role: CreatorModelMessageRole
  content: string
}

export interface CreatorModelContext {
  pathname: string
  routeName: string
  pageSummary: string
  projectId?: string
  projectTitle?: string
  userRole?: string
  toolStatusSummary?: string
  canvasStateSummary?: string
}

export interface CreatorModelOptions {
  temperature?: number
  maxTokens?: number
}

export interface CreatorModelRequest {
  messages: CreatorModelMessage[]
  context?: CreatorModelContext
  options?: CreatorModelOptions
}

export interface CreatorModelUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface CreatorModelResponse {
  id: string
  createdAt: string
  mode: CreatorModelMode
  provider: 'creator-city'
  model: string
  configured: boolean
  content: string
  actions?: unknown[]
  usage?: CreatorModelUsage
  error?: string
}
