'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { getProjectRoleLabel } from '@/lib/roles/projectRoles'
import {
  getRoleNeedLabel,
  type MatchCandidate,
  type RoleNeed,
  type TalentMatchingData,
} from '@/lib/matching/aggregate'
import type { InvitationActivity, TeamInvitation, TeamMemberSummary } from '@/store/team.store'

type ManageableRole =
  | RoleNeed['role']
  | 'producer'
  | 'creator'
  | 'client'
  | 'director'
  | 'editor'
  | 'cinematographer'

const ROLE_OPTIONS: Array<{ value: ManageableRole; label: string }> = [
  { value: 'producer', label: 'Producer' },
  { value: 'creator', label: 'Creator' },
  { value: 'client', label: 'Client' },
  { value: 'director', label: 'Director' },
  { value: 'editor', label: 'Editor' },
  { value: 'cinematographer', label: 'Cinematographer' },
  { value: 'colorist', label: '调色' },
  { value: 'sound', label: '声音' },
  { value: 'composer', label: '配乐' },
  { value: 'vfx', label: 'VFX' },
  { value: 'concept-artist', label: '概念设计' },
]

function formatTeamRole(role: string) {
  switch (role) {
    case 'producer':
    case 'creator':
    case 'client':
    case 'director':
    case 'editor':
    case 'cinematographer':
      return getProjectRoleLabel(role)
    case 'colorist':
      return '调色'
    case 'sound':
      return '声音'
    case 'composer':
      return '配乐'
    case 'vfx':
      return 'VFX'
    case 'concept-artist':
      return '概念设计'
    default:
      return role
  }
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AvailabilityBadge({ availability }: { availability: MatchCandidate['availability'] }) {
  const meta = availability === 'available'
    ? { label: 'Available', cls: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' }
    : availability === 'limited'
      ? { label: 'Limited', cls: 'border-amber-500/25 bg-amber-500/10 text-amber-300' }
      : { label: 'Unavailable', cls: 'border-rose-500/25 bg-rose-500/10 text-rose-300' }
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.cls}`}>{meta.label}</span>
}

function PriorityBadge({ priority }: { priority: RoleNeed['priority'] }) {
  const meta = priority === 'critical'
    ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
    : priority === 'high'
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
      : priority === 'medium'
        ? 'border-sky-500/25 bg-sky-500/10 text-sky-300'
        : 'border-white/10 bg-white/5 text-white/60'
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta}`}>{priority}</span>
}

