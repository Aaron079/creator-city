'use client'

import { useCanvasStore } from '@/store/canvas.store'

const DOT_SPACING = 32
const DOT_RADIUS = 1

export function CanvasGrid() {
  const transform = useCanvasStore((s) => s.transform)
  const { x, y, scale } = transform

  const spacing = DOT_SPACING * scale
  // offset so the grid scrolls with the canvas
  const ox = ((x % spacing) + spacing) % spacing
  const oy = ((y % spacing) + spacing) % spacing

  // fade dots when zoomed out
  const opacity = Math.min(1, Math.max(0.15, scale * 0.8))

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
      aria-hidden
    >
      <defs>
        <pattern
          id="canvas-dot-pattern"
          x={ox}
          y={oy}
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={DOT_RADIUS}
            cy={DOT_RADIUS}
            r={DOT_RADIUS * Math.min(1, scale)}
            fill={`rgba(148,163,184,${opacity})`}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#canvas-dot-pattern)" />
    </svg>
  )
}
