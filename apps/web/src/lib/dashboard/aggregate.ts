import type { ApprovalGate, ApprovalRequest, ApprovalRole } from '@/store/approval.store'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { DirectorNote } from '@/store/director-notes.store'
import type { Job } from '@/store/jobs.store'
import type { Order } from '@/store/order.store'
import type { Task } from '@/store/task.store'
import type { ProjectStage, Team } from '@/store/team.store'
import type { VersionRecord } from '@/store/version-history.store'

export interface DashboardActivityItem {
  id: string
  title: string
  detail: string
  createdAt: string
  kind: 'approval' | 'task' | 'version' | 'delivery'
}

export interface DashboardApprovalRoleStatus {
  role: ApprovalRole
  status: 'pending' | 'approved' | 'changes-requested' | 'rejected' | 'stale' | 'missing'
  label: string
}

export interface ProducerDashboardData {
  projectTitle: string
  currentStage: ProjectStage
  nextStage: ProjectStage | null
  readinessStatus: 'blocked' | 'needs-review' | 'ready'
  hasBlockers: boolean
  canAdvance: boolean
  readinessReason: string
  riskOverview: {
    blockerNotes: number
    staleApprovals: number
    pendingApprovals: number
    strongDeliveryRisks: number
    unknownLicenses: number
  }
  approvals: {
    director: DashboardApprovalRoleStatus
    client: DashboardApprovalRoleStatus
    producer: DashboardApprovalRoleStatus
    editor: DashboardApprovalRoleStatus
    latestChangesRequested: ApprovalRequest | null
  }
  delivery: {
    exists: boolean
    status: DeliveryPackage['status'] | 'missing'
    includedAssetCount: number
    strongRiskCount: number
    submittedForClient: boolean
  }
  tasks: {
    open: number
    inProgress: number
    done: number
    blockerLike: number
  }
  order: {
    status: Order['status'] | 'missing'
    paymentStatus: Order['paymentStatus'] | 'unknown'
    quoteId?: string
    deliveryStatus?: Job['delivery'] extends infer T ? T extends { status?: infer S } ? S : never : never
    price?: number
  }
  activity: DashboardActivityItem[]
  aiSummary: {
    topIssues: string[]
    nearestBlocker: string
    recommendedAction: string
  }
}

interface AggregateDashboardInput {
  teams: Team[]
  approvals: ApprovalRequest[]
  approvalGates: ApprovalGate[]
  notes: DirectorNote[]
  tasks: Task[]
  orders: Order[]
  jobs: Job[]
  deliveryPackages: DeliveryPackage[]
  versions: VersionRecord[]
}

const STAGE_FLOW: ProjectStage[] = ['idea', 'storyboard', 'shooting', 'editing', 'delivery']

function getNextStage(stage: ProjectStage): ProjectStage | null {
  const index = STAGE_FLOW.indexOf(stage)
  return STAGE_FLOW[index + 1] ?? null
}

function getRoleLabel(role: ApprovalRole) {
  switch (role) {
    case 'director':
      return '导演确认'
    case 'client':
      return '客户确认'
    case 'producer':
      return '制片确认'
    case 'editor':
      return '剪辑确认'
    case 'cinematographer':
      return '摄影确认'
    case 'creator':
      return '创作者确认'
    default:
      return role
  }
}

function latestByTime<T extends { createdAt: string }>(items: T[]): T | null {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null
}

function deriveRoleStatus(role: ApprovalRole, approvals: ApprovalRequest[]): DashboardApprovalRoleStatus {
  const relevant = approvals.filter((approval) => approval.requiredRoles.includes(role))
  const latest = latestByTime(relevant)
  return {
    role,
    status: latest?.status ?? 'missing',
    label: getRoleLabel(role),
  }
}

