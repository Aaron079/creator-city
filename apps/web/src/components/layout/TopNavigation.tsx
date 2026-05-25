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

const EXPLORE_NAV: Array<{ group: string; items: Array<{ label: string; href: string }> }> = [
  {
    group: '平台',
    items: [
      { label: '路线图', href: '/roadmap' },
      { label: '商业模式', href: '/pricing-preview' },
      { label: '协议版权', href: '/terms-preview' },
    ],
  },
  {
    group: '部署与企业',
    items: [
      { label: '本地部署', href: '/local-deploy-preview' },
      { label: '企业版', href: '/enterprise-preview' },
    ],
  },
  {
    group: '工作区',
    items: [
      { label: '项目中心', href: '/projects' },
      { label: '资产中心', href: '/assets' },
      { label: '生成任务', href: '/tasks' },
      { label: 'API 中心', href: '/providers' },
    ],
  },
  {
    group: '社区与帮助',
    items: [
      { label: '社区', href: '/community' },
      { label: '诊断帮助', href: '/help' },
      { label: '工作台', href: '/dashboard' },
    ],
  },
]

const ENTERPRISE_NAV: Array<{ label: string; href: string }> = [
  { label: '企业版总览', href: '/enterprise-preview' },
  { label: '客户对象', href: '/enterprise-preview#target-customers' },
  { label: '核心能力', href: '/enterprise-preview#capabilities' },
  { label: '企业工作流', href: '/enterprise-preview#workflow' },
  { label: '权限矩阵', href: '/enterprise-preview#permissions' },
  { label: '数据安全', href: '/enterprise-preview#security' },
  { label: '企业套餐', href: '/enterprise-preview#plans' },
  { label: '企业价值', href: '/enterprise-preview#value' },
  { label: '接入流程', href: '/enterprise-preview#onboarding' },
  { label: '风险边界', href: '/enterprise-preview#risks' },
]

