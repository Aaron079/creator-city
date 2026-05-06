import { CreditLedgerType, PaymentOrderStatus, Prisma } from '@prisma/client'
import { db } from '@/lib/db'

type FulfillChinaPaymentOrderInput = {
  outTradeNo: string
  provider?: string
  paidAt?: Date
  transactionId?: string
  rawNotifyJson?: unknown
  rawPayload?: unknown
  source?: 'alipay_webhook' | 'wechatpay_webhook' | 'sandbox_simulation' | string
}

type FulfillChinaPaymentOrderFailure = {
  success: false
  errorCode: 'ORDER_NOT_FOUND' | 'ORDER_NOT_SETTLEABLE'
  message: string
}

export async function fulfillChinaPaymentOrder(input: FulfillChinaPaymentOrderInput) {
  const order = await db.paymentOrder.findUnique({
    where: { externalOrderId: input.outTradeNo },
  })
  if (!order) {
    return {
      success: false,
      errorCode: 'ORDER_NOT_FOUND',
      message: '支付订单不存在',
    } satisfies FulfillChinaPaymentOrderFailure
  }
  if (order.status === PaymentOrderStatus.PAID) {
    const wallet = await db.userCreditWallet.findUnique({ where: { userId: order.userId } })
    const ledger = await db.creditLedger.findFirst({
      where: { paymentOrderId: order.id, type: CreditLedgerType.PURCHASE },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, idempotent: true, alreadyPaid: true, order, wallet, ledger }
  }
  if (order.status !== PaymentOrderStatus.PENDING) {
    return {
      success: false,
      errorCode: 'ORDER_NOT_SETTLEABLE',
      message: `支付订单状态不可入账：${order.status}`,
    } satisfies FulfillChinaPaymentOrderFailure
  }

  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.paymentOrder.updateMany({
      where: { id: order.id, status: PaymentOrderStatus.PENDING },
      data: {
        status: PaymentOrderStatus.PAID,
        paidAt: input.paidAt ?? new Date(),
        issuedAt: input.paidAt ?? new Date(),
        externalPaymentId: input.transactionId ?? order.externalPaymentId,
        rawNotifyJson: input.rawNotifyJson === undefined && input.rawPayload === undefined && input.source === undefined
          ? undefined
          : {
              ...((order.rawNotifyJson as Record<string, unknown> | null) ?? {}),
              settlementSource: input.source ?? 'payment_webhook',
              settlementPayload: input.rawPayload ?? input.rawNotifyJson ?? null,
            } as Prisma.InputJsonValue,
      },
    })
    if (claimed.count === 0) {
      const latest = await tx.paymentOrder.findUnique({ where: { id: order.id } })
      if (latest?.status === PaymentOrderStatus.PAID) {
        const latestWallet = await tx.userCreditWallet.findUnique({ where: { userId: latest.userId } })
        const latestLedger = await tx.creditLedger.findFirst({
          where: { paymentOrderId: latest.id, type: CreditLedgerType.PURCHASE },
          orderBy: { createdAt: 'desc' },
        })
        return {
          success: true,
          idempotent: true,
          alreadyPaid: true,
          order: latest,
          wallet: latestWallet,
          ledger: latestLedger,
        }
      }
      throw new Error(`支付订单状态不可入账：${latest?.status ?? 'UNKNOWN'}`)
    }

    const wallet = await tx.userCreditWallet.upsert({
      where: { userId: order.userId },
      create: { userId: order.userId, balance: 0, frozenBalance: 0, totalPurchased: 0, totalConsumed: 0 },
      update: {},
    })

    const updatedWallet = await tx.userCreditWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: order.credits },
        totalPurchased: { increment: order.credits },
      },
    })

    const ledger = await tx.creditLedger.create({
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
        description: input.source === 'sandbox_simulation'
          ? '沙箱模拟充值'
          : order.provider === 'alipay'
            ? '支付宝充值'
            : '中国支付渠道充值入账',
      },
    })

    const paidOrder = await tx.paymentOrder.findUniqueOrThrow({ where: { id: order.id } })

    return {
      success: true,
      idempotent: false,
      alreadyPaid: false,
      order: paidOrder,
      wallet: updatedWallet,
      ledger,
    }
  })

  return result
}
