'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STORAGE_KEY = 'seenOnboarding'

const STEPS = [
  {
    icon: '✏️',
    title: '描述你的创意',
    desc: '一句话说清楚你的项目想法，AI 就能理解你的意图。',
    accent: 'rgba(99,102,241,0.8)',
    glow:   'rgba(99,102,241,0.25)',
  },
  {
    icon: '👥',
    title: 'AI 自动匹配团队',
    desc: '系统从创作者城市挑选最合适的导演、摄影、剪辑组合。',
    accent: 'rgba(139,92,246,0.8)',
    glow:   'rgba(139,92,246,0.25)',
  },
  {
    icon: '⚡',
    title: '一键启动项目',
    desc: '任务拆解、报价预算、团队组建全部自动完成，立即开工。',
    accent: 'rgba(6,182,212,0.8)',
    glow:   'rgba(6,182,212,0.25)',
  },
] as const

export function Onboarding() {
  const [visible, setVisible] = useState(false)
  const [step, setStep]       = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  const dismiss = () => {
    setLeaving(true)
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, 'true')
      setVisible(false)
      setLeaving(false)
    }, 350)
  }

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else dismiss()
  }

  if (!visible) return null

  const current = STEPS[step] ?? STEPS[0]

  return (
    <AnimatePresence>
      {!leaving && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ob-backdrop"
            className="fixed inset-0 z-[9000] pointer-events-auto"
            style={{ background: 'rgba(5,8,16,0.82)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={dismiss}
          />

          {/* Modal */}
          <motion.div
            key="ob-modal"
            className="fixed z-[9001] inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="pointer-events-auto relative flex flex-col items-center text-center"
              style={{
                width:        420,
                maxWidth:     'calc(100vw - 32px)',
                background:   'rgba(12,16,28,0.92)',
                border:       '1px solid rgba(255,255,255,0.08)',
                borderRadius: 24,
                boxShadow:    `0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 80px ${current.glow}`,
                padding:      '44px 36px 36px',
                backdropFilter: 'blur(32px)',
                overflow:     'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Ambient glow behind icon */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: -60, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 240, height: 240,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${current.glow} 0%, transparent 70%)`,
                  filter: 'blur(32px)',
                  transition: 'background 0.5s ease',
                  pointerEvents: 'none',
                }}
              />

              {/* Step dots */}
              <div className="flex items-center gap-2 mb-8">
                {STEPS.map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      width:      i === step ? 20 : 6,
                      background: i === step ? current.accent : 'rgba(255,255,255,0.18)',
                    }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: 6, borderRadius: 3 }}
                  />
                ))}
              </div>

              {/* Icon */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`icon-${step}`}
                  initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
                  animate={{ opacity: 1, scale: 1,   rotate: 0   }}
                  exit={{    opacity: 0, scale: 0.7,  rotate: 8   }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontSize: 48,
                    lineHeight: 1,
                    marginBottom: 20,
                    filter: 'drop-shadow(0 0 16px rgba(255,255,255,0.15))',
                  }}
                >
                  {current.icon}
                </motion.div>
              </AnimatePresence>

              {/* Title */}
              <AnimatePresence mode="wait">
                <motion.h2
                  key={`title-${step}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0  }}
                  exit={{    opacity: 0, y: -8  }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: 'rgba(255,255,255,0.94)',
                    marginBottom: 10,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {current.title}
                </motion.h2>
              </AnimatePresence>

              {/* Description */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={`desc-${step}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0  }}
                  exit={{    opacity: 0, y: -6  }}
                  transition={{ duration: 0.28, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: 'rgba(255,255,255,0.4)',
                    marginBottom: 32,
                    maxWidth: 300,
                  }}
                >
                  {current.desc}
                </motion.p>
              </AnimatePresence>

              {/* CTA button */}
              <motion.button
                onClick={next}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.18 }}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  borderRadius: 14,
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 15,
                  color: '#fff',
                  cursor: 'pointer',
                  background: `linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #06b6d4 100%)`,
                  boxShadow: `0 6px 32px rgba(99,102,241,0.5)`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Shimmer */}
                <motion.span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)',
                    pointerEvents: 'none',
                  }}
                  animate={{ x: ['-100%', '160%'] }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }}
                />
                <span style={{ position: 'relative' }}>
                  {step < STEPS.length - 1 ? '下一步 →' : '开始体验 ⚡'}
                </span>
              </motion.button>

              {/* Skip */}
              <motion.button
                onClick={dismiss}
                whileHover={{ color: 'rgba(255,255,255,0.5)' }}
                style={{
                  marginTop: 14,
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.22)',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  padding: '4px 8px',
                  transition: 'color 0.2s',
                }}
              >
                跳过引导
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
