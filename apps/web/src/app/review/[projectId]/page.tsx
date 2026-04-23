'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { AccessNotice } from '@/components/roles/AccessNotice'
import { RoleBadge } from '@/components/roles/RoleBadge'
import { RoleViewSwitcher } from '@/components/roles/RoleViewSwitcher'
import { canPerformAction, getPermissionsForRole } from '@/lib/roles/permissions'
import { ClientReviewHeader } from '@/components/review/ClientReviewHeader'
import { ReviewDecisionPanel } from '@/components/review/ReviewDecisionPanel'
import { ReviewItemCard } from '@/components/review/ReviewItemCard'
import { ReviewSummaryCard } from '@/components/review/ReviewSummaryCard'
import { VersionComparePanel } from '@/components/review/VersionComparePanel'
import { getVisibleSectionsForRole, useMockRoleMode } from '@/lib/roles/view-mode'
import { buildClientReviewContext } from '@/lib/review/review-data'
import { useApprovalStore } from '@/store/approval.store'
import type { ApprovalDecision, ApprovalTargetType } from '@/store/approval.store'
import { useAudioDeskStore } from '@/store/audio-desk.store'
import { useAuthStore } from '@/store/auth.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import type { DirectorNoteTargetType } from '@/store/director-notes.store'
import { useJobsStore } from '@/store/jobs.store'
import { useOrderStore } from '@/store/order.store'
import { useProjectRoleStore } from '@/store/project-role.store'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'
import { useVersionHistoryStore } from '@/store/version-history.store'

type ClientDecisionStatus = ApprovalDecision['status']

const TARGET_LABELS: Record<ApprovalTargetType, string> = {
  'project-brief': '项目简报',
  sequence: '段落',
  shot: '镜头',
  'storyboard-frame': '分镜帧',
  'role-bible': '角色设定',
  'video-shot': '视频镜头',
  'editor-clip': '剪辑片段',
  'editor-timeline': '剪辑序列',
  'audio-timeline': '声音时间线',
  delivery: '交付',
}

function mapApprovalTargetToNoteTarget(targetType: ApprovalTargetType): DirectorNoteTargetType {
  switch (targetType) {
    case 'project-brief':
    case 'sequence':
    case 'shot':
    case 'storyboard-frame':
    case 'role-bible':
    case 'video-shot':
    case 'editor-clip':
    case 'editor-timeline':
    case 'audio-timeline':
    case 'delivery':
      return targetType
    default:
      return 'project'
  }
}

