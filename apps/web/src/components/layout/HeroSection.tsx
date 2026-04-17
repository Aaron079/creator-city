'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface Props {
  onGenerate?: (prompt: string) => void
}

const HOT_IDEAS = [
  { label: '🕵️ 赛博侦探', text: '一个侦探在霓虹都市追查消失的 AI' },
  { label: '💔 时间旅行', text: '穿越回去的人发现改变历史的代价是忘记所爱之人' },
  { label: '👑 末日帝国', text: '最后一个帝王在文明废墟中重建秩序的史诗' },
  { label: '🌊 深海禁区', text: '深海研究员发现水下城市的真相与危机' },
  { label: '🤖 AI 觉醒', text: '一个 AI 在意识到自己存在后的第一个选择' },
]

// SSR-safe — no Math.random()
const PARTICLES = [
  { x: 5,  y: 20, s: 6, d: 0,   dur: 7.0, rgb: 'rgba(99,102,241,' },
  { x: 15, y: 62, s: 4, d: 1.5, dur: 5.5, rgb: 'rgba(167,139,250,' },
  { x: 28, y: 35, s: 5, d: 0.8, dur: 6.2, rgb: 'rgba(99,102,241,' },
  { x: 45, y: 78, s: 3, d: 2.5, dur: 4.8, rgb: 'rgba(96,165,250,' },
  { x: 55, y: 14, s: 4, d: 1.0, dur: 7.5, rgb: 'rgba(167,139,250,' },
  { x: 68, y: 55, s: 6, d: 0.3, dur: 6.0, rgb: 'rgba(99,102,241,' },
  { x: 78, y: 30, s: 3, d: 3.0, dur: 5.2, rgb: 'rgba(96,165,250,' },
  { x: 88, y: 68, s: 5, d: 1.8, dur: 7.2, rgb: 'rgba(167,139,250,' },
  { x: 93, y: 44, s: 4, d: 0.5, dur: 5.8, rgb: 'rgba(99,102,241,' },
  { x: 35, y: 90, s: 3, d: 2.0, dur: 6.5, rgb: 'rgba(96,165,250,' },
  { x: 72, y: 8,  s: 4, d: 4.0, dur: 4.5, rgb: 'rgba(167,139,250,' },
  { x: 10, y: 83, s: 5, d: 1.2, dur: 6.8, rgb: 'rgba(99,102,241,' },
]

export function HeroSection({ onGenerate }: Props) {
  const [prompt, setPrompt] = useState('')

  function handleGenerate() {
    if (!prompt.trim()) return
    onGenerate?.(prompt.trim())
    document.getElementById('creator-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="relative flex flex-col items-center justify-center min-h-[92vh] pt-24 pb-16 px-4 text-center overflow-hidden">

      {/* ── Background orbs ─────────────────────────────────────── */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Primary center glow */}
        <div
          className="absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(ellipse, rgba(99,102,241,0.14) 0%, transparent 70%)',
            animation: 'orb-pulse 8s ease-in-out infinite',
          }}
        />
        {/* Left accent */}
        <div
          className="absolute top-[42%] left-[6%] w-[380px] h-[380px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.09) 0%, transparent 70%)' }}
        />
        {/* Right accent */}
        <div
          className="absolute top-[22%] right-[6%] w-[320px] h-[320px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 70%)' }}
        />
        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[180px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)' }}
        />
      </div>

      {/* ── Particles ───────────────────────────────────────────── */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.s}px`,
              height: `${p.s}px`,
              background: `radial-gradient(circle, ${p.rgb}0.9) 0%, ${p.rgb}0) 70%)`,
              boxShadow: `0 0 ${p.s * 5}px ${p.s * 2}px ${p.rgb}0.12)`,
              animation: `particle-drift ${p.dur}s ease-in-out ${p.d}s infinite`,
            }}
          />
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-4xl mx-auto w-full"
      >
        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-gray-400 mb-8 backdrop-blur-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          早期体验中
        </motion.div>

        {/* Main headline — single line, massive, animated gradient */}
        <h1 className="text-[64px] sm:text-[84px] md:text-[104px] font-bold leading-none tracking-tight mb-6 text-gradient-animated">
          AI 创作之城
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-gray-500 max-w-xs mx-auto mb-12 font-light tracking-widest">
          一句话，生成电影级内容
        </p>

        {/* ── Input bar ─────────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto mb-4">
          <div className="relative group">
            {/* Glow ring on focus */}
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-city-accent/50 via-violet-500/30 to-city-accent/50 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-[3px]" />
            <div className="relative flex items-center gap-2 bg-city-surface/90 border border-white/8 rounded-2xl p-2 backdrop-blur-xl shadow-2xl shadow-black/40">
              <input
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder="描述你的故事创意，例如：霓虹都市的侦探…"
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
        </div>

        {/* Quota note */}
        <p className="text-xs text-gray-600 mb-5">每日 3 次免费生成 · 无需注册</p>

        {/* Hot idea chips */}
        <div className="flex gap-2 flex-wrap justify-center mb-10">
          {HOT_IDEAS.map(idea => (
            <button
              key={idea.label}
              onClick={() => {
                setPrompt(idea.text)
                onGenerate?.(idea.text)
                document.getElementById('creator-section')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="text-xs px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/20 text-gray-500 hover:text-gray-300 transition-all duration-200"
            >
              {idea.label}
            </button>
          ))}
        </div>

        {/* Secondary link */}
        <Link href="/city" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">
          探索城市 →
        </Link>
      </motion.div>

      {/* ── Stats ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.8 }}
        className="relative z-10 flex justify-center gap-16 mt-20"
      >
        {([
          ['1 万+',  '创作者'],
          ['50 万+', '生成作品'],
          ['20 万+', 'AI Agent'],
        ] as [string, string][]).map(([v, l]) => (
          <div key={l} className="text-center">
            <div className="text-2xl font-bold text-gradient">{v}</div>
            <div className="text-xs text-gray-600 mt-1 tracking-wide">{l}</div>
          </div>
        ))}
      </motion.div>
    </section>
  )
}
