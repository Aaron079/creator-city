'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Nav } from '@/components/layout/Nav'
import { useFeedStore } from '@/store/feed.store'
import { useJobsStore } from '@/store/jobs.store'
import { useAuthStore } from '@/store/auth.store'
import { useCaseStore } from '@/lib/case/caseStore'
import type { FeedProject } from '@/store/feed.store'
import type { Case } from '@/lib/case/caseStore'

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_OPTIONS = ['最新', '热门'] as const
type Sort = typeof SORT_OPTIONS[number]

// ─── Project detail modal ─────────────────────────────────────────────────────

function ProjectModal({
  project,
  onClose,
}: {
  project: FeedProject
  onClose: () => void
}) {
  const likeProject   = useFeedStore((s) => s.likeProject)
  const unlikeProject = useFeedStore((s) => s.unlikeProject)
  const publishJob    = useJobsStore((s) => s.publishJob)
  const user          = useAuthStore((s) => s.user)

  const [jobCreated, setJobCreated] = useState(false)

  const handleLike = useCallback(() => {
    if (project.likedByMe) unlikeProject(project.id)
    else likeProject(project.id)
  }, [project.id, project.likedByMe, likeProject, unlikeProject])

  const handleHire = useCallback(() => {
    publishJob({
      title:       `合作邀请 · ${project.title}`,
      description: `看到了「${project.title}」的作品，希望与 ${project.author} 合作类似风格的项目。\n\n作品描述：${project.description}`,
      budgetRange: '面议',
      publisherId: user?.id ?? 'guest',
    })
    setJobCreated(true)
  }, [project, publishJob, user])

  const coverShot = project.shots.find((s) => s.imageUrl) ?? project.shots[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.22 }}
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(8,12,22,0.99)',
          border:     '1px solid rgba(255,255,255,0.1)',
          boxShadow:  '0 32px 100px rgba(0,0,0,0.8)',
          maxHeight:  '88vh',
        }}
      >
        {/* Cover */}
        <div
          className="w-full flex-shrink-0 flex items-center justify-center relative overflow-hidden"
          style={{
            height:     220,
            background: `linear-gradient(160deg, ${project.fromColor} 0%, #070b14 100%)`,
          }}
        >
          {project.coverImage
            ? (
              <Image
                src={project.coverImage}
                alt={project.title}
                fill
                unoptimized
                sizes="768px"
                className="absolute inset-0 object-cover"
              />
            )
            : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-8xl opacity-[0.07]">🎬</span>
              </div>
            )
          }
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#08090e] via-transparent to-transparent" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
            style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)' }}
          >
            ✕
          </button>

          {/* Tags */}
          <div className="absolute top-4 left-4 flex gap-1">
            {project.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-[9px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.55)', color: project.accent, border: `1px solid ${project.accent}40` }}
              >
                {t}
              </span>
            ))}
          </div>

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
            <h2 className="text-xl font-bold text-white leading-tight">{project.title}</h2>
            {project.authorId ? (
              <Link
                href={`/profile/${project.authorId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm mt-1 hover:underline inline-block"
                style={{ color: project.accent }}
              >
                {project.author}
              </Link>
            ) : (
              <p className="text-sm mt-1" style={{ color: project.accent }}>{project.author}</p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Description */}
          <p className="text-sm text-gray-300 leading-[1.75]">{project.description}</p>

          {/* Shot list */}
          {project.shots.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
                分镜方案 · {project.shots.length} 个镜头
              </p>
              <div className="flex flex-col gap-2">
                {project.shots.map((shot, i) => (
                  <div
                    key={i}
                    className="rounded-xl px-4 py-3 flex flex-col gap-1.5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ background: `${project.accent}22`, color: project.accent }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium text-white/80">{shot.label}</span>
                    </div>
                    {shot.idea && (
                      <p className="text-[11px] text-gray-500 leading-[1.5] pl-7">{shot.idea}</p>
                    )}
                    {shot.keyframePrompt && (
                      <p className="text-[10px] text-indigo-400/60 font-mono leading-[1.4] pl-7 line-clamp-2">
                        {shot.keyframePrompt}
                      </p>
                    )}
                    {/* Image if available */}
                    {shot.imageUrl && (
                      <div className="relative w-full rounded-lg overflow-hidden mt-1" style={{ height: 140 }}>
                        <Image
                          src={shot.imageUrl}
                          alt={shot.label}
                          fill
                          unoptimized
                          sizes="480px"
                          className="object-cover"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cover shot keyframe prompt for preview */}
          {coverShot?.keyframePrompt && !project.shots.some((s) => s.imageUrl) && (
            <div
              className="rounded-xl px-4 py-3 text-[11px] font-mono leading-[1.6] text-indigo-300/60"
              style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}
            >
              {coverShot.keyframePrompt}
            </div>
          )}

          {/* Job created confirmation */}
          {jobCreated && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl px-4 py-3 text-sm text-emerald-300 flex items-center gap-2"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <span>✓</span>
              <span>合作需求已发布到接单广场，创作者可以看到并接单</span>
            </motion.div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center gap-3 px-6 pb-6 pt-4 border-t border-white/[0.06] flex-shrink-0"
        >
          {/* Like button */}
          <button
            onClick={handleLike}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={
              project.likedByMe
                ? { background: 'rgba(244,63,94,0.18)', border: '1px solid rgba(244,63,94,0.4)', color: '#fb7185' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }
            }
          >
            <span>{project.likedByMe ? '❤️' : '🤍'}</span>
            <span>{project.likes.toLocaleString()}</span>
          </button>

          {/* Hire button */}
          {!jobCreated ? (
            <button
              onClick={handleHire}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: `linear-gradient(135deg, ${project.accent}cc, ${project.accent})`,
                boxShadow:  `0 4px 20px ${project.accent}33`,
              }}
            >
              找 TA 合作 →
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}
            >
              去接单广场查看 →
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Case card ────────────────────────────────────────────────────────────────

function CaseCard({ c, index }: { c: Case; index: number }) {
  const router = useRouter()

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{
        y:         -4,
        scale:     1.015,
        boxShadow: `0 20px 52px rgba(0,0,0,0.65), 0 0 20px ${c.accentColor}28`,
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
      transition={{ delay: index * 0.07, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true }}
      onClick={() => router.push(`/case/${c.id}`)}
      className="relative flex-shrink-0 w-72 rounded-2xl overflow-hidden flex flex-col cursor-pointer"
      style={{
        background: 'rgba(10,14,24,0.85)',
        border:     `1px solid ${c.accentColor}30`,
        boxShadow:  `0 8px 32px rgba(0,0,0,0.45), 0 0 0 0.5px ${c.accentColor}20`,
      }}
    >
      {/* Top accent */}
      <div
        className="h-[2px] w-full"
        style={{ background: `linear-gradient(90deg, ${c.accentColor}, ${c.accentColor}44)` }}
      />

      {/* Visual area */}
      <div
        className="group/visual relative h-36 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${c.accentColor}18 0%, rgba(7,11,20,0.9) 100%)` }}
      >
        <span className="text-5xl opacity-20 select-none">{c.icon}</span>

        {/* Hover arrow */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/visual:opacity-100 transition-opacity">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold"
            style={{ background: `${c.accentColor}cc`, boxShadow: `0 4px 20px ${c.accentColor}55` }}
          >
            →
          </div>
        </div>

        {/* Category tag */}
        <span
          className="absolute top-2.5 left-2.5 text-[9px] px-1.5 py-0.5 rounded-full"
          style={{ background: `${c.accentColor}22`, color: c.accentColor, border: `1px solid ${c.accentColor}44` }}
        >
          {c.category}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-4 flex flex-col gap-2.5 flex-1">
        <h3 className="text-sm font-bold text-white leading-snug">{c.title}</h3>
        <p className="text-[11px] text-gray-400 leading-[1.65]">{c.description}</p>

        {/* Result pill */}
        <div
          className="rounded-xl px-3 py-2 mt-auto"
          style={{ background: `${c.accentColor}0f`, border: `1px solid ${c.accentColor}25` }}
        >
          <p className="text-[10px] font-medium" style={{ color: c.accentColor }}>
            📈 {c.result}
          </p>
        </div>
      </div>

      {/* Detail link row */}
      <div className="px-4 pb-4">
        <div
          className="w-full py-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5"
          style={{
            background: `${c.accentColor}14`,
            border:     `1px solid ${c.accentColor}35`,
            color:      c.accentColor,
          }}
        >
          <span>查看详情</span>
          <span>→</span>
        </div>
      </div>
    </motion.div>
  )
}

