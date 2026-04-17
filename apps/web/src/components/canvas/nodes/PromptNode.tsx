'use client'

import { useRef } from 'react'
import { useCanvasStore } from '@/store/canvas.store'
import { BaseNode } from './BaseNode'

interface Props {
  id: string
  enterDelay?: number
}

export function PromptNode({ id, enterDelay }: Props) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === id))
  const updateNode = useCanvasStore((s) => s.updateNode)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  if (!node || node.kind !== 'prompt') return null

  const selected = selectedIds.has(id)

  return (
    <BaseNode id={id} x={node.x} y={node.y} selected={selected} enterDelay={enterDelay}>
      <div
        className="relative w-[320px] rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,15,26,0.80)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '0.5px solid rgba(99,102,241,0.35)',
          boxShadow: selected
            ? '0 0 0 1px rgba(99,102,241,0.6), 0 8px 32px rgba(99,102,241,0.3)'
            : '0 4px 24px rgba(0,0,0,0.5)',
        }}
      >
        {/* top accent */}
        <div className="h-[1.5px] w-full bg-gradient-to-r from-indigo-500 to-violet-500 opacity-80" />

        <div className="px-4 py-3.5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm bg-indigo-500/15 border border-indigo-400/30">
              💡
            </div>
            <span className="text-xs font-semibold text-indigo-300">创作灵感</span>
          </div>

          <textarea
            ref={textareaRef}
            value={node.content ?? ''}
            placeholder="输入你的故事创意…"
            rows={3}
            className="w-full bg-transparent text-sm text-white/90 placeholder-gray-600 resize-none outline-none leading-6 cursor-text"
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => updateNode(id, { content: e.target.value })}
          />
        </div>
      </div>
    </BaseNode>
  )
}
