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
  const distanceX = Math.max(220, Math.abs(x2 - x1))
  const controlX1 = x1 + distanceX * 0.36
  const controlX2 = x2 - distanceX * 0.34
  const path = `M ${x1} ${y1} C ${controlX1} ${y1}, ${controlX2} ${y2}, ${x2} ${y2}`
  const gradientId = `canvas-edge-${id}`

  return (
    <svg className="canvas-flow" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
          <stop offset="50%" stopColor={active ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.18)'} />
          <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
        </linearGradient>
      </defs>
      <path d={path} className="canvas-flow-path" style={{ stroke: `url(#${gradientId})` }} />
      {active ? <path d={path} className="canvas-flow-path is-active" /> : null}
    </svg>
  )
}
