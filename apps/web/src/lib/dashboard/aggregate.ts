import type { ApprovalGate, ApprovalRequest, ApprovalRole } from '@/store/approval.store'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { DirectorNote } from '@/store/director-notes.store'
import type { Job } from '@/store/jobs.store'
import type { Order } from '@/store/order.store'
import type { Task } from '@/store/task.store'
import type { ProjectStage, Team } from '@/store/team.store'
import type { VersionRecord } from '@/store/version-history.store'
import {
  buildProducerActionQueue,
  type DashboardActionProjectContext,
  type ProducerDashboardAction,
} from '@/lib/dashboard/actions'

export interface DashboardActivityItem {
  id: string
  title: string
  detail: string
  createdAt: string
  kind: 'approval' | 'task' | 'version' | 'delivery' | 'note'
  projectId: string
}

export interface DashboardApprovalRoleStatus {
  role: ApprovalRole
  status: 'pending' | 'approved' | 'changes-requested' | 'rejected' | 'stale' | 'missing'
  label: string
}

export interface DashboardProjectOverview {
  projectId: string
  title: string
  currentStage: ProjectStage
  nextStage: ProjectStage | null
  readinessStatus: 'blocked' | 'needs-review' | 'ready'
  readinessReason: string
  blockerCount: number
  pendingApprovalCount: number
  staleApprovalCount: number
  deliveryStatus: DeliveryPackage['status'] | 'missing'
  orderStatus: Order['status'] | 'missing'
  submittedForClient: boolean
  strongRiskCount: number
  unknownLicenseCount: number
  strongLicensingRiskCount: number
  canAdvance: boolean
  links: {
    review: string
    create: string
    delivery: string
    detail: string
  }
}

export interface ProducerQuickAction {
  id: string
  label: string
  description: string
  href: string
}

