import type { ApprovalRequest } from '@/store/approval.store'
import type { DirectorNote, DirectorNoteTargetType } from '@/store/director-notes.store'
import type { VersionRecord, VersionedEntityType } from '@/store/version-history.store'
import type { ProjectRole } from '@/lib/roles/projectRoles'
import type { ReviewResolutionItem, ReviewResolutionSeed } from '@/lib/review/resolution-store'

function mapApprovalTargetToRole(targetType: ApprovalRequest['targetType']): ProjectRole {
  switch (targetType) {
    case 'project-brief':
    case 'sequence':
    case 'shot':
    case 'storyboard-frame':
    case 'role-bible':
      return 'director'
    case 'video-shot':
      return 'cinematographer'
    case 'editor-clip':
    case 'editor-timeline':
      return 'editor'
    case 'audio-timeline':
      return 'creator'
    case 'delivery':
      return 'producer'
    default:
      return 'producer'
  }
}

function mapDirectorNoteToRole(note: DirectorNote): ProjectRole {
  switch (note.targetType) {
    case 'video-shot':
      return 'cinematographer'
    case 'editor-clip':
    case 'editor-timeline':
      return 'editor'
    case 'project-brief':
    case 'sequence':
    case 'shot':
    case 'storyboard-frame':
    case 'role-bible':
      return 'director'
    case 'delivery':
      return 'producer'
    default:
      return note.category === 'production' || note.category === 'client-feedback' ? 'producer' : 'creator'
  }
}

function mapTargetTypeToVersionType(targetType: ApprovalRequest['targetType'] | DirectorNoteTargetType): VersionedEntityType | null {
  switch (targetType) {
    case 'project-brief':
    case 'shot':
    case 'sequence':
    case 'storyboard-frame':
    case 'video-shot':
    case 'editor-clip':
    case 'role-bible':
    case 'editor-timeline':
    case 'delivery':
      return targetType
    default:
      return null
  }
}

function latestVersionIdForTarget(
  versions: VersionRecord[],
  targetType: ApprovalRequest['targetType'] | DirectorNoteTargetType,
  targetId: string,
) {
  const versionType = mapTargetTypeToVersionType(targetType)
  if (!versionType) return undefined
  return versions
    .filter((version) => version.entityType === versionType && version.entityId === targetId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0]?.id
}

export function buildReviewResolutionSeeds(args: {
  projectId: string
  approvals: ApprovalRequest[]
  notes: DirectorNote[]
  versions: VersionRecord[]
}): ReviewResolutionSeed[] {
  const { projectId, approvals, notes, versions } = args
  const seeds: ReviewResolutionSeed[] = []

  approvals
    .filter((approval) => approval.status === 'changes-requested' || approval.status === 'rejected')
    .forEach((approval) => {
      const latestDecision = approval.decisions
        .slice()
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0]
      const latestClientDecision = approval.decisions
        .filter((decision) => decision.role === 'client')
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0]

      seeds.push({
        projectId,
        sourceType: latestClientDecision ? 'client-review' : 'approval-decision',
        sourceId: approval.id,
        title: approval.title,
        description: latestClientDecision?.comment ?? latestDecision?.comment ?? approval.description ?? '客户已对当前内容提出修改或拒绝意见。',
        severity: approval.status === 'rejected' ? 'strong' : 'warning',
        assignedRole: mapApprovalTargetToRole(approval.targetType),
        createdAt: latestClientDecision?.createdAt ?? latestDecision?.createdAt ?? approval.resolvedAt ?? approval.createdAt,
        relatedVersionId: latestClientDecision?.versionId ?? approval.linkedVersionId ?? latestVersionIdForTarget(versions, approval.targetType, approval.targetId),
      })
    })

  notes
    .filter((note) => note.priority === 'blocker' && (note.status === 'open' || note.status === 'in-progress'))
    .forEach((note) => {
      seeds.push({
        projectId,
        sourceType: 'director-note',
        sourceId: note.id,
        title: note.content.slice(0, 52) || 'Director blocker note',
        description: note.aiSummary ?? note.content,
        severity: 'strong',
        assignedRole: mapDirectorNoteToRole(note),
        assignedUserId: note.assignedTo,
        createdAt: note.createdAt,
        relatedVersionId: latestVersionIdForTarget(versions, note.targetType, note.targetId),
      })
    })

  return seeds
}

export function filterResolutionItemsForRole(args: {
  items: ReviewResolutionItem[]
  role: ProjectRole
  userId?: string | null
  profileId?: string | null
}) {
  const { items, role, userId, profileId } = args
  if (role === 'producer' || role === 'client') return items
  return items.filter((item) => (
    item.assignedUserId === userId
    || item.assignedUserId === profileId
    || item.assignedRole === role
    || (role === 'creator' && (item.assignedRole === 'creator' || item.assignedRole === 'editor' || item.assignedRole === 'director' || item.assignedRole === 'cinematographer'))
  ))
}
