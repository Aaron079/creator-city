import Link from 'next/link'
import type { HomeContentCardItem } from '@/lib/home/content'

interface ContentCardProps {
  item: HomeContentCardItem
  compact?: boolean
}

export function ContentCard({ item, compact = false }: ContentCardProps) {
  return (
    <Link
      href={item.href}
      className={`group block overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.03] backdrop-blur-[24px] transition hover:border-white/18 hover:bg-white/[0.05] ${
        compact ? 'min-w-[250px]' : ''
      }`}
    >
      <div className={`relative overflow-hidden ${compact ? 'h-36' : 'h-44'}`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient}`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_36%)]" />
        <div className="absolute left-4 top-4 rounded-full border border-white/12 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/55">
          {item.type}
        </div>
      </div>

      <div className="p-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/36">{item.meta}</div>
        <h3 className="mt-3 text-lg font-light tracking-[-0.03em] text-white">{item.title}</h3>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/44"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-4 text-sm text-white/52">{item.metric}</div>
      </div>
    </Link>
  )
}
