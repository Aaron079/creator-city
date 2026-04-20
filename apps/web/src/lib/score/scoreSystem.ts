import type { ProjectTemplate } from '@/lib/templates'
import type { Narrative, Sequence, Shot } from '@/store/shots.store'
import { analyzeNarrativeStructure, type NarrativeStructureAnalysis } from '@/lib/score/narrativeRules'

export type ScoreLevel = 'info' | 'warning' | 'strong'

export interface ScoreIssue {
  id: string
  level: ScoreLevel
  title: string
  message: string
  targetSequenceId?: string
  targetShotId?: string
}

export interface ScoreSuggestion {
  id: string
  label: string
  message: string
}

export interface SequenceScore {
  sequenceId: string
  name: string
  score: number
  shotCount: number
  missingIntentCount: number
  averageShotFit: number
}

export interface ShotFitScore {
  shotId: string
  label: string
  sequenceId: string
  score: number
}

export interface ScoreSystemResult {
  totalScore: number
  breakdown: {
    narrativeScore: number
    structureCompletenessScore: number
    structureOrderScore: number
    rhythmScore: number
    productionReadinessScore: number
    averageSequenceScore: number
    averageShotFitScore: number
    structureAnalysis: NarrativeStructureAnalysis
    sequenceScores: SequenceScore[]
    shotFitScores: ShotFitScore[]
  }
  issues: ScoreIssue[]
  suggestions: ScoreSuggestion[]
}

