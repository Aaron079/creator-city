'use client'

import { useCanvasStore } from '@/store/canvas.store'
import { BaseNode } from './BaseNode'

interface Props {
  id: string
  enterDelay?: number
}

export function PromptNode({ id, enterDelay }: Props) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === id))
  const selectedIds = useCanvasStore((s) => s.selectedIds)

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
          border: `0.5px solid ${selected ? 'rgba(99,102,241,0.7)' : 'rgba(99,102,241,0.3)'}`,
          boxShadow: selected
            ? '0 0 0 1px rgba(99,102,241,0.6), 0 12px 48px rgba(0,0,0,0.65), 0 0 28px rgba(99,102,241,0.3)'
            : '0 8px 36px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(99,102,241,0.12)',
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

          <div
            className="rounded-xl px-3 py-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-sm leading-6 text-white/85 min-h-[72px]">
              {node.content?.trim() || '从底部输入框继续写你的镜头创意，画布这里保持摘要视图。'}
            </p>
            <p className="mt-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.26)' }}>
              编辑入口已收敛到底部输入框
            </p>
          </div>
        </div>
      </div>
    </BaseNode>
  )
}
