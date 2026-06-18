'use client'

import type { ReactNode } from 'react'
import canvasStyles from '@/components/create/canvas.module.css'

type Props = { children: ReactNode }

/**
 * Canvas Top Command Bar — scope wrapper for Shell's topCommand slot.
 *
 * Applies the canvas CSS scope so all .canvas-topbar-* rules apply correctly
 * even though the bar lives outside .canvas-root in the Shell layout.
 */
export function CanvasTopCommandBar({ children }: Props) {
  return <div className={canvasStyles.scope}>{children}</div>
}
