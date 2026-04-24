'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { InvalidTokenState } from '@/components/external/InvalidTokenState'
import { SharedProjectOverview } from '@/components/external/SharedProjectOverview'
import { getExternalReviewHref } from '@/lib/routing/actions'
import { buildExternalClientContext } from '@/lib/external/context'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
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
  const [isHydrated, setIsHydrated] = useState(false)

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
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!link || link.status !== 'active' || hasMarkedUse.current) return
    hasMarkedUse.current = true
    markLinkUsed(token)
  }, [link, markLinkUsed, token])

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[#050b14] px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <LoadingState
            title="正在验证共享链接"
            message="我们正在准备当前外部协作入口。"
            count={2}
          />
        </div>
      </div>
    )
  }

  if (!link) {
    return (
      <div className="min-h-screen bg-[#050b14] px-4 py-12">
        <InvalidTokenState
          title="这个共享链接无效"
          message="当前 token 无法对应到有效的外部共享入口。为了保护项目内容，这里不会显示任何项目细节。"
        />
      </div>
    )
  }

  if (link.status !== 'active') {
    return (
      <div className="min-h-screen bg-[#050b14] px-4 py-12">
        <ErrorState
          title={link.status === 'revoked' ? '这个共享链接已被撤销' : '这个共享链接已过期'}
          message="当前链接不再开放外部访问。为了保护项目内容，这里不会继续显示项目详情。"
          actionHref="/me"
          actionLabel="返回我的工作台"
        />
      </div>
    )
  }

  if (!context) {
    return (
      <div className="min-h-screen bg-[#050b14] px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <ErrorState
            title="共享项目摘要暂时不可用"
            message="我们暂时没能准备好这条外部链接所需的项目摘要。你可以稍后重试，或联系项目负责人重新生成链接。"
          />
        </div>
      </div>
    )
  }

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
