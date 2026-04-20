import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemberStatus  = 'invited' | 'joined'
export type ProjectStage  = 'idea' | 'storyboard' | 'shooting' | 'editing' | 'delivery'

export interface TeamMember {
  userId: string
  name:   string
  role:   string
  status: MemberStatus
  split:  number
}

export interface Team {
  id:        string
  projectId: string
  ownerId:   string
  members:   TeamMember[]
  stage:     ProjectStage
}

interface TeamState {
  teams:          Team[]
  createTeam:     (projectId: string, ownerId: string, ownerName: string) => Team
  inviteMember:   (teamId: string, member: Omit<TeamMember, 'status'>) => void
  acceptInvite:   (teamId: string, userId: string) => void
  updateStage:    (teamId: string, stage: ProjectStage) => void
  getTeamByOrder: (orderId: string) => Team | undefined
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return `team-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_TEAMS: Team[] = [
  {
    id:        'team-seed-1',
    projectId: 'order-seed-1',
    ownerId:   'user-me',
    stage:     'shooting',
    members: [
      { userId: 'user-me',         name: '我 (发布方)', role: '发布方', status: 'joined',  split: 50 },
      { userId: 'city-creator-1',  name: '陈灵一',      role: '摄影师', status: 'joined',  split: 30 },
      { userId: 'city-creator-3',  name: '林泽宇',      role: '剪辑师', status: 'invited', split: 20 },
    ],
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      teams: SEED_TEAMS,

      createTeam: (projectId, ownerId, ownerName) => {
        const existing = get().teams.find((t) => t.projectId === projectId)
        if (existing) return existing
        const team: Team = {
          id:        uid(),
          projectId,
          ownerId,
          stage:     'idea',
          members:   [{ userId: ownerId, name: ownerName, role: '发布方', status: 'joined', split: 100 }],
        }
        set((s) => ({ teams: [...s.teams, team] }))
        return team
      },

      inviteMember: (teamId, member) => {
        set((s) => ({
          teams: s.teams.map((t) =>
            t.id !== teamId ? t : {
              ...t,
              members: t.members.some((m) => m.userId === member.userId)
                ? t.members
                : [...t.members, { ...member, status: 'invited' as const }],
            }
          ),
        }))
      },

      acceptInvite: (teamId, userId) => {
        set((s) => ({
          teams: s.teams.map((t) =>
            t.id !== teamId ? t : {
              ...t,
              members: t.members.map((m) =>
                m.userId === userId ? { ...m, status: 'joined' as const } : m
              ),
            }
          ),
        }))
      },

      updateStage: (teamId, stage) => {
        set((s) => ({
          teams: s.teams.map((t) => t.id === teamId ? { ...t, stage } : t),
        }))
      },

      getTeamByOrder: (orderId) => get().teams.find((t) => t.projectId === orderId),
    }),
    { name: 'cc:teams-v2' },
  ),
)
