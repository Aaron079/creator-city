'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { HomeFeaturedItem } from '@/lib/home/content'

interface FeaturedCarouselProps {
  items: HomeFeaturedItem[]
}

export function FeaturedCarousel({ items }: FeaturedCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const visibleItems = items.map((item, index) => ({
    ...item,
    offset: (index - activeIndex + items.length) % items.length,
  }))

  return (
    <section className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-[28px] md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Featured</div>
          <h2 className="mt-3 text-3xl font-light tracking-[-0.04em] text-white">本周精选入口</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveIndex((current) => (current - 1 + items.length) % items.length)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition hover:border-white/20 hover:text-white"
            aria-label="Previous feature"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setActiveIndex((current) => (current + 1) % items.length)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition hover:border-white/20 hover:text-white"
            aria-label="Next feature"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {visibleItems.map((item) => (
          <article
            key={item.id}
            className={`overflow-hidden rounded-[28px] border transition ${
              item.offset === 0
                ? 'border-white/14 bg-white/[0.05]'
                : 'border-white/8 bg-black/20'
            }`}
          >
            <div className="relative h-64 overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient}`} />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_36%)]" />
              <div className="absolute left-5 top-5 rounded-full border border-white/12 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/55">
                {item.category}
              </div>
            </div>

            <div className="p-6">
              <h3 className="text-2xl font-light tracking-[-0.04em] text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/55">{item.summary}</p>
              <Link
                href={item.href}
                className="mt-6 inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/80 transition hover:border-white/20 hover:text-white"
              >
                {item.cta}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`h-2.5 rounded-full transition ${
              index === activeIndex ? 'w-8 bg-white/80' : 'w-2.5 bg-white/20'
            }`}
            aria-label={`Show ${item.title}`}
          />
        ))}
      </div>
    </section>
  )
}
