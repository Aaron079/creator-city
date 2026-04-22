import type { ProjectTemplate } from '@/lib/templates'
import type { CastingSuggestion, Narrative, RoleBible, Shot } from '@/store/shots.store'

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function buildRoleBible(args: {
  name: string
  roleType: RoleBible['roleType']
  shot?: Shot
  template?: ProjectTemplate
  personality: string
  motivation: string
  emotionalArc: string
  appearance: RoleBible['appearance']
  performanceStyle: RoleBible['performanceStyle']
}): RoleBible {
  const { name, roleType, shot, template, personality, motivation, emotionalArc, appearance, performanceStyle } = args
  const styleSeed = template?.recommendedStyle ?? shot?.style ?? 'commercial'
  const intentSeed = shot?.intent ?? 'character-focus'
  return {
    id: uid('role'),
    name,
    roleType,
    personality,
    motivation,
    emotionalArc,
    appearance,
    performanceStyle,
    consistencyKey: `role:${name.slice(0, 10)}|style:${styleSeed}|intent:${intentSeed}`,
    referenceImageUrl: shot?.thumbnailUrl,
    status: 'draft',
  }
}

export function buildCastingSuggestions(args: {
  shot?: Shot
  narrative: Narrative | null
  template?: ProjectTemplate
  existingRoles: RoleBible[]
}): CastingSuggestion[] {
  const { shot, narrative, template, existingRoles } = args
  const sequence = narrative?.sequences.find((item) => item.id === shot?.sequenceId)
  const roleNameSeed = shot?.idea?.slice(0, 10) || sequence?.name || '主角'
  const category = template?.category ?? 'ad'
  const narrativeType = narrative?.type ?? 'commercial'
  const existingLockedRole = existingRoles.find((role) => role.status === 'locked')

  const presets: Array<{
    title: string
    roleType: RoleBible['roleType']
    personality: string
    motivation: string
    emotionalArc: string
    appearanceDirection: string
    wardrobeDirection: string
    performanceDirection: string
    reasoning: string
    expectedEffect: string
    appearance: RoleBible['appearance']
    performanceStyle: RoleBible['performanceStyle']
  }> = [
    {
      title: '主叙事角色',
      roleType: 'lead',
      personality: category === 'cinematic' || narrativeType === 'cinematic' ? '克制、带内心张力' : '自信、具有清晰表达欲',
      motivation: '推动当前段落的核心信息成立',
      emotionalArc: sequence?.goal?.includes('冲突') ? '由压抑转向对抗' : '由观察转向确认',
      appearanceDirection: '面部辨识度高，轮廓干净，适合连续镜头识别',
      wardrobeDirection: '轮廓稳定、材质统一、利于跨镜头保持连续性',
      performanceDirection: '表演以真实控制为主，让镜头语言承担情绪推进',
      reasoning: '当前段落需要一个可被持续识别的核心人物，先锁定主叙事角色最能提升长视频一致性。',
      expectedEffect: '后续分镜与视频衍生更容易保持人物统一。',
      appearance: {
        ageRange: '25-35',
        hair: '利落短发或清晰轮廓发型',
        wardrobe: '中性高级剪裁，避免过多跳色',
        bodyType: '匀称修长',
        visualTags: [shot?.style ?? '商业广告', shot?.intent ?? '强调角色', 'consistency-first'],
      },
      performanceStyle: {
        energy: 'medium',
        expression: category === 'ad' ? 'commercial' : 'natural',
        actingStyle: narrativeType === 'story' ? 'cinematic' : 'advertising',
      },
    },
    {
      title: '品牌代言气质',
      roleType: 'brand-spokesperson',
      personality: '清晰、可信、带高级亲和力',
      motivation: '替品牌或产品建立可信度与记忆点',
      emotionalArc: '从建立注意到完成说服',
      appearanceDirection: '脸部线条清晰，品牌友好度高，适合中近景呈现',
      wardrobeDirection: '品牌色系延展，干净层次，利于产品和人物共存',
      performanceDirection: '表达节奏更商业化，镜头前反应更明确',
      reasoning: '如果当前内容偏品牌或商业广告，这类角色能更直接承担说服与转化功能。',
      expectedEffect: '强化品牌识别与 CTA 可信度。',
      appearance: {
        ageRange: '28-40',
        hair: '整洁可控，适合高频重复出镜',
        wardrobe: '品牌友好、轮廓明确、配色统一',
        bodyType: '挺拔平衡',
        visualTags: ['brand-safe', 'clean face', template?.recommendedStyle ?? 'premium'],
      },
      performanceStyle: {
        energy: 'high',
        expression: 'commercial',
        actingStyle: 'advertising',
      },
    },
    {
      title: '情绪支撑角色',
      roleType: 'supporting',
      personality: '敏感、观察力强、适合烘托情绪',
      motivation: '支撑主角色的情绪变化或环境关系',
      emotionalArc: '由陪衬转向回应',
      appearanceDirection: '有辨识度但不抢主角中心，适合中景和反应镜头',
      wardrobeDirection: '同色系层次，作为主角色视觉辅助',
      performanceDirection: '表演更加细腻克制，适合 reaction shot',
      reasoning: '当段落需要空间关系、反应镜头或情绪对照时，支撑角色能显著提升叙事成立度。',
      expectedEffect: '增强 sequence 内的人物关系和镜头对照。',
      appearance: {
        ageRange: '22-35',
        hair: '自然、生活化但保持造型逻辑',
        wardrobe: '同世界观延展，弱对比不喧宾夺主',
        bodyType: '自然平衡',
        visualTags: ['supporting', 'reaction-friendly', shot?.intent ?? '推进情绪'],
      },
      performanceStyle: {
        energy: 'low',
        expression: 'subtle',
        actingStyle: narrativeType === 'story' ? 'cinematic' : 'documentary',
      },
    },
  ]

  return presets.slice(0, 3).map((preset, index) => {
    const suggestedRoleBible = buildRoleBible({
      name: existingLockedRole?.name && index === 0 ? existingLockedRole.name : `${roleNameSeed}${index === 0 ? '' : ` ${index + 1}`}`,
      roleType: preset.roleType,
      shot,
      template,
      personality: preset.personality,
      motivation: preset.motivation,
      emotionalArc: preset.emotionalArc,
      appearance: preset.appearance,
      performanceStyle: preset.performanceStyle,
    })

    return {
      id: uid('casting'),
      title: preset.title,
      roleType: preset.roleType,
      personality: preset.personality,
      appearanceDirection: preset.appearanceDirection,
      wardrobeDirection: preset.wardrobeDirection,
      performanceDirection: preset.performanceDirection,
      reasoning: preset.reasoning,
      expectedEffect: preset.expectedEffect,
      suggestedRoleBible,
    }
  })
}
