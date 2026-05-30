import { estimateStaticCredits } from '@/lib/credits/shared-cost-rules'

interface EstimateInput {
  nodeType: string
  providerId: string
  params?: Record<string, string | number | boolean | undefined>
}

export function estimateGenerationCredits({ nodeType, providerId, params }: EstimateInput): number {
  // Parse duration string like '10s', '5s' → number
  const durationSeconds =
    typeof params?.duration === 'string' && params.duration.endsWith('s')
      ? parseInt(params.duration, 10)
      : typeof params?.duration === 'number'
        ? params.duration
        : undefined

  const quality =
    typeof params?.quality === 'string' ? params.quality : undefined

  return estimateStaticCredits({ nodeType, providerId, durationSeconds, quality }).credits
}
