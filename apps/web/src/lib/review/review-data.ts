import type { ApprovalDecision, ApprovalRequest, ApprovalTargetType } from '@/store/approval.store'
import type { AudioTimeline } from '@/store/audio-desk.store'
import type { DirectorNote, DirectorNoteTargetType } from '@/store/director-notes.store'
import type { Job } from '@/store/jobs.store'
import type { Order } from '@/store/order.store'
import type { Team } from '@/store/team.store'
import type { VersionRecord } from '@/store/version-history.store'

export type ReviewPreviewType =
  | 'storyboard-frame'
  | 'video-shot'
  | 'editor-timeline'
  | 'audio-timeline'
  | 'delivery'
  | 'generic'

export type ReviewPreviewData =
  | {
      type: 'storyboard-frame'
      imageUrl?: string
      imagePrompt?: string
      intent?: string
      status?: string
      movement?: string
      lighting?: string
    }
  | {
      type: 'video-shot'
      videoUrl?: string
      frameSummary: string
      reviewStatus?: string
      provider?: string
      duration?: string
      movement?: string
    }
  | {
      type: 'editor-timeline'
      clipCount: number
      pacing?: string
      musicDirection?: string
      transitionSummary: string
      status?: string
    }
  | {
      type: 'audio-timeline'
      trackSummary: string[]
      musicCueSummary: string
      voiceSummary: string
      syncIssueSummary: string
      status?: string
      duration?: string
    }
  | {
      type: 'delivery'
      finalStatus: string
      approvalSummary: string
      assetChecklist: string[]
    }
  | {
      type: 'generic'
      summary: string
      changedFields: string[]
    }

export interface ReviewItem {
  id: string
  targetType: ApprovalTargetType
  targetId: string
  title: string
  description?: string
  status: ApprovalRequest['status']
  versionId?: string
  versionLabel?: string
  versionNumber?: number
  previousVersionId?: string
  previewType: ReviewPreviewType
  previewData: ReviewPreviewData
  noteCount: number
  blockerCount: number
  decisions: ApprovalDecision[]
  requiredRoles: ApprovalRequest['requiredRoles']
  createdAt: string
  linkedVersion: VersionRecord | null
}

export interface ClientReviewContext {
  projectId: string
  projectTitle: string
  projectDescription: string
  currentStage: string
  currentVersion: string
  reviewStatus: string
  pendingCount: number
  changesRequestedCount: number
  approvedCount: number
  deliveryApproved: boolean
  aiSummary: string
  items: ReviewItem[]
}

function mapApprovalTargetToNoteTarget(targetType: ApprovalTargetType): DirectorNoteTargetType {
  switch (targetType) {
    case 'project-brief':
    case 'sequence':
    case 'shot':
    case 'storyboard-frame':
    case 'role-bible':
    case 'video-shot':
    case 'editor-clip':
    case 'editor-timeline':
    case 'audio-timeline':
    case 'delivery':
      return targetType
    default:
      return 'project'
  }
}

function stringifyValue(value: unknown): string {
  if (value == null) return '未设置'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.length > 0 ? value.map((item) => stringifyValue(item)).join(' / ') : '空列表'
  return JSON.stringify(value)
}

function getPreviousVersion(linkedVersion: VersionRecord | null, versions: VersionRecord[]) {
  if (!linkedVersion) return null
  return versions
    .filter((version) => (
      version.entityType === linkedVersion.entityType
      && version.entityId === linkedVersion.entityId
      && version.versionNumber < linkedVersion.versionNumber
    ))
    .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null
}

