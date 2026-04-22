import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useLicensingStore } from '@/store/licensing.store'
import { findLicensingRecordForDeliveryAsset } from '@/lib/licensing/aggregate'

export type DeliveryAssetType =
  | 'storyboard-frame'
  | 'video-shot'
  | 'editor-timeline'
  | 'audio-timeline'
  | 'music-cue'
  | 'voice-take'
  | 'director-note'
  | 'version-record'
  | 'approval-record'
  | 'project-json'

export type DeliveryApprovalStatus = 'pending' | 'approved' | 'changes-requested' | 'rejected' | 'stale'
export type DeliveryLicenseStatus = 'unknown' | 'user-provided' | 'commercial-cleared' | 'restricted' | 'expired'
export type DeliveryRiskLevel = 'none' | 'info' | 'warning' | 'strong'

export interface DeliveryAsset {
  id: string
  type: DeliveryAssetType
  title: string
  description?: string
  sourceId: string
  url?: string
  included: boolean
  approvalStatus: DeliveryApprovalStatus
  licenseStatus: DeliveryLicenseStatus
  riskLevel: DeliveryRiskLevel
}

export interface DeliveryManifest {
  projectTitle: string
  projectStage: string
  finalVersion: string
  includedCounts: {
    storyboardFrames: number
    videoShots: number
    editorTimelines: number
    audioAssets: number
    approvals: number
    notes: number
    versions: number
  }
  exportedAt: string
}

export interface DeliveryRiskIssue {
  id: string
  type: 'approval-missing' | 'stale-approval' | 'license-unknown' | 'expired-license' | 'restricted-usage' | 'missing-proof' | 'blocker-note' | 'audio-risk' | 'clip-review-risk'
  message: string
  severity: 'info' | 'warning' | 'strong'
}

export interface DeliveryRiskSummary {
  hasBlockers: boolean
  hasUnapprovedItems: boolean
  hasUnknownLicenses: boolean
  hasStaleApprovals: boolean
  issues: DeliveryRiskIssue[]
}

export interface DeliveryApprovalSummary {
  total: number
  approved: number
  pending: number
  changesRequested: number
  rejected: number
  stale: number
}

export interface DeliveryPackage {
  id: string
  projectId: string
  title: string
  description: string
  status: 'draft' | 'ready' | 'submitted' | 'approved' | 'needs-revision'
  assets: DeliveryAsset[]
  manifest: DeliveryManifest | null
  approvalSummary: DeliveryApprovalSummary
  riskSummary: DeliveryRiskSummary | null
  createdAt: string
  updatedAt: string
}

