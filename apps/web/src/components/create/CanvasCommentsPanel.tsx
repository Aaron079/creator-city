'use client'

import { useState } from 'react'

export interface CanvasComment {
  id: string
  text: string
  createdAt: number
}

interface CanvasCommentsPanelProps {
  comments: CanvasComment[]
  onAddComment: (text: string) => void
  onClose: () => void
}

export function CanvasCommentsPanel({
  comments,
  onAddComment,
  onClose,
}: CanvasCommentsPanelProps) {
  const [draft, setDraft] = useState('')

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
          onClick={() => {
            const text = draft.trim()
            if (!text) return
            onAddComment(text)
            setDraft('')
          }}
        >
          添加评论
        </button>
      </div>

      <div className="canvas-panel-list">
        {comments.length > 0 ? comments.map((comment) => (
          <div key={comment.id} className="canvas-comment-item">
            <div className="canvas-comment-meta">本地评论 · {new Date(comment.createdAt).toLocaleTimeString()}</div>
            <div className="canvas-comment-copy">{comment.text}</div>
          </div>
        )) : (
          <div className="canvas-panel-empty">还没有评论，添加后会显示在这里。</div>
        )}
      </div>
    </section>
  )
}
