// ─── WebSocket Event Types ────────────────────────────────────────────────────

export type ServerToClientEvents = {
  // City events
  'city:update': (data: { baseId: string; changes: Record<string, unknown> }) => void
  'city:player-entered': (data: { userId: string; position: unknown }) => void
  'city:player-left': (data: { userId: string }) => void

  // Project events
  'project:updated': (data: { projectId: string; changes: Record<string, unknown> }) => void
  'project:collaborator-joined': (data: { projectId: string; userId: string }) => void
  'project:task-completed': (data: { projectId: string; taskId: string }) => void

  // Agent events
  'agent:task-started': (data: { agentId: string; taskId: string }) => void
  'agent:task-completed': (data: { agentId: string; taskId: string; output: unknown }) => void
  'agent:task-failed': (data: { agentId: string; taskId: string; error: string }) => void
  'agent:status-changed': (data: { agentId: string; status: string }) => void

  // Chat events
  'chat:message': (data: ChatMessage) => void
  'chat:typing': (data: { userId: string; channelId: string }) => void

  // Notification events
  'notification:new': (data: Notification) => void
}

export type ClientToServerEvents = {
  // City
  'city:move': (data: { position: unknown }) => void
  'city:interact': (data: { targetId: string; action: string }) => void

  // Project
  'project:join': (data: { projectId: string }) => void
  'project:leave': (data: { projectId: string }) => void

  // Chat
  'chat:send': (data: { channelId: string; content: string }) => void
  'chat:typing': (data: { channelId: string }) => void

  // Agent
  'agent:assign-task': (data: { agentId: string; taskType: string; input: unknown }) => void
}

export interface ChatMessage {
  id: string
  channelId: string
  senderId: string
  senderName: string
  content: string
  type: 'TEXT' | 'SYSTEM' | 'MEDIA'
  timestamp: Date
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  isRead: boolean
  createdAt: Date
}

export type NotificationType =
  | 'COLLAB_REQUEST'
  | 'PROJECT_UPDATE'
  | 'AGENT_COMPLETE'
  | 'REPUTATION_GAINED'
  | 'NEW_FOLLOWER'
  | 'MESSAGE'
  | 'SYSTEM'
