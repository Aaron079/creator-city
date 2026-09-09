'use client'

import React, { useState } from 'react'
import {
  adviseSeedanceDelivery,
  type SeedanceDeliveryAdvisory,
} from '@/lib/seedance-previs/advisory'
import type { SeedanceCapability } from '@/lib/seedance-previs/capabilities'
import type { DeliveryMode, SeedanceTakePackage } from '@/lib/seedance-previs/package'

export type SeedanceDeliveryPayload = {
  readonly requestedMode: DeliveryMode
  readonly confirmedMode: DeliveryMode
  readonly acknowledgedFindingIds: readonly string[]
}

type SeedanceDeliveryPanelProps = {
  capability: SeedanceCapability
  package: SeedanceTakePackage
  coverageFindings?: readonly SeedanceDeliveryAdvisory[]
  onSubmit: (payload: SeedanceDeliveryPayload) => void
}

export function createSeedanceDeliveryPayload(input: SeedanceDeliveryPayload): SeedanceDeliveryPayload {
  return Object.freeze({
    requestedMode: input.requestedMode,
    confirmedMode: input.confirmedMode,
    acknowledgedFindingIds: Object.freeze([...input.acknowledgedFindingIds]),
  })
}

export function canSubmitSeedanceDelivery(mode: DeliveryMode, allWarningsAccepted: boolean) {
  return mode === 'direct' || allWarningsAccepted
}

function deliveryModeLabel(mode: DeliveryMode) {
  return mode === 'continuity-chain' ? '30 秒连续组接' : '直接生成'
}

export function SeedanceDeliveryPanel({
  capability,
  package: takePackage,
  coverageFindings = [],
  onSubmit,
}: SeedanceDeliveryPanelProps) {
  const advice = adviseSeedanceDelivery({
    requestedDurationSec: takePackage.durationSec,
    capability,
    coverageFindings,
  })
  const [acknowledgedFindingIds, setAcknowledgedFindingIds] = useState<string[]>([])
  const directDurationSec = capability.maxContinuousDurationSec
  const segmentCount = Math.ceil(takePackage.durationSec / capability.maxSingleDurationSec)
  const allWarningsAccepted = advice.findings.every((finding) => acknowledgedFindingIds.includes(finding.id))

  function toggleAcknowledgement(findingId: string, accepted: boolean) {
    setAcknowledgedFindingIds((current) => (
      accepted
        ? current.includes(findingId) ? current : [...current, findingId]
        : current.filter((id) => id !== findingId)
    ))
  }

  function submit(confirmedMode: DeliveryMode) {
    if (!canSubmitSeedanceDelivery(confirmedMode, allWarningsAccepted)) return
    onSubmit(createSeedanceDeliveryPayload({
      requestedMode: takePackage.deliveryMode,
      confirmedMode,
      acknowledgedFindingIds,
    }))
  }

  return (
    <section
      aria-label="Seedance 交付确认"
      className="space-y-3 rounded-md border border-white/10 bg-[#14171c]/90 p-3 text-xs text-white/72"
      data-testid="seedance-delivery-panel"
    >
      <div className="grid gap-1.5 sm:grid-cols-3">
        <span><span className="mr-1 text-white/40">模型</span>{capability.model}</span>
        <span><span className="mr-1 text-white/40">权益</span>{capability.entitlement}</span>
        <span><span className="mr-1 text-white/40">直出能力</span>{directDurationSec} 秒</span>
        <span><span className="mr-1 text-white/40">用户请求</span>{deliveryModeLabel(takePackage.deliveryMode)}</span>
        <span><span className="mr-1 text-white/40">建议方式</span>{deliveryModeLabel(advice.recommendedMode)}</span>
      </div>
      <p className="text-white/58">预计连续组接 {segmentCount} 段</p>

      {advice.findings.map((finding) => {
        const accepted = acknowledgedFindingIds.includes(finding.id)
        return (
          <label key={finding.id} className="flex items-start gap-2 rounded border border-amber-300/20 bg-amber-300/[0.07] p-2 text-amber-50/85">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => toggleAcknowledgement(finding.id, event.target.checked)}
            />
            <span>
              <span className="block">{finding.message}</span>
              <span className="block text-amber-100/65">{finding.remedy}</span>
            </span>
          </label>
        )
      })}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => submit('direct')}
          className="rounded-md border border-white/15 px-2.5 py-1.5 text-white/82 hover:bg-white/[0.06]"
        >
          继续直接生成
        </button>
        <button
          type="button"
          disabled={!allWarningsAccepted}
          onClick={() => submit('continuity-chain')}
          className="rounded-md border border-amber-300/35 bg-amber-300/[0.12] px-2.5 py-1.5 text-amber-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          确认使用 30 秒连续组接
        </button>
      </div>
    </section>
  )
}
