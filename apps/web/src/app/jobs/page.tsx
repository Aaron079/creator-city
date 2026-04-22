'use client'

import React, { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Nav } from '@/components/layout/Nav'
import { useJobsStore } from '@/store/jobs.store'
import { useAuthStore } from '@/store/auth.store'
import { useShotsStore } from '@/store/shots.store'
import { useReviewStore, selectReviewForJob } from '@/store/review.store'
import { useProfileStore } from '@/store/profile.store'
import { extractShotData } from '@/lib/export'
import { useCreatorStore, getLevelTitle, getLevelColor, computeLevel } from '@/lib/user/creator'
import { recommendCreators } from '@/lib/recommend/recommend'
import { assessDeal, derivePricingComplexity, deriveDuration, calculatePrice } from '@/lib/pricing/pricing'
import type { Job, Offer, Message } from '@/store/jobs.store'
import type { ShotExportData } from '@/lib/export'

// ─── Constants ────────────────────────────────────────────────────────────────

const BUDGET_PRESETS = [
  '¥500 – ¥1,000',
  '¥1,000 – ¥3,000',
  '¥3,000 – ¥5,000',
  '¥5,000 – ¥10,000',
  '¥10,000+',
  '面议',
]

const TABS = ['全部', '招募中', '进行中', '待审核', '已完成'] as const
type Tab = typeof TABS[number]

// Derive display status from job (combines job.status + delivery.status)
type DisplayStatus = 'open' | 'in_progress' | 'submitted' | 'approved' | 'done'

function getDisplayStatus(job: Job): DisplayStatus {
  if (job.status === 'done' || job.delivery?.status === 'approved') return 'approved'
  if (job.delivery?.status === 'submitted') return 'submitted'
  if (job.status === 'in_progress') return 'in_progress'
  return 'open'
}

const DISPLAY_LABEL: Record<DisplayStatus, string> = {
  open:        '招募中',
  in_progress: '进行中',
  submitted:   '待审核',
  approved:    '已完成',
  done:        '已完成',
}

