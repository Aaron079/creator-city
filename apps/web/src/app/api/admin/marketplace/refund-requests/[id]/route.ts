import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import { executeMarketplaceRefund, MarketplaceRefundError } from '@/lib/marketplace/refund'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

// ─── PATCH /api/admin/marketplace/refund-requests/[id] ────────────────────────
// action: 'approve'            → PENDING → APPROVED (intent only, no accounting)
// action: 'reject'             → PENDING → REJECTED
// action: 'execute'            → APPROVED → EXECUTED (real refund execution)
// action: 'approveAndExecute'  → PENDING → APPROVED → EXECUTED (one-step)
//
// P1-2: 'execute' and 'approveAndExecute' call executeMarketplaceRefund().
// Actual buyer refund + seller reversal + LicenseGrant revoke are atomic.

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)
    if (user.role !== 'ADMIN') return jsonError('ADMIN_REQUIRED', '需要管理员权限。', 403)

    let body: { action?: string; adminNote?: string } = {}
    try { body = await request.json() } catch { /* no body */ }

    const { action, adminNote } = body

    if (action !== 'approve' && action !== 'reject' && action !== 'execute' && action !== 'approveAndExecute') {
      return jsonError('INVALID_ACTION', 'action 必须为 approve、reject、execute 或 approveAndExecute。', 400)
    }

    const refundRequest = await db.marketplaceRefundRequest.findUnique({
      where: { id: params.id },
    })
    if (!refundRequest) return jsonError('REFUND_REQUEST_NOT_FOUND', '退款申请不存在。', 404)

    const now = new Date()

    // ── reject ──────────────────────────────────────────────────────────────
    if (action === 'reject') {
      if (refundRequest.status !== 'PENDING') {
        return jsonError('REFUND_REQUEST_NOT_PENDING', '只有待审核退款申请可以驳回。', 409)
      }
      const updated = await db.marketplaceRefundRequest.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED',
          adminNote: adminNote?.trim() || null,
          reviewedAt: now,
        },
      })
      return jsonOk({ refundRequest: serializeRefundRequest(updated) })
    }

    // ── approve (intent only) ───────────────────────────────────────────────
    if (action === 'approve') {
      if (refundRequest.status !== 'PENDING') {
        return jsonError('REFUND_REQUEST_NOT_PENDING', '只有待审核退款申请可以批准。', 409)
      }
      const updated = await db.marketplaceRefundRequest.update({
        where: { id: params.id },
        data: {
          status: 'APPROVED',
          adminNote: adminNote?.trim() || null,
          reviewedAt: now,
        },
      })
      return jsonOk({
        refundRequest: serializeRefundRequest(updated),
        warning: 'APPROVED 仅代表人工审核通过意向。实际退款执行需管理员调用 action:execute 后才会执行账务。',
      })
    }

    // ── approveAndExecute ───────────────────────────────────────────────────
    if (action === 'approveAndExecute') {
      if (refundRequest.status !== 'PENDING') {
        return jsonError('REFUND_REQUEST_NOT_PENDING', '只有待审核退款申请可以审批并执行退款。', 409)
      }
      // First mark APPROVED so executeMarketplaceRefund can proceed
      await db.marketplaceRefundRequest.update({
        where: { id: params.id },
        data: {
          status: 'APPROVED',
          adminNote: adminNote?.trim() || null,
          reviewedAt: now,
        },
      })
      // Then execute
      return await handleExecute(params.id, user.id)
    }

    // ── execute ─────────────────────────────────────────────────────────────
    // action === 'execute'
    if (refundRequest.status !== 'APPROVED') {
      return jsonError('REFUND_REQUEST_NOT_APPROVED', '只有已批准的退款申请可以执行退款。', 409)
    }
    return await handleExecute(params.id, user.id)

  } catch (error) {
    console.error('[admin/marketplace/refund-requests/[id]] PATCH failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('REFUND_REQUEST_UPDATE_FAILED', '审核退款申请失败，请稍后重试。', 500)
  }
}

async function handleExecute(refundRequestId: string, adminId: string) {
  try {
    const result = await executeMarketplaceRefund(refundRequestId, adminId)
    const req = await db.marketplaceRefundRequest.findUnique({ where: { id: refundRequestId } })
    return jsonOk({
      refundRequest: req ? serializeRefundRequest(req) : null,
      order: result.order ? serializeOrder(result.order) : null,
      buyerRefundCredits: result.buyerRefundCredits,
      sellerReversalCredits: result.sellerReversalCredits,
      buyerLedgerId: result.buyerLedgerId,
      sellerLedgerId: result.sellerLedgerId,
      grantRevoked: result.grantRevoked,
      idempotent: result.idempotent,
    })
  } catch (err) {
    if (err instanceof MarketplaceRefundError) {
      const status =
        err.code === 'REFUND_REQUEST_NOT_FOUND' ? 404
        : err.code === 'REFUND_REQUEST_NOT_APPROVED' ? 409
        : err.code === 'ORDER_NOT_COMPLETED' ? 409
        : err.code === 'GRANT_NOT_ACTIVE' ? 409
        : err.code === 'SELLER_INSUFFICIENT_CREDITS' ? 402
        : 500
      return jsonError(err.code, err.message, status)
    }
    throw err
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeRefundRequest(r: {
  id: string
  orderId: string
  buyerId: string
  sellerId: string
  assetId: string
  status: string
  reason: string
  adminNote: string | null
  executedAt: Date | null
  executionNote: string | null
  createdAt: Date
  reviewedAt: Date | null
}) {
  return {
    id: r.id,
    orderId: r.orderId,
    buyerId: r.buyerId,
    sellerId: r.sellerId,
    assetId: r.assetId,
    status: r.status,
    reason: r.reason,
    adminNote: r.adminNote,
    executedAt: r.executedAt?.toISOString() ?? null,
    executionNote: r.executionNote,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
  }
}

function serializeOrder(o: {
  id: string
  status: string
  priceCredits: number
  sellerAmountCredits: number | null
  platformFeeCredits: number | null
  completedAt: Date | null
  refundedAt: Date | null
}) {
  return {
    id: o.id,
    status: o.status,
    priceCredits: o.priceCredits,
    sellerAmountCredits: o.sellerAmountCredits,
    platformFeeCredits: o.platformFeeCredits,
    completedAt: o.completedAt?.toISOString() ?? null,
    refundedAt: o.refundedAt?.toISOString() ?? null,
  }
}
