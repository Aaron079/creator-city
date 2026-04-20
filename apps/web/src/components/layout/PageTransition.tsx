'use client'

import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'

const FULL_SCREEN_PATHS = ['/create']

// Shared easing — "柔顺弹出" feel, closer to Apple/Vercel
const ENTER_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
// EXIT_EASE kept as reference for future exit-y tweaks
// const EXIT_EASE: [number, number, number, number] = [0.36, 0, 0.66, 0]

interface Props {
  children: React.ReactNode
}

export function PageTransition({ children }: Props) {
  const pathname    = usePathname()
  const isFullScreen = FULL_SCREEN_PATHS.some((p) => pathname.startsWith(p))

  return (
    // Outer wrapper keeps body height stable during transition
    <div className="relative" style={{ isolation: 'isolate' }}>

      {/* ── Main page wrapper ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}

          initial={{
            opacity: 0,
            y:       isFullScreen ? 0 : 20,
            scale:   isFullScreen ? 1 : 1.015,
          }}
          animate={{
            opacity: 1,
            y:       0,
            scale:   1,
          }}
          exit={{
            opacity: 0,
            y:       isFullScreen ? 0 : 0,     // no exit-y shift — cleaner "cut"
            scale:   isFullScreen ? 1 : 0.98,  // slight shrink on exit = depth
          }}

          transition={{
            opacity: { duration: 0.4, ease: ENTER_EASE },
            y:       { duration: 0.4, ease: ENTER_EASE },
            scale:   { duration: 0.4, ease: ENTER_EASE },
          }}

          style={{
            // Film-lens spatial hint
            transformOrigin:  'center top',
            willChange:       'transform, opacity',
            // Full-screen canvas pages must fill the viewport
            ...(isFullScreen ? { height: '100vh' } : {}),
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* ── Light-sweep overlay ("光扫") ─────────────────────────────── */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`sweep-${pathname}`}
          aria-hidden
          initial={{ opacity: 0, x: '-10%' }}
          animate={{ opacity: 1, x:  '10%' }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position:   'fixed',
            inset:      0,
            background: 'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.04) 40%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.04) 60%, transparent 100%)',
            pointerEvents: 'none',
            zIndex:     9998,
            willChange: 'transform, opacity',
          }}
        />
      </AnimatePresence>

      {/* ── Dark-flash overlay ("暗场") ───────────────────────────────── */}
      {/* Sits above content, pointer-events-none so nothing is blocked.
          Flashes on every key change — simulates a cinematic cut flash.  */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`flash-${pathname}`}
          aria-hidden
          initial={{ opacity: 0.06 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            position:       'fixed',
            inset:          0,
            background:     '#000',
            pointerEvents:  'none',
            zIndex:         9999,
            willChange:     'opacity',
          }}
        />
      </AnimatePresence>

    </div>
  )
}
