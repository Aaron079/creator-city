import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeKind = 'prompt' | 'agent' | 'output' | 'image' | 'final-edit'

export type AgentRole = '编剧' | '导演' | '演员' | '摄影' | '剪辑' | '音乐'

export type NodeStatus = 'idle' | 'pending' | 'running' | 'done' | 'error'

export interface CanvasNode {
  id: string
  kind: NodeKind
  x: number
  y: number
  // prompt / output text
  content?: string
  // agent-specific
  role?: AgentRole
  agentName?: string
  status?: NodeStatus
  progress?: number   // 0-100
  result?: string
  source?: 'mock' | 'real' | 'fallback-mock'
  // media
  imageUrl?: string
  videoUrl?: string
  // per-node skill params (model / resolution / lens etc.)
  params?: Record<string, unknown>
  selected?: boolean
  // ── Actor / Casting System ──────────────────────────────────────────────────
  characterName?: string
  personality?: string
  lookSummary?: string
  wardrobe?: string
  consistencyKey?: string
  // ── Camera / Cinematography System ─────────────────────────────────────────
  shotDescription?: string
  keyframePrompt?: string
  // ── Video / Motion System ───────────────────────────────────────────────────
  videoPrompt?: string
  // ── Final Edit / Timeline System ────────────────────────────────────────────
  timelineSummary?: string
  finalVideoUrl?: string
}

export interface CanvasEdge {
  id: string
  fromId: string
  toId: string
}

export interface Transform {
  x: number
  y: number
  scale: number
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface CanvasState {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  transform: Transform
  selectedIds: Set<string>
  isPanning: boolean
  prompt: string

  // Node actions
  setNodes: (nodes: CanvasNode[]) => void
  addNode: (node: CanvasNode) => void
  updateNode: (id: string, patch: Partial<CanvasNode>) => void
  removeNode: (id: string) => void
  moveNode: (id: string, x: number, y: number) => void

  // Edge actions
  addEdge: (edge: CanvasEdge) => void
  removeEdge: (id: string) => void

  // Selection
  selectNode: (id: string, multi?: boolean) => void
  clearSelection: () => void

  // Transform
  setTransform: (t: Transform) => void
  panBy: (dx: number, dy: number) => void
  zoomTo: (scale: number, cx: number, cy: number) => void

  // Pan state
  setPanning: (v: boolean) => void

  // Prompt
  setPrompt: (p: string) => void

  // Shot switching
  resetCanvas: (nodes: CanvasNode[], edges: CanvasEdge[]) => void
}

const MIN_SCALE = 0.15
const MAX_SCALE = 3

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  transform: { x: 0, y: 0, scale: 1 },
  selectedIds: new Set(),
  isPanning: false,
  prompt: '',

  setNodes: (nodes) => set({ nodes }),

  addNode: (node) =>
    set((s) => ({ nodes: [...s.nodes, node] })),

  updateNode: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.fromId !== id && e.toId !== id),
    })),

  moveNode: (id, x, y) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    })),

  addEdge: (edge) =>
    set((s) => ({ edges: [...s.edges, edge] })),

  removeEdge: (id) =>
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  selectNode: (id, multi = false) =>
    set((s) => {
      if (multi) {
        const next = new Set(s.selectedIds)
        next.has(id) ? next.delete(id) : next.add(id)
        return { selectedIds: next }
      }
      return { selectedIds: new Set([id]) }
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  setTransform: (transform) => set({ transform }),

  panBy: (dx, dy) =>
    set((s) => ({
      transform: {
        ...s.transform,
        x: s.transform.x + dx,
        y: s.transform.y + dy,
      },
    })),

  zoomTo: (scale, cx, cy) => {
    const { transform } = get()
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
    const ratio = clamped / transform.scale
    set({
      transform: {
        scale: clamped,
        x: cx - (cx - transform.x) * ratio,
        y: cy - (cy - transform.y) * ratio,
      },
    })
  },

  setPanning: (isPanning) => set({ isPanning }),

  setPrompt: (prompt) => set({ prompt }),

  resetCanvas: (nodes, edges) =>
    set({ nodes, edges, selectedIds: new Set() }),
}))
