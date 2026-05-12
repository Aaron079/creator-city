import { db } from '@/lib/db'
import { CreditLedgerType, GenerationJobBillingStatus } from '@prisma/client'
import { getOrCreateWallet } from '@/lib/credits/server'
import { InsufficientCreditsError } from './errors'

export interface ReserveResult {
  jobId: string
  estimatedCredits: number
}

function isMissingGenerationJobNodeIdColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /GenerationJob.*nodeId|nodeId.*GenerationJob|column.*nodeId|Unknown arg `nodeId`/i.test(message)
}

export async function reserveCreditsForJob(params: {
  userId: string
  estimatedCredits: number
  providerId: string
  nodeType: string
  prompt: string
  projectId?: string
  nodeId?: string
}): Promise<ReserveResult> {
  const { userId, estimatedCredits, providerId, nodeType, prompt, projectId, nodeId } = params
  const wallet = await getOrCreateWallet(userId)

  // wallet.balance is the available balance; frozenBalance is already reserved
  if (wallet.balance < estimatedCredits) {
    throw new InsufficientCreditsError(estimatedCredits, wallet.balance)
  }

  let jobId = ''

  const reserve = async (includeNodeId: boolean) => {
    await db.$transaction(async (tx) => {
      const job = await tx.generationJob.create({
        data: {
          userId,
          projectId: projectId ?? null,
          ...(includeNodeId ? { nodeId: nodeId ?? null } : {}),
          walletId: wallet.id,
          providerId,
          nodeType,
          prompt: prompt.slice(0, 2000),
          input: {
            projectId: projectId ?? null,
            nodeId: nodeId ?? null,
          },
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
  }

  try {
    await reserve(true)
  } catch (error) {
    if (!isMissingGenerationJobNodeIdColumn(error)) throw error
    await reserve(false)
  }

  return { jobId, estimatedCredits }
}
