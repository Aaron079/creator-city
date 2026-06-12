import { db } from '@/lib/db'
import { CreditLedgerType } from '@prisma/client'
import { randomUUID } from 'crypto'

const PLATFORM_RATE = 0.3

export class MarketplaceSettleError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly extra?: Record<string, number>,
  ) {
    super(message ?? code)
    this.name = 'MarketplaceSettleError'
  }
}

export async function settleMarketplaceOrder(orderId: string, buyerId: string) {
  // ── Pre-flight (outside tx) ───────────────────────────────────────────────
  const order = await db.marketplaceOrder.findUnique({
    where: { id: orderId },
    include: { listing: true, asset: true },
  })

  if (!order) throw new MarketplaceSettleError('ORDER_NOT_FOUND', '订单不存在')
  if (order.buyerId !== buyerId) throw new MarketplaceSettleError('NOT_BUYER', '你不是该订单的买家')
  if (order.status === 'COMPLETED') {
    // Already settled — idempotent return
    const grant = await db.licenseGrant.findUnique({
      where: { listingId_buyerId: { listingId: order.listingId, buyerId } },
    })
    return { idempotent: true, order, grant, priceCredits: order.priceCredits, platformFeeCredits: order.platformFeeCredits, sellerAmountCredits: order.sellerAmountCredits }
  }
  if (order.status !== 'QUOTED') {
    throw new MarketplaceSettleError('ORDER_NOT_QUOTED', `订单状态为 ${order.status}，无法支付`)
  }

  const listing = order.listing
  if (!listing || listing.status !== 'ACTIVE') {
    throw new MarketplaceSettleError('LISTING_NOT_ACTIVE', '授权列表已下架，无法支付')
  }
  if (!listing.priceCredits || listing.priceCredits < 1) {
    throw new MarketplaceSettleError('INVALID_PRICE', '授权价格无效')
  }

  const priceCredits = listing.priceCredits
  const platformFeeCredits = Math.round(priceCredits * PLATFORM_RATE)
  const sellerAmountCredits = priceCredits - platformFeeCredits
  const now = new Date()

  // ── Atomic transaction ────────────────────────────────────────────────────
  const result = await db.$transaction(async (tx) => {
    // 1. Claim the order (QUOTED → COMPLETED, atomic, prevents race)
    const claimed = await tx.marketplaceOrder.updateMany({
      where: { id: orderId, status: 'QUOTED' },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        platformFeeCredits,
        sellerAmountCredits,
        metadataJson: {
          settledAt: now.toISOString(),
          priceCredits,
          platformFeeCredits,
          sellerAmountCredits,
          platformRate: PLATFORM_RATE,
        },
      },
    })
    if (claimed.count === 0) {
      throw new MarketplaceSettleError('SETTLEMENT_FAILED', '结算冲突，请刷新后重试')
    }

    // 2. Deduct from buyer wallet (atomic balance check)
    const buyerWallet = await tx.userCreditWallet.upsert({
      where: { userId: buyerId },
      create: { userId: buyerId, balance: 0, frozenBalance: 0, totalPurchased: 0, totalConsumed: 0 },
      update: {},
    })

    const buyerUpdated = await tx.userCreditWallet.updateMany({
      where: { id: buyerWallet.id, balance: { gte: priceCredits } },
      data: {
        balance: { decrement: priceCredits },
        totalConsumed: { increment: priceCredits },
      },
    })
    if (buyerUpdated.count === 0) {
      throw new MarketplaceSettleError(
        'INSUFFICIENT_CREDITS',
        '积分余额不足，无法支付',
        { requiredCredits: priceCredits, availableCredits: buyerWallet.balance },
      )
    }

    // Re-read final buyer balance for ledger
    const buyerWalletAfter = await tx.userCreditWallet.findUnique({ where: { id: buyerWallet.id } })

    // 3. Buyer debit ledger
    await tx.creditLedger.create({
      data: {
        id: randomUUID(),
        walletId: buyerWallet.id,
        userId: buyerId,
        type: CreditLedgerType.MARKETPLACE_PURCHASE,
        delta: -priceCredits,
        frozen: 0,
        balance: buyerWalletAfter!.balance,
        amountCredits: priceCredits,
        refType: 'marketplace_order',
        refId: orderId,
        description: `授权购买: ${listing.title ?? order.assetId}`,
      },
    })

    // 4. Credit seller wallet
    const sellerWallet = await tx.userCreditWallet.upsert({
      where: { userId: order.sellerId },
      create: { userId: order.sellerId, balance: 0, frozenBalance: 0, totalPurchased: 0, totalConsumed: 0 },
      update: {},
    })

    const sellerWalletAfter = await tx.userCreditWallet.update({
      where: { id: sellerWallet.id },
      data: { balance: { increment: sellerAmountCredits } },
    })

    // 5. Seller credit ledger
    await tx.creditLedger.create({
      data: {
        id: randomUUID(),
        walletId: sellerWallet.id,
        userId: order.sellerId,
        type: CreditLedgerType.MARKETPLACE_SELLER_CREDIT,
        delta: sellerAmountCredits,
        frozen: 0,
        balance: sellerWalletAfter.balance,
        amountCredits: sellerAmountCredits,
        refType: 'marketplace_order',
        refId: orderId,
        description: `授权销售收入: ${listing.title ?? order.assetId}`,
      },
    })

    // 6. Upsert LicenseGrant (handles free→paid upgrade via unique constraint)
    const grant = await tx.licenseGrant.upsert({
      where: { listingId_buyerId: { listingId: order.listingId, buyerId } },
      create: {
        id: randomUUID(),
        listingId: order.listingId,
        buyerId,
        sellerId: order.sellerId,
        assetId: order.assetId,
        licenseMode: listing.licenseMode,
        paidCredits: priceCredits,
        status: 'ACTIVE',
        grantedAt: now,
        termsJson: {
          commercialUse: listing.commercialUse,
          derivativeAllowed: listing.derivativeAllowed,
          attributionRequired: listing.attributionRequired,
          settledOrderId: orderId,
        },
      },
      update: {
        paidCredits: priceCredits,
        status: 'ACTIVE',
        grantedAt: now,
        revokedAt: null,
        termsJson: {
          commercialUse: listing.commercialUse,
          derivativeAllowed: listing.derivativeAllowed,
          attributionRequired: listing.attributionRequired,
          settledOrderId: orderId,
        },
      },
    })

    const finalOrder = await tx.marketplaceOrder.findUnique({ where: { id: orderId } })
    return { grant, order: finalOrder }
  })

  return {
    idempotent: false,
    order: result.order,
    grant: result.grant,
    priceCredits,
    platformFeeCredits,
    sellerAmountCredits,
  }
}
