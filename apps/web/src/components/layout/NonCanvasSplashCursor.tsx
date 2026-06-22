'use client'

import { usePathname } from 'next/navigation'
import { SplashCursor } from './SplashCursor'

const CANVAS_PATH_PREFIXES = ['/create', '/create-v2']
const SPLASH_COLORS = ['#ff2ea6', '#d56cff', '#7680ff', '#ff85d4']

export function NonCanvasSplashCursor() {
  const pathname = usePathname()
  const isCanvasSurface = CANVAS_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (isCanvasSurface) return null

  return (
    <SplashCursor
      densityDissipation={0.024}
      splatRadius={22}
      splatForce={0.16}
      colorUpdateSpeed={5}
      colors={SPLASH_COLORS}
    />
  )
}
