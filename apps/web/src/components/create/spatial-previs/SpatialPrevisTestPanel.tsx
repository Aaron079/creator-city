'use client'

import * as React from 'react'
import { Play } from 'lucide-react'
import {
  SPATIAL_PREVIS_TEST_DURATIONS,
  type SpatialPrevisTestDuration,
} from '@/lib/spatial-previs/test-delivery'

export type SpatialPrevisTestStatus =
  | { kind: 'idle'; message?: never }
  | { kind: 'submitting' | 'submitted' | 'failed' | 'retryable'; message: string }

type SpatialPrevisTestPanelProps = {
  advisory: string
  disabled?: boolean
  status: SpatialPrevisTestStatus
  onRun: (durationSec: SpatialPrevisTestDuration) => void
}

export function SpatialPrevisTestPanel({
  advisory,
  disabled = false,
  status,
  onRun,
}: SpatialPrevisTestPanelProps) {
  const [durationSec, setDurationSec] = React.useState<SpatialPrevisTestDuration>(5)
  const isSubmitting = status.kind === 'submitting'

  return (
    <section aria-label="预演内部测试" className="border-t border-white/[0.08] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-white/12" role="group" aria-label="测试时长">
          {SPATIAL_PREVIS_TEST_DURATIONS.map((duration) => (
            <button
              key={duration}
              type="button"
              aria-pressed={durationSec === duration}
              disabled={disabled || isSubmitting}
              onClick={() => setDurationSec(duration)}
              className={`px-2.5 py-1.5 text-[11px] font-medium transition first:border-r first:border-white/10 ${durationSec === duration ? 'bg-indigo-300/15 text-indigo-100' : 'bg-white/[0.025] text-white/48 hover:bg-white/[0.07] hover:text-white/75'} disabled:cursor-not-allowed disabled:opacity-35`}
            >
              {duration} 秒
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={disabled || isSubmitting}
          onClick={() => onRun(durationSec)}
          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200/30 bg-indigo-300/[0.1] px-2.5 py-1.5 text-[11px] font-medium text-indigo-50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Play aria-hidden="true" className="size-3.5" />
          {isSubmitting ? '提交中…' : status.kind === 'retryable' ? '重新运行预演测试' : '运行预演测试'}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-amber-100/65">{advisory}</p>
      {status.kind === 'submitted' || status.kind === 'retryable' ? (
        <p role="status" className="mt-1.5 text-[11px] text-emerald-200/80">{status.message}</p>
      ) : null}
      {status.kind === 'failed' ? (
        <p role="alert" className="mt-1.5 text-[11px] text-amber-200/80">{status.message}</p>
      ) : null}
      {status.kind === 'submitting' ? (
        <p role="status" className="mt-1.5 text-[11px] text-indigo-100/75">{status.message}</p>
      ) : null}
    </section>
  )
}
