import { db } from '@/lib/db'
import { CreditLedgerType } from '@prisma/client'
import { randomUUID } from 'crypto'

export class MarketplaceRefundError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'MarketplaceRefundError'
  }
}

export async function executeMarketplaceRefund(refundRequestId: string, adminId: string) {
  // ── Pre-flight (outside tx, read-only) ───────────────────────────────────

  const refundRequest = await db.marketplaceRefundRequest.findUnique({
    where: { id: refundRequestId },
  })
  if (!refundRequest) {
    throw new MarketplaceRefundError('REFUND_REQUEST_NOT_FOUND', '退款申请不存在')
  }

  // Idempotent: already executed
  if (refundRequest.status === 'EXECUTED') {
    const order = await db.marketplaceOrder.findUnique({ where: { id: refundRequest.orderId } })
    return {
      idempotent: true,
      refundRequest,
      order,
      buyerRefundCredits: order?.priceCredits ?? 0,
      sellerReversalCredits: order?.sellerAmountCredits ?? 0,
      buyerLedgerId: null,
      sellerLedgerId: null,
      grantRevoked: true,
    }
  }

  if (refundRequest.status === 'EXECUTION_FAILED') {
    throw new MarketplaceRefundError('REFUND_REQUEST_NOT_APPROVED', '退款申请之前执行失败，请重新审核后再试')
  }

  if (refundRequest.status !== 'APPROVED') {
    throw new MarketplaceRefundError('REFUND_REQUEST_NOT_APPROVED', '只有已批准的退款申请可以执行退款')
  }

  const order = await db.marketplaceOrder.findUnique({ where: { id: refundRequest.orderId } })
  if (!order) {
    throw new MarketplaceRefundError('ORDER_NOT_COMPLETED', '关联订单不存在')
  }
  if (order.status === 'REFUNDED') {
    return {
      idempotent: true,
      refundRequest,
      order,
      buyerRefundCredits: order.priceCredits,
      sellerReversalCredits: order.sellerAmountCredits ?? 0,
      buyerLedgerId: null,
      sellerLedgerId: null,
      grantRevoked: true,
    }
  }
  if (order.status !== 'COMPLETED') {
    throw new MarketplaceRefundError('ORDER_NOT_COMPLETED', '只有已完成的订单可以执行退款')
  }
  if (order.priceCredits <= 0) {
    throw new MarketplaceRefundError('ORDER_NOT_COMPLETED', '免费订单不支持退款')
  }

  const sellerAmountCredits = order.sellerAmountCredits ?? 0
  const priceCredits = order.priceCredits

  // Check active paid LicenseGrant
  const grant = await db.licenseGrant.findUnique({
    where: { listingId_buyerId: { listingId: order.listingId, buyerId: order.buyerId } },
  })
  if (!grant || grant.status !== 'ACTIVE' || grant.paidCredits <= 0) {
    throw new MarketplaceRefundError('GRANT_NOT_ACTIVE', '未找到可撤销的有效授权凭证')
  }

  // Check seller wallet balance BEFORE entering transaction
  const sellerWallet = await db.userCreditWallet.findUnique({ where: { userId: order.sellerId } })
  const sellerBalance = sellerWallet?.balance ?? 0

  if (sellerBalance < sellerAmountCredits) {
    // Mark EXECUTION_FAILED without entering transaction — no accounting side-effects
    await db.marketplaceRefundRequest.update({
      where: { id: refundRequestId },
      data: {
        status: 'EXECUTION_FAILED',
        executionNote: `卖家积分余额不足，无法完成退款扣回。当前余额 ${sellerBalance} 积分，需要扣回 ${sellerAmountCredits} 积分。请联系卖家充值后重试。`,
        reviewedAt: new Date(),
      },
    })
    throw new MarketplaceRefundError(
      'SELLER_INSUFFICIENT_CREDITS',
      `卖家积分余额不足（当前 ${sellerBalance}，需要 ${sellerAmountCredits}）`,
    )
  }

  const now = new Date()
  const buyerLedgerId = randomUUID()
  const sellerLedgerId = randomUUID()

  // ── Atomic transaction ────────────────────────────────────────────────────
  const result = await db.$transaction(async (tx) => {
    // 1. Claim the refund request (APPROVED → EXECUTED, prevents race)
    const claimedRefund = await tx.marketplaceRefundRequest.updateMany({
      where: { id: refundRequestId, status: 'APPROVED' },
      data: {
        status: 'EXECUTED',
        executedAt: now,
        reviewedAt: now,
        executionNote: `退款已执行：买家返还 ${priceCredits} 积分，卖家扣回 ${sellerAmountCredits} 积分，授权已撤销。执行人：${adminId}`,
      },
    })
    if (claimedRefund.count === 0) {
      // Another concurrent execute won the race — safe to treat as idempotent
      const current = await tx.marketplaceRefundRequest.findUnique({ where: { id: refundRequestId } })
      if (current?.status === 'EXECUTED') {
        return { idempotent: true, refundRequest: current, order, buyerLedgerId: null, sellerLedgerId: null }
      }
      throw new MarketplaceRefundError('REFUND_REQUEST_NOT_APPROVED', '退款申请状态已变更，请刷新后重试')
    }

    // 2. Claim the order (COMPLETED → REFUNDED)
    const claimedOrder = await tx.marketplaceOrder.updateMany({
      where: { id: order.id, status: 'COMPLETED' },
      data: { status: 'REFUNDED', refundedAt: now },
    })
    if (claimedOrder.count === 0) {
      const currentOrder = await tx.marketplaceOrder.findUnique({ where: { id: order.id } })
      if (currentOrder?.status === 'REFUNDED') {
        return { idempotent: true, refundRequest, order: currentOrder, buyerLedgerId: null, sellerLedgerId: null }
      }
      throw new MarketplaceRefundError('ORDER_NOT_COMPLETED', '订单状态已变更，无法完成退款')
    }

    // 3. Buyer wallet: upsert + increment balance
    const buyerWallet = await tx.userCreditWallet.upsert({
      where: { userId: order.buyerId },
      create: { userId: order.buyerId, balance: 0, frozenBalance: 0, totalPurchased: 0, totalConsumed: 0 },
      update: {},
    })
    const buyerWalletAfter = await tx.userCreditWallet.update({
      where: { id: buyerWallet.id },
      data: { balance: { increment: priceCredits } },
    })

    // 4. Buyer refund ledger
    await tx.creditLedger.create({
      data: {
        id: buyerLedgerId,
        walletId: buyerWallet.id,
        userId: order.buyerId,
        type: CreditLedgerType.MARKETPLACE_REFUND,
        delta: priceCredits,
        frozen: 0,
        balance: buyerWalletAfter.balance,
        amountCredits: priceCredits,
        refType: 'marketplace_refund_request',
        refId: refundRequestId,
        description: `市场授权退款返还: 订单 ${order.id}`,
      },
    })

    // 5. Seller wallet: atomic deduct with balance guard
    const sellerWalletRecord = await tx.userCreditWallet.upsert({
      where: { userId: order.sellerId },
      create: { userId: order.sellerId, balance: 0, frozenBalance: 0, totalPurchased: 0, totalConsumed: 0 },
      update: {},
    })
    const sellerDeducted = await tx.userCreditWallet.updateMany({
      where: { id: sellerWalletRecord.id, balance: { gte: sellerAmountCredits } },
      data: { balance: { decrement: sellerAmountCredits } },
    })
    if (sellerDeducted.count === 0) {
      // Balance changed between pre-flight and transaction — roll back everything
      throw new MarketplaceRefundError('SELLER_INSUFFICIENT_CREDITS', '卖家积分余额不足，退款事务回滚')
    }
    const sellerWalletAfter = await tx.userCreditWallet.findUnique({ where: { id: sellerWalletRecord.id } })

    // 6. Seller reversal ledger
    await tx.creditLedger.create({
      data: {
        id: sellerLedgerId,
        walletId: sellerWalletRecord.id,
        userId: order.sellerId,
        type: CreditLedgerType.MARKETPLACE_SELLER_REVERSAL,
        delta: -sellerAmountCredits,
        frozen: 0,
        balance: sellerWalletAfter!.balance,
        amountCredits: sellerAmountCredits,
        refType: 'marketplace_refund_request',
        refId: refundRequestId,
        description: `市场授权退款扣回: 订单 ${order.id}`,
      },
    })

    // 7. Revoke LicenseGrant
    const revokedGrant = await tx.licenseGrant.updateMany({
      where: { listingId: order.listingId, buyerId: order.buyerId, status: 'ACTIVE' },
      data: {
        status: 'REVOKED',
        revokedAt: now,
        termsJson: {
          ...(typeof grant.termsJson === 'object' && grant.termsJson !== null ? grant.termsJson as object : {}),
          revokedByRefundRequestId: refundRequestId,
          revokedAt: now.toISOString(),
          revokedReason: 'marketplace_refund_executed',
        },
      },
    })
    if (revokedGrant.count === 0) {
      throw new MarketplaceRefundError('GRANT_NOT_ACTIVE', '未找到可撤销的有效授权凭证')
    }

    const finalOrder = await tx.marketplaceOrder.findUnique({ where: { id: order.id } })
    const finalRefundRequest = await tx.marketplaceRefundRequest.findUnique({ where: { id: refundRequestId } })
    return { idempotent: false, refundRequest: finalRefundRequest, order: finalOrder, buyerLedgerId, sellerLedgerId }
  }).catch(async (err) => {
    // If the transaction failed due to seller balance issue, mark EXECUTION_FAILED
    if (err instanceof MarketplaceRefundError && err.code === 'SELLER_INSUFFICIENT_CREDITS') {
      await db.marketplaceRefundRequest.update({
        where: { id: refundRequestId },
        data: {
          status: 'EXECUTION_FAILED',
          executionNote: `退款事务中卖家余额不足，退款已回滚。请联系卖家充值后重试。`,
          reviewedAt: new Date(),
        },
      })
    }
    throw err
  })

  return {
    idempotent: result.idempotent ?? false,
    refundRequest: result.refundRequest,
    order: result.order,
    buyerRefundCredits: priceCredits,
    sellerReversalCredits: sellerAmountCredits,
    buyerLedgerId: result.buyerLedgerId,
    sellerLedgerId: result.sellerLedgerId,
    grantRevoked: true,
  }
}
