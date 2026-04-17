'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const FEATURED = [
  {
    id: '1',
    title: '《暗流》',
    sub: '赛博悬疑短片',
    creator: 'NeonDirector',
    tags: ['悬疑', '赛博朋克'],
    icon: '🎬',
    likes: '4.8K',
    views: '32K',
    fromColor: '#1f0508',
    accentColor: '#f43f5e',
  },
  {
    id: '3',
    title: 'Neon City',
    sub: 'UI 设计作品集',
    creator: 'PixelForge',
    tags: ['UI', '赛博'],
    icon: '🎨',
    likes: '6.1K',
    views: '45K',
    fromColor: '#030e1c',
    accentColor: '#0ea5e9',
  },
  {
    id: '5',
    title: '《记忆碎片》',
    sub: '科幻惊悚剧本',
    creator: 'ScriptMaster_K',
    tags: ['科幻', '惊悚'],
    icon: '📜',
    likes: '1.7K',
    views: '9K',
    fromColor: '#0c0818',
    accentColor: '#818cf8',
  },
]

export function HotWorksSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Section header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs text-city-accent-glow tracking-[0.2em] uppercase mb-2 font-medium">
              Featured Works
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">热门作品</h2>
          </div>
          <Link
            href="/showcase"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            全部 →
          </Link>
        </div>

        {/* Cinematic poster grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURED.map((work, i) => (
            <motion.div
              key={work.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true }}
            >
              <Link
                href={`/showcase/${work.id}`}
                className="group relative block rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.02]"
                style={{ aspectRatio: '3 / 4' }}
              >
                {/* Cinematic gradient background */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(160deg, ${work.fromColor} 0%, #0a0f1a 100%)`,
                  }}
                />

                {/* Inner vignette */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />

                {/* Subtle border */}
                <div
                  className="absolute inset-0 rounded-2xl border border-white/[0.06] group-hover:border-white/[0.12] transition-colors duration-500 pointer-events-none"
                />

                {/* Large center icon — very subtle background element */}
                <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
                  <span
                    className="text-[90px] transition-all duration-700 group-hover:scale-110"
                    style={{ opacity: 0.08, filter: 'blur(1px)' }}
                  >
                    {work.icon}
                  </span>
                </div>

                {/* Accent color halo */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[60px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none"
                  style={{ background: work.accentColor }}
                />

                {/* Top tags */}
                <div className="absolute top-4 left-4 flex gap-1.5">
                  {work.tags.map(t => (
                    <span
                      key={t}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-black/50 text-gray-400 border border-white/10 backdrop-blur-sm"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {/* Bottom text overlay */}
                <div className="absolute bottom-0 left-0 right-0 px-5 pt-20 pb-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                  <h3 className="text-xl font-bold text-white leading-tight mb-0.5 tracking-tight">
                    {work.title}
                  </h3>
                  <p className="text-xs mb-3 font-medium" style={{ color: work.accentColor }}>
                    {work.sub}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{work.creator}</span>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>♥ {work.likes}</span>
                      <span>· {work.views}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
