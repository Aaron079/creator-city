import type { ApprovalRequest } from '@/store/approval.store'
import type { AudioSyncReview, AudioTimeline, DialogueLine, MusicCue, VoiceTake } from '@/store/audio-desk.store'
import type { DirectorNote } from '@/store/director-notes.store'
import type { ClipReview, EditorTimeline, ShotDerivativeJob, StoryboardPrevis } from '@/store/shots.store'
import type { DeliveryAsset, DeliveryAssetType, DeliveryApprovalStatus, DeliveryLicenseStatus, DeliveryRiskLevel } from '@/store/delivery-package.store'
import type { VersionRecord } from '@/store/version-history.store'

export interface DeliveryAggregationInput {
  projectId: string
  projectTitle: string
  currentStage: string
  storyboardPrevis: StoryboardPrevis | null
  shotDerivativeJobs: ShotDerivativeJob[]
  clipReviews: Record<string, ClipReview>
  editorTimeline: EditorTimeline
  audioTimeline: AudioTimeline | null
  dialogueLines: DialogueLine[]
  voiceTakes: VoiceTake[]
  musicCues: MusicCue[]
  audioReviews: Record<string, AudioSyncReview>
  notes: DirectorNote[]
  versions: VersionRecord[]
  approvals: ApprovalRequest[]
}

export interface DeliveryAssetSection {
  id: string
  label: string
  types: DeliveryAssetType[]
}

export const DELIVERY_ASSET_SECTIONS: DeliveryAssetSection[] = [
  { id: 'storyboard', label: '分镜', types: ['storyboard-frame'] },
  { id: 'video', label: '视频镜头', types: ['video-shot'] },
  { id: 'editor', label: '剪辑方案', types: ['editor-timeline'] },
  { id: 'audio', label: '声音资产', types: ['audio-timeline', 'music-cue', 'voice-take'] },
  { id: 'approvals', label: '确认记录', types: ['approval-record'] },
  { id: 'notes', label: '批注', types: ['director-note'] },
  { id: 'versions', label: '版本', types: ['version-record'] },
  { id: 'project', label: '项目数据', types: ['project-json'] },
]

function makeAssetId(type: DeliveryAssetType, sourceId: string) {
  return `delivery-asset:${type}:${sourceId}`
}

function toRiskLevel(severity?: 'info' | 'warning' | 'strong'): DeliveryRiskLevel {
  switch (severity) {
    case 'strong':
      return 'strong'
    case 'warning':
      return 'warning'
    case 'info':
      return 'info'
    default:
      return 'none'
  }
}

function maxRiskLevel(...levels: DeliveryRiskLevel[]): DeliveryRiskLevel {
  const order: DeliveryRiskLevel[] = ['none', 'info', 'warning', 'strong']
  return levels.sort((left, right) => order.indexOf(right) - order.indexOf(left))[0] ?? 'none'
}

function mapApprovalStatus(status: ApprovalRequest['status']): DeliveryApprovalStatus {
  switch (status) {
    case 'approved':
      return 'approved'
    case 'changes-requested':
      return 'changes-requested'
    case 'rejected':
      return 'rejected'
    case 'stale':
      return 'stale'
    default:
      return 'pending'
  }
}

function createAsset(input: {
  type: DeliveryAssetType
  sourceId: string
  title: string
  description?: string
  url?: string
  included: boolean
  approvalStatus: DeliveryApprovalStatus
  licenseStatus?: DeliveryLicenseStatus
  riskLevel?: DeliveryRiskLevel
}): DeliveryAsset {
  return {
    id: makeAssetId(input.type, input.sourceId),
    type: input.type,
    title: input.title,
    description: input.description,
    sourceId: input.sourceId,
    url: input.url,
    included: input.included,
    approvalStatus: input.approvalStatus,
    licenseStatus: input.licenseStatus ?? 'user-provided',
    riskLevel: input.riskLevel ?? 'none',
  }
}

