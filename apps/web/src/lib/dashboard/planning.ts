import type { DashboardProjectOverview, ProducerDashboardData } from '@/lib/dashboard/aggregate'

export type PlanningWeekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type ProductionMilestoneCategory = 'brief' | 'storyboard' | 'video' | 'edit' | 'audio' | 'delivery' | 'approval'
export type ProductionMilestoneStatus = 'todo' | 'in-progress' | 'blocked' | 'done'
export type ProductionOwnerRole = 'director' | 'producer' | 'editor' | 'cinematographer' | 'client' | 'ai'
export type ProductionSchedulePriority = 'low' | 'medium' | 'high' | 'critical'
export type ProductionScheduleStatus = 'scheduled' | 'at-risk' | 'blocked' | 'done'
export type ProductionConflictType = 'dependency-not-met' | 'approval-missing' | 'deadline-risk' | 'blocked-before-next-stage' | 'delivery-risk'
export type ProductionConflictSeverity = 'info' | 'warning' | 'strong'

export interface PlanningAlertRules {
  highlightBlockers: boolean
  highlightStrongRisks: boolean
  highlightStaleApprovals: boolean
  pendingApprovalThreshold: number
}

export interface PlanningDefaultOwners {
  production: string
  approvals: string
  delivery: string
}

export interface PlanningSettings {
  timezone: string
  targetDeliveryAt: string
  workWeek: PlanningWeekday[]
  defaultBufferDays: number
  alertRules: PlanningAlertRules
  defaultOwners: PlanningDefaultOwners
}

export interface PlanningProjectRow {
  projectId: string
  title: string
  currentStage: DashboardProjectOverview['currentStage']
  readinessStatus: DashboardProjectOverview['readinessStatus']
  targetDeliveryAt: string
  blockerCount: number
  pendingApprovalCount: number
  strongRiskCount: number
  bufferDays: number
  primaryOwner: string
  nextFocus: string
}

export interface PlanningAlert {
  id: string
  severity: 'strong' | 'warning' | 'info'
  label: string
  message: string
}

export interface ProductionMilestone {
  id: string
  projectId: string
  title: string
  description: string
  category: ProductionMilestoneCategory
  status: ProductionMilestoneStatus
  ownerRole: ProductionOwnerRole
  ownerId?: string
  dueAt: string
  dependsOn: string[]
  relatedTargetType: string
  relatedTargetId: string
}

export interface ProductionScheduleItem {
  id: string
  milestoneId: string
  startAt: string
  endAt: string
  priority: ProductionSchedulePriority
  status: ProductionScheduleStatus
  riskReason?: string
}

export interface ProductionConflict {
  id: string
  type: ProductionConflictType
  severity: ProductionConflictSeverity
  message: string
  relatedMilestoneId: string
  relatedProjectId: string
}

export interface ProducerPlanningData {
  projects: PlanningProjectRow[]
  alerts: PlanningAlert[]
  milestones: ProductionMilestone[]
  schedule: ProductionScheduleItem[]
  upcoming: ProductionScheduleItem[]
  blocked: ProductionMilestone[]
  conflicts: ProductionConflict[]
  aiSummary: {
    nextMilestone: string
    riskyDependency: string
    mostDangerousStage: string
  }
}

export const PLANNING_SETTINGS_STORAGE_KEY = 'cc:producer-planning-settings-v1'

export const DEFAULT_PLANNING_SETTINGS: PlanningSettings = {
  timezone: 'Asia/Shanghai',
  targetDeliveryAt: new Date(Date.now() + 10 * 24 * 3600_000).toISOString().slice(0, 10),
  workWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  defaultBufferDays: 2,
  alertRules: {
    highlightBlockers: true,
    highlightStrongRisks: true,
    highlightStaleApprovals: true,
    pendingApprovalThreshold: 2,
  },
  defaultOwners: {
    production: '制片',
    approvals: '客户成功',
    delivery: '交付负责人',
  },
}

const STAGE_ORDER: DashboardProjectOverview['currentStage'][] = ['idea', 'storyboard', 'shooting', 'editing', 'delivery']

