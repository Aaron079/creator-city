import React from 'react'
import type { ToolResultQualityStatus, ToolResultQualitySummary } from '@/lib/canvas/tool-result-quality'

type ToolResultQualityStripProps = {
  summary: ToolResultQualitySummary
}

const statusClassName: Record<ToolResultQualityStatus, string> = {
  'not-started': 'border-white/12 bg-white/[0.05] text-white/60',
  processing: 'border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100/85',
  'needs-confirmation': 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100/85',
  completed: 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100/85',
  preview: 'border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100/85',
  failed: 'border-rose-300/20 bg-rose-300/[0.08] text-rose-100/85',
  unavailable: 'border-white/12 bg-white/[0.04] text-white/52',
}

export function ToolResultQualityStrip({ summary }: ToolResultQualityStripProps) {
  const evidence = summary.evidence.filter(Boolean).slice(0, 2)

  return (
    <section
      aria-label="工具结果摘要"
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-white/10 bg-[#14171c]/90 px-2.5 py-2 text-[10px] leading-4 text-white/68"
      data-testid="tool-result-quality-strip"
    >
      <span className={`rounded border px-1.5 py-0.5 text-[9px] leading-3 ${statusClassName[summary.status]}`}>
        {summary.statusLabel}
      </span>
      <span><span className="mr-1 text-white/38">来源</span>{summary.sourceLabel}</span>
      <span><span className="mr-1 text-white/38">结果</span>{summary.resultLabel}</span>
      {evidence.map((item, index) => (
        <span key={`${item}-${index}`}><span className="mr-1 text-white/38">证据</span>{item}</span>
      ))}
      {summary.nextStepLabel ? (
        <span className="text-amber-100/75"><span className="mr-1 text-white/38">下一步</span>{summary.nextStepLabel}</span>
      ) : null}
    </section>
  )
}
