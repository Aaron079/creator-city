'use client'

import { useEffect, useMemo, useState } from 'react'
import { DEV_ROLE_OVERRIDE_KEY, shouldUseDevRoleOverride } from '@/lib/roles/currentRole'
import { getProjectRoleLabel, type ProjectRole } from '@/lib/roles/projectRoles'

export type WorkspaceRole = ProjectRole
export type RoleSurface = 'dashboard' | 'create' | 'review'

type VisibleSectionMap = {
  dashboard: Array<'overview' | 'ai-summary' | 'quick-actions' | 'action-queue' | 'risk-radar' | 'planning' | 'team-match' | 'licensing' | 'recent-activity'>
  create: Array<'canvas' | 'previs' | 'footage' | 'audio' | 'editor' | 'delivery'>
  review: Array<'header' | 'summary' | 'items' | 'decision-panel' | 'compare' | 'internal-meta' | 'internal-follow-up'>
}

type SectionId<T extends RoleSurface> = VisibleSectionMap[T][number]

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
  director: {
    dashboard: ['overview', 'quick-actions', 'action-queue', 'risk-radar', 'recent-activity'],
    create: ['canvas', 'previs', 'footage', 'audio', 'editor', 'delivery'],
    review: ['header', 'summary', 'items', 'decision-panel', 'compare', 'internal-meta'],
  },
  editor: {
    dashboard: ['overview', 'quick-actions', 'action-queue', 'risk-radar', 'recent-activity'],
    create: ['canvas', 'previs', 'footage', 'audio', 'editor', 'delivery'],
    review: ['header', 'summary', 'items', 'decision-panel', 'compare', 'internal-meta'],
  },
  cinematographer: {
    dashboard: ['overview', 'quick-actions', 'action-queue', 'risk-radar', 'recent-activity'],
    create: ['canvas', 'previs', 'footage', 'audio', 'editor', 'delivery'],
    review: ['header', 'summary', 'items', 'decision-panel', 'compare', 'internal-meta'],
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
    case 'director':
    case 'editor':
    case 'cinematographer':
      return '/create'
    case 'client':
      return '/review'
    default:
      return '/dashboard'
  }
}

export function getRoleLabel(role: WorkspaceRole) {
  return getProjectRoleLabel(role)
}

export function useMockRoleMode(defaultRole: WorkspaceRole) {
  const [roleOverride, setRoleOverride] = useState<WorkspaceRole | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !shouldUseDevRoleOverride()) return
    const stored = window.localStorage.getItem(DEV_ROLE_OVERRIDE_KEY)
    if (stored === 'producer' || stored === 'creator' || stored === 'client' || stored === 'director' || stored === 'editor' || stored === 'cinematographer') {
      setRoleOverride(stored)
    }
  }, [defaultRole])

  const updateRole = (nextRole: WorkspaceRole | null) => {
    setRoleOverride(nextRole)
    if (typeof window === 'undefined') return
    if (!nextRole) {
      window.localStorage.removeItem(DEV_ROLE_OVERRIDE_KEY)
      return
    }
    window.localStorage.setItem(DEV_ROLE_OVERRIDE_KEY, nextRole)
  }

  const landing = useMemo(() => getDefaultLandingForRole(roleOverride ?? defaultRole), [defaultRole, roleOverride])

  return {
    roleOverride,
    setRoleOverride: updateRole,
    clearRoleOverride: () => updateRole(null),
    hasRoleOverride: Boolean(roleOverride),
    landing,
  }
}