function buildActivity(args: {
  approvals: ApprovalRequest[]
  tasks: Task[]
  versions: VersionRecord[]
  deliveryPackage: DeliveryPackage | null
}): DashboardActivityItem[] {
  const approvalItems: DashboardActivityItem[] = args.approvals.map((approval) => ({
    id: `approval-${approval.id}`,
    title: approval.title,
    detail: `确认状态 ${approval.status}`,
    createdAt: approval.createdAt,
    kind: 'approval',
  }))

  const taskItems: DashboardActivityItem[] = args.tasks.map((task) => ({
    id: `task-${task.id}`,
    title: task.title,
    detail: `任务状态 ${task.status}`,
    createdAt: new Date(task.createdAt).toISOString(),
    kind: 'task',
  }))

  const versionItems: DashboardActivityItem[] = args.versions.map((version) => ({
    id: `version-${version.id}`,
    title: version.label,
    detail: version.summary,
    createdAt: version.createdAt,
    kind: 'version',
  }))

  const deliveryItems: DashboardActivityItem[] = args.deliveryPackage ? [{
    id: `delivery-${args.deliveryPackage.id}`,
    title: args.deliveryPackage.title,
    detail: `交付包状态 ${args.deliveryPackage.status}`,
    createdAt: args.deliveryPackage.updatedAt,
    kind: 'delivery',
  }] : []

  return [...deliveryItems, ...approvalItems, ...taskItems, ...versionItems]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 6)
}

