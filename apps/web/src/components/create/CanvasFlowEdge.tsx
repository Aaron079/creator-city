'use client'

import { useState } from 'react'
import { EDGE_DIRECTOR_COLORS, type EdgeDirectorType } from '@/lib/canvas/edge-director'

interface CanvasFlowEdgeProps {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  active?: boolean
  directorType?: EdgeDirectorType
  label?: string
  toolIcon?: string
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
  label,
  toolIcon,
  onOpenDirector,
}: CanvasFlowEdgeProps) {
  const [hovered, setHovered] = useState(false)
  const distanceX = Math.max(220, Math.abs(x2 - x1))
  const controlX1 = x1 + distanceX * 0.36
  const controlX2 = x2 - distanceX * 0.34
  const path = `M ${x1} ${y1} C ${controlX1} ${y1}, ${controlX2} ${y2}, ${x2} ${y2}`
  const gradientId = `canvas-edge-grad-${id}`
  const markerId = `canvas-edge-arrow-${id}`
  const colors = EDGE_DIRECTOR_COLORS[directorType] ?? EDGE_DIRECTOR_COLORS.default

  const arrowFill = active ? 'rgba(134,255,236,0.75)' : colors.mid
  const arrowOpacity = active ? 0.9 : hovered ? 0.72 : 0.42

  return (
    <svg
      className={`canvas-flow ${onOpenDirector ? 'is-interactive' : ''}`}
      aria-hidden={onOpenDirector ? undefined : true}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors.from} />
          <stop offset="50%" stopColor={active || hovered ? colors.mid : colors.mid.replace(/0\.\d+\)/, '0.38)')} />
          <stop offset="100%" stopColor={colors.to} />
        </linearGradient>
        {/* Arrowhead marker — orient="auto" aligns with path tangent at endpoint */}
        <marker
          id={markerId}
          markerWidth="6"
          markerHeight="5"
          refX="5"
          refY="2.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0,0 6,2.5 0,5" fill={arrowFill} opacity={arrowOpacity} />
        </marker>
      </defs>
      {/* Hit area — always present for hover/click; covers a wide stroke for easy interaction */}
      <path
        d={path}
        className="canvas-flow-hit"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onPointerDown={(event) => {
          if (!onOpenDirector) return
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => {
          if (!onOpenDirector) return
          event.preventDefault()
          event.stopPropagation()
          onOpenDirector()
        }}
        style={onOpenDirector ? undefined : { cursor: 'default' }}
      />
      {/* Visual path */}
      <path
        d={path}
        className={`canvas-flow-path ${colors.dashed ? 'is-dashed' : ''} ${hovered && !active ? 'is-hover' : ''}`}
        style={{ stroke: `url(#${gradientId})` }}
        markerEnd={`url(#${markerId})`}
      />
      {/* Active glow overlay */}
      {active ? (
        <path d={path} className="canvas-flow-path is-active" markerEnd={`url(#${markerId})`} />
      ) : null}

      {/* Derived tool label — midpoint of bezier, pointer-events:none so it never blocks edge clicks */}
      {label ? (() => {
        const lx = (x1 + x2) / 2
        const ly = (y1 + y2) / 2
        const displayText = toolIcon ? `${toolIcon} ${label}` : label
        const lw = Math.max(52, displayText.length * 7.5 + 16)
        return (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={lx - lw / 2} y={ly - 10} width={lw} height={20} rx={10} fill="rgba(10,12,18,0.92)" stroke="rgba(167,139,250,0.28)" strokeWidth={0.8} />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize={9.5} fill="rgba(221,214,254,0.80)" fontFamily="system-ui,-apple-system,sans-serif" fontWeight="600" letterSpacing="0.01em">
              {displayText}
            </text>
          </g>
        )
      })() : null}
    </svg>
  )
}
