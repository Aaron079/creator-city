import type { AudioSyncIssue, AudioTimeline, AudioTimelineClip, CueSheet, DialogueLine, LipSyncJob, MusicCue, MusicCuePoint, MusicMotif, SoundEffectCue, VoiceTake, AudioSyncReview } from '@/store/audio-desk.store'
import type { EditorClip, EditorTimeline, RoleBible, Sequence, Shot } from '@/store/shots.store'
import { createAudioId } from '@/store/audio-desk.store'

const MOCK_AUDIO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3'
const MOCK_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

export function generateMockVoiceTakes(line: DialogueLine, role?: RoleBible | null): VoiceTake[] {
  const baseVoice = role?.consistencyKey?.slice(0, 8) ?? 'voice-core'
  return [
    {
      id: createAudioId('voice'),
      dialogueLineId: line.id,
      provider: 'mock',
      voiceId: `${baseVoice}-a`,
      style: '自然叙述',
      speed: 1,
      emotion: line.emotion,
      audioUrl: MOCK_AUDIO_URL,
      duration: Math.max(2, Math.min(10, Math.ceil(line.text.length / 8))),
      status: 'draft',
    },
    {
      id: createAudioId('voice'),
      dialogueLineId: line.id,
      provider: 'mock',
      voiceId: `${baseVoice}-b`,
      style: line.emotion === 'commercial' ? '广告旁白' : '情绪化表达',
      speed: line.emotion === 'whisper' ? 0.9 : 1.05,
      emotion: line.emotion,
      audioUrl: MOCK_AUDIO_URL,
      duration: Math.max(2, Math.min(10, Math.ceil(line.text.length / 9))),
      status: 'draft',
    },
  ]
}

export function createMockLipSyncJob(args: {
  targetVideoClipId: string
  voiceTakeId: string
  provider: LipSyncJob['provider']
}): LipSyncJob {
  const { targetVideoClipId, voiceTakeId, provider } = args
  return {
    id: createAudioId('lipsync'),
    targetVideoClipId,
    voiceTakeId,
    provider,
    status: provider === 'mock' ? 'done' : 'failed',
    outputVideoUrl: provider === 'mock' ? MOCK_VIDEO_URL : undefined,
    syncScore: provider === 'mock' ? 81 : undefined,
    error: provider === 'mock' ? undefined : `${provider} 尚未接入，当前仅提供 mock lip sync。`,
  }
}

export function generateMockMusicCues(args: {
  sequence?: Sequence | null
  timelineId: string
  existingClipCount: number
}): MusicCue[] {
  const { sequence, timelineId, existingClipCount } = args
  const mood: MusicCue['mood'] = sequence?.name?.match(/Hook|CTA|Attention/i) ? 'commercial' : sequence?.name?.match(/Resolve|Ending/i) ? 'hope' : 'warm'
  const tempo: MusicCue['tempo'] = existingClipCount >= 4 ? 'fast' : existingClipCount >= 2 ? 'medium' : 'slow'
  return [
    {
      id: createAudioId('music'),
      targetSequenceId: sequence?.id,
      targetEditorTimelineId: timelineId,
      mood,
      tempo,
      intensityCurve: mood === 'commercial' ? 'rising' : 'wave',
      provider: 'mock',
      prompt: `${sequence?.name ?? '主时间线'} ${sequence?.goal ?? '情绪推进'}，${mood} 气质，${tempo} 节奏。`,
      audioUrl: MOCK_AUDIO_URL,
      duration: 15,
      licenseStatus: 'unknown',
      status: 'draft',
    },
    {
      id: createAudioId('music'),
      targetSequenceId: sequence?.id,
      targetEditorTimelineId: timelineId,
      mood: mood === 'commercial' ? 'epic' : 'commercial',
      tempo: 'medium',
      intensityCurve: 'wave',
      provider: 'mock',
      prompt: `作为备选的 ${sequence?.name ?? '时间线'} 配乐，强调转场和商业完成度。`,
      audioUrl: MOCK_AUDIO_URL,
      duration: 20,
      licenseStatus: 'user-provided',
      status: 'draft',
    },
  ]
}

export function generateMockSoundEffects(clip: EditorClip): SoundEffectCue[] {
  return [
    {
      id: createAudioId('sfx'),
      targetClipId: clip.id,
      category: 'whoosh',
      description: `${clip.title} 的转场 whoosh，适合增强入场速度感。`,
      audioUrl: MOCK_AUDIO_URL,
      provider: 'mock',
      status: 'draft',
    },
    {
      id: createAudioId('sfx'),
      targetClipId: clip.id,
      category: 'ambient',
      description: `${clip.title} 的环境氛围层，用于补足空间感。`,
      audioUrl: MOCK_AUDIO_URL,
      provider: 'mock',
      status: 'draft',
    },
  ]
}