export function aggregateProducerDashboard(input: AggregateDashboardInput): ProducerDashboardData {
  const activeTeam = input.teams.find((team) => team.stage !== 'delivery') ?? input.teams[0] ?? null
  const currentStage = activeTeam?.stage ?? 'idea'
  const nextStage = getNextStage(currentStage)
  const activeOrder = activeTeam ? input.orders.find((order) => order.id === activeTeam.projectId) ?? null : input.orders[0] ?? null
  const activeJob = activeOrder ? input.jobs.find((job) => job.id === activeOrder.chatId) ?? null : null
  const projectId = activeOrder?.id ?? activeTeam?.projectId ?? activeJob?.id ?? 'creator-city'
  const projectTitle = activeJob?.title ?? `项目 ${projectId}`
  const deliveryPackage = latestByTime(input.deliveryPackages.filter((pkg) => pkg.projectId === projectId))
  const gate = input.approvalGates.find((item) => item.stage === currentStage) ?? null

  const blockerNotes = input.notes.filter((note) => note.priority === 'blocker' && (note.status === 'open' || note.status === 'in-progress'))
  const staleApprovals = input.approvals.filter((approval) => approval.status === 'stale')
  const pendingApprovals = input.approvals.filter((approval) => approval.status === 'pending')
  const latestChangesRequested = latestByTime(input.approvals.filter((approval) => approval.status === 'changes-requested'))

  const strongDeliveryRisks = deliveryPackage?.riskSummary?.issues.filter((issue) => issue.severity === 'strong').length ?? 0
  const unknownLicenses = deliveryPackage?.riskSummary?.issues.filter((issue) => issue.type === 'license-unknown').length ?? 0
  const submittedForClient = deliveryPackage?.status === 'submitted' || deliveryPackage?.status === 'approved' || Boolean(
    input.approvals.find((approval) => approval.targetType === 'delivery' && approval.targetId === projectId),
  )

  let readinessStatus: ProducerDashboardData['readinessStatus'] = gate?.status === 'blocked'
    ? 'blocked'
    : gate?.status === 'needs-review'
      ? 'needs-review'
      : 'ready'

  let readinessReason = gate?.status === 'blocked'
    ? '当前阶段的审批门仍是 blocked。'
    : gate?.status === 'needs-review'
      ? '当前阶段仍有待确认项。'
      : '当前阶段暂无明显阻塞。'

  if (blockerNotes.length > 0) {
    readinessStatus = 'blocked'
    readinessReason = '存在 blocker notes，需要先处理。'
  } else if (currentStage === 'delivery' && !deliveryPackage) {
    readinessStatus = 'needs-review'
    readinessReason = '还没有建立 Delivery Package。'
  } else if (currentStage === 'delivery' && deliveryPackage && !['ready', 'submitted', 'approved'].includes(deliveryPackage.status)) {
    readinessStatus = 'needs-review'
    readinessReason = 'Delivery Package 仍未达到 ready / submitted 状态。'
  } else if (currentStage === 'delivery' && strongDeliveryRisks > 0) {
    readinessStatus = 'needs-review'
    readinessReason = 'Delivery Package 中仍有高风险项。'
  }

  const tasksForActiveTeam = activeTeam ? input.tasks.filter((task) => task.teamId === activeTeam.id) : input.tasks
  const openTasks = tasksForActiveTeam.filter((task) => task.status === 'todo').length
  const inProgressTasks = tasksForActiveTeam.filter((task) => task.status === 'doing').length
  const doneTasks = tasksForActiveTeam.filter((task) => task.status === 'done').length
  const blockerLikeTasks = blockerNotes.length

  const approvalsScope = input.approvals.filter((approval) => (
    approval.targetType === 'delivery'
      ? approval.targetId === projectId
      : true
  ))

  const directorStatus = deriveRoleStatus('director', approvalsScope)
  const clientStatus = deriveRoleStatus('client', approvalsScope)
  const producerStatus = deriveRoleStatus('producer', approvalsScope)
  const editorStatus = deriveRoleStatus('editor', approvalsScope)

  const activity = buildActivity({
    approvals: approvalsScope,
    tasks: tasksForActiveTeam,
    versions: input.versions.filter((version) => ['delivery', 'editor-timeline', 'editor-clip', 'video-shot', 'storyboard-frame'].includes(version.entityType)),
    deliveryPackage,
  })

  const issuePool = [
    blockerNotes.length > 0 ? `有 ${blockerNotes.length} 条 blocker notes 仍未解除。` : null,
    staleApprovals.length > 0 ? `有 ${staleApprovals.length} 个 stale approvals 需要重新确认。` : null,
    pendingApprovals.length > 0 ? `有 ${pendingApprovals.length} 个 pending approvals 仍待处理。` : null,
    strongDeliveryRisks > 0 ? `交付包中还有 ${strongDeliveryRisks} 个 strong risks。` : null,
    deliveryPackage && !submittedForClient ? '交付包已存在，但还没有提交客户确认。' : null,
    !deliveryPackage ? '还没有创建交付包。' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 3)

  const nearestBlocker = blockerNotes[0]?.content
    ?? latestChangesRequested?.title
    ?? (strongDeliveryRisks > 0 ? '交付包高风险项仍待人工确认。' : '当前没有明显 blocker。')

  const recommendedAction = !deliveryPackage
    ? '先建立 Delivery Package，明确交付资产与确认边界。'
    : staleApprovals.length > 0
      ? '优先处理 stale approvals，避免交付依据失效。'
      : blockerNotes.length > 0
        ? '先清理 blocker notes，再决定是否推进阶段。'
        : pendingApprovals.length > 0
          ? '补齐待确认项，尤其是客户和导演确认。'
          : currentStage === 'delivery' && !submittedForClient
            ? '交付包已就绪后，再由用户决定是否提交客户确认。'
            : '当前最适合推进的是整理最近版本和任务优先级。'

  return {
    projectTitle,
    currentStage,
    nextStage,
    readinessStatus,
    hasBlockers: blockerNotes.length > 0,
    canAdvance: readinessStatus === 'ready' && blockerNotes.length === 0,
    readinessReason,
    riskOverview: {
      blockerNotes: blockerNotes.length,
      staleApprovals: staleApprovals.length,
      pendingApprovals: pendingApprovals.length,
      strongDeliveryRisks,
      unknownLicenses,
    },
    approvals: {
      director: directorStatus,
      client: clientStatus,
      producer: producerStatus,
      editor: editorStatus,
      latestChangesRequested,
    },
    delivery: {
      exists: Boolean(deliveryPackage),
      status: deliveryPackage?.status ?? 'missing',
      includedAssetCount: deliveryPackage?.assets.filter((asset) => asset.included).length ?? 0,
      strongRiskCount: strongDeliveryRisks,
      submittedForClient,
    },
    tasks: {
      open: openTasks,
      inProgress: inProgressTasks,
      done: doneTasks,
      blockerLike: blockerLikeTasks,
    },
    order: {
      status: activeOrder?.status ?? 'missing',
      paymentStatus: activeOrder?.paymentStatus ?? 'unknown',
      quoteId: activeOrder?.quoteId,
      deliveryStatus: activeJob?.delivery?.status,
      price: activeOrder?.price,
    },
    activity,
    aiSummary: {
      topIssues: issuePool.length > 0 ? issuePool : ['当前没有明显高优先问题。'],
      nearestBlocker,
      recommendedAction,
    },
  }
}
