'use client'

import { useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useCanvasStore } from '@/store/canvas.store'

interface Props {
  id: string
  x: number
  y: number
  selected?: boolean
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  enterDelay?: number
}

export function BaseNode({ id, x, y, selected, children, className = '', style, enterDelay = 0 }: Props) {
  const moveNode = useCanvasStore((s) => s.moveNode)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const transform = useCanvasStore((s) => s.transform)

  // Track pointer-down position for drag
  const dragRef = useRef<{ startX: number; startY: number; nodeX: number; nodeY: number } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      // Don't drag when clicking inputs/buttons
      if ((e.target as HTMLElement).closest('input, button, textarea')) return

      selectNode(id, e.metaKey || e.ctrlKey || e.shiftKey)

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        nodeX: x,
        nodeY: y,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [id, x, y, selectNode],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      const dx = (e.clientX - dragRef.current.startX) / transform.scale
      const dy = (e.clientY - dragRef.current.startY) / transform.scale
      moveNode(id, dragRef.current.nodeX + dx, dragRef.current.nodeY + dy)
    },
    [id, moveNode, transform.scale],
  )

  const onPointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, delay: enterDelay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        cursor: 'grab',
        userSelect: 'none',
        ...style,
      }}
      className={`${className} ${selected ? 'ring-1 ring-indigo-400/60' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
    </motion.div>
  )
}
