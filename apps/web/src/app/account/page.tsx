'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useAuthStore } from '@/store/auth.store'
import { clientLogout } from '@/lib/auth/client'

interface ProfileData {
  username: string | null
  bio: string | null
  city: string | null
  company: string | null
  websiteUrl: string | null
  avatarUrl: string | null
}

export default function AccountPage() {
  const router = useRouter()
  const { user, isAuthenticated, updateUser, logout } = useAuthStore()

  const [form, setForm] = useState({
    displayName: '',
    username: '',
    bio: '',
    city: '',
    company: '',
    websiteUrl: '',
  })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push('/auth/login?next=/account')
      return
    }
    void (async () => {
      try {
        const res = await fetch('/api/user/profile', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json() as { profile: ProfileData | null }
          setForm({
            displayName: user.displayName,
            username: data.profile?.username ?? '',
            bio: data.profile?.bio ?? '',
            city: data.profile?.city ?? '',
            company: data.profile?.company ?? '',
            websiteUrl: data.profile?.websiteUrl ?? '',
          })
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [isAuthenticated, user, router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json() as { message?: string }
      if (!res.ok) {
        setNotice({ type: 'error', message: data.message ?? '保存失败' })
        return
      }
      updateUser({ displayName: form.displayName })
      setNotice({ type: 'success', message: '资料已保存。' })
    } catch {
      setNotice({ type: 'error', message: '网络错误，请稍后重试。' })
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await clientLogout()
    logout()
    router.push('/')
  }

  if (!isAuthenticated || !user) return null

  return (
    <DashboardShell>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">账号设置</h1>
            <p className="mt-1 text-sm text-white/45">个人资料、平台额度与 API 账户管理。</p>
          </div>
          <Link
            href="/me"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
          >
            ← 返回工作台
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs uppercase tracking-wider text-white/40 mb-3">当前账号</p>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/[0.08] text-center text-sm font-semibold leading-10 text-white">
              {user.displayName[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div className="text-sm font-medium text-white">{user.displayName}</div>
              <div className="text-xs text-white/45">{user.email} · {user.role}</div>
            </div>
          </div>
        </div>

        {/* Quick links to account sub-sections */}
        <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Link
            href="/account/credits"
            className="flex flex-col gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-sm text-white/60 hover:border-white/[0.14] hover:text-white transition"
          >
            <span className="flex items-center gap-2"><span className="text-base">◎</span><span>平台额度</span></span>
            <span className="text-[11px] text-white/30">积分充值 · 消耗流水</span>
          </Link>
          <Link
            href="/account/providers"
            className="flex flex-col gap-1 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] px-4 py-3.5 text-sm text-violet-300/80 hover:border-violet-500/30 hover:text-violet-200 transition"
          >
            <span className="flex items-center gap-2"><span className="text-base">⚡</span><span>我的 API 账户</span></span>
            <span className="text-[11px] text-violet-300/40">直连 Provider，API 费用自付</span>
          </Link>
          <Link
            href="/account/usage"
            className="flex flex-col gap-1 rounded-xl border border-sky-500/15 bg-sky-500/[0.03] px-4 py-3.5 text-sm text-sky-300/70 hover:border-sky-500/25 hover:text-sky-200 transition"
          >
            <span className="flex items-center gap-2"><span className="text-base">📊</span><span>生成用量</span></span>
            <span className="text-[11px] text-sky-300/30">平台额度 · 我的 API 记录</span>
          </Link>
          <div className="flex flex-col gap-1 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5 text-sm text-white/30 cursor-default select-none">
            <span className="flex items-center gap-2"><span className="text-base">★</span><span>订阅与套餐</span></span>
            <span className="text-[11px] text-white/18">平台服务费 · 即将开放</span>
          </div>
        </div>

        {notice && (
          <div className={`mb-5 rounded-xl px-4 py-3 text-sm ${notice.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-300' : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'}`}>
            {notice.message}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-white/40">加载中…</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-base font-semibold text-white">个人资料</h2>

            <Field label="显示名称">
              <input
                type="text"
                required
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                className="input-field"
              />
            </Field>

            <Field label="用户名（可选）">
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="your_username"
                className="input-field"
              />
            </Field>

            <Field label="简介">
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3}
                placeholder="介绍一下自己…"
                className="input-field resize-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="城市">
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="上海"
                  className="input-field"
                />
              </Field>
              <Field label="公司">
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Creator Studio"
                  className="input-field"
                />
              </Field>
            </div>

            <Field label="个人网站">
              <input
                type="url"
                value={form.websiteUrl}
                onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                placeholder="https://example.com"
                className="input-field"
              />
            </Field>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 text-white font-medium px-6 py-2.5 text-sm transition disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存资料'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-base font-semibold text-white mb-4">账号操作</h2>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] text-rose-300 hover:bg-rose-500/10 px-5 py-2 text-sm transition"
          >
            登出
          </button>
        </div>
      </main>
    </DashboardShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/55 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
