'use client'

import { useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ExternalAccessNotice } from '@/components/external/ExternalAccessNotice'
import { SharedProjectOverview } from '@/components/external/SharedProjectOverview'
import { getExternalReviewHref } from '@/lib/routing/actions'
import { buildExternalClientContext } from '@/lib/external/context'
import { useApprovalStore } from '@/store/approval.store'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import { useExternalAccessStore } from '@/store/external-access.store'
import { useNotificationsStore } from '@/store/notifications.store'
import { useVersionHistoryStore } from '@/store/version-history.store'
import { useReviewResolutionStore } from '@/lib/review/resolution-store'

export default function SharedProjectByTokenPage() {
  const params = useParams<{ token: string }>()
  const token = decodeURIComponent(params.token)

  const getExternalLinkByToken = useExternalAccessStore((state) => state.getExternalLinkByToken)
  const markLinkUsed = useExternalAccessStore((state) => state.markLinkUsed)
  const submitCreatorInviteIntent = useExternalAccessStore((state) => state.submitCreatorInviteIntent)
  const approvals = useApprovalStore((state) => state.approvals)
  const deliveryPackages = useDeliveryPackageStore((state) => state.deliveryPackages)
  const notes = useDirectorNotesStore((state) => state.notes)
  const notifications = useNotificationsStore((state) => state.items)
  const versions = useVersionHistoryStore((state) => state.versions)
  const resolutions = useReviewResolutionStore((state) => state.items)

  const link = useMemo(
    () => getExternalLinkByToken(token),
    [getExternalLinkByToken, token],
  )
  const hasMarkedUse = useRef(false)
  const deliveryPackage = useMemo(
    () => link ? deliveryPackages.find((item) => item.projectId === link.projectId) ?? null : null,
    [deliveryPackages, link],
  )
  const context = useMemo(
    () => link ? buildExternalClientContext({
      projectId: link.projectId,
      projectTitle: link.projectTitle,
      approvals,
      notes,
      versions,
      deliveryPackage,
      notifications,
      resolutions,
    }) : null,
    [approvals, deliveryPackage, link, notes, notifications, resolutions, versions],
  )

  useEffect(() => {
    if (!link || link.status !== 'active' || hasMarkedUse.current) return
    hasMarkedUse.current = true
    markLinkUsed(token)
  }, [link, markLinkUsed, token])

  if (!link) {
    return (
      <div className="min-h-screen bg-[#050b14] px-4 py-12">
        <ExternalAccessNotice
          status="invalid"
          title="这个共享链接无效"
          message="当前 token 无法对应到有效的外部共享入口。为了保护项目内容，这里不会显示任何项目细节。"
        />
      </div>
    )
  }

  if (link.status !== 'active') {
    return (
      <div className="min-h-screen bg-[#050b14] px-4 py-12">
        <ExternalAccessNotice
          status={link.status}
          title={link.status === 'revoked' ? '这个共享链接已被撤销' : '这个共享链接已过期'}
          message="当前链接不再开放外部访问。为了保护项目内容，这里不会继续显示项目详情。"
          details={[
            `项目：${link.projectTitle}`,
            `访问类型：${link.accessType}`,
          ]}
        />
      </div>
    )
  }

  if (!context) return null

  if (link.accessType === 'client-review') {
    return (
      <div className="min-h-screen bg-[#050b14] px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-[#07111d] p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300/70">External Review Entry</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{link.projectTitle}</h1>
          <p className="mt-3 text-sm leading-[1.8] text-white/62">
            这个链接对应的是外部 client review。你将进入一个受控的 guest review 页面，在那里查看当前版本、交付快照、风险摘要，并提交 Confirm / Request Changes / Reject。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={getExternalReviewHref(link.token)}
              className="inline-flex rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
            >
              进入 Guest Review
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050b14]">
      <SharedProjectOverview
        link={link}
        clientFeed={context.clientFeed}
        onSubmitCreatorIntent={(payload) => {
          submitCreatorInviteIntent(token, payload)
        }}
      />
    </div>
  )
}
