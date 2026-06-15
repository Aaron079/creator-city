'use client'

import { useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface WheelOption<T extends string = string> {
  value: T
  label: string
  sublabel?: string
  icon?: string
}

interface WheelSelectorProps<T extends string = string> {
  options: WheelOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

// Horizontal sequential selector — shows all options with selected highlighted.
// Prev/next arrows let the user step through in order.
// Best for 3-8 options that have a natural left-to-right progression
// (e.g. slow → standard → fast, or short → long duration).
export function WheelSelector<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
}: WheelSelectorProps<T>) {
  const currentIndex = options.findIndex((o) => o.value === value)

  const go = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(options.length - 1, currentIndex + delta))
      const nextOpt = options[next]
      if (next !== currentIndex && nextOpt) onChange(nextOpt.value)
    },
    [currentIndex, onChange, options],
  )

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={currentIndex === 0}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-white/30 transition hover:bg-white/8 hover:text-white/70 disabled:opacity-20"
        aria-label="上一项"
      >
        <ChevronLeft size={12} strokeWidth={2.5} />
      </button>

      <div className="flex flex-1 items-center gap-1">
        {options.map((opt, i) => {
          const sel = opt.value === value
          const dist = Math.abs(i - currentIndex)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex flex-1 flex-col items-center rounded-lg border px-1.5 py-1.5 transition ${
                sel
                  ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200'
                  : dist === 1
                    ? 'border-white/8 bg-white/[0.03] text-white/40 hover:border-white/14 hover:text-white/65'
                    : 'border-white/5 bg-white/[0.015] text-white/22 hover:border-white/10 hover:text-white/45'
              }`}
            >
              {opt.icon ? (
                <span className={`text-[12px] leading-none ${sel ? '' : 'opacity-55'}`}>
                  {opt.icon}
                </span>
              ) : null}
              <span className="text-[10px] font-medium leading-tight">{opt.label}</span>
              {opt.sublabel ? (
                <span
                  className={`text-[7.5px] leading-none ${sel ? 'text-indigo-300/60' : 'text-white/20'}`}
                >
                  {opt.sublabel}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => go(1)}
        disabled={currentIndex === options.length - 1}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-white/30 transition hover:bg-white/8 hover:text-white/70 disabled:opacity-20"
        aria-label="下一项"
      >
        <ChevronRight size={12} strokeWidth={2.5} />
      </button>
    </div>
  )
}
