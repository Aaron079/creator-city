'use client'

import type { ReactNode } from 'react'

export type DirectorSourceNode = {
  title: string
  kind: 'image' | 'video' | 'text'
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
}

type AccentColor = 'violet' | 'amber' | 'indigo'

type DirectorToolPanelFrameProps = {
  title: string
  titleEn: string
  icon: string
  accentColor: AccentColor
  count?: number
  summary?: string
  sourceNode?: DirectorSourceNode | null
  primaryLabel: string
  primaryDisabled?: boolean
  busy?: boolean
  onPrimary(): void
  onClear?(): void
  onClose(): void
  children: ReactNode
  ariaLabel?: string
}

const ACCENT = {
  violet: {
    badge: 'border-violet-500/25 bg-violet-500/[0.08] text-violet-300/70',
    titleEn: 'text-violet-300/40',
    primary: 'border-violet-500/30 bg-violet-500/[0.1] text-violet-300 hover:bg-violet-500/[0.18] disabled:opacity-40',
    summary: 'border-violet-500/[0.12] bg-violet-500/[0.04] text-violet-200/50',
  },
  amber: {
    badge: 'border-amber-500/25 bg-amber-500/[0.08] text-amber-300/70',
    titleEn: 'text-amber-300/40',
    primary: 'border-amber-500/30 bg-amber-500/[0.08] text-amber-300 hover:bg-amber-500/[0.15] disabled:opacity-40',
    summary: 'border-amber-500/[0.12] bg-amber-500/[0.04] text-amber-200/50',
  },
  indigo: {
    badge: 'border-indigo-500/25 bg-indigo-500/[0.08] text-indigo-300/70',
    titleEn: 'text-indigo-300/40',
    primary: 'border-indigo-500/30 bg-indigo-500/[0.1] text-indigo-300 hover:bg-indigo-500/[0.18] disabled:opacity-40',
    summary: 'border-indigo-500/[0.12] bg-indigo-500/[0.04] text-indigo-200/50',
  },
} satisfies Record<AccentColor, Record<string, string>>

export function DirectorToolPanelFrame({
  title,
  titleEn,
  icon,
  accentColor,
  count = 0,
  summary,
  sourceNode,
  primaryLabel,
  primaryDisabled = false,
  busy = false,
  onPrimary,
  onClear,
  onClose,
  children,
  ariaLabel,
}: DirectorToolPanelFrameProps) {
  const accent = ACCENT[accentColor]

  return (
    <aside
      className="m-4 flex max-h-[92vh] w-[min(840px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0d0f12]/96 text-white shadow-2xl backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? `${title} / ${titleEn}`}
      data-no-node-drag="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onWheelCapture={(e) => e.stopPropagation()}
    >
      {/* ── Fixed Header ──────────────────────────────────────────── */}
      <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="min-w-0">
          <p className={`text-[9px] uppercase tracking-[0.18em] ${accent.titleEn}`}>{titleEn}</p>
          <h2 className="mt-0.5 text-[17px] font-semibold leading-tight text-white">{icon} {title}</h2>
        </div>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white/80"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      {/* ── Source Preview (optional) ─────────────────────────────── */}
      {sourceNode ? (
        <div className="flex flex-shrink-0 items-center gap-4 border-b border-white/[0.06] px-5 py-3">
          {/* Thumbnail */}
          <div className="relative h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04]">
            {sourceNode.kind === 'image' && sourceNode.resultImageUrl ? (
              <img
                src={sourceNode.resultImageUrl}
                alt={sourceNode.title}
                className="h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-base opacity-40">
                {sourceNode.kind === 'video' ? '🎬' : sourceNode.kind === 'image' ? '🖼️' : '📝'}
              </div>
            )}
          </div>
          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/25">来源素材</p>
            <p className="mt-0.5 truncate text-[12px] font-semibold leading-tight text-white/75">
              {sourceNode.title || '未命名节点'}
            </p>
            <p className="mt-0.5 text-[10px] text-white/30">
              {sourceNode.kind === 'video' ? '视频节点' : sourceNode.kind === 'image' ? '图片节点' : '文本节点'}
              {' · '}
              <span className="text-white/20">原节点保持不变</span>
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Tool Summary Bar (shown when settings active) ─────────── */}
      {(count > 0 && summary) ? (
        <div className={`flex flex-shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-5 py-2.5 ${accent.summary}`}>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold ${accent.badge}`}>
            {count} 项已设定
          </span>
          <span className="truncate text-[10px] font-medium" title={summary}>{summary}</span>
        </div>
      ) : null}

      {/* ── Scrollable Body ───────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {children}
      </div>

      {/* ── Fixed Footer ─────────────────────────────────────────── */}
      <footer className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
        <div>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/50 transition hover:bg-white/[0.08] hover:text-white/70"
            >
              清除设定
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/10"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled || busy}
            className={`rounded-md border px-4 py-1.5 text-[11px] font-semibold transition disabled:cursor-not-allowed ${accent.primary}`}
          >
            {busy ? '创建中…' : primaryLabel}
          </button>
        </div>
      </footer>
    </aside>
  )
}
