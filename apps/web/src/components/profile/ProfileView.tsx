'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useProfileStore } from '@/store/profile.store'
import { useFeedStore } from '@/store/feed.store'
import { useJobsStore } from '@/store/jobs.store'
import { useReviewStore, selectReviewsFor } from '@/store/review.store'
import { useCreatorStore, computeLevel, getLevelTitle, getLevelColor } from '@/lib/user/creator'
import type { FeedProject } from '@/store/feed.store'
import type { Job } from '@/store/jobs.store'
import type { Review } from '@/store/review.store'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileTab = '作品' | '接单记录' | '发布需求' | '评价'
const TABS: ProfileTab[] = ['作品', '接单记录', '发布需求', '评价']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600_000)
  if (h < 1) return '刚刚'
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

// ─── Mini project card ────────────────────────────────────────────────────────

function MiniProjectCard({ project, index }: { project: FeedProject; index: number }) {
  const likeProject   = useFeedStore((s) => s.likeProject)
  const unlikeProject = useFeedStore((s) => s.unlikeProject)

  const handleLike = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (project.likedByMe) unlikeProject(project.id)
    else likeProject(project.id)
  }, [project.id, project.likedByMe, likeProject, unlikeProject])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
      style={{ aspectRatio: '4 / 3' }}
    >
      {/* Background */}
      {project.coverImage ? (
        <Image
          src={project.coverImage}
          alt={project.title}
          fill
          unoptimized
          sizes="420px"
          className="absolute inset-0 object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]"
          style={{ background: `linear-gradient(160deg, ${project.fromColor} 0%, #07090f 100%)` }}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/85" />
      <div
        className="absolute inset-0 rounded-2xl border border-white/[0.07] group-hover:border-white/[0.15] transition-colors pointer-events-none"
      />

      {!project.coverImage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl opacity-[0.07]">🎬</span>
        </div>
      )}

      {/* Tags */}
      <div className="absolute top-3 left-3 flex gap-1">
        {project.tags.slice(0, 1).map((t) => (
          <span
            key={t}
            className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', color: project.accent, border: `1px solid ${project.accent}44` }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* Like button */}
      <button
        onClick={handleLike}
        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-xs backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
        style={
          project.likedByMe
            ? { background: 'rgba(244,63,94,0.7)', color: 'white' }
            : { background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)' }
        }
      >
        {project.likedByMe ? '❤' : '♡'}
      </button>

      {/* Info */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8">
        <p className="text-xs font-bold text-white truncate leading-tight mb-0.5">{project.title}</p>
        <div className="flex items-center justify-between text-[9px] text-gray-500">
          <span>{project.shots.length} 镜头</span>
          <span>♥ {project.likes >= 1000 ? `${(project.likes / 1000).toFixed(1)}K` : project.likes}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Job row ──────────────────────────────────────────────────────────────────

const JOB_STATUS_LABEL: Record<string, string> = {
  open:        '招募中',
  in_progress: '进行中',
  done:        '已完成',
}

const JOB_STATUS_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  open:        { text: '#34d399', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
  in_progress: { text: '#a5b4fc', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.25)' },
  done:        { text: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
}

function getJobDisplayStatus(job: Job): string {
  if (job.delivery?.status === 'submitted') return 'submitted'
  if (job.delivery?.status === 'approved' || job.status === 'done') return 'done'
  return job.status
}

function JobRow({ job, index }: { job: Job; index: number }) {
  const ds = getJobDisplayStatus(job)
  const sc = JOB_STATUS_COLOR[ds] ?? JOB_STATUS_COLOR['open']!
  const label = ds === 'submitted' ? '待审核' : (JOB_STATUS_LABEL[ds] ?? ds)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-start justify-between gap-3 px-4 py-3.5 rounded-xl transition-colors hover:bg-white/[0.03]"
      style={{ border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/80 truncate">{job.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{job.budgetRange} · {formatTimeAgo(job.createdAt)}</p>
        {job.delivery?.shotCount && (
          <p className="text-[10px] text-gray-600 mt-0.5">{job.delivery.shotCount} 个镜头已交付</p>
        )}
      </div>
      <span
        className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium mt-0.5"
        style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
      >
        {label}
      </span>
    </motion.div>
  )
}

// ─── Star display ─────────────────────────────────────────────────────────────

function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'text-lg' : 'text-sm'
  return (
    <span className={sz}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: n <= Math.round(rating) ? '#f59e0b' : 'rgba(255,255,255,0.15)' }}>★</span>
      ))}
    </span>
  )
}

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({ review, index }: { review: Review; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="px-4 py-4 rounded-xl flex flex-col gap-2"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <StarDisplay rating={review.rating} />
        <span className="text-[10px] text-gray-600">{formatTimeAgo(review.createdAt)}</span>
      </div>
      {review.comment && (
        <p className="text-sm text-gray-300 leading-[1.7]">{review.comment}</p>
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProfileView({ userId }: { userId: string }) {
  const [tab, setTab] = useState<ProfileTab>('作品')

  const profiles    = useProfileStore((s) => s.profiles)
  const currentUserId = useProfileStore((s) => s.currentUserId)
  const allProjects = useFeedStore((s) => s.projects)
  const allJobs     = useJobsStore((s) => s.jobs)
  const myReviews   = useReviewStore(selectReviewsFor(userId))

  const getCreator = useCreatorStore((s) => s.getCreator)

  const profile = profiles.find((p) => p.id === userId)
  const isMe    = userId === currentUserId

  const myProjects    = allProjects.filter((p) => p.authorId === userId)
  const acceptedJobs  = allJobs.filter((j) => j.creatorId === userId)
  const publishedJobs = allJobs.filter((j) => j.publisherId === userId)

  const totalLikes = myProjects.reduce((acc, p) => acc + p.likes, 0)
  const doneJobs   = acceptedJobs.filter((j) => j.status === 'done' || j.delivery?.status === 'approved').length

  // Creator level data — live doneJobs take precedence over seeded completedJobs
  const creatorRecord  = getCreator(userId)
  const liveLevel      = computeLevel(doneJobs)
  const levelColor     = getLevelColor(liveLevel)
  const levelTitle     = getLevelTitle(liveLevel)
  const totalEarnings  = creatorRecord?.totalEarnings ?? 0
  const successRate    = creatorRecord?.successRate   ?? 100

  if (!profile) {
    return (
      <div className="min-h-screen bg-city-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">👤</p>
          <p className="text-gray-500 text-sm">找不到该用户</p>
          <Link href="/explore" className="text-xs text-indigo-400 hover:text-indigo-300 mt-3 inline-block">
            ← 回到发现页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-city-bg">
      {/* ── Banner header ─────────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: 200,
          background: `linear-gradient(135deg, ${profile.accentColor}22 0%, #070b14 60%)`,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow */}
        <div
          className="absolute top-0 left-1/3 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none"
          style={{ background: profile.accentColor }}
        />
      </div>

      {/* ── Profile card (overlaps banner) ────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6">
        <div className="relative -mt-16 flex items-end gap-5 pb-6 border-b border-white/[0.07]">
          {/* Avatar */}
          <div
            className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 ring-4"
            style={{
              background: `linear-gradient(135deg, ${profile.accentColor}33, ${profile.accentColor}11)`,
              border:     `2px solid ${profile.accentColor}55`,
              boxShadow:  `0 0 0 4px #070b14`,
            }}
          >
            {profile.avatar ?? profile.name.charAt(0)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-white">{profile.name}</h1>
              {/* Level badge */}
              <span
                className="text-[11px] px-2.5 py-0.5 rounded-full font-bold"
                style={{
                  background: `${levelColor}1a`,
                  color:      levelColor,
                  border:     `1px solid ${levelColor}44`,
                  boxShadow:  `0 0 8px ${levelColor}22`,
                }}
              >
                Lv{liveLevel} {levelTitle}
              </span>
              {isMe && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: `${profile.accentColor}22`, color: profile.accentColor, border: `1px solid ${profile.accentColor}44` }}
                >
                  我的主页
                </span>
              )}
            </div>
            {profile.bio && (
              <p className="text-sm text-gray-400 mt-1 leading-[1.6] max-w-xl">{profile.bio}</p>
            )}
            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {profile.skills.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6 flex-shrink-0 pb-1 text-center">
            {[
              { value: myProjects.length,    label: '作品' },
              { value: totalLikes >= 1000 ? `${(totalLikes / 1000).toFixed(1)}K` : totalLikes, label: '获赞' },
              { value: doneJobs,             label: '完成接单' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-lg font-bold text-white">{value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
            {profile && profile.rating != null && (
              <div>
                <div className="flex items-center gap-0.5 justify-center">
                  <span className="text-base font-bold text-white">{profile.rating.toFixed(1)}</span>
                  <span className="text-amber-400 text-sm ml-0.5">★</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">{profile.reviewCount} 评价</p>
              </div>
            )}
          </div>
        </div>

        {/* Joined */}
        <p className="text-[10px] text-gray-700 mt-2">加入于 {formatDate(profile.joinedAt)}</p>

        {/* ── Creator stat cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          {/* Level */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
            style={{
              background: `${levelColor}0d`,
              border:     `1px solid ${levelColor}30`,
            }}
          >
            <p className="text-[10px] font-medium" style={{ color: `${levelColor}99` }}>等级</p>
            <p className="text-2xl font-bold" style={{ color: levelColor }}>Lv{liveLevel}</p>
            <p className="text-[10px]" style={{ color: `${levelColor}77` }}>{levelTitle}</p>
          </motion.div>

          {/* Total earnings */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
            style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)' }}
          >
            <p className="text-[10px] font-medium text-emerald-500/70">总收入</p>
            <p className="text-2xl font-bold text-emerald-400">
              {totalEarnings >= 10000
                ? `${(totalEarnings / 10000).toFixed(1)}w`
                : `¥${totalEarnings.toLocaleString()}`}
            </p>
            <p className="text-[10px] text-emerald-600">人民币</p>
          </motion.div>

          {/* Completed jobs */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
            style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <p className="text-[10px] font-medium text-indigo-400/70">完成订单</p>
            <p className="text-2xl font-bold text-indigo-300">{doneJobs}</p>
            <p className="text-[10px] text-indigo-600">成功率 {successRate}%</p>
          </motion.div>

          {/* Rating */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
            style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <p className="text-[10px] font-medium text-amber-500/70">评分</p>
            <p className="text-2xl font-bold text-amber-400">
              {profile.rating != null ? profile.rating.toFixed(1) : '—'}
            </p>
            <p className="text-[10px] text-amber-600">
              {profile.reviewCount ? `${profile.reviewCount} 条评价` : '暂无评价'}
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 mt-6">
        <div className="flex gap-1 border-b border-white/[0.06] mb-6">
          {TABS.map((t) => {
            const count = t === '作品' ? myProjects.length : t === '接单记录' ? acceptedJobs.length : t === '发布需求' ? publishedJobs.length : myReviews.length
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="relative px-5 py-2.5 text-sm font-medium transition-all duration-200"
                style={{ color: tab === t ? 'white' : 'rgb(107,114,128)' }}
              >
                {t}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px]" style={{ color: tab === t ? profile.accentColor : 'rgb(75,85,99)' }}>
                    {count}
                  </span>
                )}
                {tab === t && (
                  <motion.div
                    layoutId="profile-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: profile.accentColor }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {tab === '作品' && (
            <motion.div
              key="projects"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {myProjects.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-4xl mb-3">🎬</p>
                  <p className="text-gray-500 text-sm">
                    {isMe ? '还没有发布作品，去创作工作台开始吧' : '该创作者还未发布作品'}
                  </p>
                  {isMe && (
                    <Link href="/create" className="text-sm text-indigo-400 hover:text-indigo-300 mt-3 inline-block">
                      去创作 →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-12">
                  {myProjects.map((project, i) => (
                    <MiniProjectCard key={project.id} project={project} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === '接单记录' && (
            <motion.div
              key="accepted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {acceptedJobs.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-gray-500 text-sm">
                    {isMe ? '还没有接单记录' : '该创作者还未接单'}
                  </p>
                  {isMe && (
                    <Link href="/jobs" className="text-sm text-indigo-400 hover:text-indigo-300 mt-3 inline-block">
                      去接单广场 →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2 pb-12">
                  {acceptedJobs.map((job, i) => (
                    <JobRow key={job.id} job={job} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === '发布需求' && (
            <motion.div
              key="published"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {publishedJobs.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-4xl mb-3">💼</p>
                  <p className="text-gray-500 text-sm">
                    {isMe ? '还没有发布需求' : '该用户还未发布需求'}
                  </p>
                  {isMe && (
                    <Link href="/jobs" className="text-sm text-indigo-400 hover:text-indigo-300 mt-3 inline-block">
                      去发布需求 →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2 pb-12">
                  {publishedJobs.map((job, i) => (
                    <JobRow key={job.id} job={job} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
          {tab === '评价' && (
            <motion.div
              key="reviews"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Rating summary */}
              {profile && profile.rating != null && myReviews.length > 0 && (
                <div
                  className="rounded-2xl px-6 py-5 mb-6 flex items-center gap-6"
                  style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}
                >
                  <div className="text-center">
                    <p className="text-4xl font-bold text-white">{profile.rating.toFixed(1)}</p>
                    <StarDisplay rating={profile.rating} size="lg" />
                    <p className="text-[10px] text-gray-500 mt-1">{profile.reviewCount} 条评价</p>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    {[5, 4, 3, 2, 1].map((n) => {
                      const cnt = myReviews.filter((r) => r.rating === n).length
                      const pct = myReviews.length > 0 ? (cnt / myReviews.length) * 100 : 0
                      return (
                        <div key={n} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 w-2">{n}</span>
                          <span className="text-amber-400 text-[10px]">★</span>
                          <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: '#f59e0b' }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-600 w-3 text-right">{cnt}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {myReviews.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-4xl mb-3">⭐</p>
                  <p className="text-gray-500 text-sm">
                    {isMe ? '还没有收到评价' : '该创作者还未收到评价'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 pb-12">
                  {myReviews.map((r, i) => (
                    <ReviewCard key={r.id} review={r} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