export function buildAudioSyncReview(args: {
  clip: EditorClip
  shot?: Shot
  sequence?: Sequence
  line?: DialogueLine
  selectedVoiceTake?: VoiceTake
  selectedMusicCue?: MusicCue
  selectedSoundEffects: SoundEffectCue[]
  lipSyncJob?: LipSyncJob
  lockedRole?: RoleBible | null
  timeline: EditorTimeline
}): AudioSyncReview {
  const {
    clip,
    shot,
    sequence,
    line,
    selectedVoiceTake,
    selectedMusicCue,
    selectedSoundEffects,
    lipSyncJob,
    lockedRole,
    timeline,
  } = args

  let dialogueSyncScore = line ? 84 : 58
  let lipSyncScore = lipSyncJob?.syncScore ?? 42
  let musicFitScore = selectedMusicCue ? 80 : 48
  let sfxFitScore = selectedSoundEffects.length > 0 ? 76 : 55
  const issues: AudioSyncReview['issues'] = []

  if (line && selectedVoiceTake && selectedVoiceTake.duration > clip.duration + 2) {
    dialogueSyncScore -= 18
    issues.push({
      id: createAudioId('audio-issue'),
      type: 'dialogue-too-long',
      targetClipId: clip.id,
      message: '当前台词时长明显长于镜头时长，进入交付前建议先压缩或拆分。',
      severity: 'strong',
      suggestedAction: 'adjust-dialogue',
    })
  }

  if (line && !lipSyncJob && lockedRole) {
    lipSyncScore -= 16
    issues.push({
      id: createAudioId('audio-issue'),
      type: 'lip-sync-offset',
      targetClipId: clip.id,
      message: '当前镜头已经绑定角色一致性，但还没有对应的口型同步结果。',
      severity: 'warning',
      suggestedAction: 'run-lipsync',
    })
  }

  if (selectedMusicCue && sequence && !selectedMusicCue.prompt.includes(sequence.name)) {
    musicFitScore -= 12
    issues.push({
      id: createAudioId('audio-issue'),
      type: 'weak-emotion-match',
      targetClipId: clip.id,
      message: '当前配乐候选和段落目标的情绪关键词不够贴合，建议复核 mood/tempo。',
      severity: 'warning',
      suggestedAction: 'change-music',
    })
  }

  if (selectedSoundEffects.length >= 3) {
    sfxFitScore -= 14
    issues.push({
      id: createAudioId('audio-issue'),
      type: 'music-over-dialogue',
      targetClipId: clip.id,
      message: '这条镜头叠加的音效较多，可能会抢占对白和音乐的空间。',
      severity: 'warning',
      suggestedAction: 'shift-cue',
    })
  }

  if (timeline.clips.length > 1 && clip.order > 0 && shot?.intent && sequence?.goal && !sequence.goal.includes(shot.intent.slice(0, 2))) {
    dialogueSyncScore -= 8
    issues.push({
      id: createAudioId('audio-issue'),
      type: 'abrupt-transition',
      targetClipId: clip.id,
      message: '当前对白和段落目标的进入时机略偏，建议检查是否应前移或后移入点。',
      severity: 'info',
      suggestedAction: 'shift-cue',
    })
  }

  const recommendations: AudioSyncReview['recommendations'] = []
  if (!selectedVoiceTake) {
    recommendations.push({ label: '先选择配音候选', action: 'regenerate-voice' })
  }
  if (selectedVoiceTake && !lipSyncJob) {
    recommendations.push({ label: '运行口型同步', action: 'run-lipsync' })
  }
  if (!selectedMusicCue) {
    recommendations.push({ label: '补一个配乐候选', action: 'change-music' })
  }
  if (issues.some((issue) => issue.type === 'dialogue-too-long')) {
    recommendations.push({ label: '调整台词长度', action: 'adjust-dialogue' })
  }
  if (issues.some((issue) => issue.type === 'abrupt-transition')) {
    recommendations.push({ label: '微调声音入点', action: 'shift-cue' })
  }
  if (selectedVoiceTake || selectedMusicCue || selectedSoundEffects.length > 0) {
    recommendations.push({ label: '发送到剪辑台参考', action: 'send-to-editor' })
  }

  return {
    id: createAudioId('audio-review'),
    targetClipId: clip.id,
    dialogueSyncScore: Math.max(0, Math.min(100, Math.round(dialogueSyncScore))),
    lipSyncScore: Math.max(0, Math.min(100, Math.round(lipSyncScore))),
    musicFitScore: Math.max(0, Math.min(100, Math.round(musicFitScore))),
    sfxFitScore: Math.max(0, Math.min(100, Math.round(sfxFitScore))),
    issues,
    recommendations,
  }
}

