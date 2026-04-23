'use client'

import Link from 'next/link'

export function AccessNotice({
  title,
  message,
  href,
  ctaLabel,
}: {
  title: string
  message: string
  href?: string
  ctaLabel?: string
}) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
      <div className="text-sm font-semibold text-amber-200">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-amber-100/80">{message}</p>
      {href && ctaLabel ? (
        <div className="mt-4">
          <Link
            href={href}
            className="inline-flex rounded-xl border border-amber-300/20 px-3 py-2 text-sm text-amber-100/85 transition hover:border-amber-200/30 hover:text-white"
          >
            {ctaLabel}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
