import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CREATORS } from '@/lib/data/creators'
import { getProjectRoleLabel, isProjectRole } from '@/lib/roles/projectRoles'
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
  profileId: string
  invitedByUserId: string
  role: string
  status: InvitationStatus
  createdAt: string
  respondedAt?: string
  displayName?: string
  city?: string
  ratingSummary?: {
    rating: number
    reviewCount: number
  }
  matchedCaseIds?: string[]
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
  displayName?: string
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
    displayName: profile?.name ?? creator?.name ?? normalizeNameFallback(profileId),
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
    profileId: 'city-creator-3',
    invitedByUserId: 'user-me',
    role: 'editor',
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
    displayName: '林泽宇',
    city: '上海',
    ratingSummary: { rating: 4.6, reviewCount: 4 },
    matchedCaseIds: [],
  },
]

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      teams: SEED_TEAMS,
      invitations: SEED_INVITATIONS,
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
        if (existingPending) return existingPending

        const meta = isLegacy
          ? {
              displayName: profileOrMember.name,
              city: profileOrMember.city,
              ratingSummary: profileOrMember.ratingSummary,
              matchedCaseIds: profileOrMember.matchedCaseIds,
            }
          : { ...resolveProfileMeta(profileId, role), ...metaArg }

        const invitation: TeamInvitation = {
          id: uid('team-invite'),
          projectId,
          profileId,
          invitedByUserId,
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
        }))

        return invitation
      }) as TeamState['inviteMember'],

      cancelInvitation: (projectId, profileId) => {
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
        }))
        useProjectRoleStore.getState().updateAssignmentStatus(projectId, profileId, 'removed')
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
        }))

        syncProjectRole(projectId, profileId, invitation.role, 'active')
      },

      declineInvitation: (projectId, profileId) => {
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
        }))
        useProjectRoleStore.getState().updateAssignmentStatus(projectId, profileId, 'removed')
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
        return (team?.members ?? []).map(toMemberSummary)
      },

      getPendingInvitations: (projectId) => (
        get().invitations.filter((item) => item.projectId === projectId && item.status === 'pending')
      ),

      getTeamByOrder: (orderId) => get().teams.find((team) => team.projectId === orderId),
    }),
    { name: 'cc:teams-v3' },
  ),
)

export function getTeamRoleLabel(role: string) {
  return isProjectRole(role) ? getProjectRoleLabel(role) : role
}