function CaseSection() {
  const cases = useCaseStore((s) => s.cases)

  return (
    <div className="border-b border-white/[0.05]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Section header */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-xs text-amber-400/70 tracking-[0.2em] uppercase mb-1 font-medium">Case Study</p>
            <h2 className="text-xl font-bold text-white">成功案例</h2>
          </div>
          <p className="text-[11px] text-gray-600">{cases.length} 个案例</p>
        </div>

        {/* Horizontal scroll row */}
        <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {cases.map((c, i) => (
            <CaseCard key={c.id} c={c} index={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  index,
  onClick,
  onLike,
}: {
  project: FeedProject
  index: number
  onClick: () => void
  onLike: (e: React.MouseEvent) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{
        y:         -3,
        scale:     1.02,
        boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 20px rgba(99,102,241,0.12)',
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      whileTap={{ scale: 0.97, transition: { duration: 0.1 } }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true }}
      onClick={onClick}
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
      style={{ aspectRatio: index % 5 === 0 ? '3 / 4' : index % 7 === 3 ? '3 / 5' : '3 / 4' }}
    >
      {/* Background / cover */}
      {project.coverImage ? (
        <Image
          src={project.coverImage}
          alt={project.title}
          fill
          unoptimized
          sizes="360px"
          className="absolute inset-0 object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]"
          style={{ background: `linear-gradient(160deg, ${project.fromColor} 0%, #07090f 100%)` }}
        />
      )}

      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90" />

      {/* Border */}
      <div
        className="absolute inset-0 rounded-2xl border border-white/[0.06] group-hover:border-white/[0.14] transition-colors pointer-events-none"
      />

      {/* Ghost icon */}
      {!project.coverImage && (
        <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
          <span className="text-6xl opacity-[0.08] group-hover:opacity-[0.12] transition-opacity">🎬</span>
        </div>
      )}

      {/* Tags */}
      <div className="absolute top-3 left-3 flex gap-1">
        {project.tags.slice(0, 1).map((t) => (
          <span
            key={t}
            className="text-[9px] px-1.5 py-0.5 rounded-full backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.5)', color: project.accent, border: `1px solid ${project.accent}40` }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* Like button (top-right) */}
      <button
        onClick={onLike}
        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-xs backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
        style={
          project.likedByMe
            ? { background: 'rgba(244,63,94,0.7)', color: 'white' }
            : { background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)' }
        }
      >
        {project.likedByMe ? '❤' : '♡'}
      </button>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-10">
        <p className="text-xs font-bold text-white leading-tight mb-0.5 truncate">{project.title}</p>
        {project.authorId ? (
          <Link
            href={`/profile/${project.authorId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[9px] mb-2 font-medium truncate hover:underline block"
            style={{ color: project.accent }}
          >
            {project.author}
          </Link>
        ) : (
          <p className="text-[9px] mb-2 font-medium truncate" style={{ color: project.accent }}>
            {project.author}
          </p>
        )}
        <div className="flex items-center justify-between text-[9px] text-gray-500">
          <span>{project.shots.length} 镜头</span>
          <span>♥ {project.likes >= 1000 ? `${(project.likes / 1000).toFixed(1)}K` : project.likes}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [sort, setSort]       = useState<Sort>('最新')
  const [selected, setSelected] = useState<FeedProject | null>(null)

  const projects     = useFeedStore((s) => s.projects)
  const likeProject  = useFeedStore((s) => s.likeProject)
  const unlikeProject = useFeedStore((s) => s.unlikeProject)

  const sorted = [...projects].sort((a, b) => {
    if (sort === '热门') return b.likes - a.likes
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const handleLike = useCallback((e: React.MouseEvent, id: string, likedByMe: boolean) => {
    e.stopPropagation()
    if (likedByMe) unlikeProject(id)
    else likeProject(id)
  }, [likeProject, unlikeProject])

  // Keep selected in sync with store updates
  const liveSelected = selected
    ? projects.find((p) => p.id === selected.id) ?? null
    : null

  return (
    <main className="min-h-screen bg-city-bg">
      <Nav />

      <div className="pt-14">
        {/* Header */}
        <div className="px-6 py-10 border-b border-white/[0.05]">
          <div className="max-w-6xl mx-auto">
            <p className="text-xs text-city-accent-glow tracking-[0.2em] uppercase mb-2 font-medium">Explore</p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-1">发现作品</h1>
                <p className="text-sm text-gray-500">{projects.length} 件作品</p>
              </div>

              {/* Sort toggle */}
              <div
                className="flex rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSort(opt)}
                    className="px-4 py-2 text-sm font-medium transition-all"
                    style={
                      sort === opt
                        ? { background: 'rgba(255,255,255,0.1)', color: 'white' }
                        : { background: 'transparent', color: 'rgba(255,255,255,0.35)' }
                    }
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Case studies */}
        <CaseSection />

        {/* Grid */}
        <div className="max-w-6xl mx-auto px-6 py-10">
          {projects.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-5xl mb-4">🎬</p>
              <p className="text-gray-500 text-sm">还没有作品，去创作工作台发布第一件吧</p>
            </div>
          ) : (
            <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
              {sorted.map((project, i) => (
                <div key={project.id} className="break-inside-avoid">
                  <ProjectCard
                    project={project}
                    index={i}
                    onClick={() => setSelected(project)}
                    onLike={(e) => handleLike(e, project.id, project.likedByMe)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {liveSelected && (
          <ProjectModal project={liveSelected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </main>
  )
}
