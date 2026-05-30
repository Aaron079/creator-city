/**
 * Shared credit cost rules — single source of truth for both server-side
 * billing (estimate.ts) and client-side display (cost-rules.ts).
 *
 * Rules match the server-side billing truth. ProviderPricingRule DB table
 * will replace this when activated in Phase 3A.
 *
 * Safe to import from both client and server code (no server-only deps).
 */

export type CreditNodeType = 'text' | 'image' | 'video' | 'audio' | 'music'

export type CreditEstimateInput = {
  nodeType: CreditNodeType | string
  providerId?: string
  modelId?: string
  durationSeconds?: number
  quality?: string
}

export type CreditEstimateResult = {
  credits: number
  unitLabel: string
  reason: string
}

// Providers whose video output is treated as HQ (higher credit cost)
export const HQ_VIDEO_PROVIDERS = new Set([
  'runway',
  'sora',
  'kling-pro',
  'pika-pro',
])

// Providers with known per-call overrides that don't map cleanly to node-type
// defaults (e.g. audio providers with a fixed default duration)
const PROVIDER_CALL_OVERRIDES: Record<string, number> = {
  elevenlabs: 30,
  udio: 40,
  suno: 40,
}

export function estimateStaticCredits(input: CreditEstimateInput): CreditEstimateResult {
  const { nodeType, providerId = '', durationSeconds, quality } = input

  // Provider-level override (audio/music providers with fixed default durations)
  if (providerId in PROVIDER_CALL_OVERRIDES) {
    const credits = PROVIDER_CALL_OVERRIDES[providerId]!
    return { credits, unitLabel: `${credits} credits`, reason: `${providerId} default` }
  }

  switch (nodeType) {
    case 'text':
      return { credits: 5, unitLabel: '5 credits', reason: 'text generation' }

    case 'image':
      return { credits: 20, unitLabel: '20 credits', reason: 'image generation' }

    case 'video': {
      const isHQ =
        HQ_VIDEO_PROVIDERS.has(providerId) ||
        providerId.includes('pro') ||
        quality === 'high' ||
        quality === '4k'
      // 10s if explicitly passed or duration > 7s
      const is10s =
        durationSeconds === 10 ||
        (durationSeconds != null && durationSeconds > 7)
      if (isHQ) {
        const credits = is10s ? 600 : 300
        return {
          credits,
          unitLabel: `${credits} credits`,
          reason: `HQ video ${is10s ? '10s' : '5s'}`,
        }
      }
      const credits = is10s ? 240 : 120
      return {
        credits,
        unitLabel: `${credits} credits`,
        reason: `standard video ${is10s ? '10s' : '5s'}`,
      }
    }

    case 'audio':
    case 'music': {
      const secs = durationSeconds ?? 60
      const mins = Math.max(1, Math.ceil(secs / 60))
      const credits = mins * 20
      return {
        credits,
        unitLabel: `${credits} credits`,
        reason: `${mins} min audio`,
      }
    }

    default:
      return { credits: 5, unitLabel: '5 credits', reason: 'default' }
  }
}
