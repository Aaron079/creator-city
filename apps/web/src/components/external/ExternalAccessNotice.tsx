'use client'

import type { ExternalAccessStatus } from '@/store/external-access.store'
import { getExternalStatusTone } from '@/lib/external/access'

export function ExternalAccessNotice({
  title,
  message,
  status,
  details = [],
}: {
  title: string
  message: string
  status: ExternalAccessStatus | 'invalid'
  details?: string[]
}) {
  const tone = status === 'invalid' ? 'danger' : getExternalStatusTone(status)
  const styles = tone === 'danger'
    ? {
        border: '1px solid rgba(244,63,94,0.20)',
        background: 'rgba(244,63,94,0.08)',
        title: '#fecdd3',
      }
    : tone === 'warning'
      ? {
          border: '1px solid rgba(245,158,11,0.20)',
          background: 'rgba(245,158,11,0.08)',
          title: '#fde68a',
        }
      : {
          border: '1px solid rgba(16,185,129,0.20)',
          background: 'rgba(16,185,129,0.08)',
          title: '#a7f3d0',
        }

  return (
    <section className="mx-auto max-w-3xl rounded-[28px] p-6" style={{ border: styles.border, background: styles.background }}>
      <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.46)' }}>
        External Collaboration Access
      </p>
      <h1 className="mt-3 text-2xl font-semibold" style={{ color: styles.title }}>{title}</h1>
      <p className="mt-3 text-sm leading-[1.8]" style={{ color: 'rgba(255,255,255,0.72)' }}>
        {message}
      </p>
      {details.length > 0 ? (
        <div className="mt-5 space-y-2">
          {details.map((detail) => (
            <div
              key={detail}
              className="rounded-2xl px-4 py-3 text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.64)' }}
            >
              {detail}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
