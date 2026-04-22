import type { ProjectTemplate } from '@/lib/templates'
import type { Narrative, NarrativeType, Sequence, Shot } from '@/store/shots.store'

export interface NarrativeRule {
  id: string
  narrativeType: NarrativeType
  sequenceName: string
  required: boolean
  minShots: number
  recommendedOrder: number
  allowedBefore?: string[]
  allowedAfter?: string[]
  targetGoals: string[]
  targetPacing: string
}

export interface SequenceCheck {
  sequenceId: string
  sequenceName: string
  status: 'ok' | 'weak' | 'missing'
  completenessScore: number
  orderScore: number
  issues: string[]
}

export interface NarrativeStructureIssue {
  id: string
  type: 'missing-sequence' | 'weak-sequence' | 'order-problem'
  message: string
  targetSequenceId?: string
}

export interface NarrativeStructureAnalysis {
  sequenceChecks: SequenceCheck[]
  overallCompletenessScore: number
  overallOrderScore: number
  issues: NarrativeStructureIssue[]
}

const COMMERCIAL_RULES: NarrativeRule[] = [
  { id: 'commercial-hook', narrativeType: 'commercial', sequenceName: 'Hook', required: true, minShots: 1, recommendedOrder: 0, allowedAfter: ['Problem', 'Escalation'], targetGoals: ['建立注意力', '第一印象', '视觉冲击'], targetPacing: 'fast' },
  { id: 'commercial-problem', narrativeType: 'commercial', sequenceName: 'Problem', required: false, minShots: 1, recommendedOrder: 1, allowedBefore: ['Hook'], allowedAfter: ['Solution'], targetGoals: ['问题', '痛点', '冲突'], targetPacing: 'medium' },
  { id: 'commercial-escalation', narrativeType: 'commercial', sequenceName: 'Escalation', required: false, minShots: 1, recommendedOrder: 1, allowedBefore: ['Hook'], allowedAfter: ['Payoff', 'CTA'], targetGoals: ['张力', '节奏', '悬念'], targetPacing: 'fast' },
  { id: 'commercial-solution', narrativeType: 'commercial', sequenceName: 'Solution', required: false, minShots: 1, recommendedOrder: 2, allowedBefore: ['Problem'], allowedAfter: ['CTA'], targetGoals: ['解决方案', '价值兑现', '亮点'], targetPacing: 'medium' },
  { id: 'commercial-payoff', narrativeType: 'commercial', sequenceName: 'Payoff', required: false, minShots: 1, recommendedOrder: 2, allowedBefore: ['Escalation'], allowedAfter: ['CTA'], targetGoals: ['满足', '回报', '结果'], targetPacing: 'fast' },
  { id: 'commercial-cta', narrativeType: 'commercial', sequenceName: 'CTA', required: true, minShots: 1, recommendedOrder: 3, allowedBefore: ['Solution', 'Payoff'], targetGoals: ['行动', '转化', '品牌收束'], targetPacing: 'clean' },
]

const STORY_RULES: NarrativeRule[] = [
  { id: 'story-opening', narrativeType: 'story', sequenceName: 'Opening', required: true, minShots: 1, recommendedOrder: 0, allowedAfter: ['Character', 'Subject'], targetGoals: ['氛围', '语境', '人物进入'], targetPacing: 'gentle' },
  { id: 'story-character', narrativeType: 'story', sequenceName: 'Character', required: false, minShots: 1, recommendedOrder: 1, allowedBefore: ['Opening'], allowedAfter: ['Resolution', 'Signature'], targetGoals: ['人物', '连接', '关系'], targetPacing: 'gentle' },
  { id: 'story-subject', narrativeType: 'story', sequenceName: 'Subject', required: false, minShots: 1, recommendedOrder: 1, allowedBefore: ['Context'], allowedAfter: ['Detail', 'Reflection'], targetGoals: ['对象', '处境', '真实'], targetPacing: 'observational' },
  { id: 'story-resolution', narrativeType: 'story', sequenceName: 'Resolution', required: true, minShots: 1, recommendedOrder: 2, allowedBefore: ['Character'], allowedAfter: ['Signature'], targetGoals: ['转机', '解决', '情绪兑现'], targetPacing: 'build' },
  { id: 'story-signature', narrativeType: 'story', sequenceName: 'Signature', required: false, minShots: 1, recommendedOrder: 3, allowedBefore: ['Resolution'], targetGoals: ['记忆点', '品牌价值'], targetPacing: 'soft-land' },
  { id: 'story-context', narrativeType: 'story', sequenceName: 'Context', required: false, minShots: 1, recommendedOrder: 0, allowedAfter: ['Subject'], targetGoals: ['背景', '议题', '空间'], targetPacing: 'observational' },
  { id: 'story-detail', narrativeType: 'story', sequenceName: 'Detail', required: false, minShots: 1, recommendedOrder: 2, allowedBefore: ['Subject'], allowedAfter: ['Reflection'], targetGoals: ['细节', '证据', '纹理'], targetPacing: 'observational' },
  { id: 'story-reflection', narrativeType: 'story', sequenceName: 'Reflection', required: true, minShots: 1, recommendedOrder: 3, allowedBefore: ['Detail', 'Subject'], targetGoals: ['思考', '观点', '余韵'], targetPacing: 'slow' },
]

