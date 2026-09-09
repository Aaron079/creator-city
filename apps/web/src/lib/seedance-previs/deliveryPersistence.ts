import type { JsonValue } from './package'

type JsonRecord = { readonly [key: string]: JsonValue }

export const SEEDANCE_PREVIS_DELIVERIES_VERSION = 1 as const

export type SeedancePrevisSegmentReceipt = JsonRecord & {
  readonly segmentId: string
}

export type SeedancePrevisDelivery = {
  readonly deliveryId: string
  readonly masterTakeId: string
  readonly package: JsonRecord | null
  readonly capabilitySnapshot: JsonRecord | null
  readonly acknowledgements: readonly string[]
  readonly segmentResults: readonly SeedancePrevisSegmentReceipt[]
}

export type SeedancePrevisDeliveryInput = {
  readonly deliveryId: string
  readonly masterTakeId: string
  readonly package?: JsonRecord
  readonly capabilitySnapshot?: JsonRecord
  readonly acknowledgements?: readonly string[]
  readonly segmentResults?: readonly SeedancePrevisSegmentReceipt[]
}

export type SeedancePrevisDeliveries = {
  readonly version: typeof SEEDANCE_PREVIS_DELIVERIES_VERSION
  readonly items: readonly SeedancePrevisDelivery[]
}

const DELIVERY_METADATA_KEY = 'seedancePrevisDeliveries'
const DELIVERY_CONTAINER_KEYS = ['version', 'items'] as const
const DELIVERY_KEYS = [
  'deliveryId',
  'masterTakeId',
  'package',
  'capabilitySnapshot',
  'acknowledgements',
  'segmentResults',
] as const

function isPlainRecord(value: unknown): value is JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false

  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== 'string') return false
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return descriptor?.enumerable === true && 'value' in descriptor
  })
}

function isJsonValue(value: unknown, ancestors = new WeakSet<object>()): value is JsonValue {
  try {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return true
    if (typeof value === 'number') return Number.isFinite(value)
    if (typeof value !== 'object' || ancestors.has(value)) return false

    ancestors.add(value)
    if (Array.isArray(value)) {
      if (Reflect.ownKeys(value).length !== value.length + 1) return false
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (descriptor?.enumerable !== true || !('value' in descriptor) || !isJsonValue(descriptor.value, ancestors)) {
          return false
        }
      }
      ancestors.delete(value)
      return true
    }

    if (!isPlainRecord(value)) return false
    for (const key of Object.keys(value)) {
      if (!isJsonValue(value[key], ancestors)) return false
    }
    ancestors.delete(value)
    return true
  } catch {
    return false
  }
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return isPlainRecord(value) && isJsonValue(value)
}

function cloneJsonValue(value: JsonValue): JsonValue {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => cloneJsonValue(item))
  const record = value as JsonRecord
  return Object.fromEntries(Object.keys(record).map((key) => [key, cloneJsonValue(record[key]!)]))
}

function cloneRecord(value: JsonRecord): JsonRecord {
  return cloneJsonValue(value) as JsonRecord
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function hasExactKeys(value: JsonRecord, expected: readonly string[]) {
  const keys = Object.keys(value)
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key))
}

function acknowledgements(value: unknown): string[] | null {
  if (!Array.isArray(value) || !isJsonValue(value)) return null
  if (!value.every(isIdentifier) || new Set(value).size !== value.length) return null
  return [...value]
}

function segmentResults(value: unknown): SeedancePrevisSegmentReceipt[] | null {
  if (!Array.isArray(value) || !isJsonValue(value)) return null
  const results: SeedancePrevisSegmentReceipt[] = []
  for (const item of value) {
    if (!isJsonRecord(item) || !isIdentifier(item.segmentId)) return null
    results.push(cloneRecord(item) as SeedancePrevisSegmentReceipt)
  }
  return new Set(results.map((item) => item.segmentId)).size === results.length ? results : null
}

function delivery(value: unknown): SeedancePrevisDelivery | null {
  if (!isJsonRecord(value) || !hasExactKeys(value, DELIVERY_KEYS)) return null
  if (!isIdentifier(value.deliveryId) || !isIdentifier(value.masterTakeId)) return null
  if (value.package !== null && !isJsonRecord(value.package)) return null
  if (value.capabilitySnapshot !== null && !isJsonRecord(value.capabilitySnapshot)) return null

  const accepted = acknowledgements(value.acknowledgements)
  const receipts = segmentResults(value.segmentResults)
  if (!accepted || !receipts) return null

  return {
    deliveryId: value.deliveryId,
    masterTakeId: value.masterTakeId,
    package: value.package === null ? null : cloneRecord(value.package),
    capabilitySnapshot: value.capabilitySnapshot === null ? null : cloneRecord(value.capabilitySnapshot),
    acknowledgements: accepted,
    segmentResults: receipts,
  }
}

function deliveryInput(value: SeedancePrevisDeliveryInput): SeedancePrevisDelivery | null {
  return delivery({
    deliveryId: value.deliveryId,
    masterTakeId: value.masterTakeId,
    package: value.package ?? null,
    capabilitySnapshot: value.capabilitySnapshot ?? null,
    acknowledgements: value.acknowledgements ?? [],
    segmentResults: value.segmentResults ?? [],
  })
}

export function parseSeedancePrevisDeliveries(metadata: unknown): SeedancePrevisDeliveries | null {
  try {
    if (!isPlainRecord(metadata)) return null
    const value = metadata[DELIVERY_METADATA_KEY]
    if (
      !isJsonRecord(value)
      || !hasExactKeys(value, DELIVERY_CONTAINER_KEYS)
      || value.version !== SEEDANCE_PREVIS_DELIVERIES_VERSION
      || !Array.isArray(value.items)
    ) {
      return null
    }

    const items = value.items.map(delivery)
    if (items.some((item): item is null => item === null)) return null
    const parsedItems = items as SeedancePrevisDelivery[]
    if (new Set(parsedItems.map((item) => item.deliveryId)).size !== parsedItems.length) return null

    return {
      version: SEEDANCE_PREVIS_DELIVERIES_VERSION,
      items: parsedItems,
    }
  } catch {
    return null
  }
}

export function appendSeedancePrevisDeliveryMetadata(
  existingMetadata: unknown,
  input: SeedancePrevisDeliveryInput,
): Record<string, JsonValue> {
  const metadata = existingMetadata === null || existingMetadata === undefined
    ? {}
    : existingMetadata
  if (!isJsonRecord(metadata)) throw new TypeError('INVALID_SEEDANCE_PREVIS_DELIVERY_METADATA')

  const nextDelivery = deliveryInput(input)
  if (!nextDelivery) throw new TypeError('INVALID_SEEDANCE_PREVIS_DELIVERY')

  const hasExistingDeliveries = Object.hasOwn(metadata, DELIVERY_METADATA_KEY)
  const existingDeliveries = hasExistingDeliveries
    ? parseSeedancePrevisDeliveries(metadata)
    : { version: SEEDANCE_PREVIS_DELIVERIES_VERSION, items: [] }
  if (!existingDeliveries) throw new TypeError('INVALID_SEEDANCE_PREVIS_DELIVERY_METADATA')
  if (existingDeliveries.items.some((item) => item.deliveryId === nextDelivery.deliveryId)) {
    throw new TypeError('DUPLICATE_SEEDANCE_PREVIS_DELIVERY')
  }

  return {
    ...metadata,
    [DELIVERY_METADATA_KEY]: {
      version: SEEDANCE_PREVIS_DELIVERIES_VERSION,
      items: [...existingDeliveries.items, nextDelivery],
    },
  }
}
