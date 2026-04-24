'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { GuestReviewPortal } from '@/components/external/GuestReviewPortal'
import { InvalidTokenState } from '@/components/external/InvalidTokenState'
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

export default function GuestReviewByTokenPage() {
  const params = useParams<{ token: string }>()
  const token = decodeURIComponent(params.token)
  const [isHydrated, setIsHydrated] = useState(false)

  const getExternalLinkByToken = useExternalAccessStore((state) => state.getExternalLinkByToken)
  const markLinkUsed = useExternalAccessStore((state) => state.markLinkUsed)
  const approvals = useApprovalStore((state) => state.approvals)
  const createApprovalRequest = useApprovalStore((state) => state.createApprovalRequest)
  const addApprovalDecision = useApprovalStore((state) => state.addApprovalDecision)
  const addSystemMessage = useApprovalStore((state) => state.addSystemMessage)
  const deliveryPackages = useDeliveryPackageStore((state) => state.deliveryPackages)
  const markDeliveryApproved = useDeliveryPackageStore((state) => state.markDeliveryApproved)
  const markDeliveryNeedsRevision = useDeliveryPackageStore((state) => state.markDeliveryNeedsRevision)
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
            title="正在验证外部访问链接"
            message="我们正在准备当前 guest review 入口。"
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
          title="这个外部访问链接无效"
          message="当前 token 无法对应到可用的受控入口。为了保护项目内容，这里不会展示任何项目细节。"
        />
      </div>
    )
  }

  if (link.status !== 'active') {
    return (
      <div className="min-h-screen bg-[#050b14] px-4 py-12">
        <ErrorState
          title={link.status === 'revoked' ? '这个外部访问链接已被撤销' : '这个外部访问链接已过期'}
          message="当前链接不再开放外部 review 访问。为了保护项目内容，这里不会继续展示项目详情。"
          actionHref="/me"
          actionLabel="返回我的工作台"
        />
      </div>
    )
  }

  if (!link.permissions.canViewProject || !link.permissions.canViewDelivery) {
    return (
      <div className="min-h-screen bg-[#050b14] px-4 py-12">
        <ErrorState
          title="这个链接没有交付 review 权限"
          message="当前外部访问范围不包含交付 review，因此不会显示正式确认入口。"
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
            title="当前 review 数据暂时不可用"
            message="我们暂时没能准备好这条外部 review 所需的交付摘要。你可以稍后重试，或联系项目负责人重新发送链接。"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050b14]">
      <GuestReviewPortal
        link={link}
        deliveryPackage={deliveryPackage}
        latestDecision={context.latestDecision}
        deliveryApproval={context.deliveryApproval}
        clientFeed={context.clientFeed}
        onSubmitDecision={({ status, comment }) => {
          let approval = context.deliveryApproval

          if (!approval) {
            approval = createApprovalRequest('delivery', deliveryPackage?.id ?? link.projectId, ['client'], {
              title: `${link.projectTitle} 外部交付确认`,
              description: '由外部协作入口发起的客户交付确认。',
              createdBy: link.createdByUserId,
            })
          }

          if (status === 'approved' && deliveryPackage?.riskSummary?.issues.some((issue) => issue.severity === 'strong')) {
            const confirmed = window.confirm('当前交付包仍有 strong risk。确认后只会记录你的外部客户决定，不会自动推进商业流程。是否仍然继续？')
            if (!confirmed) return
          }

          const next = addApprovalDecision(approval.id, {
            role: 'client',
            userId: `external:${link.token}`,
            status,
            comment,
            versionId: deliveryPackage?.manifest?.finalVersion,
          })

          if (!next) return

          if (deliveryPackage) {
            if (status === 'approved') {
              markDeliveryApproved(deliveryPackage.id)
            } else if (status === 'changes-requested' || status === 'rejected') {
              markDeliveryNeedsRevision(deliveryPackage.id)
            }
          }

          addSystemMessage(
            status === 'approved'
              ? `外部客户通过 guest review portal 确认了项目 ${link.projectTitle} 的当前交付。`
              : status === 'changes-requested'
                ? `外部客户通过 guest review portal 请求修改：${comment ?? '未填写原因'}`
                : `外部客户通过 guest review portal 拒绝了当前交付：${comment ?? '未填写原因'}`,
          )
        }}
      />
    </div>
  )
}
