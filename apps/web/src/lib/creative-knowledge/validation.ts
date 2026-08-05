import {
  CREATIVE_KNOWLEDGE_ALLOWED_USES,
  CREATIVE_KNOWLEDGE_DOMAINS,
  CREATIVE_KNOWLEDGE_KINDS,
  CREATIVE_KNOWLEDGE_LICENSE_STATUSES,
  CREATIVE_KNOWLEDGE_REVIEW_STATUSES,
  CREATIVE_KNOWLEDGE_SOURCE_TYPES,
  type CreativeKnowledgeAllowedUse,
  type CreativeKnowledgePack,
  type CreativeKnowledgeRecord,
} from './types'

const RECORD_FIELDS = [
  'knowledgeId',
  'schemaVersion',
  'domain',
  'kind',
  'title',
  'content',
  'evidence',
  'provenance',
  'review',
  'revision',
  'contentHash',
] as const

const EVIDENCE_FIELDS = ['sourceRef', 'excerpt', 'locator'] as const
const PROVENANCE_FIELDS = [
  'sourceType',
  'sourceId',
  'collectedAt',
  'licenseStatus',
  'allowedUses',
] as const
const REVIEW_FIELDS = ['status', 'reviewedAt', 'reviewerId'] as const
const PACK_FIELDS = ['packId', 'revision', 'records'] as const

interface JsonObject {
  readonly [key: string]: JsonValue
}

type JsonValue =
  | null
  | string
  | boolean
  | number
  | ReadonlyArray<JsonValue>
  | JsonObject

function fail(message: string): never {
  throw new TypeError(message)
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertPlainObject(value: unknown, field: string): asserts value is object {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !isPlainObject(value)) {
    fail(`${field} must be a plain object`)
  }
}

function assertExactKeys(
  value: object,
  fields: readonly string[],
  field: string,
  optionalFields: readonly string[] = [],
) {
  const keys = Reflect.ownKeys(value)
  for (const key of keys) {
    if (typeof key !== 'string' || !fields.includes(key)) {
      fail(`${field} must not contain unknown or symbol keys`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      fail(`${field}.${key} must be an own enumerable data property`)
    }
  }

  for (const key of fields) {
    if (optionalFields.includes(key)) continue
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail(`${field}.${key} is required`)
    }
  }
}

function ownDataValue(value: object, key: string, field: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
    fail(`${field} must be an own enumerable data property`)
  }
  return descriptor.value
}

function cloneDenseArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`)

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length')
  if (!lengthDescriptor || !('value' in lengthDescriptor)) {
    fail(`${field}.length must be an own data property`)
  }
  const length = lengthDescriptor.value
  if (!Number.isSafeInteger(length) || length < 0) fail(`${field}.length must be valid`)

  const keys = Reflect.ownKeys(value)
  if (keys.length !== length + 1) fail(`${field} must be a dense array without extra properties`)

  const result = new Array<unknown>(length)
  for (let index = 0; index < length; index += 1) {
    result[index] = ownDataValue(value, String(index), `${field}[${index}]`)
  }
  return result
}

function requiredTrimmedString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.length || value !== value.trim()) {
    fail(`${field} must be a trimmed non-empty string`)
  }
  return value
}

function optionalString(value: unknown, field: string): string {
  if (typeof value !== 'string') fail(`${field} must be a string`)
  return value
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    fail(`${field} must be a supported value`)
  }
  return value as T
}

function validDate(value: unknown, field: string): string {
  const date = requiredTrimmedString(value, field)
  if (Number.isNaN(Date.parse(date))) fail(`${field} must be a valid date`)
  return date
}

function freeze<T>(value: T): T {
  return Object.freeze(value)
}

function cloneJson(value: unknown, ancestors: WeakSet<object>, field: string): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${field} must contain only finite numbers`)
    return value
  }
  if (!value || typeof value !== 'object') fail(`${field} must contain only JSON-compatible values`)
  if (ancestors.has(value)) fail(`${field} must not contain cycles`)

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const items = cloneDenseArray(value, field)
      const result = items.map((item, index) => cloneJson(item, ancestors, `${field}[${index}]`))
      return freeze(result)
    }

    if (!isPlainObject(value)) fail(`${field} must contain only plain objects`)
    const result: Record<string, JsonValue> = {}
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') fail(`${field} must not contain symbol keys`)
      const item = ownDataValue(value, key, `${field}.${key}`)
      Object.defineProperty(result, key, {
        value: cloneJson(item, ancestors, `${field}.${key}`),
        enumerable: true,
        configurable: false,
        writable: false,
      })
    }
    return freeze(result)
  } finally {
    ancestors.delete(value)
  }
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function cloneJsonRecord(value: unknown, field: string): JsonObject {
  const cloned = cloneJson(value, new WeakSet<object>(), field)
  if (!isJsonObject(cloned)) {
    fail(`${field} must be a plain object`)
  }
  return cloned
}