export default function ClientReviewPortalPage() {
  const { role, setRole } = useMockRoleMode('client')
  const params = useParams<{ projectId: string }>()
  const projectId = decodeURIComponent(params.projectId)
  const visibleSections = new Set(getVisibleSectionsForRole(role, 'review'))

  const approvals = useApprovalStore((s) => s.approvals)
  const addApprovalDecision = useApprovalStore((s) => s.addApprovalDecision)
  const addApprovalSystemMessage = useApprovalStore((s) => s.addSystemMessage)
  const notes = useDirectorNotesStore((s) => s.notes)
  const addDirectorNote = useDirectorNotesStore((s) => s.addNote)
  const versions = useVersionHistoryStore((s) => s.versions)
  const compareVersions = useVersionHistoryStore((s) => s.compareVersions)
  const teams = useTeamStore((s) => s.teams)
  const orders = useOrderStore((s) => s.orders)
  const jobs = useJobsStore((s) => s.jobs)
  const createTask = useTaskStore((s) => s.createTask)
  const currentUser = useAuthStore((s) => s.user)
  const setProjectRole = useProjectRoleStore((s) => s.setProjectRole)
  const getRoleForProject = useProjectRoleStore((s) => s.getRoleForProject)
  const audioTimelines = useAudioDeskStore((s) => s.audioTimelines)
  const effectiveProjectRole = useMemo(
    () => currentUser?.id
      ? getRoleForProject(projectId, currentUser.id, role)
      : role,
    [currentUser?.id, getRoleForProject, projectId, role],
  )
  const permissions = useMemo(
    () => getPermissionsForRole(effectiveProjectRole),
    [effectiveProjectRole],
  )

  const reviewContext = useMemo(
    () => buildClientReviewContext({
      projectId,
      approvals,
      versions,
      notes,
      orders,
      teams,
      jobs,
      audioTimelines,
    }),
    [projectId, approvals, versions, notes, orders, teams, jobs, audioTimelines],
  )
  useEffect(() => {
    if (currentUser?.id) {
      setProjectRole(projectId, currentUser.id, role)
    }
  }, [currentUser?.id, projectId, role, setProjectRole])

  const activeOrder = useMemo(
    () => orders.find((order) => order.id === projectId) ?? orders.find((order) => order.chatId === projectId) ?? null,
    [orders, projectId],
  )
  const activeTeam = useMemo(
    () => teams.find((team) => team.projectId === projectId) ?? (activeOrder ? teams.find((team) => team.projectId === activeOrder.id) ?? null : null),
    [activeOrder, projectId, teams],
  )

  const teamAssigneeOptions = useMemo(
    () => activeTeam?.members.map((member) => ({ id: member.userId, label: `${member.name} · ${member.role}` })) ?? [],
    [activeTeam?.members],
  )

  const [actionDraft, setActionDraft] = useState<{
    approvalId: string
    status: ClientDecisionStatus
    comment: string
    followUp: 'note' | 'task' | 'comment'
    assignedTo: string
  } | null>(null)
  const [compareDraft, setCompareDraft] = useState<{ itemId: string } | null>(null)

  const compareItem = useMemo(
    () => reviewContext.items.find((item) => item.id === compareDraft?.itemId) ?? null,
    [reviewContext.items, compareDraft?.itemId],
  )
  const compareResult = useMemo(() => {
    if (!compareItem?.previousVersionId || !compareItem.versionId) return null
    return compareVersions(compareItem.previousVersionId, compareItem.versionId)
  }, [compareItem, compareVersions])

  const handleStartDecision = (approvalId: string, status: ClientDecisionStatus) => {
    if (!canPerformAction(effectiveProjectRole, 'approve-as-client')) return
    setActionDraft({
      approvalId,
      status,
      comment: '',
      followUp: 'comment',
      assignedTo: activeTeam?.ownerId ?? '',
    })
  }

  const handleSubmitDecision = () => {
    if (!actionDraft) return
    const approval = reviewContext.items.find((item) => item.id === actionDraft.approvalId)
    if (!approval) return
    if (actionDraft.status !== 'approved' && !actionDraft.comment.trim()) {
      window.alert('请求修改或拒绝时必须填写 comment。')
      return
    }

    const nextApproval = addApprovalDecision(actionDraft.approvalId, {
      role: 'client',
      userId: currentUser?.id ?? 'client-review',
      status: actionDraft.status,
      comment: actionDraft.comment.trim() || undefined,
      versionId: approval.versionId,
    })
    if (!nextApproval) return

    if (actionDraft.status === 'changes-requested') {
      if (actionDraft.followUp === 'note') {
        const confirmed = window.confirm('确认把这条客户修改意见保存为导演批注吗？')
        if (confirmed) {
          addDirectorNote({
            targetType: mapApprovalTargetToNoteTarget(approval.targetType),
            targetId: approval.targetId,
            category: 'client-feedback',
            priority: 'high',
            status: 'open',
            content: actionDraft.comment.trim(),
            createdBy: currentUser?.displayName ?? '客户',
            assignedTo: actionDraft.assignedTo || undefined,
            aiSummary: '客户已明确提出修改意见，建议内部优先复核并给出修订方案。',
          })
        }
      } else if (actionDraft.followUp === 'task') {
        if (!activeTeam) {
          window.alert('当前项目还没有团队上下文，暂时无法把客户修改意见转成任务。')
          return
        }
        const assignee = activeTeam.members.find((member) => member.userId === actionDraft.assignedTo) ?? activeTeam.members[0]
        const confirmed = window.confirm('确认把这条客户修改意见转成任务吗？')
        if (confirmed && assignee) {
          createTask(activeTeam.id, `[客户修改] ${approval.title}`, assignee.userId, assignee.name)
        }
      }
    }

    const actionLabel = actionDraft.status === 'approved'
      ? '已确认通过'
      : actionDraft.status === 'changes-requested'
        ? '请求修改'
        : '已拒绝'

    addApprovalSystemMessage(`${TARGET_LABELS[approval.targetType]}「${approval.title}」客户${actionLabel}。`)
    setActionDraft(null)
  }

  return (
    <div className="min-h-screen" style={{ background: '#060a14' }}>
      <div className="max-w-6xl mx-auto px-5 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <RoleViewSwitcher role={role} onChange={setRole} />
            <RoleBadge role={effectiveProjectRole} />
          </div>
        </div>

        {!permissions.canApproveAsClient ? (
          <div className="mb-6">
            <AccessNotice
              title="当前角色只能查看审片内容"
              message="你现在可以查看版本、批注和交付快照，但不能代替 client 提交 approve / changes-requested / reject。若需要客户动作，请切换到 Client 角色视图。"
            />
          </div>
        ) : null}

        {visibleSections.has('header') ? (
          <ClientReviewHeader
            title={reviewContext.projectTitle}
            description={reviewContext.projectDescription}
          />
        ) : null}

        {visibleSections.has('summary') ? (
          <ReviewSummaryCard
            currentStage={reviewContext.currentStage}
            currentVersion={reviewContext.currentVersion}
            reviewStatus={reviewContext.reviewStatus}
            pendingCount={reviewContext.pendingCount}
            approvedCount={reviewContext.approvedCount}
            aiSummary={reviewContext.aiSummary}
            deliveryApproved={reviewContext.deliveryApproved}
          />
        ) : null}

        {visibleSections.has('items') ? (
        <div className="mt-8 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold text-white/82">待确认内容</p>
            <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>
              {role === 'client'
                ? '客户只看需要确认的对象，不暴露完整画布、复杂参数面板或内部制作细节。'
                : '这里会根据当前 mock role 裁剪内部信息与确认操作，但底层项目数据保持一致。'}
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-xl text-[10px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.52)' }}>
            {reviewContext.items.length} 个确认对象
          </span>
        </div>
        ) : null}

        {visibleSections.has('items') ? (
        <div className="grid gap-4 mt-4">
          {reviewContext.items.length === 0 && (
            <div className="rounded-[28px] p-6" style={{ background: 'rgba(9,14,24,0.82)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[13px] font-semibold text-white/82">当前没有待客户确认的对象</p>
              <p className="text-[11px] mt-2 leading-[1.7]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                当导演或制片把分镜、视频镜头、声音时间线或交付版本提交给客户确认后，这里会显示对应审片卡片。
              </p>
            </div>
          )}

          {reviewContext.items.map((item) => {
            const latestClientDecision = item.decisions
              .filter((decision) => decision.role === 'client')
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
            const isEditingThis = actionDraft?.approvalId === item.id
            const isComparingThis = compareDraft?.itemId === item.id

            return (
              <ReviewItemCard
                key={item.id}
                item={item}
                latestClientDecision={latestClientDecision}
                isEditing={isEditingThis}
                showInternalMeta={visibleSections.has('internal-meta')}
                allowDecisionActions={permissions.canApproveAsClient}
                onApprove={() => handleStartDecision(item.id, 'approved')}
                onRequestChanges={() => handleStartDecision(item.id, 'changes-requested')}
                onReject={() => handleStartDecision(item.id, 'rejected')}
                onOpenCompare={visibleSections.has('compare') && item.versionId && item.previousVersionId ? () => setCompareDraft({ itemId: item.id }) : undefined}
                comparePanel={visibleSections.has('compare') && isComparingThis && compareResult && compareItem ? (
                  <VersionComparePanel
                    compare={compareResult}
                    fromLabel={compareItem.previousVersionId
                      ? versions.find((version) => version.id === compareItem.previousVersionId)?.label ?? '上一版本'
                      : '上一版本'}
                    toLabel={compareItem.versionLabel ?? '当前版本'}
                    onClose={() => setCompareDraft(null)}
                  />
                ) : undefined}
                decisionPanel={visibleSections.has('decision-panel') && isEditingThis && actionDraft ? (
                  <ReviewDecisionPanel
                    status={actionDraft.status}
                    comment={actionDraft.comment}
                    followUp={actionDraft.followUp}
                    assignedTo={actionDraft.assignedTo}
                    assigneeOptions={teamAssigneeOptions}
                    showInternalFollowUp={visibleSections.has('internal-follow-up')}
                    onCommentChange={(value) => setActionDraft((prev) => prev ? { ...prev, comment: value } : prev)}
                    onFollowUpChange={(value) => setActionDraft((prev) => prev ? { ...prev, followUp: value } : prev)}
                    onAssignedToChange={(value) => setActionDraft((prev) => prev ? { ...prev, assignedTo: value } : prev)}
                    onSubmit={handleSubmitDecision}
                    onCancel={() => setActionDraft(null)}
                  />
                ) : undefined}
              />
            )
          })}
        </div>
        ) : null}
      </div>
    </div>
  )
}
