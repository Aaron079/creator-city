'use client'

import Link from 'next/link'

export function EmptyState({
  title,
  message,
  actionLabel,
  actionHref,
}: {
  title: string
  message: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/8 bg-black/10 px-4 py-5 text-sm">
      <div className="font-medium text-white/75">{title}</div>
      <p className="mt-2 leading-relaxed text-white/45">{message}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}