const PRODUCT_RULES: NarrativeRule[] = [
  { id: 'product-attention', narrativeType: 'product', sequenceName: 'Attention', required: true, minShots: 1, recommendedOrder: 0, allowedAfter: ['Feature'], targetGoals: ['注意力', '产品进入', '揭示'], targetPacing: 'clean-fast' },
  { id: 'product-feature', narrativeType: 'product', sequenceName: 'Feature', required: true, minShots: 1, recommendedOrder: 1, allowedBefore: ['Attention'], allowedAfter: ['Benefit', 'CTA'], targetGoals: ['功能', '细节', '亮点'], targetPacing: 'clear' },
  { id: 'product-benefit', narrativeType: 'product', sequenceName: 'Benefit', required: false, minShots: 1, recommendedOrder: 2, allowedBefore: ['Feature'], allowedAfter: ['CTA'], targetGoals: ['好处', '价值', '使用结果'], targetPacing: 'steady' },
  { id: 'product-cta', narrativeType: 'product', sequenceName: 'CTA', required: true, minShots: 1, recommendedOrder: 3, allowedBefore: ['Benefit', 'Feature'], targetGoals: ['转化', '购买', '行动'], targetPacing: 'clean' },
]

const CINEMATIC_RULES: NarrativeRule[] = [
  { id: 'cinematic-establish', narrativeType: 'cinematic', sequenceName: 'Establish', required: true, minShots: 1, recommendedOrder: 0, allowedAfter: ['Observe'], targetGoals: ['空间', '时空', '氛围'], targetPacing: 'slow' },
  { id: 'cinematic-observe', narrativeType: 'cinematic', sequenceName: 'Observe', required: true, minShots: 1, recommendedOrder: 1, allowedBefore: ['Establish'], allowedAfter: ['Shift'], targetGoals: ['观察', '人物', '细节'], targetPacing: 'patient' },
  { id: 'cinematic-shift', narrativeType: 'cinematic', sequenceName: 'Shift', required: true, minShots: 1, recommendedOrder: 2, allowedBefore: ['Observe'], allowedAfter: ['Resolve'], targetGoals: ['转折', '变化', '冲突'], targetPacing: 'contrast' },
  { id: 'cinematic-resolve', narrativeType: 'cinematic', sequenceName: 'Resolve', required: true, minShots: 1, recommendedOrder: 3, allowedBefore: ['Shift'], targetGoals: ['收束', '余韵', '结尾'], targetPacing: 'soft-land' },
]