type ScoreInput = {
  narrative: Narrative | null
  shots: Shot[]
  projectTemplate?: ProjectTemplate
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function uniqueRatio(values: string[]) {
  if (values.length === 0) return 1
  return new Set(values).size / values.length
}

function scoreShotForSequence(shot: Shot, sequence: Sequence, template?: ProjectTemplate) {
  let score = 100
  const framing = shot.presetParams?.framing ?? 'MS'
  const movement = shot.presetParams?.movement ?? 'Static'

  if (!shot.intent?.trim()) score -= 28
  else if (sequence.suggestedIntent && shot.intent !== sequence.suggestedIntent) score -= 12

  if (template?.recommendedStyle && shot.style !== template.recommendedStyle) score -= 10

  const expectWide = ['hook', 'opening', 'establish', 'context'].includes(sequence.structureId)
  const expectDetail = ['solution', 'feature', 'detail', 'cta'].includes(sequence.structureId)
  const expectDynamic = ['problem', 'shift', 'escalation'].includes(sequence.structureId)

  if (expectWide && !['WS', 'EWS', 'ELS'].includes(framing)) score -= 14
  if (expectDetail && !['CU', 'ECU', 'MCU'].includes(framing)) score -= 16
  if (expectDynamic && !['Handheld', 'Push In', 'Dolly'].includes(movement)) score -= 10

  return clampScore(score)
}

function scoreSequence(sequence: Sequence, shots: Shot[], template?: ProjectTemplate): SequenceScore {
  const sequenceShots = shots.filter((shot) => shot.sequenceId === sequence.id)
  if (sequenceShots.length === 0) {
    return {
      sequenceId: sequence.id,
      name: sequence.name,
      score: 8,
      shotCount: 0,
      missingIntentCount: 0,
      averageShotFit: 0,
    }
  }

  const shotFits = sequenceShots.map((shot) => scoreShotForSequence(shot, sequence, template))
  const averageShotFit = shotFits.reduce((sum, score) => sum + score, 0) / shotFits.length
  const missingIntentCount = sequenceShots.filter((shot) => !shot.intent?.trim()).length

  let score = 100
  if (sequenceShots.length === 1) score -= 18
  score -= missingIntentCount * 12
  score -= Math.max(0, 75 - averageShotFit) * 0.45

  return {
    sequenceId: sequence.id,
    name: sequence.name,
    score: clampScore(score),
    shotCount: sequenceShots.length,
    missingIntentCount,
    averageShotFit: clampScore(averageShotFit),
  }
}

function scoreNarrative(
  narrative: Narrative | null,
  sequenceScores: SequenceScore[],
  structureAnalysis: NarrativeStructureAnalysis
) {
  if (!narrative || sequenceScores.length === 0) return 0
  const missingCount = sequenceScores.filter((sequence) => sequence.shotCount === 0).length
  const weakCount = sequenceScores.filter((sequence) => sequence.score < 65).length
  const average = sequenceScores.reduce((sum, sequence) => sum + sequence.score, 0) / sequenceScores.length
  return clampScore(
    average * 0.48 +
    structureAnalysis.overallCompletenessScore * 0.34 +
    structureAnalysis.overallOrderScore * 0.18 -
    missingCount * 18 -
    weakCount * 8
  )
}

function scoreRhythm(shots: Shot[], narrative: Narrative | null) {
  if (shots.length <= 1) return 40

  const framingRatio = uniqueRatio(shots.map((shot) => shot.presetParams?.framing ?? 'MS'))
  const movementRatio = uniqueRatio(shots.map((shot) => shot.presetParams?.movement ?? 'Static'))

  let score = 100
  score -= (1 - framingRatio) * 38
  score -= (1 - movementRatio) * 28

  if (narrative) {
    narrative.sequences.forEach((sequence) => {
      const seqShots = shots.filter((shot) => shot.sequenceId === sequence.id)
      if (seqShots.length >= 2) {
        const seqFramingRatio = uniqueRatio(seqShots.map((shot) => shot.presetParams?.framing ?? 'MS'))
        score -= (1 - seqFramingRatio) * 10
      }
    })
  }

  return clampScore(score)
}

function scoreProductionReadiness(args: {
  narrativeScore: number
  rhythmScore: number
  sequenceScores: SequenceScore[]
  shots: Shot[]
}) {
  const { narrativeScore, rhythmScore, sequenceScores, shots } = args
  const weakSequences = sequenceScores.filter((sequence) => sequence.score < 60).length
  const missingIntent = shots.filter((shot) => !shot.intent?.trim()).length

  const base = narrativeScore * 0.5 + rhythmScore * 0.2 + (sequenceScores.reduce((sum, sequence) => sum + sequence.score, 0) / Math.max(sequenceScores.length, 1)) * 0.3
  return clampScore(base - weakSequences * 10 - missingIntent * 8)
}

export function computeScoreSystem(input: ScoreInput): ScoreSystemResult {
  const { narrative, shots, projectTemplate } = input
  const sequences = narrative?.sequences ?? []
  const structureAnalysis = analyzeNarrativeStructure({ narrative, shots, projectTemplate })
  const sequenceScores = sequences.map((sequence) => scoreSequence(sequence, shots, projectTemplate))
  const shotFitScores = shots.map((shot) => {
    const sequence = sequences.find((item) => item.id === shot.sequenceId)
    return {
      shotId: shot.id,
      label: shot.label,
      sequenceId: shot.sequenceId,
      score: sequence ? scoreShotForSequence(shot, sequence, projectTemplate) : 45,
    }
  })

  const averageSequenceScore = clampScore(
    sequenceScores.reduce((sum, sequence) => sum + sequence.score, 0) / Math.max(sequenceScores.length, 1)
  )
  const averageShotFitScore = clampScore(
    shotFitScores.reduce((sum, shot) => sum + shot.score, 0) / Math.max(shotFitScores.length, 1)
  )
  const narrativeScore = scoreNarrative(narrative, sequenceScores, structureAnalysis)
  const rhythmScore = scoreRhythm(shots, narrative)
  const productionReadinessScore = scoreProductionReadiness({
    narrativeScore,
    rhythmScore,
    sequenceScores,
    shots,
  })

  const totalScore = clampScore(
    narrativeScore * 0.24 +
    structureAnalysis.overallCompletenessScore * 0.1 +
    structureAnalysis.overallOrderScore * 0.06 +
    averageSequenceScore * 0.22 +
    averageShotFitScore * 0.18 +
    rhythmScore * 0.1 +
    productionReadinessScore * 0.1
  )

  const issues: ScoreIssue[] = []
  structureAnalysis.issues.forEach((issue) => {
    if (issue.type === 'missing-sequence') {
      issues.push({
        id: `structure-${issue.id}`,
        level: 'strong',
        title: '结构存在缺口',
        message: issue.message,
        targetSequenceId: issue.targetSequenceId,
      })
      return
    }

    if (issue.type === 'order-problem') {
      issues.push({
        id: `structure-${issue.id}`,
        level: 'warning',
        title: 'Sequence 顺序可优化',
        message: issue.message,
        targetSequenceId: issue.targetSequenceId,
      })
      return
    }

    issues.push({
      id: `structure-${issue.id}`,
      level: 'warning',
      title: '段落表达偏弱',
      message: issue.message,
      targetSequenceId: issue.targetSequenceId,
    })
  })

  sequenceScores.forEach((sequence) => {
    if (sequence.shotCount === 0) {
      issues.push({
        id: `issue-missing-${sequence.sequenceId}`,
        level: 'strong',
        title: `${sequence.name} 未完成`,
        message: '模板要求的这个段落还没有任何镜头，Narrative 结构会被直接削弱。',
        targetSequenceId: sequence.sequenceId,
      })
    } else if (sequence.score < 60) {
      issues.push({
        id: `issue-weak-${sequence.sequenceId}`,
        level: 'warning',
        title: `${sequence.name} 仍然偏弱`,
        message: '这一段镜头数量、意图或镜头匹配度还不够，建议继续强化。',
        targetSequenceId: sequence.sequenceId,
      })
    }
  })

  const intentMissingShot = shots.find((shot) => !shot.intent?.trim())
  if (intentMissingShot) {
    issues.push({
      id: `issue-intent-${intentMissingShot.id}`,
      level: 'strong',
      title: `${intentMissingShot.label} 缺少意图`,
      message: '关键镜头没有明确 intent，会影响 sequence 成立和生产判断。',
      targetShotId: intentMissingShot.id,
    })
  }

  if (rhythmScore < 65) {
    issues.push({
      id: 'issue-rhythm',
      level: 'warning',
      title: '节奏变化不足',
      message: 'shotType / movement 重复度偏高，当前作品的节奏层次不够丰富。',
    })
  }

  if (projectTemplate?.recommendedStyle && shots.some((shot) => shot.style !== projectTemplate.recommendedStyle)) {
    issues.push({
      id: 'issue-style',
      level: 'info',
      title: '风格与模板建议存在偏差',
      message: `模板建议使用 ${projectTemplate.recommendedStyle}，但当前作品风格并未完全统一。`,
    })
  }

  const suggestions: ScoreSuggestion[] = []
  if (structureAnalysis.overallCompletenessScore < 75) {
    suggestions.push({
      id: 'suggest-completeness',
      label: '先补齐结构完整度',
      message: '优先补完缺失或明显偏弱的 sequence，再继续细修镜头参数。',
    })
  }
  if (structureAnalysis.overallOrderScore < 78) {
    suggestions.push({
      id: 'suggest-order',
      label: '整理段落顺序',
      message: '当前 sequence 排布与模板推荐存在偏差，先把结构顺一遍会更稳。',
    })
  }
  if (narrativeScore < 75) {
    suggestions.push({
      id: 'suggest-structure',
      label: '优先补结构',
      message: '先补齐缺失或过弱的 sequence，再继续细化镜头参数。',
    })
  }
  if (averageShotFitScore < 72) {
    suggestions.push({
      id: 'suggest-fit',
      label: '重看镜头匹配度',
      message: '检查每个 shot 是否真的服务于当前 sequence 的目标。',
    })
  }
  if (productionReadinessScore >= 78) {
    suggestions.push({
      id: 'suggest-production',
      label: '可进入生产准备',
      message: '当前结构已经具备继续生产的基础，可以推进更细的镜头制作。',
    })
  } else {
    suggestions.push({
      id: 'suggest-readiness',
      label: '先提升生产就绪度',
      message: '优先解决明显弱段落与缺失 intent，再进入下一阶段。',
    })
  }

  return {
    totalScore,
    breakdown: {
      narrativeScore,
      structureCompletenessScore: structureAnalysis.overallCompletenessScore,
      structureOrderScore: structureAnalysis.overallOrderScore,
      rhythmScore,
      productionReadinessScore,
      averageSequenceScore,
      averageShotFitScore,
      structureAnalysis,
      sequenceScores,
      shotFitScores,
    },
    issues: issues.slice(0, 5),
    suggestions: suggestions.slice(0, 3),
  }
}
