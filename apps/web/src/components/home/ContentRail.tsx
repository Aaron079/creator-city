import Link from 'next/link'
import { ContentCard } from '@/components/home/ContentCard'
import type { HomeContentCardItem, HomeContentRail } from '@/lib/home/content'

interface ContentRailProps {
  title: string
  description: string
  href: string
  items: HomeContentCardItem[]
}

export function ContentRail({ title, description, href, items }: ContentRailProps) {
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-light tracking-[-0.04em] text-white">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-white/50">{description}</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
        >
          查看全部
        </Link>
      </div>

      <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} compact />
        ))}
      </div>
    </section>
  )
}

export function ContentRails({ rails }: { rails: HomeContentRail[] }) {
  return (
    <>
      {rails.map((rail) => (
        <ContentRail
          key={rail.id}
          title={rail.title}
          description={rail.description}
          href={rail.href}
          items={rail.items}
        />
      ))}
    </>
  )
}
