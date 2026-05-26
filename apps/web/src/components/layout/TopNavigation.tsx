'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { clientLogout } from '@/lib/auth/client'
import { useCurrentUser } from '@/lib/auth/use-current-user'

type NavItem = { label: string; href: string; badge?: string }
type NavGroup = { label: string; key: string; items: NavItem[] }
type SearchItem = { label: string; href: string; group: string; keywords: string[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: '创作', key: 'create',
    items: [
      { label: 'AI 画布', href: '/create' },
      { label: 'Canvas V2', href: '/create-v2', badge: 'Beta' },
      { label: '生成任务', href: '/tasks' },
      { label: 'API 中心', href: '/providers' },
    ],
  },
  {
    label: '市场', key: 'market',
    items: [
      { label: '市场总览', href: '/marketplace-preview' },
      { label: '创作者主页', href: '/creator-profile-preview' },
      { label: '需求广场', href: '/demand-board-preview' },
      { label: '报价方案', href: '/proposal-flow-preview' },
      { label: '阶段交付', href: '/milestone-delivery-preview' },
      { label: '托管结算', href: '/escrow-preview' },
    ],
  },
  {
    label: '工作台', key: 'workspace',
    items: [
      { label: '项目中心', href: '/projects' },
      { label: '资产中心', href: '/assets' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    label: '平台', key: 'platform',
    items: [
      { label: '路线图', href: '/roadmap' },
      { label: '商业模式', href: '/pricing-preview' },
      { label: '协议版权', href: '/terms-preview' },
      { label: '本地部署', href: '/local-deploy-preview' },
      { label: '企业版', href: '/enterprise-preview' },
    ],
  },
  {
    label: '社区与帮助', key: 'community',
    items: [
      { label: '社区', href: '/community' },
      { label: '诊断帮助', href: '/help' },
    ],
  },
]

const NAV_SEARCH_ITEMS: SearchItem[] = [
  { label: 'AI 画布', href: '/create', group: '创作', keywords: ['创作', '生成', '画布', 'canvas', 'image', 'video'] },
  { label: '生成任务', href: '/tasks', group: '创作', keywords: ['任务', '生成', 'status'] },
  { label: 'API 中心', href: '/providers', group: '创作', keywords: ['api', 'provider', '模型'] },
  { label: '市场总览', href: '/marketplace-preview', group: '市场', keywords: ['市场', '交易', '创作者市场'] },
  { label: '创作者主页', href: '/creator-profile-preview', group: '市场', keywords: ['创作者', '作品集', '主页'] },
  { label: '需求广场', href: '/demand-board-preview', group: '市场', keywords: ['需求', 'brief', '项目方'] },
  { label: '报价方案', href: '/proposal-flow-preview', group: '市场', keywords: ['报价', '方案', 'proposal'] },
  { label: '阶段交付', href: '/milestone-delivery-preview', group: '市场', keywords: ['交付', '里程碑', '验收'] },
  { label: '托管结算', href: '/escrow-preview', group: '市场', keywords: ['托管', '结算', '抽佣', '支付预览'] },
  { label: '项目中心', href: '/projects', group: '工作台', keywords: ['项目', 'project'] },
  { label: '资产中心', href: '/assets', group: '工作台', keywords: ['资产', '素材', 'asset'] },
  { label: 'Dashboard', href: '/dashboard', group: '工作台', keywords: ['dashboard', '控制台'] },
  { label: '路线图', href: '/roadmap', group: '平台', keywords: ['路线图', 'roadmap'] },
  { label: '商业模式', href: '/pricing-preview', group: '平台', keywords: ['商业', '价格', 'pricing'] },
  { label: '协议版权', href: '/terms-preview', group: '平台', keywords: ['协议', '版权', 'terms'] },
  { label: '本地部署', href: '/local-deploy-preview', group: '平台', keywords: ['本地', '部署'] },
  { label: '企业版', href: '/enterprise-preview', group: '平台', keywords: ['企业', '权限'] },
  { label: '社区', href: '/community', group: '社区与帮助', keywords: ['社区', 'community'] },
  { label: '诊断帮助', href: '/help', group: '社区与帮助', keywords: ['帮助', '诊断', 'help'] },
]

const SEARCH_DEFAULTS = new Set(['/create', '/marketplace-preview', '/demand-board-preview', '/projects', '/assets'])

function getUserInitial(displayName?: string | null, email?: string | null): string {
  const name = displayName?.trim()
  if (name) return ([...name][0] ?? 'U').toUpperCase()
  const e = email?.trim()
  if (e) return (e[0] ?? 'U').toUpperCase()
  return 'U'
}

function getUserShortName(displayName?: string | null, email?: string | null): string {
  const name = displayName?.trim()
  if (name) return name
  const e = email?.trim()
  if (e) return e.split('@')[0] ?? e
  return '用户'
}

export function TopNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isAuthenticated } = useAuthStore()
  const { status: sessionStatus, user: sessionUser } = useCurrentUser()
  const effectiveUser = sessionUser ?? (sessionStatus === 'loading' ? user : null)
  const effectiveIsAuthenticated = sessionStatus === 'authenticated' || (sessionStatus === 'loading' && isAuthenticated)

  // Unified hover dropdown — single open key + 150 ms close delay
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMenuEnter = useCallback((key: string) => {
    if (menuTimer.current) clearTimeout(menuTimer.current)
    setOpenMenu(key)
  }, [])

  const handleMenuLeave = useCallback(() => {
    menuTimer.current = setTimeout(() => setOpenMenu(null), 150)
  }, [])

  // Local search state — no fetch, no API
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!searchOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
    }
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false); setSearchQuery('')
      }
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [searchOpen])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return NAV_SEARCH_ITEMS.filter((i) => SEARCH_DEFAULTS.has(i.href))
    return NAV_SEARCH_ITEMS.filter((item) =>
      item.label.toLowerCase().includes(q) ||
      item.group.toLowerCase().includes(q) ||
      item.href.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q)),
    )
  }, [searchQuery])

  const handleLogout = async () => {
    await clientLogout()
    logout()
    router.push('/')
  }

  // Preserve localStorage-aware canvas navigation
  const handleCreateClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    let href = '/create'
    try {
      const lastId = window.localStorage.getItem('creator-city:last-project-id')
      if (lastId) href = `/create?projectId=${encodeURIComponent(lastId)}`
    } catch (_) { /* private mode — fall back to /create */ }
    router.push(href)
  }, [router])

  const handleCanvasV2Click = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    let href = '/create-v2'
    try {
      const lastId = window.localStorage.getItem('creator-city:last-project-id')
      if (lastId) href = `/create-v2?projectId=${encodeURIComponent(lastId)}`
    } catch (_) { /* private mode */ }
    router.push(href)
  }, [router])

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#0a0f1a]/88 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-5">

        {/* Left: logo + 5 dropdown nav groups */}
        <div className="flex items-center gap-3">
          <Link href="/" className="shrink-0 text-xs font-bold tracking-[0.02em] text-gradient">
            Creator City
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV_GROUPS.map((group) => {
              const isActive = group.items.some(
                (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
              )
              return (
                <div
                  key={group.key}
                  className="relative"
                  onMouseEnter={() => handleMenuEnter(group.key)}
                  onMouseLeave={handleMenuLeave}
                >
                  <button
                    className={`inline-flex items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[12px] transition ${
                      isActive ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    {group.label}
                    <span className="text-[8px] text-white/22">▾</span>
                  </button>

                  {openMenu === group.key && (
                    <div
                      className="absolute left-0 top-full z-[200] mt-2 w-[176px] overflow-hidden rounded-2xl border border-white/[0.12] bg-black/90 py-1.5 ring-1 ring-white/[0.06] backdrop-blur-xl"
                      style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.65)' }}
                      onMouseEnter={() => handleMenuEnter(group.key)}
                      onMouseLeave={handleMenuLeave}
                    >
                      {group.items.map((item) => {
                        const isCreate = item.href === '/create'
                        const isV2 = item.href === '/create-v2'
                        return (
                          <a
                            key={item.href}
                            href={item.href}
                            onClick={isCreate ? handleCreateClick : isV2 ? handleCanvasV2Click : undefined}
                            className="flex items-center gap-2 px-3.5 py-[7px] text-[12px] text-white/55 transition hover:bg-white/[0.08] hover:text-white/90"
                          >
                            {item.label}
                            {item.badge && (
                              <span className="rounded-full bg-violet-500/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-300">
                                {item.badge}
                              </span>
                            )}
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </div>

        {/* Right: search + user */}
        <div className="flex items-center gap-2">

          {/* Local search — no fetch, static data only */}
          <div className="relative" ref={searchRef}>
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white/55 transition hover:border-white/20 hover:text-white"
            >
              <span>🔍</span>
              <span className="hidden sm:inline">搜索</span>
            </button>

            {searchOpen && (
              <div
                className="absolute right-0 top-full z-[200] mt-2 w-[320px] overflow-hidden rounded-2xl border border-white/[0.12] bg-black/95 ring-1 ring-white/[0.06] backdrop-blur-xl"
                style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.72)' }}
              >
                <div className="p-2.5">
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索页面入口…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[13px] text-white placeholder-white/30 outline-none focus:border-white/20"
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto pb-2">
                  {filteredItems.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[12px] text-white/30">没有找到入口</div>
                  ) : (
                    filteredItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                        className="flex items-center justify-between px-4 py-2.5 transition hover:bg-white/[0.07]"
                      >
                        <span className="text-[13px] text-white/80">{item.label}</span>
                        <span className="text-[10px] text-white/30">{item.group}</span>
                      </Link>
                    ))
                  )}
                </div>
                {!searchQuery && (
                  <div className="border-t border-white/[0.06] px-4 py-2 text-[10px] text-white/25">
                    常用入口 · 输入关键词搜索
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User area */}
          {effectiveIsAuthenticated && effectiveUser ? (
            <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 md:flex">
              <div className="h-7 w-7 shrink-0 rounded-full bg-white/[0.08] text-center text-xs font-semibold leading-7 text-white">
                {getUserInitial(effectiveUser.displayName, effectiveUser.email)}
              </div>
              <div className="max-w-[80px] truncate text-[12px] font-medium text-white">
                {getUserShortName(effectiveUser.displayName, effectiveUser.email)}
              </div>
              <Link href="/account" className="px-1 text-xs text-white/40 transition hover:text-white/70" title="账号设置">⚙</Link>
              <button
                onClick={() => void handleLogout()}
                className="text-xs text-white/40 transition hover:text-white/80"
                title="登出"
              >
                ↩
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/auth/login"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/70 transition hover:border-white/20 hover:text-white"
              >
                登录
              </Link>
              <Link
                href="/auth/register"
                className="rounded-xl border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[12px] font-medium text-white transition hover:border-white/20 hover:bg-white/[0.12]"
              >
                注册
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
