'use client'

import { useCanvasStore } from '@/store/canvas.store'
import { BaseNode } from './BaseNode'

interface Props {
  id: string
  enterDelay?: number
}

const ACCENT = '#8b5cf6'
const GLOW   = 'rgba(139,92,246,0.35)'

export function FinalEditNode({ id, enterDelay }: Props) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === id))
  const selectedIds = useCanvasStore((s) => s.selectedIds)

  if (!node || node.kind !== 'final-edit') return null

  const status   = node.status ?? 'idle'
  const selected = selectedIds.has(id)

  return (
    <BaseNode id={id} x={node.x} y={node.y} selected={selected} enterDelay={enterDelay}>
      <div
        className="relative w-[320px] rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,15,26,0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `0.5px solid ${ACCENT}40`,
          boxShadow: selected
            ? `0 0 0 1px ${ACCENT}60, 0 8px 32px ${GLOW}`
            : `0 4px 24px rgba(0,0,0,0.55)`,
        }}
      >
        {/* Accent top line */}
        <div
          className="h-[1.5px] w-full"
          style={{ background: `linear-gradient(90deg, ${ACCENT}, #c084fc)`, opacity: 0.8 }}
        />

        <div className="px-4 py-3.5">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: `${ACCENT}18`, border: `0.5px solid ${ACCENT}40` }}
            >
              🎞️
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-none mb-0.5">总剪辑师</p>
              <p className="text-[10px]" style={{ color: ACCENT }}>Final Editor · 多镜头整合</p>
            </div>
            <StatusDot status={status} />
          </div>

          {/* Progress bar */}
          {(status === 'running' || status === 'done') && (
            <div className="mb-2.5">
              <div className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                {status === 'running' ? (
                  <div
                    className="h-full rounded-full animate-pulse"
                    style={{ width: '60%', background: `linear-gradient(90deg, ${ACCENT}40, ${ACCENT})` }}
                  />
                ) : (
                  <div
                    className="h-full rounded-full"
                    style={{ width: '100%', background: `linear-gradient(90deg, ${ACCENT}80, ${ACCENT})` }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Running */}
          {status === 'running' && (
            <p className="text-[11px] text-gray-500 leading-5 animate-pulse">剪辑生成中…</p>
          )}

          {/* Idle */}
          {(status === 'idle' || status === 'pending') && (
            <p className="text-[11px] text-gray-600 leading-5">等待所有镜头生成完毕…</p>
          )}

          {/* Error */}
          {status === 'error' && (
            <p className="text-[11px] text-red-400/70 leading-5">剪辑失败，请重试</p>
          )}

          {/* Done */}
          {status === 'done' && (
            <div className="flex flex-col gap-2.5">
              {/* Timeline summary */}
              {node.timelineSummary && (
                <div
                  className="rounded-lg px-3 py-2"
                  style={{ background: `${ACCENT}0d`, border: `0.5px solid ${ACCENT}25` }}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
                    Timeline 节奏
                  </p>
                  <p className="text-[11px] text-gray-300 leading-[1.6]">{node.timelineSummary}</p>
                </div>
              )}

              {/* Editor notes */}
              {node.content && (
                <div
                  className="max-h-[90px] overflow-y-auto text-[11px] text-gray-400 leading-[1.6] whitespace-pre-wrap pr-1"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
                >
                  {node.content}
                </div>
              )}

              {/* Final video */}
              {node.finalVideoUrl && (
                <div className="rounded-lg overflow-hidden border border-white/[0.07]">
                  <p className="text-[9px] font-semibold uppercase tracking-wider px-2.5 pt-2 pb-1" style={{ color: ACCENT }}>
                    最终成片（mock）
                  </p>
                  <video
                    src={node.finalVideoUrl}
                    controls
                    muted
                    playsInline
                    className="w-full h-[120px] object-cover bg-black"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  )
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'done'    ? '#34d399' :
    status === 'error'   ? '#f43f5e' :
    status === 'running' ? ACCENT    :
    'rgba(255,255,255,0.2)'

  return (
    <div className="relative flex-shrink-0">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      {status === 'running' && (
        <div className="absolute inset-0 rounded-full animate-ping" style={{ background: color, opacity: 0.5 }} />
      )}
    </div>
  )
}
