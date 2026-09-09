import type {
  SeedanceDeliveryReceipt,
  SeedancePrevisDeliverySegment,
  SeedancePrevisSegmentResult,
} from './receipts'

export type SeedanceSegmentRetryReason = 'failed' | 'missing-media' | 'review-finding'

export type SeedanceSegmentRetry = {
  readonly deliveryId: string
  readonly masterTakeId: string
  readonly segment: SeedancePrevisDeliverySegment
  readonly priorResult?: SeedancePrevisSegmentResult
  readonly reason: SeedanceSegmentRetryReason
  readonly package: {
    readonly segments: readonly SeedancePrevisDeliverySegment[]
    readonly capabilitySnapshot: SeedanceDeliveryReceipt['capabilitySnapshot']
    readonly sourcePackage: SeedanceDeliveryReceipt['package']
  }
}

function resultForSegment(receipt: SeedanceDeliveryReceipt, segmentId: string) {
  return receipt.segmentResults.find((result) => result.segmentId === segmentId)
}

function retryReason(
  result: SeedancePrevisSegmentResult | undefined,
  hasReviewFinding: boolean,
): SeedanceSegmentRetryReason | null {
  if (result?.status === 'failed') return 'failed'
  if (result?.status === 'succeeded' && !result.videoUrl) return 'missing-media'
  return hasReviewFinding ? 'review-finding' : null
}

export function isSegmentRetryEligible(
  receipt: SeedanceDeliveryReceipt,
  segmentId: string,
  hasReviewFinding = false,
) {
  return Boolean(
    receipt.segments.some((segment) => segment.id === segmentId)
    && retryReason(resultForSegment(receipt, segmentId), hasReviewFinding),
  )
}

export function buildSegmentRetry(
  receipt: SeedanceDeliveryReceipt,
  segmentId: string,
  input: { hasReviewFinding?: boolean } = {},
): SeedanceSegmentRetry {
  const segment = receipt.segments.find((item) => item.id === segmentId)
  if (!segment) throw new TypeError('SEEDANCE_PREVIS_SEGMENT_NOT_FOUND')
  const priorResult = resultForSegment(receipt, segmentId)
  const reason = retryReason(priorResult, input.hasReviewFinding === true)
  if (!reason) throw new TypeError('SEGMENT_RETRY_NOT_ELIGIBLE')

  return Object.freeze({
    deliveryId: receipt.deliveryId,
    masterTakeId: receipt.masterTakeId,
    segment: structuredClone(segment),
    ...(priorResult ? { priorResult: structuredClone(priorResult) } : {}),
    reason,
    package: Object.freeze({
      segments: Object.freeze([structuredClone(segment)]),
      capabilitySnapshot: receipt.capabilitySnapshot === null ? null : structuredClone(receipt.capabilitySnapshot),
      sourcePackage: receipt.package === null ? null : structuredClone(receipt.package),
    }),
  })
}
