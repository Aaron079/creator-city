import type { CreativeKnowledgeDomain } from './types'
import { cloneCreativeKnowledgePack } from './validation'

const SOURCE_ID = 'creator-city:cinematic-core-editorial-v1'
const REVIEWED_AT = '2026-08-04T00:00:00.000Z'

function contentHash(ruleId: string, guidance: string): string {
  let hash = 0x811c9dc5
  for (const byte of new TextEncoder().encode(`${ruleId}\n${guidance}`)) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193)
  }
  return `ckh1_${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function rule(
  ruleId: string,
  domain: CreativeKnowledgeDomain,
  title: string,
  guidance: string,
) {
  return {
    knowledgeId: ruleId,
    schemaVersion: 1,
    domain,
    kind: 'rule',
    title,
    content: { ruleId, guidance },
    evidence: [{ sourceRef: SOURCE_ID }],
    provenance: {
      sourceType: 'creator-owned',
      sourceId: SOURCE_ID,
      collectedAt: REVIEWED_AT,
      licenseStatus: 'verified',
      allowedUses: ['retrieval', 'rule-authoring', 'evaluation'],
    },
    review: {
      status: 'approved',
      reviewedAt: REVIEWED_AT,
      reviewerId: 'creator-city-editorial',
    },
    revision: '1',
    contentHash: contentHash(ruleId, guidance),
  }
}

export const LOCAL_CINEMATIC_KNOWLEDGE_PACK = cloneCreativeKnowledgePack({
  packId: 'creator-city-cinematic-core',
  revision: '1.0.0',
  records: [
    rule('script-scene-objective', 'script', 'Scene objective', '每场明确目标、阻力与变化'),
    rule(
      'cinematic-screen-direction',
      'cinematography',
      'Screen direction',
      '连续动作保持屏幕方向，换轴必须可见地建立。',
    ),
    rule(
      'composition-subject-hierarchy',
      'composition',
      'Subject hierarchy',
      '一个镜头优先服务一个可读的视觉主体层级。',
    ),
    rule(
      'lighting-motivation',
      'lighting',
      'Lighting motivation',
      '关键光源应有叙事或空间动机，无法确认时标记待审核。',
    ),
    rule(
      'continuity-action-match',
      'continuity',
      'Action match',
      '跨镜头动作续接需要可验证的起止状态。',
    ),
    rule(
      'continuity-eyeline',
      'continuity',
      'Eyeline continuity',
      '对话镜头的视线方向应与空间关系一致。',
    ),
  ],
})
