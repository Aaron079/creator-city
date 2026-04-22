'use client'

import { useMemo, useState } from 'react'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { LicenseAssetType, LicenseRecord, LicensingIssue, LicensingSummary, LicenseUsageScope } from '@/store/licensing.store'

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'warning' | 'danger'
}) {
  const cls = tone === 'danger'
    ? 'border-rose-500/20 bg-rose-500/8'
    : tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/8'
      : 'border-white/6 bg-white/2'
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  )
}

const USAGE_SCOPES: LicenseUsageScope[] = ['internal', 'social', 'commercial', 'broadcast', 'global']

export function LicensingCenter({
  records,
  summary,
  issues,
  deliveryPackages,
  onMarkCommercialCleared,
  onMarkRestricted,
  onSetUsageScope,
  onAttachProof,
}: {
  records: LicenseRecord[]
  summary: LicensingSummary
  issues: LicensingIssue[]
  deliveryPackages: DeliveryPackage[]
  onMarkCommercialCleared: (assetType: LicenseAssetType, assetId: string) => void
  onMarkRestricted: (assetType: LicenseAssetType, assetId: string) => void
  onSetUsageScope: (assetType: LicenseAssetType, assetId: string, usageScope: LicenseUsageScope) => void
  onAttachProof: (assetType: LicenseAssetType, assetId: string, proofUrl: string) => void
}) {
  const [proofDrafts, setProofDrafts] = useState<Record<string, string>>({})
  const linkedDeliveryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const pkg of deliveryPackages) {
      for (const asset of pkg.assets) {
        const key = `${asset.type}:${asset.sourceId}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    return counts
  }, [deliveryPackages])

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="总资产" value={summary.totalAssets} />
        <Metric label="Unknown" value={summary.unknownCount} tone={summary.unknownCount > 0 ? 'warning' : 'default'} />
        <Metric label="Commercial cleared" value={summary.commercialClearedCount} />
        <Metric label="Restricted" value={summary.restrictedCount} tone={summary.restrictedCount > 0 ? 'danger' : 'default'} />
        <Metric label="Expired" value={summary.expiredCount} tone={summary.expiredCount > 0 ? 'danger' : 'default'} />
        <Metric label="Strong risk" value={summary.strongRiskCount} tone={summary.strongRiskCount > 0 ? 'danger' : 'default'} />
      </div>

      <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
        <div className="text-sm font-semibold text-white">Asset List</div>
        <div className="mt-4 space-y-3">
          {records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
              当前还没有需要纳入 Licensing Center 的资产。
            </div>
          ) : records.map((record) => {
            const deliveryKey = `${record.assetType === 'sound-effect' ? 'sound-effect' : record.assetType}:${record.assetId}`
            const linkedDeliveryCount = linkedDeliveryCounts.get(deliveryKey) ?? 0
            return (
              <article key={record.id} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{record.title}</div>
                    <div className="mt-1 text-xs text-white/45">
                      {record.assetType} · provider {record.sourceProvider} · linked delivery {linkedDeliveryCount}
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/60">
                    risk {record.riskLevel}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-xs text-white/55 md:grid-cols-4">
                  <div className="rounded-xl border border-white/8 px-3 py-2">授权：{record.licenseStatus}</div>
                  <div className="rounded-xl border border-white/8 px-3 py-2">范围：{record.usageScope}</div>
                  <div className="rounded-xl border border-white/8 px-3 py-2">Proof：{record.proofUrl ? '已附加' : '缺失'}</div>
                  <div className="rounded-xl border border-white/8 px-3 py-2">到期：{record.expiresAt ?? '未设置'}</div>
                </div>

                {record.note ? <p className="mt-3 text-sm text-white/60">{record.note}</p> : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => onMarkCommercialCleared(record.assetType, record.assetId)}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300"
                  >
                    标记 commercial-cleared
                  </button>
                  <button
                    onClick={() => onMarkRestricted(record.assetType, record.assetId)}
                    className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300"
                  >
                    标记 restricted
                  </button>
                  <select
                    value={record.usageScope}
                    onChange={(event) => onSetUsageScope(record.assetType, record.assetId, event.target.value as LicenseUsageScope)}
                    className="rounded-xl px-3 py-2 text-xs outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.74)' }}
                  >
                    {USAGE_SCOPES.map((scope) => <option key={scope} value={scope}>{scope}</option>)}
                  </select>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={proofDrafts[record.id] ?? record.proofUrl ?? ''}
                    onChange={(event) => setProofDrafts((prev) => ({ ...prev, [record.id]: event.target.value }))}
                    placeholder="添加 proof URL"
                    className="min-w-[220px] flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.74)' }}
                  />
                  <button
                    onClick={() => {
                      const proofUrl = (proofDrafts[record.id] ?? '').trim()
                      if (!proofUrl) return
                      onAttachProof(record.assetType, record.assetId, proofUrl)
                    }}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/80"
                  >
                    添加 proof
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
        <div className="text-sm font-semibold text-white">Risk List</div>
        <div className="mt-4 space-y-3">
          {issues.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
              当前没有检测到 Licensing 风险项。
            </div>
          ) : issues.map((issue) => (
            <div key={issue.id} className="rounded-xl border border-white/8 px-4 py-3 text-sm text-white/70">
              <span className="mr-2 text-xs uppercase tracking-[0.16em] text-white/35">{issue.severity}</span>
              {issue.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

