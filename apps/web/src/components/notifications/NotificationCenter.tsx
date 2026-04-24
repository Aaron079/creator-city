'use client'

import Link from 'next/link'
import { memo, useMemo, useState } from 'react'
import type { NotificationAiSummary } from '@/lib/notifications/aggregate'
import { buildNotificationActionGroups, resolveSnoozeUntil } from '@/lib/notifications/actions'
import type {
  NotificationItem,
  NotificationSection,
  NotificationSeverity,
  NotificationSnoozePreset,
  NotificationSummary,
  ReminderRule,
} from '@/store/notifications.store'
import {
  buildNotificationSummary,
  isActionableNotification,
  isSnoozedNotification,
} from '@/store/notifications.store'
import type { WorkspaceRole } from '@/lib/roles/view-mode'
import { getActionTarget } from '@/lib/routing/actions'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useFeedback } from '@/lib/feedback/useFeedback'

type InboxFilter = 'all' | NotificationSection
type SeverityFilter = 'all' | NotificationSeverity

function severityMeta(severity: NotificationItem['severity']) {
  if (severity === 'strong') {
    return {
      label: 'High',
      cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    }
  }

  if (severity === 'warning') {
    return {
      label: 'Watch',
      cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    }
  }

  return {
    label: 'Info',
    cls: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  }
}

function compareNotifications(left: NotificationItem, right: NotificationItem) {
  const byPinned = Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned))
  if (byPinned !== 0) return byPinned
  const severityOrder = { strong: 3, warning: 2, info: 1 }
  const bySeverity = severityOrder[right.severity] - severityOrder[left.severity]
  if (bySeverity !== 0) return bySeverity
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
}

function categoryLabel(item: NotificationItem) {
  if (item.category === 'team' && item.sourceType === 'invitation') {
    return '邀请'
  }

  switch (item.category) {
    case 'approval':
      return '审批'
    case 'blocker':
      return '阻塞'
    case 'delivery':
      return '交付'
    case 'planning':
      return '排期'
    case 'review':
      return '审片'
    case 'audio':
      return '音频'
    case 'video':
      return '视频'
    case 'order':
      return '订单'
    case 'team':
      return '团队'
    case 'licensing':
      return '授权'
    default:
      return item.category
  }
}

function sectionLabel(section: InboxFilter) {
  switch (section) {
    case 'all':
      return '全部'
    case 'invitation':
      return '邀请'
    case 'approval':
      return '审批'
    case 'delivery':
      return '交付'
    case 'planning':
      return '计划'
    case 'risk':
      return '风险'
    default:
      return section
  }
}

function severityLabel(severity: SeverityFilter) {
  switch (severity) {
    case 'all':
      return '全部'
    case 'strong':
      return '高风险'
    case 'warning':
      return '观察中'
    case 'info':
      return '信息'
    default:
      return severity
  }
}

function isRoleVisible(item: NotificationItem, role: WorkspaceRole) {
  if (role === 'producer') {
    return item.roleScope !== 'client'
  }

  if (role === 'creator' || role === 'director' || role === 'editor' || role === 'cinematographer') {
    return item.roleScope === 'creator' || item.roleScope === 'shared'
  }

  return (
    item.roleScope === 'client'
    || item.roleScope === 'shared'
    || item.sourceType.startsWith('invitation')
    || item.category === 'delivery'
    || item.category === 'review'
  )
}

function MetricTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number | string
  tone?: 'default' | 'warning' | 'danger'
}) {
  const cls = tone === 'danger'
    ? 'border-rose-500/20 bg-rose-500/8'
    : tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/8'
      : 'border-white/6 bg-white/[0.03]'

  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  )
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-white/20 bg-white/10 text-white'
          : 'border-white/8 bg-white/[0.03] text-white/55 hover:border-white/14 hover:text-white/80'
      }`}
    >
      {label}
    </button>
  )
}

function QuickFilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
        active
          ? 'border-sky-400/30 bg-sky-500/10 text-sky-200'
          : 'border-white/8 bg-white/[0.03] text-white/55 hover:border-white/14 hover:text-white/80'
      }`}
    >
      {label}
    </button>
  )
}

