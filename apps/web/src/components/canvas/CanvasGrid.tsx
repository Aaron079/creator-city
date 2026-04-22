'use client'

import { useCanvasStore } from '@/store/canvas.store'

const SPACING = 40
const MAJOR   = 4   // every 4th line is slightly brighter

export function CanvasGrid() {
  const transform = useCanvasStore((s) => s.transform)
  const { x, y, scale } = transform

  const spacing = SPACING * scale
  const ox = ((x % spacing) + spacing) % spacing
  const oy = ((y % spacing) + spacing) % spacing

  // fade grid when too zoomed out
  const baseOpacity = Math.min(0.55, Math.max(0.08, scale * 0.55))

  const maskId = 'grid-radial-mask'

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
      aria-hidden
    >
      <defs>
        {/* Radial mask: bright center, fade to edges */}
        <radialGradient id={maskId} cx="50%" cy="45%" r="60%" gradientUnits="userSpaceOnUse"
          fx="50%" fy="45%"
          gradientTransform="scale(1.6 1)" x1="0" y1="0" x2="100%" y2="100%"
        >
          <stop offset="0%"   stopColor="white" stopOpacity="1"   />
          <stop offset="55%"  stopColor="white" stopOpacity="0.5" />
          <stop offset="100%" stopColor="white" stopOpacity="0"   />
        </radialGradient>
        <mask id="fade-mask">
          <rect width="100%" height="100%" fill={`url(#${maskId})`} />
        </mask>

        {/* Minor grid line */}
        <pattern
          id="minor-grid"
          x={ox} y={oy}
          width={spacing} height={spacing}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${spacing} 0 L 0 0 0 ${spacing}`}
            fill="none"
            stroke={`rgba(148,163,184,${baseOpacity * 0.55})`}
            strokeWidth="0.5"
          />
        </pattern>

        {/* Major grid line (every MAJOR cells) */}
        <pattern
          id="major-grid"
          x={ox} y={oy}
          width={spacing * MAJOR} height={spacing * MAJOR}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${spacing * MAJOR} 0 L 0 0 0 ${spacing * MAJOR}`}
            fill="none"
            stroke={`rgba(99,120,180,${baseOpacity * 0.85})`}
            strokeWidth="0.75"
          />
        </pattern>
      </defs>

      <g mask="url(#fade-mask)">
        <rect width="100%" height="100%" fill="url(#minor-grid)" />
        <rect width="100%" height="100%" fill="url(#major-grid)" />
      </g>
    </svg>
  )
}
