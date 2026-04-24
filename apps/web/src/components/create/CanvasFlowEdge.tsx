'use client'

interface CanvasFlowEdgeProps {
  x1: number
  y1: number
  x2: number
  y2: number
  active?: boolean
}

export function CanvasFlowEdge({ x1, y1, x2, y2, active = false }: CanvasFlowEdgeProps) {
  const midX = (x1 + x2) / 2
  const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`

  return (
    <svg className="canvas-flow">
      <path d={path} className={`canvas-flow-path ${active ? 'is-active' : ''}`} />
    </svg>
  )
}
