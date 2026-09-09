import type {
  SeedancePrevisDelivery,
  SeedancePrevisSegmentReceipt,
} from './deliveryPersistence'
import type { JsonValue } from './package'

type JsonRecord = { readonly [key: string]: JsonValue }

export type SeedancePrevisSegmentStatus = 'queued' | 'submitting' | 'submitted' | 'succeeded' | 'failed'

export type SeedancePrevisDeliverySegment = {
  readonly id: string
  readonly index: number
  readonly startSec: number
  readonly endSec: number
  readonly handoff?: JsonValue
}

export type SeedancePrevisSegmentResult = {
  readonly segmentId: string
  readonly index: number
  readonly status: SeedancePrevisSegmentStatus
  readonly providerTaskId?: string
  readonly providerRequestId?: string
  readonly generationJobId?: string
  readonly videoUrl?: string
  readonly submittedAt?: string
  readonly completedAt?: string
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly observedStartCamera?: JsonValue
}

export type SeedanceDeliveryReceipt = {
  readonly deliveryId: string
  readonly masterTakeId: string
  readonly package: JsonRecord | null
  readonly capabilitySnapshot: JsonRecord | null
  readonly acknowledgements: readonly string[]
  readonly segments: readonly SeedancePrevisDeliverySegment[]
  readonly segmentResults: readonly SeedancePrevisSegmentResult[]
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function segmentFromValue(value: unknown): SeedancePrevisDeliverySegment | null {
  if (!isRecord(value)) return null
  const id = stringValue(value.id)
  const index = finiteNumber(value.index)
  const startSec = finiteNumber(value.startSec)
  const endSec = finiteNumber(value.endSec)
  if (!id || index === null || !Number.isInteger(index) || index < 0 || startSec === null || endSec === null || endSec <= startSec) {
    return null
  }
  return {
    id,
    index,
    startSec,
    endSec,
    ...(value.handoff === undefined ? {} : { handoff: structuredClone(value.handoff) as JsonValue }),
  }
}

function segmentsFromDelivery(delivery: SeedancePrevisDelivery): SeedancePrevisDeliverySegment[] {
  const packageValue = delivery.package
  if (!packageValue) throw new TypeError('INVALID_SEEDANCE_PREVIS_DELIVERY_PACKAGE')
  const chainValue = isRecord(packageValue.chain) ? packageValue.chain : null
  const rawSegments = chainValue?.segments
  if (Array.isArray(rawSegments)) {
    const segments = rawSegments.map(segmentFromValue)
    if (segments.some((segment): segment is null => segment === null)) {
      throw new TypeError('INVALID_SEEDANCE_PREVIS_DELIVERY_SEGMENTS')
    }
    const parsed = segments as SeedancePrevisDeliverySegment[]
    if (!parsed.length || new Set(parsed.map((segment) => segment.id)).size !== parsed.length) {
      throw new TypeError('INVALID_SEEDANCE_PREVIS_DELIVERY_SEGMENTS')
    }
    return parsed.sort((left, right) => left.index - right.index)
  }

  const durationSec = finiteNumber(packageValue.durationSec)
  if (durationSec === null || durationSec <= 0) throw new TypeError('INVALID_SEEDANCE_PREVIS_DELIVERY_SEGMENTS')
  return [{ id: delivery.masterTakeId, index: 0, startSec: 0, endSec: durationSec }]
}

function statusValue(value: unknown): SeedancePrevisSegmentStatus | null {
  return value === 'queued' || value === 'submitting' || value === 'submitted' || value === 'succeeded' || value === 'failed'
    ? value
    : null
}

function optionalJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined
  return structuredClone(value) as JsonValue
}