function SnoozeMenu({
  onSnooze,
}: {
  onSnooze: (preset: NotificationSnoozePreset) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSnooze('later-today')}
        className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
      >
        稍后今天
      </button>
      <button
        type="button"
        onClick={() => onSnooze('tomorrow')}
        className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
      >
        明天
      </button>
      <button
        type="button"
        onClick={() => onSnooze('this-week')}
        className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
      >
        本周内
      </button>
    </div>
  )
}

function NotificationCenterComponent({
  items,
  summary,
  rules,
  aiSummary,
  role,
  onMarkRead,
  onMarkAllRead,
  onMarkSectionRead,
  onMarkProjectRead,
  onDismiss,
  onDismissSection,
  onDismissProject,
  onSnooze,
  onToggleRule,
}: {
  items: NotificationItem[]
  summary: NotificationSummary
  rules: ReminderRule[]
  aiSummary: NotificationAiSummary
  role: WorkspaceRole
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onMarkSectionRead: (section: NotificationSection) => void
  onMarkProjectRead: (projectId: string) => void
  onDismiss: (id: string) => void
  onDismissSection: (section: NotificationSection) => void
  onDismissProject: (projectId: string) => void
  onSnooze: (id: string, until: string) => void
  onToggleRule: (rule: ReminderRule) => void
}) {
  const feedback = useFeedback()
  const [sectionFilter, setSectionFilter] = useState<InboxFilter>('all')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [projectFilter, setProjectFilter] = useState<'all' | string>('all')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [showHighRiskOnly, setShowHighRiskOnly] = useState(false)
  const [showActionableOnly, setShowActionableOnly] = useState(false)
  const [showSnoozedOnly, setShowSnoozedOnly] = useState(false)

  const visibleItems = useMemo(
    () => items.filter((item) => !item.isDismissed && isRoleVisible(item, role)).sort(compareNotifications),
    [items, role],
  )

  const activeItems = useMemo(
    () => visibleItems.filter((item) => !isSnoozedNotification(item)),
    [visibleItems],
  )

  const snoozedItems = useMemo(
    () => visibleItems.filter(isSnoozedNotification),
    [visibleItems],
  )

  const baseItems = showSnoozedOnly ? snoozedItems : activeItems

  const projectOptions = useMemo(
    () => Array.from(new Map(
      visibleItems
        .filter((item) => item.projectId)
        .map((item) => [item.projectId!, item.projectTitle ?? item.projectId!]),
    ).entries()),
    [visibleItems],
  )

  const filteredItems = useMemo(
    () => baseItems.filter((item) => {
      if (sectionFilter !== 'all' && item.section !== sectionFilter) return false
      if (severityFilter !== 'all' && item.severity !== severityFilter) return false
      if (projectFilter !== 'all' && item.projectId !== projectFilter) return false
      if (showUnreadOnly && item.isRead) return false
      if (showHighRiskOnly && item.severity !== 'strong') return false
      if (showActionableOnly && !isActionableNotification(item)) return false
      return true
    }),
    [
      baseItems,
      projectFilter,
      sectionFilter,
      severityFilter,
      showActionableOnly,
      showHighRiskOnly,
      showUnreadOnly,
    ],
  )

  const visibleSummary = useMemo(
    () => buildNotificationSummary(visibleItems),
    [visibleItems],
  )

  const actionGroups = useMemo(
    () => buildNotificationActionGroups(activeItems),
    [activeItems],
  )
  const inboxEntryAction = useMemo(
    () => role === 'client'
      ? getActionTarget({ actionType: 'invitation-inbox', actionLabel: '打开邀请页' })
      : getActionTarget({ actionType: 'dashboard-action-queue', actionLabel: '查看总控动作队列' }),
    [role],
  )

  const hasFilters = sectionFilter !== 'all'
    || severityFilter !== 'all'
    || projectFilter !== 'all'
    || showUnreadOnly
    || showHighRiskOnly
    || showActionableOnly
    || showSnoozedOnly

  return (
    <section
      id="notifications"
      className="rounded-2xl border border-city-border bg-city-surface/60 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.16)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          eyebrow="Notification Inbox"
          title="统一提醒收件箱"
          description="这里把邀请、审批、交付、排期和风险提醒收成一个统一收件箱。系统只负责排序和摘要，处理动作仍然由你自己决定。"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              onMarkAllRead()
              feedback.success('全部提醒已标记为已读')
            }}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
          >
            全部标记已读
          </button>
          {sectionFilter !== 'all' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onMarkSectionRead(sectionFilter)
                  feedback.success(`已将${sectionLabel(sectionFilter)}标记为已读`)
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/65 transition hover:border-white/20 hover:text-white"
              >
                当前分类标记已读
              </button>
              <button
                type="button"
                onClick={() => {
                  onDismissSection(sectionFilter)
                  feedback.info(`已忽略${sectionLabel(sectionFilter)}提醒`)
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/55 transition hover:border-white/20 hover:text-white"
              >
                当前分类忽略
              </button>
            </>
          ) : null}
          <Link
            href={inboxEntryAction.actionHref}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
          >
            {inboxEntryAction.actionLabel}
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-6">
        <MetricTile label="未读提醒" value={visibleSummary.unreadCount} tone={visibleSummary.unreadCount > 0 ? 'warning' : 'default'} />
        <MetricTile label="高风险" value={visibleSummary.strongCount} tone={visibleSummary.strongCount > 0 ? 'danger' : 'default'} />
        <MetricTile label="待审批" value={visibleSummary.approvalsPendingCount} tone={visibleSummary.approvalsPendingCount > 0 ? 'warning' : 'default'} />
        <MetricTile label="交付风险" value={visibleSummary.deliveryRiskCount} tone={visibleSummary.deliveryRiskCount > 0 ? 'danger' : 'default'} />
        <MetricTile label="待处理邀请" value={visibleSummary.invitationPendingCount} tone={visibleSummary.invitationPendingCount > 0 ? 'warning' : 'default'} />
        <MetricTile label="稍后处理" value={visibleSummary.snoozedCount} tone={visibleSummary.snoozedCount > 0 ? 'warning' : 'default'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">统一收件箱</div>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSectionFilter('all')
                    setSeverityFilter('all')
                    setProjectFilter('all')
                    setShowUnreadOnly(false)
                    setShowHighRiskOnly(false)
                    setShowActionableOnly(false)
                    setShowSnoozedOnly(false)
                  }}
                  className="text-xs text-white/45 transition hover:text-white/75"
                >
                  清除筛选
                </button>
              ) : (
                <div className="text-xs text-gray-500">当前共 {visibleItems.length} 条可见提醒</div>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/35">快速筛选</div>
                <div className="flex flex-wrap gap-2">
                  <QuickFilterChip active={showUnreadOnly} label="只看未读" onClick={() => setShowUnreadOnly((value) => !value)} />
                  <QuickFilterChip active={showHighRiskOnly} label="只看高风险" onClick={() => setShowHighRiskOnly((value) => !value)} />
                  <QuickFilterChip active={showActionableOnly} label="只看待我处理" onClick={() => setShowActionableOnly((value) => !value)} />
                  <QuickFilterChip active={showSnoozedOnly} label="只看稍后处理" onClick={() => setShowSnoozedOnly((value) => !value)} />
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/35">分类</div>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'invitation', 'approval', 'delivery', 'planning', 'risk'] as InboxFilter[]).map((filter) => (
                    <FilterChip
                      key={filter}
                      active={sectionFilter === filter}
                      label={sectionLabel(filter)}
                      onClick={() => setSectionFilter(filter)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/35">严重级别</div>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'strong', 'warning', 'info'] as SeverityFilter[]).map((filter) => (
                    <FilterChip
                      key={filter}
                      active={severityFilter === filter}
                      label={severityLabel(filter)}
                      onClick={() => setSeverityFilter(filter)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/35">项目</div>
                <div className="flex gap-2">
                  <select
                    value={projectFilter}
                    onChange={(event) => setProjectFilter(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-white/20"
                  >
                    <option value="all">全部项目</option>
                    {projectOptions.map(([projectId, title]) => (
                      <option key={projectId} value={projectId}>
                        {title}
                      </option>
                    ))}
                  </select>
                  {projectFilter !== 'all' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onMarkProjectRead(projectFilter)
                          feedback.success('当前项目提醒已标记为已读')
                        }}
                        className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65 transition hover:border-white/20 hover:text-white"
                      >
                        项目标记已读
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDismissProject(projectFilter)
                          feedback.info('当前项目提醒已忽略')
                        }}
                        className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 transition hover:border-white/20 hover:text-white"
                      >
                        项目忽略
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {actionGroups.length > 0 && !showSnoozedOnly ? (
            <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
              <div className="text-sm font-medium text-white">快速处理入口</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {actionGroups.map((group) => {
                  const meta = severityMeta(group.severity)
                  return (
                    <Link
                      key={group.id}
                      href={group.href}
                      className={`rounded-xl border px-3 py-2 text-sm transition hover:border-white/20 hover:text-white ${meta.cls}`}
                    >
                      {group.label} · {group.count}
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {filteredItems.length === 0 ? (
              <EmptyState
                title="暂无提醒"
                message={visibleItems.length === 0 ? '当前没有需要你处理的提醒。' : '当前筛选下没有提醒，你可以试着放宽筛选条件。'}
              />
            ) : filteredItems.map((item) => {
              const meta = severityMeta(item.severity)
              const isSnoozed = isSnoozedNotification(item)
              return (
                <div key={item.id} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-white/45">{categoryLabel(item)}</span>
                        <span className="rounded-full border border-white/8 px-2 py-0.5 text-[11px] text-white/45">
                          {sectionLabel(item.section ?? 'risk')}
                        </span>
                        {item.projectTitle ? <span className="text-xs text-white/35">{item.projectTitle}</span> : null}
                        {item.isPinned ? <span className="text-xs text-amber-300/90">置顶</span> : null}
                        {isSnoozed ? <span className="text-xs text-sky-300/90">稍后处理</span> : null}
                      </div>
                      <div className="mt-1 text-base font-semibold text-white">{item.title}</div>
                    </div>
                    <StatusBadge
                      label={meta.label}
                      tone={item.severity === 'strong' ? 'danger' : item.severity === 'warning' ? 'warning' : 'info'}
                    />
                  </div>

                  <p className="mt-3 text-sm text-white/65">{item.message}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/40">
                    <span>创建于 {new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                    {item.dueAt ? <span>建议处理前 {new Date(item.dueAt).toLocaleString('zh-CN')}</span> : null}
                    {item.snoozeUntil ? <span>暂缓到 {new Date(item.snoozeUntil).toLocaleString('zh-CN')}</span> : null}
                    <span>{item.isRead ? '已读' : '未读'}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={item.actionHref}
                      className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
                    >
                      {item.actionLabel}
                    </Link>
                    {!item.isRead ? (
                      <button
                        type="button"
                        onClick={() => {
                          onMarkRead(item.id)
                          feedback.success('已标记为已读')
                        }}
                        className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/65 transition hover:border-white/20 hover:text-white"
                      >
                        标记已读
                      </button>
                    ) : null}
                    {!isSnoozed ? (
                      <SnoozeMenu
                        onSnooze={(preset) => {
                          onSnooze(item.id, resolveSnoozeUntil(preset))
                          feedback.info('已标记为稍后处理')
                        }}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        onDismiss(item.id)
                        feedback.info('已忽略提醒')
                      }}
                      className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/55 transition hover:border-white/20 hover:text-white"
                    >
                      忽略
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
            <div className="text-sm font-medium text-white">AI 优先级摘要</div>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              {aiSummary.topNotifications.map((item) => (
                <li key={item} className="rounded-xl border border-white/6 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl border border-white/6 px-3 py-3 text-sm text-white/70">
              <div className="text-xs text-gray-500">当前最危险的项目</div>
              <div className="mt-1">{aiSummary.mostDangerousProject}</div>
            </div>
            <div className="mt-3 rounded-xl border border-white/6 px-3 py-3 text-sm text-white/70">
              <div className="text-xs text-gray-500">最需要重提的审批</div>
              <div className="mt-1">{aiSummary.mostUrgentApproval}</div>
            </div>
            <div className="mt-3 text-xs text-white/35">
              全局总数：未读 {summary.unreadCount} · 强风险 {summary.strongCount} · 可处理 {summary.actionableCount}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
            <div className="text-sm font-medium text-white">提醒规则</div>
            <div className="mt-3 space-y-3">
              {rules.map((rule) => (
                <label
                  key={rule.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/6 px-3 py-3"
                >
                  <div>
                    <div className="text-sm text-white">{rule.type}</div>
                    <div className="mt-1 text-xs text-white/45">
                      阈值 {rule.thresholdDays} 天 · 严重级别 {rule.severity}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleRule({ ...rule, enabled: !rule.enabled })}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      rule.enabled
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/10 bg-white/[0.03] text-white/45'
                    }`}
                  >
                    {rule.enabled ? '开启' : '关闭'}
                  </button>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export const NotificationCenter = memo(NotificationCenterComponent)
