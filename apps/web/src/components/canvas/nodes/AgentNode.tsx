'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useCanvasStore } from '@/store/canvas.store'
import type { AgentRole, NodeStatus, CanvasNode } from '@/store/canvas.store'
import { BaseNode } from './BaseNode'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_META: Record<AgentRole, { icon: string; accent: string; glow: string }> = {
  编剧: { icon: '✍️', accent: '#818cf8', glow: 'rgba(129,140,248,0.35)' },
  导演: { icon: '🎬', accent: '#f43f5e', glow: 'rgba(244,63,94,0.35)' },
  演员: { icon: '🎭', accent: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },
  摄影: { icon: '📷', accent: '#60a5fa', glow: 'rgba(96,165,250,0.35)' },
  剪辑: { icon: '✂️', accent: '#34d399', glow: 'rgba(52,211,153,0.35)' },
  音乐: { icon: '🎵', accent: '#a78bfa', glow: 'rgba(167,139,250,0.35)' },
}

const STATUS_LABEL: Record<NodeStatus, string> = {
  idle: '待命', pending: '排队中', running: '创作中', done: '完成', error: '错误',
}

const RUNNING_LABEL: Partial<Record<AgentRole, string>> = {
  演员: '角色塑造中…',
  摄影: '镜头生成中…',
  剪辑: '视频生成中…',
}

const SOURCE_META: Record<string, { label: string; color: string; bg: string }> = {
  mock:           { label: 'mock',     color: 'rgba(156,163,175,0.7)', bg: 'rgba(156,163,175,0.08)' },
  real:           { label: 'real AI',  color: '#34d399',               bg: 'rgba(52,211,153,0.1)'   },
  'fallback-mock':{ label: 'fallback', color: '#f59e0b',               bg: 'rgba(245,158,11,0.1)'   },
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  id: string
  enterDelay?: number
}

