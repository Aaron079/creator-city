import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LicenseAssetType =
  | 'music-cue'
  | 'voice-take'
  | 'sound-effect'
  | 'video-shot'
  | 'external-asset'
  | 'project-json'

export type LicenseStatus = 'unknown' | 'user-provided' | 'commercial-cleared' | 'restricted' | 'expired'
export type LicenseUsageScope = 'internal' | 'social' | 'commercial' | 'broadcast' | 'global'
export type LicensingRiskLevel = 'none' | 'info' | 'warning' | 'strong'

export interface LicenseRecord {
  id: string
  assetType: LicenseAssetType
  assetId: string
  title: string
  sourceProvider: string
  licenseStatus: LicenseStatus
  usageScope: LicenseUsageScope
  expiresAt?: string
  note?: string
  proofUrl?: string
  riskLevel: LicensingRiskLevel
}

export interface LicensingSummary {
  totalAssets: number
  unknownCount: number
  restrictedCount: number
  expiredCount: number
  commercialClearedCount: number
  strongRiskCount: number
}

export interface LicensingIssue {
  id: string
  type: 'unknown-license' | 'expired-license' | 'restricted-usage' | 'missing-proof'
  severity: 'info' | 'warning' | 'strong'
  message: string
  assetId: string
  assetType: LicenseAssetType
}

interface LicensingState {
  records: LicenseRecord[]
  syncLicenseRecords: (records: LicenseRecord[]) => void
  upsertLicenseRecord: (record: LicenseRecord) => void
  getRecord: (assetType: LicenseAssetType, assetId: string) => LicenseRecord | null
  getSummary: () => LicensingSummary
  getIssues: () => LicensingIssue[]
  markCommercialCleared: (assetType: LicenseAssetType, assetId: string) => void
  markRestricted: (assetType: LicenseAssetType, assetId: string) => void
  attachProof: (assetType: LicenseAssetType, assetId: string, proofUrl: string) => void
  setUsageScope: (assetType: LicenseAssetType, assetId: string, usageScope: LicenseUsageScope) => void
}

export function makeLicenseRecordId(assetType: LicenseAssetType, assetId: string) {
  return `license:${assetType}:${assetId}`
}

function isCommercialScope(scope: LicenseUsageScope) {
  return scope === 'commercial' || scope === 'broadcast' || scope === 'global'
}

function isExpired(expiresAt?: string) {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() < Date.now()
}

export function deriveLicensingRiskLevel(record: Omit<LicenseRecord, 'id' | 'riskLevel'> | Omit<LicenseRecord, 'riskLevel'> | LicenseRecord): LicensingRiskLevel {
  if (record.licenseStatus === 'expired') return 'strong'
  if (record.licenseStatus === 'restricted') return 'strong'
  if (record.licenseStatus === 'unknown') return 'warning'
  if (isExpired(record.expiresAt)) return 'strong'
  if (isCommercialScope(record.usageScope) && !record.proofUrl) return 'strong'
  if (record.licenseStatus === 'user-provided' && !record.proofUrl) return 'warning'
  return 'none'
}

function normalizeRecord(record: LicenseRecord): LicenseRecord {
  const licenseStatus = record.licenseStatus === 'commercial-cleared' && isExpired(record.expiresAt)
    ? 'expired'
    : record.licenseStatus
  return {
    ...record,
    licenseStatus,
    riskLevel: deriveLicensingRiskLevel({ ...record, licenseStatus }),
  }
}

