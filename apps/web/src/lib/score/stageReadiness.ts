import type { ScoreSystemResult } from '@/lib/score/scoreSystem'
import type { NarrativeInsight } from '@/store/shots.store'
import type { ProjectStage } from '@/store/team.store'

export interface StageIssue {
  id: string
  title: string
  message: string
  targetSequenceId?: string
  targetShotId?: string
}

export interface StageActionSuggestion {
  id: string
  label: string
  panel?: 'ai' | 'insight' | 'previs' | 'gear' | 'camera' | 'lighting' | 'color' | 'movement' | 'style' | 'reference' | 'casting' | 'notes' | 'version' | 'approval' | 'audio'
  targetSequenceId?: string
  targetShotId?: string
}

export interface StageReadiness {
  currentStage: ProjectStage
  nextStage: ProjectStage | null
  score: number
  status: 'blocked' | 'needs-review' | 'ready'
  blockers: StageIssue[]
  warnings: StageIssue[]
  suggestedActions: StageActionSuggestion[]
  highlights?: string[]
}

type StageReadinessInput = {
  currentStage: ProjectStage
  scoreSummary: ScoreSystemResult
  insights: NarrativeInsight[]
  selectedStoryboardFrameCount?: number
  doneDerivativeJobCount?: number
  editorClipCount?: number
  allEditorClipsReady?: boolean
  unreviewedVideoShotCount?: number
  strongIssueClipCount?: number
  lockedRoleBibleCount?: number
  openBlockerNoteCount?: number
  highPriorityOpenNoteCount?: number
  recentImportantVersionCount?: number
  approvalBlockers?: StageIssue[]
  approvalWarnings?: StageIssue[]
  selectedMusicCueCount?: number
  unapprovedDialogueCount?: number
  approvedDialogueWithoutSelectedVoiceCount?: number
  unknownLicenseMusicCount?: number
  pendingLipSyncJobCount?: number
  strongAudioIssueCount?: number
  cueSheetDraftCount?: number
  deliveryPackageCount?: number
  deliveryPackageReadyCount?: number
  deliveryPackageStrongRiskCount?: number
}

const STAGE_FLOW: ProjectStage[] = ['idea', 'storyboard', 'shooting', 'editing', 'delivery']

