import type { ScoreSystemResult } from '@/lib/score/scoreSystem'
import type { NarrativeInsight, Narrative, Shot } from '@/store/shots.store'

export interface ProductionDecision {
  id: string
  level: 'info' | 'warning' | 'strong'
  nextBestAction:
    | 'add-missing-sequence'
    | 'improve-hook'
    | 'improve-cta'
    | 'refine-rhythm'
    | 'edit-intent'
    | 'ready-for-next-stage'
  title: string
  message: string
  targetSequenceId?: string
  targetShotId?: string
  ownerSuggestion: 'director' | 'cinematographer' | 'editor' | 'ai'
  confidence: number
  reasons: string[]
}

type DecisionInput = {
  narrative: Narrative | null
  shots: Shot[]
  scoreSummary: ScoreSystemResult
  insights: NarrativeInsight[]
}

function findSequenceIdByName(narrative: Narrative | null, names: string[]) {
  return narrative?.sequences.find((sequence) => names.includes(sequence.name))?.id
}

function clampConfidence(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)))
}

export function buildProductionDecision(input: DecisionInput): ProductionDecision {
  const { narrative, shots, scoreSummary, insights } = input
  const sequenceChecks = scoreSummary.breakdown.structureAnalysis.sequenceChecks
  const missingSequence = sequenceChecks.find((check) => check.status === 'missing')
  if (missingSequence) {
    return {
      id: `decision-missing-${missingSequence.sequenceId}`,
      level: 'strong',
      nextBestAction: 'add-missing-sequence',
      title: `先补齐 ${missingSequence.sequenceName}`,
      message: `${missingSequence.sequenceName} 目前仍然缺失，这是当前最直接的结构阻塞，先补这一段会比继续微调镜头更有效。`,
      targetSequenceId: missingSequence.sequenceId,
      ownerSuggestion: 'director',
      confidence: clampConfidence(92 + Math.max(0, 60 - scoreSummary.breakdown.structureCompletenessScore) * 0.15),
      reasons: [
        'Narrative Engine 判断该段为 missing。',
        '结构完整度仍然不足，继续细修其他镜头的收益较低。',
        '缺失关键段落会直接削弱后续的节奏和生产就绪度。',
      ],
    }
  }

  const hookSequenceId = findSequenceIdByName(narrative, ['Hook', 'Opening', 'Establish', 'Attention'])
  const hookScore = hookSequenceId
    ? scoreSummary.breakdown.sequenceScores.find((item) => item.sequenceId === hookSequenceId)
    : undefined
  if (hookSequenceId && hookScore && hookScore.score < 64) {
    return {
      id: `decision-hook-${hookSequenceId}`,
      level: 'warning',
      nextBestAction: 'improve-hook',
      title: '先强化开场抓力',
      message: '开场段落还不够成立，当前作品最缺的是第一印象和注意力建立，不建议现在过早进入后段优化。',
      targetSequenceId: hookSequenceId,
      ownerSuggestion: 'director',
      confidence: clampConfidence(84 + Math.max(0, 65 - hookScore.score) * 0.25),
      reasons: [
        `当前开场段落评分只有 ${hookScore.score}。`,
        'Hook / Opening 段会影响观众是否愿意继续看下去。',
        '先把开场站稳，再继续优化节奏和器材会更有效。',
      ],
    }
  }

  const ctaSequenceId = findSequenceIdByName(narrative, ['CTA', 'Resolve', 'Payoff'])
  const ctaScore = ctaSequenceId
    ? scoreSummary.breakdown.sequenceScores.find((item) => item.sequenceId === ctaSequenceId)
    : undefined
  if (ctaSequenceId && ctaScore && ctaScore.score < 64) {
    return {
      id: `decision-cta-${ctaSequenceId}`,
      level: 'warning',
      nextBestAction: 'improve-cta',
      title: '补强收束段落',
      message: '结尾或 CTA 还不够有力，当前最值得做的是把最后一击收稳，让作品的完成感更强。',
      targetSequenceId: ctaSequenceId,
      ownerSuggestion: 'director',
      confidence: clampConfidence(82 + Math.max(0, 65 - ctaScore.score) * 0.22),
      reasons: [
        `当前收束段评分只有 ${ctaScore.score}。`,
        '高潮/CTA 段偏弱会直接拉低作品的完成感与转化能力。',
        '这一段补强后，生产就绪度通常会明显提升。',
      ],
    }
  }

  const missingIntentShots = shots.filter((shot) => !shot.intent?.trim())
  if (missingIntentShots.length >= Math.max(2, Math.ceil(shots.length * 0.3))) {
    const targetShot = missingIntentShots[0]
    return {
      id: `decision-intent-${targetShot?.id ?? 'unknown'}`,
      level: 'warning',
      nextBestAction: 'edit-intent',
      title: '先补齐创作意图',
      message: '当前缺失 intent 的镜头已经足够多，继续调参数的收益会低于先把叙事职责说清楚。',
      targetShotId: targetShot?.id,
      targetSequenceId: targetShot?.sequenceId,
      ownerSuggestion: 'director',
      confidence: clampConfidence(78 + missingIntentShots.length * 4),
      reasons: [
        `当前有 ${missingIntentShots.length} 个 shot 缺少 intent。`,
        '没有明确 intent，系统无法稳定判断镜头是否真正服务于段落目标。',
        '先补 intent，后续 Suggestion / Gear / Rhythm 的建议都会更准。',
      ],
    }
  }

  const rhythmProblem = insights.find((insight) => (
    ['shot-repetition', 'movement-repetition', 'contrast-missing', 'flat-rhythm', 'weak-climax', 'rhythm-problem'].includes(insight.type)
      && insight.level !== 'info'
  ))
  if (scoreSummary.breakdown.rhythmScore < 72 || rhythmProblem) {
    return {
      id: `decision-rhythm-${rhythmProblem?.id ?? 'global'}`,
      level: rhythmProblem?.level === 'strong' ? 'strong' : 'warning',
      nextBestAction: 'refine-rhythm',
      title: '调整镜头节奏',
      message: '当前最值得处理的是节奏层次。先把景别、运镜和段落张弛拉开，比继续堆信息更能提升导演感。',
      targetSequenceId: rhythmProblem?.targetSequenceId,
      targetShotId: rhythmProblem?.targetShotId,
      ownerSuggestion: rhythmProblem?.type === 'movement-repetition' ? 'cinematographer' : 'editor',
      confidence: clampConfidence(76 + Math.max(0, 72 - scoreSummary.breakdown.rhythmScore) * 0.3),
      reasons: [
        `Rhythm Score 当前为 ${scoreSummary.breakdown.rhythmScore}。`,
        rhythmProblem?.message ?? '系统检测到景别或运镜变化不足。',
        '先把节奏做出层次，后续的器材和风格建议才更容易发挥效果。',
      ],
    }
  }

  return {
    id: 'decision-ready',
    level: 'info',
    nextBestAction: 'ready-for-next-stage',
    title: '可以进入下一阶段',
    message: '当前没有明显结构性阻塞，下一步更适合进入更细的风格、器材或执行层准备。',
    ownerSuggestion: 'ai',
    confidence: clampConfidence(
      (scoreSummary.breakdown.productionReadinessScore * 0.6) +
      (scoreSummary.breakdown.narrativeScore * 0.2) +
      (scoreSummary.breakdown.rhythmScore * 0.2)
    ),
    reasons: [
      `Production Readiness 当前为 ${scoreSummary.breakdown.productionReadinessScore}。`,
      'Narrative 结构和节奏上没有明显的强阻塞项。',
      '现在更适合继续推进风格统一、器材选择或执行准备，而不是返工基础结构。',
    ],
  }
}