function buildPreviewData(args: {
  approval: ApprovalRequest
  linkedVersion: VersionRecord | null
  audioTimeline?: AudioTimeline | null
  activeJob?: Job | null
}): { previewType: ReviewPreviewType; previewData: ReviewPreviewData } {
  const { approval, linkedVersion, audioTimeline, activeJob } = args
  const snapshot = linkedVersion?.snapshot ?? {}

  switch (approval.targetType) {
    case 'storyboard-frame':
      return {
        previewType: 'storyboard-frame',
        previewData: {
          type: 'storyboard-frame',
          imageUrl: typeof snapshot.imageUrl === 'string' ? snapshot.imageUrl : undefined,
          imagePrompt: typeof snapshot.imagePrompt === 'string' ? snapshot.imagePrompt : undefined,
          intent: typeof snapshot.intent === 'string' ? snapshot.intent : undefined,
          status: typeof snapshot.status === 'string' ? snapshot.status : undefined,
          movement: typeof snapshot.movement === 'string' ? snapshot.movement : undefined,
          lighting: typeof snapshot.lighting === 'string' ? snapshot.lighting : undefined,
        },
      }
    case 'video-shot':
      return {
        previewType: 'video-shot',
        previewData: {
          type: 'video-shot',
          videoUrl: typeof snapshot.videoUrl === 'string' ? snapshot.videoUrl : undefined,
          frameSummary: typeof snapshot.videoPrompt === 'string' ? snapshot.videoPrompt : approval.description || '镜头视频候选预览',
          reviewStatus: typeof snapshot.status === 'string' ? snapshot.status : undefined,
          provider: typeof snapshot.provider === 'string' ? snapshot.provider : undefined,
          duration: snapshot.duration ? `${snapshot.duration}s` : undefined,
          movement: typeof snapshot.movement === 'string' ? snapshot.movement : undefined,
        },
      }
    case 'editor-timeline': {
      const clips = Array.isArray(snapshot.clips) ? snapshot.clips : []
      const transitionSummary = clips.length > 0
        ? clips
            .slice(0, 4)
            .map((clip) => typeof clip === 'object' && clip !== null && 'transition' in clip ? String((clip as { transition?: string }).transition ?? 'cut') : 'cut')
            .join(' / ')
        : '尚未配置转场'
      return {
        previewType: 'editor-timeline',
        previewData: {
          type: 'editor-timeline',
          clipCount: clips.length,
          pacing: typeof snapshot.pacingGoal === 'string' ? snapshot.pacingGoal : undefined,
          musicDirection: typeof snapshot.musicDirection === 'string' ? snapshot.musicDirection : undefined,
          transitionSummary,
          status: typeof snapshot.status === 'string' ? snapshot.status : undefined,
        },
      }
    }
    case 'audio-timeline': {
      const tracks = audioTimeline?.tracks ?? []
      const trackSummary = tracks.map((track) => `${track.name} ${track.clips.length}`)
      return {
        previewType: 'audio-timeline',
        previewData: {
          type: 'audio-timeline',
          trackSummary: trackSummary.length > 0 ? trackSummary : ['Dialogue 0', 'Music 0', 'SFX 0'],
          musicCueSummary: tracks.find((track) => track.type === 'music')?.clips.length
            ? `已放入 ${tracks.find((track) => track.type === 'music')?.clips.length} 条音乐条带`
            : '尚未确认 music cue',
          voiceSummary: tracks.find((track) => track.type === 'dialogue')?.clips.length
            ? `已放入 ${tracks.find((track) => track.type === 'dialogue')?.clips.length} 条对白`
            : '尚未选定对白时间线',
          syncIssueSummary: tracks.find((track) => track.type === 'lip-sync')?.clips.length
            ? '已存在 lip sync 条带，建议客户重点确认声画感受'
            : '尚未放入口型同步条带',
          status: audioTimeline?.status,
          duration: audioTimeline ? `${audioTimeline.duration}s` : undefined,
        },
      }
    }
    case 'delivery':
      return {
        previewType: 'delivery',
        previewData: {
          type: 'delivery',
          finalStatus: activeJob?.delivery?.status ?? (typeof snapshot.timelineStatus === 'string' ? snapshot.timelineStatus : 'pending'),
          approvalSummary: approval.status === 'approved' ? '客户已确认交付' : approval.status === 'changes-requested' ? '客户提出了修改意见' : '等待客户确认交付版本',
          assetChecklist: [
            `时间线片段 ${stringifyValue(snapshot.timelineClipCount ?? activeJob?.delivery?.shotCount ?? 0)}`,
            `阶段 ${stringifyValue(snapshot.currentStage ?? 'delivery')}`,
            activeJob?.delivery?.data?.length ? '已包含交付素材摘要' : '交付素材摘要待确认',
          ],
        },
      }
    default:
      return {
        previewType: 'generic',
        previewData: {
          type: 'generic',
          summary: linkedVersion?.summary ?? approval.description ?? approval.title,
          changedFields: linkedVersion?.changedFields ?? [],
        },
      }
  }
}

