'use client'

import React from 'react'
import Link from 'next/link'
import { useCallback, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CommandPalette } from '@/components/command/CommandPalette'
import { WorkspaceSwitcher } from '@/components/projects/WorkspaceSwitcher'
import { aggregateProducerDashboard } from '@/lib/dashboard/aggregate'
import { buildWorkspacePortfolio } from '@/lib/projects/workspace'
import { buildPersonalWorkQueue } from '@/lib/workqueue/aggregate'
import { buildNotificationSummary, useNotificationsStore } from '@/store/notifications.store'
import { useApprovalStore } from '@/store/approval.store'
import { useAuthStore } from '@/store/auth.store'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import { useJobsStore } from '@/store/jobs.store'
import { useOrderStore } from '@/store/order.store'
import { useProfileStore } from '@/store/profile.store'
import { useProjectRoleStore } from '@/store/project-role.store'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'
import { useVersionHistoryStore } from '@/store/version-history.store'
import { getActionTarget } from '@/lib/routing/actions'
import { clientLogout } from '@/lib/auth/client'
import { useCurrentUser } from '@/lib/auth/use-current-user'

type NavItem = { label: string; href: string; badge?: string }
type NavGroup = { label: string; key: string; items: NavItem[] }

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

export function TopNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isAuthenticated } = useAuthStore()
  const { status: sessionStatus, user: sessionUser } = useCurrentUser()
  const effectiveUser = sessionUser ?? (sessionStatus === 'loading' ? user : null)
  const effectiveIsAuthenticated = sessionStatus === 'authenticated' || (sessionStatus === 'loading' && isAuthenticated)
  const currentProfileId = useProfileStore((s) => s.currentUserId)
  const approvals = useApprovalStore((s) => s.approvals)
  const approvalGates = useApprovalStore((s) => s.gates)
  const deliveryPackages = useDeliveryPackageStore((s) => s.deliveryPackages)
  const notes = useDirectorNotesStore((s) => s.notes)
  const jobs = useJobsStore((s) => s.jobs)
  const notifications = useNotificationsStore((s) => s.items)
  const orders = useOrderStore((s) => s.orders)
  const assignments = useProjectRoleStore((s) => s.assignments)
  const tasks = useTaskStore((s) => s.tasks)
  const teams = useTeamStore((s) => s.teams)
  const invitations = useTeamStore((s) => s.invitations)
  const versions = useVersionHistoryStore((s) => s.versions)

  const currentUserId = effectiveUser?.id ?? currentProfileId ?? 'user-me'
  const profileId = currentProfileId ?? currentUserId

  const dashboard = useMemo(
    () => aggregateProducerDashboard({ teams, approvals, approvalGates, notes, tasks, orders, jobs, deliveryPackages, versions }),
    [teams, approvals, approvalGates, notes, tasks, orders, jobs, deliveryPackages, versions],
  )

  const workQueue = useMemo(
    () => buildPersonalWorkQueue({ userId: currentUserId, profileId, invitations, assignments, tasks, teams, approvals, deliveryPackages, notifications }),
    [approvals, assignments, currentUserId, deliveryPackages, invitations, notifications, profileId, tasks, teams],
  )

  const portfolio = useMemo(
    () => buildWorkspacePortfolio({ userId: currentUserId, profileId, assignments, teams, invitations, dashboard, workQueue, notifications, deliveryPackages, approvals }),
    [approvals, assignments, currentUserId, dashboard, deliveryPackages, invitations, notifications, profileId, teams, workQueue],
  )

  const notificationSummary = useMemo(
    () => buildNotificationSummary(notifications),
    [notifications],
  )

  const notificationHref = getActionTarget({ actionType: 'dashboard-notifications' }).actionHref

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
                      isActive
                        ? 'bg-white/[0.08] text-white'
                        : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
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

        {/* Right: tools + compact notifications + user */}
        <div className="flex items-center gap-2">
          <CommandPalette
            portfolio={portfolio}
            workQueue={workQueue}
            notifications={notifications}
          />

          <div className="hidden xl:block">
            <WorkspaceSwitcher
              recentProjects={portfolio.recentProjects}
              highPriorityProjects={portfolio.highPriorityProjects}
              waitingProjects={portfolio.waitingProjects}
              compact
            />
          </div>

          {/* Notifications — compact icon, always visible */}
          <Link
            href={notificationHref}
            className="inline-flex items-center gap-1 rounded-xl border border-white/8 bg-white/[0.03] px-2 py-1.5 text-[11px] text-white/45 transition hover:border-white/18 hover:text-white/80"
          >
            <span>🔔</span>
            {notificationSummary.unreadCount > 0 && (
              <span className="text-white/60">{notificationSummary.unreadCount}</span>
            )}
            {notificationSummary.strongCount > 0 && (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-rose-300">
                {notificationSummary.strongCount}
              </span>
            )}
          </Link>

          {effectiveIsAuthenticated && effectiveUser ? (
            <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 md:flex">
              <div className="h-7 w-7 shrink-0 rounded-full bg-white/[0.08] text-center text-xs font-semibold leading-7 text-white">
                {effectiveUser.displayName[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium text-white">{effectiveUser.displayName}</div>
                <div className="truncate text-[10px] text-white/40">{effectiveUser.email}</div>
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