const CATEGORY_META: Record<ProductionMilestoneCategory, {
  title: string
  description: string
  ownerRole: ProductionOwnerRole
  priority: ProductionSchedulePriority
  relatedTargetType: string
  dueOffsetDays: number
}> = {
  brief: {
    title: 'Brief 确认',
    description: '明确项目目标、范围和关键方向，作为后续执行基础。',
    ownerRole: 'producer',
    priority: 'high',
    relatedTargetType: 'project-brief',
    dueOffsetDays: 21,
  },
  storyboard: {
    title: '分镜确认',
    description: '确认分镜结构、节奏与主要镜头表达，再推进视频执行。',
    ownerRole: 'director',
    priority: 'high',
    relatedTargetType: 'storyboard-frame',
    dueOffsetDays: 16,
  },
  video: {
    title: '关键镜头生成',
    description: '完成关键镜头的生成与基础 review，保证剪辑有稳定输入。',
    ownerRole: 'cinematographer',
    priority: 'critical',
    relatedTargetType: 'video-shot',
    dueOffsetDays: 12,
  },
  edit: {
    title: '粗剪完成',
    description: '完成剪辑主线与节奏整理，为声音和交付打基础。',
    ownerRole: 'editor',
    priority: 'critical',
    relatedTargetType: 'editor-timeline',
    dueOffsetDays: 8,
  },
  audio: {
    title: '声音完成',
    description: '完成关键声音资产、同步检查与基础复核。',
    ownerRole: 'producer',
    priority: 'high',
    relatedTargetType: 'audio-timeline',
    dueOffsetDays: 5,
  },
  delivery: {
    title: '交付包完成',
    description: '整理交付资产、风险摘要与 manifest，准备客户确认。',
    ownerRole: 'producer',
    priority: 'critical',
    relatedTargetType: 'delivery',
    dueOffsetDays: 2,
  },
  approval: {
    title: '客户确认',
    description: '由客户对当前交付内容做 approve / changes-requested / reject。',
    ownerRole: 'client',
    priority: 'critical',
    relatedTargetType: 'delivery',
    dueOffsetDays: 0,
  },
}