function cloneAllowedUses(value: unknown): ReadonlyArray<CreativeKnowledgeAllowedUse> {
  const items = cloneDenseArray(value, 'provenance.allowedUses')
  if (!items.length) fail('provenance.allowedUses must not be empty')

  const seen = new Set<CreativeKnowledgeAllowedUse>()
  const result = new Array<CreativeKnowledgeAllowedUse>(items.length)
  for (let index = 0; index < items.length; index += 1) {
    const allowedUse = enumValue(
      items[index],
      CREATIVE_KNOWLEDGE_ALLOWED_USES,
      `provenance.allowedUses[${index}]`,
    )
    if (seen.has(allowedUse)) fail('provenance.allowedUses must not contain duplicates')
    seen.add(allowedUse)
    result[index] = allowedUse
  }
  return freeze(result)
}

function cloneEvidence(value: unknown): CreativeKnowledgeRecord['evidence'] {
  const items = cloneDenseArray(value, 'evidence')
  const result = new Array<CreativeKnowledgeRecord['evidence'][number]>(items.length)
  for (let index = 0; index < items.length; index += 1) {
    const field = `evidence[${index}]`
    const evidenceValue = items[index]
    assertPlainObject(evidenceValue, field)
    const evidence = evidenceValue
    assertExactKeys(evidence, EVIDENCE_FIELDS, field, ['excerpt', 'locator'])
    const sourceRef = requiredTrimmedString(ownDataValue(evidence, 'sourceRef', `${field}.sourceRef`), `${field}.sourceRef`)
    const excerpt = Object.prototype.hasOwnProperty.call(evidence, 'excerpt')
      ? optionalString(ownDataValue(evidence, 'excerpt', `${field}.excerpt`), `${field}.excerpt`)
      : undefined
    const locator = Object.prototype.hasOwnProperty.call(evidence, 'locator')
      ? optionalString(ownDataValue(evidence, 'locator', `${field}.locator`), `${field}.locator`)
      : undefined
    result[index] = freeze({
      sourceRef,
      ...(excerpt === undefined ? {} : { excerpt }),
      ...(locator === undefined ? {} : { locator }),
    })
  }
  return freeze(result)
}

