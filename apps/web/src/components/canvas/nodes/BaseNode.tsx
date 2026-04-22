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
  const moveNode   = useCanvasStore((s) => s.moveNode)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const transform  = useCanvasStore((s) => s.transform)

  const dragRef    = useRef<{ startX: number; startY: number; nodeX: number; nodeY: number } | null>(null)
  const isDragging = useRef(false)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      if ((e.target as HTMLElement).closest('input, button, textarea')) return

      selectNode(id, e.metaKey || e.ctrlKey || e.shiftKey)
      isDragging.current = false

      dragRef.current = { startX: e.clientX, startY: e.clientY, nodeX: x, nodeY: y }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [id, x, y, selectNode],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      isDragging.current = true
      const dx = (e.clientX - dragRef.current.startX) / transform.scale
      const dy = (e.clientY - dragRef.current.startY) / transform.scale
      moveNode(id, dragRef.current.nodeX + dx, dragRef.current.nodeY + dy)
    },
    [id, moveNode, transform.scale],
  )

  const onPointerUp = useCallback(() => {
    dragRef.current    = null
    isDragging.current = false
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.82, y: 16 }}
      animate={{
        opacity: 1,
        scale:   1,
        y:       0,
      }}
      whileHover={{
        scale:     1.02,
        y:         -2,
        boxShadow: '0 0 20px rgba(99,102,241,0.22), 0 10px 32px rgba(0,0,0,0.5)',
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
      transition={{ duration: 0.5, delay: enterDelay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position:  'absolute',
        left:      x,
        top:       y,
        cursor:    'grab',
        userSelect: 'none',
        zIndex:    selected ? 10 : 1,
        animation: selected ? 'node-breathe 2.4s ease-in-out infinite' : undefined,
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
