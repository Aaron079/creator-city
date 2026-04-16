'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const districts = [
  {
    id: 'film-district',
    name: '影视区',
    subtitle: 'Film District',
    icon: '🎬',
    color: 'from-rose-500/20 to-city-accent/10',
    border: 'hover:border-rose-500/40',
    glow: 'hover:shadow-rose-500/20',
    description: '剧本、拍摄、剪辑、发行，完整影视制作流水线',
    active: 2340,
    projects: 890,
    href: '/city?district=film',
  },
  {
    id: 'music-district',
    name: '音乐区',
    subtitle: 'Music District',
    icon: '🎵',
    color: 'from-city-gold/20 to-city-accent/10',
    border: 'hover:border-city-gold/40',
    glow: 'hover:shadow-city-gold/20',
    description: '作曲、编曲、混音、专辑制作，全流程音乐工房',
    active: 1820,
    projects: 650,
    href: '/city?district=music',
  },
  {
    id: 'design-district',
    name: '设计区',
    subtitle: 'Design District',
    icon: '🎨',
    color: 'from-city-sky/20 to-city-accent/10',
    border: 'hover:border-city-sky/40',
    glow: 'hover:shadow-city-sky/20',
    description: '平面、UI/UX、插画、3D 建模，视觉创意聚集地',
    active: 3100,
    projects: 1240,
    href: '/city?district=design',
  },
  {
    id: 'games-district',
    name: '游戏区',
    subtitle: 'Games District',
    icon: '🎮',
    color: 'from-city-emerald/20 to-city-accent/10',
    border: 'hover:border-city-emerald/40',
    glow: 'hover:shadow-city-emerald/20',
    description: '独立游戏、关卡设计、剧情创作，玩家与开发者共建',
    active: 2780,
    projects: 740,
    href: '/city?district=games',
  },
]

export function CityEntrySection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">进入创作城市</h2>
            <p className="text-gray-400">选择你的创作区域，开始建造</p>
          </div>
          <Link
            href="/city"
            className="text-city-accent-glow text-sm hover:underline underline-offset-4 transition-all"
          >
            查看完整城市图 →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {districts.map((district, i) => (
            <motion.div
              key={district.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              viewport={{ once: true }}
            >
              <Link
                href={district.href}
                className={`block city-card bg-gradient-to-br ${district.color} ${district.border} hover:shadow-lg ${district.glow} transition-all duration-300 group h-full`}
              >
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-200">
                  {district.icon}
                </div>
                <h3 className="text-lg font-bold mb-0.5">{district.name}</h3>
                <p className="text-xs text-gray-500 mb-3">{district.subtitle}</p>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">
                  {district.description}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500 border-t border-white/5 pt-3">
                  <span>
                    <span className="text-city-emerald font-medium">{district.active.toLocaleString()}</span> 在线
                  </span>
                  <span>
                    <span className="text-city-accent-glow font-medium">{district.projects.toLocaleString()}</span> 项目
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