function buildIssues(records: LicenseRecord[]): LicensingIssue[] {
  return records.flatMap((record) => {
    const issues: LicensingIssue[] = []

    if (record.licenseStatus === 'unknown') {
      issues.push({
        id: `${record.id}:unknown`,
        type: 'unknown-license',
        severity: 'warning',
        message: `${record.title} 的授权状态未知，商业交付前建议先确认。`,
        assetId: record.assetId,
        assetType: record.assetType,
      })
    }

    if (record.licenseStatus === 'restricted') {
      issues.push({
        id: `${record.id}:restricted`,
        type: 'restricted-usage',
        severity: 'strong',
        message: `${record.title} 当前被标记为 restricted，不建议直接用于商业交付。`,
        assetId: record.assetId,
        assetType: record.assetType,
      })
    }

    if (record.licenseStatus === 'expired' || isExpired(record.expiresAt)) {
      issues.push({
        id: `${record.id}:expired`,
        type: 'expired-license',
        severity: 'strong',
        message: `${record.title} 的授权已过期，需要在交付前重新确认。`,
        assetId: record.assetId,
        assetType: record.assetType,
      })
    }

    if (isCommercialScope(record.usageScope) && !record.proofUrl) {
      issues.push({
        id: `${record.id}:proof`,
        type: 'missing-proof',
        severity: 'strong',
        message: `${record.title} 缺少可追溯的授权证明，当前不适合作为商业交付依据。`,
        assetId: record.assetId,
        assetType: record.assetType,
      })
    }

    return issues
  })
}

function summarize(records: LicenseRecord[]): LicensingSummary {
  return {
    totalAssets: records.length,
    unknownCount: records.filter((record) => record.licenseStatus === 'unknown').length,
    restrictedCount: records.filter((record) => record.licenseStatus === 'restricted').length,
    expiredCount: records.filter((record) => record.licenseStatus === 'expired' || isExpired(record.expiresAt)).length,
    commercialClearedCount: records.filter((record) => record.licenseStatus === 'commercial-cleared').length,
    strongRiskCount: records.filter((record) => record.riskLevel === 'strong').length,
  }
}

function mergeRecords(current: LicenseRecord[], nextRecords: LicenseRecord[]) {
  const currentMap = new Map(current.map((record) => [record.id, record]))
  const merged = nextRecords.map((record) => {
    const existing = currentMap.get(record.id)
    if (!existing) return normalizeRecord(record)
    return normalizeRecord({
      ...record,
      licenseStatus: existing.licenseStatus,
      usageScope: existing.usageScope,
      expiresAt: existing.expiresAt ?? record.expiresAt,
      note: existing.note ?? record.note,
      proofUrl: existing.proofUrl ?? record.proofUrl,
    })
  })
  const nextIds = new Set(merged.map((record) => record.id))
  const retained = current.filter((record) => !nextIds.has(record.id))
  return [...merged, ...retained]
}

export const useLicensingStore = create<LicensingState>()(
  persist(
    (set, get) => ({
      records: [],

      syncLicenseRecords: (records) => {
        set((state) => ({
          records: mergeRecords(state.records, records),
        }))
      },

      upsertLicenseRecord: (record) => {
        const normalized = normalizeRecord(record)
        set((state) => ({
          records: state.records.some((item) => item.id === normalized.id)
            ? state.records.map((item) => item.id === normalized.id ? normalized : item)
            : [normalized, ...state.records],
        }))
      },

      getRecord: (assetType, assetId) => (
        get().records.find((record) => record.assetType === assetType && record.assetId === assetId) ?? null
      ),

      getSummary: () => summarize(get().records),
      getIssues: () => buildIssues(get().records),

      markCommercialCleared: (assetType, assetId) => {
        const current = get().getRecord(assetType, assetId)
        if (!current) return
        get().upsertLicenseRecord({
          ...current,
          licenseStatus: 'commercial-cleared',
        })
      },

      markRestricted: (assetType, assetId) => {
        const current = get().getRecord(assetType, assetId)
        if (!current) return
        get().upsertLicenseRecord({
          ...current,
          licenseStatus: 'restricted',
        })
      },

      attachProof: (assetType, assetId, proofUrl) => {
        const current = get().getRecord(assetType, assetId)
        if (!current) return
        get().upsertLicenseRecord({
          ...current,
          proofUrl,
        })
      },

      setUsageScope: (assetType, assetId, usageScope) => {
        const current = get().getRecord(assetType, assetId)
        if (!current) return
        get().upsertLicenseRecord({
          ...current,
          usageScope,
        })
      },
    }),
    { name: 'cc:licensing-v1' },
  ),
)
