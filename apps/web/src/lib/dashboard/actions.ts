import type { OrderStatus, PaymentStatus } from '@/store/order.store'
import type { ProjectStage } from '@/store/team.store'

export type DashboardActionSeverity = 'strong' | 'warning' | 'info'
export type DashboardActionKind = 'approval' | 'delivery' | 'note' | 'order' | 'audio' | 'clip'

export interface ProducerDashboardAction {
  id: string
  projectId: string
  projectTitle: string
  kind: DashboardActionKind
  severity: DashboardActionSeverity
  title: string
  detail: string
  href: string
  ctaLabel: string
}

export interface DashboardActionProjectContext {
  projectId: string
  projectTitle: string
  currentStage: ProjectStage
  blockerCount: number
  pendingApprovalCount: number
  staleApprovalCount: number
  deliveryExists: boolean
  deliveryStatus: 'draft' | 'ready' | 'submitted' | 'approved' | 'needs-revision' | 'missing'
  deliveryStrongRiskCount: number
  strongAudioRiskCount: number
  strongClipRiskCount: number
  submittedForClient: boolean
  orderStatus: OrderStatus | 'missing'
  paymentStatus: PaymentStatus | 'unknown'
  reviewHref: string
  createHref: string
  deliveryHref: string
  detailHref: string
}

const SEVERITY_SCORE: Record<DashboardActionSeverity, number> = {
  strong: 3,
  warning: 2,
  info: 1,
}

function compareActions(left: ProducerDashboardAction, right: ProducerDashboardAction) {
  const bySeverity = SEVERITY_SCORE[right.severity] - SEVERITY_SCORE[left.severity]
  if (bySeverity !== 0) return bySeverity
  return left.title.localeCompare(right.title, 'zh-CN')
}

export function buildProducerActionQueue(projects: DashboardActionProjectContext[]): ProducerDashboardAction[] {
  const actions: ProducerDashboardAction[] = []

  for (const project of projects) {
    if (project.blockerCount > 0) {
      actions.push({
        id: `${project.projectId}-blocker-notes`,
        projectId: project.projectId,
        projectTitle: project.projectTitle,
        kind: 'note',
        severity: 'strong',
        title: 'Blocker 批注未处理',
        detail: `${project.projectTitle} 还有 ${project.blockerCount} 条 blocker 批注未解除，建议先回到工作区处理。`,
        href: project.createHref,
        ctaLabel: '打开工作区',
      })
    }

    if (project.staleApprovalCount > 0) {
      actions.push({
        id: `${project.projectId}-stale-approvals`,
        projectId: project.projectId,
        projectTitle: project.projectTitle,
        kind: 'approval',
        severity: 'warning',
        title: 'Stale approval 需要重提',
        detail: `${project.projectTitle} 有 ${project.staleApprovalCount} 个确认已过期，建议尽快重新发起。`,
        href: project.reviewHref,
        ctaLabel: '打开审片页',
      })
    }

    if (project.pendingApprovalCount > 0) {
      actions.push({
        id: `${project.projectId}-pending-approvals`,
        projectId: project.projectId,
        projectTitle: project.projectTitle,
        kind: 'approval',
        severity: 'warning',
        title: '客户待确认',
        detail: `${project.projectTitle} 当前还有 ${project.pendingApprovalCount} 个待确认项，继续推进前建议先补齐。`,
        href: project.reviewHref,
        ctaLabel: '查看确认状态',
      })
    }

    if (project.currentStage === 'delivery' && !project.deliveryExists) {
      actions.push({
        id: `${project.projectId}-missing-delivery`,
        projectId: project.projectId,
        projectTitle: project.projectTitle,
        kind: 'delivery',
        severity: 'strong',
        title: '尚未建立交付包',
        detail: `${project.projectTitle} 已进入交付阶段，但还没有 Delivery Package。`,
        href: project.deliveryHref,
        ctaLabel: '前往交付工作区',
      })
    }

    if (project.deliveryStrongRiskCount > 0) {
      actions.push({
        id: `${project.projectId}-delivery-risk`,
        projectId: project.projectId,
        projectTitle: project.projectTitle,
        kind: 'delivery',
        severity: 'strong',
        title: 'Delivery Package 存在高风险',
        detail: `${project.projectTitle} 的交付包里仍有 ${project.deliveryStrongRiskCount} 个 strong risk。`,
        href: project.deliveryHref,
        ctaLabel: '检查交付包',
      })
    }

    if (project.strongAudioRiskCount > 0) {
      actions.push({
        id: `${project.projectId}-audio-risk`,
        projectId: project.projectId,
        projectTitle: project.projectTitle,
        kind: 'audio',
        severity: 'warning',
        title: '音频链路存在强风险',
        detail: `${project.projectTitle} 还有 ${project.strongAudioRiskCount} 个音频强风险，建议先人工复核。`,
        href: project.createHref,
        ctaLabel: '返回工作区',
      })
    }

    if (project.strongClipRiskCount > 0) {
      actions.push({
        id: `${project.projectId}-clip-risk`,
        projectId: project.projectId,
        projectTitle: project.projectTitle,
        kind: 'clip',
        severity: 'warning',
        title: '视频镜头存在强风险',
        detail: `${project.projectTitle} 还有 ${project.strongClipRiskCount} 个镜头强风险，建议先回看审片结果。`,
        href: project.createHref,
        ctaLabel: '前往工作区',
      })
    }

    if (
      (project.orderStatus === 'paid' || project.paymentStatus === 'paid')
      && (project.currentStage === 'idea' || project.currentStage === 'storyboard')
    ) {
      actions.push({
        id: `${project.projectId}-order-ready`,
        projectId: project.projectId,
        projectTitle: project.projectTitle,
        kind: 'order',
        severity: 'info',
        title: '订单已确认但未推进',
        detail: `${project.projectTitle} 已经具备启动条件，但当前阶段还停留在 ${project.currentStage}。`,
        href: project.createHref,
        ctaLabel: '打开工作区',
      })
    }

    if (project.deliveryExists && project.deliveryStatus === 'ready' && !project.submittedForClient) {
      actions.push({
        id: `${project.projectId}-delivery-ready`,
        projectId: project.projectId,
        projectTitle: project.projectTitle,
        kind: 'delivery',
        severity: 'info',
        title: '交付包已就绪，等待用户决定是否提交',
        detail: `${project.projectTitle} 的交付包已经 ready，但还没有提交客户确认。`,
        href: project.deliveryHref,
        ctaLabel: '查看交付包',
      })
    }
  }

  return actions.sort(compareActions).slice(0, 10)
}
