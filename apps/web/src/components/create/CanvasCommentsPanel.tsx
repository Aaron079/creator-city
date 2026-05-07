'use client'

import { useState } from 'react'

export interface CanvasComment {
  id: string
  text: string
  createdAt: number
  status?: string
  authorName?: string
}

interface CanvasCommentsPanelProps {
  comments: CanvasComment[]
  loading?: boolean
  error?: string
  pendingCount?: number
  syncingPending?: boolean
  onAddComment: (text: string) => Promise<boolean> | boolean
  onRetrySync?: () => void
  onClose: () => void
}

export function CanvasCommentsPanel({
  comments,
  loading = false,
  error,
  pendingCount = 0,
  syncingPending = false,
  onAddComment,
  onRetrySync,
  onClose,
}: CanvasCommentsPanelProps) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <section className="canvas-side-panel is-comment-panel" aria-label="评论面板" onPointerDown={(event) => event.stopPropagation()}>
      <div className="canvas-panel-head">
        <div>
          <div className="canvas-panel-kicker">Comments</div>
          <h2 className="canvas-panel-title">评论模式</h2>
        </div>
        <button type="button" className="canvas-panel-close" onClick={onClose} aria-label="关闭评论面板" title="关闭">
          ×
        </button>
      </div>

      <div className="canvas-comment-compose">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="写一条画布评论"
          className="canvas-comment-input"
        />
        <button
          type="button"
          className="canvas-panel-primary"
          disabled={saving}
          onClick={async () => {
            const text = draft.trim()
            if (!text) return
            setSaving(true)
            try {
              const saved = await onAddComment(text)
              if (saved) setDraft('')
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? '保存中...' : '添加评论'}
        </button>
      </div>

      {pendingCount > 0 ? (
        <div className="canvas-comment-compose">
          <div className="canvas-panel-empty">有 {pendingCount} 条评论待同步。</div>
          <button
            type="button"
            className="canvas-panel-primary"
            disabled={syncingPending}
            onClick={onRetrySync}
          >
            {syncingPending ? '同步中...' : '重试同步'}
          </button>
        </div>
      ) : null}

      <div className="canvas-panel-list">
        {loading ? <div className="canvas-panel-empty">正在加载评论...</div> : null}
        {error ? <div className="canvas-panel-empty">{error}</div> : null}
        {comments.length > 0 ? comments.map((comment) => (
          <div key={comment.id} className="canvas-comment-item">
            <div className="canvas-comment-meta">
              {comment.authorName ?? '我'} · {comment.status === 'open'
                ? '已保存'
                : comment.status === 'syncing'
                  ? '同步中'
                  : comment.status === 'pending'
                    ? '待同步'
                    : comment.status ?? '评论'} · {new Date(comment.createdAt).toLocaleTimeString()}
            </div>
            <div className="canvas-comment-copy">{comment.text}</div>
          </div>
        )) : (
          !loading ? <div className="canvas-panel-empty">还没有评论，添加后会显示在这里。</div> : null
        )}
      </div>
    </section>
  )
}
