export type AgentMessageRole = 'user' | 'assistant' | 'system'
export type AgentReplyMode = 'real' | 'local' | 'error'
export type AgentQuickActionId =
  | 'navigate:create'
  | 'navigate:projects'
  | 'navigate:community'
  | 'navigate:tools'
  | 'navigate:me'
  | 'navigate:client-delivery'
  | 'copy-current-link'
  | 'explain-current-page'
  | 'suggest-next-step'

export interface AgentMessage {
  id: string
  role: AgentMessageRole
  content: string
  createdAt: number
  mode?: AgentReplyMode
}

export interface AgentQuickAction {
  id: AgentQuickActionId
  label: string
  description: string
}

export interface AgentPageContext {
  pathname: string
  routeName: string
  pageSummary: string
  projectId?: string
  projectTitle?: string
  role?: string
  visibleActions: string[]
  toolAvailabilitySummary?: string
  suggestedQuestions: string[]
  quickActions: AgentQuickAction[]
}

export interface AgentChatRequest {
  messages: AgentMessage[]
  context: AgentPageContext
}

export interface AgentChatResponse {
  mode: AgentReplyMode
  configured: boolean
  message: string
  error?: string
}
