import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CREATORS } from '@/lib/data/creators'
import { buildInvitationNotification, buildInvitationResolvedNotification } from '@/lib/notifications/invitations'
import { getProjectRoleLabel, isProjectRole } from '@/lib/roles/projectRoles'
import { useNotificationsStore } from '@/store/notifications.store'
import { useProfileStore } from '@/store/profile.store'
import { useProjectRoleStore } from '@/store/project-role.store'
import { useReviewStore } from '@/store/review.store'

export type MemberStatus = 'invited' | 'joined'
export type ProjectStage = 'idea' | 'storyboard' | 'shooting' | 'editing' | 'delivery'
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'
export type TeamMemberLifecycleStatus = 'active' | 'invited' | 'removed'

export interface TeamMember {
  userId: string
  name: string
  role: string
  status: MemberStatus
  split: number
  city?: string
  ratingSummary?: {
    rating: number
    reviewCount: number
  }
  matchedCaseIds?: string[]
}

export interface Team {
  id: string
  projectId: string
  ownerId: string
  members: TeamMember[]
  stage: ProjectStage
}

export interface TeamInvitation {
  id: string
  projectId: string
  projectTitle?: string
  profileId: string
  displayName?: string
  invitedByUserId: string
  invitedByName?: string
  role: string
  status: InvitationStatus
  createdAt: string
  respondedAt?: string
  city?: string
  ratingSummary?: {
    rating: number
    reviewCount: number
  }
  matchedCaseIds?: string[]
}

export interface InvitationActivity {
  id: string
  projectId: string
  profileId: string
  type: 'invited' | 'accepted' | 'declined' | 'cancelled' | 'role-changed' | 'removed'
  actorUserId: string
  actorName: string
  createdAt: string
  message: string
}

export interface TeamMemberSummary {
  profileId: string
  displayName: string
  role: string
  status: TeamMemberLifecycleStatus
  city?: string
  ratingSummary?: {
    rating: number
    reviewCount: number
  }
  matchedCaseIds: string[]
}

export interface RoleChangeRecord {
  id: string
  projectId: string
  profileId: string
  fromRole?: string
  toRole: string
  changedByUserId: string
  changedAt: string
}

type InviteLegacyMember = Omit<TeamMember, 'status'>

interface InviteMemberMeta {
  projectTitle?: string
  displayName?: string
  invitedByName?: string
  city?: string
  ratingSummary?: {
    rating: number
    reviewCount: number
  }
  matchedCaseIds?: string[]
}

