'use client'

import Link from 'next/link'
import type { NotificationAiSummary } from '@/lib/notifications/aggregate'
import type { NotificationItem, NotificationSummary, ReminderRule } from '@/store/notifications.store'
import type { WorkspaceRole } from '@/lib/roles/view-mode'

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

function categoryLabel(category: NotificationItem['category']) {
  switch (category) {
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
      return category
  }
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

export function NotificationCenter({
  items,
  summary,
  rules,
  aiSummary,
  role,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onToggleRule,
}: {
  items: NotificationItem[]
  summary: NotificationSummary
  rules: ReminderRule[]
  aiSummary: NotificationAiSummary
  role: WorkspaceRole
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onDismiss: (id: string) => void
  onToggleRule: (rule: ReminderRule) => void
}) {
  const visibleItems = items.filter((item) => !item.isDismissed)
  const prioritizedItems = visibleItems.slice(0, role === 'client' ? 3 : 5)
  const compactMode = role === 'client'

  return (
    <section
      id="notifications"
      className="rounded-2xl border border-city-border bg-city-surface/60 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.16)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">Reminder Center</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/60">
            这里集中显示待审批、blocker、交付风险、排期与授权提醒。系统只做排序与摘要，不会自动替你处理任何动作。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
          >
            全部标记已读
          </button>
          <Link
            href="#action-queue"
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
          >
            查看总控动作队列
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <MetricTile label="未读提醒" value={summary.unreadCount} tone={summary.unreadCount > 0 ? 'warning' : 'default'} />
        <MetricTile label="高风险" value={summary.strongCount} tone={summary.strongCount > 0 ? 'danger' : 'default'} />
        <MetricTile label="待审批" value={summary.approvalsPendingCount} tone={summary.approvalsPendingCount > 0 ? 'warning' : 'default'} />
        <MetricTile label="Stale approvals" value={summary.staleApprovalCount} tone={summary.staleApprovalCount > 0 ? 'warning' : 'default'} />
        <MetricTile label="交付风险" value={summary.deliveryRiskCount} tone={summary.deliveryRiskCount > 0 ? 'danger' : 'default'} />
      </div>

      <div className={`mt-6 grid gap-6 ${compactMode ? 'xl:grid-cols-1' : 'xl:grid-cols-[1.25fr_0.75fr]'}`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-white">最近高优先级提醒</div>
            <div className="text-xs text-gray-500">仅展示最近 {prioritizedItems.length} 条</div>
          </div>
          {prioritizedItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
              当前没有需要优先处理的提醒。
            </div>
          ) : prioritizedItems.map((item) => {
            const meta = severityMeta(item.severity)
            return (
              <div key={item.id} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-white/45">{categoryLabel(item.category)}</span>
                      {item.projectId ? <span className="text-xs text-white/35">项目 {item.projectId}</span> : null}
                    </div>
                    <div className="mt-1 text-base font-semibold text-white">{item.title}</div>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>

                <p className="mt-3 text-sm text-white/65">{item.message}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/40">
                  <span>创建于 {new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                  {item.dueAt ? <span>建议处理前 {new Date(item.dueAt).toLocaleString('zh-CN')}</span> : null}
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
                      onClick={() => onMarkRead(item.id)}
                      className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/65 transition hover:border-white/20 hover:text-white"
                    >
                      标记已读
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onDismiss(item.id)}
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/55 transition hover:border-white/20 hover:text-white"
                  >
                    忽略
                  </button>
                </div>
              </div>
            )
          })}
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
          </div>

          {!compactMode ? (
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
          ) : null}
        </div>
      </div>
    </section>
  )
}
