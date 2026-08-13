import { LOCAL_CINEMATIC_KNOWLEDGE_PACK } from './local-cinematic-pack'
import {
  CREATIVE_KNOWLEDGE_ALLOWED_USES,
  CREATIVE_KNOWLEDGE_DOMAINS,
  type CreativeKnowledgeAllowedUse,
  type CreativeKnowledgeDomain,
  type CreativeKnowledgePack,
  type CreativeKnowledgeRecord,
  type CreativeKnowledgeSelectionQuery,
  type CreativeKnowledgeSelectionReceipt,
} from './types'
import {
  cloneCreativeKnowledgePack,
  isEligibleCreativeKnowledgeRecord,
} from './validation'

export type CreativeKnowledgeSelection = {
  readonly records: readonly CreativeKnowledgeRecord[]
  readonly receipt: CreativeKnowledgeSelectionReceipt
}

function fail(message: string): never {
  throw new TypeError(message)
}

function ownDataValue(value: object, key: string, field: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
    fail(`${field} must be an own enumerable data property`)
  }
  return descriptor.value
}

function cloneQueryDomains(value: unknown): readonly CreativeKnowledgeDomain[] {
  if (!Array.isArray(value)) fail('query.domains must be an array')
  if (!value.length) fail('query.domains must not be empty')

  const keys = Reflect.ownKeys(value)
  if (keys.length !== value.length + 1) {
    fail('query.domains must be a dense array without extra properties')
  }

  const requested = new Set<CreativeKnowledgeDomain>()
  for (let index = 0; index < value.length; index += 1) {
    const domain = ownDataValue(value, String(index), `query.domains[${index}]`)
    if (typeof domain !== 'string' || !CREATIVE_KNOWLEDGE_DOMAINS.includes(domain as CreativeKnowledgeDomain)) {
      fail(`query.domains[${index}] must be a supported domain`)
    }
    if (requested.has(domain as CreativeKnowledgeDomain)) {
      fail('query.domains must not contain duplicates')
    }
    requested.add(domain as CreativeKnowledgeDomain)
  }

  return Object.freeze(
    CREATIVE_KNOWLEDGE_DOMAINS.filter((domain) => requested.has(domain)),
  )
}

function cloneSelectionQuery(value: unknown): CreativeKnowledgeSelectionQuery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('query must be an object')
  }

  const query = value as object
  const keys = Reflect.ownKeys(query)
  if (keys.length !== 2 || !keys.every((key) => key === 'domains' || key === 'allowedUse')) {
    fail('query must contain only domains and allowedUse')
  }
  const domains = cloneQueryDomains(ownDataValue(query, 'domains', 'query.domains'))
  const allowedUse = ownDataValue(query, 'allowedUse', 'query.allowedUse')
  if (
    typeof allowedUse !== 'string'
    || !CREATIVE_KNOWLEDGE_ALLOWED_USES.includes(allowedUse as CreativeKnowledgeAllowedUse)
  ) {
    fail('query.allowedUse must be a supported value')
  }

  return Object.freeze({
    domains,
    allowedUse: allowedUse as CreativeKnowledgeAllowedUse,
  })
}

function fingerprint(value: unknown): string {
  let hash = 0x811c9dc5
  for (const byte of new TextEncoder().encode(JSON.stringify(value))) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193)
  }
  return `ckr1_${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function createReceipt(
  pack: CreativeKnowledgePack,
  query: CreativeKnowledgeSelectionQuery,
  records: readonly CreativeKnowledgeRecord[],
): CreativeKnowledgeSelectionReceipt {
  const recordIds = Object.freeze(records.map((record) => record.knowledgeId))
  const fingerprintInput = {
    packId: pack.packId,
    packRevision: pack.revision,
    domains: query.domains,
    allowedUse: query.allowedUse,
    records: records.map((record) => ({
      knowledgeId: record.knowledgeId,
      revision: record.revision,
      contentHash: record.contentHash,
    })),
  }

  return Object.freeze({
    packId: pack.packId,
    packRevision: pack.revision,
    selectionFingerprint: fingerprint(fingerprintInput),
    recordIds,
    domains: query.domains,
    allowedUse: query.allowedUse,
  })
}

export function resolveCreativeKnowledge({
  pack,
  query,
}: {
  readonly pack: unknown
  readonly query: unknown
}): CreativeKnowledgeSelection {
  try {
    const clonedPack = cloneCreativeKnowledgePack(pack)
    const clonedQuery = cloneSelectionQuery(query)
    const records = Object.freeze(
      clonedPack.records
        .filter(
          (record) => clonedQuery.domains.includes(record.domain)
            && isEligibleCreativeKnowledgeRecord(record, clonedQuery.allowedUse),
        )
        .sort((left, right) => (
          left.knowledgeId < right.knowledgeId ? -1 : left.knowledgeId > right.knowledgeId ? 1 : 0
        )),
    )

    return Object.freeze({
      records,
      receipt: createReceipt(clonedPack, clonedQuery, records),
    })
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError('Creative Knowledge selection could not be resolved')
  }
}

export function resolveLocalCinematicKnowledge(
  query: CreativeKnowledgeSelectionQuery,
): CreativeKnowledgeSelection {
  return resolveCreativeKnowledge({ pack: LOCAL_CINEMATIC_KNOWLEDGE_PACK, query })
}
