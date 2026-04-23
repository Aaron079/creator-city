import { getActionTarget } from '@/lib/routing/actions'
import type { WorkspacePortfolioData, UserProjectCard } from '@/lib/projects/workspace'
import type { PersonalWorkQueueData, WorkQueueItem } from '@/lib/workqueue/aggregate'
import { isActionableNotification, isSnoozedNotification, type NotificationItem } from '@/store/notifications.store'

export type CommandResultKind = 'project' | 'page' | 'action' | 'notification'

export interface CommandResult {
  id: string
  kind: CommandResultKind
  title: string
  subtitle: string
  href: string
  projectId?: string
  role?: string
  priority: number
  keywords: string[]
}

function uniqById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

function priorityForProject(card: UserProjectCard) {
  let score = 60
  if (card.waitingForMe) score += 40
  if (card.riskLevel === 'strong') score += 25
  if (card.riskLevel === 'warning') score += 12
  score += Math.min(card.pendingCount, 9)
  return score
}

function priorityForQueueItem(item: WorkQueueItem) {
  let score = 80
  if (item.isBlocking) score += 25
  if (item.severity === 'strong') score += 20
  if (item.severity === 'warning') score += 10
  if (item.category === 'approval' || item.category === 'delivery' || item.category === 'invitation') score += 8
  return score
}

function priorityForNotification(item: NotificationItem) {
  let score = 72
  if (item.severity === 'strong') score += 18
  if (item.severity === 'warning') score += 10
  if (isActionableNotification(item)) score += 12
  if (!item.isRead) score += 8
  if (item.section === 'invitation' || item.section === 'approval' || item.section === 'delivery') score += 5
  return score
}

function getProjectKeywords(card: UserProjectCard) {
  return [
    card.title,
    card.role,
    card.roleLabel,
    card.stage,
    card.readiness,
    card.deliveryStatus,
    ...card.highlights,
    ...(card.waitingForMe ? ['waiting', 'waiting for me', '待我处理'] : []),
  ]
}

function getPageResults() {
  return [
    {
      id: 'page-dashboard',
      kind: 'page' as const,
      title: 'Dashboard',
      subtitle: 'Producer 控制台、风险、审批与交付总览',
      href: getActionTarget({ actionType: 'dashboard-overview' }).actionHref,
      priority: 20,
      keywords: ['dashboard', 'producer', '审批', '交付', '总览'],
    },
    {
      id: 'page-projects',
      kind: 'page' as const,
      title: 'Projects',
      subtitle: '跨项目总览、项目切换与优先级概览',
      href: '/projects',
      priority: 18,
      keywords: ['projects', 'workspace', 'portfolio', '项目', '切换'],
    },
    {
      id: 'page-me',
      kind: 'page' as const,
      title: 'My Work',
      subtitle: '个人工作台、邀请收件箱与当前待办',
      href: '/me',
      priority: 19,
      keywords: ['me', 'my work', 'queue', '个人工作台', '待办'],
    },
    {
      id: 'page-notifications',
      kind: 'page' as const,
      title: 'Notifications',
      subtitle: '统一提醒收件箱、风险与邀请入口',
      href: getActionTarget({ actionType: 'dashboard-notifications' }).actionHref,
      priority: 18,
      keywords: ['notifications', '提醒', 'inbox', '风险', '邀请'],
    },
    {
      id: 'page-invitation-inbox',
      kind: 'page' as const,
      title: 'Invitation Inbox',
      subtitle: '查看项目邀请、接受或拒绝加入',
      href: getActionTarget({ actionType: 'invitation-inbox' }).actionHref,
      priority: 22,
      keywords: ['invitation', 'invite', '邀请', '收件箱'],
    },
  ]
}

