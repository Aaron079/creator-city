'use client'

import { CanvasNode } from '@/store/canvas.store'

interface Props {
  from: CanvasNode
  to:   CanvasNode
  id:   string
}

const NODE_W = 140
const NODE_H = 56

function edgeGradId(id: string) { return `eg-${id.replace(/\W/g, '')}` }
function edgeGlowId(id: string) { return `ef-${id.replace(/\W/g, '')}` }

export function FlowEdge({ from, to, id }: Props) {
  const x1 = from.x + NODE_W
  const y1 = from.y + NODE_H / 2
  const x2 = to.x
  const y2 = to.y + NODE_H / 2

  const dx  = Math.abs(x2 - x1) * 0.55
  const c1x = x1 + dx
  const c1y = y1
  const c2x = x2 - dx
  const c2y = y2

  const d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`

  const gradId = edgeGradId(id)
  const glowId = edgeGlowId(id)

  return (
    <g>
      <defs>
        {/* Blue → purple gradient along edge */}
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
          <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.6" />
          <stop offset="50%"  stopColor="#8b5cf6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.5" />
        </linearGradient>

        {/* Glow filter */}
        <filter id={glowId} x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Base ghost path */}
      <path
        d={d}
        fill="none"
        stroke="rgba(99,102,241,0.12)"
        strokeWidth={2}
      />

      {/* Glowing gradient base */}
      <path
        d={d}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={1.5}
        filter={`url(#${glowId})`}
      />

      {/* Animated flowing dash */}
      <path
        d={d}
        fill="none"
        stroke="rgba(167,139,250,0.9)"
        strokeWidth={1.5}
        strokeDasharray="5 14"
        strokeLinecap="round"
        filter={`url(#${glowId})`}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="19"
          to="0"
          dur="1s"
          repeatCount="indefinite"
        />
      </path>

      {/* Arrowhead glow dot */}
      <circle cx={x2} cy={y2} r={4} fill="rgba(139,92,246,0.15)" />
      <circle cx={x2} cy={y2} r={2.5} fill="rgba(167,139,250,0.95)" filter={`url(#${glowId})`} />
    </g>
  )
}
