/**
 * Server-side only — credits operations against Prisma directly.
 * All balance mutations go through $transaction to stay atomic.
 * Never import from client components.
 */

import { db } from '@/lib/db'
import { CreditLedgerType, PaymentOrderStatus } from '@prisma/client'

// ── Wallet ─────────────────────────────────────────────────────

export async function getOrCreateWallet(userId: string) {
  return db.userCreditWallet.upsert({
    where: { userId },
    create: { userId, balance: 0, frozenBalance: 0, totalPurchased: 0, totalConsumed: 0 },
    update: {},
  })
}

export async function getWallet(userId: string) {
  return db.userCreditWallet.findUnique({ where: { userId } })
}

// ── Ledger ─────────────────────────────────────────────────────

export async function getLedger(userId: string, limit = 50, offset = 0) {
  const [items, total] = await db.$transaction([
    db.creditLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.creditLedger.count({ where: { userId } }),
  ])
  return { items, total }
}

// ── Manual recharge request (user side) ───────────────────────

export async function submitManualRechargeRequest(
  userId: string,
  amountCredits: number,
  note?: string,
) {
  if (amountCredits < 1) throw new Error('积分数量必须大于 0')
  const wallet = await getOrCreateWallet(userId)
  return db.paymentOrder.create({
    data: {
      userId,
      walletId: wallet.id,
      provider: 'manual',
      status: PaymentOrderStatus.PENDING,
      credits: amountCredits,
      priceUSD: 0,
      amount: 0,
      rawNotifyJson: note ? { userNote: note } : {},
    },
  })
}

// ── Admin: list manual recharge orders ────────────────────────

export async function listManualOrders(
  status?: 'PENDING' | 'PAID' | 'CANCELLED',
  limit = 50,
  offset = 0,
) {
  const where = {
    provider: 'manual',
    ...(status ? { status: status as PaymentOrderStatus } : {}),
  }
  const [orders, total] = await db.$transaction([
    db.paymentOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.paymentOrder.count({ where }),
  ])

  // Fetch user info separately (no FK relation on PaymentOrder → User)
  const userIds = [...new Set(orders.map((o) => o.userId))]
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, displayName: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  return {
    orders: orders.map((o) => ({
      ...o,
      user: userMap.get(o.userId) ?? null,
    })),
    total,
  }
}

// ── Admin: approve or reject a pending order ──────────────────

export async function approveManualRecharge(
  orderId: string,
  adminUserId: string,
  adminNote?: string,
) {
  const order = await db.paymentOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new Error('订单不存在')
  if (order.provider !== 'manual') throw new Error('不是人工充值订单')
  if (order.status !== PaymentOrderStatus.PENDING) throw new Error('订单状态不是 PENDING')

  const wallet = await getOrCreateWallet(order.userId)

  await db.$transaction(async (tx) => {
    const updated = await tx.userCreditWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: order.credits },
        totalPurchased: { increment: order.credits },
      },
    })

    await tx.creditLedger.create({
      data: {
        walletId: wallet.id,
        userId: order.userId,
        type: CreditLedgerType.ADMIN_ADJUSTMENT,
        delta: order.credits,
        frozen: 0,
        balance: updated.balance,
        amountCredits: order.credits,
        paymentOrderId: orderId,
        description: adminNote ?? '充值申请已通过',
      },
    })

    await tx.paymentOrder.update({
      where: { id: orderId },
      data: {
        status: PaymentOrderStatus.PAID,
        paidAt: new Date(),
        issuedAt: new Date(),
        rawNotifyJson: {
          ...((order.rawNotifyJson as Record<string, unknown>) ?? {}),
          approvedBy: adminUserId,
          approvalNote: adminNote ?? null,
        },
      },
    })
  })
}

export async function rejectManualRecharge(
  orderId: string,
  adminUserId: string,
  adminNote?: string,
) {
  const order = await db.paymentOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new Error('订单不存在')
  if (order.provider !== 'manual') throw new Error('不是人工充值订单')
  if (order.status !== PaymentOrderStatus.PENDING) throw new Error('订单状态不是 PENDING')

  await db.paymentOrder.update({
    where: { id: orderId },
    data: {
      status: PaymentOrderStatus.CANCELLED,
      rawNotifyJson: {
        ...((order.rawNotifyJson as Record<string, unknown>) ?? {}),
        rejectedBy: adminUserId,
        rejectionNote: adminNote ?? null,
      },
    },
  })
}

// ── Admin: direct grant (no order) ────────────────────────────

export async function adminDirectGrant(params: {
  userId: string
  amountCredits: number
  adminUserId: string
  note?: string
}) {
  const { userId, amountCredits, adminUserId, note } = params
  if (amountCredits < 1) throw new Error('积分数量必须大于 0')

  const wallet = await getOrCreateWallet(userId)

  await db.$transaction(async (tx) => {
    const updated = await tx.userCreditWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: amountCredits },
        totalPurchased: { increment: amountCredits },
      },
    })

    await tx.creditLedger.create({
      data: {
        walletId: wallet.id,
        userId,
        type: CreditLedgerType.ADMIN_ADJUSTMENT,
        delta: amountCredits,
        frozen: 0,
        balance: updated.balance,
        amountCredits,
        description: note ?? `管理员直接发放，操作者 ${adminUserId}`,
      },
    })
  })
}