export function buildClientReviewContext(args: {
  projectId: string
  approvals: ApprovalRequest[]
  versions: VersionRecord[]
  notes: DirectorNote[]
  orders: Order[]
  teams: Team[]
  jobs: Job[]
  audioTimelines: AudioTimeline[]
}): ClientReviewContext {
  const { projectId, approvals, versions, notes, orders, teams, jobs, audioTimelines } = args
  const activeOrder = orders.find((order) => order.id === projectId) ?? orders.find((order) => order.chatId === projectId) ?? null
  const activeTeam = teams.find((team) => team.projectId === projectId) ?? (activeOrder ? teams.find((team) => team.projectId === activeOrder.id) ?? null : null)
  const activeJob = activeOrder ? jobs.find((job) => job.id === activeOrder.chatId) ?? null : null

  const routeScoped = activeTeam?.projectId === projectId || activeOrder?.id === projectId
  const scopedApprovals = approvals.filter((approval) => approval.requiredRoles.includes('client'))
  const clientApprovals = routeScoped
    ? scopedApprovals
    : scopedApprovals.filter((approval) => approval.targetId === projectId)

  const items = clientApprovals.map((approval) => {
    const linkedVersion = versions.find((version) => version.id === approval.linkedVersionId) ?? null
    const previousVersion = getPreviousVersion(linkedVersion, versions)
    const targetNotes = notes.filter((note) => note.targetType === mapApprovalTargetToNoteTarget(approval.targetType) && note.targetId === approval.targetId)
    const { previewType, previewData } = buildPreviewData({
      approval,
      linkedVersion,
      audioTimeline: approval.targetType === 'audio-timeline'
        ? audioTimelines.find((timeline) => timeline.id === approval.targetId) ?? null
        : null,
      activeJob,
    })

    return {
      id: approval.id,
      targetType: approval.targetType,
      targetId: approval.targetId,
      title: approval.title,
      description: approval.description,
      status: approval.status,
      versionId: linkedVersion?.id,
      versionLabel: linkedVersion?.label,
      versionNumber: linkedVersion?.versionNumber,
      previousVersionId: previousVersion?.id,
      previewType,
      previewData,
      noteCount: targetNotes.length,
      blockerCount: targetNotes.filter((note) => note.priority === 'blocker' && (note.status === 'open' || note.status === 'in-progress')).length,
      decisions: approval.decisions,
      requiredRoles: approval.requiredRoles,
      createdAt: approval.createdAt,
      linkedVersion,
    } satisfies ReviewItem
  })

  const pendingCount = clientApprovals.filter((approval) => approval.status === 'pending' || approval.status === 'stale').length
  const changesRequestedCount = clientApprovals.filter((approval) => approval.status === 'changes-requested').length
  const approvedCount = clientApprovals.filter((approval) => approval.status === 'approved').length
  const deliveryApproved = clientApprovals.some((approval) => approval.targetType === 'delivery' && approval.status === 'approved')
  const latestVersion = items
    .map((item) => item.linkedVersion)
    .filter((version): version is VersionRecord => Boolean(version))
    .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null
  const reviewStatus = clientApprovals.some((approval) => approval.status === 'stale')
    ? '需重新确认'
    : clientApprovals.some((approval) => approval.status === 'changes-requested')
      ? '存在修改意见'
      : clientApprovals.length > 0 && clientApprovals.every((approval) => approval.status === 'approved')
        ? '已全部确认'
        : '待客户确认'

  return {
    projectId,
    projectTitle: activeJob?.title ?? `项目 ${projectId}`,
    projectDescription: activeJob?.description ?? '这里是面向客户的审片入口。你只会看到需要确认的内容，不需要进入完整的专业创作画布。',
    currentStage: activeTeam?.stage ?? 'idea',
    currentVersion: latestVersion?.label ?? '未绑定',
    reviewStatus,
    pendingCount,
    changesRequestedCount,
    approvedCount,
    deliveryApproved,
    aiSummary: `当前有 ${pendingCount} 个待确认项，其中 ${changesRequestedCount} 个有修改意见。`,
    items,
  }
}
