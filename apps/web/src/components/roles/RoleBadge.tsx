'use client'

import { getProjectRoleLabel, type ProjectRole } from '@/lib/roles/projectRoles'

export function RoleBadge({ role }: { role: ProjectRole }) {
  return (
    <span className="inline-flex rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-100">
      {getProjectRoleLabel(role)}
    </span>
  )
}