function resultFromValue(
  value: SeedancePrevisSegmentReceipt | SeedancePrevisSegmentResult,
  segments: readonly SeedancePrevisDeliverySegment[],
): SeedancePrevisSegmentResult {
  const record = value as Record<string, unknown>
  const segmentId = stringValue(record.segmentId)
  const segment = segmentId ? segments.find((item) => item.id === segmentId) : null
  const status = statusValue(record.status)
  if (!segment || !status) throw new TypeError('INVALID_SEEDANCE_PREVIS_SEGMENT_RECEIPT')
  const optional = (key: string) => {
    const valueAtKey = record[key]
    return valueAtKey === undefined ? undefined : stringValue(valueAtKey) ?? undefined
  }
  const result: SeedancePrevisSegmentResult = {
    segmentId: segment.id,
    index: segment.index,
    status,
    ...(optional('providerTaskId') ? { providerTaskId: optional('providerTaskId') } : {}),
    ...(optional('providerRequestId') ? { providerRequestId: optional('providerRequestId') } : {}),
    ...(optional('generationJobId') ? { generationJobId: optional('generationJobId') } : {}),
    ...(optional('videoUrl') ? { videoUrl: optional('videoUrl') } : {}),
    ...(optional('submittedAt') ? { submittedAt: optional('submittedAt') } : {}),
    ...(optional('completedAt') ? { completedAt: optional('completedAt') } : {}),
    ...(optional('errorCode') ? { errorCode: optional('errorCode') } : {}),
    ...(optional('errorMessage') ? { errorMessage: optional('errorMessage') } : {}),
    ...(record.observedStartCamera === undefined ? {} : { observedStartCamera: optionalJsonValue(record.observedStartCamera) }),
  }
  return result
}

function snapshotDelivery(delivery: SeedancePrevisDelivery, segments: readonly SeedancePrevisDeliverySegment[]): SeedanceDeliveryReceipt {
  const results = delivery.segmentResults.map((result) => resultFromValue(result, segments))
  if (new Set(results.map((result) => result.segmentId)).size !== results.length) {
    throw new TypeError('DUPLICATE_SEEDANCE_PREVIS_SEGMENT_RECEIPT')
  }
  return deepFreeze({
    deliveryId: delivery.deliveryId,
    masterTakeId: delivery.masterTakeId,
    package: delivery.package === null ? null : structuredClone(delivery.package),
    capabilitySnapshot: delivery.capabilitySnapshot === null ? null : structuredClone(delivery.capabilitySnapshot),
    acknowledgements: [...delivery.acknowledgements],
    segments: segments.map((segment) => structuredClone(segment)),
    segmentResults: results.map((result) => structuredClone(result)),
  })
}

export function receiptFromDelivery(delivery: SeedancePrevisDelivery): SeedanceDeliveryReceipt {
  return snapshotDelivery(delivery, segmentsFromDelivery(delivery))
}

export function recordSegmentResult(
  receipt: SeedanceDeliveryReceipt,
  input: Omit<SeedancePrevisSegmentResult, 'index'>,
): SeedanceDeliveryReceipt {
  const segment = receipt.segments.find((item) => item.id === input.segmentId)
  if (!segment) throw new TypeError('SEEDANCE_PREVIS_SEGMENT_NOT_FOUND')
  const nextResult = resultFromValue({ ...input, index: segment.index }, receipt.segments)
  const nextResults = receipt.segmentResults.some((result) => result.segmentId === segment.id)
    ? receipt.segmentResults.map((result) => result.segmentId === segment.id ? nextResult : result)
    : [...receipt.segmentResults, nextResult]
  return deepFreeze({
    ...receipt,
    package: receipt.package === null ? null : structuredClone(receipt.package),
    capabilitySnapshot: receipt.capabilitySnapshot === null ? null : structuredClone(receipt.capabilitySnapshot),
    acknowledgements: [...receipt.acknowledgements],
    segments: receipt.segments.map((item) => structuredClone(item)),
    segmentResults: nextResults.map((result) => structuredClone(result)).sort((left, right) => left.index - right.index),
  })
}