export function createAudioTimelineClip(args: {
  sourceType: AudioTimelineClip['sourceType']
  sourceId: string
  targetEditorClipId?: string
  targetSequenceId?: string
  startTime: number
  endTime: number
  volume?: number
  syncStatus?: AudioTimelineClip['syncStatus']
}): AudioTimelineClip {
  return {
    id: createAudioId('audio-clip'),
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    targetEditorClipId: args.targetEditorClipId,
    targetSequenceId: args.targetSequenceId,
    startTime: args.startTime,
    endTime: args.endTime,
    volume: args.volume ?? (args.sourceType === 'music-cue' ? 58 : 82),
    fadeIn: args.sourceType === 'music-cue' ? 0.6 : 0.1,
    fadeOut: args.sourceType === 'music-cue' ? 1 : 0.15,
    locked: false,
    syncStatus: args.syncStatus ?? (args.sourceType === 'lip-sync-job' ? 'rough-sync' : 'unsynced'),
  }
}

export function buildCueSheet(args: {
  timelineId: string
  sequences: Sequence[]
  clips: EditorClip[]
  musicDirection?: string
}): CueSheet {
  const cues: MusicCuePoint[] = args.clips.slice(0, 6).map((clip, index) => ({
    id: createAudioId('cue'),
    timecode: `${String(index * 3).padStart(2, '0')}:00`,
    targetClipId: clip.id,
    targetSequenceId: args.sequences.find((sequence) => sequence.shotIds.some((shotId) => shotId === clip.sourceFrameId))?.id,
    cueType: index === 0 ? 'theme-entry' : index === args.clips.length - 1 ? 'ending-resolution' : index % 2 === 0 ? 'emotion-rise' : 'transition-hit',
    mood: index === 0 ? 'commercial' : index === args.clips.length - 1 ? 'hope' : 'warm',
    intensity: Math.min(100, 35 + index * 12),
    description: index === 0 ? '主题进入，建立整体情绪基调。' : `为 ${clip.title} 设计的音乐提示点。`,
    suggestedInstrumentation: index === 0 ? 'synth pulse + soft piano' : index % 2 === 0 ? 'strings swell' : 'percussion hit',
    approved: false,
  }))

  return {
    id: createAudioId('cue-sheet'),
    timelineId: args.timelineId,
    cues,
    musicDirection: args.musicDirection,
    status: 'draft',
  }
}

export function buildMusicMotifs(args: {
  roles: RoleBible[]
  sequences: Sequence[]
  narrativeType?: string
}): MusicMotif[] {
  const motifs: MusicMotif[] = []
  args.roles.slice(0, 2).forEach((role) => {
    motifs.push({
      id: createAudioId('motif'),
      name: `${role.name} Theme`,
      targetType: 'character',
      targetId: role.id,
      description: `${role.name} 的角色主题，用来稳定人物情绪和出现时的听觉识别。`,
      instrumentation: role.performanceStyle.actingStyle === 'advertising' ? 'bright synth + clean plucks' : 'piano + strings',
      tempo: role.performanceStyle.energy === 'high' ? 'fast' : role.performanceStyle.energy === 'medium' ? 'medium' : 'slow',
      moodTags: ['warm', 'hope'],
      audioUrl: MOCK_AUDIO_URL,
      status: 'draft',
    })
  })
  motifs.push({
    id: createAudioId('motif'),
    name: `${args.narrativeType ?? 'brand'} Core`,
    targetType: 'brand',
    targetId: args.narrativeType ?? 'creator-city',
    description: '品牌/项目核心主题，适合用于开场和收尾的音乐收束。',
    instrumentation: 'hybrid synth + pulse bass',
    tempo: 'medium',
    moodTags: ['commercial', 'epic'],
    audioUrl: MOCK_AUDIO_URL,
    status: 'draft',
  })
  if (args.sequences.length > 0) {
    motifs.push({
      id: createAudioId('motif'),
      name: `${args.sequences[0]!.name} Mood`,
      targetType: 'theme',
      targetId: args.sequences[0]!.id,
      description: '围绕当前叙事段落的情绪主题，用于强化 sequence 的起伏和过门。',
      instrumentation: 'ambient pad + soft percussion',
      tempo: 'slow',
      moodTags: ['mysterious', 'warm'],
      audioUrl: MOCK_AUDIO_URL,
      status: 'draft',
    })
  }
  return motifs
}

