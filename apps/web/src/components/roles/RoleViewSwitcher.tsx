'use client'

import type { WorkspaceRole } from '@/lib/roles/view-mode'
import { getDefaultLandingForRole, getRoleLabel } from '@/lib/roles/view-mode'
import { PROJECT_ROLES } from '@/lib/roles/projectRoles'

const ROLES: WorkspaceRole[] = PROJECT_ROLES

export function RoleViewSwitcher({
  resolvedRole,
  overrideRole,
  onChange,
  onClear,
  compact = false,
}: {
  resolvedRole: WorkspaceRole
  overrideRole?: WorkspaceRole | null
  onChange: (role: WorkspaceRole) => void
  onClear?: () => void
  compact?: boolean
}) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-black/15 ${compact ? 'px-3 py-3' : 'px-4 py-4'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Dev Role Override</div>
          <div className="mt-1 text-sm text-white/75">
            当前项目角色：{getRoleLabel(resolvedRole)} · 默认入口 {getDefaultLandingForRole(resolvedRole)}
          </div>
          <div className="mt-1 text-xs text-white/45">
            {overrideRole
              ? `开发辅助覆盖已启用：${getRoleLabel(overrideRole)}`
              : '未启用 override，当前页面优先使用账号与项目角色绑定。'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((item) => {
            const active = item === (overrideRole ?? null)
            return (
              <button
                key={item}
                type="button"
                onClick={() => onChange(item)}
                className="rounded-xl px-3 py-2 text-xs font-semibold transition"
                style={{
                  background: active ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: active ? '#c7d2fe' : 'rgba(255,255,255,0.62)',
                }}
              >
                {getRoleLabel(item)}
              </button>
            )
          })}
          {overrideRole && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl px-3 py-2 text-xs font-semibold transition"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.62)',
              }}
            >
              Clear Override
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