interface TeamState {
  teams: Team[]
  invitations: TeamInvitation[]
  activities: InvitationActivity[]
  roleChanges: RoleChangeRecord[]
  createTeam: (projectId: string, ownerId: string, ownerName: string) => Team
  inviteMember: {
    (teamId: string, member: InviteLegacyMember): TeamInvitation | null
    (projectId: string, profileId: string, role: string, invitedByUserId?: string, meta?: InviteMemberMeta): TeamInvitation | null
  }
  cancelInvitation: (projectId: string, profileId: string) => void
  acceptInvitation: (projectId: string, profileId: string) => void
  declineInvitation: (projectId: string, profileId: string) => void
  acceptInvite: (teamId: string, userId: string) => void
  changeMemberRole: (projectId: string, profileId: string, role: string, changedByUserId?: string) => void
  removeMember: (projectId: string, profileId: string) => void
  updateStage: (teamId: string, stage: ProjectStage) => void
  getProjectMembers: (projectId: string) => TeamMemberSummary[]
  getPendingInvitations: (projectId: string) => TeamInvitation[]
  getInvitationsForProfile: (profileId: string) => TeamInvitation[]
  getPendingInvitationsForProfile: (profileId: string) => TeamInvitation[]
  getInvitationActivity: (projectId: string) => InvitationActivity[]
  getTeamByOrder: (orderId: string) => Team | undefined
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeNameFallback(profileId: string) {
  return profileId.replace(/^user-/, '').replace(/^city-/, '').replace(/-/g, ' ')
}

function formatTeamRole(role: string) {
  return isProjectRole(role) ? getProjectRoleLabel(role) : role
}

function resolveProfileMeta(profileId: string, _fallbackRole?: string): Required<InviteMemberMeta> {
  const profiles = useProfileStore.getState().profiles
  const reviews = useReviewStore.getState().reviews
  const profile = profiles.find((item) => item.id === profileId)
  const creator = CREATORS.find((item) => item.id === profileId)
  const relevantReviews = reviews.filter((item) => item.authorId === profileId)
  const reviewCount = profile?.reviewCount ?? creator?.casesCount ?? relevantReviews.length
  const rating = profile?.rating
    ?? creator?.rating
    ?? (relevantReviews.length > 0
      ? relevantReviews.reduce((sum, item) => sum + item.rating, 0) / relevantReviews.length
      : 0)

  return {
    projectTitle: '',
    displayName: profile?.name ?? creator?.name ?? normalizeNameFallback(profileId),
    invitedByName: 'Producer',
    city: creator?.city ?? 'Remote',
    ratingSummary: {
      rating: Number(rating.toFixed(2)),
      reviewCount,
    },
    matchedCaseIds: [],
  }
}

function toMemberSummary(member: TeamMember): TeamMemberSummary {
  return {
    profileId: member.userId,
    displayName: member.name,
    role: member.role,
    status: member.status === 'joined' ? 'active' : 'invited',
    city: member.city,
    ratingSummary: member.ratingSummary,
    matchedCaseIds: member.matchedCaseIds ?? [],
  }
}

function makeActivity(params: {
  projectId: string
  profileId: string
  type: InvitationActivity['type']
  actorUserId: string
  actorName: string
  message: string
}): InvitationActivity {
  return {
    id: uid('invite-activity'),
    projectId: params.projectId,
    profileId: params.profileId,
    type: params.type,
    actorUserId: params.actorUserId,
    actorName: params.actorName,
    message: params.message,
    createdAt: nowIso(),
  }
}

function syncProjectRole(projectId: string, profileId: string, role: string, status: 'active' | 'invited' | 'removed') {
  if (!isProjectRole(role)) {
    useProjectRoleStore.getState().updateAssignmentStatus(projectId, profileId, 'removed')
    return
  }

  useProjectRoleStore.getState().assignProjectRole(projectId, profileId, role, status)
}

const SEED_TEAMS: Team[] = [
  {
    id: 'team-seed-1',
    projectId: 'order-seed-1',
    ownerId: 'user-me',
    stage: 'shooting',
    members: [
      { userId: 'user-me', name: '我 (发布方)', role: '发布方', status: 'joined', split: 50 },
      { userId: 'city-creator-1', name: '陈灵一', role: '摄影师', status: 'joined', split: 30, city: '杭州', ratingSummary: { rating: 4.8, reviewCount: 6 }, matchedCaseIds: [] },
      { userId: 'city-creator-3', name: '林泽宇', role: '剪辑师', status: 'invited', split: 20, city: '上海', ratingSummary: { rating: 4.6, reviewCount: 4 }, matchedCaseIds: [] },
    ],
  },
]

const SEED_INVITATIONS: TeamInvitation[] = [
  {
    id: 'team-invite-seed-1',
    projectId: 'order-seed-1',
    projectTitle: '城市夜景品牌短片',
    profileId: 'city-creator-3',
    invitedByUserId: 'user-me',
    invitedByName: '我 (发布方)',
    role: 'editor',
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
    displayName: '林泽宇',
    city: '上海',
    ratingSummary: { rating: 4.6, reviewCount: 4 },
    matchedCaseIds: [],
  },
]

const SEED_ACTIVITIES: InvitationActivity[] = [
  {
    id: 'invite-activity-seed-1',
    projectId: 'order-seed-1',
    profileId: 'city-creator-3',
    type: 'invited',
    actorUserId: 'user-me',
    actorName: '我 (发布方)',
    createdAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
    message: '邀请 林泽宇 以 Editor 角色加入项目。',
  },
]

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      teams: SEED_TEAMS,
      invitations: SEED_INVITATIONS,
      activities: SEED_ACTIVITIES,
      roleChanges: [],

      createTeam: (projectId, ownerId, ownerName) => {
        const existing = get().teams.find((team) => team.projectId === projectId)
        if (existing) return existing

        const team: Team = {
          id: uid('team'),
          projectId,
          ownerId,
          stage: 'idea',
          members: [{
            userId: ownerId,
            name: ownerName,
            role: 'producer',
            status: 'joined',
            split: 100,
            city: 'Remote',
            ratingSummary: { rating: 0, reviewCount: 0 },
            matchedCaseIds: [],
          }],
        }

        syncProjectRole(projectId, ownerId, 'producer', 'active')
        set((state) => ({ teams: [...state.teams, team] }))
        return team
      },

