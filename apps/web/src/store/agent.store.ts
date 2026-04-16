import { create } from 'zustand'

export interface Agent {
  id: string
  ownerId: string
  baseId: string
  name: string
  role: string
  tier: string
  status: string
  level: number
  experience: number
  personality: {
    creativity: number
    efficiency: number
    collaboration: number
    ambition: number
  }
  tasks?: AgentTask[]
}

export interface AgentTask {
  id: string
  agentId: string
  projectId: string
  type: string
  status: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
  startedAt?: string
  completedAt?: string
  estimatedDurationMs: number
}

interface AgentState {
  agents: Agent[]
  selectedAgentId: string | null
  isLoading: boolean
  setAgents: (agents: Agent[]) => void
  addAgent: (agent: Agent) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  selectAgent: (id: string | null) => void
  setLoading: (loading: boolean) => void
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  selectedAgentId: null,
  isLoading: false,

  setAgents: (agents) => set({ agents }),
  addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  selectAgent: (selectedAgentId) => set({ selectedAgentId }),
  setLoading: (isLoading) => set({ isLoading }),
}))
