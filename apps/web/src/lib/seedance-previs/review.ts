import type { JsonValue } from './package'
import type {
  SeedanceDeliveryReceipt,
  SeedancePrevisDeliverySegment,
  SeedancePrevisSegmentResult,
} from './receipts'

export type SeedanceReviewTimelineItem = {
  readonly segmentId: string
  readonly index: number
  readonly startSec: number
  readonly endSec: number
  readonly status: SeedancePrevisSegmentResult['status']
  readonly videoUrl?: string
}

export type SeedanceReviewTimeline = {
  readonly deliveryId: string
  readonly masterTakeId: string
  readonly durationSec: number
  readonly items: readonly SeedanceReviewTimelineItem[]
}

export type SeedanceReviewFinding = {
  readonly code: 'CAMERA_HANDOFF_DRIFT' | 'SEGMENT_FAILED' | 'SEGMENT_MEDIA_MISSING'
  readonly segmentId: string
  readonly timeSec: number
  readonly constraint: 'camera-handoff' | 'segment-media' | 'segment-status'
  readonly message: string
  readonly recommendedAction: string
}

type Vec3 = { x: number; y: number; z: number }

function resultForSegment(receipt: SeedanceDeliveryReceipt, segmentId: string): SeedancePrevisSegmentResult {
  return receipt.segmentResults.find((result) => result.segmentId === segmentId) ?? {
    segmentId,
    index: receipt.segments.find((segment) => segment.id === segmentId)?.index ?? 0,
    status: 'queued',
  }
}

function isRecord(value: JsonValue | undefined): value is { readonly [key: string]: JsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function vec3From(value: JsonValue | undefined): Vec3 | null {
  if (!isRecord(value)) return null
  const x = value.x
  const y = value.y
  const z = value.z
  return typeof x === 'number' && Number.isFinite(x)
    && typeof y === 'number' && Number.isFinite(y)
    && typeof z === 'number' && Number.isFinite(z)
    ? { x, y, z }
    : null
}

function expectedHandoffPosition(segment: SeedancePrevisDeliverySegment): Vec3 | null {
  if (!isRecord(segment.handoff)) return null
  const composition = segment.handoff.nextFirstComposition
  if (!isRecord(composition)) return null
  const camera = composition.camera
  return isRecord(camera) ? vec3From(camera.position) : null
}

function observedStartPosition(result: SeedancePrevisSegmentResult): Vec3 | null {
  if (!isRecord(result.observedStartCamera)) return null
  return vec3From(result.observedStartCamera.position)
}

function distance(left: Vec3, right: Vec3) {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
}

export function assembleReviewTimeline(receipt: SeedanceDeliveryReceipt): SeedanceReviewTimeline {
  const items = receipt.segments
    .map((segment) => {
      const result = resultForSegment(receipt, segment.id)
      return {
        segmentId: segment.id,
        index: segment.index,
        startSec: segment.startSec,
        endSec: segment.endSec,
        status: result.status,
        ...(result.videoUrl ? { videoUrl: result.videoUrl } : {}),
      }
    })
    .sort((left, right) => left.index - right.index)
  return {
    deliveryId: receipt.deliveryId,
    masterTakeId: receipt.masterTakeId,
    durationSec: items.reduce((duration, item) => Math.max(duration, item.endSec), 0),
    items,
  }
}

export function compareChainBoundaries(
  receipt: SeedanceDeliveryReceipt,
  toleranceMeters = 0.5,
): readonly SeedanceReviewFinding[] {
  const findings: SeedanceReviewFinding[] = []
  for (const segment of receipt.segments) {
    const result = resultForSegment(receipt, segment.id)
    if (result.status === 'failed') {
      findings.push({
        code: 'SEGMENT_FAILED',
        segmentId: segment.id,
        timeSec: segment.startSec,
        constraint: 'segment-status',
        message: `片段 ${segment.index + 1} 生成失败。`,
        recommendedAction: '仅重新生成此段。',
      })
      continue
    }
    if (result.status === 'succeeded' && !result.videoUrl) {
      findings.push({
        code: 'SEGMENT_MEDIA_MISSING',
        segmentId: segment.id,
        timeSec: segment.startSec,
        constraint: 'segment-media',
        message: `片段 ${segment.index + 1} 没有可回看的媒体结果。`,
        recommendedAction: '仅重新生成此段。',
      })
      continue
    }
    const expected = expectedHandoffPosition(segment)
    const observed = observedStartPosition(result)
    if (expected && observed && distance(expected, observed) > toleranceMeters) {
      findings.push({
        code: 'CAMERA_HANDOFF_DRIFT',
        segmentId: segment.id,
        timeSec: segment.startSec,
        constraint: 'camera-handoff',
        message: `片段 ${segment.index + 1} 的起始摄影机位置偏离已确认交接点。`,
        recommendedAction: '确认后仅重新生成此段。',
      })
    }
  }
  return findings
}
