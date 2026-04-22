import type { ProjectTemplate } from '@/lib/templates'
import type { Narrative, Shot } from '@/store/shots.store'

export interface RhythmContext {
  templateId?: string
  narrativeType?: Narrative['type']
  recommendedPacing?: string
  sequences: Array<{
    id: string
    name: string
    goal: string
    shots: Array<{
      id: string
      label: string
      intent?: string
      framing: string
      movement: string
      style: string
    }>
  }>
}

export interface RhythmInsight {
  id: string
  level: 'info' | 'warning' | 'strong'
  type: 'shot-repetition' | 'movement-repetition' | 'contrast-missing' | 'flat-rhythm' | 'weak-climax'
  title: string
  message: string
  targetSequenceId?: string
  targetShotId?: string
  suggestedAction: {
    label: string
    panel?: 'ai' | 'camera'
    kind: 'open-suggestion' | 'focus-sequence'
  }
}

function countMap(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

function dominantEntry(values: string[]) {
  const map = countMap(values)
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0]
}

export function buildRhythmContext(args: {
  narrative: Narrative | null
  shots: Shot[]
  projectTemplate?: ProjectTemplate
}): RhythmContext {
  const { narrative, shots, projectTemplate } = args
  const sequences = (narrative?.sequences ?? []).map((sequence) => ({
    id: sequence.id,
    name: sequence.name,
    goal: sequence.goal,
    shots: shots
      .filter((shot) => shot.sequenceId === sequence.id)
      .map((shot) => ({
        id: shot.id,
        label: shot.label,
        intent: shot.intent,
        framing: shot.presetParams?.framing ?? 'MS',
        movement: shot.presetParams?.movement ?? 'Static',
        style: shot.style,
      })),
  }))

  return {
    templateId: projectTemplate?.id,
    narrativeType: narrative?.type,
    recommendedPacing: projectTemplate?.recommendedPacing,
    sequences,
  }
}

export function analyzeRhythmContext(context: RhythmContext): RhythmInsight[] {
  const insights: RhythmInsight[] = []
  const allShots = context.sequences.flatMap((sequence) => sequence.shots.map((shot) => ({ ...shot, sequenceId: sequence.id, sequenceName: sequence.name })))
  if (allShots.length === 0) return insights

  const framingDominant = dominantEntry(allShots.map((shot) => shot.framing))
  if (framingDominant && framingDominant[1] >= Math.max(3, Math.ceil(allShots.length * 0.6))) {
    insights.push({
      id: `rhythm-shot-${framingDominant[0]}`,
      level: 'warning',
      type: 'shot-repetition',
      title: `${framingDominant[0]} 镜头重复偏多`,
      message: `当前有 ${framingDominant[1]} 个镜头都停留在 ${framingDominant[0]}，景别变化不足，节奏层次会显得偏平。`,
      suggestedAction: { label: '打开建议', kind: 'open-suggestion', panel: 'ai' },
    })
  }

  const movementDominant = dominantEntry(allShots.map((shot) => shot.movement))
  if (movementDominant && movementDominant[1] >= Math.max(3, Math.ceil(allShots.length * 0.65))) {
    insights.push({
      id: `rhythm-move-${movementDominant[0]}`,
      level: movementDominant[0] === 'Static' ? 'strong' : 'warning',
      type: 'movement-repetition',
      title: `${movementDominant[0]} 运镜占比过高`,
      message: `当前 ${movementDominant[0]} 已成为主导运动方式，节奏推进会显得单调，建议增加镜头语言对比。`,
      suggestedAction: { label: '打开镜头语言', kind: 'open-suggestion', panel: 'camera' },
    })
  }

  context.sequences.forEach((sequence) => {
    if (sequence.shots.length < 2) return
    const framingKinds = new Set(sequence.shots.map((shot) => shot.framing))
    const movementKinds = new Set(sequence.shots.map((shot) => shot.movement))
    if (framingKinds.size === 1 && movementKinds.size === 1) {
      insights.push({
        id: `rhythm-contrast-${sequence.id}`,
        level: 'warning',
        type: 'contrast-missing',
        title: `${sequence.name} 缺少镜头对比`,
        message: `这一段的景别和运镜几乎没有变化，${sequence.goal} 的表达会显得不够有层次。`,
        targetSequenceId: sequence.id,
        suggestedAction: { label: '聚焦段落', kind: 'focus-sequence' },
      })
    }
  })

  const uniqueFramings = new Set(allShots.map((shot) => shot.framing)).size
  const uniqueMovements = new Set(allShots.map((shot) => shot.movement)).size
  if (allShots.length >= 4 && uniqueFramings <= 2 && uniqueMovements <= 2) {
    insights.push({
      id: 'rhythm-flat',
      level: 'strong',
      type: 'flat-rhythm',
      title: '整体节奏过平',
      message: '当前作品的景别和运动变化都偏少，缺少明显的张弛关系，容易削弱导演感和叙事推进。',
      suggestedAction: { label: '打开建议', kind: 'open-suggestion', panel: 'ai' },
    })
  }

  const climaxSequence = context.sequences.find((sequence) => /CTA|Climax|Payoff|Resolve/i.test(sequence.name))
  if (climaxSequence) {
    const hasContrast = new Set(climaxSequence.shots.map((shot) => shot.framing)).size >= 2
    const hasDrive = climaxSequence.shots.some((shot) => !['Static', 'Pan L', 'Pan R'].includes(shot.movement))
    if (climaxSequence.shots.length <= 1 || (!hasContrast && !hasDrive)) {
      insights.push({
        id: `rhythm-climax-${climaxSequence.id}`,
        level: 'warning',
        type: 'weak-climax',
        title: `${climaxSequence.name} 段落偏弱`,
        message: `${climaxSequence.name} 目前缺少足够的节奏抬升或镜头对比，高潮/收束的力度还不够。`,
        targetSequenceId: climaxSequence.id,
        suggestedAction: { label: '聚焦段落', kind: 'focus-sequence' },
      })
    }
  }

  return insights
}
