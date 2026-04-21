'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useShotsStore } from '@/store/shots.store'
import { Onboarding } from '@/components/Onboarding'

// ─── Floating orb ─────────────────────────────────────────────────────────────

function Orb({
  size, top, left, bottom, right, color, blur, delay, duration,
}: {
  size: number; color: string; blur?: number; delay?: number; duration?: number
  top?: string; left?: string; bottom?: string; right?: string
}) {
  return (
    <motion.div
      aria-hidden
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size,
        top, left, bottom, right,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: `blur(${blur ?? 40}px)`,
      }}
      animate={{ scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: duration ?? 14, repeat: Infinity, ease: 'easeInOut', delay: delay ?? 0 }}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const router  = useRouter()
  const [idea, setIdea]     = useState('')
  const [focused, setFocus] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleEnterCanvas = () => {
    router.push('/create')
  }

  const handleQuickGenerate = () => {
    const trimmed = idea.trim()
    if (trimmed) {
      const store = useShotsStore.getState()
      const first = store.shots[0]
      if (first) {
        store.updateShot(first.id, { idea: trimmed })
        store.setCurrentShotId(first.id)
      }
    }
    router.push('/create')
  }

  return (
    <>
      <Onboarding />
      <main
        className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
        style={{ background: '#050810' }}
      >
        {/* ── Background orbs ─────────────────────────────────────────────── */}
        <Orb size={900} top="-220px"    left="-180px"  color="rgba(99,102,241,0.22)"  blur={70} duration={18} delay={0} />
        <Orb size={700} bottom="-180px" right="-120px" color="rgba(168,85,247,0.16)"  blur={70} duration={22} delay={3} />
        <Orb size={420} top="12%"       right="4%"     color="rgba(6,182,212,0.10)"   blur={55} duration={26} delay={6} />
        <Orb size={320} bottom="18%"    left="6%"      color="rgba(244,63,94,0.07)"   blur={55} duration={30} delay={9} />

        {/* Center static glow */}
        <div
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 600, height: 600,
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Subtle grid */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />

        {/* Deep vignette */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 85% 80% at 50% 50%, transparent 20%, #050810 100%)' }}
        />

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="relative z-10 w-full max-w-2xl mx-auto px-6 flex flex-col items-center gap-10 text-center">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.12em] uppercase"
            style={{
              background:     'rgba(255,255,255,0.04)',
              border:         '1px solid rgba(255,255,255,0.1)',
              color:          'rgba(255,255,255,0.38)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <span
              style={{
                width: 5, height: 5,
                borderRadius: '50%',
                background: '#34d399',
                display: 'inline-block',
                boxShadow: '0 0 6px #34d399',
              }}
            />
            Creator City · Professional Studio
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="-mt-2"
          >
            <h1
              className="font-black tracking-tight leading-[1.06] select-none"
              style={{ fontSize: 'clamp(40px, 7vw, 72px)', color: 'rgba(255,255,255,0.93)' }}
            >
              一个属于创作者的
              <br />
              <span className="text-gradient-animated">生产系统</span>
            </h1>
          </motion.div>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="-mt-4 text-[15px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.32)', maxWidth: 480 }}
          >
            从创意到成片，你可以控制每一个镜头与团队协作流程
          </motion.p>

          {/* ── Split cards ─────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 -mt-2"
          >
            {/* PRO 创作 — primary */}
            <motion.button
              onClick={handleEnterCanvas}
              whileHover={{ y: -4, scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative flex flex-col items-start text-left overflow-hidden"
              style={{
                background:     'rgba(16,20,40,0.8)',
                border:         '1px solid rgba(99,102,241,0.28)',
                borderRadius:   20,
                padding:        '28px 28px 24px',
                backdropFilter: 'blur(24px)',
                boxShadow:      '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
                cursor:         'pointer',
              }}
            >
              {/* Ambient glow */}
              <div
                aria-hidden
                style={{
                  position: 'absolute', inset: 0,
                  background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />

              {/* Shimmer */}
              <motion.div
                aria-hidden
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.05) 50%, transparent 65%)',
                  pointerEvents: 'none',
                }}
                animate={{ x: ['-100%', '160%'] }}
                transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
              />

              {/* PRO badge */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 10px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  background: 'rgba(99,102,241,0.18)',
                  border: '1px solid rgba(99,102,241,0.35)',
                  color: '#a5b4fc',
                  marginBottom: 16,
                  position: 'relative',
                }}
              >
                PRO
              </span>

              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.93)',
                  marginBottom: 8,
                  letterSpacing: '-0.02em',
                  position: 'relative',
                }}
              >
                专业创作模式
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.38)',
                  lineHeight: 1.6,
                  marginBottom: 24,
                  position: 'relative',
                }}
              >
                镜头画布 · 团队协作 · 完整制作流程
              </p>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #06b6d4 100%)',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
                  position: 'relative',
                }}
              >
                进入画布
                <span style={{ fontSize: 13, opacity: 0.85 }}>→</span>
              </div>
            </motion.button>

            {/* AI 快速生成 — secondary */}
            <motion.div
              className="flex flex-col"
              style={{ gap: 0 }}
            >
              <motion.button
                onClick={handleQuickGenerate}
                whileHover={{ y: -2, scale: 1.008 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="relative flex flex-col items-start text-left overflow-hidden flex-1"
                style={{
                  background:     'rgba(12,15,28,0.6)',
                  border:         '1px solid rgba(255,255,255,0.07)',
                  borderRadius:   20,
                  padding:        '28px 28px 24px',
                  backdropFilter: 'blur(16px)',
                  boxShadow:      '0 4px 24px rgba(0,0,0,0.4)',
                  cursor:         'pointer',
                  height:         '100%',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.35)',
                    marginBottom: 16,
                  }}
                >
                  AI
                </span>

                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.6)',
                    marginBottom: 8,
                    letterSpacing: '-0.01em',
                  }}
                >
                  快速灵感生成
                </h2>
                <p
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.25)',
                    lineHeight: 1.6,
                    marginBottom: 20,
                  }}
                >
                  描述创意，AI 自动生成团队与报价
                </p>

                {/* Inline input */}
                <div style={{ width: '100%', position: 'relative', marginBottom: 16 }}>
                  <input
                    ref={inputRef}
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickGenerate()}
                    onFocus={() => setFocus(true)}
                    onBlur={() => setFocus(false)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="例：品牌形象短片…"
                    className="w-full outline-none"
                    style={{
                      background:     'rgba(255,255,255,0.04)',
                      border:         focused
                        ? '1px solid rgba(255,255,255,0.2)'
                        : '1px solid rgba(255,255,255,0.07)',
                      borderRadius:   10,
                      padding:        '10px 14px',
                      fontSize:       13,
                      color:          'rgba(255,255,255,0.75)',
                      caretColor:     '#a5b4fc',
                      transition:     'border-color 0.2s',
                    }}
                  />
                  <style>{`.ai-input::placeholder { color: rgba(255,255,255,0.18); }`}</style>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.45)',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.09)',
                  }}
                >
                  快速生成
                  <span style={{ fontSize: 12 }}>→</span>
                </div>
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Footer hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="-mt-4 text-[11px] tracking-wide"
            style={{ color: 'rgba(255,255,255,0.14)' }}
          >
            专业模式支持多人实时协作 · AI 模式适合快速验证创意
          </motion.p>
        </div>
      </main>
    </>
  )
}