export function analyzeAudioTimelineIssues(args: {
  editorTimeline: EditorTimeline
  audioTimeline: AudioTimeline | null
  dialogueLines: DialogueLine[]
  voiceTakes: VoiceTake[]
  musicCues: MusicCue[]
  lipSyncJobs: LipSyncJob[]
  soundEffectCues: SoundEffectCue[]
  sequences: Sequence[]
}): AudioSyncIssue[] {
  const {
    editorTimeline,
    audioTimeline,
    dialogueLines,
    musicCues,
    lipSyncJobs,
    soundEffectCues,
    sequences,
  } = args

  const issues: AudioSyncIssue[] = []
  const trackMap = new Map(audioTimeline?.tracks.map((track) => [track.type, track]) ?? [])
  const dialogueTrack = trackMap.get('dialogue')
  const musicTrack = trackMap.get('music')
  const sfxTrack = trackMap.get('sfx')
  const lipSyncTrack = trackMap.get('lip-sync')

  dialogueLines.forEach((line) => {
    if (!line.targetClipId) return
    const clip = editorTimeline.clips.find((item) => item.id === line.targetClipId)
    if (!clip) return
    if (line.endTime - line.startTime > clip.duration) {
      issues.push({
        id: createAudioId('audio-issue'),
        type: 'dialogue-too-long',
        severity: 'strong',
        message: 'DialogueLine 时长超过目标镜头时长，建议先压缩对白或拆分镜头。',
        targetClipId: clip.id,
        suggestedAction: 'adjust-dialogue',
      })
    }
  })

  musicCues.filter((cue) => cue.status === 'selected').forEach((cue) => {
    if (cue.licenseStatus === 'unknown') {
      issues.push({
        id: createAudioId('audio-issue'),
        type: 'license-risk',
        severity: 'warning',
        message: '当前选中的音乐授权状态仍为 unknown，商业交付前建议先确认授权来源。',
        suggestedAction: 'review-license',
      })
    }
    const overlappingDialogue = dialogueTrack?.clips.some((clip) => musicTrack?.clips.some((musicClip) => (
      musicClip.sourceId === cue.id
      && clip.targetEditorClipId === musicClip.targetEditorClipId
      && musicClip.volume > 60
    )))
    if (overlappingDialogue) {
      issues.push({
        id: createAudioId('audio-issue'),
        type: 'music-over-dialogue',
        severity: 'warning',
        message: '当前音乐条带可能压住对白区域，建议下压音乐音量或腾出对白空间。',
        suggestedAction: 'change-music',
      })
    }
    const targetSequence = cue.targetSequenceId ? sequences.find((sequence) => sequence.id === cue.targetSequenceId) : undefined
    if (targetSequence && !cue.prompt.includes(targetSequence.name) && !cue.prompt.includes(targetSequence.goal.slice(0, 2))) {
      issues.push({
        id: createAudioId('audio-issue'),
        type: 'weak-emotion-match',
        severity: 'warning',
        message: '当前配乐候选和 sequence 情绪目标不够贴合，建议调整 mood 或换一个候选。',
        targetClipId: editorTimeline.clips[0]?.id,
        suggestedAction: 'change-music',
      })
    }
  })

  lipSyncJobs.filter((job) => job.status === 'done' && (job.syncScore ?? 0) < 75).forEach((job) => {
    const audioClip = lipSyncTrack?.clips.find((clip) => clip.sourceId === job.id)
    issues.push({
      id: createAudioId('audio-issue'),
      type: 'lip-sync-offset',
      severity: 'warning',
      message: 'Lip sync 分数偏低，建议复查口型和对白对齐。',
      targetAudioClipId: audioClip?.id,
      suggestedAction: 'run-lipsync',
    })
  })

  editorTimeline.clips.forEach((clip, index) => {
    const hasStrongTransition = clip.transition === 'match-cut' || clip.transition === 'dissolve' || clip.transition === 'fade'
    const hasTransitionHit = sfxTrack?.clips.some((audioClip) => audioClip.targetEditorClipId === clip.id) || soundEffectCues.some((cue) => cue.targetClipId === clip.id && cue.status === 'selected')
    if (hasStrongTransition && !hasTransitionHit && index > 0) {
      issues.push({
        id: createAudioId('audio-issue'),
        type: 'missing-sfx-hit',
        severity: 'info',
        message: '当前强转场还没有对应的 transition hit / whoosh，节奏可能显得偏空。',
        targetClipId: clip.id,
        suggestedAction: 'add-sfx-hit',
      })
    }
    const audioClipCount = (dialogueTrack?.clips.filter((audioClip) => audioClip.targetEditorClipId === clip.id).length ?? 0)
      + (musicTrack?.clips.filter((audioClip) => audioClip.targetEditorClipId === clip.id).length ?? 0)
      + (sfxTrack?.clips.filter((audioClip) => audioClip.targetEditorClipId === clip.id).length ?? 0)
    if (audioClipCount > 0 && clip.transition === 'jump-cut') {
      issues.push({
        id: createAudioId('audio-issue'),
        type: 'abrupt-transition',
        severity: 'warning',
        message: '当前镜头带有 jump-cut，同时叠加了声音条带，建议再检查声画切换是否过于突兀。',
        targetClipId: clip.id,
        suggestedAction: 'shift-cue',
      })
    }
  })

  return issues
}
