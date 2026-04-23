import type { ApprovalRequest } from '@/store/approval.store'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { DirectorNote } from '@/store/director-notes.store'
import type { ProducerPlanningData } from '@/lib/dashboard/planning'
import type { NotificationItem, ReminderRule } from '@/store/notifications.store'
import type { ProducerDashboardData } from '@/lib/dashboard/aggregate'
import type { Job } from '@/store/jobs.store'
import type { Order } from '@/store/order.store'
import type { Team } from '@/store/team.store'

interface BuildNotificationsInput {
  dashboard: ProducerDashboardData
  planning: ProducerPlanningData
  approvals: ApprovalRequest[]
  notes: DirectorNote[]
  deliveryPackages: DeliveryPackage[]
  orders: Order[]
  jobs: Job[]
  teams: Team[]
  rules: ReminderRule[]
}

export interface NotificationAiSummary {
  topNotifications: string[]
  mostDangerousProject: string
  mostUrgentApproval: string
}

function severityScore(severity: NotificationItem['severity']) {
  if (severity === 'strong') return 3
  if (severity === 'warning') return 2
  return 1
}

function compareNotifications(left: NotificationItem, right: NotificationItem) {
  const bySeverity = severityScore(right.severity) - severityScore(left.severity)
  if (bySeverity !== 0) return bySeverity
  const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Infinity
  const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Infinity
  if (leftDue !== rightDue) return leftDue - rightDue
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
}

function ruleByType(rules: ReminderRule[], type: ReminderRule['type']) {
  return rules.find((rule) => rule.type === type) ?? null
}