export function buildDeliveryAssets(input: DeliveryAggregationInput): DeliveryAsset[] {
  const assets: DeliveryAsset[] = []

  const storyboardAssets = input.storyboardPrevis?.frames.map((frame) => (
    createAsset({
      type: 'storyboard-frame',
      sourceId: frame.id,
      title: `分镜 ${frame.timecode}`,
      description: frame.description,
      url: frame.imageUrl,
      included: frame.status === 'selected',
      approvalStatus: frame.status === 'selected' ? 'approved' : 'pending',
      licenseStatus: 'user-provided',
      riskLevel: frame.status === 'discarded' ? 'warning' : 'none',
    })
  )) ?? []
  assets.push(...storyboardAssets)

  const videoAssets = input.shotDerivativeJobs
    .filter((job) => job.status === 'done')
    .map((job) => {
      const review = input.clipReviews[job.id]
      const strongestIssue = review?.issues.reduce<'info' | 'warning' | 'strong' | undefined>((current, issue) => {
        const ranking = { info: 0, warning: 1, strong: 2 }
        if (!current || ranking[issue.severity] > ranking[current]) return issue.severity
        return current
      }, undefined)
      const approvalStatus: DeliveryApprovalStatus = review
        ? review.status === 'usable'
          ? 'approved'
          : review.status === 'needs-adjustment'
            ? 'changes-requested'
            : 'rejected'
        : 'pending'
      return createAsset({
        type: 'video-shot',
        sourceId: job.id,
        title: `视频镜头 · ${job.provider} ${job.duration}s`,
        description: job.videoPrompt,
        url: job.videoUrl,
        included: Boolean(job.videoUrl),
        approvalStatus,
        riskLevel: toRiskLevel(strongestIssue),
      })
    })
  assets.push(...videoAssets)

  assets.push(createAsset({
    type: 'editor-timeline',
    sourceId: input.editorTimeline.id,
    title: '剪辑时间线',
    description: `节奏目标 ${input.editorTimeline.pacingGoal}`,
    included: input.editorTimeline.clips.length > 0,
    approvalStatus: input.editorTimeline.status === 'locked' ? 'approved' : 'pending',
    riskLevel: input.editorTimeline.status === 'draft' ? 'warning' : 'none',
  }))

  if (input.audioTimeline) {
    const timelineRisk = Object.values(input.audioReviews)
      .flatMap((review) => review.issues)
      .reduce<DeliveryRiskLevel>((highest, issue) => maxRiskLevel(highest, toRiskLevel(issue.severity)), 'none')
    assets.push(createAsset({
      type: 'audio-timeline',
      sourceId: input.audioTimeline.id,
      title: '声音时间线',
      description: `总时长 ${input.audioTimeline.duration}s`,
      included: input.audioTimeline.tracks.some((track) => track.clips.length > 0),
      approvalStatus: input.audioTimeline.status === 'locked' ? 'approved' : 'pending',
      riskLevel: timelineRisk,
    }))
  }

  const selectedVoiceTakes = input.voiceTakes.filter((take) => take.status === 'selected')
  assets.push(...selectedVoiceTakes.map((take) => {
    const line = input.dialogueLines.find((item) => item.id === take.dialogueLineId)
    return createAsset({
      type: 'voice-take',
      sourceId: take.id,
      title: `配音 · ${line?.characterName ?? take.voiceId}`,
      description: line?.text ?? take.style,
      url: take.audioUrl,
      included: true,
      approvalStatus: line?.status === 'approved' ? 'approved' : 'pending',
      riskLevel: line?.status === 'approved' ? 'none' : 'warning',
    })
  }))

  const selectedMusicCues = input.musicCues.filter((cue) => cue.status === 'selected')
  assets.push(...selectedMusicCues.map((cue) => (
    createAsset({
      type: 'music-cue',
      sourceId: cue.id,
      title: `音乐 · ${cue.mood} / ${cue.tempo}`,
      description: cue.prompt,
      url: cue.audioUrl,
      included: true,
      approvalStatus: cue.licenseStatus === 'commercial-cleared' ? 'approved' : 'pending',
      licenseStatus: cue.licenseStatus,
      riskLevel: cue.licenseStatus === 'unknown' ? 'strong' : 'none',
    })
  )))

  const relevantNotes = input.notes.filter((note) => note.status !== 'dismissed')
  assets.push(...relevantNotes.map((note) => (
    createAsset({
      type: 'director-note',
      sourceId: note.id,
      title: `批注 · ${note.category}`,
      description: note.content,
      included: note.priority === 'blocker' || note.status === 'resolved',
      approvalStatus: note.status === 'resolved' ? 'approved' : 'pending',
      riskLevel: note.priority === 'blocker' && note.status !== 'resolved' ? 'strong' : note.priority === 'high' ? 'warning' : 'info',
    })
  )))

  const relevantVersions = input.versions.filter((version) => (
    ['delivery', 'editor-timeline', 'editor-clip', 'video-shot', 'storyboard-frame', 'project-brief'].includes(version.entityType)
  ))
  assets.push(...relevantVersions.map((version) => (
    createAsset({
      type: 'version-record',
      sourceId: version.id,
      title: version.label,
      description: version.summary,
      included: version.entityType === 'delivery' || version.entityType === 'editor-timeline',
      approvalStatus: 'approved',
      riskLevel: 'none',
    })
  )))

  const relevantApprovals = input.approvals.filter((approval) => approval.targetType !== 'role-bible')
  assets.push(...relevantApprovals.map((approval) => (
    createAsset({
      type: 'approval-record',
      sourceId: approval.id,
      title: approval.title,
      description: approval.description,
      included: approval.status === 'approved' || approval.status === 'changes-requested' || approval.targetType === 'delivery',
      approvalStatus: mapApprovalStatus(approval.status),
      riskLevel: approval.status === 'stale' ? 'warning' : approval.status === 'rejected' ? 'strong' : 'none',
    })
  )))

  assets.push(createAsset({
    type: 'project-json',
    sourceId: input.projectId,
    title: `${input.projectTitle} · 项目数据`,
    description: `当前阶段 ${input.currentStage} 的交付快照`,
    included: true,
    approvalStatus: 'approved',
    licenseStatus: 'user-provided',
    riskLevel: 'none',
  }))

  return assets
}

export function groupDeliveryAssets(assets: DeliveryAsset[]) {
  return DELIVERY_ASSET_SECTIONS.map((section) => ({
    ...section,
    assets: assets.filter((asset) => section.types.includes(asset.type)),
  }))
}
