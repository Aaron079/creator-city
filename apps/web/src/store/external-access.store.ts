'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ExternalAccessType =
  | 'client-review'
  | 'delivery-preview'
  | 'creator-invite'
  | 'project-overview'

export type ExternalRoleHint =
  | 'client'
  | 'creator'
  | 'reviewer'
  | 'viewer'

export type ExternalAccessStatus =
  | 'active'
  | 'revoked'
  | 'expired'

export interface ExternalAccessPermissions {
  canViewProject: boolean
  canViewDelivery: boolean
  canSubmitReview: boolean
  canRequestChanges: boolean
  canJoinProject: boolean
}

export interface ExternalAccessLink {
  id: string
  token: string
  projectId: string
  projectTitle: string
  accessType: ExternalAccessType
  roleHint: ExternalRoleHint
  status: ExternalAccessStatus
  createdByUserId: string
  createdAt: string
  expiresAt?: string
  invitedName?: string
  invitedEmail?: string
  note?: string
  permissions: ExternalAccessPermissions
  lastUsedAt?: string
  usedCount: number
}

export interface ExternalCreatorInviteIntent {
  id: string
  linkId: string
  token: string
  projectId: string
  createdAt: string
  invitedName?: string
  invitedEmail?: string
  note?: string
  status: 'submitted'
}

interface CreateExternalLinkInput {
  projectId: string
  projectTitle: string
  accessType: ExternalAccessType
  roleHint: ExternalRoleHint
  createdByUserId: string
  expiresAt?: string
  invitedName?: string
  invitedEmail?: string
  note?: string
  permissions?: Partial<ExternalAccessPermissions>
}

interface ExternalAccessState {
  links: ExternalAccessLink[]
  intents: ExternalCreatorInviteIntent[]
  createExternalLink: (input: CreateExternalLinkInput) => ExternalAccessLink
  revokeExternalLink: (id: string) => void
  getExternalLinkByToken: (token: string) => ExternalAccessLink | null
  getLinksByProject: (projectId: string) => ExternalAccessLink[]
  markLinkUsed: (token: string) => void
  submitCreatorInviteIntent: (token: string, payload: {
    invitedName?: string
    invitedEmail?: string
    note?: string
  }) => ExternalCreatorInviteIntent | null
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function token() {
  return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

function nowIso() {
  return new Date().toISOString()
}

function withEffectiveStatus(link: ExternalAccessLink): ExternalAccessLink {
  if (
    link.status === 'active'
    && link.expiresAt
    && new Date(link.expiresAt).getTime() <= Date.now()
  ) {
    return { ...link, status: 'expired' }
  }

  return link
}

function defaultPermissions(accessType: ExternalAccessType): ExternalAccessPermissions {
  switch (accessType) {
    case 'client-review':
      return {
        canViewProject: true,
        canViewDelivery: true,
        canSubmitReview: true,
        canRequestChanges: true,
        canJoinProject: false,
      }
    case 'delivery-preview':
      return {
        canViewProject: true,
        canViewDelivery: true,
        canSubmitReview: false,
        canRequestChanges: false,
        canJoinProject: false,
      }
    case 'creator-invite':
      return {
        canViewProject: true,
        canViewDelivery: false,
        canSubmitReview: false,
        canRequestChanges: false,
        canJoinProject: true,
      }
    case 'project-overview':
    default:
      return {
        canViewProject: true,
        canViewDelivery: false,
        canSubmitReview: false,
        canRequestChanges: false,
        canJoinProject: false,
      }
  }
}

export const useExternalAccessStore = create<ExternalAccessState>()(
  persist(
    (set, get) => ({
      links: [],
      intents: [],

      createExternalLink: (input) => {
        const next: ExternalAccessLink = withEffectiveStatus({
          id: uid('external-link'),
          token: token(),
          projectId: input.projectId,
          projectTitle: input.projectTitle,
          accessType: input.accessType,
          roleHint: input.roleHint,
          status: 'active',
          createdByUserId: input.createdByUserId,
          createdAt: nowIso(),
          expiresAt: input.expiresAt,
          invitedName: input.invitedName?.trim() || undefined,
          invitedEmail: input.invitedEmail?.trim() || undefined,
          note: input.note?.trim() || undefined,
          permissions: {
            ...defaultPermissions(input.accessType),
            ...input.permissions,
          },
          usedCount: 0,
        })
        set((state) => ({ links: [next, ...state.links] }))
        return next
      },

      revokeExternalLink: (id) => {
        set((state) => ({
          links: state.links.map((link) => (
            link.id === id
              ? { ...link, status: 'revoked' }
              : link
          )),
        }))
      },

      getExternalLinkByToken: (value) => {
        const link = get().links.find((item) => item.token === value)
        return link ? withEffectiveStatus(link) : null
      },

      getLinksByProject: (projectId) => get().links
        .filter((link) => link.projectId === projectId)
        .map(withEffectiveStatus)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),

      markLinkUsed: (value) => {
        set((state) => ({
          links: state.links.map((link) => (
            link.token === value
              ? {
                  ...link,
                  lastUsedAt: nowIso(),
                  usedCount: link.usedCount + 1,
                }
              : link
          )),
        }))
      },

      submitCreatorInviteIntent: (value, payload) => {
        const link = get().getExternalLinkByToken(value)
        if (!link || link.status !== 'active' || link.accessType !== 'creator-invite') return null

        const next: ExternalCreatorInviteIntent = {
          id: uid('external-intent'),
          linkId: link.id,
          token: link.token,
          projectId: link.projectId,
          createdAt: nowIso(),
          invitedName: payload.invitedName?.trim() || link.invitedName,
          invitedEmail: payload.invitedEmail?.trim() || link.invitedEmail,
          note: payload.note?.trim() || undefined,
          status: 'submitted',
        }

        set((state) => ({ intents: [next, ...state.intents] }))
        get().markLinkUsed(value)
        return next
      },
    }),
    { name: 'cc:external-access-v1' },
  ),
)