      inviteMember: ((projectOrTeamId: string, profileOrMember: string | InviteLegacyMember, roleArg?: string, invitedByUserIdArg?: string, metaArg?: InviteMemberMeta) => {
        const state = get()
        const isLegacy = typeof profileOrMember !== 'string'
        const invitedByUserId = typeof invitedByUserIdArg === 'string' ? invitedByUserIdArg : 'user-current'
        const team = isLegacy
          ? state.teams.find((item) => item.id === projectOrTeamId)
          : state.teams.find((item) => item.projectId === projectOrTeamId) ?? state.createTeam(projectOrTeamId, invitedByUserId, 'Producer')

        if (!team) return null

        const projectId = team.projectId
        const profileId = isLegacy ? profileOrMember.userId : profileOrMember
        const role = isLegacy ? profileOrMember.role : (roleArg ?? 'creator')
        const existingPending = state.invitations.find((item) => item.projectId === projectId && item.profileId === profileId && item.status === 'pending')
        if (existingPending) {
          useNotificationsStore.getState().upsertNotification(buildInvitationNotification(existingPending))
          return existingPending
        }

        const meta = isLegacy
          ? {
              projectTitle: projectId,
              displayName: profileOrMember.name,
              invitedByName: 'Producer',
              city: profileOrMember.city,
              ratingSummary: profileOrMember.ratingSummary,
              matchedCaseIds: profileOrMember.matchedCaseIds,
            }
          : { ...resolveProfileMeta(profileId, role), ...metaArg }

        const invitation: TeamInvitation = {
          id: uid('team-invite'),
          projectId,
          projectTitle: meta.projectTitle || projectId,
          profileId,
          invitedByUserId,
          invitedByName: meta.invitedByName || 'Producer',
          role,
          status: 'pending',
          createdAt: nowIso(),
          displayName: meta.displayName,
          city: meta.city,
          ratingSummary: meta.ratingSummary,
          matchedCaseIds: meta.matchedCaseIds,
        }

        const member: TeamMember = {
          userId: profileId,
          name: meta.displayName ?? normalizeNameFallback(profileId),
          role,
          status: 'invited',
          split: isLegacy ? profileOrMember.split : 20,
          city: meta.city,
          ratingSummary: meta.ratingSummary,
          matchedCaseIds: meta.matchedCaseIds,
        }

        syncProjectRole(projectId, profileId, role, 'invited')
        const activity = makeActivity({
          projectId,
          profileId,
          type: 'invited',
          actorUserId: invitedByUserId,
          actorName: meta.invitedByName || 'Producer',
          message: `邀请 ${meta.displayName ?? normalizeNameFallback(profileId)} 以 ${formatTeamRole(role)} 角色加入项目。`,
        })

        set((current) => ({
          teams: current.teams.map((item) => (
            item.id !== team.id ? item : {
              ...item,
              members: item.members.some((memberItem) => memberItem.userId === profileId)
                ? item.members.map((memberItem) => (
                    memberItem.userId === profileId
                      ? { ...memberItem, ...member, status: 'invited' as const }
                      : memberItem
                  ))
                : [...item.members, member],
            }
          )),
          invitations: [invitation, ...current.invitations.filter((item) => !(item.projectId === projectId && item.profileId === profileId))],
          activities: [activity, ...current.activities],
        }))

        useNotificationsStore.getState().upsertNotification(buildInvitationNotification(invitation))

        return invitation
      }) as TeamState['inviteMember'],

