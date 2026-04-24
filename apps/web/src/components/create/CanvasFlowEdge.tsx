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
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <path
        d={path}
        fill="none"
        stroke={active ? 'rgba(140,255,246,0.88)' : 'rgba(255,255,255,0.18)'}
        strokeWidth={active ? 1.8 : 1.2}
        strokeLinecap="round"
        strokeDasharray="7 12"
        style={{
          filter: active ? 'drop-shadow(0 0 10px rgba(0,255,255,0.2))' : 'none',
          animation: active ? 'createFlowPulse 2.6s linear infinite' : 'none',
        }}
      />
      <style jsx>{`
        @keyframes createFlowPulse {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -38; }
        }
      `}</style>
    </svg>
  )
}
