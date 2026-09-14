// Provider Gateway — records upstream cost to ProviderCostLedger and keeps ProviderAccount monthly totals in sync.
import { db } from '@/lib/db'
import { getGatewayPricing } from './pricing'

export interface RecordCostOptions {
  userId?: string
  generationJobId?: string
  providerId: string
  model?: string
  nodeType: string
  /** Legacy input accepted for compatibility; new generations never charge credits. */
  creditsCharged?: number
}

/** Writes one ProviderCostLedger row and bumps ProviderAccount.currentMonthCostUsd. */
export async function recordProviderCost(opts: RecordCostOptions): Promise<void> {
  const pricing = getGatewayPricing(opts.providerId, opts.nodeType)
  const costUsd = pricing.estimatedCostUsd

  const yearMonth = new Date().toISOString().slice(0, 7) // e.g. "2026-05"

  await db.$transaction([
    db.providerCostLedger.create({
      data: {
        userId: opts.userId,
        generationJobId: opts.generationJobId,
        providerId: opts.providerId,
        model: opts.model,
        jobType: opts.nodeType,
        providerCostUsd: costUsd,
        userChargedCredits: 0,
      },
    }),
    db.providerAccount.upsert({
      where: { providerId: opts.providerId },
      create: {
        providerId: opts.providerId,
        displayName: opts.providerId,
        currentMonthCostUsd: costUsd,
        budgetMonth: yearMonth,
        lastCheckedAt: new Date(),
      },
      update: {
        currentMonthCostUsd: {
          increment: yearMonth === undefined ? 0 : costUsd,
        },
        budgetMonth: yearMonth,
        lastCheckedAt: new Date(),
      },
    }),
  ])
}
