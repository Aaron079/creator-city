'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useCanvasStore } from '@/store/canvas.store'
import { CanvasGrid } from './CanvasGrid'
import { EdgeLayer } from './edges/EdgeLayer'
import { AgentNode } from './nodes/AgentNode'
import { PromptNode } from './nodes/PromptNode'
import { OutputNode } from './nodes/OutputNode'
import { ImageNode } from './nodes/ImageNode'
import { CanvasToolbar } from './controls/CanvasToolbar'

export function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const transform = useCanvasStore((s) => s.transform)
  const nodes = useCanvasStore((s) => s.nodes)
  const clearSelection = useCanvasStore((s) => s.clearSelection)
  const isPanning = useCanvasStore((s) => s.isPanning)
  const setPanning = useCanvasStore((s) => s.setPanning)

  // ── Spacebar pan ────────────────────────────────────────────────────────────
  const spaceHeld = useRef(false)
  const lastPointer = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        spaceHeld.current = true
        setPanning(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false
        setPanning(false)
        lastPointer.current = null
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [setPanning])

  // ── Mouse wheel zoom ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { zoomTo } = useCanvasStore.getState()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const delta = e.deltaY < 0 ? 1.08 : 0.93
      zoomTo(useCanvasStore.getState().transform.scale * delta, cx, cy)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Pointer events for spacebar-pan ──────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (spaceHeld.current || e.button === 1) {
      lastPointer.current = { x: e.clientX, y: e.clientY }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!lastPointer.current) return
    const dx = e.clientX - lastPointer.current.x
    const dy = e.clientY - lastPointer.current.y
    lastPointer.current = { x: e.clientX, y: e.clientY }
    useCanvasStore.getState().panBy(dx, dy)
  }, [])

  const onPointerUp = useCallback(() => {
    if (!spaceHeld.current) {
      lastPointer.current = null
    } else {
      lastPointer.current = null
    }
  }, [])

  const onCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) clearSelection()
  }, [clearSelection])

  const { x, y, scale } = transform

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#070b14]"
      style={{ cursor: isPanning ? 'grab' : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onCanvasClick}
    >
      {/* Grid background — fixed to container */}
      <CanvasGrid />

      {/* Transformed canvas world */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Bezier edges (below nodes) */}
        <EdgeLayer />

        {/* Nodes */}
        {nodes.map((node, i) => {
          const delay = i * 0.06
          switch (node.kind) {
            case 'prompt':
              return <PromptNode key={node.id} id={node.id} enterDelay={delay} />
            case 'agent':
              return <AgentNode key={node.id} id={node.id} enterDelay={delay} />
            case 'output':
              return <OutputNode key={node.id} id={node.id} enterDelay={delay} />
            case 'image':
              return <ImageNode key={node.id} id={node.id} enterDelay={delay} />
            default:
              return null
          }
        })}
      </div>

      {/* HUD controls (not transformed) */}
      <CanvasToolbar />

      {/* Hint */}
      <div className="absolute bottom-6 left-6 text-[10px] text-gray-700 select-none pointer-events-none">
        滚轮缩放 · 空格+拖拽平移 · 点击节点选中
      </div>
    </div>
  )
}
