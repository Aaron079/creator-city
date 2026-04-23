'use client'

import type { ReactNode } from 'react'
import type { ApprovalDecision } from '@/store/approval.store'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import {
  getDeliveryDecisionTone,
  getDeliveryEvidence,
  getDeliveryIncludedSummary,
  getDeliveryRecommendation,
  getDeliveryVersionLabel,
} from '@/lib/review/delivery-approval'

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'warning' | 'danger' | 'ready'
}) {
  const palette = tone === 'danger'
    ? { border: '1px solid rgba(244,63,94,0.22)', background: 'rgba(244,63,94,0.10)', color: '#fecdd3' }
    : tone === 'warning'
      ? { border: '1px solid rgba(245,158,11,0.22)', background: 'rgba(245,158,11,0.10)', color: '#fde68a' }
      : tone === 'ready'
        ? { border: '1px solid rgba(16,185,129,0.22)', background: 'rgba(16,185,129,0.10)', color: '#a7f3d0' }
        : { border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.82)' }

  return (
    <div className="rounded-2xl px-4 py-3" style={palette}>
      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.42)' }}>{label}</p>
      <p className="text-[13px] font-semibold mt-1" style={{ color: palette.color }}>{value}</p>
    </div>
  )
}

export function DeliveryApprovalCard({
  deliveryPackage,
  latestDecision,
  actorName,
  canAct,
  isEditing,
  onConfirm,
  onRequestChanges,
  onReject,
  decisionPanel,
}: {
  deliveryPackage: DeliveryPackage | null
  latestDecision: ApprovalDecision | null
  actorName?: string | null
  canAct: boolean
  isEditing: boolean
  onConfirm: () => void
  onRequestChanges: () => void
  onReject: () => void
  decisionPanel?: ReactNode
}) {
  const recommendation = getDeliveryRecommendation(deliveryPackage)
  const strongRiskCount = deliveryPackage?.riskSummary?.issues.filter((issue) => issue.severity === 'strong').length ?? 0
  const warningRiskCount = deliveryPackage?.riskSummary?.issues.filter((issue) => issue.severity === 'warning').length ?? 0
  const includedLines = getDeliveryIncludedSummary(deliveryPackage)
  const evidence = getDeliveryEvidence({
    decision: latestDecision,
    actorName,
    manifest: deliveryPackage?.manifest ?? null,
    packageStatus: deliveryPackage?.status ?? null,
    fallbackVersion: deliveryPackage?.manifest?.finalVersion ?? null,
  })

  return (
    <section
      id="delivery-approval"
      className="rounded-[32px] p-5 mt-8"
      style={{ background: 'rgba(9,14,24,0.84)', border: '1px solid rgba(20,184,166,0.18)', boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: 'rgba(45,212,191,0.62)' }}>
            Client-facing Delivery Approval
          </p>
          <h2 className="text-[22px] font-semibold text-white/90 mt-3">当前交付确认入口</h2>
          <p className="text-[11px] mt-2 leading-[1.8]" style={{ color: 'rgba(255,255,255,0.52)' }}>
            这里会把本次交付版本、包含资产、风险摘要和你的最终决定放在一起。确认后只会记录客户交付决定，不会自动推进订单、合同或其它商业动作。
          </p>
        </div>
        <div className="px-3 py-2 rounded-2xl text-[10px]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.56)' }}>
          当前版本：{getDeliveryVersionLabel(deliveryPackage)}
        </div>
      </div>

      <div className="grid gap-3 mt-5 md:grid-cols-4">
        <Metric label="Package status" value={deliveryPackage?.status ?? 'missing'} tone={recommendation.tone} />
        <Metric label="Included assets" value={deliveryPackage?.assets.filter((asset) => asset.included).length ?? 0} />
        <Metric label="Strong risks" value={strongRiskCount} tone={strongRiskCount > 0 ? 'danger' : 'ready'} />
        <Metric label="Approval summary" value={deliveryPackage ? `${deliveryPackage.approvalSummary.approved}/${deliveryPackage.approvalSummary.total} 已确认` : '未记录'} tone={warningRiskCount > 0 ? 'warning' : 'default'} />
      </div>

      <div className="grid gap-4 mt-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] font-semibold text-white/84">本次交付包含什么</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {includedLines.map((line) => (
              <span
                key={line}
                className="px-3 py-1.5 rounded-xl text-[10px]"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.64)' }}
              >
                {line}
              </span>
            ))}
          </div>
          <p className="text-[10px] mt-4 leading-[1.8]" style={{ color: 'rgba(255,255,255,0.46)' }}>
            这一步是在确认“当前交付包是否可以作为正式交付依据”。如果你觉得版本方向正确但仍有细节需要修订，请使用 Request Changes，而不是直接 Confirm Delivery。
          </p>
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] font-semibold text-white/84">风险摘要与建议</p>
          <div
            className="rounded-2xl p-3 mt-3"
            style={recommendation.tone === 'danger'
              ? { background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.20)' }
              : recommendation.tone === 'warning'
                ? { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)' }
                : { background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.20)' }}
          >
            <p
              className="text-[11px] font-semibold"
              style={{ color: recommendation.tone === 'danger' ? '#fecdd3' : recommendation.tone === 'warning' ? '#fde68a' : '#a7f3d0' }}
            >
              {recommendation.title}
            </p>
            <p className="text-[10px] mt-2 leading-[1.8]" style={{ color: 'rgba(255,255,255,0.58)' }}>
              {recommendation.detail}
            </p>
          </div>

          {deliveryPackage?.riskSummary?.issues.length ? (
            <div className="grid gap-2 mt-3">
              {deliveryPackage.riskSummary.issues.slice(0, 4).map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-xl px-3 py-2 text-[10px]"
                  style={{
                    background: issue.severity === 'strong' ? 'rgba(244,63,94,0.10)' : 'rgba(255,255,255,0.03)',
                    border: issue.severity === 'strong' ? '1px solid rgba(244,63,94,0.18)' : '1px solid rgba(255,255,255,0.06)',
                    color: issue.severity === 'strong' ? '#fecdd3' : 'rgba(255,255,255,0.62)',
                  }}
                >
                  {issue.message}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] mt-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
              当前没有额外风险项记录。
            </p>
          )}
        </div>
      </div>

      {evidence ? (
        <div className="rounded-2xl p-4 mt-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-white/84">Approval evidence</p>
              <p className="text-[10px] mt-2 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.52)' }}>
                最近一次客户交付决定会在这里沉淀，方便团队回看“谁在什么时间对哪个交付版本做了什么决定”。
              </p>
            </div>
            <span
              className="px-3 py-1.5 rounded-xl text-[10px]"
              style={getDeliveryDecisionTone(latestDecision?.status ?? 'approved') === 'approved'
                ? { background: 'rgba(16,185,129,0.14)', color: '#a7f3d0' }
                : getDeliveryDecisionTone(latestDecision?.status ?? 'approved') === 'warning'
                  ? { background: 'rgba(245,158,11,0.14)', color: '#fde68a' }
                  : { background: 'rgba(244,63,94,0.14)', color: '#fecdd3' }}
            >
              {evidence.decisionLabel}
            </span>
          </div>
          <div className="grid gap-3 mt-4 md:grid-cols-2">
            <Metric label="决定人" value={evidence.actorName} />
            <Metric label="决定时间" value={new Date(evidence.decidedAt).toLocaleString('zh-CN')} />
            <Metric label="对应版本" value={evidence.versionLabel} />
            <Metric label="Package status" value={evidence.packageStatus} />
          </div>
          <div className="rounded-2xl p-3 mt-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.34)' }}>备注</p>
            <p className="text-[11px] mt-2 leading-[1.8]" style={{ color: 'rgba(255,255,255,0.68)' }}>{evidence.note}</p>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 flex-wrap mt-5">
        {canAct ? (
          <>
            <button
              onClick={onConfirm}
              className="px-3 py-2 rounded-xl text-[11px] font-semibold"
              style={{ background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.26)', color: '#a7f3d0' }}
            >
              Confirm Delivery
            </button>
            <button
              onClick={onRequestChanges}
              className="px-3 py-2 rounded-xl text-[11px] font-semibold"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.24)', color: '#fde68a' }}
            >
              Request Changes
            </button>
            <button
              onClick={onReject}
              className="px-3 py-2 rounded-xl text-[11px] font-semibold"
              style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.24)', color: '#fecdd3' }}
            >
              Reject Delivery
            </button>
          </>
        ) : (
          <div className="rounded-xl border border-white/8 px-3 py-2 text-[11px] text-white/45">
            只有 client 角色可以执行最终交付确认动作。Producer / Creator 当前只能查看交付快照与确认记录。
          </div>
        )}
      </div>

      {isEditing ? decisionPanel : null}
    </section>
  )
}
