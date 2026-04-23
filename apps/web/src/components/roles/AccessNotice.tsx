'use client'

import Link from 'next/link'

export function AccessNotice({
  title,
  message,
  href,
  ctaLabel,
  secondaryHref,
  secondaryLabel,
  details,
}: {
  title: string
  message: string
  href?: string
  ctaLabel?: string
  secondaryHref?: string
  secondaryLabel?: string
  details?: string[]
}) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
      <div className="text-sm font-semibold text-amber-200">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-amber-100/80">{message}</p>
      {details && details.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-amber-100/70">
          {details.map((detail) => (
            <li key={detail}>• {detail}</li>
          ))}
        </ul>
      ) : null}
      {href && ctaLabel ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={href}
            className="inline-flex rounded-xl border border-amber-300/20 px-3 py-2 text-sm text-amber-100/85 transition hover:border-amber-200/30 hover:text-white"
          >
            {ctaLabel}
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
    </div>
  )
}