function getNextStage(currentStage: ProjectStage): ProjectStage | null {
  const index = STAGE_FLOW.indexOf(currentStage)
  return STAGE_FLOW[index + 1] ?? null
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function buildStageReadiness(input: StageReadinessInput): StageReadiness {
  const {
    currentStage,
    scoreSummary,
    insights,
    selectedStoryboardFrameCount = 0,
    doneDerivativeJobCount = 0,
    editorClipCount = 0,
    allEditorClipsReady = false,
    unreviewedVideoShotCount = 0,
    strongIssueClipCount = 0,
    lockedRoleBibleCount = 0,
    openBlockerNoteCount = 0,
    highPriorityOpenNoteCount = 0,
    recentImportantVersionCount = 0,
    approvalBlockers = [],
    approvalWarnings = [],
    selectedMusicCueCount = 0,
    unapprovedDialogueCount = 0,
    approvedDialogueWithoutSelectedVoiceCount = 0,
    unknownLicenseMusicCount = 0,
    pendingLipSyncJobCount = 0,
    strongAudioIssueCount = 0,
    cueSheetDraftCount = 0,
    deliveryPackageCount = 0,
    deliveryPackageReadyCount = 0,
    deliveryPackageStrongRiskCount = 0,
  } = input
  const structureAnalysis = scoreSummary.breakdown.structureAnalysis
  let score = 100
  const blockers: StageIssue[] = []
  const warnings: StageIssue[] = []
  const suggestedActions: StageActionSuggestion[] = []
  const highlights: string[] = []

  const missingRequiredSequence = structureAnalysis.issues.find((issue) => issue.type === 'missing-sequence')
  if (missingRequiredSequence) {
    score -= 25
    blockers.push({
      id: `stage-missing-${missingRequiredSequence.id}`,
      title: '缺少必备段落',
      message: missingRequiredSequence.message,
      targetSequenceId: missingRequiredSequence.targetSequenceId,
    })
    suggestedActions.push({
      id: 'stage-open-missing-sequence',
      label: '补齐缺失段落',
      panel: 'ai',
      targetSequenceId: missingRequiredSequence.targetSequenceId,
    })
  }

  const keySequenceWithoutShots = scoreSummary.breakdown.sequenceScores.find((sequence) => {
    const isKey = /Hook|Opening|Establish|Attention|CTA|Resolve|Payoff/i.test(sequence.name)
    return isKey && sequence.shotCount === 0
  })
  if (keySequenceWithoutShots) {
    score -= 20
    blockers.push({
      id: `stage-key-empty-${keySequenceWithoutShots.sequenceId}`,
      title: '关键段落还没有镜头',
      message: `${keySequenceWithoutShots.name} 目前没有 shot，这会直接影响阶段推进判断。`,
      targetSequenceId: keySequenceWithoutShots.sequenceId,
    })
    suggestedActions.push({
      id: 'stage-fill-key-sequence',
      label: '先补关键段落',
      panel: 'ai',
      targetSequenceId: keySequenceWithoutShots.sequenceId,
    })
  }

  const missingIntentOnKeyShot = scoreSummary.issues.find((issue) => issue.targetShotId && issue.title.includes('缺少意图'))
  if (missingIntentOnKeyShot) {
    score -= 10
    warnings.push({
      id: `stage-intent-${missingIntentOnKeyShot.id}`,
      title: '关键镜头缺少 intent',
      message: missingIntentOnKeyShot.message,
      targetShotId: missingIntentOnKeyShot.targetShotId,
    })
    suggestedActions.push({
      id: 'stage-edit-intent',
      label: '补齐镜头意图',
      panel: 'style',
      targetShotId: missingIntentOnKeyShot.targetShotId,
    })
  }

  if (scoreSummary.breakdown.narrativeScore < 70) {
    score -= 15
    warnings.push({
      id: 'stage-low-narrative',
      title: 'Narrative Score 偏低',
      message: `当前 Narrative Score 为 ${scoreSummary.breakdown.narrativeScore}，结构表达还不够稳。`,
    })
  }

  if (scoreSummary.breakdown.rhythmScore < 60) {
    score -= 10
    warnings.push({
      id: 'stage-low-rhythm',
      title: 'Rhythm Score 偏低',
      message: `当前 Rhythm Score 为 ${scoreSummary.breakdown.rhythmScore}，节奏层次仍需补强。`,
    })
    suggestedActions.push({
      id: 'stage-refine-rhythm',
      label: '先优化节奏',
      panel: 'camera',
    })
  }

  const strongInsight = insights.find((insight) => insight.level === 'strong')
  if (strongInsight) {
    score -= 20
    blockers.push({
      id: `stage-strong-${strongInsight.id}`,
      title: '存在强阻塞洞察',
      message: strongInsight.message,
      targetSequenceId: strongInsight.targetSequenceId,
      targetShotId: strongInsight.targetShotId,
    })
    suggestedActions.push({
      id: 'stage-view-strong-insight',
      label: '先处理强阻塞',
      panel: strongInsight.suggestedAction.panel ?? 'insight',
      targetSequenceId: strongInsight.targetSequenceId,
      targetShotId: strongInsight.targetShotId,
    })
  }

  const nextStage = getNextStage(currentStage)
  const enteringVisualProduction = nextStage === 'shooting' || currentStage === 'shooting'
  if (enteringVisualProduction && lockedRoleBibleCount === 0) {
    warnings.push({
      id: 'stage-role-bible-missing',
      title: '还没有锁定角色设定',
      message: '当前还没有锁定角色设定，长视频人物一致性可能不稳定。',
    })
    suggestedActions.push({
      id: 'stage-open-casting',
      label: '打开选角',
      panel: 'casting',
    })
  }
  if (enteringVisualProduction && selectedStoryboardFrameCount === 0) {
    warnings.push({
      id: 'stage-storyboard-previs',
      title: '还没有选中需要使用的分镜单帧',
      message: '请先从分镜预演中选择需要使用的镜头单帧。',
    })
    suggestedActions.push({
      id: 'stage-open-previs',
      label: '打开分镜预演',
      panel: 'previs',
    })
  }

  const enteringEditing = nextStage === 'editing' || currentStage === 'editing'
  if (enteringEditing && doneDerivativeJobCount === 0) {
    warnings.push({
      id: 'stage-editor-clips-missing',
      title: '还没有可剪辑的视频镜头',
      message: '当前还没有可剪辑的视频镜头，请先从选中分镜生成视频镜头。',
    })
    suggestedActions.push({
      id: 'stage-open-editor-desk',
      label: '前往剪辑台',
      panel: 'previs',
    })
  }

  if (enteringEditing && unreviewedVideoShotCount > 0) {
    warnings.push({
      id: 'stage-unreviewed-video-shots',
      title: '存在未审片的视频镜头',
      message: `当前还有 ${unreviewedVideoShotCount} 条视频镜头没有经过审片，不建议直接进入剪辑细化。`,
    })
  }

  const enteringDelivery = nextStage === 'delivery' || currentStage === 'delivery'
  if (enteringDelivery && editorClipCount === 0) {
    warnings.push({
      id: 'stage-editor-timeline-empty',
      title: '还没有剪辑序列',
      message: '当前还没有剪辑序列，不建议直接进入交付。',
    })
    suggestedActions.push({
      id: 'stage-open-editor',
      label: '前往剪辑台',
      panel: 'previs',
    })
  }

  if (enteringDelivery && selectedMusicCueCount === 0) {
    warnings.push({
      id: 'stage-audio-music-missing',
      title: '还没有确认音乐候选',
      message: '声音制作仍有未确认项，不建议直接交付。',
    })
    suggestedActions.push({
      id: 'stage-open-audio-music',
      label: '打开声音台',
      panel: 'audio',
    })
  }

  if (enteringDelivery && unapprovedDialogueCount > 0) {
    warnings.push({
      id: 'stage-audio-dialogue-unapproved',
      title: '仍有台词未确认',
      message: `当前还有 ${unapprovedDialogueCount} 条台词没有确认，建议先完成对白与配音判断。`,
    })
    suggestedActions.push({
      id: 'stage-open-audio-dialogue',
      label: '检查台词与配音',
      panel: 'audio',
    })
  }

  if (enteringDelivery && approvedDialogueWithoutSelectedVoiceCount > 0) {
    warnings.push({
      id: 'stage-audio-voice-unselected',
      title: '仍有对白没有选定配音',
      message: `当前还有 ${approvedDialogueWithoutSelectedVoiceCount} 条已确认台词没有选定 voice take，建议先完成声音版本选择。`,
    })
    suggestedActions.push({
      id: 'stage-open-audio-voice',
      label: '检查配音选择',
      panel: 'audio',
    })
  }

  if (enteringDelivery && pendingLipSyncJobCount > 0) {
    warnings.push({
      id: 'stage-audio-lipsync-pending',
      title: '口型同步仍未完成',
      message: `当前还有 ${pendingLipSyncJobCount} 条口型同步任务未完成，直接交付存在声画不同步风险。`,
    })
    suggestedActions.push({
      id: 'stage-open-audio-lipsync',
      label: '检查口型同步',
      panel: 'audio',
    })
  }

  if (enteringDelivery && strongAudioIssueCount > 0) {
    warnings.push({
      id: 'stage-audio-strong-issues',
      title: '声音审查存在强风险项',
      message: '声音制作仍有未确认项，不建议直接交付。',
    })
    suggestedActions.push({
      id: 'stage-open-audio-review',
      label: '复查声音风险',
      panel: 'audio',
    })
  }

  if (enteringDelivery && unknownLicenseMusicCount > 0) {
    warnings.push({
      id: 'stage-audio-license-risk',
      title: '存在授权未确认的音乐',
      message: '当前存在 licenseStatus 为 unknown 的音乐候选，商业交付前建议先完成授权确认。',
    })
    suggestedActions.push({
      id: 'stage-open-audio-license',
      label: '复查音乐授权',
      panel: 'audio',
    })
  }

  if (enteringDelivery && cueSheetDraftCount > 0) {
    warnings.push({
      id: 'stage-audio-cue-sheet-draft',
      title: 'Cue Sheet 仍处于草稿状态',
      message: '声音节奏点还没有被正式确认，建议先复查声画时间线与 cue sheet。',
    })
    suggestedActions.push({
      id: 'stage-open-audio-cue-sheet',
      label: '检查声画时间线',
      panel: 'audio',
    })
  }

  if (enteringDelivery && deliveryPackageCount === 0) {
    warnings.push({
      id: 'stage-delivery-package-missing',
      title: '还没有创建交付包',
      message: '进入交付前建议先整理一份交付包，明确包含哪些资产、确认记录与版本依据。',
    })
    suggestedActions.push({
      id: 'stage-open-delivery-package',
      label: '创建交付包',
    })
  }

  if (enteringDelivery && deliveryPackageCount > 0 && deliveryPackageReadyCount === 0) {
    warnings.push({
      id: 'stage-delivery-package-not-ready',
      title: '交付包尚未 ready / submitted',
      message: '当前交付包仍有未确认项或尚未整理完成，不建议直接交付。',
    })
    suggestedActions.push({
      id: 'stage-review-delivery-package',
      label: '检查交付包',
    })
  }

  if (enteringDelivery && deliveryPackageStrongRiskCount > 0) {
    warnings.push({
      id: 'stage-delivery-package-strong-risk',
      title: '交付包存在高风险项',
      message: '当前交付包仍有未确认或高风险项，不建议直接交付。',
    })
    suggestedActions.push({
      id: 'stage-review-delivery-risks',
      label: '复查交付风险',
    })
  }

  if (strongIssueClipCount > 0) {
    warnings.push({
      id: 'stage-strong-clip-issues',
      title: '剪辑序列中存在强风险镜头',
      message: `当前时间线中还有 ${strongIssueClipCount} 条镜头带有 strong issue，建议先人工复核。`,
    })
  }

  if (openBlockerNoteCount > 0) {
    score -= 15
    warnings.push({
      id: 'stage-open-blocker-notes',
      title: '存在阻塞级导演批注',
      message: '当前仍有阻塞级导演批注未解决，不建议进入下一阶段。',
    })
    suggestedActions.push({
      id: 'stage-open-notes',
      label: '打开批注',
      panel: 'notes',
    })
  }

  if (highPriorityOpenNoteCount > 0) {
    warnings.push({
      id: 'stage-high-priority-notes',
      title: '存在高优先级批注',
      message: `当前还有 ${highPriorityOpenNoteCount} 条高优先级导演批注待处理，建议先复核。`,
    })
  }

  if (recentImportantVersionCount > 0) {
    warnings.push({
      id: 'stage-recent-important-version',
      title: '关键对象最近发生修改',
      message: '部分关键镜头最近发生修改，建议复查后再进入下一阶段。',
    })
    suggestedActions.push({
      id: 'stage-open-version',
      label: '查看版本',
      panel: 'version',
    })
  }

  if (approvalBlockers.length > 0) {
    score -= 20
    blockers.push(...approvalBlockers)
    suggestedActions.push({
      id: 'stage-open-approval-blockers',
      label: '处理确认项',
      panel: 'approval',
      targetSequenceId: approvalBlockers[0]?.targetSequenceId,
      targetShotId: approvalBlockers[0]?.targetShotId,
    })
  }

  if (approvalWarnings.length > 0) {
    score -= 8
    warnings.push(...approvalWarnings)
    suggestedActions.push({
      id: 'stage-open-approval-warnings',
      label: '查看确认状态',
      panel: 'approval',
      targetSequenceId: approvalWarnings[0]?.targetSequenceId,
      targetShotId: approvalWarnings[0]?.targetShotId,
    })
  }

  if (allEditorClipsReady && editorClipCount > 0) {
    highlights.push('剪辑方案已具备基础交付结构。')
  }

  const finalScore = clampScore(score)
  const status = finalScore >= 80 ? 'ready' : finalScore >= 60 ? 'needs-review' : 'blocked'

  if (suggestedActions.length === 0) {
    suggestedActions.push({
      id: 'stage-review',
      label: '查看当前分析',
      panel: 'insight',
    })
  }

  return {
    currentStage,
    nextStage,
    score: finalScore,
    status,
    blockers,
    warnings,
    suggestedActions,
    highlights,
  }
}
