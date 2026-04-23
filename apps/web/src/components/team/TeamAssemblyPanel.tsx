'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  getRoleNeedLabel,
  type MatchCandidate,
  type RoleNeed,
  type TalentMatchingData,
} from '@/lib/matching/aggregate'

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
  onInvite: (projectId: string, need: RoleNeed, candidate: MatchCandidate) => void
  canInviteTeam?: boolean
}

export function TeamAssemblyPanel({ data, onInvite, canInviteTeam = true }: TeamAssemblyPanelProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [ignoredIds, setIgnoredIds] = useState<string[]>([])

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

  function ignoreCandidate(projectId: string, roleId: string, candidateId: string) {
    setIgnoredIds((current) => [...current, `${projectId}:${roleId}:${candidateId}`])
    if (selectedCandidateId === candidateId) setSelectedCandidateId(null)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs text-white/45">Projects with gaps</div>
            <div className="mt-2 text-2xl font-semibold text-white">{data.totalProjectsWithGaps}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs text-white/45">Open roles</div>
            <div className="mt-2 text-2xl font-semibold text-white">{data.totalOpenRoles}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3">
            <div className="text-xs text-white/45">Mode</div>
            <div className="mt-2 text-sm font-medium text-white">AI recommends, producer decides</div>
          </div>
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
      ) : data.projects.map((project) => (
        <div key={project.projectId} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white">{project.title}</div>
              <div className="mt-1 text-sm text-white/55">
                阶段 {project.currentStage} · Order {project.orderStatus} · Delivery {project.deliveryStatus}
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-white/70">
              缺口角色 {project.openRolesCount}
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {project.roleGroups
              .filter((group) => group.need.status !== 'filled')
              .map((group) => (
                <div key={group.need.id} className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
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
                      .map((candidate) => (
                        <div key={candidate.profileId} className="rounded-xl border border-white/8 bg-white/5 px-4 py-4">
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
                              onClick={() => onInvite(project.projectId, group.need, candidate)}
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
                      ))}
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
      ))}
    </div>
  )
}
