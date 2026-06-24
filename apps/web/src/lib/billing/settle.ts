import { db } from '@/lib/db'
import { CreditLedgerType, GenerationJobBillingStatus } from '@prisma/client'

function settleLedgerIdempotencyKey(jobId: string, billingRequestId?: string | null) {
  return billingRequestId ? `generation:${jobId}:settle` : undefined
}

function releaseLedgerIdempotencyKey(jobId: string, billingRequestId?: string | null) {
  return billingRequestId ? `generation:${jobId}:release` : undefined
}

export async function settleJobCredits(jobId: string, actualCredits?: number): Promise<void> {
  const job = await db.generationJob.findUnique({ where: { id: jobId } })
  if (!job?.walletId) return
  if (job.billingStatus !== GenerationJobBillingStatus.FROZEN) return

  const consumed = actualCredits ?? job.estimatedCost
  // If the actual cost is less than estimated, return the difference to available balance
  const overage = job.estimatedCost - consumed

  await db.$transaction(async (tx) => {
    const claimed = await tx.generationJob.updateMany({
      where: { id: jobId, billingStatus: GenerationJobBillingStatus.FROZEN },
      data: {
        actualCost: consumed,
        billingStatus: GenerationJobBillingStatus.SETTLED,
        settledAt: new Date(),
      },
    })
    if (claimed.count !== 1) return

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
        idempotencyKey: settleLedgerIdempotencyKey(jobId, job.billingRequestId),
        description: `生成结算：${job.nodeType} · ${job.providerId}`,
      },
    })
  })
}

export async function releaseJobCredits(jobId: string): Promise<void> {
  const job = await db.generationJob.findUnique({ where: { id: jobId } })
  if (!job?.walletId) return
  if (job.billingStatus !== GenerationJobBillingStatus.FROZEN) return

  await db.$transaction(async (tx) => {
    const claimed = await tx.generationJob.updateMany({
      where: { id: jobId, billingStatus: GenerationJobBillingStatus.FROZEN },
      data: { billingStatus: GenerationJobBillingStatus.REFUNDED },
    })
    if (claimed.count !== 1) return

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
        idempotencyKey: releaseLedgerIdempotencyKey(jobId, job.billingRequestId),
        description: `积分释放（生成失败）：${job.nodeType} · ${job.providerId}`,
      },
    })
  })
}
