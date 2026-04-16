'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const works = [
  {
    id: '1',
    title: '《暗流》短片',
    type: '短片',
    creator: 'NeonDirector',
    avatar: '🎭',
    likes: 4820,
    views: '32K',
    tags: ['悬疑', '赛博朋克'],
    cover: '🎬',
    bg: 'from-rose-900/40 to-city-bg',
  },
  {
    id: '2',
    title: '城市低语 EP',
    type: '音乐',
    creator: 'SynthWave_Pro',
    avatar: '🎹',
    likes: 3210,
    views: '18K',
    tags: ['Lo-fi', '电子'],
    cover: '🎵',
    bg: 'from-city-gold/20 to-city-bg',
  },
  {
    id: '3',
    title: 'Neon City UI Kit',
    type: '设计',
    creator: 'PixelForge',
    avatar: '✏️',
    likes: 6100,
    views: '45K',
    tags: ['UI', '赛博'],
    cover: '🎨',
    bg: 'from-city-sky/20 to-city-bg',
  },
  {
    id: '4',
    title: '迷失街区 Demo',
    type: '游戏',
    creator: 'IndieGhost',
    avatar: '👾',
    likes: 2980,
    views: '21K',
    tags: ['独立', 'RPG'],
    cover: '🎮',
    bg: 'from-city-emerald/20 to-city-bg',
  },
  {
    id: '5',
    title: '《记忆碎片》剧本',
    type: '剧本',
    creator: 'ScriptMaster_K',
    avatar: '📝',
    likes: 1750,
    views: '9K',
    tags: ['科幻', '惊悚'],
    cover: '📜',
    bg: 'from-city-accent/20 to-city-bg',
  },
]

export function HotWorksSection() {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-transparent via-city-surface/30 to-transparent">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">热门作品</h2>
            <p className="text-gray-400">本周最受关注的创作</p>
          </div>
          <Link
            href="/showcase"
            className="text-city-accent-glow text-sm hover:underline underline-offset-4"
          >
            全部作品 →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {works.map((work, i) => (
            <motion.div
              key={work.id}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07, duration: 0.35 }}
              viewport={{ once: true }}
            >
              <Link
                href={`/showcase/${work.id}`}
                className="block city-card overflow-hidden group h-full"
              >
                {/* Cover */}
                <div
                  className={`-mx-4 -mt-4 h-28 bg-gradient-to-br ${work.bg} flex items-center justify-center mb-4 text-4xl group-hover:scale-105 transition-transform duration-300`}
                >
                  {work.cover}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-city-accent/10 text-city-accent-glow">
                    {work.type}
                  </span>
                </div>

                <h3 className="font-semibold text-sm leading-tight mb-2 group-hover:text-city-accent-glow transition-colors">
                  {work.title}
                </h3>

                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-base">{work.avatar}</span>
                  <span className="text-xs text-gray-400">{work.creator}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>❤️ {work.likes.toLocaleString()}</span>
                  <span>👁 {work.views}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
