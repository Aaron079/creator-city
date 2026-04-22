import type { ApprovalRequest } from '@/store/approval.store'
import type { AudioTimeline } from '@/store/audio-desk.store'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { DirectorNote } from '@/store/director-notes.store'
import type { Narrative, Shot } from '@/store/shots.store'
import type { VersionRecord } from '@/store/version-history.store'

export function buildDeliverySummaryText(pkg: DeliveryPackage) {
  const includedAssets = pkg.assets.filter((asset) => asset.included)
  const riskSummary = pkg.riskSummary
  const lines = [
    'Creator City Delivery Summary',
    `项目：${pkg.title}`,
    `状态：${pkg.status}`,
    `资产数量：${includedAssets.length}`,
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    '',
    '【Manifest】',
    `项目阶段：${pkg.manifest?.projectStage ?? 'delivery'}`,
    `最终版本：${pkg.manifest?.finalVersion ?? 'v0'}`,
    '',
    '【资产清单】',
    ...includedAssets.map((asset) => `- ${asset.title} [${asset.type}] · approval=${asset.approvalStatus} · license=${asset.licenseStatus} · risk=${asset.riskLevel}`),
    '',
    '【风险摘要】',
    `Blockers：${riskSummary?.hasBlockers ? 'yes' : 'no'}`,
    `未确认项：${riskSummary?.hasUnapprovedItems ? 'yes' : 'no'}`,
    `未知授权：${riskSummary?.hasUnknownLicenses ? 'yes' : 'no'}`,
    `Stale 确认：${riskSummary?.hasStaleApprovals ? 'yes' : 'no'}`,
    ...(riskSummary?.issues.length
      ? riskSummary.issues.map((issue) => `- [${issue.severity}] ${issue.message}`)
      : ['- 无风险项']),
    '',
    '【确认摘要】',
    `总数：${pkg.approvalSummary.total}`,
    `已确认：${pkg.approvalSummary.approved}`,
    `待确认：${pkg.approvalSummary.pending}`,
    `需修改：${pkg.approvalSummary.changesRequested}`,
    `已拒绝：${pkg.approvalSummary.rejected}`,
    `已过期：${pkg.approvalSummary.stale}`,
  ]

  return lines.join('\n')
}

export function buildDeliveryProjectData(args: {
  pkg: DeliveryPackage
  currentStage: string
  narrative: Narrative | null
  shots: Shot[]
  audioTimeline: AudioTimeline | null
  approvals: ApprovalRequest[]
  versions: VersionRecord[]
  notes: DirectorNote[]
}) {
  const includedAssetIds = new Set(args.pkg.assets.filter((asset) => asset.included).map((asset) => asset.sourceId))
  return {
    deliveryPackage: args.pkg,
    currentStage: args.currentStage,
    narrative: args.narrative,
    shots: args.shots,
    audioTimeline: args.audioTimeline,
    approvals: args.approvals.filter((approval) => includedAssetIds.has(approval.id) || approval.targetType === 'delivery'),
    versions: args.versions.filter((version) => includedAssetIds.has(version.id) || version.entityType === 'delivery'),
    notes: args.notes.filter((note) => includedAssetIds.has(note.id)),
    exportedAt: new Date().toISOString(),
  }
}
