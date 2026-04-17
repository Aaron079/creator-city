'use client'

import { useCanvasStore } from '@/store/canvas.store'
import { BaseNode } from './BaseNode'

interface Props {
  id: string
  enterDelay?: number
}

export function ImageNode({ id, enterDelay }: Props) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === id))
  const selectedIds = useCanvasStore((s) => s.selectedIds)

  if (!node || node.kind !== 'image') return null

  const selected = selectedIds.has(id)

  return (
    <BaseNode id={id} x={node.x} y={node.y} selected={selected} enterDelay={enterDelay}>
      <div
        className="relative w-[220px] rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,15,26,0.75)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '0.5px solid rgba(167,139,250,0.25)',
          boxShadow: selected
            ? '0 0 0 1px rgba(167,139,250,0.55), 0 8px 24px rgba(167,139,250,0.25)'
            : '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        {node.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.imageUrl}
            alt="AI 生成图像"
            className="w-full object-cover"
            style={{ aspectRatio: '3/4' }}
            draggable={false}
          />
        ) : (
          <div
            className="w-full flex items-center justify-center text-4xl"
            style={{
              aspectRatio: '3/4',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(167,139,250,0.08))',
            }}
          >
            <div className="text-center">
              <div className="text-3xl mb-2 opacity-40">🖼️</div>
              <p className="text-[10px] text-gray-600">图像生成中…</p>
            </div>
          </div>
        )}

        {node.content && (
          <div className="px-3 py-2">
            <p className="text-[10px] text-gray-400 leading-4 truncate">{node.content}</p>
          </div>
        )}
      </div>
    </BaseNode>
  )
}
