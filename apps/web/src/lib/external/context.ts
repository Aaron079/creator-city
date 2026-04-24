import { buildActivityLogItems } from '@/lib/activity/aggregate'
import { buildClientProjectStatusFeed } from '@/lib/projects/client-feed'
import type { ReviewResolutionItem } from '@/lib/review/resolution-store'
import type { ApprovalDecision, ApprovalRequest } from '@/store/approval.store'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { DirectorNote } from '@/store/director-notes.store'
import type { NotificationItem } from '@/store/notifications.store'
import type { VersionRecord } from '@/store/version-history.store'

function sortByTime<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export function findDeliveryApprovalRequest(args: {
  projectId: string
  deliveryPackage: DeliveryPackage | null
  approvals: ApprovalRequest[]
}) {
  const targetIds = new Set<string>([
    args.projectId,
    ...(args.deliveryPackage ? [args.deliveryPackage.id] : []),
  ])

  return sortByTime(
    args.approvals.filter((approval) => (
      approval.targetType === 'delivery'
      && targetIds.has(approval.targetId)
    )),
  )[0] ?? null
}

export function findLatestClientDecision(args: {
  approval: ApprovalRequest | null
}): ApprovalDecision | null {
  if (!args.approval) return null

  return sortByTime(
    args.approval.decisions.filter((decision) => decision.role === 'client'),
  )[0] ?? null
}

export function buildExternalClientContext(input: {
  projectId: string
  projectTitle: string
  approvals: ApprovalRequest[]
  notes: DirectorNote[]
  versions: VersionRecord[]
  deliveryPackage: DeliveryPackage | null
  notifications: NotificationItem[]
  resolutions: ReviewResolutionItem[]
}) {
  const activity = buildActivityLogItems({
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    invitationActivities: [],
    roleChanges: [],
    approvals: input.approvals,
    notes: input.notes,
    versions: input.versions,
    deliveryPackages: input.deliveryPackage ? [input.deliveryPackage] : [],
    notifications: input.notifications,
  })
  const clientFeed = buildClientProjectStatusFeed({
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    currentStage: input.deliveryPackage?.manifest?.projectStage ?? 'delivery',
    approvals: input.approvals,
    versions: input.versions,
    deliveryPackage: input.deliveryPackage,
    activity,
    resolutions: input.resolutions,
  })
  const deliveryApproval = findDeliveryApprovalRequest({
    projectId: input.projectId,
    deliveryPackage: input.deliveryPackage,
    approvals: input.approvals,
  })

  return {
    activity,
    clientFeed,
    deliveryApproval,
    latestDecision: findLatestClientDecision({ approval: deliveryApproval }),
  }
}
