'use client'

import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'

const FULL_SCREEN_PATHS = ['/create']

interface Props {
  children: React.ReactNode
}

export function PageTransition({ children }: Props) {
  const pathname = usePathname()
  const isFullScreen = FULL_SCREEN_PATHS.some((p) => pathname.startsWith(p))

  return (
    <div className="relative" style={{ isolation: 'isolate' }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            willChange: 'opacity',
            ...(isFullScreen ? { height: '100vh' } : {}),
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