function addDays(value: string | number | Date, days: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function buildProjectMaps(input: BuildNotificationsInput) {
  const orderById = new Map(input.orders.map((order) => [order.id, order]))
  const projectTitles = new Map(input.dashboard.overview.map((project) => [project.projectId, project.title]))
  const targetToProjectId = new Map<string, string>()

  input.dashboard.overview.forEach((project) => {
    targetToProjectId.set(project.projectId, project.projectId)
  })

  input.orders.forEach((order) => {
    targetToProjectId.set(order.id, order.id)
    targetToProjectId.set(order.chatId, order.id)
  })

  input.teams.forEach((team) => {
    targetToProjectId.set(team.id, team.projectId)
    targetToProjectId.set(team.projectId, team.projectId)
  })

  input.deliveryPackages.forEach((pkg) => {
    targetToProjectId.set(pkg.id, pkg.projectId)
    pkg.assets.forEach((asset) => {
      targetToProjectId.set(asset.sourceId, pkg.projectId)
    })
  })

  const getProjectMeta = (targetId: string) => {
    const projectId = targetToProjectId.get(targetId)
    if (!projectId) {
      return {
        projectId: undefined,
        title: '未映射项目',
        reviewHref: '/dashboard#action-queue',
        createHref: '/create',
        deliveryHref: '/create#delivery',
      }
    }

    const project = input.dashboard.overview.find((item) => item.projectId === projectId)
    const order = orderById.get(projectId)
    const job = order ? input.jobs.find((item) => item.id === order.chatId) : null

    return {
      projectId,
      title: project?.title ?? job?.title ?? projectTitles.get(projectId) ?? `项目 ${projectId}`,
      reviewHref: project?.links.review ?? `/review/${projectId}`,
      createHref: project?.links.create ?? '/create',
      deliveryHref: project?.links.delivery ?? '/create#delivery',
    }
  }

  return { getProjectMeta }
}

export function buildNotifications(input: BuildNotificationsInput): NotificationItem[] {
  const { getProjectMeta } = buildProjectMaps(input)
  const items: NotificationItem[] = []
  const now = new Date().toISOString()
  const staleRule = ruleByType(input.rules, 'stale-approval')
  const blockerRule = ruleByType(input.rules, 'blocker-open')
  const deliveryRule = ruleByType(input.rules, 'delivery-risk')
  const milestoneRule = ruleByType(input.rules, 'milestone-due')
  const clientPendingRule = ruleByType(input.rules, 'client-pending')
  const licenseRule = ruleByType(input.rules, 'missing-license')

  const approvalsByProject = new Map<string, ApprovalRequest[]>()
  input.approvals.forEach((approval) => {
    const projectMeta = getProjectMeta(approval.targetId)
    if (!projectMeta.projectId) return
    const group = approvalsByProject.get(projectMeta.projectId) ?? []
    group.push(approval)
    approvalsByProject.set(projectMeta.projectId, group)
  })

  input.dashboard.overview.forEach((project) => {
    if (project.pendingApprovalCount > 0 && clientPendingRule?.enabled) {
      items.push({
        id: `notification:${project.projectId}:pending-approval`,
        projectId: project.projectId,
        category: 'approval',
        severity: clientPendingRule.severity,
        title: `${project.title} 仍有待确认项`,
        message: `当前还有 ${project.pendingApprovalCount} 个审批待处理，建议尽快推进人工确认。`,
        sourceType: 'pending-approval',
        sourceId: project.projectId,
        actionLabel: '打开审片页',
        actionHref: project.links.review,
        isRead: false,
        isDismissed: false,
        createdAt: now,
        dueAt: addDays(now, clientPendingRule.thresholdDays),
      })
    }

    if (project.staleApprovalCount > 0 && staleRule?.enabled) {
      items.push({
        id: `notification:${project.projectId}:stale-approval`,
        projectId: project.projectId,
        category: 'approval',
        severity: staleRule.severity,
        title: `${project.title} 有 stale approval`,
        message: `当前有 ${project.staleApprovalCount} 个确认已经过期，需要重新发起。`,
        sourceType: 'stale-approval',
        sourceId: project.projectId,
        actionLabel: '重新发起确认',
        actionHref: project.links.review,
        isRead: false,
        isDismissed: false,
        createdAt: now,
        dueAt: addDays(now, staleRule.thresholdDays),
      })
    }

    if (project.blockerCount > 0 && blockerRule?.enabled) {
      items.push({
        id: `notification:${project.projectId}:blocker-open`,
        projectId: project.projectId,
        category: 'blocker',
        severity: blockerRule.severity,
        title: `${project.title} 有 blocker 批注`,
        message: `当前有 ${project.blockerCount} 条 blocker note 未解除，建议先回到工作区处理。`,
        sourceType: 'blocker-open',
        sourceId: project.projectId,
        actionLabel: '回到工作区',
        actionHref: project.links.create,
        isRead: false,
        isDismissed: false,
        createdAt: now,
        dueAt: addDays(now, blockerRule.thresholdDays),
      })
    }

    if (project.currentStage === 'delivery' && deliveryRule?.enabled) {
      if (project.deliveryStatus === 'missing' || !['ready', 'submitted', 'approved'].includes(project.deliveryStatus)) {
        items.push({
          id: `notification:${project.projectId}:delivery-status`,
          projectId: project.projectId,
          category: 'delivery',
          severity: deliveryRule.severity,
          title: `${project.title} 的交付包还未 ready`,
          message: `当前交付状态为 ${project.deliveryStatus}，不建议直接推进交付。`,
          sourceType: 'delivery-status',
          sourceId: project.projectId,
          actionLabel: '打开交付区',
          actionHref: project.links.delivery,
          isRead: false,
          isDismissed: false,
          createdAt: now,
          dueAt: addDays(now, deliveryRule.thresholdDays),
        })
      }

      if (project.strongRiskCount > 0) {
        items.push({
          id: `notification:${project.projectId}:delivery-risk`,
          projectId: project.projectId,
          category: 'delivery',
          severity: 'strong',
          title: `${project.title} 的交付包存在高风险`,
          message: `当前还有 ${project.strongRiskCount} 个 strong risk，需要用户手动决定是否继续提交。`,
          sourceType: 'delivery-risk',
          sourceId: project.projectId,
          actionLabel: '检查交付包',
          actionHref: project.links.delivery,
          isRead: false,
          isDismissed: false,
          createdAt: now,
          dueAt: now,
        })
      }
    }

    if (project.orderStatus === 'paid' && ['idea', 'storyboard'].includes(project.currentStage)) {
      items.push({
        id: `notification:${project.projectId}:order-pending-progress`,
        projectId: project.projectId,
        category: 'order',
        severity: 'info',
        title: `${project.title} 已付款但尚未推进`,
        message: '订单已具备推进条件，但项目仍停留在前期阶段。',
        sourceType: 'order-ready',
        sourceId: project.projectId,
        actionLabel: '打开工作区',
        actionHref: project.links.create,
        isRead: false,
        isDismissed: false,
        createdAt: now,
      })
    }
  })

  input.approvals
    .filter((approval) => approval.status === 'changes-requested')
    .forEach((approval) => {
      const project = getProjectMeta(approval.targetId)
      items.push({
        id: `notification:${approval.id}:changes-requested`,
        projectId: project.projectId,
        category: 'review',
        severity: 'warning',
        title: `${project.title} 有新的修改请求`,
        message: `审批对象「${approval.title}」被标记为 changes-requested，建议优先整理修改意见。`,
        sourceType: 'changes-requested',
        sourceId: approval.id,
        actionLabel: '查看确认详情',
        actionHref: project.reviewHref,
        isRead: false,
        isDismissed: false,
        createdAt: approval.createdAt,
      })
    })

  input.notes
    .filter((note) => note.priority === 'blocker' && (note.status === 'open' || note.status === 'in-progress'))
    .forEach((note) => {
      const project = getProjectMeta(note.targetId)
      items.push({
        id: `notification:${note.id}:blocker-note`,
        projectId: project.projectId,
        category: 'blocker',
        severity: 'strong',
        title: `${project.title} 有 blocker note`,
        message: note.content,
        sourceType: 'director-note',
        sourceId: note.id,
        actionLabel: '回到工作区',
        actionHref: project.createHref,
        isRead: false,
        isDismissed: false,
        createdAt: note.createdAt,
        dueAt: now,
      })
    })

  input.deliveryPackages.forEach((pkg) => {
    const project = getProjectMeta(pkg.projectId)
    const issues = pkg.riskSummary?.issues ?? []
    const licensingIssues = issues.filter((issue) => ['license-unknown', 'expired-license', 'restricted-usage', 'missing-proof'].includes(issue.type))
    if (licenseRule?.enabled && licensingIssues.length > 0) {
      items.push({
        id: `notification:${pkg.id}:licensing-risk`,
        projectId: pkg.projectId,
        category: 'licensing',
        severity: licenseRule.severity,
        title: `${project.title} 存在授权风险`,
        message: `当前有 ${licensingIssues.length} 个授权相关风险项，包含 missing proof / restricted / expired / unknown。`,
        sourceType: 'missing-license',
        sourceId: pkg.id,
        actionLabel: '查看授权中心',
        actionHref: '/dashboard#licensing',
        isRead: false,
        isDismissed: false,
        createdAt: pkg.updatedAt,
        dueAt: addDays(pkg.updatedAt, licenseRule.thresholdDays),
      })
    }

    const audioIssue = issues.find((issue) => issue.type === 'audio-risk' && issue.severity === 'strong')
    if (audioIssue) {
      items.push({
        id: `notification:${pkg.id}:audio-risk`,
        projectId: pkg.projectId,
        category: 'audio',
        severity: 'strong',
        title: `${project.title} 的声音链路存在高风险`,
        message: audioIssue.message,
        sourceType: 'audio-risk',
        sourceId: pkg.id,
        actionLabel: '检查交付包',
        actionHref: project.deliveryHref,
        isRead: false,
        isDismissed: false,
        createdAt: pkg.updatedAt,
        dueAt: now,
      })
    }

    const clipIssue = issues.find((issue) => issue.type === 'clip-review-risk' && issue.severity === 'strong')
    if (clipIssue) {
      items.push({
        id: `notification:${pkg.id}:clip-risk`,
        projectId: pkg.projectId,
        category: 'video',
        severity: 'strong',
        title: `${project.title} 的镜头链路存在高风险`,
        message: clipIssue.message,
        sourceType: 'clip-review-risk',
        sourceId: pkg.id,
        actionLabel: '检查交付包',
        actionHref: project.deliveryHref,
        isRead: false,
        isDismissed: false,
        createdAt: pkg.updatedAt,
        dueAt: now,
      })
    }
  })

  if (milestoneRule?.enabled) {
    input.planning.alerts.forEach((alert) => {
      items.push({
        id: `notification:planning:${alert.id}`,
        category: 'planning',
        severity: alert.severity,
        title: alert.label,
        message: alert.message,
        sourceType: 'milestone-due',
        sourceId: alert.id,
        actionLabel: '查看排期',
        actionHref: '/dashboard#planning',
        isRead: false,
        isDismissed: false,
        createdAt: now,
        dueAt: addDays(now, milestoneRule.thresholdDays),
      })
    })
  }

  return items.sort(compareNotifications)
}

export function buildNotificationAiSummary(items: NotificationItem[]): NotificationAiSummary {
  const activeItems = items.filter((item) => !item.isDismissed).sort(compareNotifications)
  const topNotifications = activeItems.slice(0, 3).map((item) => item.message)

  const projectRiskMap = new Map<string, number>()
  activeItems.forEach((item) => {
    if (!item.projectId) return
    projectRiskMap.set(item.projectId, (projectRiskMap.get(item.projectId) ?? 0) + severityScore(item.severity))
  })

  const mostDangerousProject = Array.from(projectRiskMap.entries())
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? '当前没有明显高危项目'

  const mostUrgentApproval = activeItems.find((item) => item.category === 'approval')?.title ?? '当前没有需要立即重提的审批'

  return {
    topNotifications: topNotifications.length > 0 ? topNotifications : ['当前没有高优先提醒。'],
    mostDangerousProject,
    mostUrgentApproval,
  }
}
