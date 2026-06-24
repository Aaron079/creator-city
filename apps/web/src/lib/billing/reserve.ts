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

function isMissingGenerationJobBillingRequestIdColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /GenerationJob.*billingRequestId|billingRequestId.*GenerationJob|column.*billingRequestId|Unknown arg `billingRequestId`/i.test(message)
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2002',
  )
}

function reserveLedgerIdempotencyKey(userId: string, billingRequestId?: string) {
  return billingRequestId ? `generation:${userId}:${billingRequestId}:reserve` : undefined
}

function assertSameReservationContext(existing: {
  projectId?: string | null
  nodeId?: string | null
  providerId: string
  nodeType: string
}, params: {
  projectId?: string
  nodeId?: string
  providerId: string
  nodeType: string
}) {
  const mismatch =
    (existing.projectId ?? undefined) !== (params.projectId ?? undefined)
    || (existing.nodeId ?? undefined) !== (params.nodeId ?? undefined)
    || existing.providerId !== params.providerId
    || existing.nodeType !== params.nodeType
  if (mismatch) {
    throw new Error('BILLING_IDEMPOTENCY_CONTEXT_CONFLICT')
  }
}

export async function reserveCreditsForJob(params: {
  userId: string
  estimatedCredits: number
  providerId: string
  nodeType: string
  prompt: string
  projectId?: string
  nodeId?: string
  billingRequestId?: string
  billingRequestSource?: 'header' | 'body' | 'server-derived'
  billingRoute?: string
}): Promise<ReserveResult> {
  const { userId, estimatedCredits, providerId, nodeType, prompt, projectId, nodeId, billingRequestId, billingRequestSource, billingRoute } = params
  const wallet = await getOrCreateWallet(userId)

  let jobId = ''
  let reservedCredits = estimatedCredits

  const existingReservation = async () => {
    if (!billingRequestId) return null
    const existing = await db.generationJob.findFirst({
      where: { userId, billingRequestId },
    })
    if (!existing) return null
    assertSameReservationContext(existing, { projectId, nodeId, providerId, nodeType })
    return existing
  }

  try {
    const existing = await existingReservation()
    if (existing) {
      return { jobId: existing.id, estimatedCredits: existing.estimatedCost }
    }
  } catch (error) {
    if (!isMissingGenerationJobBillingRequestIdColumn(error)) throw error
  }

  const reserve = async (includeNodeId: boolean, includeBillingRequestId: boolean) => {
    await db.$transaction(async (tx) => {
      if (billingRequestId && includeBillingRequestId) {
        const existing = await tx.generationJob.findFirst({
          where: { userId, billingRequestId },
        })
        if (existing) {
          assertSameReservationContext(existing, { projectId, nodeId, providerId, nodeType })
          jobId = existing.id
          reservedCredits = existing.estimatedCost
          return
        }
      }

      const reserved = await tx.userCreditWallet.updateMany({
        where: {
          id: wallet.id,
          balance: { gte: estimatedCredits },
        },
        data: {
          balance: { decrement: estimatedCredits },
          frozenBalance: { increment: estimatedCredits },
        },
      })
      if (reserved.count !== 1) {
        const latest = await tx.userCreditWallet.findUnique({ where: { id: wallet.id } })
        throw new InsufficientCreditsError(estimatedCredits, latest?.balance ?? 0)
      }

      const updated = await tx.userCreditWallet.findUnique({ where: { id: wallet.id } })
      if (!updated) {
        throw new Error('Wallet not found')
      }

      const job = await tx.generationJob.create({
        data: {
          userId,
          projectId: projectId ?? null,
          ...(includeNodeId ? { nodeId: nodeId ?? null } : {}),
          ...(includeBillingRequestId ? { billingRequestId: billingRequestId ?? null } : {}),
          walletId: wallet.id,
          providerId,
          nodeType,
          prompt: prompt.slice(0, 2000),
          input: {
            projectId: projectId ?? null,
            nodeId: nodeId ?? null,
            billingRequestId: billingRequestId ?? null,
            billingRequestSource: billingRequestSource ?? null,
            billingRoute: billingRoute ?? null,
          },
          estimatedCost: estimatedCredits,
          billingStatus: GenerationJobBillingStatus.FROZEN,
          frozenAt: new Date(),
        },
      })
      jobId = job.id

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
          idempotencyKey: reserveLedgerIdempotencyKey(userId, billingRequestId),
          description: `生成预留：${nodeType} · ${providerId}`,
        },
      })
    })
  }

  try {
    await reserve(true, true)
  } catch (error) {
    if (isUniqueConstraintError(error) && billingRequestId) {
      const existing = await existingReservation()
      if (existing) return { jobId: existing.id, estimatedCredits: existing.estimatedCost }
    }
    if (isMissingGenerationJobBillingRequestIdColumn(error)) {
      try {
        await reserve(true, false)
      } catch (fallbackError) {
        if (!isMissingGenerationJobNodeIdColumn(fallbackError)) throw fallbackError
        await reserve(false, false)
      }
    } else if (isMissingGenerationJobNodeIdColumn(error)) {
      try {
        await reserve(false, true)
      } catch (fallbackError) {
        if (!isMissingGenerationJobBillingRequestIdColumn(fallbackError)) throw fallbackError
        await reserve(false, false)
      }
    } else {
      throw error
    }
  }

  return { jobId, estimatedCredits: reservedCredits }
}
