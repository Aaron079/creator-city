'use client'

interface CanvasFlowEdgeProps {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  active?: boolean
}

export function CanvasFlowEdge({ id, x1, y1, x2, y2, active = false }: CanvasFlowEdgeProps) {
  const midX = (x1 + x2) / 2
  const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
  const gradientId = `canvas-edge-${id}`

  return (
    <svg className="canvas-flow" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="50%" stopColor={active ? 'rgba(124,255,234,0.75)' : 'rgba(255,255,255,0.18)'} />
          <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
        </linearGradient>
      </defs>
      <path d={path} className="canvas-flow-path" style={{ stroke: `url(#${gradientId})` }} />
      {active ? <path d={path} className="canvas-flow-path is-active" /> : null}
    </svg>
  )
}