function addDays(value: string | Date, days: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

function toIsoDate(value: Date) {
  return value.toISOString()
}

function daysUntil(value: string) {
  const now = Date.now()
  const target = new Date(value).getTime()
  return Math.ceil((target - now) / (24 * 3600_000))
}

function stageIndex(stage: DashboardProjectOverview['currentStage']) {
  return STAGE_ORDER.indexOf(stage)
}

function nextFocusForProject(project: DashboardProjectOverview) {
  if (project.blockerCount > 0) return '先处理 blocker 批注'
  if (project.pendingApprovalCount > 0) return '优先补齐待确认项'
  if (project.strongRiskCount > 0) return '先人工复核高风险资产'
  if (project.deliveryStatus === 'ready' && !project.submittedForClient) return '由用户决定是否提交客户确认'
  if (!project.canAdvance) return '继续清理风险与确认项'
  return '可以开始准备下一阶段执行'
}

function ownerForProject(project: DashboardProjectOverview, settings: PlanningSettings) {
  if (project.pendingApprovalCount > 0 || project.staleApprovalCount > 0) return settings.defaultOwners.approvals
  if (project.currentStage === 'delivery') return settings.defaultOwners.delivery
  return settings.defaultOwners.production
}

function categoryDone(project: DashboardProjectOverview, category: ProductionMilestoneCategory) {
  switch (category) {
    case 'brief':
      return stageIndex(project.currentStage) > stageIndex('idea')
    case 'storyboard':
      return stageIndex(project.currentStage) > stageIndex('storyboard')
    case 'video':
      return stageIndex(project.currentStage) > stageIndex('shooting')
    case 'edit':
      return stageIndex(project.currentStage) > stageIndex('editing')
    case 'audio':
      return project.currentStage === 'delivery' && project.strongRiskCount === 0
    case 'delivery':
      return ['ready', 'submitted', 'approved'].includes(project.deliveryStatus)
    case 'approval':
      return project.submittedForClient
    default:
      return false
  }
}

function categoryInProgress(project: DashboardProjectOverview, category: ProductionMilestoneCategory) {
  switch (category) {
    case 'brief':
      return project.currentStage === 'idea'
    case 'storyboard':
      return project.currentStage === 'storyboard'
    case 'video':
      return project.currentStage === 'shooting'
    case 'edit':
      return project.currentStage === 'editing'
    case 'audio':
      return project.currentStage === 'editing' || (project.currentStage === 'delivery' && project.strongRiskCount > 0)
    case 'delivery':
      return project.currentStage === 'delivery' && !['ready', 'submitted', 'approved'].includes(project.deliveryStatus)
    case 'approval':
      return project.currentStage === 'delivery' && ['submitted', 'approved'].includes(project.deliveryStatus)
    default:
      return false
  }
}

function categoryBlocked(project: DashboardProjectOverview, category: ProductionMilestoneCategory) {
  if (project.blockerCount > 0 && category !== 'brief') return true
  if ((category === 'storyboard' || category === 'video' || category === 'edit' || category === 'delivery') && project.pendingApprovalCount > 0) return true
  if ((category === 'delivery' || category === 'approval') && (project.strongRiskCount > 0 || project.staleApprovalCount > 0)) return true
  return false
}

function milestoneStatus(project: DashboardProjectOverview, category: ProductionMilestoneCategory): ProductionMilestoneStatus {
  if (categoryDone(project, category)) return 'done'
  if (categoryBlocked(project, category)) return 'blocked'
  if (categoryInProgress(project, category)) return 'in-progress'
  return 'todo'
}

function milestoneDependencies(projectId: string, category: ProductionMilestoneCategory) {
  const id = (value: ProductionMilestoneCategory) => `${projectId}:${value}`
  switch (category) {
    case 'brief':
      return []
    case 'storyboard':
      return [id('brief')]
    case 'video':
      return [id('storyboard')]
    case 'edit':
      return [id('video')]
    case 'audio':
      return [id('edit')]
    case 'delivery':
      return [id('audio')]
    case 'approval':
      return [id('delivery')]
    default:
      return []
  }
}

function buildMilestones(project: DashboardProjectOverview, settings: PlanningSettings): ProductionMilestone[] {
  const targetDate = new Date(settings.targetDeliveryAt)
  const ownerId = project.projectId

  return (Object.keys(CATEGORY_META) as ProductionMilestoneCategory[]).map((category) => {
    const meta = CATEGORY_META[category]
    const dueAt = toIsoDate(addDays(targetDate, -meta.dueOffsetDays))
    return {
      id: `${project.projectId}:${category}`,
      projectId: project.projectId,
      title: meta.title,
      description: meta.description,
      category,
      status: milestoneStatus(project, category),
      ownerRole: meta.ownerRole,
      ownerId,
      dueAt,
      dependsOn: milestoneDependencies(project.projectId, category),
      relatedTargetType: meta.relatedTargetType,
      relatedTargetId: project.projectId,
    }
  })
}

function scheduleStatusForMilestone(milestone: ProductionMilestone, bufferDays: number): ProductionScheduleStatus {
  if (milestone.status === 'done') return 'done'
  if (milestone.status === 'blocked') return 'blocked'
  if (daysUntil(milestone.dueAt) <= bufferDays) return 'at-risk'
  return 'scheduled'
}

function schedulePriorityForMilestone(milestone: ProductionMilestone, project: DashboardProjectOverview): ProductionSchedulePriority {
  if (milestone.category === 'delivery' || milestone.category === 'approval') return 'critical'
  if (milestone.status === 'blocked' || project.blockerCount > 0) return 'critical'
  if (milestone.category === 'video' || milestone.category === 'edit') return 'high'
  if (milestone.category === 'audio' || milestone.category === 'storyboard') return 'medium'
  return 'low'
}

function buildSchedule(milestones: ProductionMilestone[], overviewByProject: Map<string, DashboardProjectOverview>, bufferDays: number): ProductionScheduleItem[] {
  return milestones.map((milestone) => {
    const project = overviewByProject.get(milestone.projectId)
    const priority = schedulePriorityForMilestone(milestone, project!)
    const status = scheduleStatusForMilestone(milestone, bufferDays)
    const endAt = milestone.dueAt
    const startAt = toIsoDate(addDays(milestone.dueAt, -Math.max(bufferDays, priority === 'critical' ? 3 : 2)))
    const riskReason = status === 'blocked'
      ? '上游依赖或审批尚未满足'
      : status === 'at-risk'
        ? '距离目标时间过近，缓冲不足'
        : undefined

    return {
      id: `schedule:${milestone.id}`,
      milestoneId: milestone.id,
      startAt,
      endAt,
      priority,
      status,
      riskReason,
    }
  })
}

function buildConflicts(
  milestones: ProductionMilestone[],
  schedule: ProductionScheduleItem[],
  overviewByProject: Map<string, DashboardProjectOverview>,
  bufferDays: number,
): ProductionConflict[] {
  const milestoneById = new Map(milestones.map((item) => [item.id, item]))
  const scheduleByMilestoneId = new Map(schedule.map((item) => [item.milestoneId, item]))
  const conflicts: ProductionConflict[] = []

  milestones.forEach((milestone) => {
    const project = overviewByProject.get(milestone.projectId)
    if (!project) return

    const unmetDependency = milestone.dependsOn.find((dependencyId) => milestoneById.get(dependencyId)?.status !== 'done')
    if (unmetDependency && milestone.status !== 'todo') {
      conflicts.push({
        id: `conflict:${milestone.id}:dependency`,
        type: 'dependency-not-met',
        severity: 'warning',
        message: `${milestone.title} 仍依赖上游里程碑完成，建议先补齐依赖再继续推进。`,
        relatedMilestoneId: milestone.id,
        relatedProjectId: milestone.projectId,
      })
    }

    if ((milestone.category === 'storyboard' || milestone.category === 'video' || milestone.category === 'delivery' || milestone.category === 'approval')
      && (project.pendingApprovalCount > 0 || project.staleApprovalCount > 0)) {
      conflicts.push({
        id: `conflict:${milestone.id}:approval`,
        type: 'approval-missing',
        severity: project.staleApprovalCount > 0 ? 'strong' : 'warning',
        message: `${milestone.title} 前仍有待确认或 stale approval，先补齐确认更稳妥。`,
        relatedMilestoneId: milestone.id,
        relatedProjectId: milestone.projectId,
      })
    }

    if (project.blockerCount > 0 && stageIndex(project.currentStage) >= stageIndex('storyboard') && milestone.category !== 'brief') {
      conflicts.push({
        id: `conflict:${milestone.id}:blocker`,
        type: 'blocked-before-next-stage',
        severity: 'strong',
        message: `${project.title} 仍有 blocker note，继续推进 ${milestone.title} 风险较高。`,
        relatedMilestoneId: milestone.id,
        relatedProjectId: milestone.projectId,
      })
    }

    const scheduleItem = scheduleByMilestoneId.get(milestone.id)
    if (scheduleItem && scheduleItem.status !== 'done' && daysUntil(scheduleItem.endAt) <= bufferDays) {
      conflicts.push({
        id: `conflict:${milestone.id}:deadline`,
        type: 'deadline-risk',
        severity: scheduleItem.priority === 'critical' ? 'strong' : 'warning',
        message: `${milestone.title} 距离目标时间不足 ${bufferDays} 天，当前缓冲不足。`,
        relatedMilestoneId: milestone.id,
        relatedProjectId: milestone.projectId,
      })
    }

    if ((milestone.category === 'delivery' || milestone.category === 'approval') && (project.strongRiskCount > 0 || project.deliveryStatus === 'missing')) {
      conflicts.push({
        id: `conflict:${milestone.id}:delivery`,
        type: 'delivery-risk',
        severity: 'strong',
        message: `${project.title} 的交付链仍有高风险或交付包未就绪，不建议直接推进。`,
        relatedMilestoneId: milestone.id,
        relatedProjectId: milestone.projectId,
      })
    }
  })

  return conflicts
}

function buildAiSummary(
  milestones: ProductionMilestone[],
  conflicts: ProductionConflict[],
  overviewByProject: Map<string, DashboardProjectOverview>,
) {
  const nextMilestone = milestones
    .filter((item) => item.status !== 'done')
    .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime())[0]

  const riskyDependency = conflicts.find((item) => item.type === 'dependency-not-met' || item.type === 'blocked-before-next-stage')
  const mostDangerousProjectId = conflicts
    .reduce<Map<string, number>>((map, item) => {
      const weight = item.severity === 'strong' ? 3 : item.severity === 'warning' ? 2 : 1
      map.set(item.relatedProjectId, (map.get(item.relatedProjectId) ?? 0) + weight)
      return map
    }, new Map())

  const topDanger = Array.from(mostDangerousProjectId.entries()).sort((left, right) => right[1] - left[1])[0]
  const dangerousProject = topDanger ? overviewByProject.get(topDanger[0]) : null

  return {
    nextMilestone: nextMilestone
      ? `${nextMilestone.title} · ${overviewByProject.get(nextMilestone.projectId)?.title ?? nextMilestone.projectId}`
      : '当前没有待推进的 milestone',
    riskyDependency: riskyDependency
      ? riskyDependency.message
      : '当前没有明显会拖慢交付的上游依赖',
    mostDangerousStage: dangerousProject
      ? `${dangerousProject.title} · ${dangerousProject.currentStage}`
      : '当前没有明显危险阶段',
  }
}

