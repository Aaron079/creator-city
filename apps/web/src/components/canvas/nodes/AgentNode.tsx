'use client'

import { useCanvasStore, AgentRole, NodeStatus } from '@/store/canvas.store'
import { BaseNode } from './BaseNode'

const ROLE_META: Record<AgentRole, { icon: string; accent: string; glow: string }> = {
  编剧: { icon: '✍️', accent: '#818cf8', glow: 'rgba(129,140,248,0.35)' },
  导演: { icon: '🎬', accent: '#f43f5e', glow: 'rgba(244,63,94,0.35)' },
  演员: { icon: '🎭', accent: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },
  摄影: { icon: '📷', accent: '#60a5fa', glow: 'rgba(96,165,250,0.35)' },
  剪辑: { icon: '✂️', accent: '#34d399', glow: 'rgba(52,211,153,0.35)' },
  音乐: { icon: '🎵', accent: '#a78bfa', glow: 'rgba(167,139,250,0.35)' },
}

const STATUS_LABEL: Record<NodeStatus, string> = {
  idle: '待命',
  pending: '排队中',
  running: '创作中',
  done: '完成',
  error: '错误',
}

interface Props {
  id: string
  enterDelay?: number
}

export function AgentNode({ id, enterDelay }: Props) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === id))
  const selectedIds = useCanvasStore((s) => s.selectedIds)

  if (!node || node.kind !== 'agent') return null

  const role = node.role ?? '编剧'
  const meta = ROLE_META[role] ?? ROLE_META['编剧']
  const status = node.status ?? 'idle'
  const progress = node.progress ?? 0
  const selected = selectedIds.has(id)

  return (
    <BaseNode id={id} x={node.x} y={node.y} selected={selected} enterDelay={enterDelay}>
      <div
        className="relative w-[280px] rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,15,26,0.75)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '0.5px solid rgba(255,255,255,0.12)',
          boxShadow: selected
            ? `0 0 0 1px ${meta.accent}60, 0 8px 32px ${meta.glow}`
            : `0 4px 24px rgba(0,0,0,0.5)`,
        }}
      >
        {/* accent top line */}
        <div className="h-[1.5px] w-full" style={{ background: meta.accent, opacity: 0.7 }} />

        <div className="px-4 py-3.5">
          {/* header */}
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: `${meta.accent}18`, border: `0.5px solid ${meta.accent}40` }}
            >
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-none mb-0.5">
                {node.agentName ?? role}
              </p>
              <p className="text-[10px]" style={{ color: meta.accent }}>
                {role}
              </p>
            </div>

            {/* status dot */}
            <StatusDot status={status} accent={meta.accent} />
          </div>

          {/* progress bar — only visible when running */}
          {(status === 'running' || status === 'done') && (
            <div className="mb-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-gray-500">{STATUS_LABEL[status]}</span>
                {status === 'running' && (
                  <span className="text-[9px]" style={{ color: meta.accent }}>
                    {progress}%
                  </span>
                )}
              </div>
              <div className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${meta.accent}80, ${meta.accent})`,
                  }}
                />
              </div>
            </div>
          )}

          {/* result text */}
          {node.result && (
            <p className="text-[11px] text-gray-400 leading-5 line-clamp-3">{node.result}</p>
          )}

          {/* idle placeholder */}
          {status === 'idle' && !node.result && (
            <p className="text-[11px] text-gray-600 leading-5">等待工作流启动…</p>
          )}
        </div>
      </div>
    </BaseNode>
  )
}

function StatusDot({ status, accent }: { status: NodeStatus; accent: string }) {
  const color =
    status === 'done'
      ? '#34d399'
      : status === 'error'
        ? '#f43f5e'
        : status === 'running'
          ? accent
          : 'rgba(255,255,255,0.2)'

  return (
    <div className="relative flex-shrink-0">
      <div
        className="w-2 h-2 rounded-full"
        style={{ background: color }}
      />
      {status === 'running' && (
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: color, opacity: 0.5 }}
        />
      )}
    </div>
  )
}
