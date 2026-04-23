import type { ApprovalDecision } from '@/store/approval.store'
import type { DeliveryManifest, DeliveryPackage } from '@/store/delivery-package.store'

function formatCount(label: string, count: number) {
  return count > 0 ? `${label} ${count}` : null
}

export function getDeliveryDecisionLabel(status: ApprovalDecision['status']) {
  switch (status) {
    case 'approved':
      return 'Confirm Delivery'
    case 'changes-requested':
      return 'Request Changes'
    case 'rejected':
      return 'Reject Delivery'
    default:
      return status
  }
}

export function getDeliveryDecisionTone(status: ApprovalDecision['status']) {
  switch (status) {
    case 'approved':
      return 'approved'
    case 'changes-requested':
      return 'warning'
    case 'rejected':
      return 'danger'
    default:
      return 'default'
  }
}

export function getDeliveryIncludedSummary(pkg: DeliveryPackage | null) {
  if (!pkg) return ['当前还没有可读取的交付包快照']

  const manifest = pkg.manifest
  const includedAssets = pkg.assets.filter((asset) => asset.included)

  if (!manifest) {
    return [`已纳入 ${includedAssets.length} 项交付资产`]
  }

  const lines = [
    formatCount('分镜', manifest.includedCounts.storyboardFrames),
    formatCount('镜头', manifest.includedCounts.videoShots),
    formatCount('剪辑序列', manifest.includedCounts.editorTimelines),
    formatCount('声音资产', manifest.includedCounts.audioAssets),
    formatCount('确认记录', manifest.includedCounts.approvals),
    formatCount('批注', manifest.includedCounts.notes),
    formatCount('版本', manifest.includedCounts.versions),
  ].filter((line): line is string => Boolean(line))

  return lines.length > 0 ? lines : [`已纳入 ${includedAssets.length} 项交付资产`]
}

export function getDeliveryRecommendation(pkg: DeliveryPackage | null): {
  tone: 'ready' | 'warning' | 'danger'
  title: string
  detail: string
} {
  if (!pkg) {
    return {
      tone: 'warning',
      title: '当前无法读取完整交付快照',
      detail: '你仍然可以查看现有版本与确认记录，但建议先让团队补齐交付包摘要后再做最终判断。',
    }
  }

  const riskSummary = pkg.riskSummary
  const strongRiskCount = riskSummary?.issues.filter((issue) => issue.severity === 'strong').length ?? 0
  const warningRiskCount = riskSummary?.issues.filter((issue) => issue.severity === 'warning').length ?? 0

  if (strongRiskCount > 0) {
    return {
      tone: 'danger',
      title: '当前仍有高风险项，不建议直接确认',
      detail: `交付包里还有 ${strongRiskCount} 个 strong risk。若你仍然确认，这只会记录你的客户决定，不会自动推进订单或其它商业流程。`,
    }
  }

  if (riskSummary?.hasBlockers || riskSummary?.hasUnapprovedItems || riskSummary?.hasStaleApprovals || warningRiskCount > 0) {
    return {
      tone: 'warning',
      title: '建议先复核后再确认',
      detail: '当前交付包仍存在待确认项、过期确认或其它 warning 风险。你可以要求修改，也可以在理解风险后继续确认。',
    }
  }

  return {
    tone: 'ready',
    title: '当前可以进入交付确认',
    detail: '当前交付包没有显著风险阻塞。确认后只会沉淀一条正式的客户交付决定记录。',
  }
}

export function getDeliveryVersionLabel(pkg: DeliveryPackage | null, fallbackVersion?: string | null) {
  return pkg?.manifest?.finalVersion ?? fallbackVersion ?? '未记录版本'
}

export function getDeliveryVersionFromManifest(manifest: DeliveryManifest | null, fallbackVersion?: string | null) {
  return manifest?.finalVersion ?? fallbackVersion ?? '未记录版本'
}

export function getDeliveryEvidence(args: {
  decision: ApprovalDecision | null
  actorName?: string | null
  manifest: DeliveryManifest | null
  packageStatus?: DeliveryPackage['status'] | null
  fallbackVersion?: string | null
}) {
  if (!args.decision) return null

  return {
    decisionLabel: getDeliveryDecisionLabel(args.decision.status),
    decidedAt: args.decision.createdAt,
    actorName: args.actorName ?? args.decision.userId,
    note: args.decision.comment ?? '未填写额外备注',
    versionLabel: getDeliveryVersionFromManifest(args.manifest, args.fallbackVersion),
    packageStatus: args.packageStatus ?? 'draft',
  }
}