export interface ProducerDashboardData {
  totalProjects: number
  overview: DashboardProjectOverview[]
  actionQueue: ProducerDashboardAction[]
  quickActions: ProducerQuickAction[]
  riskRadar: {
    staleApprovals: number
    unknownLicenses: number
    strongLicensingRisk: number
    openBlockerNotes: number
    strongAudioRisk: number
    strongClipRisk: number
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

interface ProjectAggregateContext extends DashboardActionProjectContext {
  nextStage: ProjectStage | null
  readinessStatus: DashboardProjectOverview['readinessStatus']
  readinessReason: string
  canAdvance: boolean
  unknownLicenseCount: number
  strongLicensingRiskCount: number
  missingProofCount: number
  taskOpenCount: number
  taskInProgressCount: number
  taskDoneCount: number
  latestChangesRequested: ApprovalRequest | null
  orderPaymentStatus: Order['paymentStatus'] | 'unknown'
  quoteId?: string
  deliveryJobStatus?: Job['delivery'] extends infer T ? T extends { status?: infer S } ? S : never : never
  price?: number
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

function getProjectIds(input: AggregateDashboardInput) {
  return Array.from(new Set([
    ...input.teams.map((team) => team.projectId),
    ...input.orders.map((order) => order.id),
    ...input.deliveryPackages.map((pkg) => pkg.projectId),
  ]))
}

function buildProjectContext(projectId: string, input: AggregateDashboardInput): ProjectAggregateContext {
  const team = input.teams.find((item) => item.projectId === projectId) ?? null
  const order = input.orders.find((item) => item.id === projectId) ?? null
  const job = order ? input.jobs.find((item) => item.id === order.chatId) ?? null : null
  const deliveryPackage = latestByTime(input.deliveryPackages.filter((pkg) => pkg.projectId === projectId))
  const currentStage = team?.stage
    ?? (deliveryPackage ? 'delivery' : order?.status === 'in_progress' ? 'shooting' : 'idea')
  const nextStage = getNextStage(currentStage)
  const title = job?.title ?? deliveryPackage?.title ?? `项目 ${projectId}`
  const targetIds = new Set<string>([projectId, order?.id, order?.chatId, job?.id].filter((value): value is string => Boolean(value)))
  const projectNotes = input.notes.filter((note) => targetIds.has(note.targetId))
  const projectApprovals = input.approvals.filter((approval) => targetIds.has(approval.targetId))
  const latestChangesRequested = latestByTime(projectApprovals.filter((approval) => approval.status === 'changes-requested'))
  const blockerNotes = projectNotes.filter((note) => note.priority === 'blocker' && (note.status === 'open' || note.status === 'in-progress'))
  const pendingApprovals = projectApprovals.filter((approval) => approval.status === 'pending')
  const staleApprovals = projectApprovals.filter((approval) => approval.status === 'stale')
  const deliveryIssues = deliveryPackage?.riskSummary?.issues ?? []
  const strongRiskCount = deliveryIssues.filter((issue) => issue.severity === 'strong').length
  const strongAudioRiskCount = deliveryIssues.filter((issue) => issue.type === 'audio-risk' && issue.severity === 'strong').length
  const strongClipRiskCount = deliveryIssues.filter((issue) => issue.type === 'clip-review-risk' && issue.severity === 'strong').length
  const unknownLicenseCount = deliveryIssues.filter((issue) => issue.type === 'license-unknown').length
  const strongLicensingRiskCount = deliveryIssues.filter((issue) => ['restricted-usage', 'expired-license'].includes(issue.type) && issue.severity === 'strong').length
  const missingProofCount = deliveryIssues.filter((issue) => issue.type === 'missing-proof').length
  const submittedForClient = deliveryPackage?.status === 'submitted'
    || deliveryPackage?.status === 'approved'
    || projectApprovals.some((approval) => approval.targetType === 'delivery' && approval.status === 'approved')
  const taskGroup = team ? input.tasks.filter((task) => task.teamId === team.id) : []
  const taskOpenCount = taskGroup.filter((task) => task.status === 'todo').length
  const taskInProgressCount = taskGroup.filter((task) => task.status === 'doing').length
  const taskDoneCount = taskGroup.filter((task) => task.status === 'done').length
  const gate = input.approvalGates.find((item) => item.stage === currentStage) ?? null

  let readinessStatus: DashboardProjectOverview['readinessStatus'] = gate?.status === 'blocked'
    ? 'blocked'
    : gate?.status === 'needs-review'
      ? 'needs-review'
      : 'ready'

  let readinessReason = gate?.status === 'blocked'
    ? '当前阶段审批门是 blocked。'
    : gate?.status === 'needs-review'
      ? '当前阶段仍有待确认项。'
      : '当前阶段暂无明显阻塞。'

  if (blockerNotes.length > 0) {
    readinessStatus = 'blocked'
    readinessReason = '存在 blocker 批注，建议先处理。'
  } else if (staleApprovals.length > 0) {
    readinessStatus = 'needs-review'
    readinessReason = '存在 stale approvals，需要重新确认。'
  } else if (pendingApprovals.length > 0) {
    readinessStatus = 'needs-review'
    readinessReason = '存在待处理确认项。'
  } else if (currentStage === 'delivery' && !deliveryPackage) {
    readinessStatus = 'needs-review'
    readinessReason = '还没有建立 Delivery Package。'
  } else if (currentStage === 'delivery' && deliveryPackage && !['ready', 'submitted', 'approved'].includes(deliveryPackage.status)) {
    readinessStatus = 'needs-review'
    readinessReason = '交付包还没有进入 ready / submitted 状态。'
  } else if (currentStage === 'delivery' && strongRiskCount > 0) {
    readinessStatus = 'needs-review'
    readinessReason = '交付包仍有 strong risks。'
  }

  return {
    projectId,
    projectTitle: title,
    currentStage,
    nextStage,
    blockerCount: blockerNotes.length,
    pendingApprovalCount: pendingApprovals.length,
    staleApprovalCount: staleApprovals.length,
    unknownLicenseCount,
    deliveryExists: Boolean(deliveryPackage),
    deliveryStatus: deliveryPackage?.status ?? 'missing',
    deliveryStrongRiskCount: strongRiskCount,
    strongLicensingRiskCount,
    missingProofCount,
    strongAudioRiskCount,
    strongClipRiskCount,
    submittedForClient,
    orderStatus: order?.status ?? 'missing',
    paymentStatus: order?.paymentStatus ?? 'unknown',
    reviewHref: `/review/${projectId}`,
    createHref: '/create',
    deliveryHref: '/create#delivery',
    detailHref: `#project-${projectId}`,
    readinessStatus,
    readinessReason,
    canAdvance: readinessStatus === 'ready',
    taskOpenCount,
    taskInProgressCount,
    taskDoneCount,
    latestChangesRequested,
    orderPaymentStatus: order?.paymentStatus ?? 'unknown',
    quoteId: order?.quoteId,
    deliveryJobStatus: job?.delivery?.status,
    price: order?.price,
  }
}

function buildActivity(projects: ProjectAggregateContext[], input: AggregateDashboardInput): DashboardActivityItem[] {
  const projectIds = new Set(projects.map((project) => project.projectId))
  const approvalItems: DashboardActivityItem[] = input.approvals
    .filter((approval) => projectIds.has(approval.targetId))
    .map((approval) => ({
      id: `approval-${approval.id}`,
      title: approval.title,
      detail: `确认状态 ${approval.status}`,
      createdAt: approval.createdAt,
      kind: 'approval',
      projectId: approval.targetId,
    }))

  const noteItems: DashboardActivityItem[] = input.notes
    .filter((note) => projectIds.has(note.targetId))
    .map((note) => ({
      id: `note-${note.id}`,
      title: `导演批注 · ${note.category}`,
      detail: note.content,
      createdAt: note.createdAt,
      kind: 'note',
      projectId: note.targetId,
    }))

  const deliveryItems: DashboardActivityItem[] = input.deliveryPackages.map((pkg) => ({
    id: `delivery-${pkg.id}`,
    title: pkg.title,
    detail: `交付包状态 ${pkg.status}`,
    createdAt: pkg.updatedAt,
    kind: 'delivery',
    projectId: pkg.projectId,
  }))

  const versionItems: DashboardActivityItem[] = input.versions
    .filter((version) => projectIds.has(version.entityId))
    .map((version) => ({
      id: `version-${version.id}`,
      title: version.label,
      detail: version.summary,
      createdAt: version.createdAt,
      kind: 'version',
      projectId: version.entityId,
    }))

  const teamByProjectId = new Map(input.teams.map((team) => [team.projectId, team.id]))
  const taskItems: DashboardActivityItem[] = input.tasks.flatMap((task) => {
    const projectId = Array.from(teamByProjectId.entries()).find(([, teamId]) => teamId === task.teamId)?.[0]
    if (!projectId) return []
    return [{
      id: `task-${task.id}`,
      title: task.title,
      detail: `任务状态 ${task.status}`,
      createdAt: new Date(task.createdAt).toISOString(),
      kind: 'task' as const,
      projectId,
    }]
  })

  return [...deliveryItems, ...approvalItems, ...noteItems, ...versionItems, ...taskItems]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 8)
}

export function aggregateProducerDashboard(input: AggregateDashboardInput): ProducerDashboardData {
  const projectContexts = getProjectIds(input).map((projectId) => buildProjectContext(projectId, input))
  const overview: DashboardProjectOverview[] = projectContexts
    .map((project) => ({
      projectId: project.projectId,
      title: project.projectTitle,
      currentStage: project.currentStage,
      nextStage: project.nextStage,
      readinessStatus: project.readinessStatus,
      readinessReason: project.readinessReason,
      blockerCount: project.blockerCount,
      pendingApprovalCount: project.pendingApprovalCount,
      staleApprovalCount: project.staleApprovalCount,
      deliveryStatus: project.deliveryStatus,
      orderStatus: project.orderStatus,
      submittedForClient: project.submittedForClient,
      strongRiskCount: project.deliveryStrongRiskCount,
      unknownLicenseCount: project.unknownLicenseCount,
      strongLicensingRiskCount: project.strongLicensingRiskCount,
      canAdvance: project.canAdvance,
      links: {
        review: project.reviewHref,
        create: project.createHref,
        delivery: project.deliveryHref,
        detail: project.detailHref,
      },
    }))
    .sort((left, right) => {
      const leftScore = (left.readinessStatus === 'blocked' ? 3 : left.readinessStatus === 'needs-review' ? 2 : 1)
        + left.blockerCount
        + left.pendingApprovalCount
        + left.unknownLicenseCount
      const rightScore = (right.readinessStatus === 'blocked' ? 3 : right.readinessStatus === 'needs-review' ? 2 : 1)
        + right.blockerCount
        + right.pendingApprovalCount
        + right.unknownLicenseCount
      return rightScore - leftScore
    })

  const actionQueue = buildProducerActionQueue(projectContexts)
  const quickActions: ProducerQuickAction[] = actionQueue.slice(0, 4).map((action) => ({
    id: action.id,
    label: action.title,
    description: `${action.projectTitle} · ${action.ctaLabel}`,
    href: action.href,
  }))

  const riskRadar = {
    staleApprovals: projectContexts.reduce((sum, project) => sum + project.staleApprovalCount, 0),
    unknownLicenses: projectContexts.reduce((sum, project) => sum + project.unknownLicenseCount, 0),
    strongLicensingRisk: projectContexts.reduce((sum, project) => sum + project.strongLicensingRiskCount, 0),
    openBlockerNotes: projectContexts.reduce((sum, project) => sum + project.blockerCount, 0),
    strongAudioRisk: projectContexts.reduce((sum, project) => sum + project.strongAudioRiskCount, 0),
    strongClipRisk: projectContexts.reduce((sum, project) => sum + project.strongClipRiskCount, 0),
  }

  const focusProject = projectContexts[0] ?? null
  const approvalsScope = focusProject
    ? input.approvals.filter((approval) => (
        approval.targetId === focusProject.projectId
        || approval.targetId === focusProject.projectId
      ))
    : input.approvals

  const activity = buildActivity(projectContexts, input)
  const topIssues = actionQueue.slice(0, 3).map((action) => action.detail)

  return {
    totalProjects: overview.length,
    overview,
    actionQueue,
    quickActions,
    riskRadar,
    approvals: {
      director: deriveRoleStatus('director', approvalsScope),
      client: deriveRoleStatus('client', approvalsScope),
      producer: deriveRoleStatus('producer', approvalsScope),
      editor: deriveRoleStatus('editor', approvalsScope),
      latestChangesRequested: focusProject?.latestChangesRequested ?? null,
    },
    delivery: {
      exists: Boolean(focusProject?.deliveryExists),
      status: focusProject?.deliveryStatus ?? 'missing',
      includedAssetCount: (input.deliveryPackages.find((pkg) => pkg.projectId === focusProject?.projectId)?.assets ?? []).filter((asset) => asset.included).length,
      strongRiskCount: focusProject?.deliveryStrongRiskCount ?? 0,
      submittedForClient: Boolean(focusProject?.submittedForClient),
    },
    tasks: {
      open: focusProject?.taskOpenCount ?? 0,
      inProgress: focusProject?.taskInProgressCount ?? 0,
      done: focusProject?.taskDoneCount ?? 0,
      blockerLike: focusProject?.blockerCount ?? 0,
    },
    order: {
      status: focusProject?.orderStatus ?? 'missing',
      paymentStatus: focusProject?.orderPaymentStatus ?? 'unknown',
      quoteId: focusProject?.quoteId,
      deliveryStatus: focusProject?.deliveryJobStatus,
      price: focusProject?.price,
    },
    activity,
    aiSummary: {
      topIssues: topIssues.length > 0 ? topIssues : ['当前没有明显高优先问题。'],
      nearestBlocker: actionQueue[0]?.detail ?? '当前没有明显 blocker。',
      recommendedAction: actionQueue[0]?.ctaLabel
        ? `优先执行：${actionQueue[0].ctaLabel}。`
        : '当前最适合做的是整理项目优先级并继续人工判断。'
      ,
    },
  }
}