export const NARRATIVE_RULES: Record<NarrativeType, NarrativeRule[]> = {
  commercial: COMMERCIAL_RULES,
  story: STORY_RULES,
  product: PRODUCT_RULES,
  cinematic: CINEMATIC_RULES,
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getRuleForSequence(rules: NarrativeRule[], sequence: Sequence) {
  return rules.find((rule) => rule.sequenceName === sequence.name)
}

function scoreSequenceCompleteness(sequence: Sequence, shots: Shot[], rule?: NarrativeRule, template?: ProjectTemplate) {
  const sequenceShots = shots.filter((shot) => shot.sequenceId === sequence.id)
  if (!rule) {
    return {
      status: sequenceShots.length === 0 ? 'missing' as const : sequenceShots.length === 1 ? 'weak' as const : 'ok' as const,
      score: sequenceShots.length === 0 ? 25 : sequenceShots.length === 1 ? 62 : 82,
      issues: sequenceShots.length === 0 ? ['段落没有镜头'] : sequenceShots.length === 1 ? ['段落镜头偏少'] : [],
    }
  }

  const issues: string[] = []
  let score = 100
  if (sequenceShots.length === 0) {
    issues.push('必备段落缺失')
    return { status: 'missing' as const, score: 0, issues }
  }
  if (sequenceShots.length < rule.minShots) {
    score -= 28
    issues.push(`镜头数少于建议值 ${rule.minShots}`)
  }

  const missingIntentCount = sequenceShots.filter((shot) => !shot.intent?.trim()).length
  if (missingIntentCount > 0) {
    score -= missingIntentCount * 14
    issues.push('存在缺失 intent 的镜头')
  }

  const hasGoalAlignedShot = sequenceShots.some((shot) => {
    const intent = shot.intent ?? ''
    return rule.targetGoals.some((goal) => sequence.goal.includes(goal) || intent.includes(goal))
  })
  if (!hasGoalAlignedShot) {
    score -= 18
    issues.push('当前镜头对 sequence goal 的呼应偏弱')
  }

  if (template?.recommendedPacing === '利落、清晰、转化导向' && sequenceShots.length > 3 && rule.targetPacing === 'clean') {
    score -= 10
    issues.push('段落镜头偏多，收束不够利落')
  }

  const status = score < 35 ? 'missing' : score < 72 ? 'weak' : 'ok'
  return { status, score: clampScore(score), issues }
}

function scoreSequenceOrder(sequences: Sequence[], rules: NarrativeRule[]) {
  const issues: NarrativeStructureIssue[] = []
  const checks: Array<{ sequenceId: string; orderScore: number }> = []

  sequences.forEach((sequence, index) => {
    const rule = getRuleForSequence(rules, sequence)
    if (!rule) {
      checks.push({ sequenceId: sequence.id, orderScore: 70 })
      return
    }

    let score = 100
    if (Math.abs(index - rule.recommendedOrder) > 1) {
      score -= 35
      issues.push({
        id: `order-${sequence.id}`,
        type: 'order-problem',
        message: `${sequence.name} 当前顺序偏离推荐结构，建议更靠近第 ${rule.recommendedOrder + 1} 段位置。`,
        targetSequenceId: sequence.id,
      })
    }

    const before = sequences[index - 1]?.name
    const after = sequences[index + 1]?.name
    if (rule.allowedBefore && before && !rule.allowedBefore.includes(before)) {
      score -= 18
    }
    if (rule.allowedAfter && after && !rule.allowedAfter.includes(after)) {
      score -= 18
    }

    checks.push({ sequenceId: sequence.id, orderScore: clampScore(score) })
  })

  return { checks, issues }
}

export function analyzeNarrativeStructure(args: {
  narrative: Narrative | null
  shots: Shot[]
  projectTemplate?: ProjectTemplate
}): NarrativeStructureAnalysis {
  const { narrative, shots, projectTemplate } = args
  if (!narrative) {
    return {
      sequenceChecks: [],
      overallCompletenessScore: 0,
      overallOrderScore: 0,
      issues: [],
    }
  }

  const rules = NARRATIVE_RULES[narrative.type] ?? []
  const order = scoreSequenceOrder(narrative.sequences, rules)
  const sequenceChecks = narrative.sequences.map((sequence) => {
    const rule = getRuleForSequence(rules, sequence)
    const completeness = scoreSequenceCompleteness(sequence, shots, rule, projectTemplate)
    const orderScore = order.checks.find((item) => item.sequenceId === sequence.id)?.orderScore ?? 70
    return {
      sequenceId: sequence.id,
      sequenceName: sequence.name,
      status: completeness.status as SequenceCheck['status'],
      completenessScore: completeness.score,
      orderScore,
      issues: completeness.issues,
    }
  })

  rules.forEach((rule) => {
    if (!rule.required) return
    const exists = narrative.sequences.some((sequence) => sequence.name === rule.sequenceName)
    if (!exists) {
      order.issues.push({
        id: `missing-rule-${rule.id}`,
        type: 'missing-sequence',
        message: `${rule.sequenceName} 是 ${narrative.type} 结构中的必备段落，但当前 Narrative 中不存在。`,
      })
    }
  })

  const issues: NarrativeStructureIssue[] = [
    ...order.issues,
    ...sequenceChecks.flatMap((check) => (
      check.status === 'weak'
        ? [{
            id: `weak-${check.sequenceId}`,
            type: 'weak-sequence' as const,
            message: `${check.sequenceName} 当前偏弱：${check.issues.join('、') || '建议继续强化段落表达。'}`,
            targetSequenceId: check.sequenceId,
          }]
        : []
    )),
  ]

  const missingRequiredCount = issues.filter((issue) => issue.type === 'missing-sequence').length
  const orderIssueCount = issues.filter((issue) => issue.type === 'order-problem').length
  const overallCompletenessScore = clampScore(
    sequenceChecks.reduce((sum, check) => sum + check.completenessScore, 0) / Math.max(sequenceChecks.length, 1) -
    missingRequiredCount * 18
  )
  const overallOrderScore = clampScore(
    sequenceChecks.reduce((sum, check) => sum + check.orderScore, 0) / Math.max(sequenceChecks.length, 1) -
    orderIssueCount * 8
  )

  return {
    sequenceChecks,
    overallCompletenessScore,
    overallOrderScore,
    issues,
  }
}