function cloneRecord(value: unknown): CreativeKnowledgeRecord {
  assertPlainObject(value, 'record')
  assertExactKeys(value, RECORD_FIELDS, 'record')

  const knowledgeId = requiredTrimmedString(ownDataValue(value, 'knowledgeId', 'knowledgeId'), 'knowledgeId')
  const schemaVersion = ownDataValue(value, 'schemaVersion', 'schemaVersion')
  if (schemaVersion !== 1) fail('schemaVersion must be 1')
  const domain = enumValue(ownDataValue(value, 'domain', 'domain'), CREATIVE_KNOWLEDGE_DOMAINS, 'domain')
  const kind = enumValue(ownDataValue(value, 'kind', 'kind'), CREATIVE_KNOWLEDGE_KINDS, 'kind')
  const title = requiredTrimmedString(ownDataValue(value, 'title', 'title'), 'title')
  const contentValue = ownDataValue(value, 'content', 'content')
  assertPlainObject(contentValue, 'content')

  const evidence = cloneEvidence(ownDataValue(value, 'evidence', 'evidence'))

  const provenanceValue = ownDataValue(value, 'provenance', 'provenance')
  assertPlainObject(provenanceValue, 'provenance')
  assertExactKeys(provenanceValue, PROVENANCE_FIELDS, 'provenance')
  const provenance = freeze({
    sourceType: enumValue(
      ownDataValue(provenanceValue, 'sourceType', 'provenance.sourceType'),
      CREATIVE_KNOWLEDGE_SOURCE_TYPES,
      'provenance.sourceType',
    ),
    sourceId: requiredTrimmedString(
      ownDataValue(provenanceValue, 'sourceId', 'provenance.sourceId'),
      'provenance.sourceId',
    ),
    collectedAt: validDate(
      ownDataValue(provenanceValue, 'collectedAt', 'provenance.collectedAt'),
      'provenance.collectedAt',
    ),
    licenseStatus: enumValue(
      ownDataValue(provenanceValue, 'licenseStatus', 'provenance.licenseStatus'),
      CREATIVE_KNOWLEDGE_LICENSE_STATUSES,
      'provenance.licenseStatus',
    ),
    allowedUses: cloneAllowedUses(
      ownDataValue(provenanceValue, 'allowedUses', 'provenance.allowedUses'),
    ),
  })

  const reviewValue = ownDataValue(value, 'review', 'review')
  assertPlainObject(reviewValue, 'review')
  assertExactKeys(reviewValue, REVIEW_FIELDS, 'review')
  const review = freeze({
    status: enumValue(
      ownDataValue(reviewValue, 'status', 'review.status'),
      CREATIVE_KNOWLEDGE_REVIEW_STATUSES,
      'review.status',
    ),
    reviewedAt: validDate(
      ownDataValue(reviewValue, 'reviewedAt', 'review.reviewedAt'),
      'review.reviewedAt',
    ),
    reviewerId: requiredTrimmedString(
      ownDataValue(reviewValue, 'reviewerId', 'review.reviewerId'),
      'review.reviewerId',
    ),
  })

  return freeze({
    knowledgeId,
    schemaVersion: 1,
    domain,
    kind,
    title,
    content: cloneJsonRecord(contentValue, 'content'),
    evidence,
    provenance,
    review,
    revision: requiredTrimmedString(ownDataValue(value, 'revision', 'revision'), 'revision'),
    contentHash: requiredTrimmedString(ownDataValue(value, 'contentHash', 'contentHash'), 'contentHash'),
  })
}

export function validateCreativeKnowledgeRecord(value: unknown): CreativeKnowledgeRecord {
  try {
    return cloneRecord(value)
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError('Creative Knowledge record could not be validated')
  }
}

export function cloneCreativeKnowledgePack(value: unknown): CreativeKnowledgePack {
  try {
    assertPlainObject(value, 'pack')
    assertExactKeys(value, PACK_FIELDS, 'pack')
    const packId = requiredTrimmedString(ownDataValue(value, 'packId', 'packId'), 'packId')
    const revision = requiredTrimmedString(ownDataValue(value, 'revision', 'revision'), 'revision')
    const records = cloneDenseArray(ownDataValue(value, 'records', 'records'), 'records')
    const recordIds = new Set<string>()
    const result = new Array<CreativeKnowledgeRecord>(records.length)
    for (let index = 0; index < records.length; index += 1) {
      const record = validateCreativeKnowledgeRecord(records[index])
      if (recordIds.has(record.knowledgeId)) fail('records must not contain duplicate knowledgeIds')
      recordIds.add(record.knowledgeId)
      result[index] = record
    }
    return freeze({ packId, revision, records: freeze(result) })
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError('Creative Knowledge pack could not be cloned')
  }
}

export function isEligibleCreativeKnowledgeRecord(
  value: unknown,
  allowedUse: CreativeKnowledgeAllowedUse,
): value is CreativeKnowledgeRecord {
  try {
    const record = validateCreativeKnowledgeRecord(value)
    return record.provenance.licenseStatus === 'verified'
      && record.review.status === 'approved'
      && record.provenance.allowedUses.includes(allowedUse)
  } catch {
    return false
  }
}
