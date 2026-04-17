'use client'

import { useCanvasStore } from '@/store/canvas.store'

export function CanvasToolbar() {
  const transform = useCanvasStore((s) => s.transform)
  const zoomTo = useCanvasStore((s) => s.zoomTo)
  const setTransform = useCanvasStore((s) => s.setTransform)

  const cx = typeof window !== 'undefined' ? window.innerWidth / 2 : 400
  const cy = typeof window !== 'undefined' ? window.innerHeight / 2 : 300

  const zoomIn = () => zoomTo(transform.scale * 1.25, cx, cy)
  const zoomOut = () => zoomTo(transform.scale / 1.25, cx, cy)
  const resetView = () => setTransform({ x: 80, y: 80, scale: 1 })

  const pct = Math.round(transform.scale * 100)

  return (
    <div className="absolute bottom-6 right-6 flex items-center gap-1 px-1 py-1 rounded-xl border border-white/[0.08] bg-[#0a0f1a]/90 backdrop-blur-xl shadow-xl">
      <button
        onClick={zoomOut}
        className="w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.07] transition-colors flex items-center justify-center text-sm font-bold"
        title="缩小"
      >
        −
      </button>

      <button
        onClick={resetView}
        className="px-3 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.07] transition-colors text-xs font-medium tabular-nums min-w-[3.5rem]"
        title="重置视角"
      >
        {pct}%
      </button>

      <button
        onClick={zoomIn}
        className="w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.07] transition-colors flex items-center justify-center text-sm font-bold"
        title="放大"
      >
        +
      </button>

      <div className="w-[0.5px] h-4 bg-white/[0.1] mx-0.5" />

      <button
        onClick={resetView}
        className="w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.07] transition-colors flex items-center justify-center"
        title="适应视图"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
          <rect x="9" y="1" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
          <rect x="1" y="9" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
          <rect x="9" y="9" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
      </button>
    </div>
  )
}
