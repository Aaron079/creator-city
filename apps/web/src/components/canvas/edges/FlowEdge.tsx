'use client'

import { CanvasNode } from '@/store/canvas.store'

interface Props {
  from: CanvasNode
  to: CanvasNode
  id: string
}

// rough half-widths of node cards so the edge connects at the right/left edge
const NODE_W = 140
const NODE_H = 56

export function FlowEdge({ from, to, id }: Props) {
  const x1 = from.x + NODE_W
  const y1 = from.y + NODE_H / 2
  const x2 = to.x
  const y2 = to.y + NODE_H / 2

  const dx = Math.abs(x2 - x1) * 0.5
  const c1x = x1 + dx
  const c1y = y1
  const c2x = x2 - dx
  const c2y = y2

  const d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`
  const dashId = `dash-${id}`

  return (
    <g>
      {/* static dim path */}
      <path d={d} fill="none" stroke="rgba(99,102,241,0.20)" strokeWidth={1.5} />

      {/* animated flow dash */}
      <path
        d={d}
        fill="none"
        stroke="rgba(139,92,246,0.75)"
        strokeWidth={1.5}
        strokeDasharray="6 12"
        strokeLinecap="round"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="18"
          to="0"
          dur="1.2s"
          repeatCount="indefinite"
        />
      </path>

      {/* arrowhead */}
      <circle cx={x2} cy={y2} r={3} fill="rgba(139,92,246,0.85)" />
    </g>
  )
}
