'use client'

import type { ReactNode } from 'react'
import type { ApprovalDecision, ApprovalTargetType } from '@/store/approval.store'
import type { ReviewItem } from '@/lib/review/review-data'
import { ReviewPreviewRenderer } from './ReviewPreviewRenderer'
import { ReviewStatusBadge } from './ReviewStatusBadge'

const TARGET_META: Record<ApprovalTargetType, { label: string; accent: string }> = {
  'project-brief': { label: '项目简报', accent: '#a78bfa' },
  sequence: { label: '段落', accent: '#60a5fa' },
  shot: { label: '镜头', accent: '#34d399' },
  'storyboard-frame': { label: '分镜帧', accent: '#f59e0b' },
  'role-bible': { label: '角色设定', accent: '#f472b6' },
  'video-shot': { label: '视频镜头', accent: '#38bdf8' },
  'editor-clip': { label: '剪辑片段', accent: '#f97316' },
  'editor-timeline': { label: '剪辑序列', accent: '#818cf8' },
  'audio-timeline': { label: '声音时间线', accent: '#22c55e' },
  delivery: { label: '交付', accent: '#14b8a6' },
}

export function ReviewItemCard({
  item,
  latestClientDecision,
  isEditing,
  showInternalMeta = true,
  allowDecisionActions = true,
  onApprove,
  onRequestChanges,
  onReject,
  onOpenCompare,
  decisionPanel,
  comparePanel,
}: {
  item: ReviewItem
  latestClientDecision?: ApprovalDecision
  isEditing: boolean
  showInternalMeta?: boolean
  allowDecisionActions?: boolean
  onApprove: () => void
  onRequestChanges: () => void
  onReject: () => void
  onOpenCompare?: () => void
  decisionPanel?: ReactNode
  comparePanel?: ReactNode
}) {
  return (
    <div className="rounded-[28px] p-5" style={{ background: 'rgba(9,14,24,0.82)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 22px 50px rgba(0,0,0,0.18)' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <ReviewStatusBadge status={item.status} />
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.44)' }}>
              {TARGET_META[item.targetType].label}
            </span>
            <span className="px-2 py-1 rounded-lg text-[9px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.44)' }}>
              {item.versionLabel ? `${item.versionLabel} · ${item.linkedVersion?.summary ?? ''}` : '未绑定版本'}
            </span>
          </div>
          <h2 className="text-[18px] font-semibold text-white/88 mt-3">{item.title}</h2>
          <p className="text-[11px] mt-2 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {item.description || '请预览当前版本，并决定是否确认通过、请求修改或拒绝。'}
          </p>
        </div>
        <div className="text-right">
          {showInternalMeta ? (
            <>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>所需确认角色</p>
              <div className="flex gap-1.5 flex-wrap justify-end mt-2">
                {item.requiredRoles.map((role) => (
                  <span key={role} className="px-2 py-1 rounded-lg text-[9px]" style={{ background: role === 'client' ? 'rgba(236,72,153,0.12)' : 'rgba(255,255,255,0.04)', color: role === 'client' ? '#f9a8d4' : 'rgba(255,255,255,0.5)' }}>
                    {role}
                  </span>
                ))}
              </div>
              <p className="text-[10px] mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                批注 {item.noteCount} 条{item.blockerCount > 0 ? ` · blocker ${item.blockerCount}` : ''}
              </p>
            </>
          ) : (
            <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>
              客户只看到当前待确认内容、版本状态和自己的最近反馈。
            </p>
          )}
          {latestClientDecision && (
            <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.36)' }}>
              你的最近意见：{latestClientDecision.status}
            </p>
          )}
        </div>
      </div>

      <ReviewPreviewRenderer item={item} />

      {item.status === 'stale' && (
        <div className="rounded-xl px-3 py-2 mt-4" style={{ background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.22)' }}>
          <p className="text-[10px] font-semibold" style={{ color: '#fdba74' }}>该内容在提交确认后发生过修改，需要重新确认。</p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap mt-4">
        {allowDecisionActions ? (
          <>
            <button
              onClick={onApprove}
              className="px-3 py-2 rounded-xl text-[11px] font-semibold"
              style={{ background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.28)', color: '#a7f3d0' }}
            >
              确认通过
            </button>
            <button
              onClick={onRequestChanges}
              className="px-3 py-2 rounded-xl text-[11px] font-semibold"
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.24)', color: '#fde68a' }}
            >
              请求修改
            </button>
            <button
              onClick={onReject}
              className="px-3 py-2 rounded-xl text-[11px] font-semibold"
              style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.24)', color: '#fda4af' }}
            >
              拒绝
            </button>
          </>
        ) : (
          <div className="rounded-xl border border-white/8 px-3 py-2 text-[11px] text-white/45">
            当前角色只能查看确认内容，不能代替客户提交 approval 决定。
          </div>
        )}
        {onOpenCompare && item.versionId && item.previousVersionId && (
          <button
            onClick={onOpenCompare}
            className="px-3 py-2 rounded-xl text-[11px] font-semibold"
            style={{ background: 'rgba(99,102,241,0.16)', border: '1px solid rgba(99,102,241,0.28)', color: '#c7d2fe' }}
          >
            查看版本差异
          </button>
        )}
      </div>

      {comparePanel}
      {isEditing && decisionPanel}
    </div>
  )
}