function buildProjectResults(cards: UserProjectCard[]): CommandResult[] {
  return cards.map((card) => ({
    id: `project-${card.projectId}`,
    kind: 'project',
    title: card.title,
    subtitle: `${card.roleLabel} · ${card.stage} · ${card.waitingForMe ? 'Waiting for me' : card.readiness}`,
    href: getActionTarget({ actionType: 'project-home', projectId: card.projectId }).actionHref,
    projectId: card.projectId,
    role: card.role,
    priority: priorityForProject(card),
    keywords: getProjectKeywords(card),
  }))
}

function buildProjectQuickActionResults(cards: UserProjectCard[]): CommandResult[] {
  return cards.flatMap((card) => (
    card.quickLinks.map((link) => ({
      id: `project-action-${card.projectId}-${link.kind}`,
      kind: 'action' as const,
      title: `${card.title} · ${link.label}`,
      subtitle: `${card.roleLabel} · ${card.stage}`,
      href: link.href,
      projectId: card.projectId,
      role: card.role,
      priority: priorityForProject(card) - 8,
      keywords: [card.title, link.label, link.kind, card.roleLabel, card.stage],
    }))
  ))
}

function buildQueueResults(items: WorkQueueItem[]): CommandResult[] {
  return items
    .filter((item) => !item.isDone)
    .map((item) => ({
      id: `queue-${item.id}`,
      kind: 'action' as const,
      title: item.title,
      subtitle: `${item.projectTitle} · ${item.message}`,
      href: item.actionHref,
      projectId: item.projectId,
      priority: priorityForQueueItem(item),
      keywords: [item.projectTitle, item.title, item.message, item.category, item.actionLabel, item.severity],
    }))
}

function buildNotificationResults(items: NotificationItem[]): CommandResult[] {
  return items
    .filter((item) => !item.isDismissed && !isSnoozedNotification(item))
    .map((item) => ({
      id: `notification-${item.id}`,
      kind: 'notification' as const,
      title: item.title,
      subtitle: `${item.projectTitle ?? item.projectId ?? '全局提醒'} · ${item.message}`,
      href: item.actionHref,
      projectId: item.projectId,
      role: item.roleScope,
      priority: priorityForNotification(item),
      keywords: [
        item.title,
        item.message,
        item.projectTitle ?? '',
        item.projectId ?? '',
        item.category,
        item.section ?? '',
        item.roleScope ?? '',
      ],
    }))
}

export function buildCommandResults(input: {
  portfolio: WorkspacePortfolioData
  workQueue: PersonalWorkQueueData
  notifications: NotificationItem[]
}) {
  const projects = buildProjectResults(input.portfolio.cards)
  const projectActions = buildProjectQuickActionResults([
    ...input.portfolio.waitingProjects,
    ...input.portfolio.highPriorityProjects,
    ...input.portfolio.recentProjects,
  ])
  const queue = buildQueueResults([
    ...input.workQueue.priorityQueue,
    ...input.workQueue.items,
  ])
  const notifications = buildNotificationResults(input.notifications)

  return uniqById([
    ...getPageResults(),
    ...projects,
    ...projectActions,
    ...queue,
    ...notifications,
  ]).sort((left, right) => right.priority - left.priority)
}

function tokenScore(text: string, token: string) {
  if (text.startsWith(token)) return 12
  if (text.includes(` ${token}`)) return 8
  if (text.includes(token)) return 5
  return 0
}

export function searchCommandResults(results: CommandResult[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return results.slice(0, 18)

  const tokens = normalized.split(/\s+/).filter(Boolean)

  return results
    .map((result) => {
      const haystack = `${result.title} ${result.subtitle} ${result.keywords.join(' ')}`.toLowerCase()
      let matchScore = 0

      for (const token of tokens) {
        const score = tokenScore(haystack, token)
        if (score === 0) return null
        matchScore += score
      }

      return {
        result,
        matchScore,
      }
    })
    .filter((entry): entry is { result: CommandResult; matchScore: number } => entry !== null)
    .sort((left, right) => {
      if (left.matchScore !== right.matchScore) return right.matchScore - left.matchScore
      return right.result.priority - left.result.priority
    })
    .map((entry) => entry.result)
    .slice(0, 18)
}
