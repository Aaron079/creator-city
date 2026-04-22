'use client'

import { useEffect, useMemo, useState } from 'react'

export type WorkspaceRole = 'producer' | 'creator' | 'client'
export type RoleSurface = 'dashboard' | 'create' | 'review'

type VisibleSectionMap = {
  dashboard: Array<'overview' | 'ai-summary' | 'quick-actions' | 'action-queue' | 'risk-radar' | 'planning' | 'team-match' | 'licensing' | 'recent-activity'>
  create: Array<'canvas' | 'previs' | 'footage' | 'audio' | 'editor' | 'delivery'>
  review: Array<'header' | 'summary' | 'items' | 'decision-panel' | 'compare' | 'internal-meta' | 'internal-follow-up'>
}

type SectionId<T extends RoleSurface> = VisibleSectionMap[T][number]

const ROLE_VIEW_KEY = 'cc:mock-view-role'

const VISIBLE_SECTIONS: { [K in WorkspaceRole]: VisibleSectionMap } = {
  producer: {
    dashboard: ['overview', 'ai-summary', 'quick-actions', 'action-queue', 'risk-radar', 'planning', 'team-match', 'licensing', 'recent-activity'],
    create: ['previs', 'footage', 'audio', 'editor', 'delivery'],
    review: ['header', 'summary', 'items', 'decision-panel', 'compare', 'internal-meta', 'internal-follow-up'],
  },
  creator: {
    dashboard: ['overview', 'quick-actions', 'action-queue', 'risk-radar', 'recent-activity'],
    create: ['canvas', 'previs', 'footage', 'audio', 'editor', 'delivery'],
    review: ['header', 'summary', 'items', 'decision-panel', 'compare', 'internal-meta'],
  },
  client: {
    dashboard: ['overview', 'quick-actions', 'recent-activity'],
    create: ['delivery'],
    review: ['header', 'summary', 'items', 'decision-panel', 'compare'],
  },
}

export function getVisibleSectionsForRole<T extends RoleSurface>(role: WorkspaceRole, surface: T): VisibleSectionMap[T] {
  return VISIBLE_SECTIONS[role][surface]
}

export function getHiddenPanelsForRole<T extends RoleSurface>(role: WorkspaceRole, surface: T): Array<SectionId<T>> {
  const universe = new Set<SectionId<T>>([
    ...VISIBLE_SECTIONS.producer[surface],
    ...VISIBLE_SECTIONS.creator[surface],
    ...VISIBLE_SECTIONS.client[surface],
  ] as Array<SectionId<T>>)
  const visible = new Set<SectionId<T>>(VISIBLE_SECTIONS[role][surface] as Array<SectionId<T>>)
  return Array.from(universe).filter((item) => !visible.has(item))
}

export function getDefaultLandingForRole(role: WorkspaceRole) {
  switch (role) {
    case 'producer':
      return '/dashboard'
    case 'creator':
      return '/create'
    case 'client':
      return '/review'
    default:
      return '/dashboard'
  }
}

export function getRoleLabel(role: WorkspaceRole) {
  switch (role) {
    case 'producer':
      return 'Producer'
    case 'creator':
      return 'Creator'
    case 'client':
      return 'Client'
    default:
      return role
  }
}

export function useMockRoleMode(defaultRole: WorkspaceRole) {
  const [role, setRole] = useState<WorkspaceRole>(defaultRole)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(ROLE_VIEW_KEY)
    if (stored === 'producer' || stored === 'creator' || stored === 'client') {
      setRole(stored)
    } else {
      window.localStorage.setItem(ROLE_VIEW_KEY, defaultRole)
    }
  }, [defaultRole])

  const updateRole = (nextRole: WorkspaceRole) => {
    setRole(nextRole)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ROLE_VIEW_KEY, nextRole)
    }
  }

  const landing = useMemo(() => getDefaultLandingForRole(role), [role])

  return {
    role,
    setRole: updateRole,
    landing,
  }
}
