'use client'

import { useEffect, useRef } from 'react'
import type * as React from 'react'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  FileSearch,
  RefreshCw,
  X,
} from 'lucide-react'
import type {
  CreatorSkillManifest,
  CreatorSkillRunResult,
  CreatorSkillRunStatus,
} from '@/lib/skills'

export type CreatorSkillRunPanelProps = {
  manifest: CreatorSkillManifest
  result: CreatorSkillRunResult
  canApply: boolean
  applyLabel: string
  onRerun: () => void
  onApply: () => void
  onClose: () => void
  children: React.ReactNode
}

const STATUS_PRESENTATION = {
  ready: {
    label: '可审核',
    className: 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200',
    icon: CheckCircle2,
  },
  'needs-review': {
    label: '需要审核',
    className: 'border-amber-300/20 bg-amber-300/[0.08] text-amber-200',
    icon: AlertTriangle,
  },
  blocked: {
    label: '已阻塞',
    className: 'border-rose-300/20 bg-rose-300/[0.08] text-rose-200',
    icon: Ban,
  },
} satisfies Record<CreatorSkillRunStatus, {
  label: string
  className: string
  icon: typeof CheckCircle2
}>

export function CreatorSkillRunPanel({
  manifest,
  result,
  canApply,
  applyLabel,
  onRerun,
  onApply,
  onClose,
  children,
}: CreatorSkillRunPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const titleId = `creator-skill-${manifest.id}-title`
  const status = STATUS_PRESENTATION[result.status]
  const StatusIcon = status.icon

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    panelRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[1199] flex items-center justify-center bg-black/35 p-3 sm:p-4"
      data-no-node-drag="true"
      onPointerDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="creator-skill-panel"
        className="flex max-h-[min(90vh,760px)] w-full max-w-[760px] flex-col overflow-hidden rounded-lg border border-white/12 bg-[#0d0f12]/98 text-white shadow-2xl outline-none backdrop-blur-xl"
      >
        <header className="flex flex-none items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id={titleId}
                className="min-w-0 break-words text-[15px] font-semibold leading-5 text-white"
              >
                {manifest.name}
              </h2>
              <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-white/45">
                v{manifest.version}
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭"
            title="关闭"
            data-testid="creator-skill-close"
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.09] hover:text-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200/70"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-2.5 sm:px-5">
            <span
              data-testid="creator-skill-status"
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-semibold ${status.className}`}
            >
              <StatusIcon size={13} aria-hidden="true" />
              {status.label}
            </span>
            <span className="min-w-0 break-all text-[10px] text-white/28">
              {result.runFingerprint}
            </span>
          </div>

          {result.blockers.length > 0 ? (
            <section aria-label="阻塞项" className="border-b border-rose-300/10 px-4 py-3 sm:px-5">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-200">
                <Ban size={13} aria-hidden="true" />
                阻塞项
              </h3>
              <ul className="mt-2 divide-y divide-white/[0.06]">
                {result.blockers.map((blocker) => (
                  <li key={`${blocker.code}:${blocker.artifactId ?? blocker.sourceNodeId ?? ''}`} className="py-2 first:pt-0 last:pb-0">
                    <p className="break-words text-[11px] font-medium text-rose-100/90">{blocker.message}</p>
                    <p className="mt-0.5 break-all text-[9px] text-rose-200/45">{blocker.code}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {result.warnings.length > 0 ? (
            <section aria-label="警告" className="border-b border-amber-300/10 px-4 py-3 sm:px-5">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
                <AlertTriangle size={13} aria-hidden="true" />
                警告
              </h3>
              <ul className="mt-2 divide-y divide-white/[0.06]">
                {result.warnings.map((warning) => (
                  <li key={`${warning.code}:${warning.artifactId ?? warning.sourceNodeId ?? ''}`} className="py-2 first:pt-0 last:pb-0">
                    <p className="break-words text-[11px] text-amber-100/85">{warning.message}</p>
                    <p className="mt-0.5 break-all text-[9px] text-amber-200/40">{warning.code}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="px-4 py-3 sm:px-5">{children}</div>

          {result.evidence.length > 0 ? (
            <section aria-label="证据" className="border-t border-white/[0.07] px-4 py-3 sm:px-5">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-white/68">
                <FileSearch size={13} aria-hidden="true" />
                证据 ({result.evidence.length})
              </h3>
              <div className="mt-2 divide-y divide-white/[0.06]">
                {result.evidence.map((evidence) => (
                  <details key={evidence.evidenceId} className="group py-2 first:pt-0 last:pb-0">
                    <summary className="cursor-pointer break-words text-[10px] font-medium text-white/48 marker:text-white/30 hover:text-white/72">
                      第 {evidence.lineStart}-{evidence.lineEnd} 行 · {evidence.explanation}
                    </summary>
                    <blockquote className="mt-2 whitespace-pre-wrap break-words border-l border-cyan-200/25 pl-3 text-[11px] leading-5 text-white/58">
                      {evidence.excerpt}
                    </blockquote>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <footer className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
          <button
            type="button"
            data-testid="creator-skill-rerun"
            onClick={onRerun}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[11px] font-semibold text-white/65 transition hover:bg-white/[0.09] hover:text-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200/70"
          >
            <RefreshCw size={13} aria-hidden="true" />
            重新运行
          </button>
          <button
            type="button"
            data-testid="creator-skill-apply"
            onClick={onApply}
            disabled={!canApply}
            className="inline-flex h-8 items-center justify-center rounded-md border border-cyan-200/25 bg-cyan-200/[0.1] px-3 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-200/[0.16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200/70 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {applyLabel}
          </button>
        </footer>
      </aside>
    </div>
  )
}
