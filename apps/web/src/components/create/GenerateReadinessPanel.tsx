'use client'

import { useCallback, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Info, X, XCircle } from 'lucide-react'
import type { ReadinessCheck, ReadinessResult } from '@/lib/canvas/readiness-check'

interface GenerateReadinessPanelProps {
  result: ReadinessResult
  nodeTitle: string
  nodeKind: 'text' | 'image' | 'video'
  canAppendPrompt: boolean
  onPromptAppend: (value: string) => void
  onClose: () => void
}

// ─── icons ────────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ReadinessCheck['status'] }) {
  if (status === 'pass') return <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
  if (status === 'warn') return <AlertTriangle size={14} className="shrink-0 text-amber-400" />
  if (status === 'fail') return <XCircle size={14} className="shrink-0 text-red-400" />
  return <Info size={14} className="shrink-0 text-white/35" />
}

function statusBorder(status: ReadinessCheck['status']) {
  if (status === 'pass') return 'border-emerald-500/20'
  if (status === 'warn') return 'border-amber-500/25'
  if (status === 'fail') return 'border-red-500/25'
  return 'border-white/[0.07]'
}

function statusBg(status: ReadinessCheck['status']) {
  if (status === 'pass') return 'bg-emerald-500/[0.05]'
  if (status === 'warn') return 'bg-amber-500/[0.06]'
  if (status === 'fail') return 'bg-red-500/[0.06]'
  return 'bg-white/[0.025]'
}

// ─── overall badge ────────────────────────────────────────────────────────────

function OverallBadge({ status }: { status: ReadinessResult['overallStatus'] }) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/[0.1] px-3 py-1 text-xs font-semibold text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        准备好生成
      </span>
    )
  }
  if (status === 'needs_attention') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/[0.1] px-3 py-1 text-xs font-semibold text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        需要注意
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/[0.1] px-3 py-1 text-xs font-semibold text-red-300">
      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
      有阻塞项
    </span>
  )
}

// ─── check item ───────────────────────────────────────────────────────────────

