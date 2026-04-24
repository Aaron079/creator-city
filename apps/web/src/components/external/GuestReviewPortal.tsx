'use client'

import { useMemo, useState } from 'react'
import type { ApprovalDecision, ApprovalRequest } from '@/store/approval.store'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { ExternalAccessLink } from '@/store/external-access.store'
import type { ClientProjectStatusFeedData } from '@/lib/projects/client-feed'
import { getExternalAccessTypeLabel, getExternalPermissionSummary, getExternalRoleHintLabel } from '@/lib/external/access'
import { DeliveryApprovalCard } from '@/components/review/DeliveryApprovalCard'
import { ReviewDecisionPanel } from '@/components/review/ReviewDecisionPanel'
import { EmptyState } from '@/components/ui/EmptyState'
import { useFeedback } from '@/lib/feedback/useFeedback'

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'warning' | 'danger'
}) {
  const styles = tone === 'danger'
    ? 'border-rose-500/20 bg-rose-500/8'
    : tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/8'
      : 'border-white/8 bg-white/[0.03]'

  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles}`}>
      <p className="text-[10px] text-white/38">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

export function GuestReviewPortal({
  link,
  deliveryPackage,
  latestDecision,
  deliveryApproval,
  clientFeed,
  onSubmitDecision,
}: {
  link: ExternalAccessLink
  deliveryPackage: DeliveryPackage | null
  latestDecision: ApprovalDecision | null
  deliveryApproval: ApprovalRequest | null
  clientFeed: ClientProjectStatusFeedData
  onSubmitDecision: (input: {
    status: ApprovalDecision['status']
    comment?: string
  }) => void
}) {
  const feedback = useFeedback()
  const [draft, setDraft] = useState<{
    status: ApprovalDecision['status']
    comment: string
  } | null>(null)

  const permissionSummary = useMemo(
    () => getExternalPermissionSummary(link.permissions),
    [link.permissions],
  )
  const canAct = link.permissions.canSubmitReview

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <section className="rounded-[32px] border border-white/10 bg-[#07111d] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300/70">
              Guest Review Portal
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">{link.projectTitle}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-[1.8] text-white/62">
              这是一个受控外部协作入口。你现在看到的是面向外部客户/审片人的版本，只保留交付确认、风险摘要、最近变化和当前需要你处理的动作。
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
            <div>{getExternalAccessTypeLabel(link.accessType)}</div>
            <div className="mt-1 text-white/45">{getExternalRoleHintLabel(link.roleHint)}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <Metric label="Stage" value={clientFeed.summary.stage} />
          <Metric label="Latest version" value={clientFeed.summary.latestVersion} />
          <Metric
            label="Delivery status"
            value={clientFeed.summary.deliveryStatus}
            tone={clientFeed.summary.deliveryStatus === 'needs-revision' ? 'warning' : 'default'}
          />
          <Metric
            label="Open resolutions"
            value={clientFeed.summary.openResolutions}
            tone={clientFeed.summary.openResolutions > 0 ? 'warning' : 'default'}
          />
          <Metric
            label="Waiting for you"
            value={clientFeed.summary.waitingForClientAction ? 'Yes' : 'No'}
            tone={clientFeed.summary.waitingForClientAction ? 'danger' : 'default'}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <DeliveryApprovalCard
            deliveryPackage={deliveryPackage}
            latestDecision={latestDecision}
            actorName={latestDecision?.userId ?? link.invitedName ?? link.invitedEmail ?? 'External reviewer'}
            canAct={canAct}
            isEditing={Boolean(draft)}
            onConfirm={() => setDraft({ status: 'approved', comment: '' })}
            onRequestChanges={() => setDraft({ status: 'changes-requested', comment: '' })}
            onReject={() => setDraft({ status: 'rejected', comment: '' })}
            decisionPanel={draft ? (
              <ReviewDecisionPanel
                status={draft.status}
                comment={draft.comment}
                followUp="comment"
                assignedTo=""
                assigneeOptions={[]}
                showInternalFollowUp={false}
                approvedDescription="这只会记录外部客户对当前交付版本的确认决定，不会自动推进订单或商业流程。"
                pendingDescription="请留下清晰原因，帮助团队理解你希望修改或拒绝的依据。"
                commentPlaceholder="请写下修改意见或拒绝原因"
                onCommentChange={(value) => setDraft((current) => current ? { ...current, comment: value } : current)}
                onFollowUpChange={() => undefined}
                onAssignedToChange={() => undefined}
                onSubmit={() => {
                  if (draft.status !== 'approved' && !draft.comment.trim()) {
                    feedback.warning('Request Changes 或 Reject 必须填写原因')
                    return
                  }
                  onSubmitDecision({
                    status: draft.status,
                    comment: draft.comment.trim() || undefined,
                  })
                  feedback.success(
                    draft.status === 'approved'
                      ? '已记录确认决定'
                      : draft.status === 'changes-requested'
                        ? '已记录修改请求'
                        : '已记录拒绝原因',
                  )
                  setDraft(null)
                }}
                onCancel={() => setDraft(null)}
              />
            ) : null}
          />

          <section className="rounded-[28px] border border-white/10 bg-[#07111d] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/42">Recent Changes</h2>
            <div className="mt-4 space-y-3">
              {clientFeed.activities.length === 0 ? (
                <EmptyState
                  title="暂无最近变化"
                  message="当前没有新的外部可见项目变化。"
                />
              ) : clientFeed.activities.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="text-sm font-medium text-white">{item.title}</div>
                  <div className="mt-1 text-sm text-white/58">{item.message}</div>
                  <div className="mt-2 text-xs text-white/38">{new Date(item.createdAt).toLocaleString('zh-CN')}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-white/10 bg-[#07111d] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/42">Current Action</h2>
            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="text-base font-semibold text-white">{clientFeed.currentAction?.title ?? '当前没有待处理项'}</div>
              <div className="mt-2 text-sm leading-[1.8] text-white/60">{clientFeed.currentAction?.message ?? '当前没有新的外部动作要求。'}</div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#07111d] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/42">Resolution Progress</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Metric label="Open" value={clientFeed.resolutionSnapshot.open} tone={clientFeed.resolutionSnapshot.open > 0 ? 'warning' : 'default'} />
              <Metric label="In progress" value={clientFeed.resolutionSnapshot.inProgress} />
              <Metric label="Resolved" value={clientFeed.resolutionSnapshot.resolved} />
              <Metric label="Resubmitted" value={clientFeed.resolutionSnapshot.resubmitted} />
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#07111d] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/42">Access Scope</h2>
            <div className="mt-4 space-y-3">
              {permissionSummary.allowed.map((item) => (
                <div key={item} className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-200">
                  可以：{item}
                </div>
              ))}
              {permissionSummary.denied.map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/58">
                  不会：{item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#07111d] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/42">AI Summary</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/68">
                {clientFeed.aiSummary.currentState}
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/68">
                {clientFeed.aiSummary.recentChanges}
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/68">
                {clientFeed.aiSummary.nextActionHint}
              </div>
              {deliveryApproval ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/52">
                  当前关联的 delivery approval：{deliveryApproval.title}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}