      cancelInvitation: (projectId, profileId) => {
        const invitation = get().invitations.find((item) => item.projectId === projectId && item.profileId === profileId && item.status === 'pending')
        set((state) => ({
          teams: state.teams.map((team) => (
            team.projectId !== projectId ? team : {
              ...team,
              members: team.members.filter((member) => !(member.userId === profileId && member.status === 'invited')),
            }
          )),
          invitations: state.invitations.map((invitation) => (
            invitation.projectId === projectId && invitation.profileId === profileId && invitation.status === 'pending'
              ? { ...invitation, status: 'cancelled', respondedAt: nowIso() }
              : invitation
          )),
          activities: invitation ? [
            makeActivity({
              projectId,
              profileId,
              type: 'cancelled',
              actorUserId: invitation.invitedByUserId,
              actorName: invitation.invitedByName ?? invitation.invitedByUserId,
              message: `取消了 ${invitation.displayName ?? profileId} 的邀请。`,
            }),
            ...state.activities,
          ] : state.activities,
        }))
        useProjectRoleStore.getState().updateAssignmentStatus(projectId, profileId, 'removed')
        if (invitation) {
          useNotificationsStore.getState().markSourceHandled('invitation', invitation.id)
          useNotificationsStore.getState().upsertNotification(buildInvitationResolvedNotification({
            invitation: {
              ...invitation,
              status: 'cancelled',
              respondedAt: nowIso(),
            },
            type: 'cancelled',
          }))
        }
      },

      acceptInvitation: (projectId, profileId) => {
        const invitation = get().invitations.find((item) => item.projectId === projectId && item.profileId === profileId)
        if (!invitation) return

        set((state) => ({
          teams: state.teams.map((team) => (
            team.projectId !== projectId ? team : {
              ...team,
              members: team.members.map((member) => (
                member.userId === profileId
                  ? { ...member, status: 'joined' as const, role: invitation.role }
                  : member
              )),
            }
          )),
          invitations: state.invitations.map((item) => (
            item.id === invitation.id
              ? { ...item, status: 'accepted', respondedAt: nowIso() }
              : item
          )),
          activities: [
            makeActivity({
              projectId,
              profileId,
              type: 'accepted',
              actorUserId: profileId,
              actorName: invitation.displayName ?? profileId,
              message: `${invitation.displayName ?? profileId} 接受了 ${formatTeamRole(invitation.role)} 邀请。`,
            }),
            ...state.activities,
          ],
        }))

        syncProjectRole(projectId, profileId, invitation.role, 'active')
        useNotificationsStore.getState().markSourceHandled('invitation', invitation.id)
        useNotificationsStore.getState().upsertNotification(buildInvitationResolvedNotification({
          invitation: {
            ...invitation,
            status: 'accepted',
            respondedAt: nowIso(),
          },
          type: 'accepted',
        }))
      },

      declineInvitation: (projectId, profileId) => {
        const invitation = get().invitations.find((item) => item.projectId === projectId && item.profileId === profileId && item.status === 'pending')
        set((state) => ({
          teams: state.teams.map((team) => (
            team.projectId !== projectId ? team : {
              ...team,
              members: team.members.filter((member) => !(member.userId === profileId && member.status === 'invited')),
            }
          )),
          invitations: state.invitations.map((item) => (
            item.projectId === projectId && item.profileId === profileId && item.status === 'pending'
              ? { ...item, status: 'declined', respondedAt: nowIso() }
              : item
          )),
          activities: invitation ? [
            makeActivity({
              projectId,
              profileId,
              type: 'declined',
              actorUserId: profileId,
              actorName: invitation.displayName ?? profileId,
              message: `${invitation.displayName ?? profileId} 拒绝了 ${formatTeamRole(invitation.role)} 邀请。`,
            }),
            ...state.activities,
          ] : state.activities,
        }))
        useProjectRoleStore.getState().updateAssignmentStatus(projectId, profileId, 'removed')
        if (invitation) {
          useNotificationsStore.getState().markSourceHandled('invitation', invitation.id)
          useNotificationsStore.getState().upsertNotification(buildInvitationResolvedNotification({
            invitation: {
              ...invitation,
              status: 'declined',
              respondedAt: nowIso(),
            },
            type: 'declined',
          }))
        }
      },

      acceptInvite: (teamId, userId) => {
        const team = get().teams.find((item) => item.id === teamId)
        if (!team) return
        get().acceptInvitation(team.projectId, userId)
      },

