'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Nav } from '@/components/layout/Nav'

const NAV_ENTRIES = [
  { href: '/create',    symbol: '✦', title: 'Create',    desc: '生成电影级内容',  color: 'text-city-accent-glow', glow: 'rgba(99,102,241,0.15)' },
  { href: '/explore',   symbol: '◎', title: 'Explore',   desc: '发现热门作品',   color: 'text-city-sky',         glow: 'rgba(14,165,233,0.15)' },
  { href: '/community', symbol: '◈', title: 'Community', desc: '创作者社区',     color: 'text-city-emerald',     glow: 'rgba(16,185,129,0.15)' },
  { href: '/studio',    symbol: '◇', title: 'Studio',    desc: '我的工作室',     color: 'text-city-gold',        glow: 'rgba(245,158,11,0.15)' },
]

// SSR-safe particles
const PARTICLES = [
  { x: 8,  y: 18, s: 5, d: 0,   dur: 7.0, rgb: 'rgba(99,102,241,' },
  { x: 20, y: 65, s: 4, d: 1.5, dur: 5.5, rgb: 'rgba(167,139,250,' },
  { x: 35, y: 30, s: 6, d: 0.8, dur: 6.2, rgb: 'rgba(99,102,241,' },
  { x: 55, y: 80, s: 3, d: 2.5, dur: 4.8, rgb: 'rgba(96,165,250,' },
  { x: 70, y: 15, s: 4, d: 1.0, dur: 7.5, rgb: 'rgba(167,139,250,' },
  { x: 80, y: 55, s: 5, d: 0.3, dur: 6.0, rgb: 'rgba(99,102,241,' },
  { x: 90, y: 35, s: 3, d: 3.0, dur: 5.2, rgb: 'rgba(96,165,250,' },
  { x: 15, y: 85, s: 4, d: 1.8, dur: 7.2, rgb: 'rgba(167,139,250,' },
]

export default function HomePage() {
  const [prompt, setPrompt] = useState('')
  const router = useRouter()

  function handleGenerate() {
    if (!prompt.trim()) return
    router.push(`/create?prompt=${encodeURIComponent(prompt.trim())}`)
  }

  return (
    <main className="min-h-screen bg-city-bg overflow-hidden">
      <Nav />

      {/* Background orbs */}
      <div aria-hidden className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.13) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-[6%] w-[380px] h-[380px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)' }} />
        <div className="absolute top-[28%] right-[6%] w-[320px] h-[320px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)' }} />
      </div>

      {/* Particles */}
      <div aria-hidden className="fixed inset-0 pointer-events-none">
        {PARTICLES.map((p, i) => (
          <div key={i} className="absolute rounded-full" style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: `${p.s}px`, height: `${p.s}px`,
            background: `radial-gradient(circle, ${p.rgb}0.9) 0%, ${p.rgb}0) 70%)`,
            boxShadow: `0 0 ${p.s * 5}px ${p.s * 2}px ${p.rgb}0.1)`,
            animation: `particle-drift ${p.dur}s ease-in-out ${p.d}s infinite`,
          }} />
        ))}
      </div>

      {/* Center content */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center pt-14">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl w-full"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-1.5 text-sm text-gray-400 mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            早期体验中
          </motion.div>

          {/* Headline */}
          <h1 className="text-[68px] sm:text-[88px] md:text-[108px] font-bold leading-none tracking-tight mb-6 text-gradient-animated">
            AI 创作之城
          </h1>

          <p className="text-lg text-gray-500 mb-14 font-light tracking-widest">
            一句话，生成电影级内容
          </p>

          {/* Input */}
          <div className="relative group max-w-xl mx-auto mb-16">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-city-accent/50 via-violet-500/30 to-city-accent/50 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-[3px]" />
            <div className="relative flex items-center gap-2 bg-city-surface/90 border border-white/[0.08] rounded-2xl p-2 backdrop-blur-xl shadow-2xl shadow-black/40">
              <input
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder="描述你的故事创意…"
                className="flex-1 bg-transparent px-4 py-4 text-base text-white placeholder-gray-600 focus:outline-none"
              />
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim()}
                className="flex-shrink-0 px-7 py-4 rounded-xl bg-city-accent disabled:opacity-25 disabled:cursor-not-allowed text-white text-sm font-semibold tracking-wide transition-all duration-200 hover:bg-city-accent-glow hover:shadow-lg hover:shadow-city-accent/40 hover:-translate-y-px active:scale-[0.98]"
              >
                立即生成
              </button>
            </div>
          </div>

          {/* 4 nav entry cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {NAV_ENTRIES.map((e, i) => (
              <motion.div
                key={e.href}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={e.href}
                  className="group flex flex-col items-center gap-2 py-6 px-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-300 hover:-translate-y-0.5"
                  style={{ boxShadow: 'none' }}
                  onMouseEnter={ev => {
                    ;(ev.currentTarget as HTMLAnchorElement).style.boxShadow = `0 8px 32px ${e.glow}`
                  }}
                  onMouseLeave={ev => {
                    ;(ev.currentTarget as HTMLAnchorElement).style.boxShadow = 'none'
                  }}
                >
                  <span className={`text-2xl font-thin leading-none ${e.color}`}>{e.symbol}</span>
                  <span className="text-sm font-semibold text-white">{e.title}</span>
                  <span className="text-xs text-gray-500">{e.desc}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>
    </main>
  )
}