interface DeliveryPackageState {
  deliveryPackages: DeliveryPackage[]
  createDeliveryPackage: (projectId: string, options?: { title?: string; description?: string }) => DeliveryPackage
  updateDeliveryPackageMeta: (packageId: string, patch: Partial<Pick<DeliveryPackage, 'title' | 'description'>>) => void
  syncDeliveryAssets: (packageId: string, assets: DeliveryAsset[]) => void
  addAssetToPackage: (packageId: string, asset: DeliveryAsset) => void
  removeAssetFromPackage: (packageId: string, assetId: string) => void
  toggleAssetIncluded: (packageId: string, assetId: string) => void
  generateDeliveryManifest: (packageId: string, overrides?: Partial<Pick<DeliveryManifest, 'projectTitle' | 'projectStage' | 'finalVersion'>>) => DeliveryManifest | null
  generateDeliveryRiskSummary: (packageId: string) => DeliveryRiskSummary | null
  submitDeliveryPackage: (packageId: string) => DeliveryPackage | null
  markDeliveryApproved: (packageId: string) => void
  markDeliveryNeedsRevision: (packageId: string) => void
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function summarizeApprovals(assets: DeliveryAsset[]): DeliveryApprovalSummary {
  return assets.reduce<DeliveryApprovalSummary>((summary, asset) => {
    summary.total += 1
    switch (asset.approvalStatus) {
      case 'approved':
        summary.approved += 1
        break
      case 'pending':
        summary.pending += 1
        break
      case 'changes-requested':
        summary.changesRequested += 1
        break
      case 'rejected':
        summary.rejected += 1
        break
      case 'stale':
        summary.stale += 1
        break
    }
    return summary
  }, { total: 0, approved: 0, pending: 0, changesRequested: 0, rejected: 0, stale: 0 })
}

function buildManifest(pkg: DeliveryPackage, overrides?: Partial<Pick<DeliveryManifest, 'projectTitle' | 'projectStage' | 'finalVersion'>>): DeliveryManifest {
  const includedAssets = pkg.assets.filter((asset) => asset.included)
  const latestVersionAsset = includedAssets.find((asset) => asset.type === 'version-record')
  return {
    projectTitle: overrides?.projectTitle ?? pkg.title,
    projectStage: overrides?.projectStage ?? pkg.manifest?.projectStage ?? 'delivery',
    finalVersion: overrides?.finalVersion ?? latestVersionAsset?.title ?? pkg.manifest?.finalVersion ?? 'v0',
    includedCounts: {
      storyboardFrames: includedAssets.filter((asset) => asset.type === 'storyboard-frame').length,
      videoShots: includedAssets.filter((asset) => asset.type === 'video-shot').length,
      editorTimelines: includedAssets.filter((asset) => asset.type === 'editor-timeline').length,
      audioAssets: includedAssets.filter((asset) => ['audio-timeline', 'music-cue', 'voice-take'].includes(asset.type)).length,
      approvals: includedAssets.filter((asset) => asset.type === 'approval-record').length,
      notes: includedAssets.filter((asset) => asset.type === 'director-note').length,
      versions: includedAssets.filter((asset) => asset.type === 'version-record').length,
    },
    exportedAt: new Date().toISOString(),
  }
}

function buildRiskSummary(pkg: DeliveryPackage): DeliveryRiskSummary {
  const includedAssets = pkg.assets.filter((asset) => asset.included)
  const issues: DeliveryRiskIssue[] = []
  const licensingRecords = useLicensingStore.getState().records

  const pendingAssets = includedAssets.filter((asset) => asset.approvalStatus === 'pending')
  if (pendingAssets.length > 0) {
    issues.push({
      id: 'delivery-approval-missing',
      type: 'approval-missing',
      message: `当前还有 ${pendingAssets.length} 个交付资产没有完成确认。`,
      severity: 'warning',
    })
  }

  const staleAssets = includedAssets.filter((asset) => asset.approvalStatus === 'stale')
  if (staleAssets.length > 0) {
    issues.push({
      id: 'delivery-approval-stale',
      type: 'stale-approval',
      message: `当前还有 ${staleAssets.length} 个交付资产确认已过期，需要重新确认。`,
      severity: 'warning',
    })
  }

  const effectiveLicenseEntries = includedAssets.map((asset) => ({
    asset,
    record: findLicensingRecordForDeliveryAsset(licensingRecords, asset),
  }))

  const unknownLicenseAssets = effectiveLicenseEntries.filter(({ asset, record }) => (record?.licenseStatus ?? asset.licenseStatus) === 'unknown')
  if (unknownLicenseAssets.length > 0) {
    issues.push({
      id: 'delivery-license-unknown',
      type: 'license-unknown',
      message: `当前还有 ${unknownLicenseAssets.length} 个交付资产的授权状态未知。`,
      severity: 'strong',
    })
  }

  const restrictedLicenseAssets = effectiveLicenseEntries.filter(({ asset, record }) => (record?.licenseStatus ?? asset.licenseStatus) === 'restricted')
  if (restrictedLicenseAssets.length > 0) {
    issues.push({
      id: 'delivery-license-restricted',
      type: 'restricted-usage',
      message: `当前还有 ${restrictedLicenseAssets.length} 个交付资产被标记为 restricted，不建议直接交付。`,
      severity: 'strong',
    })
  }

  const expiredLicenseAssets = effectiveLicenseEntries.filter(({ asset, record }) => (record?.licenseStatus ?? asset.licenseStatus) === 'expired')
  if (expiredLicenseAssets.length > 0) {
    issues.push({
      id: 'delivery-license-expired',
      type: 'expired-license',
      message: `当前还有 ${expiredLicenseAssets.length} 个交付资产授权已过期，需要重新确认。`,
      severity: 'strong',
    })
  }

  const missingProofAssets = effectiveLicenseEntries.filter(({ record }) => (
    record
    && (record.usageScope === 'commercial' || record.usageScope === 'broadcast' || record.usageScope === 'global')
    && !record.proofUrl
  ))
  if (missingProofAssets.length > 0) {
    issues.push({
      id: 'delivery-license-proof',
      type: 'missing-proof',
      message: `当前还有 ${missingProofAssets.length} 个交付资产缺少可追溯 proof，商业交付依据不足。`,
      severity: 'strong',
    })
  }

  const blockerNotes = includedAssets.filter((asset) => asset.type === 'director-note' && asset.riskLevel === 'strong')
  if (blockerNotes.length > 0) {
    issues.push({
      id: 'delivery-blocker-note',
      type: 'blocker-note',
      message: `当前仍有 ${blockerNotes.length} 条阻塞级导演批注没有解除。`,
      severity: 'strong',
    })
  }

  const audioRiskAssets = includedAssets.filter((asset) => ['audio-timeline', 'music-cue', 'voice-take'].includes(asset.type) && asset.riskLevel === 'strong')
  if (audioRiskAssets.length > 0) {
    issues.push({
      id: 'delivery-audio-risk',
      type: 'audio-risk',
      message: `当前有 ${audioRiskAssets.length} 个声音资产存在强风险，建议复核后再交付。`,
      severity: 'strong',
    })
  }

  const clipRiskAssets = includedAssets.filter((asset) => asset.type === 'video-shot' && asset.riskLevel === 'strong')
  if (clipRiskAssets.length > 0) {
    issues.push({
      id: 'delivery-clip-review-risk',
      type: 'clip-review-risk',
      message: `当前有 ${clipRiskAssets.length} 条视频镜头存在强风险，建议先人工复核。`,
      severity: 'strong',
    })
  }

  return {
    hasBlockers: blockerNotes.length > 0,
    hasUnapprovedItems: pendingAssets.length > 0,
    hasUnknownLicenses: unknownLicenseAssets.length > 0,
    hasStaleApprovals: staleAssets.length > 0,
    issues,
  }
}

function deriveStatus(pkg: DeliveryPackage, riskSummary: DeliveryRiskSummary, manifest: DeliveryManifest | null): DeliveryPackage['status'] {
  if (pkg.status === 'submitted' || pkg.status === 'approved' || pkg.status === 'needs-revision') {
    return pkg.status
  }
  const includedCount = pkg.assets.filter((asset) => asset.included).length
  const hasStrongRisk = riskSummary.issues.some((issue) => issue.severity === 'strong')
  if (
    includedCount > 0
    && manifest
    && !riskSummary.hasBlockers
    && !riskSummary.hasUnapprovedItems
    && !riskSummary.hasStaleApprovals
    && !riskSummary.hasUnknownLicenses
    && !hasStrongRisk
  ) {
    return 'ready'
  }
  return 'draft'
}

function withDerivedState(
  pkg: DeliveryPackage,
  overrides?: Partial<Pick<DeliveryManifest, 'projectTitle' | 'projectStage' | 'finalVersion'>>,
): DeliveryPackage {
  const manifest = buildManifest(pkg, overrides)
  const riskSummary = buildRiskSummary({ ...pkg, manifest })
  return {
    ...pkg,
    manifest,
    approvalSummary: summarizeApprovals(pkg.assets),
    riskSummary,
    status: deriveStatus(pkg, riskSummary, manifest),
    updatedAt: new Date().toISOString(),
  }
}

export const useDeliveryPackageStore = create<DeliveryPackageState>()(
  persist(
    (set) => ({
      deliveryPackages: [],

      createDeliveryPackage: (projectId, options) => {
        const createdAt = new Date().toISOString()
        const next: DeliveryPackage = {
          id: uid('delivery-package'),
          projectId,
          title: options?.title ?? `交付包 · ${projectId}`,
          description: options?.description ?? '商业交付包草稿',
          status: 'draft',
          assets: [],
          manifest: null,
          approvalSummary: { total: 0, approved: 0, pending: 0, changesRequested: 0, rejected: 0, stale: 0 },
          riskSummary: null,
          createdAt,
          updatedAt: createdAt,
        }
        set((state) => ({ deliveryPackages: [next, ...state.deliveryPackages] }))
        return next
      },

      updateDeliveryPackageMeta: (packageId, patch) => {
        set((state) => ({
          deliveryPackages: state.deliveryPackages.map((pkg) => {
            if (pkg.id !== packageId) return pkg
            return withDerivedState({
              ...pkg,
              ...patch,
            })
          }),
        }))
      },

      syncDeliveryAssets: (packageId, assets) => {
        set((state) => ({
          deliveryPackages: state.deliveryPackages.map((pkg) => {
            if (pkg.id !== packageId) return pkg
            const existingByKey = new Map(pkg.assets.map((asset) => [`${asset.type}:${asset.sourceId}`, asset]))
            const nextAssets = assets.map((asset) => {
              const existing = existingByKey.get(`${asset.type}:${asset.sourceId}`)
              return existing
                ? {
                    ...asset,
                    id: existing.id,
                    included: existing.included,
                  }
                : asset
            })
            if (JSON.stringify(nextAssets) === JSON.stringify(pkg.assets)) return pkg
            return withDerivedState({ ...pkg, assets: nextAssets })
          }),
        }))
      },

      addAssetToPackage: (packageId, asset) => {
        set((state) => ({
          deliveryPackages: state.deliveryPackages.map((pkg) => {
            if (pkg.id !== packageId) return pkg
            const nextAssets = [...pkg.assets.filter((item) => item.id !== asset.id), asset]
            return withDerivedState({ ...pkg, assets: nextAssets })
          }),
        }))
      },

      removeAssetFromPackage: (packageId, assetId) => {
        set((state) => ({
          deliveryPackages: state.deliveryPackages.map((pkg) => {
            if (pkg.id !== packageId) return pkg
            return withDerivedState({ ...pkg, assets: pkg.assets.filter((asset) => asset.id !== assetId) })
          }),
        }))
      },

      toggleAssetIncluded: (packageId, assetId) => {
        set((state) => ({
          deliveryPackages: state.deliveryPackages.map((pkg) => {
            if (pkg.id !== packageId) return pkg
            return withDerivedState({
              ...pkg,
              assets: pkg.assets.map((asset) => asset.id === assetId ? { ...asset, included: !asset.included } : asset),
            })
          }),
        }))
      },

      generateDeliveryManifest: (packageId, overrides) => {
        let nextManifest: DeliveryManifest | null = null
        set((state) => ({
          deliveryPackages: state.deliveryPackages.map((pkg) => {
            if (pkg.id !== packageId) return pkg
            const next = withDerivedState(pkg, overrides)
            nextManifest = next.manifest
            return next
          }),
        }))
        return nextManifest
      },

      generateDeliveryRiskSummary: (packageId) => {
        let nextRiskSummary: DeliveryRiskSummary | null = null
        set((state) => ({
          deliveryPackages: state.deliveryPackages.map((pkg) => {
            if (pkg.id !== packageId) return pkg
            const next = withDerivedState(pkg)
            nextRiskSummary = next.riskSummary
            return next
          }),
        }))
        return nextRiskSummary
      },

      submitDeliveryPackage: (packageId) => {
        let nextPackage: DeliveryPackage | null = null
        set((state) => ({
          deliveryPackages: state.deliveryPackages.map((pkg) => {
            if (pkg.id !== packageId) return pkg
            nextPackage = {
              ...pkg,
              status: 'submitted',
              updatedAt: new Date().toISOString(),
            }
            return nextPackage
          }),
        }))
        return nextPackage
      },

      markDeliveryApproved: (packageId) => {
        set((state) => ({
          deliveryPackages: state.deliveryPackages.map((pkg) => (
            pkg.id === packageId
              ? { ...pkg, status: 'approved', updatedAt: new Date().toISOString() }
              : pkg
          )),
        }))
      },

      markDeliveryNeedsRevision: (packageId) => {
        set((state) => ({
          deliveryPackages: state.deliveryPackages.map((pkg) => (
            pkg.id === packageId
              ? { ...pkg, status: 'needs-revision', updatedAt: new Date().toISOString() }
              : pkg
          )),
        }))
      },
    }),
    { name: 'cc:delivery-package-v1' },
  ),
)
