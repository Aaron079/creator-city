'use client'

import { useCanvasStore } from '@/store/canvas.store'
import { FlowEdge } from './FlowEdge'

export function EdgeLayer() {
  const edges = useCanvasStore((s) => s.edges)
  const nodes = useCanvasStore((s) => s.nodes)

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ width: '100%', height: '100%' }}
    >
      {edges.map((e) => {
        const from = nodeMap.get(e.fromId)
        const to = nodeMap.get(e.toId)
        if (!from || !to) return null
        return <FlowEdge key={e.id} id={e.id} from={from} to={to} />
      })}
    </svg>
  )
}
