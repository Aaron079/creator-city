'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Nav } from '@/components/layout/Nav'

const WORKS = [
  { id:'1',  title:'《暗流》',      sub:'赛博悬疑短片',    creator:'NeonDirector',    tags:['悬疑','赛博朋克'], icon:'🎬', likes:'4.8K', views:'32K', from:'#1f0508', accent:'#f43f5e' },
  { id:'2',  title:'城市低语 EP',   sub:'Lo-fi 电子音乐',  creator:'SynthWave_Pro',   tags:['Lo-fi','电子'],   icon:'🎵', likes:'3.2K', views:'18K', from:'#1a1200', accent:'#f59e0b' },
  { id:'3',  title:'Neon City UI',  sub:'赛博风设计系统',   creator:'PixelForge',      tags:['UI','设计'],      icon:'🎨', likes:'6.1K', views:'45K', from:'#021320', accent:'#0ea5e9' },
  { id:'4',  title:'《迷失街区》',   sub:'独立像素RPG',     creator:'IndieGhost',      tags:['游戏','独立'],    icon:'🎮', likes:'2.9K', views:'21K', from:'#041a0c', accent:'#10b981' },
  { id:'5',  title:'《记忆碎片》',   sub:'科幻惊悚剧本',    creator:'ScriptMaster_K',  tags:['科幻','惊悚'],    icon:'📜', likes:'1.7K', views:'9K',  from:'#0c0818', accent:'#818cf8' },
  { id:'6',  title:'《霓虹黎明》',   sub:'史诗级剧情动画',  creator:'VisionArc',       tags:['动画','史诗'],    icon:'🌅', likes:'5.4K', views:'38K', from:'#120a1a', accent:'#a78bfa' },
  { id:'7',  title:'《末日协议》',   sub:'动作科幻长片',    creator:'CinemaForge',     tags:['动作','科幻'],    icon:'🚀', likes:'8.2K', views:'61K', from:'#0a1220', accent:'#60a5fa' },
  { id:'8',  title:'深海序曲',      sub:'器乐概念专辑',    creator:'OceanSound',      tags:['音乐','概念'],    icon:'🌊', likes:'2.1K', views:'14K', from:'#021215', accent:'#22d3ee' },
  { id:'9',  title:'《断层》',      sub:'心理悬疑短片',    creator:'MindFrame',       tags:['悬疑','心理'],    icon:'🧠', likes:'3.7K', views:'27K', from:'#1a0a10', accent:'#fb7185' },
]

const FILTERS = ['全部', '短片', '音乐', '设计', '游戏', '剧本']

export default function ExplorePage() {
  const [active, setActive] = useState('全部')

  return (
    <main className="min-h-screen bg-city-bg">
      <Nav />

      <div className="pt-14">
        {/* Page header */}
        <div className="px-6 py-10 border-b border-white/[0.05]">
          <div className="max-w-6xl mx-auto">
            <p className="text-xs text-city-accent-glow tracking-[0.2em] uppercase mb-2 font-medium">Explore</p>
            <h1 className="text-3xl font-bold tracking-tight mb-6">发现热门作品</h1>

            {/* Filter pills */}
            <div className="flex gap-2 flex-wrap">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setActive(f)}
                  className={`px-4 py-1.5 rounded-full text-sm transition-all duration-200 ${
                    active === f
                      ? 'bg-city-accent text-white font-medium'
                      : 'bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Works grid */}
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {WORKS.map((work, i) => (
              <motion.div
                key={work.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                viewport={{ once: true }}
              >
                <Link
                  href={`/showcase/${work.id}`}
                  className="group relative block rounded-xl overflow-hidden hover:scale-[1.02] transition-all duration-400"
                  style={{ aspectRatio: '3 / 4' }}
                >
                  {/* Background */}
                  <div className="absolute inset-0" style={{
                    background: `linear-gradient(160deg, ${work.from} 0%, #0a0f1a 100%)`,
                  }} />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
                  <div className="absolute inset-0 rounded-xl border border-white/[0.06] group-hover:border-white/[0.14] transition-colors pointer-events-none" />

                  {/* Icon */}
                  <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
                    <span className="text-5xl transition-all duration-500 group-hover:scale-110"
                      style={{ opacity: 0.1 }}>
                      {work.icon}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="absolute top-3 left-3 flex gap-1">
                    {work.tags.slice(0, 1).map(t => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/50 text-gray-400 border border-white/10">
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 px-3 pt-10 pb-3 bg-gradient-to-t from-black/95 to-transparent">
                    <p className="text-xs font-bold text-white leading-tight mb-0.5 truncate">{work.title}</p>
                    <p className="text-[9px] mb-2 font-medium truncate" style={{ color: work.accent }}>{work.sub}</p>
                    <div className="flex items-center justify-between text-[9px] text-gray-500">
                      <span className="truncate">{work.creator}</span>
                      <span>♥ {work.likes}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
