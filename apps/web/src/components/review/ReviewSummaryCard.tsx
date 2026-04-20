'use client'

export function ReviewSummaryCard({
  currentStage,
  currentVersion,
  reviewStatus,
  pendingCount,
  approvedCount,
  aiSummary,
  deliveryApproved,
}: {
  currentStage: string
  currentVersion: string
  reviewStatus: string
  pendingCount: number
  approvedCount: number
  aiSummary: string
  deliveryApproved: boolean
}) {
  return (
    <div className="rounded-[28px] p-5 mt-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="grid gap-3 md:grid-cols-5">
        <InfoCard label="当前阶段" value={currentStage} />
        <InfoCard label="当前版本" value={currentVersion} />
        <InfoCard label="审片状态" value={reviewStatus} />
        <InfoCard label="待确认项" value={String(pendingCount)} />
        <InfoCard label="已确认项" value={String(approvedCount)} />
      </div>

      <div className="rounded-2xl px-4 py-3 mt-4" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.16)' }}>
        <p className="text-[11px] font-semibold text-[#c7d2fe]">AI 反馈摘要</p>
        <p className="text-[11px] mt-1 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.52)' }}>
          {aiSummary}
        </p>
      </div>

      {deliveryApproved && (
        <div className="rounded-2xl px-4 py-3 mt-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.16)' }}>
          <p className="text-[11px] font-semibold text-[#a7f3d0]">交付已由客户确认。</p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.44)' }}>
            当前只更新确认状态，不会自动完成订单，也不会触发分账或支付流程。
          </p>
        </div>
      )}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.24)' }}>{label}</p>
      <p className="text-[13px] font-semibold mt-2 text-white/84">{value}</p>
    </div>
  )
}
