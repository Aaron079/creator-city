'use client'

import { useEffect, useRef } from 'react'
import { useCanvasStore, CanvasNode, CanvasEdge } from '@/store/canvas.store'

// Default node positions for a cinematic left-to-right crew layout
const DEFAULT_NODES: CanvasNode[] = [
  {
    id: 'prompt-1',
    kind: 'prompt',
    x: 60,
    y: 240,
    content: '',
  },
  {
    id: 'agent-writer',
    kind: 'agent',
    x: 460,
    y: 80,
    role: '编剧',
    agentName: '商业编剧 PRO',
    status: 'idle',
    progress: 0,
  },
  {
    id: 'agent-director',
    kind: 'agent',
    x: 460,
    y: 240,
    role: '导演',
    agentName: '情绪导演',
    status: 'idle',
    progress: 0,
  },
  {
    id: 'agent-actor',
    kind: 'agent',
    x: 460,
    y: 400,
    role: '演员',
    agentName: '气质选角师',
    status: 'idle',
    progress: 0,
  },
  {
    id: 'agent-dop',
    kind: 'agent',
    x: 840,
    y: 160,
    role: '摄影',
    agentName: '电影摄影师',
    status: 'idle',
    progress: 0,
  },
  {
    id: 'agent-editor',
    kind: 'agent',
    x: 840,
    y: 320,
    role: '剪辑',
    agentName: '节奏剪辑',
    status: 'idle',
    progress: 0,
  },
  {
    id: 'output-1',
    kind: 'output',
    x: 1220,
    y: 220,
    content: '',
  },
]

const DEFAULT_EDGES: CanvasEdge[] = [
  { id: 'e-p-w', fromId: 'prompt-1',     toId: 'agent-writer'   },
  { id: 'e-p-d', fromId: 'prompt-1',     toId: 'agent-director' },
  { id: 'e-p-a', fromId: 'prompt-1',     toId: 'agent-actor'    },
  { id: 'e-w-dop',fromId: 'agent-writer',  toId: 'agent-dop'    },
  { id: 'e-d-ed', fromId: 'agent-director',toId: 'agent-editor' },
  { id: 'e-dop-o',fromId: 'agent-dop',    toId: 'output-1'      },
  { id: 'e-ed-o', fromId: 'agent-editor', toId: 'output-1'      },
]

interface Props {
  initialPrompt?: string
  children?: React.ReactNode
}

export function CanvasProvider({ initialPrompt, children }: Props) {
  const initialized = useRef(false)
  const setNodes = useCanvasStore((s) => s.setNodes)
  const addEdge = useCanvasStore((s) => s.addEdge)
  const setTransform = useCanvasStore((s) => s.setTransform)
  const updateNode = useCanvasStore((s) => s.updateNode)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Load default crew into the canvas
    setNodes(DEFAULT_NODES)
    DEFAULT_EDGES.forEach((e) => addEdge(e))

    // If an initial prompt was provided (e.g., from the URL), prefill it
    if (initialPrompt) {
      updateNode('prompt-1', { content: initialPrompt })
    }

    // Start slightly zoomed out so all nodes are visible
    setTransform({ x: 40, y: 60, scale: 0.9 })
  }, [setNodes, addEdge, setTransform, updateNode, initialPrompt])

  return <>{children}</>
}