function CheckItem({
  check,
  canAppendPrompt,
  onAppend,
}: {
  check: ReadinessCheck
  canAppendPrompt: boolean
  onAppend: (value: string) => void
}) {
  const canAction =
    check.action &&
    (check.action.kind === 'navigate' || (check.action.kind === 'append-prompt' && canAppendPrompt))

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${statusBorder(check.status)} ${statusBg(check.status)}`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5">
          <StatusIcon status={check.status} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold leading-snug text-white/80">{check.title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{check.detail}</p>
          {check.action && (
            <div className="mt-2">
              {check.action.kind === 'navigate' && check.action.href ? (
                <a
                  href={check.action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-6 items-center rounded-md border border-white/10 bg-white/[0.06] px-2 text-[11px] font-medium text-white/60 transition hover:border-white/20 hover:text-white/85"
                >
                  {check.action.label} →
                </a>
              ) : check.action.kind === 'append-prompt' ? (
                <button
                  type="button"
                  disabled={!canAction}
                  onClick={() => check.action?.value && onAppend(check.action.value)}
                  className="inline-flex h-6 items-center rounded-md border border-violet-500/30 bg-violet-500/[0.08] px-2 text-[11px] font-medium text-violet-300 transition hover:bg-violet-500/[0.15] disabled:cursor-not-allowed disabled:opacity-30"
                  title={!canAppendPrompt ? '请先打开节点对话框才能追加 Prompt' : undefined}
                >
                  {check.action.label}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── group section ────────────────────────────────────────────────────────────

const GROUP_META = {
  content: { label: 'A. 节点内容', emoji: '📝' },
  config: { label: 'B. 生成配置', emoji: '⚙️' },
  asset: { label: 'C. 资产状态', emoji: '🗂' },
} as const

function GroupSection({
  group,
  checks,
  canAppendPrompt,
  onAppend,
}: {
  group: 'content' | 'config' | 'asset'
  checks: ReadinessCheck[]
  canAppendPrompt: boolean
  onAppend: (value: string) => void
}) {
  const [open, setOpen] = useState(true)
  const meta = GROUP_META[group]
  const failCount = checks.filter((c) => c.status === 'fail').length
  const warnCount = checks.filter((c) => c.status === 'warn').length

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-1.5"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          <span>{meta.emoji}</span>
          <span>{meta.label}</span>
        </span>
        <div className="flex items-center gap-1.5">
          {failCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
              {failCount} 阻塞
            </span>
          )}
          {warnCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
              {warnCount} 注意
            </span>
          )}
          {open ? (
            <ChevronDown size={12} className="text-white/25" />
          ) : (
            <ChevronRight size={12} className="text-white/25" />
          )}
        </div>
      </button>
      {open && (
        <div className="mt-1 space-y-1.5 pb-2">
          {checks.map((check) => (
            <CheckItem
              key={check.id}
              check={check}
              canAppendPrompt={canAppendPrompt}
              onAppend={onAppend}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── main panel ───────────────────────────────────────────────────────────────

export function GenerateReadinessPanel({
  result,
  nodeTitle,
  nodeKind,
  canAppendPrompt,
  onPromptAppend,
  onClose,
}: GenerateReadinessPanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const handleCopy = useCallback(async () => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(result.copyableReport)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2200)
    } catch {
      setCopyState('failed')
      setTimeout(() => setCopyState('idle'), 2200)
    }
  }, [result.copyableReport])

  const kindLabel = nodeKind === 'image' ? '图片节点' : nodeKind === 'video' ? '视频节点' : '文本节点'

  const grouped = {
    content: result.checks.filter((c) => c.group === 'content'),
    config: result.checks.filter((c) => c.group === 'config'),
    asset: result.checks.filter((c) => c.group === 'asset'),
  }

  return (
    <div
      className="fixed right-[80px] top-1/2 z-[1200] flex max-h-[84vh] w-[320px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/96 shadow-2xl backdrop-blur-xl"
      data-no-node-drag="true"
      data-smart-toolbar-panel="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/[0.07] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
            生成前体检
          </p>
          <h2 className="mt-1 text-sm font-semibold text-white/90">
            {nodeTitle || '未命名节点'}
          </h2>
          <p className="mt-0.5 text-[11px] text-white/40">{kindLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white/80"
          aria-label="关闭体检面板"
        >
          <X size={13} />
        </button>
      </div>

      {/* Overall status */}
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-2.5">
        <OverallBadge status={result.overallStatus} />
        {result.assetSummary && (
          <p className="min-w-0 flex-1 truncate text-[10px] text-white/30" title={result.assetSummary}>
            {result.assetSummary}
          </p>
        )}
      </div>

      {/* Checks */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-1">
          {(['content', 'config', 'asset'] as const).map((group) =>
            grouped[group].length > 0 ? (
              <GroupSection
                key={group}
                group={group}
                checks={grouped[group]}
                canAppendPrompt={canAppendPrompt}
                onAppend={onPromptAppend}
              />
            ) : null,
          )}
        </div>

        {!canAppendPrompt && (
          <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] text-white/35">
            提示：打开节点对话框后可追加 Prompt 建议。
          </p>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 border-t border-white/[0.07] px-4 py-3">
        <button
          type="button"
          onClick={() => { void handleCopy() }}
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.05] py-1.5 text-[12px] font-medium text-white/60 transition hover:bg-white/[0.09] hover:text-white/80"
        >
          {copyState === 'copied' ? '✅ 已复制' : copyState === 'failed' ? '复制失败' : '复制体检结果'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/[0.07] bg-transparent px-3 py-1.5 text-[12px] text-white/40 transition hover:text-white/60"
        >
          关闭
        </button>
      </div>
    </div>
  )
}
