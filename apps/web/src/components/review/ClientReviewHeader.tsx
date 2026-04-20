'use client'

import Link from 'next/link'

export function ClientReviewHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em]" style={{ color: 'rgba(255,255,255,0.22)' }}>Client Review Portal</p>
        <h1 className="text-[28px] font-black mt-2 text-white/92">{title}</h1>
        <p className="text-[13px] mt-2 max-w-3xl leading-[1.7]" style={{ color: 'rgba(255,255,255,0.42)' }}>
          {description}
        </p>
      </div>
      <Link
        href="/create"
        className="px-4 py-2 rounded-2xl text-[11px] font-semibold"
        style={{ background: 'rgba(99,102,241,0.16)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe' }}
      >
        返回创作系统
      </Link>
    </div>
  )
}
