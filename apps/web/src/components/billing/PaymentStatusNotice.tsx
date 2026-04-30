'use client'

export function PaymentStatusNotice({ type, message }: { type: 'info' | 'success' | 'error'; message: string }) {
  const colors = {
    info: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
    success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
    error: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  }
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${colors[type]}`}>
      {message}
    </div>
  )
}
