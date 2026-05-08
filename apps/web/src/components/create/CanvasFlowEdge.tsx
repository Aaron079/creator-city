'use client'

import { EDGE_DIRECTOR_COLORS, type EdgeDirectorType } from '@/lib/canvas/edge-director'

interface CanvasFlowEdgeProps {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  active?: boolean
  directorType?: EdgeDirectorType
  onOpenDirector?: () => void
}

export function CanvasFlowEdge({
  id,
  x1,
  y1,
  x2,
  y2,
  active = false,
  directorType = 'default',
  onOpenDirector,
}: CanvasFlowEdgeProps) {
  const distanceX = Math.max(220, Math.abs(x2 - x1))
  const controlX1 = x1 + distanceX * 0.36
  const controlX2 = x2 - distanceX * 0.34
  const path = `M ${x1} ${y1} C ${controlX1} ${y1}, ${controlX2} ${y2}, ${x2} ${y2}`
  const gradientId = `canvas-edge-${id}`
  const colors = EDGE_DIRECTOR_COLORS[directorType] ?? EDGE_DIRECTOR_COLORS.default

  return (
    <svg className={`canvas-flow ${onOpenDirector ? 'is-interactive' : ''}`} aria-hidden={onOpenDirector ? undefined : true}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors.from} />
          <stop offset="50%" stopColor={active ? colors.mid : colors.mid.replace(/0\.\d+\)/, '0.34)')} />
          <stop offset="100%" stopColor={colors.to} />
        </linearGradient>
      </defs>
      {onOpenDirector ? (
        <path
          d={path}
          className="canvas-flow-hit"
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenDirector()
          }}
        />
      ) : null}
      <path
        d={path}
        className={`canvas-flow-path ${colors.dashed ? 'is-dashed' : ''}`}
        style={{ stroke: `url(#${gradientId})` }}
      />
      {active ? <path d={path} className="canvas-flow-path is-active" /> : null}
    </svg>
  )
}
