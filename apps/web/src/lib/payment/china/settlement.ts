import { CreditLedgerType, PaymentOrderStatus, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getOrCreateWallet } from '@/lib/credits/server'

export async function fulfillChinaPaymentOrder(input: {
  outTradeNo: string
  transactionId?: string
  rawNotifyJson?: unknown
}) {
  const order = await db.paymentOrder.findUnique({
    where: { externalOrderId: input.outTradeNo },
  })
  if (!order) throw new Error('支付订单不存在')
  if (order.status === PaymentOrderStatus.PAID) {
    return { order, alreadyPaid: true }
  }
  if (order.status !== PaymentOrderStatus.PENDING) {
    throw new Error(`支付订单状态不可入账：${order.status}`)
  }

  const wallet = await getOrCreateWallet(order.userId)
  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.paymentOrder.updateMany({
      where: { id: order.id, status: PaymentOrderStatus.PENDING },
      data: {
        status: PaymentOrderStatus.PAID,
        paidAt: new Date(),
        issuedAt: new Date(),
        externalPaymentId: input.transactionId ?? order.externalPaymentId,
        rawNotifyJson: input.rawNotifyJson === undefined
          ? undefined
          : input.rawNotifyJson as Prisma.InputJsonValue,
      },
    })
    if (claimed.count === 0) {
      const latest = await tx.paymentOrder.findUnique({ where: { id: order.id } })
      if (latest?.status === PaymentOrderStatus.PAID) return { order: latest, alreadyPaid: true }
      throw new Error(`支付订单状态不可入账：${latest?.status ?? 'UNKNOWN'}`)
    }

    const updatedWallet = await tx.userCreditWallet.update({
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
        type: CreditLedgerType.PURCHASE,
        delta: order.credits,
        frozen: 0,
        balance: updatedWallet.balance,
        amountCredits: order.credits,
        paymentOrderId: order.id,
        refType: 'payment_order',
        refId: order.id,
        description: '中国支付渠道充值入账',
      },
    })

    const paidOrder = await tx.paymentOrder.findUniqueOrThrow({ where: { id: order.id } })

    return { order: paidOrder, alreadyPaid: false }
  })

  return result
}
