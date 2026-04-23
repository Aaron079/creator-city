import type { ActivityLogItem, ActivitySeverity } from '@/lib/activity/aggregate'
import { getReviewHref } from '@/lib/routing/actions'
import type { ReviewResolutionItem } from '@/lib/review/resolution-store'
import { getDeliveryDecisionLabel, getDeliveryVersionLabel } from '@/lib/review/delivery-approval'
import type { ApprovalRequest } from '@/store/approval.store'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { VersionRecord } from '@/store/version-history.store'

export type ClientFeedActivityType =
  | 'delivery-submitted'
  | 'delivery-needs-revision'
  | 'approval-requested'
  | 'approval-approved'
  | 'approval-changes-requested'
  | 'version-created'
  | 'resolution-resolved'
  | 'resolution-resubmitted'
  | 'note-to-client'

export interface ClientProjectFeedActivityItem {
  id: string
  type: ClientFeedActivityType
  title: string
  message: string
  createdAt: string
  severity: ActivitySeverity
  actionLabel?: string
  actionHref?: string
}

export interface ClientProjectFeedSummary {
  stage: string
  latestVersion: string
  deliveryStatus: string
  openResolutions: number
  resolvedResolutions: number
  waitingForClientAction: boolean
}

export interface ClientProjectStatusFeedData {
  summary: ClientProjectFeedSummary
  latestDecision: {
    decisionLabel: string
    comment: string
    decidedAt: string
    actorId: string
  } | null
  activities: ClientProjectFeedActivityItem[]
  currentAction: {
    title: string
    message: string
    actionLabel: string
    actionHref: string
  } | null
  resolutionSnapshot: {
    open: number
    inProgress: number
    resolved: number
    resubmitted: number
  }
  aiSummary: {
    currentState: string
    recentChanges: string
    nextActionHint: string
  }
}

function sortByTime<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function targetIdsForProject(projectId: string, deliveryPackage: DeliveryPackage | null) {
  return new Set<string>([
    projectId,
    ...(deliveryPackage ? [deliveryPackage.id, ...deliveryPackage.assets.map((asset) => asset.sourceId)] : []),
  ])
}

function isClientVisibleActivity(type: ActivityLogItem['type']) {
  return (
    type === 'delivery-submitted'
    || type === 'delivery-needs-revision'
    || type === 'approval-requested'
    || type === 'approval-approved'
    || type === 'approval-changes-requested'
    || type === 'version-created'
  )
}

function mapActivityType(type: ActivityLogItem['type']): ClientFeedActivityType {
  switch (type) {
    case 'delivery-submitted':
      return 'delivery-submitted'
    case 'delivery-needs-revision':
      return 'delivery-needs-revision'
    case 'approval-requested':
      return 'approval-requested'
    case 'approval-approved':
      return 'approval-approved'
    case 'approval-changes-requested':
      return 'approval-changes-requested'
    case 'version-created':
      return 'version-created'
    default:
      return 'note-to-client'
  }
}

