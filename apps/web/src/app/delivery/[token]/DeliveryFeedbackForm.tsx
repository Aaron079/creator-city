'use client'

import { useState } from 'react'

type DeliveryItem = {
  id: string
  title?: string | null
}

type Props = {
  token: string
  items: DeliveryItem[]
}

export function DeliveryFeedbackForm({ token, items }: Props) {
  const [itemId, setItemId] = useState('')
  const [status, setStatus] = useState<'comment' | 'approved' | 'change_requested'>('comment')
  const [authorName, setAuthorName] = useState('')
  const [authorEmail, setAuthorEmail] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)
    const res = await fetch(`/api/delivery/${encodeURIComponent(token)}/comments`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        itemId: itemId || null,
        status,
        authorName,
        authorEmail,
        body,
      }),
    })
    const data = await res.json().catch(() => ({})) as { message?: string }
    setSubmitting(false)
    if (!res.ok) {
      setMessage({ ok: false, text: data.message ?? '提交反馈失败' })
      return
    }
    setBody('')
    setItemId('')
    setStatus('comment')
    setMessage({ ok: true, text: '反馈已提交，创作者会在项目后台看到。' })
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="姓名（可选）"
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-white/30"
        />
        <input
          value={authorEmail}
          onChange={(e) => setAuthorEmail(e.target.value)}
          placeholder="邮箱（可选）"
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-white/30"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-white/30"
        >
          <option value="">整体交付</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.title || '未命名条目'}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-white/30"
        >
          <option value="comment">评论</option>
          <option value="approved">标记通过</option>
          <option value="change_requested">要求修改</option>
        </select>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        rows={4}
        placeholder="写下反馈..."
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-white/30"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-100 disabled:opacity-50"
      >
        {submitting ? '提交中...' : '提交反馈'}
      </button>
      {message ? <p className={`text-sm ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p> : null}
    </form>
  )
}
