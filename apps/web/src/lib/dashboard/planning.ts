import type { DashboardProjectOverview, ProducerDashboardData } from '@/lib/dashboard/aggregate'

export type PlanningWeekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

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

export interface ProducerPlanningData {
  projects: PlanningProjectRow[]
  alerts: PlanningAlert[]
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
  }
}
