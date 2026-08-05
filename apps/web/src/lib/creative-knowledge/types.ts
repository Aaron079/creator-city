export type CreativeKnowledgeDomain =
  | 'script'
  | 'cinematography'
  | 'lighting'
  | 'composition'
  | 'editing'
  | 'continuity'

export type CreativeKnowledgeKind =
  | 'rule'
  | 'taxonomy'
  | 'template'
  | 'evaluation-case'

export type CreativeKnowledgeAllowedUse =
  | 'retrieval'
  | 'rule-authoring'
  | 'evaluation'
  | 'training'

export type CreativeKnowledgeSourceType =
  | 'creator-owned'
  | 'user-authorized'
  | 'licensed'
  | 'open-license'
  | 'public-metadata'

export type CreativeKnowledgeLicenseStatus =
  | 'verified'
  | 'restricted'
  | 'metadata-only'
  | 'revoked'

export type CreativeKnowledgeReviewStatus = 'approved' | 'disabled'

export type CreativeKnowledgeRecord = {
  readonly knowledgeId: string
  readonly schemaVersion: 1
  readonly domain: CreativeKnowledgeDomain
  readonly kind: CreativeKnowledgeKind
  readonly title: string
  readonly content: Readonly<Record<string, unknown>>
  readonly evidence: ReadonlyArray<{
    readonly sourceRef: string
    readonly excerpt?: string
    readonly locator?: string
  }>
  readonly provenance: {
    readonly sourceType: CreativeKnowledgeSourceType
    readonly sourceId: string
    readonly collectedAt: string
    readonly licenseStatus: CreativeKnowledgeLicenseStatus
    readonly allowedUses: ReadonlyArray<CreativeKnowledgeAllowedUse>
  }
  readonly review: {
    readonly status: CreativeKnowledgeReviewStatus
    readonly reviewedAt: string
    readonly reviewerId: string
  }
  readonly revision: string
  readonly contentHash: string
}

export type CreativeKnowledgePack = {
  readonly packId: string
  readonly revision: string
  readonly records: ReadonlyArray<CreativeKnowledgeRecord>
}

export const CREATIVE_KNOWLEDGE_DOMAINS = Object.freeze([
  'script',
  'cinematography',
  'lighting',
  'composition',
  'editing',
  'continuity',
] as const)

export const CREATIVE_KNOWLEDGE_KINDS = Object.freeze([
  'rule',
  'taxonomy',
  'template',
  'evaluation-case',
] as const)

export const CREATIVE_KNOWLEDGE_ALLOWED_USES = Object.freeze([
  'retrieval',
  'rule-authoring',
  'evaluation',
  'training',
] as const)

export const CREATIVE_KNOWLEDGE_SOURCE_TYPES = Object.freeze([
  'creator-owned',
  'user-authorized',
  'licensed',
  'open-license',
  'public-metadata',
] as const)

export const CREATIVE_KNOWLEDGE_LICENSE_STATUSES = Object.freeze([
  'verified',
  'restricted',
  'metadata-only',
  'revoked',
] as const)

export const CREATIVE_KNOWLEDGE_REVIEW_STATUSES = Object.freeze([
  'approved',
  'disabled',
] as const)
