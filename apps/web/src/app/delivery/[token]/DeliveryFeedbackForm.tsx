'use client'

import { useState } from 'react'

type DeliveryItem = {
  id: string
  title?: string | null
}

export type DeliveryCommentForDisplay = {
  id: string
  itemId?: string | null
  authorName?: string | null
  authorEmail?: string | null
  body: string
  status: string
  createdAt: string
  item?: { id: string; title: string | null } | null
}

type Props = {
  token: string
  items: DeliveryItem[]
  initialComments?: DeliveryCommentForDisplay[]
}

function statusLabel(status: string) {
  if (status === 'approved') return '已通过'
  if (status === 'change_requested') return '要求修改'
  return '评论'
}

function statusBadgeClass(status: string) {
  if (status === 'approved') return 'bg-emerald-400/15 text-emerald-200'
  if (status === 'change_requested') return 'bg-amber-400/15 text-amber-200'
  return 'bg-sky-400/15 text-sky-200'
}

export function DeliveryFeedbackForm({ token, items, initialComments = [] }: Props) {
  const [comments, setComments] = useState<DeliveryCommentForDisplay[]>(initialComments)
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
    const raw = await res.text()
    let data: { success?: boolean; comment?: DeliveryCommentForDisplay; message?: string; errorCode?: string } = {}
    try { data = JSON.parse(raw) as typeof data } catch { /* non-json body */ }
    setSubmitting(false)
    if (!res.ok || !data.success) {
      const errMsg = data.message ?? `提交反馈失败（${res.status}）`
      const errCode = data.errorCode ? `[${data.errorCode}] ` : ''
      setMessage({ ok: false, text: `${errCode}${errMsg}` })
      return
    }
    if (data.comment) {
      setComments((prev) => [data.comment!, ...prev])
    }
    setBody('')
    setItemId('')
    setStatus('comment')
    setMessage({ ok: true, text: '评论已保存' })
  }

  return (
    <div className="space-y-5">
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
          maxLength={2000}
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

      {comments.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-white/60">已提交的反馈</h3>
          {comments.map((c) => (
            <div key={c.id} className="rounded-md border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">{c.authorName || '匿名客户'}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs ${statusBadgeClass(c.status)}`}>{statusLabel(c.status)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">{c.body}</p>
              {c.item?.title && (
                <p className="mt-1 text-xs text-white/35">关联：{c.item.title}</p>
              )}
              <p className="mt-1 text-xs text-white/35">{new Date(c.createdAt).toLocaleString('zh-CN')}</p>
            </div>
          ))}
        </div>
      )}

      {comments.length === 0 && (
        <p className="text-xs text-white/30">暂无评论。</p>
      )}
    </div>
  )
}
