'use client'

type StatusTone = 'default' | 'info' | 'warning' | 'danger' | 'success' | 'neutral'

const TONE_STYLES: Record<StatusTone, string> = {
  default: 'border-white/10 bg-white/5 text-white/70',
  info: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  danger: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  neutral: 'border-white/8 bg-black/15 text-white/50',
}

export function StatusBadge({
  label,
  tone = 'default',
  className = '',
}: {
  label: string
  tone?: StatusTone
  className?: string
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${TONE_STYLES[tone]} ${className}`.trim()}
    >
      {label}
    </span>
  )
}
