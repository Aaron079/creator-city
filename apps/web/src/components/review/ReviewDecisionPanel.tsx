'use client'

import type { ApprovalDecision } from '@/store/approval.store'

export function ReviewDecisionPanel({
  status,
  comment,
  followUp,
  assignedTo,
  assigneeOptions,
  showInternalFollowUp = true,
  approvedLabel,
  changesRequestedLabel,
  rejectedLabel,
  approvedDescription,
  pendingDescription,
  commentPlaceholder,
  onCommentChange,
  onFollowUpChange,
  onAssignedToChange,
  onSubmit,
  onCancel,
}: {
  status: ApprovalDecision['status']
  comment: string
  followUp: 'note' | 'task' | 'comment'
  assignedTo: string
  assigneeOptions: Array<{ id: string; label: string }>
  showInternalFollowUp?: boolean
  approvedLabel?: string
  changesRequestedLabel?: string
  rejectedLabel?: string
  approvedDescription?: string
  pendingDescription?: string
  commentPlaceholder?: string
  onCommentChange: (value: string) => void
  onFollowUpChange: (value: 'note' | 'task' | 'comment') => void
  onAssignedToChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const statusLabel = status === 'approved'
    ? (approvedLabel ?? '确认通过')
    : status === 'changes-requested'
      ? (changesRequestedLabel ?? '请求修改')
      : (rejectedLabel ?? '拒绝确认')

  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[11px] font-semibold text-white/82">
        {statusLabel}
      </p>
      <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>
        {status === 'approved'
          ? (approvedDescription ?? '这会只记录客户确认决定，不会自动推进阶段、完成订单或修改作品内容。')
          : (pendingDescription ?? '请留下清晰 comment，方便创作团队理解你的修改意见。')}
      </p>

      {status !== 'approved' && (
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          rows={4}
          className="w-full rounded-2xl px-4 py-3 mt-3 text-[11px] outline-none resize-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.82)' }}
          placeholder={commentPlaceholder ?? '请写下你希望修改或拒绝的原因'}
        />
      )}

      {status === 'changes-requested' && showInternalFollowUp && (
        <div className="grid gap-3 mt-3 md:grid-cols-2">
          <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[10px] font-semibold text-white/72">修改意见后续处理</p>
            <div className="grid gap-2 mt-3">
              {[
                { value: 'comment', label: '仅作为确认意见' },
                { value: 'note', label: '保存为导演批注' },
                { value: 'task', label: '转为任务' },
              ].map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <input
                    type="radio"
                    checked={followUp === option.value}
                    onChange={() => onFollowUpChange(option.value as 'note' | 'task' | 'comment')}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {followUp === 'task' && (
            <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] font-semibold text-white/72">任务接收人</p>
              <select
                value={assignedTo}
                onChange={(e) => onAssignedToChange(e.target.value)}
                className="w-full rounded-xl px-3 py-2 mt-3 text-[10px] outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.76)' }}
              >
                {assigneeOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {status === 'changes-requested' && !showInternalFollowUp && (
        <div className="rounded-2xl p-3 mt-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-[10px] font-semibold text-white/72">客户视图说明</p>
          <p className="text-[10px] mt-2 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.52)' }}>
            这里会记录你的修改意见，但不会展示内部任务分配、导演批注流转或团队执行细节。
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onSubmit}
          className="px-3 py-2 rounded-xl text-[11px] font-semibold"
          style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe' }}
        >
          确认提交
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-xl text-[11px] font-semibold"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.58)' }}
        >
          取消
        </button>
      </div>
    </div>
  )
}