      changeMemberRole: (projectId, profileId, role, changedByUserId = 'user-current') => {
        const team = get().teams.find((item) => item.projectId === projectId)
        const existingMember = team?.members.find((member) => member.userId === profileId)
        if (!team || !existingMember) return

        set((state) => ({
          teams: state.teams.map((item) => (
            item.projectId !== projectId ? item : {
              ...item,
              members: item.members.map((member) => (
                member.userId === profileId ? { ...member, role } : member
              )),
            }
          )),
          invitations: state.invitations.map((item) => (
            item.projectId === projectId && item.profileId === profileId && item.status === 'pending'
              ? { ...item, role }
              : item
          )),
          roleChanges: [
            {
              id: uid('role-change'),
              projectId,
              profileId,
              fromRole: existingMember.role,
              toRole: role,
              changedByUserId,
              changedAt: nowIso(),
            },
            ...state.roleChanges,
          ],
          activities: [
            makeActivity({
              projectId,
              profileId,
              type: 'role-changed',
              actorUserId: changedByUserId,
              actorName: changedByUserId,
              message: `将 ${existingMember.name} 的角色从 ${formatTeamRole(existingMember.role)} 调整为 ${formatTeamRole(role)}。`,
            }),
            ...state.activities,
          ],
        }))

        syncProjectRole(projectId, profileId, role, existingMember.status === 'joined' ? 'active' : 'invited')
      },

      removeMember: (projectId, profileId) => {
        const team = get().teams.find((item) => item.projectId === projectId)
        const existingMember = team?.members.find((member) => member.userId === profileId)
        if (!team || !existingMember) return

        set((state) => ({
          teams: state.teams.map((item) => (
            item.projectId !== projectId ? item : {
              ...item,
              members: item.members.filter((member) => member.userId !== profileId),
            }
          )),
          invitations: state.invitations.map((item) => (
            item.projectId === projectId && item.profileId === profileId && item.status === 'pending'
              ? { ...item, status: 'cancelled', respondedAt: nowIso() }
              : item
          )),
          roleChanges: [
            {
              id: uid('role-change'),
              projectId,
              profileId,
              fromRole: existingMember.role,
              toRole: 'removed',
              changedByUserId: 'user-current',
              changedAt: nowIso(),
            },
            ...state.roleChanges,
          ],
          activities: [
            makeActivity({
              projectId,
              profileId,
              type: 'removed',
              actorUserId: 'user-current',
              actorName: 'Producer',
              message: `将 ${existingMember.name} 从项目团队中移除。`,
            }),
            ...state.activities,
          ],
        }))

        useProjectRoleStore.getState().updateAssignmentStatus(projectId, profileId, 'removed')
      },

      updateStage: (teamId, stage) => {
        set((state) => ({
          teams: state.teams.map((team) => (team.id === teamId ? { ...team, stage } : team)),
        }))
      },

      getProjectMembers: (projectId) => {
        const team = get().teams.find((item) => item.projectId === projectId)
        const activeOrInvited = (team?.members ?? []).map(toMemberSummary)
        const activeIds = new Set(activeOrInvited.map((member) => member.profileId))
        const removed = get().roleChanges
          .filter((item) => item.projectId === projectId && item.toRole === 'removed' && !activeIds.has(item.profileId))
          .sort((left, right) => right.changedAt.localeCompare(left.changedAt))
          .filter((item, index, array) => array.findIndex((candidate) => candidate.profileId === item.profileId) === index)
          .map((item) => {
            const meta = resolveProfileMeta(item.profileId)
            return {
              profileId: item.profileId,
              displayName: meta.displayName,
              role: item.fromRole ?? 'removed',
              status: 'removed' as const,
              city: meta.city,
              ratingSummary: meta.ratingSummary,
              matchedCaseIds: meta.matchedCaseIds,
            } satisfies TeamMemberSummary
          })

        return [...activeOrInvited, ...removed]
      },

      getPendingInvitations: (projectId) => (
        get().invitations.filter((item) => item.projectId === projectId && item.status === 'pending')
      ),

      getInvitationsForProfile: (profileId) => (
        get().invitations.filter((item) => item.profileId === profileId)
      ),

      getPendingInvitationsForProfile: (profileId) => (
        get().invitations.filter((item) => item.profileId === profileId && item.status === 'pending')
      ),

      getInvitationActivity: (projectId) => (
        get().activities
          .filter((item) => item.projectId === projectId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      ),

      getTeamByOrder: (orderId) => get().teams.find((team) => team.projectId === orderId),
    }),
    { name: 'cc:teams-v4' },
  ),
)

export function getTeamRoleLabel(role: string) {
  return isProjectRole(role) ? getProjectRoleLabel(role) : role
}