function RoleStatusBadge({ status }: { status: RoleNeed['status'] }) {
  const meta = status === 'filled'
    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
    : status === 'reviewing'
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
      : 'border-white/10 bg-white/5 text-white/60'
  const label = status === 'filled' ? 'Filled' : status === 'reviewing' ? 'Reviewing' : 'Open'
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta}`}>{label}</span>
}

interface TeamAssemblyPanelProps {
  data: TalentMatchingData
  getProjectMembers: (projectId: string) => TeamMemberSummary[]
  getPendingInvitations: (projectId: string) => TeamInvitation[]
  getInvitationActivity: (projectId: string) => InvitationActivity[]
  onInvite: (projectId: string, need: RoleNeed, candidate: MatchCandidate, role: string) => void
  onCancelInvitation: (projectId: string, profileId: string) => void
  onChangeMemberRole: (projectId: string, profileId: string, role: string) => void
  onRemoveMember: (projectId: string, profileId: string) => void
  canInviteTeam?: boolean
}

export function TeamAssemblyPanel({
  data,
  getProjectMembers,
  getPendingInvitations,
  getInvitationActivity,
  onInvite,
  onCancelInvitation,
  onChangeMemberRole,
  onRemoveMember,
  canInviteTeam = true,
}: TeamAssemblyPanelProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [ignoredIds, setIgnoredIds] = useState<string[]>([])
  const [inviteRoleSelection, setInviteRoleSelection] = useState<Record<string, string>>({})
  const [memberRoleSelection, setMemberRoleSelection] = useState<Record<string, string>>({})

  const ignoredSet = useMemo(() => new Set(ignoredIds), [ignoredIds])
  const selectedCandidate = useMemo(() => {
    for (const project of data.projects) {
      for (const group of project.roleGroups) {
        const match = group.candidates.find((candidate) => candidate.profileId === selectedCandidateId)
        if (match) return match
      }
    }
    return null
  }, [data.projects, selectedCandidateId])

  const summary = useMemo(() => {
    const pendingCount = data.projects.reduce((sum, project) => sum + getPendingInvitations(project.projectId).length, 0)
    const activeCount = data.projects.reduce((sum, project) => (
      sum + getProjectMembers(project.projectId).filter((member) => member.status === 'active').length
    ), 0)
    const candidateCount = data.projects.reduce((sum, project) => (
      sum + project.roleGroups.reduce((groupSum, group) => groupSum + Math.min(group.candidates.length, 3), 0)
    ), 0)
    return {
      pendingCount,
      activeCount,
      candidateCount,
    }
  }, [data.projects, getPendingInvitations, getProjectMembers])

  function ignoreCandidate(projectId: string, roleId: string, candidateId: string) {
    setIgnoredIds((current) => [...current, `${projectId}:${roleId}:${candidateId}`])
    if (selectedCandidateId === candidateId) setSelectedCandidateId(null)
  }

  function getInviteRole(projectId: string, need: RoleNeed, candidate: MatchCandidate) {
    const key = `${projectId}:${need.id}:${candidate.profileId}`
    return inviteRoleSelection[key] ?? need.role
  }

  function getMemberRole(projectId: string, member: TeamMemberSummary) {
    const key = `${projectId}:${member.profileId}`
    return memberRoleSelection[key] ?? member.role
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs text-white/45">Projects with gaps</div>
            <div className="mt-2 text-2xl font-semibold text-white">{data.totalProjectsWithGaps}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs text-white/45">Open roles</div>
            <div className="mt-2 text-2xl font-semibold text-white">{data.totalOpenRoles}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs text-white/45">Pending invitations</div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.pendingCount}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs text-white/45">Active members</div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.activeCount}</div>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/65">
          候选池 {summary.candidateCount} 人。AI 只做候选排序与推荐解释；邀请、接受、改角色、移除都需要你手动触发。
        </div>
      </div>

      {selectedCandidate ? (
        <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white">{selectedCandidate.displayName}</div>
              <div className="mt-1 text-sm text-white/55">{selectedCandidate.city} · {selectedCandidate.roleTags.join(' / ')}</div>
            </div>
            <AvailabilityBadge availability={selectedCandidate.availability} />
          </div>
          {selectedCandidate.bio ? (
            <p className="mt-3 text-sm leading-relaxed text-white/70">{selectedCandidate.bio}</p>
          ) : null}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-xs text-white/45">推荐理由</div>
              <ul className="mt-2 space-y-2 text-sm text-white/75">
                {selectedCandidate.reasons.map((reason) => (
                  <li key={`${selectedCandidate.profileId}-${reason.type}`}>{reason.message}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-xs text-white/45">口碑摘要</div>
              <div className="mt-2 text-sm text-white/75">
                评分 {selectedCandidate.ratingSummary.rating.toFixed(1)} · 参考记录 {selectedCandidate.ratingSummary.reviewCount}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {data.projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
          当前所有项目的关键角色都已具备，暂时没有新的组队缺口。
        </div>
      ) : data.projects.map((project) => {
        const pendingInvitations = getPendingInvitations(project.projectId)
        const invitationActivity = getInvitationActivity(project.projectId).slice(0, 6)
        const members = getProjectMembers(project.projectId)

        return (
          <div key={project.projectId} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">{project.title}</div>
                <div className="mt-1 text-sm text-white/55">
                  阶段 {project.currentStage} · Order {project.orderStatus} · Delivery {project.deliveryStatus}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-white/70">
                  缺口角色 {project.openRolesCount}
                </div>
                <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-white/70">
                  待处理邀请 {pendingInvitations.length}
                </div>
                <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-white/70">
                  成员 {members.filter((member) => member.status === 'active').length}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-white">推荐候选区</div>
                  <div className="text-xs text-white/45">只做推荐，不自动邀请</div>
                </div>

                <div className="mt-4 space-y-4">
                  {project.roleGroups
                    .filter((group) => group.need.status !== 'filled')
                    .map((group) => (
                      <div key={group.need.id} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="text-base font-semibold text-white">{getRoleNeedLabel(group.need.role)}</div>
                            <PriorityBadge priority={group.need.priority} />
                            <RoleStatusBadge status={group.need.status} />
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-3">
                          {group.candidates
                            .filter((candidate) => !ignoredSet.has(`${project.projectId}:${group.need.id}:${candidate.profileId}`))
                            .slice(0, 3)
                            .map((candidate) => {
                              const roleKey = `${project.projectId}:${group.need.id}:${candidate.profileId}`
                              const selectedRole = getInviteRole(project.projectId, group.need, candidate)

                              return (
                                <div key={candidate.profileId} className="rounded-xl border border-white/8 bg-black/15 px-4 py-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-semibold text-white">{candidate.displayName}</div>
                                      <div className="mt-1 text-xs text-white/50">{candidate.city} · Score {candidate.score}</div>
                                    </div>
                                    <AvailabilityBadge availability={candidate.availability} />
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {candidate.reasons.map((reason) => (
                                      <span
                                        key={`${candidate.profileId}-${reason.type}`}
                                        className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/65"
                                      >
                                        {reason.type}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="mt-3 text-sm text-white/65">
                                    评分 {candidate.ratingSummary.rating.toFixed(1)} · 记录 {candidate.ratingSummary.reviewCount}
                                  </div>

                                  <div className="mt-3">
                                    <label className="text-[11px] uppercase tracking-[0.16em] text-white/40">邀请角色</label>
                                    <select
                                      value={selectedRole}
                                      onChange={(event) => setInviteRoleSelection((current) => ({ ...current, [roleKey]: event.target.value }))}
                                      disabled={!canInviteTeam}
                                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1120] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:text-white/35"
                                    >
                                      {ROLE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCandidateId(candidate.profileId)}
                                      className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
                                    >
                                      查看资料
                                    </button>
                                    {candidate.matchedCaseIds.length > 0 ? (
                                      <Link
                                        href={`/case/${candidate.matchedCaseIds[0]}`}
                                        className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
                                      >
                                        查看案例
                                      </Link>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled
                                        className="rounded-xl border border-white/8 px-3 py-2 text-sm text-white/35"
                                      >
                                        查看案例
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => onInvite(project.projectId, group.need, candidate, selectedRole)}
                                      disabled={!canInviteTeam}
                                      className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-100 transition hover:border-indigo-300/40 hover:bg-indigo-500/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35"
                                    >
                                      邀请加入
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => ignoreCandidate(project.projectId, group.need.id, candidate.profileId)}
                                      className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60 transition hover:border-white/20 hover:text-white"
                                    >
                                      忽略推荐
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          {group.candidates.filter((candidate) => !ignoredSet.has(`${project.projectId}:${group.need.id}:${candidate.profileId}`)).length === 0 ? (
                            <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45 lg:col-span-3">
                              当前没有更合适的推荐候选，可以稍后再查看，或手动扩展搜索范围。
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-white">待处理邀请</div>
                    <div className="text-xs text-white/45">{pendingInvitations.length} pending</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {pendingInvitations.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                        当前没有待处理邀请。
                      </div>
                    ) : pendingInvitations.map((invitation) => (
                      <div key={invitation.id} className="rounded-xl border border-white/8 bg-white/5 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{invitation.displayName ?? invitation.profileId}</div>
                            <div className="mt-1 text-xs text-white/50">
                              {formatTeamRole(invitation.role)} · 由 {invitation.invitedByName ?? invitation.invitedByUserId} 发起 · {formatDate(invitation.createdAt)}
                            </div>
                          </div>
                          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                            pending
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onCancelInvitation(project.projectId, invitation.profileId)}
                            disabled={!canInviteTeam}
                            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 disabled:cursor-not-allowed disabled:text-white/35"
                          >
                            取消邀请
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-white">成员列表</div>
                    <div className="text-xs text-white/45">{members.length} tracked</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {members.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                        当前还没有成员记录。
                      </div>
                    ) : members.map((member) => {
                      const roleKey = `${project.projectId}:${member.profileId}`
                      const selectedRole = getMemberRole(project.projectId, member)

                      return (
                        <div key={member.profileId} className="rounded-xl border border-white/8 bg-white/5 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">{member.displayName}</div>
                              <div className="mt-1 text-xs text-white/50">
                                {member.city ?? 'Remote'} · {member.ratingSummary ? `评分 ${member.ratingSummary.rating.toFixed(1)} / ${member.ratingSummary.reviewCount}` : '暂无评分'}
                              </div>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${member.status === 'active' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : member.status === 'invited' ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-white/5 text-white/55'}`}>
                              {member.status}
                            </span>
                          </div>
                          <div className="mt-3">
                            <label className="text-[11px] uppercase tracking-[0.16em] text-white/40">成员角色</label>
                            <select
                              value={selectedRole}
                              onChange={(event) => setMemberRoleSelection((current) => ({ ...current, [roleKey]: event.target.value }))}
                              disabled={!canInviteTeam}
                              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1120] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:text-white/35"
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onChangeMemberRole(project.projectId, member.profileId, selectedRole)}
                              disabled={!canInviteTeam || selectedRole === member.role}
                              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 disabled:cursor-not-allowed disabled:text-white/35"
                            >
                              修改角色
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveMember(project.projectId, member.profileId)}
                              disabled={!canInviteTeam}
                              className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35"
                            >
                              移除成员
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-white">邀请活动</div>
                  <div className="text-xs text-white/45">{invitationActivity.length} recent</div>
                </div>
                <div className="mt-4 space-y-3">
                  {invitationActivity.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                      当前还没有邀请活动记录。
                    </div>
                  ) : invitationActivity.map((activity) => (
                    <div key={activity.id} className="rounded-xl border border-white/8 bg-white/5 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white">{activity.message}</div>
                          <div className="mt-1 text-xs text-white/45">
                            {activity.actorName} · {formatDate(activity.createdAt)}
                          </div>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-white/55">
                          {activity.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
