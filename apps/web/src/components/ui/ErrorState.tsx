'use client'

import Link from 'next/link'

export function ErrorState({
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
    <section className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5">
      <div className="text-lg font-semibold text-rose-100">{title}</div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-rose-100/80">{message}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-xl border border-rose-300/20 px-3 py-2 text-sm text-rose-100/90 transition hover:border-rose-200/30 hover:text-white"
        >
          {actionLabel}
        </Link>
      ) : null}
    </section>
  )
}
