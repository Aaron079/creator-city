'use client'

export type FeedbackTone = 'success' | 'warning' | 'error' | 'info'

export interface FeedbackItem {
  id: string
  title: string
  tone: FeedbackTone
}

const TONE_STYLES: Record<FeedbackTone, string> = {
  success: 'border-emerald-500/25 bg-emerald-500/12 text-emerald-100',
  warning: 'border-amber-500/25 bg-amber-500/12 text-amber-100',
  error: 'border-rose-500/25 bg-rose-500/12 text-rose-100',
  info: 'border-sky-500/25 bg-sky-500/12 text-sky-100',
}

export function FeedbackToast({
  items,
  onDismiss,
}: {
  items: FeedbackItem[]
  onDismiss: (id: string) => void
}) {
  if (items.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-5 top-20 z-[80] flex w-full max-w-sm flex-col gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onDismiss(item.id)}
          className={`pointer-events-auto rounded-2xl border px-4 py-3 text-left text-sm shadow-2xl shadow-black/40 backdrop-blur-xl transition ${TONE_STYLES[item.tone]}`}
        >
          {item.title}
        </button>
      ))}
    </div>
  )
}
