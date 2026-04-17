'use client'

import { useCanvasStore } from '@/store/canvas.store'
import { BaseNode } from './BaseNode'

interface Props {
  id: string
  enterDelay?: number
}

export function OutputNode({ id, enterDelay }: Props) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === id))
  const selectedIds = useCanvasStore((s) => s.selectedIds)

  if (!node || node.kind !== 'output') return null

  const selected = selectedIds.has(id)
  const hasContent = !!node.content

  return (
    <BaseNode id={id} x={node.x} y={node.y} selected={selected} enterDelay={enterDelay}>
      <div
        className="relative w-[300px] rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,15,26,0.80)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '0.5px solid rgba(52,211,153,0.25)',
          boxShadow: selected
            ? '0 0 0 1px rgba(52,211,153,0.5), 0 8px 32px rgba(52,211,153,0.2)'
            : '0 4px 24px rgba(0,0,0,0.5)',
        }}
      >
        <div className="h-[1.5px] w-full bg-gradient-to-r from-emerald-400 to-teal-400 opacity-70" />

        <div className="px-4 py-3.5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm bg-emerald-500/10 border border-emerald-400/25">
              🎯
            </div>
            <span className="text-xs font-semibold text-emerald-300">创作方案</span>
          </div>

          {hasContent ? (
            <p className="text-[12px] text-gray-300 leading-[1.7] whitespace-pre-wrap">{node.content}</p>
          ) : (
            <div className="space-y-1.5">
              {[60, 80, 45].map((w, i) => (
                <div
                  key={i}
                  className="h-2 rounded-full bg-white/[0.06] animate-pulse"
                  style={{ width: `${w}%`, animationDelay: `${i * 0.15}s` }}
                />
              ))}
              <p className="text-[11px] text-gray-600 mt-2">等待 AI 剧组输出方案…</p>
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  )
}
