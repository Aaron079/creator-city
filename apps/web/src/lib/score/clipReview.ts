import type { ClipReview, EditorTimeline, RoleBible, Sequence, Shot, ShotDerivativeJob, StoryboardFrame, StyleBible } from '@/store/shots.store'

type BuildClipReviewInput = {
  job: ShotDerivativeJob
  frame?: StoryboardFrame
  roleBible?: RoleBible | null
  styleBible?: StyleBible | null
  sequence?: Sequence
  shot?: Shot
  timeline: EditorTimeline
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function overallStatus(overall: number, strongIssueCount: number, warningIssueCount: number): ClipReview['status'] {
  if (strongIssueCount >= 2 || overall < 45) return 'not-recommended'
  if (strongIssueCount >= 1 || overall < 60) return 'needs-regenerate'
  if (warningIssueCount >= 2 || overall < 78) return 'needs-adjustment'
  return 'usable'
}

export function buildClipReview(input: BuildClipReviewInput): ClipReview {
  const { job, frame, roleBible, styleBible, sequence, shot, timeline } = input
  const issues: ClipReview['issues'] = []

  let characterScore = 88
  const hasRoleBinding = Boolean(job.roleBibleId && job.consistencyKey && job.characterConsistency)
  if (!hasRoleBinding) {
    characterScore -= 30
    issues.push({
      id: `${job.id}-character`,
      type: 'character-drift',
      message: '该镜头没有绑定角色一致性信息，可能影响长视频人物统一。',
      severity: 'strong',
    })
  } else {
    characterScore += Math.round((job.characterConsistencyScore - 70) * 0.35)
    if (roleBible?.status === 'locked') {
      characterScore += 6
    }
  }

  let styleScore = 86
  if (!styleBible?.colorGrade || (frame?.colorGrade && styleBible?.colorGrade && frame.colorGrade !== styleBible.colorGrade)) {
    styleScore -= 18
    issues.push({
      id: `${job.id}-style`,
      type: 'style-mismatch',
      message: '当前镜头的色彩或影像风格与 Style Bible 不完全一致。',
      severity: 'warning',
    })
  }
  if (job.styleConsistency < 70) {
    styleScore -= 18
  }

  let motionScore = 84
  if (/(bullet-time|reverse|fast)/i.test(job.movement) || /(bullet-time|reverse|fast)/i.test(frame?.movement ?? '')) {
    motionScore -= 24
    issues.push({
      id: `${job.id}-motion`,
      type: 'motion-artifact',
      message: '当前使用了复杂运动方案，运动质量和边缘伪影需要更谨慎地检查。',
      severity: 'warning',
    })
  }
  if (job.motionStrength > 78) motionScore -= 10

  let narrativeScore = 87
  if (sequence?.goal && shot?.intent && !sequence.goal.includes(shot.intent) && !sequence.goal.includes(frame?.intent ?? '')) {
    narrativeScore -= 24
    issues.push({
      id: `${job.id}-narrative`,
      type: 'weak-narrative-fit',
      message: '当前镜头意图与 sequence goal 的贴合度偏弱，叙事位置可能不够成立。',
      severity: 'warning',
    })
  }

  const ordered = [...timeline.clips].sort((a, b) => a.order - b.order)
  const repetitiveMovement = ordered.filter((clip) => clip.pacing === 'fast').length >= 2 && /fast|dolly|push/i.test(job.movement)
  let editFitScore = 84
  if (job.duration >= 15 || repetitiveMovement) {
    editFitScore -= 22
    issues.push({
      id: `${job.id}-edit`,
      type: 'editing-risk',
      message: '当前镜头时长或运动方式会让剪辑节奏更难控制，进入时间线前建议先审慎确认。',
      severity: job.duration >= 15 ? 'strong' : 'warning',
    })
  }

  const scores = {
    characterConsistency: clamp(characterScore),
    styleConsistency: clamp(styleScore),
    motionQuality: clamp(motionScore),
    narrativeFit: clamp(narrativeScore),
    editFit: clamp(editFitScore),
    overall: 0,
  }

  scores.overall = clamp((scores.characterConsistency + scores.styleConsistency + scores.motionQuality + scores.narrativeFit + scores.editFit) / 5)

  const strongIssueCount = issues.filter((issue) => issue.severity === 'strong').length
  const warningIssueCount = issues.filter((issue) => issue.severity === 'warning').length
  const status = overallStatus(scores.overall, strongIssueCount, warningIssueCount)

  const recommendations: ClipReview['recommendations'] = [
    {
      id: `${job.id}-accept`,
      label: '接受当前镜头',
      action: 'accept',
      message: '把当前镜头标记为可用审片结果，但是否进入剪辑仍然由你决定。',
    },
    {
      id: `${job.id}-editor`,
      label: '送入剪辑台',
      action: 'send-to-editor',
      message: '如果这条镜头已经满足叙事需求，可以手动加入 Editor Timeline。',
    },
  ]

  if (!hasRoleBinding) {
    recommendations.unshift({
      id: `${job.id}-casting`,
      label: '先补角色设定',
      action: 'open-casting',
      message: '先到选角面板锁定角色，再决定是否继续生成或送入剪辑台，会更利于长视频人物一致性。',
    })
  }

  if (issues.some((issue) => issue.type === 'motion-artifact' || issue.type === 'editing-risk')) {
    recommendations.push({
      id: `${job.id}-adjust-motion`,
      label: '调整运动设置',
      action: 'adjust-motion',
      message: '先回到运动面板降低 motion strength 或改变 movement，再决定是否重生成。',
    })
  }

  if (issues.some((issue) => issue.type === 'style-mismatch')) {
    recommendations.push({
      id: `${job.id}-provider`,
      label: '切换 provider',
      action: 'change-provider',
      message: '如果当前 provider 的风格稳定性不足，可以换一个生成源再试。',
    })
  }

  if (issues.some((issue) => issue.type === 'weak-narrative-fit')) {
    recommendations.push({
      id: `${job.id}-prompt`,
      label: '修改视频提示词',
      action: 'edit-prompt',
      message: '补强 narrative fit 的最快方式通常是先改 video prompt，而不是直接放弃镜头。',
    })
  }

  if (status === 'needs-regenerate' || status === 'not-recommended') {
    recommendations.push({
      id: `${job.id}-regen`,
      label: '重生成此镜头',
      action: 'regenerate',
      message: '只有在你确认后，系统才会创建一条新的生成任务，不会自动替换原镜头。',
    })
  }

  return {
    id: `review-${job.id}`,
    clipId: job.id,
    sourceJobId: job.id,
    sourceFrameId: job.storyboardFrameId,
    roleBibleId: job.roleBibleId,
    consistencyKey: job.consistencyKey,
    scores,
    status,
    issues,
    recommendations,
    createdAt: new Date().toISOString(),
  }
}
