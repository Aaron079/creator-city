import { db } from '@/lib/db'
import { CreditLedgerType, GenerationJobBillingStatus } from '@prisma/client'

export async function settleJobCredits(jobId: string, actualCredits?: number): Promise<void> {
  const job = await db.generationJob.findUnique({ where: { id: jobId } })
  if (!job?.walletId) return
  if (job.billingStatus === GenerationJobBillingStatus.SETTLED) return

  const consumed = actualCredits ?? job.estimatedCost
  // If the actual cost is less than estimated, return the difference to available balance
  const overage = job.estimatedCost - consumed

  await db.$transaction(async (tx) => {
    const updated = await tx.userCreditWallet.update({
      where: { id: job.walletId! },
      data: {
        frozenBalance: { decrement: job.estimatedCost },
        ...(overage > 0 ? { balance: { increment: overage } } : {}),
        totalConsumed: { increment: consumed },
      },
    })

    await tx.creditLedger.create({
      data: {
        walletId: job.walletId!,
        userId: job.userId,
        type: CreditLedgerType.SETTLE,
        delta: overage > 0 ? overage : 0,
        frozen: -job.estimatedCost,
        balance: updated.balance,
        amountCredits: consumed,
        generationJobId: jobId,
        description: `生成结算：${job.nodeType} · ${job.providerId}`,
      },
    })

    await tx.generationJob.update({
      where: { id: jobId },
      data: {
        actualCost: consumed,
        billingStatus: GenerationJobBillingStatus.SETTLED,
        settledAt: new Date(),
      },
    })
  })
}

export async function releaseJobCredits(jobId: string): Promise<void> {
  const job = await db.generationJob.findUnique({ where: { id: jobId } })
  if (!job?.walletId) return
  if (job.billingStatus !== GenerationJobBillingStatus.FROZEN) return

  await db.$transaction(async (tx) => {
    const updated = await tx.userCreditWallet.update({
      where: { id: job.walletId! },
      data: {
        balance: { increment: job.estimatedCost },
        frozenBalance: { decrement: job.estimatedCost },
      },
    })

    await tx.creditLedger.create({
      data: {
        walletId: job.walletId!,
        userId: job.userId,
        type: CreditLedgerType.RELEASE,
        delta: job.estimatedCost,
        frozen: -job.estimatedCost,
        balance: updated.balance,
        amountCredits: job.estimatedCost,
        generationJobId: jobId,
        description: `积分释放（生成失败）：${job.nodeType} · ${job.providerId}`,
      },
    })

    await tx.generationJob.update({
      where: { id: jobId },
      data: { billingStatus: GenerationJobBillingStatus.REFUNDED },
    })
  })
}
