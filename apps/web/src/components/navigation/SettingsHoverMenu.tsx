'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Settings } from 'lucide-react'
import Link from 'next/link'

const MENU_ITEMS = [
  {
    href: '/settings',
    label: '设置中心',
    desc: '管理账号、偏好与团队入口',
  },
  {
    href: '/providers',
    label: 'API 中心',
    desc: '查看模型与 Provider 状态',
  },
  {
    href: '/help',
    label: '诊断帮助',
    desc: '排查生成、OSS、登录问题',
  },
  {
    href: '/tasks',
    label: '任务中心',
    desc: '查看图片/视频生成记录',
  },
  {
    href: '/marketplace',
    label: '创作者市场',
    desc: '浏览创作者服务与项目需求',
  },
] as const

export function SettingsHoverMenu() {
  const [open, setOpen] = useState(false)
  const [hoveredHref, setHoveredHref] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    openTimer.current = setTimeout(() => setOpen(true), 80)
  }

  function scheduleClose() {
    if (openTimer.current) clearTimeout(openTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 160)
  }

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={`canvas-toolbar-button${open ? ' is-active' : ''}`}
        aria-label="设置菜单"
        aria-haspopup="true"
        aria-expanded={open}
        style={{ opacity: open ? 1 : 0.72, transition: 'opacity 0.15s' }}
      >
        <Settings size={20} strokeWidth={2} />
        <span className="canvas-hover-tooltip" aria-hidden="true">设置</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="设置菜单"
            initial={{ opacity: 0, x: -10, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.97 }}
            transition={{ duration: 0.19, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              position: 'absolute',
              left: 'calc(100% + 12px)',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 252,
              background: 'rgba(8, 10, 18, 0.88)',
              backdropFilter: 'blur(22px)',
              WebkitBackdropFilter: 'blur(22px)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 20,
              boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 12px rgba(0,0,0,0.30)',
              padding: '8px 6px',
              zIndex: 1200,
            }}
          >
            <div
              style={{
                padding: '5px 10px 8px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.32)',
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                }}
              >
                设置
              </span>
            </div>

            {MENU_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  padding: '9px 12px',
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: '#fff',
                  background:
                    hoveredHref === item.href
                      ? 'rgba(255,255,255,0.07)'
                      : 'transparent',
                  transform:
                    hoveredHref === item.href ? 'translateX(2px)' : 'none',
                  transition: 'background 0.12s ease, transform 0.12s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredHref(item.href)}
                onMouseLeave={() => setHoveredHref(null)}
              >
                <span
                  style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.42)',
                    lineHeight: 1.35,
                  }}
                >
                  {item.desc}
                </span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
