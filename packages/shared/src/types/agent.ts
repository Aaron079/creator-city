// ─── Agent ───────────────────────────────────────────────────────────────────
// Canonical source. agent.types.ts re-exports from here.

export type AgentRole =
  | 'SCRIPTWRITER'
  | 'DIRECTOR'
  | 'CINEMATOGRAPHER'
  | 'EDITOR'
  | 'COMPOSER'
  | 'VFX_ARTIST'
  | 'PRODUCER'
  | 'MARKETER'
  | 'RESEARCHER'

export type AgentStatus = 'IDLE' | 'WORKING' | 'RESTING' | 'UPGRADING' | 'UNAVAILABLE'

export type AgentTier = 'BASIC' | 'ADVANCED' | 'EXPERT' | 'LEGENDARY'

export interface AgentPersonality {
  creativity: number    // 0–100
  efficiency: number    // 0–100
  collaboration: number // 0–100
  ambition: number      // 0–100
}

export interface AgentSkill {
  name: string
  level: number
  maxLevel: number
  description: string
}

export interface AgentStats {
  tasksCompleted: number
  successRate: number       // 0–1
  avgCompletionTime: number // ms
  specializations: string[]
}

export interface Agent {
  id: string
  ownerId: string
  baseId: string
  name: string
  role: AgentRole
  tier: AgentTier
  status: AgentStatus
  level: number
  experience: number
  skills: AgentSkill[]
  personality: AgentPersonality
  currentTaskId?: string
  stats: AgentStats
  createdAt: Date
  updatedAt: Date
}