const LINKS: Array<{ href: string; label: string; isCanvasV2?: boolean }> = [
  { href: '/create', label: '创作' },
  { href: '/create-v2', label: 'Canvas V2', isCanvasV2: true },
  { href: '/projects', label: '工作空间' },
  { href: '/marketplace', label: '市场' },
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
    () => aggregateProducerDashboard({
      teams,
      approvals,
      approvalGates,
      notes,
      tasks,
      orders,
      jobs,
      deliveryPackages,
      versions,
    }),
    [teams, approvals, approvalGates, notes, tasks, orders, jobs, deliveryPackages, versions],
  )

  const workQueue = useMemo(
    () => buildPersonalWorkQueue({
      userId: currentUserId,
      profileId,
      invitations,
      assignments,
      tasks,
      teams,
      approvals,
      deliveryPackages,
      notifications,
    }),
    [approvals, assignments, currentUserId, deliveryPackages, invitations, notifications, profileId, tasks, teams],
  )

  const portfolio = useMemo(
    () => buildWorkspacePortfolio({
      userId: currentUserId,
      profileId,
      assignments,
      teams,
      invitations,
      dashboard,
      workQueue,
      notifications,
      deliveryPackages,
      approvals,
    }),
    [approvals, assignments, currentUserId, dashboard, deliveryPackages, invitations, notifications, profileId, teams, workQueue],
  )

  const notificationSummary = useMemo(
    () => buildNotificationSummary(notifications),
    [notifications],
  )

  const notificationHref = getActionTarget({ actionType: 'dashboard-notifications' }).actionHref

  const [exploreOpen, setExploreOpen] = useState(false)
  const exploreTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleExploreEnter = useCallback(() => {
    if (exploreTimer.current) clearTimeout(exploreTimer.current)
    setExploreOpen(true)
  }, [])

  const handleExploreLeave = useCallback(() => {
    exploreTimer.current = setTimeout(() => setExploreOpen(false), 150)
  }, [])

  const [enterpriseOpen, setEnterpriseOpen] = useState(false)
  const enterpriseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEnterpriseEnter = useCallback(() => {
    if (enterpriseTimer.current) clearTimeout(enterpriseTimer.current)
    setEnterpriseOpen(true)
  }, [])

  const handleEnterpriseLeave = useCallback(() => {
    enterpriseTimer.current = setTimeout(() => setEnterpriseOpen(false), 150)
  }, [])

  const handleLogout = async () => {
    await clientLogout()
    logout()
    router.push('/')
  }

  // Navigate to last-opened canvas project, or fall back to /create (which auto-resolves)
  const handleCreateClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    let href = '/create'
    try {
      const lastId = window.localStorage.getItem('creator-city:last-project-id')
      if (lastId) href = `/create?projectId=${encodeURIComponent(lastId)}`
    } catch (_) { /* private mode — fall back to /create */ }
    router.push(href)
  }, [router])

  const handleProjectsClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    router.push('/projects')
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
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs font-bold tracking-[0.02em] text-gradient">
            Creator City
          </Link>
          <nav className="hidden items-center gap-0.5 md:flex">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
              const navClass = `rounded-xl px-2.5 py-1.5 text-[12px] transition ${
                active ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
              }`
              if (link.href === '/create') {
                return (
                  <a key={link.href} href="/create" onClick={handleCreateClick} className={navClass}>
                    {link.label}
                  </a>
                )
              }
              if (link.isCanvasV2) {
                return (
                  <a key={link.href} href="/create-v2" onClick={handleCanvasV2Click} className={navClass}>
                    {link.label}
                    <span className="ml-1 rounded-full bg-violet-500/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-300">Beta</span>
                  </a>
                )
              }
              if (link.href === '/projects') {
                return (
                  <a key={link.href} href="/projects" onClick={handleProjectsClick} className={navClass}>
                    {link.label}
                  </a>
                )
              }
              return (
                <Link key={link.href} href={link.href} className={navClass}>
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

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

          {/* Explore nav — hover dropdown, no API calls */}
          <div
            className="relative hidden md:block"
            onMouseEnter={handleExploreEnter}
            onMouseLeave={handleExploreLeave}
          >
            <button className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white">
              Explore
              <span className="text-[9px] text-white/30">▾</span>
            </button>

            {exploreOpen && (
              <div
                className="absolute right-0 top-full z-[200] mt-1.5 w-[280px] rounded-2xl border border-white/[0.09] bg-[#0c0e1c]/96 py-2 shadow-2xl backdrop-blur-2xl"
                onMouseEnter={handleExploreEnter}
                onMouseLeave={handleExploreLeave}
              >
                {EXPLORE_NAV.map((group) => (
                  <div key={group.group}>
                    <div className="px-3.5 pb-0.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/25 first:pt-1">
                      {group.group}
                    </div>
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-3.5 py-1.5 text-[11px] text-white/55 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enterprise preview nav — hover dropdown, no API calls */}
          <div
            className="relative hidden md:block"
            onMouseEnter={handleEnterpriseEnter}
            onMouseLeave={handleEnterpriseLeave}
          >
            <button className="inline-flex items-center gap-1 rounded-xl border border-violet-500/30 bg-violet-500/[0.08] px-2.5 py-1.5 text-[12px] font-semibold text-violet-300 transition hover:border-violet-400/50 hover:bg-violet-500/[0.14] hover:text-violet-200">
              企业版预览
              <span className="text-[9px] text-violet-400/60">▾</span>
            </button>

            {enterpriseOpen && (
              <div
                className="absolute right-0 top-full z-[200] mt-1.5 min-w-[160px] rounded-2xl border border-white/[0.09] bg-[#0c0e1c]/96 py-1.5 shadow-2xl backdrop-blur-2xl"
                onMouseEnter={handleEnterpriseEnter}
                onMouseLeave={handleEnterpriseLeave}
              >
                {ENTERPRISE_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-3.5 py-1.5 text-[11px] text-white/55 transition hover:bg-violet-500/[0.08] hover:text-violet-200"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href={notificationHref}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white/75 transition hover:border-white/20 hover:text-white"
          >
            <span>Notifications</span>
            <span className="text-white/35">{notificationSummary.unreadCount}</span>
            {notificationSummary.strongCount > 0 ? (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-rose-300">
                {notificationSummary.strongCount} High
              </span>
            ) : null}
          </Link>

          {effectiveIsAuthenticated && effectiveUser ? (
            <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 md:flex">
              <div className="h-7 w-7 rounded-full bg-white/[0.08] text-center text-xs font-semibold leading-7 text-white shrink-0">
                {effectiveUser.displayName[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium text-white">{effectiveUser.displayName}</div>
                <div className="truncate text-[10px] text-white/40">{effectiveUser.email}</div>
              </div>
              <Link href="/account" className="text-xs text-white/40 transition hover:text-white/70 px-1" title="账号设置">⚙</Link>
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
                className="rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 px-3 py-1.5 text-[12px] text-white font-medium transition"
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
