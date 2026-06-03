/**
 * Phase S1: Platform usage logging.
 * Records generation attempts (BYOK and platform_credits) without billing changes.
 * NEVER logs: prompt text, API keys, encryptedApiKey, encryptedFields, Authorization headers.
 * Write failures are silenced — usage logging must never break the generation chain.
 */

import { db } from '@/lib/db'

export interface UsageLogInput {
  userId: string
  projectId?: string | null
  workflowId?: string | null
  nodeId?: string | null
  /** Reference to GenerationJob.id — used for deduplication on async jobs. */
  generationJobId?: string | null
  providerId: string
  modelId?: string | null
  outputType: 'text' | 'image' | 'video'
  billingMode: 'platform_credits' | 'user_provider_account'
  /** UserProviderAccount.id only — never contains an API key. */
  providerAccountId?: string | null
  assetId?: string | null
  status: 'succeeded' | 'failed' | 'canceled'
  providerCostPaidBy: 'platform' | 'user'
  /** Phase S1: always 0 — service fee collection starts in Phase S5. */
  platformServiceFeeCredits?: number
  /** Length of the prompt in characters — never the prompt itself. */
  promptChars?: number
  durationSeconds?: number | null
  errorCode?: string | null
}

/**
 * Write one UsageLog row.
 * For async image jobs that share a generationJobId: deduplicates so the status
 * route can call this on every poll without creating duplicate rows.
 */
export async function recordUsageLog(input: UsageLogInput): Promise<void> {
  if (input.generationJobId) {
    const existing = await db.usageLog.findFirst({
      where: { generationJobId: input.generationJobId },
      select: { id: true },
    })
    if (existing) return
  }

  await db.usageLog.create({
    data: {
      userId: input.userId,
      projectId: input.projectId ?? null,
      workflowId: input.workflowId ?? null,
      nodeId: input.nodeId ?? null,
      generationJobId: input.generationJobId ?? null,
      providerId: input.providerId,
      modelId: input.modelId ?? null,
      outputType: input.outputType,
      billingMode: input.billingMode,
      providerAccountId: input.providerAccountId ?? null,
      assetId: input.assetId ?? null,
      status: input.status,
      providerCostPaidBy: input.providerCostPaidBy,
      platformServiceFeeCredits: input.platformServiceFeeCredits ?? 0,
      promptChars: input.promptChars ?? 0,
      durationSeconds: input.durationSeconds ?? null,
      errorCode: input.errorCode ?? null,
    },
  })
}

/**
 * Fire-and-forget wrapper: catches all errors, logs only non-sensitive fields.
 * Use this in generate routes so a DB write failure never surfaces to the user.
 */
export async function safeRecordUsageLog(
  input: UsageLogInput,
  context: { route: string },
): Promise<void> {
  try {
    await recordUsageLog(input)
  } catch (err) {
    console.error('[usage-log] failed to record usage', {
      route: context.route,
      billingMode: input.billingMode,
      outputType: input.outputType,
      userId: input.userId,
      generationJobId: input.generationJobId ?? null,
      errorCode: input.errorCode ?? null,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