export function loadPlanningSettings(): PlanningSettings {
  if (typeof window === 'undefined') return DEFAULT_PLANNING_SETTINGS
  try {
    const raw = window.localStorage.getItem(PLANNING_SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_PLANNING_SETTINGS
    const parsed = JSON.parse(raw) as Partial<PlanningSettings>
    return {
      ...DEFAULT_PLANNING_SETTINGS,
      ...parsed,
      alertRules: {
        ...DEFAULT_PLANNING_SETTINGS.alertRules,
        ...parsed.alertRules,
      },
      defaultOwners: {
        ...DEFAULT_PLANNING_SETTINGS.defaultOwners,
        ...parsed.defaultOwners,
      },
      workWeek: Array.isArray(parsed.workWeek) && parsed.workWeek.length > 0 ? parsed.workWeek : DEFAULT_PLANNING_SETTINGS.workWeek,
    }
  } catch {
    return DEFAULT_PLANNING_SETTINGS
  }
}

export function savePlanningSettings(settings: PlanningSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PLANNING_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

export function buildProducerPlanningData(
  dashboard: ProducerDashboardData,
  settings: PlanningSettings,
): ProducerPlanningData {
  const overviewByProject = new Map(dashboard.overview.map((project) => [project.projectId, project]))
  const projects = dashboard.overview.map((project) => ({
    projectId: project.projectId,
    title: project.title,
    currentStage: project.currentStage,
    readinessStatus: project.readinessStatus,
    targetDeliveryAt: settings.targetDeliveryAt,
    blockerCount: project.blockerCount,
    pendingApprovalCount: project.pendingApprovalCount,
    strongRiskCount: project.strongRiskCount,
    bufferDays: settings.defaultBufferDays,
    primaryOwner: ownerForProject(project, settings),
    nextFocus: nextFocusForProject(project),
  }))

  const milestones = dashboard.overview.flatMap((project) => buildMilestones(project, settings))
  const schedule = buildSchedule(milestones, overviewByProject, settings.defaultBufferDays)
  const conflicts = buildConflicts(milestones, schedule, overviewByProject, settings.defaultBufferDays)
  const blocked = milestones.filter((item) => item.status === 'blocked')
  const upcoming = schedule
    .filter((item) => item.status !== 'done')
    .sort((left, right) => new Date(left.endAt).getTime() - new Date(right.endAt).getTime())
    .slice(0, 6)

  const alerts: PlanningAlert[] = []

  if (settings.alertRules.highlightBlockers && dashboard.riskRadar.openBlockerNotes > 0) {
    alerts.push({
      id: 'planning-blockers',
      severity: 'strong',
      label: 'Blocker Notes',
      message: `当前有 ${dashboard.riskRadar.openBlockerNotes} 条 blocker 批注仍未清理，排期不宜继续压缩。`,
    })
  }

  if (settings.alertRules.highlightStrongRisks && (dashboard.riskRadar.strongAudioRisk > 0 || dashboard.riskRadar.strongClipRisk > 0)) {
    alerts.push({
      id: 'planning-strong-risks',
      severity: 'warning',
      label: 'Strong Delivery Risks',
      message: `当前仍有 ${dashboard.riskRadar.strongAudioRisk + dashboard.riskRadar.strongClipRisk} 个强风险项，建议在交付前预留缓冲。`,
    })
  }

  if (settings.alertRules.highlightStaleApprovals && dashboard.riskRadar.staleApprovals > 0) {
    alerts.push({
      id: 'planning-stale-approvals',
      severity: 'warning',
      label: 'Stale Approvals',
      message: `当前有 ${dashboard.riskRadar.staleApprovals} 个 stale approvals，排期应优先安排重提确认。`,
    })
  }

  if (dashboard.overview.some((project) => project.pendingApprovalCount >= settings.alertRules.pendingApprovalThreshold)) {
    alerts.push({
      id: 'planning-pending-threshold',
      severity: 'info',
      label: 'Pending Approvals Watch',
      message: `至少有一个项目的待确认项达到 ${settings.alertRules.pendingApprovalThreshold} 个以上，建议先排确认节奏。`,
    })
  }

  return {
    projects,
    alerts,
    milestones,
    schedule,
    upcoming,
    blocked,
    conflicts,
    aiSummary: buildAiSummary(milestones, conflicts, overviewByProject),
  }
}
