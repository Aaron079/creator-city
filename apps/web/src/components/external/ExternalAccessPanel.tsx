'use client'

import { useMemo, useState } from 'react'
import { getExternalAccessTypeLabel, getExternalEffectiveStatus, getExternalLinkHref, getExternalLinkSuggestedSummary, getExternalRoleHintLabel } from '@/lib/external/access'
import { useExternalAccessStore, type ExternalAccessType, type ExternalRoleHint } from '@/store/external-access.store'

function defaultRoleHint(accessType: ExternalAccessType): ExternalRoleHint {
  switch (accessType) {
    case 'client-review':
      return 'client'
    case 'creator-invite':
      return 'creator'
    case 'delivery-preview':
      return 'reviewer'
    case 'project-overview':
    default:
      return 'viewer'
  }
}

function suggestedLinkType(args: {
  pendingApprovals: number
  deliveryStatus: string
  openRoles: number
}) {
  if (args.pendingApprovals > 0 || args.deliveryStatus === 'submitted') return 'client-review'
  if (args.openRoles > 0) return 'creator-invite'
  if (args.deliveryStatus === 'ready' || args.deliveryStatus === 'approved') return 'delivery-preview'
  return 'project-overview'
}

export function ExternalAccessPanel({
  projectId,
  projectTitle,
  currentUserId,
  pendingApprovals,
  deliveryStatus,
  openRoles,
}: {
  projectId: string
  projectTitle: string
  currentUserId: string
  pendingApprovals: number
  deliveryStatus: string
  openRoles: number
}) {
  const links = useExternalAccessStore((state) => state.getLinksByProject(projectId))
  const createExternalLink = useExternalAccessStore((state) => state.createExternalLink)
  const revokeExternalLink = useExternalAccessStore((state) => state.revokeExternalLink)
  const suggestedType = useMemo(
    () => suggestedLinkType({ pendingApprovals, deliveryStatus, openRoles }),
    [deliveryStatus, openRoles, pendingApprovals],
  )
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    accessType: suggestedType as ExternalAccessType,
    invitedName: '',
    invitedEmail: '',
    note: '',
    expiresInDays: '7',
  })

  const suggestionText = suggestedType === 'client-review'
    ? '当前更适合发 Client Review Link，因为项目正在等外部确认。'
    : suggestedType === 'creator-invite'
      ? '当前更适合发 Creator Invite Link，因为团队仍有 open roles。'
      : suggestedType === 'delivery-preview'
        ? '当前更适合发 Delivery Preview Link，用于正式预览当前交付。'
        : '当前更适合发 Project Overview Link，用于先共享项目摘要。'

  const handleCreate = () => {
    const expiresAt = draft.expiresInDays
      ? new Date(Date.now() + Number(draft.expiresInDays || '0') * 24 * 3600_000).toISOString()
      : undefined

    const created = createExternalLink({
      projectId,
      projectTitle,
      accessType: draft.accessType,
      roleHint: defaultRoleHint(draft.accessType),
      createdByUserId: currentUserId,
      expiresAt,
      invitedName: draft.invitedName,
      invitedEmail: draft.invitedEmail,
      note: draft.note,
    })

    if (typeof window !== 'undefined') {
      const href = getExternalLinkHref(created)
      navigator.clipboard.writeText(`${window.location.origin}${href}`).catch(() => undefined)
      setCopiedId(created.id)
      window.setTimeout(() => setCopiedId(null), 1800)
    }
  }

  return (
    <section className="rounded-2xl border border-white/8 bg-black/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">External Access</h2>
          <p className="mt-2 text-sm text-white/58">
            为外部客户、外部创作者和外部审片人创建受控入口，不暴露内部管理信息。
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/8 px-4 py-3 text-sm text-cyan-100">
          {suggestionText}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <select
          value={draft.accessType}
          onChange={(event) => setDraft((current) => ({ ...current, accessType: event.target.value as ExternalAccessType }))}
          className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
        >
          {(['client-review', 'delivery-preview', 'creator-invite', 'project-overview'] satisfies ExternalAccessType[]).map((type) => (
            <option key={type} value={type}>{getExternalAccessTypeLabel(type)}</option>
          ))}
        </select>
        <input
          value={draft.expiresInDays}
          onChange={(event) => setDraft((current) => ({ ...current, expiresInDays: event.target.value }))}
          className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
          placeholder="有效天数"
        />
        <input
          value={draft.invitedName}
          onChange={(event) => setDraft((current) => ({ ...current, invitedName: event.target.value }))}
          className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
          placeholder="邀请对象姓名（可选）"
        />
        <input
          value={draft.invitedEmail}
          onChange={(event) => setDraft((current) => ({ ...current, invitedEmail: event.target.value }))}
          className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
          placeholder="邀请对象邮箱（可选）"
        />
      </div>
      <textarea
        value={draft.note}
        onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
        rows={3}
        className="mt-3 w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none resize-none"
        placeholder="附带说明，例如当前需要对方确认什么、或者为什么推荐参与"
      />
      <button
        onClick={handleCreate}
        className="mt-3 inline-flex rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
      >
        创建并复制外部链接
      </button>

      <div className="mt-6 space-y-3">
        {links.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
            当前还没有为这个项目创建外部链接。
          </div>
        ) : links.map((link) => {
          const effectiveStatus = getExternalEffectiveStatus(link)
          const href = getExternalLinkHref(link)

          return (
            <div key={link.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">{getExternalAccessTypeLabel(link.accessType)}</div>
                  <div className="mt-1 text-sm text-white/55">{getExternalLinkSuggestedSummary(link)}</div>
                  <div className="mt-2 text-xs text-white/40">
                    {getExternalRoleHintLabel(link.roleHint)}
                    {' · '}
                    {effectiveStatus}
                    {' · '}
                    创建于 {new Date(link.createdAt).toLocaleString('zh-CN')}
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    过期时间：{link.expiresAt ? new Date(link.expiresAt).toLocaleString('zh-CN') : '未设置'}
                    {' · '}
                    Last used：{link.lastUsedAt ? new Date(link.lastUsedAt).toLocaleString('zh-CN') : '未使用'}
                  </div>
                  {link.note ? <div className="mt-2 text-sm text-white/60">{link.note}</div> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (typeof window === 'undefined') return
                      navigator.clipboard.writeText(`${window.location.origin}${href}`).catch(() => undefined)
                      setCopiedId(link.id)
                      window.setTimeout(() => setCopiedId(null), 1800)
                    }}
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75"
                  >
                    {copiedId === link.id ? '已复制' : 'Copy'}
                  </button>
                  <button
                    onClick={() => revokeExternalLink(link.id)}
                    disabled={effectiveStatus !== 'active'}
                    className="rounded-xl border border-rose-500/25 px-3 py-2 text-sm text-rose-200 disabled:opacity-40"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
