'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useAuthStore } from '@/store/auth.store'

interface AdminUser {
  id: string
  email: string
  displayName: string
  username: string | null
  role: string
  status: string
  createdAt: string
  lastLoginAt: string | null
  profile: {
    username: string | null
    avatarUrl: string | null
    city: string | null
    company: string | null
  } | null
}

export default function AdminUsersPage() {
  const { user, isAuthenticated } = useAuthStore()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setError('请先登录。')
      setLoading(false)
      return
    }
    if (user?.role !== 'ADMIN') {
      setError('无权限：仅管理员可访问此页面。')
      setLoading(false)
      return
    }
    void (async () => {
      try {
        const res = await fetch('/api/admin/users', { credentials: 'include' })
        if (!res.ok) {
          const d = await res.json() as { message?: string }
          setError(d.message ?? '加载失败')
          return
        }
        const data = await res.json() as { users: AdminUser[] }
        setUsers(data.users)
      } catch {
        setError('网络错误，请稍后重试。')
      } finally {
        setLoading(false)
      }
    })()
  }, [isAuthenticated, user?.role])

  return (
    <DashboardShell>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-white">用户管理</h1>
        <p className="mt-2 text-sm text-white/50">所有注册用户，按注册时间倒序。</p>

        {error && (
          <div className="mt-5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 text-sm text-white/40">加载中…</div>
        ) : users.length > 0 ? (
          <div className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-white/40">
                <tr>
                  <th className="px-4 py-3">用户</th>
                  <th className="px-4 py-3">邮箱</th>
                  <th className="px-4 py-3">角色</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">最近登录</th>
                  <th className="px-4 py-3">注册时间</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-white/[0.08] text-center text-xs font-semibold leading-7 text-white shrink-0">
                          {u.displayName[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <div className="text-white font-medium">{u.displayName}</div>
                          {(u.profile?.username ?? u.username) && (
                            <div className="text-xs text-white/40">@{u.profile?.username ?? u.username}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/70">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium ${u.role === 'ADMIN' ? 'bg-amber-500/15 text-amber-300' : 'bg-white/[0.05] text-white/50'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium ${u.status === 'ACTIVE' ? 'bg-green-500/15 text-green-300' : 'bg-rose-500/15 text-rose-300'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/45 text-xs">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('zh-CN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-white/45 text-xs">
                      {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !error ? (
          <div className="mt-6 text-sm text-white/40">暂无用户数据。</div>
        ) : null}

        <div className="mt-6 text-xs text-white/30">
          共 {users.length} 位用户 · 不显示已删除账号
        </div>
      </main>
    </DashboardShell>
  )
}