const DISPLAY_COLOR: Record<DisplayStatus, { bg: string; text: string; border: string }> = {
  open:        { bg: 'rgba(16,185,129,0.12)',  text: '#34d399',              border: 'rgba(16,185,129,0.3)'  },
  in_progress: { bg: 'rgba(99,102,241,0.12)',  text: '#a5b4fc',              border: 'rgba(99,102,241,0.3)'  },
  submitted:   { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24',              border: 'rgba(245,158,11,0.3)'  },
  approved:    { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.08)' },
  done:        { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.08)' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600_000)
  if (h < 1) return '刚刚'
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

// ─── Delivery content viewer ──────────────────────────────────────────────────

function DeliveryContent({ shots }: { shots: ShotExportData[] }) {
  const [expanded, setExpanded] = useState<number | null>(0)

  if (shots.length === 0) {
    return <p className="text-xs text-gray-500 text-center py-4">暂无镜头数据</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {shots.map((shot, i) => (
        <div
          key={i}
          className="rounded-xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Shot header */}
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
              >
                {i + 1}
              </span>
              <span className="text-xs font-semibold text-white/80">{shot.label}</span>
              {shot.isDone && <span className="text-[10px] text-emerald-400">✔</span>}
            </div>
            <span className="text-[10px] text-gray-600">{expanded === i ? '▲' : '▼'}</span>
          </button>

          {/* Shot detail */}
          {expanded === i && (
            <div className="px-4 pb-4 flex flex-col gap-3">
              {shot.idea && (
                <p className="text-xs text-gray-400 leading-[1.6]">{shot.idea}</p>
              )}

              {/* Visual params */}
              {(shot.shotType || shot.framing || shot.movement || shot.colorGrade || shot.lighting) && (
                <div className="flex flex-wrap gap-1">
                  {[shot.shotType, shot.framing, shot.movement, shot.colorGrade, shot.lighting]
                    .filter(Boolean)
                    .map((v, k) => (
                      <span
                        key={k}
                        className="text-[9px] px-1.5 py-0.5 rounded-md"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                      >
                        {v}
                      </span>
                    ))}
                </div>
              )}

              {/* Keyframe prompt */}
              {shot.keyframePrompt && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-medium text-gray-600 uppercase tracking-wider">关键帧 Prompt</span>
                  <p className="text-[11px] text-indigo-300/70 leading-[1.5] font-mono">
                    {shot.keyframePrompt}
                  </p>
                </div>
              )}

              {/* Video prompt */}
              {shot.videoPrompt && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-medium text-gray-600 uppercase tracking-wider">视频 Prompt</span>
                  <p className="text-[11px] text-purple-300/70 leading-[1.5] font-mono">
                    {shot.videoPrompt}
                  </p>
                </div>
              )}

              {/* Image */}
              {shot.imageUrl && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-medium text-gray-600 uppercase tracking-wider">关键帧图像</span>
                  <div className="relative w-full rounded-lg overflow-hidden" style={{ height: 160 }}>
                    <Image
                      src={shot.imageUrl}
                      alt={shot.label}
                      fill
                      unoptimized
                      sizes="480px"
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Video */}
              {shot.videoUrl && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-medium text-gray-600 uppercase tracking-wider">视频</span>
                  <video
                    src={shot.videoUrl}
                    controls
                    className="w-full rounded-lg"
                    style={{ maxHeight: 160 }}
                  />
                </div>
              )}

              {/* Script excerpt */}
              {shot.scriptExcerpt && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-medium text-gray-600 uppercase tracking-wider">剧本摘要</span>
                  <p className="text-[11px] text-gray-400 leading-[1.6]">{shot.scriptExcerpt}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Submit delivery modal ────────────────────────────────────────────────────

function SubmitModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const submitDelivery = useJobsStore((s) => s.submitDelivery)
  const rawShots       = useShotsStore((s) => s.shots)
  const [submitting, setSubmitting] = useState(false)

  const preview: ShotExportData[] = rawShots.map(extractShotData)
  const hasContent = preview.some((s) => s.isDone || s.keyframePrompt || s.idea)

  const handleSubmit = useCallback(() => {
    if (!hasContent) return
    setSubmitting(true)
    submitDelivery(job.id, preview)
    setTimeout(onClose, 300)
  }, [job.id, preview, hasContent, submitDelivery, onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background:    'rgba(10,15,26,0.99)',
          border:        '1px solid rgba(255,255,255,0.1)',
          boxShadow:     '0 24px 80px rgba(0,0,0,0.8)',
          maxHeight:     '80vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">提交作品</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">以下为平台生成的创作内容，将提交给需求方审核</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        {/* Content preview */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!hasContent ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-3">🎬</p>
              <p className="text-sm text-gray-500 mb-2">当前没有已完成的创作内容</p>
              <p className="text-xs text-gray-600">请先前往「AI 导演工作台」完成创作，再回来提交</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div
                className="rounded-xl px-4 py-3 text-xs leading-[1.6]"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}
              >
                ✓ 仅使用平台生成数据 · 共 {preview.length} 个镜头 · 不含外部上传文件
              </div>
              <DeliveryContent shots={preview} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-white/[0.06] flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasContent || submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}
          >
            {submitting ? '提交中…' : '确认提交'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Offer modal ──────────────────────────────────────────────────────────────

function OfferModal({ job, creatorId, onClose }: { job: Job; creatorId: string; onClose: () => void }) {
  const [price, setPrice]     = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving]   = useState(false)
  const submitOffer = useJobsStore((s) => s.submitOffer)

  const parsedPrice = parseFloat(price.replace(/[^0-9.]/g, ''))
  const valid = !isNaN(parsedPrice) && parsedPrice > 0

  const handleSubmit = useCallback(() => {
    if (!valid) return
    setSaving(true)
    submitOffer(job.id, { creatorId, price: parsedPrice, message: message.trim() || undefined })
    setTimeout(onClose, 300)
  }, [job.id, creatorId, parsedPrice, message, valid, submitOffer, onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,15,26,0.99)',
          border:     '1px solid rgba(255,255,255,0.1)',
          boxShadow:  '0 24px 80px rgba(0,0,0,0.8)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-base font-bold text-white">提交报价</h2>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[260px]">{job.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">报价金额（元）*</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">¥</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="例如：6000"
                className="w-full rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white/90 placeholder-gray-600 outline-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: valid ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
                }}
                inputMode="numeric"
              />
            </div>
            <p className="text-[10px] text-gray-600">需求方预算参考：{job.budgetRange}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">说明（可选）</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="介绍你的优势、创作经验或执行方案…"
              rows={3}
              className="w-full rounded-xl px-3.5 py-3 text-sm text-white/90 placeholder-gray-600 outline-none resize-none leading-6"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!valid || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
          >
            {saving ? '提交中…' : '提交报价'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Offer card ───────────────────────────────────────────────────────────────

const OFFER_STATUS_LABEL: Record<string, string> = { pending: '待处理', accepted: '已接受', rejected: '已拒绝' }
const OFFER_STATUS_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  pending:  { bg: 'rgba(99,102,241,0.1)',  text: '#a5b4fc',              border: 'rgba(99,102,241,0.25)'  },
  accepted: { bg: 'rgba(16,185,129,0.1)',  text: '#34d399',              border: 'rgba(16,185,129,0.25)'  },
  rejected: { bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.25)', border: 'rgba(255,255,255,0.08)' },
}

function OfferCard({
  offer,
  canAccept,
  onAccept,
}: {
  offer: Offer
  canAccept: boolean
  onAccept: () => void
}) {
  const profiles   = useProfileStore((s) => s.profiles)
  const creator    = profiles.find((p) => p.id === offer.creatorId)
  const sc         = OFFER_STATUS_COLOR[offer.status] ?? OFFER_STATUS_COLOR['pending']!
  const label      = OFFER_STATUS_LABEL[offer.status] ?? offer.status

  return (
    <div
      className="rounded-xl px-4 py-4 flex flex-col gap-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            {creator?.avatar ?? creator?.name.charAt(0) ?? '?'}
          </div>
          <div>
            <p className="text-xs font-semibold text-white/80">{creator?.name ?? offer.creatorId}</p>
            <p className="text-[10px] text-gray-600">{formatTimeAgo(offer.createdAt)}</p>
          </div>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
          style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
        >
          {label}
        </span>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-white">¥{offer.price.toLocaleString()}</span>
        <span className="text-[10px] text-gray-600">报价</span>
      </div>

      {/* Message */}
      {offer.message && (
        <p className="text-xs text-gray-400 leading-[1.7]">{offer.message}</p>
      )}

      {/* Accept button */}
      {canAccept && offer.status === 'pending' && (
        <button
          onClick={onAccept}
          className="w-full py-2 rounded-lg text-xs font-semibold text-white transition-all mt-1"
          style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 3px 10px rgba(16,185,129,0.25)' }}
        >
          接受报价
        </button>
      )}
    </div>
  )
}

// ─── Review modal ─────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="text-2xl transition-transform hover:scale-110"
          style={{ color: n <= (hover || value) ? '#f59e0b' : 'rgba(255,255,255,0.15)' }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function ReviewModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const [rating, setRating]   = useState(5)
  const [comment, setComment] = useState('')
  const [saving, setSaving]   = useState(false)
  const submitReview = useReviewStore((s) => s.submitReview)

  const authorId    = job.creatorId ?? ''
  const reviewerId  = job.publisherId ?? 'guest'

  const handleSubmit = useCallback(() => {
    if (!authorId) return
    setSaving(true)
    submitReview({ jobId: job.id, authorId, reviewerId, rating, comment: comment.trim() || undefined })
    setTimeout(onClose, 300)
  }, [job.id, authorId, reviewerId, rating, comment, submitReview, onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,15,26,0.99)',
          border:     '1px solid rgba(255,255,255,0.1)',
          boxShadow:  '0 24px 80px rgba(0,0,0,0.8)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-base font-bold text-white">评价创作者</h2>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[260px]">{job.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">评分</label>
            <StarPicker value={rating} onChange={setRating} />
            <p className="text-xs text-gray-600">
              {rating === 5 ? '非常满意' : rating === 4 ? '满意' : rating === 3 ? '一般' : rating === 2 ? '不满意' : '很差'}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">评语（可选）</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="分享你对这次合作的感受…"
              rows={3}
              className="w-full rounded-xl px-3.5 py-3 text-sm text-white/90 placeholder-gray-600 outline-none resize-none leading-6"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !authorId}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}
          >
            {saving ? '提交中…' : '提交评价'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Message thread ───────────────────────────────────────────────────────────

function formatMsgTime(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return `${h}:${m}`
  return `${d.getMonth() + 1}/${d.getDate()} ${h}:${m}`
}

function MessageThread({
  messages,
  currentUserId,
  canSend,
  onSend,
}: {
  messages: Message[]
  currentUserId: string
  canSend: boolean
  onSend: (content: string) => void
}) {
  const [draft, setDraft] = useState('')
  const profiles = useProfileStore((s) => s.profiles)
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    onSend(text)
  }, [draft, onSend])

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt)

  return (
    <div className="flex flex-col" style={{ maxHeight: 320 }}>
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06] flex-shrink-0">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">沟通区</h3>
        <span className="text-[10px] text-gray-600">{messages.length} 条消息</span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3 min-h-0" style={{ maxHeight: 220 }}>
        {sorted.length === 0 ? (
          <p className="text-[11px] text-gray-600 text-center py-4">还没有消息，发起沟通吧</p>
        ) : (
          sorted.map((msg) => {
            const isMine = msg.senderId === currentUserId
            const sender = profiles.find((p) => p.id === msg.senderId)
            return (
              <div key={msg.id} className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                >
                  {sender?.avatar ?? sender?.name.charAt(0) ?? msg.senderId.charAt(0).toUpperCase()}
                </div>
                {/* Bubble */}
                <div className={`flex flex-col gap-0.5 max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                  <div
                    className="px-3 py-2 rounded-xl text-xs leading-[1.65]"
                    style={
                      isMine
                        ? { background: 'rgba(99,102,241,0.25)', color: 'rgba(255,255,255,0.9)', borderRadius: '14px 4px 14px 14px' }
                        : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', borderRadius: '4px 14px 14px 14px' }
                    }
                  >
                    {msg.content}
                  </div>
                  <span className="text-[9px] text-gray-700 px-1">{formatMsgTime(msg.createdAt)}</span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {canSend && (
        <div
          className="flex items-end gap-2 px-4 py-3 border-t border-white/[0.06] flex-shrink-0"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder="发送消息… (Enter 发送)"
            rows={1}
            className="flex-1 rounded-xl px-3 py-2 text-xs text-white/90 placeholder-gray-600 outline-none resize-none leading-5"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: 72 }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim()}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all disabled:opacity-30"
            style={{ background: 'rgba(99,102,241,0.35)', color: '#a5b4fc' }}
          >
            ↑
          </button>
        </div>
      )}
    </div>
  )
}

// ─── AI Price card ────────────────────────────────────────────────────────────

function AIPriceCard({ job }: { job: Job }) {
  const styleText  = `${job.title} ${job.description}`
  const deal       = assessDeal(job.budgetRange, styleText)
  const complexity = derivePricingComplexity(job.budgetRange)
  const duration   = deriveDuration(job.delivery?.shotCount, job.description)
  const estimate   = calculatePrice({ style: styleText, complexity, duration })

  const ASSESSMENT_COLOR = {
    in_range:    { text: '#34d399', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)'  },
    above_range: { text: '#a5b4fc', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)'  },
    below_range: { text: '#fbbf24', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)'  },
  } as const

  const ac = ASSESSMENT_COLOR[deal.assessment]

  const rangeLabel = deal.range.max
    ? `¥${deal.range.min.toLocaleString()} – ¥${deal.range.max.toLocaleString()}`
    : `¥${deal.range.min.toLocaleString()}+`

  return (
    <div className="px-6 py-5 border-b border-white/[0.06]">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(15,20,36,0.9) 0%, rgba(10,15,26,0.95) 100%)',
          border:     '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Top accent */}
        <div className="h-[2px] w-full bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300 opacity-60" />

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
              行业参考区间
            </span>
            <span
              className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              {deal.range.label}
            </span>
          </div>

          {/* Range display */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] text-gray-500 mb-1">行业参考区间</p>
              <p className="text-3xl font-black text-white tracking-tight">{rangeLabel}</p>
            </div>
            {/* Assessment badge */}
            <div
              className="flex-shrink-0 rounded-xl px-3 py-2 text-center"
              style={{ background: ac.bg, border: `1px solid ${ac.border}` }}
            >
              <p className="text-[11px] font-semibold" style={{ color: ac.text }}>
                {deal.message}
              </p>
            </div>
          </div>

          {/* Range bar — visualise where job budget sits */}
          {deal.range.max && (
            <div className="flex flex-col gap-1.5">
              <div className="relative h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${ac.text}88, ${ac.text})`,
                    width: deal.assessment === 'below_range'
                      ? '8%'
                      : deal.assessment === 'above_range'
                        ? '100%'
                        : `${Math.min(
                            100,
                            ((derivePricingComplexity(job.budgetRange) === 'high' ? deal.range.max * 0.9 : deal.range.min * 1.4) /
                              deal.range.max) * 100,
                          )}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                <span>¥{deal.range.min.toLocaleString()}</span>
                <span>¥{deal.range.max.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Warning — below range */}
          {deal.warning && (
            <div
              className="rounded-xl px-3.5 py-2.5 flex items-start gap-2"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <span className="text-amber-400 text-sm flex-shrink-0 mt-0.5">⚠</span>
              <p className="text-[11px] text-amber-300 leading-[1.5]">{deal.warning}</p>
            </div>
          )}

          {/* AI reference estimate — lighter info row */}
          <div
            className="rounded-xl px-3.5 py-2.5 flex items-center justify-between"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-[10px] text-gray-500">AI 综合估算参考</span>
            <span className="text-[13px] font-semibold text-white/60">¥{estimate.total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Recommended directors ────────────────────────────────────────────────────

function RecommendedDirectors({ job }: { job: Job }) {
  const creators = useCreatorStore((s) => s.creators)

  const styleText = `${job.title} ${job.description}`
  const ranked    = recommendCreators({ style: styleText }, creators, 3)

  if (ranked.length === 0) return null

  return (
    <div className="px-6 py-5 border-b border-white/[0.06]">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        推荐导演
      </h3>
      <div className="flex flex-col gap-2">
        {ranked.map((creator, i) => {
          const lv    = computeLevel(creator.completedJobs)
          const color = getLevelColor(lv)
          const title = getLevelTitle(lv)
          return (
            <motion.div
              key={creator.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl transition-colors hover:bg-white/[0.03]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {/* Rank */}
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: i === 0 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', color: i === 0 ? '#f59e0b' : 'rgba(255,255,255,0.3)' }}
              >
                {i + 1}
              </span>

              {/* Name + level */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white/80 truncate">{creator.name}</p>
                  {creator.styleMatch && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                      风格匹配
                    </span>
                  )}
                </div>
                <span
                  className="text-[10px]"
                  style={{ color }}
                >
                  Lv{lv} {title}
                </span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 flex-shrink-0 text-[11px]">
                {creator.rating > 0 && (
                  <div className="flex items-center gap-0.5">
                    <span className="text-amber-400">★</span>
                    <span className="text-white/60">{creator.rating.toFixed(1)}</span>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-white/50">{creator.completedJobs} 单</p>
                  <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{creator.successRate}% 成</p>
                </div>
              </div>

              {/* Score bar */}
              <div className="w-12 flex flex-col gap-0.5 flex-shrink-0">
                <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round(creator.score * 100)}%`, background: `${color}` }}
                  />
                </div>
                <p className="text-[9px] text-right" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {Math.round(creator.score * 100)}分
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Job detail modal ─────────────────────────────────────────────────────────

function JobDetailModal({
  job,
  onClose,
  onAccept,
}: {
  job: Job
  onClose: () => void
  onAccept: (id: string) => void
}) {
  const approveDelivery = useJobsStore((s) => s.approveDelivery)
  const acceptOffer     = useJobsStore((s) => s.acceptOffer)
  const sendMessage     = useJobsStore((s) => s.sendMessage)
  const user            = useAuthStore((s) => s.user)
  const existingReview  = useReviewStore(selectReviewForJob(job.id))
  const [showSubmit, setShowSubmit] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showOffer, setShowOffer]   = useState(false)

  const ds      = getDisplayStatus(job)
  const sc      = DISPLAY_COLOR[ds]
  const timeAgo = formatTimeAgo(job.createdAt)

  // Role determination (soft — demo-friendly)
  const currentUserId = user?.id ?? 'user-current'
  const isCreator   = !job.creatorId || currentUserId === job.creatorId
  const isPublisher = !job.publisherId || currentUserId === job.publisherId

  const offers         = job.offers ?? []
  const myOffer        = offers.find((o) => o.creatorId === currentUserId)
  const pendingOffers  = offers.filter((o) => o.status === 'pending')

  const canAccept   = job.status === 'open' && !isPublisher && !myOffer
  const canOffer    = job.status === 'open' && !isPublisher && !myOffer
  const canApproveOffer = job.status === 'open' && isPublisher && pendingOffers.length > 0
  const canSubmit   = job.status === 'in_progress' && job.delivery?.status === 'pending' && isCreator
  const canApprove  = job.delivery?.status === 'submitted' && isPublisher
  const canReview   = ds === 'approved' && isPublisher && !existingReview && !!job.creatorId
  const hasDelivery = !!job.delivery?.data?.length

  const handleAcceptOffer = useCallback((offerId: string) => {
    acceptOffer(job.id, offerId)
  }, [acceptOffer, job.id])

  // Messaging: both publisher and assigned creator can message once job is not just open w/ no relation
  const canSend = isPublisher || isCreator
  const handleSend = useCallback((content: string) => {
    sendMessage(job.id, currentUserId, content)
  }, [sendMessage, job.id, currentUserId])

  const handleApprove = useCallback(() => {
    approveDelivery(job.id)
    onClose()
  }, [approveDelivery, job.id, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(10,15,26,0.98)',
          border:     '1px solid rgba(255,255,255,0.1)',
          boxShadow:  '0 24px 80px rgba(0,0,0,0.7)',
          maxHeight:  '85vh',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
              >
                {DISPLAY_LABEL[ds]}
              </span>
              <span className="text-[10px] text-gray-600">{timeAgo}</span>
            </div>
            <h2 className="text-base font-bold text-white leading-snug">{job.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none flex-shrink-0 mt-1">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Job info */}
          <div className="px-6 py-5 flex flex-col gap-4 border-b border-white/[0.06]">
            <p className="text-sm text-gray-300 leading-[1.7]">{job.description}</p>

            <div className="flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600">预算</span>
                <span className="text-gray-300 font-medium">{job.budgetRange}</span>
              </div>
              {job.cityId && (
                <div className="flex items-center gap-1">
                  <span>🏙</span>
                  <span className="text-gray-400">{job.cityId}</span>
                </div>
              )}
              {job.delivery?.shotCount && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">交付镜头</span>
                  <span className="text-gray-300">{job.delivery.shotCount} 个</span>
                </div>
              )}
            </div>
          </div>

          {/* Deal Assistant — shown while job is open */}
          {job.status === 'open' && <AIPriceCard job={job} />}

          {/* Recommended directors — shown only while job is open */}
          {job.status === 'open' && <RecommendedDirectors job={job} />}

          {/* Offers section — shown when job is open and has offers or canOffer */}
          {job.status === 'open' && (offers.length > 0 || canOffer) && (
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  报价
                  {offers.length > 0 && <span className="ml-1.5 text-gray-600">{offers.length}</span>}
                </h3>
                {myOffer && (
                  <span className="text-[10px] text-indigo-400">已报价 ¥{myOffer.price.toLocaleString()}</span>
                )}
              </div>

              {offers.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {offers.map((offer) => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      canAccept={canApproveOffer}
                      onAccept={() => handleAcceptOffer(offer.id)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-xl px-4 py-4 text-center"
                  style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}
                >
                  <p className="text-xs text-gray-500">还没有报价，成为第一个报价的创作者</p>
                </div>
              )}
            </div>
          )}

          {/* Delivery section */}
          <div className="px-6 py-5">
            {/* Pending state */}
            {job.status === 'in_progress' && job.delivery?.status === 'pending' && (
              <div
                className="rounded-xl px-4 py-4 text-center"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
              >
                <p className="text-sm text-indigo-300 mb-1">创作进行中</p>
                <p className="text-xs text-gray-600">创作者正在制作，作品完成后将提交审核</p>
              </div>
            )}

            {/* Submitted delivery */}
            {job.delivery?.status === 'submitted' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">交付作品</h3>
                  {job.delivery.submittedAt && (
                    <span className="text-[10px] text-gray-600">
                      提交于 {formatTimeAgo(job.delivery.submittedAt)}
                    </span>
                  )}
                </div>
                <div
                  className="rounded-xl px-4 py-3 text-xs"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}
                >
                  ⏳ 已提交 · 等待需求方确认
                </div>
                {hasDelivery && (
                  <DeliveryContent shots={job.delivery.data ?? []} />
                )}
              </div>
            )}

            {/* Approved delivery */}
            {job.delivery?.status === 'approved' && (
              <div className="flex flex-col gap-4">
                <div
                  className="rounded-xl px-4 py-3 text-xs"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
                >
                  ✓ 已确认完成
                  {job.delivery.approvedAt && ` · ${formatTimeAgo(job.delivery.approvedAt)}`}
                </div>
                {hasDelivery && (
                  <DeliveryContent shots={job.delivery.data ?? []} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className="border-t border-white/[0.06] flex-shrink-0">
          <MessageThread
            messages={job.messages ?? []}
            currentUserId={currentUserId}
            canSend={canSend}
            onSend={handleSend}
          />
        </div>

        {/* Action footer */}
        {(canAccept || canOffer || canSubmit || canApprove || canReview) && (
          <div className="px-6 pb-6 pt-4 border-t border-white/[0.06] flex gap-3 flex-shrink-0">
            {canOffer && (
              <button
                onClick={() => setShowOffer(true)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
              >
                报价
              </button>
            )}
            {canAccept && !canOffer && (
              <button
                onClick={() => { onAccept(job.id); onClose() }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
              >
                接单
              </button>
            )}
            {canSubmit && (
              <button
                onClick={() => setShowSubmit(true)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}
              >
                提交作品
              </button>
            )}
            {canApprove && (
              <button
                onClick={handleApprove}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}
              >
                确认完成
              </button>
            )}
            {canReview && (
              <button
                onClick={() => setShowReview(true)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}
              >
                ⭐ 评价创作者
              </button>
            )}
            {ds === 'approved' && !canReview && existingReview && (
              <div
                className="flex-1 py-2.5 rounded-xl text-sm text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}
              >
                已评价 {'★'.repeat(existingReview.rating)}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Sub-modals */}
      <AnimatePresence>
        {showOffer && <OfferModal job={job} creatorId={currentUserId} onClose={() => setShowOffer(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showSubmit && <SubmitModal job={job} onClose={() => setShowSubmit(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showReview && <ReviewModal job={job} onClose={() => setShowReview(false)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Publish modal ────────────────────────────────────────────────────────────

function PublishModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle]          = useState('')
  const [description, setDesc]     = useState('')
  const [budgetRange, setBudget]   = useState<string>(BUDGET_PRESETS[2] ?? '¥3,000 – ¥5,000')
  const [customBudget, setCustom]  = useState('')
  const [useCustom, setUseCustom]  = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const publishJob = useJobsStore((s) => s.publishJob)
  const user       = useAuthStore((s) => s.user)

  const handleSubmit = useCallback(() => {
    const trimTitle = title.trim()
    const trimDesc  = description.trim()
    if (!trimTitle || !trimDesc) return
    setSubmitting(true)
    const budget = useCustom ? (customBudget.trim() || budgetRange) : budgetRange
    publishJob({ title: trimTitle, description: trimDesc, budgetRange: budget, publisherId: user?.id ?? 'guest' })
    setTimeout(onClose, 200)
  }, [title, description, budgetRange, customBudget, useCustom, publishJob, user, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'rgba(10,15,26,0.98)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-base font-bold text-white">发布需求</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">让创作者看到你的项目</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">需求标题 *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：品牌形象短片（30 秒）"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white/90 placeholder-gray-600 outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: title.trim() ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">需求描述 *</label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="描述你的项目背景、风格偏好、交付要求…"
              rows={4}
              className="w-full rounded-xl px-3.5 py-3 text-sm text-white/90 placeholder-gray-600 outline-none resize-none transition-colors leading-6"
              style={{ background: 'rgba(255,255,255,0.04)', border: description.trim() ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">预算范围</label>
            <div className="flex flex-wrap gap-1.5">
              {BUDGET_PRESETS.map((b) => (
                <button
                  key={b}
                  onClick={() => { setBudget(b); setUseCustom(false) }}
                  className="px-2.5 py-1 rounded-md text-[11px] transition-all"
                  style={{
                    background: !useCustom && budgetRange === b ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                    border:     !useCustom && budgetRange === b ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.07)',
                    color:      !useCustom && budgetRange === b ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {b}
                </button>
              ))}
              <button
                onClick={() => setUseCustom(true)}
                className="px-2.5 py-1 rounded-md text-[11px] transition-all"
                style={{
                  background: useCustom ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  border:     useCustom ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.07)',
                  color:      useCustom ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                }}
              >
                自定义
              </button>
            </div>
            {useCustom && (
              <input
                value={customBudget}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="例如：¥2,000 – ¥4,000"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white/90 placeholder-gray-600 outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.4)' }}
              />
            )}
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !description.trim() || submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
          >
            {submitting ? '发布中…' : '发布需求'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  const ds      = getDisplayStatus(job)
  const sc      = DISPLAY_COLOR[ds]
  const timeAgo = formatTimeAgo(job.createdAt)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      onClick={onClick}
      className="rounded-2xl p-5 flex flex-col gap-3 cursor-pointer transition-colors hover:border-white/[0.14]"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-white leading-snug">{job.title}</h3>
        <span
          className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
        >
          {DISPLAY_LABEL[ds]}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-[1.6] line-clamp-2">{job.description}</p>

      {/* Meta */}
      <div className="flex items-center gap-4 text-[11px] text-gray-600">
        <span className="text-gray-400 font-medium">{job.budgetRange}</span>
        {job.delivery?.shotCount && (
          <span className="text-gray-600">{job.delivery.shotCount} 镜头</span>
        )}
        <span className="ml-auto">{timeAgo}</span>
      </div>

      {/* Message count badge + chat entry */}
      {(job.messages?.length ?? 0) > 0 && (
        <div className="flex items-center gap-2">
          <div
            className="rounded-lg px-3 py-1.5 text-[10px] flex items-center gap-1.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}
          >
            <span>💬</span>
            <span>{job.messages!.length} 条消息</span>
          </div>
          {ds === 'in_progress' && (
            <Link
              href={`/chat/${job.id}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg px-3 py-1.5 text-[10px] font-semibold flex items-center gap-1.5 transition-all hover:opacity-80"
              style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#a5b4fc' }}
            >
              <span>→</span>
              <span>进入沟通</span>
            </Link>
          )}
        </div>
      )}
      {/* Offer count badge */}
      {ds === 'open' && (job.offers?.length ?? 0) > 0 && (
        <div
          className="rounded-lg px-3 py-1.5 text-[10px] flex items-center gap-1.5"
          style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', color: '#a5b4fc' }}
        >
          <span>💬</span>
          <span>{job.offers!.length} 个报价</span>
        </div>
      )}
      {/* Delivery indicator bar */}
      {ds === 'submitted' && (
        <div
          className="rounded-lg px-3 py-1.5 text-[10px] flex items-center gap-1.5"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}
        >
          <span>⏳</span>
          <span>交付已提交 · 等待审核</span>
        </div>
      )}
      {ds === 'approved' && (
        <div
          className="rounded-lg px-3 py-1.5 text-[10px] flex items-center gap-1.5"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
        >
          <span>✓</span>
          <span>交付已确认完成</span>
        </div>
      )}

      {/* CTA hint */}
      <p className="text-[10px] text-gray-700">点击查看详情 →</p>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [tab, setTab]             = useState<Tab>('全部')
  const [showPublish, setPublish] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  const jobs      = useJobsStore((s) => s.jobs)
  const acceptJob = useJobsStore((s) => s.acceptJob)
  const user      = useAuthStore((s) => s.user)

  const handleAccept = useCallback((jobId: string) => {
    const creatorId = user?.id ?? `guest-${Math.random().toString(36).slice(2, 6)}`
    acceptJob(jobId, creatorId)
  }, [acceptJob, user])

  const filtered = jobs.filter((j) => {
    const ds = getDisplayStatus(j)
    if (tab === '全部')   return true
    if (tab === '招募中') return ds === 'open'
    if (tab === '进行中') return ds === 'in_progress'
    if (tab === '待审核') return ds === 'submitted'
    if (tab === '已完成') return ds === 'approved' || ds === 'done'
    return true
  })

  const openCount    = jobs.filter((j) => j.status === 'open').length
  const pendingCount = jobs.filter((j) => j.delivery?.status === 'submitted').length

  // Keep selectedJob in sync with store updates
  const liveSelectedJob = selectedJob
    ? jobs.find((j) => j.id === selectedJob.id) ?? null
    : null

  return (
    <main className="min-h-screen bg-city-bg">
      <Nav />

      <div className="pt-14">
        {/* Page header */}
        <div className="px-6 py-10 border-b border-white/[0.05]">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs text-city-emerald tracking-[0.2em] uppercase mb-2 font-medium">Jobs</p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-1">创作接单</h1>
                <p className="text-sm text-gray-500">
                  {openCount > 0 && `${openCount} 个需求开放接单`}
                  {openCount > 0 && pendingCount > 0 && ' · '}
                  {pendingCount > 0 && <span className="text-amber-400">{pendingCount} 个待审核</span>}
                  {openCount === 0 && pendingCount === 0 && '暂无开放需求'}
                </p>
              </div>
              <button
                onClick={() => setPublish(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
              >
                <span>＋</span>
                <span>发布需求</span>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-6">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="relative px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    background: tab === t ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color:      tab === t ? 'white' : 'rgb(107,114,128)',
                  }}
                >
                  {t}
                  {t === '待审核' && pendingCount > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ background: '#f59e0b', color: '#000' }}
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Job list */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">📋</p>
              <p className="text-gray-500 text-sm mb-6">
                {tab === '全部' ? '还没有需求，来发布第一个吧' : `没有「${tab}」的需求`}
              </p>
              <button
                onClick={() => setPublish(true)}
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                发布需求 →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {filtered.map((job) => (
                  <JobCard key={job.id} job={job} onClick={() => setSelectedJob(job)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showPublish && <PublishModal onClose={() => setPublish(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {liveSelectedJob && (
          <JobDetailModal
            job={liveSelectedJob}
            onClose={() => setSelectedJob(null)}
            onAccept={handleAccept}
          />
        )}
      </AnimatePresence>
    </main>
  )
}