export function AgentNode({ id, enterDelay }: Props) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === id))
  const selectedIds = useCanvasStore((s) => s.selectedIds)

  if (!node || node.kind !== 'agent') return null

  const role     = node.role ?? '编剧'
  const meta     = ROLE_META[role] ?? ROLE_META['编剧']
  const status   = node.status ?? 'idle'
  const selected = selectedIds.has(id)
  const sourceMeta = node.source ? SOURCE_META[node.source] : undefined
  const isActor  = role === '演员'
  const isCamera = role === '摄影'
  const isVideo  = role === '剪辑'

  return (
    <BaseNode id={id} x={node.x} y={node.y} selected={selected} enterDelay={enterDelay}>
      <div
        className="relative w-[280px] rounded-2xl overflow-hidden transition-shadow duration-200"
        style={{
          background: 'rgba(8,12,22,0.82)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: `0.5px solid ${selected ? meta.accent + '80' : 'rgba(255,255,255,0.1)'}`,
          boxShadow: selected
            ? `0 0 0 1px ${meta.accent}60, 0 12px 48px rgba(0,0,0,0.65), 0 0 24px ${meta.glow}`
            : status === 'running'
            ? `0 8px 36px rgba(0,0,0,0.6), 0 0 20px ${meta.glow}`
            : `0 8px 36px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)`,
        }}
      >
        {/* Accent top line with glow */}
        <div
          className="h-[2px] w-full"
          style={{
            background: `linear-gradient(90deg, ${meta.accent}00 0%, ${meta.accent} 40%, ${meta.accent}cc 100%)`,
            boxShadow: status === 'running' ? `0 0 8px ${meta.accent}` : 'none',
          }}
        />
        {/* Running shimmer sweep */}
        {status === 'running' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(105deg, transparent 40%, ${meta.accent}09 50%, transparent 60%)`,
              animation: 'shimmer 2s ease-in-out infinite',
            }}
          />
        )}

        <div className="px-4 py-3.5">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: `${meta.accent}18`, border: `0.5px solid ${meta.accent}40` }}
            >
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-sm font-semibold text-white leading-none">
                  {node.agentName ?? role}
                </p>
                {sourceMeta && (
                  <span
                    className="text-[8px] px-1.5 py-[1px] rounded-full leading-none"
                    style={{ background: sourceMeta.bg, color: sourceMeta.color }}
                  >
                    {sourceMeta.label}
                  </span>
                )}
              </div>
              <p className="text-[10px]" style={{ color: meta.accent }}>{role}</p>
            </div>
            <StatusDot status={status} accent={meta.accent} />
          </div>

          {/* Progress bar */}
          {(status === 'running' || status === 'done') && (
            <div className="mb-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-gray-500">{STATUS_LABEL[status]}</span>
              </div>
              <div className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                {status === 'running' ? (
                  <div
                    className="h-full rounded-full animate-pulse"
                    style={{ width: '60%', background: `linear-gradient(90deg, ${meta.accent}40, ${meta.accent})` }}
                  />
                ) : (
                  <div
                    className="h-full rounded-full"
                    style={{ width: '100%', background: `linear-gradient(90deg, ${meta.accent}80, ${meta.accent})` }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Running */}
          {status === 'running' && (
            <div className="flex items-center gap-2">
              <p className="text-[11px] leading-5" style={{ color: meta.accent }}>
                {RUNNING_LABEL[role] ?? 'Director is thinking…'}
              </p>
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="inline-block w-1 h-1 rounded-full animate-bounce"
                    style={{ background: meta.accent, animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </div>
          )}

          {/* Done — actor card */}
          {status === 'done' && isActor && (node.characterName || node.personality) && (
            <ActorCard node={node} accent={meta.accent} />
          )}

          {/* Done — camera card */}
          {status === 'done' && isCamera && (
            <CameraCard node={node} accent={meta.accent} />
          )}

          {/* Done — video card */}
          {status === 'done' && isVideo && (
            <VideoCard node={node} accent={meta.accent} />
          )}

          {/* Done — generic content (writer, director, music) */}
          {status === 'done' && !isActor && !isCamera && !isVideo && node.content && (
            <div
              className="max-h-[130px] overflow-y-auto text-[11px] text-gray-300 leading-[1.6] whitespace-pre-wrap pr-1"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
            >
              {node.content}
            </div>
          )}

          {/* Generic image thumbnail (non-actor / non-camera / non-video) */}
          {status === 'done' && !isActor && !isCamera && !isVideo && node.imageUrl && (
            <div className="mt-2 rounded-lg overflow-hidden border border-white/[0.07]">
              <div className="relative w-full h-[72px]">
                <Image
                  src={node.imageUrl}
                  alt="AI generated frame"
                  fill
                  unoptimized
                  sizes="320px"
                  className="object-cover"
                />
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <p className="text-[11px] text-red-400/70 leading-5">生成失败，请重试</p>
          )}

          {/* Idle / pending */}
          {(status === 'idle' || status === 'pending') && (
            <p className="text-[11px] text-gray-600 leading-5">
              {status === 'pending' ? '排队等待中…' : '等待工作流启动…'}
            </p>
          )}
        </div>
      </div>
    </BaseNode>
  )
}

// ─── Video card ───────────────────────────────────────────────────────────────

function VideoCard({ node, accent }: { node: CanvasNode; accent: string }) {
  const [promptOpen, setPromptOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      {/* Video player */}
      {node.videoUrl ? (
        <div className="rounded-lg overflow-hidden border border-white/[0.07]">
          <video
            src={node.videoUrl}
            controls
            muted
            playsInline
            className="w-full h-[110px] object-cover bg-black"
          />
        </div>
      ) : (
        <p className="text-[11px] text-gray-600">暂无视频输出</p>
      )}

      {/* Collapsible videoPrompt */}
      {node.videoPrompt && (
        <div>
          <button
            onClick={() => setPromptOpen((v) => !v)}
            className="flex items-center gap-1 text-[9px] transition-colors"
            style={{ color: promptOpen ? accent : 'rgba(255,255,255,0.25)' }}
          >
            <span>{promptOpen ? '▾' : '▸'}</span>
            <span>video prompt</span>
          </button>
          {promptOpen && (
            <p
              className="mt-1 text-[9px] font-mono leading-[1.5] italic"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {node.videoPrompt}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Camera card ──────────────────────────────────────────────────────────────

function CameraCard({ node, accent }: { node: CanvasNode; accent: string }) {
  const [promptOpen, setPromptOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      {/* Shot description */}
      {node.shotDescription && (
        <p className="text-[11px] leading-[1.5]" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {node.shotDescription}
        </p>
      )}

      {/* Keyframe image with hover zoom */}
      {node.imageUrl && (
        <div className="mt-0.5 rounded-lg overflow-hidden border border-white/[0.07] group">
          <div className="relative w-full h-[90px]">
            <Image
              src={node.imageUrl}
              alt="keyframe"
              fill
              unoptimized
              sizes="320px"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          </div>
        </div>
      )}

      {/* Collapsible keyframe prompt */}
      {node.keyframePrompt && (
        <div>
          <button
            onClick={() => setPromptOpen((v) => !v)}
            className="flex items-center gap-1 text-[9px] transition-colors"
            style={{ color: promptOpen ? accent : 'rgba(255,255,255,0.25)' }}
          >
            <span>{promptOpen ? '▾' : '▸'}</span>
            <span>keyframe prompt</span>
          </button>
          {promptOpen && (
            <p
              className="mt-1 text-[9px] font-mono leading-[1.5] italic"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {node.keyframePrompt}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Actor card ───────────────────────────────────────────────────────────────

function ActorCard({ node, accent }: { node: CanvasNode; accent: string }) {
  return (
    <div className="flex flex-col gap-2">
      {node.characterName && (
        <p className="text-[13px] font-bold leading-none" style={{ color: accent }}>
          {node.characterName}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {node.personality && <InfoRow label="气质" value={node.personality} />}
        {node.lookSummary  && <InfoRow label="外形" value={node.lookSummary}  />}
        {node.wardrobe     && <InfoRow label="造型" value={node.wardrobe}     />}
      </div>
      {node.imageUrl && (
        <div className="mt-1 rounded-lg overflow-hidden border border-white/[0.07]">
          <div className="relative w-full h-[72px]">
            <Image
              src={node.imageUrl}
              alt={node.characterName ?? '角色'}
              fill
              unoptimized
              sizes="320px"
              className="object-cover"
            />
          </div>
        </div>
      )}
      {node.consistencyKey && (
        <p className="text-[8px] font-mono leading-none mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {node.consistencyKey}
        </p>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5 items-baseline">
      <span className="text-[9px] font-medium uppercase tracking-wider text-gray-600 flex-shrink-0 w-6">
        {label}
      </span>
      <span className="text-[11px] text-gray-300 leading-[1.5]">{value}</span>
    </div>
  )
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status, accent }: { status: NodeStatus; accent: string }) {
  const color =
    status === 'done'    ? '#34d399' :
    status === 'error'   ? '#f43f5e' :
    status === 'running' ? accent    :
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
