import { db } from '@/lib/db'
import { CreditLedgerType, GenerationJobBillingStatus } from '@prisma/client'
import { getOrCreateWallet } from '@/lib/credits/server'
import { InsufficientCreditsError } from './errors'

export interface ReserveResult {
  jobId: string
  estimatedCredits: number
}

export async function reserveCreditsForJob(params: {
  userId: string
  estimatedCredits: number
  providerId: string
  nodeType: string
  prompt: string
}): Promise<ReserveResult> {
  const { userId, estimatedCredits, providerId, nodeType, prompt } = params
  const wallet = await getOrCreateWallet(userId)

  // wallet.balance is the available balance; frozenBalance is already reserved
  if (wallet.balance < estimatedCredits) {
    throw new InsufficientCreditsError(estimatedCredits, wallet.balance)
  }

  let jobId = ''

  await db.$transaction(async (tx) => {
    const job = await tx.generationJob.create({
      data: {
        userId,
        walletId: wallet.id,
        providerId,
        nodeType,
        prompt: prompt.slice(0, 2000),
        estimatedCost: estimatedCredits,
        billingStatus: GenerationJobBillingStatus.FROZEN,
        frozenAt: new Date(),
      },
    })
    jobId = job.id

    const updated = await tx.userCreditWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: estimatedCredits },
        frozenBalance: { increment: estimatedCredits },
      },
    })

    await tx.creditLedger.create({
      data: {
        walletId: wallet.id,
        userId,
        type: CreditLedgerType.RESERVE,
        delta: -estimatedCredits,
        frozen: estimatedCredits,
        balance: updated.balance,
        amountCredits: estimatedCredits,
        generationJobId: job.id,
        description: `生成预留：${nodeType} · ${providerId}`,
      },
    })
  })

  return { jobId, estimatedCredits }
}