export function buildClientProjectStatusFeed(input: {
  projectId: string
  projectTitle: string
  currentStage: string
  approvals: ApprovalRequest[]
  versions: VersionRecord[]
  deliveryPackage: DeliveryPackage | null
  activity: ActivityLogItem[]
  resolutions: ReviewResolutionItem[]
}): ClientProjectStatusFeedData {
  const { projectId, projectTitle, currentStage, approvals, versions, deliveryPackage, activity, resolutions } = input
  const targetIds = targetIdsForProject(projectId, deliveryPackage)
  const clientApprovals = approvals.filter((approval) => approval.requiredRoles.includes('client') && targetIds.has(approval.targetId))
  const latestClientDecision = sortByTime(
    clientApprovals.flatMap((approval) => approval.decisions.filter((decision) => decision.role === 'client')),
  )[0] ?? null
  const visibleActivities = sortByTime(
    activity
      .filter((item) => item.projectId === projectId && isClientVisibleActivity(item.type))
      .map((item) => ({
        id: item.id,
        type: mapActivityType(item.type),
        title: item.message,
        message: item.actorRole ? `${item.actorName} · ${item.actorRole}` : item.actorName,
        createdAt: item.createdAt,
        severity: item.severity,
        actionLabel: item.actionLabel,
        actionHref: item.actionHref,
      })),
  )
  const resolutionActivities: ClientProjectFeedActivityItem[] = sortByTime(
    resolutions
      .filter((item) => item.projectId === projectId && (item.status === 'resolved' || item.status === 'resubmitted'))
      .map((item) => ({
        id: `client-feed-resolution-${item.id}-${item.status}`,
        type: item.status === 'resubmitted' ? 'resolution-resubmitted' : 'resolution-resolved',
        title: item.title,
        message: item.status === 'resubmitted'
          ? '团队已完成处理并重新提交确认。'
          : '团队已将该修改项标记为已解决。',
        createdAt: item.status === 'resubmitted' ? (item.resubmittedAt ?? item.updatedAt) : (item.resolvedAt ?? item.updatedAt),
        severity: item.severity === 'strong' ? 'warning' : 'info',
        actionLabel: '查看 Review',
        actionHref: `${getReviewHref(projectId)}#resolution-loop`,
      })),
  )
  const latestVersion = sortByTime(
    versions.filter((version) => targetIds.has(version.entityId)),
  )[0] ?? null
  const resolutionSnapshot = {
    open: resolutions.filter((item) => item.projectId === projectId && item.status === 'open').length,
    inProgress: resolutions.filter((item) => item.projectId === projectId && item.status === 'in-progress').length,
    resolved: resolutions.filter((item) => item.projectId === projectId && item.status === 'resolved').length,
    resubmitted: resolutions.filter((item) => item.projectId === projectId && item.status === 'resubmitted').length,
  }
  const waitingForClientAction = clientApprovals.some((approval) => approval.status === 'pending' || approval.status === 'stale')
    || deliveryPackage?.status === 'submitted'
  const activities = sortByTime([...visibleActivities, ...resolutionActivities]).slice(0, 8)

  return {
    summary: {
      stage: currentStage,
      latestVersion: getDeliveryVersionLabel(deliveryPackage, latestVersion?.label ?? null),
      deliveryStatus: deliveryPackage?.status ?? 'missing',
      openResolutions: resolutionSnapshot.open + resolutionSnapshot.inProgress,
      resolvedResolutions: resolutionSnapshot.resolved + resolutionSnapshot.resubmitted,
      waitingForClientAction: Boolean(waitingForClientAction),
    },
    latestDecision: latestClientDecision ? {
      decisionLabel: getDeliveryDecisionLabel(latestClientDecision.status),
      comment: latestClientDecision.comment ?? '未填写备注',
      decidedAt: latestClientDecision.createdAt,
      actorId: latestClientDecision.userId,
    } : null,
    activities,
    currentAction: waitingForClientAction
      ? {
          title: '需要你处理',
          message: '当前有待确认内容或交付版本正在等待客户动作。请进入 Review 完成确认、请求修改或拒绝。',
          actionLabel: '前往 Review',
          actionHref: getReviewHref(projectId),
        }
      : {
          title: '团队处理中',
          message: `当前项目 ${projectTitle} 没有新的待确认动作。你可以查看最近变化与修改项处理进度。`,
          actionLabel: '查看 Review 状态',
          actionHref: getReviewHref(projectId),
        },
    resolutionSnapshot,
    aiSummary: {
      currentState: waitingForClientAction ? '当前正在等待客户确认。' : '当前主要处于团队内部处理阶段。',
      recentChanges: activities[0]?.title ?? '最近暂无新的客户可见变化。',
      nextActionHint: waitingForClientAction ? '先查看本次待确认版本与交付快照。' : '可以关注修改项是否已重新提交，等待下一次确认。',
    },
  }
}
