'use client'

import Link from 'next/link'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export function BreadcrumbHeader({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="transition hover:text-white/75">
              {item.label}
            </Link>
          ) : (
            <span className="text-white/65">{item.label}</span>
          )}
          {index < items.length - 1 ? <span className="text-white/20">/</span> : null}
        </div>
      ))}
    </div>
  )
}
