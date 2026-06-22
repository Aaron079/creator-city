'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CreatorCityLogo } from '@/components/brand/CreatorCityLogo'
import { useAuthStore } from '@/store/auth.store'
import { clientLogout } from '@/lib/auth/client'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { clearUserScopedLocalState } from '@/lib/client-storage/clearUserLocalState'
import styles from './nonCanvasShell.module.css'

type NavItem = { label: string; href: string; badge?: string }
type NavGroup = { label: string; key: string; items: NavItem[] }
type SearchItem = { label: string; href: string; group: string; keywords: string[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: '创作', key: 'create',
    items: [
      { label: 'AI 画布', href: '/create' },
      { label: '生成任务', href: '/tasks' },
      { label: 'API 中心', href: '/providers' },
    ],
  },
  {
    label: '市场', key: 'market',
    items: [
      { label: '市场总览', href: '/marketplace' },
      { label: '创作者主页', href: '/creator-profile-preview', badge: '即将' },
      { label: '需求广场', href: '/demand-board-preview', badge: '即将' },
      { label: '报价方案', href: '/proposal-flow-preview', badge: '即将' },
      { label: '阶段交付', href: '/milestone-delivery-preview', badge: '即将' },
      { label: '托管结算', href: '/escrow-preview', badge: '即将' },
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
    label: '我的 API', key: 'myapi',
    items: [
      { label: 'API 账户管理', href: '/account/providers' },
      { label: 'API Key 接入指南', href: '/help/api-keys' },
      { label: '生成用量', href: '/account/usage' },
      { label: '平台模型中心', href: '/providers' },
    ],
  },
  {
    label: '平台', key: 'platform',
    items: [
      { label: '路线图', href: '/roadmap' },
      { label: '商业模式', href: '/pricing' },
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
      { label: 'API Key 接入指南', href: '/help/api-keys' },
      { label: '提交反馈', href: '/feedback' },
    ],
  },
]

const NAV_SEARCH_ITEMS: SearchItem[] = [
  { label: 'AI 画布', href: '/create', group: '创作', keywords: ['创作', '生成', '画布', 'canvas', 'image', 'video'] },
  { label: '生成任务', href: '/tasks', group: '创作', keywords: ['任务', '生成', 'status'] },
  { label: 'API 中心', href: '/providers', group: '创作', keywords: ['api', 'provider', '模型'] },
  { label: '市场总览', href: '/marketplace', group: '市场', keywords: ['市场', '交易', '创作者市场'] },
  { label: '创作者主页', href: '/creator-profile-preview', group: '市场', keywords: ['创作者', '作品集', '主页'] },
  { label: '需求广场', href: '/demand-board-preview', group: '市场', keywords: ['需求', 'brief', '项目方'] },
  { label: '报价方案', href: '/proposal-flow-preview', group: '市场', keywords: ['报价', '方案', 'proposal'] },
  { label: '阶段交付', href: '/milestone-delivery-preview', group: '市场', keywords: ['交付', '里程碑', '验收'] },
  { label: '托管结算', href: '/escrow-preview', group: '市场', keywords: ['托管', '结算', '抽佣', '支付预览'] },
  { label: '项目中心', href: '/projects', group: '工作台', keywords: ['项目', 'project'] },
  { label: '资产中心', href: '/assets', group: '工作台', keywords: ['资产', '素材', 'asset'] },
  { label: 'Dashboard', href: '/dashboard', group: '工作台', keywords: ['dashboard', '控制台'] },
  { label: '路线图', href: '/roadmap', group: '平台', keywords: ['路线图', 'roadmap'] },
  { label: '商业模式', href: '/pricing', group: '平台', keywords: ['商业', '价格', 'pricing'] },
  { label: '协议版权', href: '/terms-preview', group: '平台', keywords: ['协议', '版权', 'terms'] },
  { label: '本地部署', href: '/local-deploy-preview', group: '平台', keywords: ['本地', '部署'] },
  { label: '企业版', href: '/enterprise-preview', group: '平台', keywords: ['企业', '权限'] },
  { label: '社区', href: '/community', group: '社区与帮助', keywords: ['社区', 'community'] },
  { label: '诊断帮助', href: '/help', group: '社区与帮助', keywords: ['帮助', '诊断', 'help'] },
  { label: '提交反馈', href: '/feedback', group: '社区与帮助', keywords: ['反馈', '问题', '报告', 'feedback', '试用', '建议'] },
  { label: 'API Key 接入指南', href: '/help/api-keys', group: '我的 API', keywords: ['api key', '密钥', 'provider', 'deepseek', 'openai', 'kimi', '火山方舟', 'seedream', '我的api', '接入教程', 'byok教程', 'api接入', '怎么添加key', '怎么填key'] },
  { label: '账号设置', href: '/account', group: '账户', keywords: ['账号', '设置', '资料', 'profile', 'account'] },
  { label: 'API 账户管理', href: '/account/providers', group: '我的 API', keywords: ['provider', 'api', 'key', 'apikey', '自带', 'byok', '我的api', '账户管理', '自带key'] },
  { label: '平台模型中心', href: '/providers', group: '我的 API', keywords: ['平台模型', 'provider center', 'model', 'api center'] },
  { label: '生成用量', href: '/account/usage', group: '账户', keywords: ['用量', '用量历史', 'usage', '生成记录', 'byok用量', 'api用量'] },
  { label: '积分与充值', href: '/account/credits', group: '账户', keywords: ['积分', '充值', '钱包', 'credits', 'billing', '平台额度'] },
  { label: '会员中心', href: '/account/membership', group: '账户', keywords: ['订阅', '套餐', '计划', 'subscription', 'plan', '平台服务费', 'pricing', '会员', 'membership'] },
]

const SEARCH_DEFAULTS = new Set([
  '/create',
  '/marketplace',
  '/demand-board-preview',
  '/proposal-flow-preview',
  '/milestone-delivery-preview',
  '/escrow-preview',
])

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
  const isCanvasRoute = pathname.startsWith('/create')
  const { user, logout, isAuthenticated } = useAuthStore()
  const { status: sessionStatus, user: sessionUser } = useCurrentUser()
  const effectiveUser = sessionUser ?? ((sessionStatus === 'loading' || sessionStatus === 'unknown') ? user : null)
  const effectiveIsAuthenticated = sessionStatus === 'authenticated' || ((sessionStatus === 'loading' || sessionStatus === 'unknown') && isAuthenticated)

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
    clearUserScopedLocalState()
    router.push('/')
  }

  // Canvas entry point navigates directly — do not read last-project-id.
  // /api/projects/ensure always returns the current user's own project.
  const handleCreateClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    router.push('/create')
  }, [router])

  return (
    <header className={`${isCanvasRoute ? styles.navDark : styles.navLight} fixed inset-x-0 top-0 z-50`}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-5">

        {/* Left: logo + 5 dropdown nav groups */}
        <div className="flex items-center gap-3">
          <Link href="/" className="shrink-0">
            <CreatorCityLogo size="sm" />
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
                      isCanvasRoute
                        ? isActive ? styles.navButtonDarkActive : styles.navButtonDark
                        : isActive ? styles.navButtonLightActive : styles.navButtonLight
                    }`}
                  >
                    {group.label}
                    <span className={`text-[8px] ${isCanvasRoute ? 'text-white/25' : 'text-slate-400'}`}>▾</span>
                  </button>

                  {openMenu === group.key && (
                    <div
                      className={`${isCanvasRoute ? styles.navMenuDark : styles.navMenuLight} absolute left-0 top-full z-[200] mt-2 w-[176px] overflow-hidden rounded-2xl py-1.5`}
                      onMouseEnter={() => handleMenuEnter(group.key)}
                      onMouseLeave={handleMenuLeave}
                    >
                      {group.items.map((item) => {
                        const isCreate = item.href === '/create'
                        return (
                          <a
                            key={item.href}
                            href={item.href}
                            onClick={isCreate ? handleCreateClick : undefined}
                            className={`${isCanvasRoute ? styles.navMenuItemDark : styles.navMenuItemLight} flex items-center gap-2 px-3.5 py-[7px] text-[12px] transition`}
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

          {/* Community shortcut */}
          <Link
            href="/community"
            className={`hidden rounded-xl px-2.5 py-1.5 text-[12px] transition sm:inline-flex ${isCanvasRoute ? 'border border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
          >
            社群
          </Link>

          {/* Local search — no fetch, static data only */}
          <div className="relative" ref={searchRef}>
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] transition ${isCanvasRoute ? 'border border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
            >
              <span aria-hidden="true">⌕</span>
              <span className="hidden sm:inline">搜索</span>
            </button>

            {searchOpen && (
              <div
                className={`${isCanvasRoute ? styles.navMenuDark : styles.navMenuLight} absolute right-0 top-full z-[200] mt-2 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl`}
              >
                <div className="p-2.5">
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索页面、功能或流程…"
                    className={`w-full rounded-xl px-3 py-2 text-[13px] outline-none ${isCanvasRoute ? 'border border-white/10 bg-white/[0.06] text-white placeholder-white/30 focus:border-white/20' : 'border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-blue-300'}`}
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto pb-2">
                  {filteredItems.length === 0 ? (
                    <div className={`px-4 py-6 text-center text-[12px] ${isCanvasRoute ? 'text-white/30' : 'text-slate-400'}`}>没有找到入口</div>
                  ) : (
                    filteredItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                        className={`flex items-center justify-between gap-3 px-4 py-2.5 transition ${isCanvasRoute ? 'hover:bg-white/[0.08] hover:text-white' : 'hover:bg-slate-50'}`}
                      >
                        <div className="min-w-0">
                          <div className={`text-[13px] ${isCanvasRoute ? 'text-white/80' : 'text-slate-800'}`}>{item.label}</div>
                          <div className={`truncate font-mono text-[10px] ${isCanvasRoute ? 'text-white/28' : 'text-slate-400'}`}>{item.href}</div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${isCanvasRoute ? 'bg-white/[0.04] text-white/35' : 'bg-slate-100 text-slate-500'}`}>{item.group}</span>
                      </Link>
                    ))
                  )}
                </div>
                <div className={`border-t px-4 py-2 text-[10px] ${isCanvasRoute ? 'border-white/[0.06] text-white/25' : 'border-slate-100 text-slate-400'}`}>
                  仅搜索已开放页面，不触发生成或保存。
                </div>
              </div>
            )}
          </div>

          {/* User area — hover dropdown */}
          {effectiveIsAuthenticated && effectiveUser ? (
            <div
              className="relative hidden md:block"
              onMouseEnter={() => handleMenuEnter('user')}
              onMouseLeave={handleMenuLeave}
            >
              {/* Trigger */}
              <button className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition ${isCanvasRoute ? 'border border-white/10 bg-white/[0.04] hover:border-white/20' : 'border border-slate-200 bg-white hover:border-blue-200'}`}>
                <div className={`h-7 w-7 shrink-0 rounded-full text-center text-xs font-semibold leading-7 ${isCanvasRoute ? 'bg-white/[0.08] text-white' : 'bg-blue-50 text-blue-700'}`}>
                  {getUserInitial(effectiveUser.displayName, effectiveUser.email)}
                </div>
                <div className={`max-w-[80px] truncate text-[12px] font-medium ${isCanvasRoute ? 'text-white' : 'text-slate-800'}`}>
                  {getUserShortName(effectiveUser.displayName, effectiveUser.email)}
                </div>
                <span className={`text-[8px] ${isCanvasRoute ? 'text-white/25' : 'text-slate-400'}`}>▾</span>
              </button>

              {/* Dropdown */}
              {openMenu === 'user' && (
                <div
                  className={`${isCanvasRoute ? styles.navMenuDark : styles.navMenuLight} absolute right-0 top-full z-[200] mt-2 w-52 overflow-hidden rounded-2xl py-1.5`}
                  onMouseEnter={() => handleMenuEnter('user')}
                  onMouseLeave={handleMenuLeave}
                >
                  {/* User identity header */}
                  <div className="px-3.5 pb-2 pt-2">
                    <p className={`truncate text-[12px] font-medium ${isCanvasRoute ? 'text-white/80' : 'text-slate-800'}`}>
                      {getUserShortName(effectiveUser.displayName, effectiveUser.email)}
                    </p>
                    <p className={`truncate text-[10px] ${isCanvasRoute ? 'text-white/30' : 'text-slate-500'}`}>{effectiveUser.email}</p>
                  </div>
                  <div className={`mx-2 mb-1 border-t ${isCanvasRoute ? 'border-white/[0.07]' : 'border-slate-100'}`} />

                  {/* Account links */}
                  <Link
                    href="/account"
                    className={`${isCanvasRoute ? styles.navMenuItemDark : styles.navMenuItemLight} flex items-center gap-2.5 px-3.5 py-[7px] text-[12px] transition`}
                    onClick={() => setOpenMenu(null)}
                  >
                    <span>⚙</span> 账号设置
                  </Link>
                  <Link
                    href="/account/providers"
                    className={`${isCanvasRoute ? 'text-violet-300/80 hover:bg-violet-500/[0.08] hover:text-violet-200' : 'text-blue-700 hover:bg-blue-50'} flex items-center gap-2.5 px-3.5 py-[7px] text-[12px] transition`}
                    onClick={() => setOpenMenu(null)}
                  >
                    <span>⚡</span> 我的 API 账户
                  </Link>
                  <Link
                    href="/account/usage"
                    className={`${isCanvasRoute ? 'text-sky-300/70 hover:bg-sky-500/[0.06] hover:text-sky-200' : 'text-slate-600 hover:bg-slate-50'} flex items-center gap-2.5 px-3.5 py-[7px] text-[12px] transition`}
                    onClick={() => setOpenMenu(null)}
                  >
                    <span>📊</span> 生成用量
                  </Link>
                  <Link
                    href="/account/credits"
                    className={`${isCanvasRoute ? styles.navMenuItemDark : styles.navMenuItemLight} flex items-center gap-2.5 px-3.5 py-[7px] text-[12px] transition`}
                    onClick={() => setOpenMenu(null)}
                  >
                    <span>◎</span> 积分与充值
                  </Link>
                  <Link
                    href="/account/membership"
                    className={`${isCanvasRoute ? 'text-amber-300/70 hover:bg-amber-500/[0.06] hover:text-amber-200' : 'text-amber-700 hover:bg-amber-50'} flex items-center gap-2.5 px-3.5 py-[7px] text-[12px] transition`}
                    onClick={() => setOpenMenu(null)}
                  >
                    <span>★</span> 会员中心
                  </Link>

                  <div className={`mx-2 my-1 border-t ${isCanvasRoute ? 'border-white/[0.07]' : 'border-slate-100'}`} />

                  {/* Logout */}
                  <button
                    onClick={() => void handleLogout()}
                    className={`flex w-full items-center gap-2.5 px-3.5 py-[7px] text-[12px] transition ${isCanvasRoute ? 'text-white/40 hover:bg-white/[0.06] hover:text-white/70' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                  >
                    <span>↩</span> 登出
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/auth/login"
                className={`rounded-xl px-3 py-1.5 text-[12px] transition ${isCanvasRoute ? 'border border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
              >
                登录
              </Link>
              <Link
                href="/auth/register"
                className={`rounded-xl px-3 py-1.5 text-[12px] font-medium transition ${isCanvasRoute ? 'border border-white/10 bg-white/[0.08] text-white hover:border-white/20 hover:bg-white/[0.12]' : 'border border-blue-600 bg-blue-600 text-white hover:bg-blue-700'}`}
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
