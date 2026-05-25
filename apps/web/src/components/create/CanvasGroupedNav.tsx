'use client'

import { useEffect, useRef, useState } from 'react'

interface CanvasGroupedNavProps {
  onOpenProjects: () => void
}

type GroupId = 'manage' | 'system' | null

const MENU_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  minWidth: 140,
  background: 'rgba(18,18,26,0.98)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '4px 0',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  zIndex: 1200,
}

const ITEM_BASE: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 14px',
  fontSize: 13,
  color: 'rgba(255,255,255,0.75)',
  textDecoration: 'none',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

function MenuItem({ href, children, onClick }: { href?: string; children: React.ReactNode; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  const style: React.CSSProperties = { ...ITEM_BASE, background: hovered ? 'rgba(255,255,255,0.07)' : 'transparent', color: hovered ? '#fff' : 'rgba(255,255,255,0.75)' }
  if (href) {
    return (
      <a href={href} style={style} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" style={style} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {children}
    </button>
  )
}

const DIVIDER: React.CSSProperties = { height: 1, background: 'rgba(255,255,255,0.07)', margin: '3px 8px' }

export function CanvasGroupedNav({ onOpenProjects }: CanvasGroupedNavProps) {
  const [openGroup, setOpenGroup] = useState<GroupId>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenGroup(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function toggle(id: GroupId) {
    setOpenGroup((prev) => (prev === id ? null : id))
  }

  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {/* 工作台 — direct link */}
      <a href="/dashboard" className="canvas-nav-link" title="工作台">
        工作台
      </a>

      {/* 管理 ▾ */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className={`canvas-nav-link${openGroup === 'manage' ? ' is-active' : ''}`}
          onClick={() => toggle('manage')}
          aria-expanded={openGroup === 'manage'}
          aria-haspopup="true"
        >
          管理
          <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.6 }}>▾</span>
        </button>
        {openGroup === 'manage' ? (
          <div style={MENU_STYLE} data-no-node-drag="true">
            <MenuItem onClick={() => { onOpenProjects(); setOpenGroup(null) }}>项目中心</MenuItem>
            <MenuItem href="/assets">资产中心</MenuItem>
            <MenuItem href="/tasks">生成任务</MenuItem>
            <div style={DIVIDER} />
            <MenuItem href="/community">社区</MenuItem>
          </div>
        ) : null}
      </div>

      {/* 系统 ▾ */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className={`canvas-nav-link${openGroup === 'system' ? ' is-active' : ''}`}
          onClick={() => toggle('system')}
          aria-expanded={openGroup === 'system'}
          aria-haspopup="true"
        >
          系统
          <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.6 }}>▾</span>
        </button>
        {openGroup === 'system' ? (
          <div style={MENU_STYLE} data-no-node-drag="true">
            <MenuItem href="/providers">API 中心</MenuItem>
          </div>
        ) : null}
      </div>
    </div>
  )
}
