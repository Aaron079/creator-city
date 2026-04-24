'use client'

import Link from 'next/link'

export function AccessFallback({
  title,
  message,
  details,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string
  message: string
  details?: string[]
  actionHref?: string
  actionLabel?: string
  secondaryHref?: string
  secondaryLabel?: string
}) {
  return (
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
      <div className="text-lg font-semibold text-amber-100">{title}</div>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-100/80">{message}</p>
      {details && details.length > 0 ? (
        <div className="mt-4 space-y-2">
          {details.map((detail) => (
            <div
              key={detail}
              className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-amber-50/75"
            >
              {detail}
            </div>
          ))}
        </div>
      ) : null}
      {actionHref && actionLabel ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={actionHref}
            className="inline-flex rounded-xl border border-amber-300/20 px-3 py-2 text-sm text-amber-100/90 transition hover:border-amber-200/30 hover:text-white"
          >
            {actionLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
