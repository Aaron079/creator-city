'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Nav } from '@/components/layout/Nav'
import { useJobsStore } from '@/store/jobs.store'
import { useRelationshipStore, daysAgo, isReturningClient } from '@/store/relationship.store'
import type { Relationship } from '@/store/relationship.store'
import { CREATORS } from '@/lib/data/creators'
import type { CreatorUser as Creator } from '@/lib/data/creators'

// ─── Types ────────────────────────────────────────────────────────────────────

type CityKey = 'all' | 'Tokyo' | 'Shanghai' | 'Beijing' | 'LA'

const CITIES: { key: CityKey; label: string; icon: string }[] = [
  { key: 'all',      label: '全部',   icon: '🌏' },
  { key: 'Tokyo',    label: '东京',   icon: '🗼' },
  { key: 'Shanghai', label: '上海',   icon: '🏙️' },
  { key: 'Beijing',  label: '北京',   icon: '🏯' },
  { key: 'LA',       label: '洛杉矶', icon: '🌆' },
]

const ROLE_BG: Record<string, string> = {
  '导演':   'rgba(99,102,241,0.18)',
  '摄影师': 'rgba(236,72,153,0.18)',
  '剪辑师': 'rgba(6,182,212,0.18)',
  '配乐':   'rgba(16,185,129,0.18)',
}
const ROLE_FG: Record<string, string> = {
  '导演':   '#a5b4fc',
  '摄影师': '#f9a8d4',
  '剪辑师': '#67e8f9',
  '配乐':   '#6ee7b7',
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  const full  = Math.floor(rating)
  const half  = rating - full >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span className="flex items-center gap-[1px] text-[11px]">
      {Array.from({ length: full  }).map((_, i) => <span key={`f${i}`} style={{ color: '#fbbf24' }}>★</span>)}
      {half  && <span style={{ color: '#fbbf24', opacity: 0.55 }}>★</span>}
      {Array.from({ length: empty }).map((_, i) => <span key={`e${i}`} style={{ color: 'rgba(255,255,255,0.1)' }}>★</span>)}
    </span>
  )
}

// ─── Creator card ─────────────────────────────────────────────────────────────

function CreatorCard({ creator, index, onContact, relationship }: {
  creator:      Creator
  index:        number
  onContact:    (creator: Creator) => void
  relationship: Relationship | undefined
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.045, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.025, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background:  'rgba(255,255,255,0.025)',
        border:      hovered ? '1px solid rgba(99,102,241,0.45)' : '1px solid rgba(255,255,255,0.07)',
        boxShadow:   hovered
          ? '0 0 36px rgba(99,102,241,0.16), 0 20px 48px rgba(0,0,0,0.45)'
          : '0 4px 20px rgba(0,0,0,0.25)',
        transition:  'border-color 0.2s, box-shadow 0.25s',
      }}
    >
      {/* Accent top strip */}
      <div className="h-[2px] flex-shrink-0" style={{ background: creator.accent }} />

      {/* Hover glow */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-0 w-40 h-40 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
            }}
          />
        )}
      </AnimatePresence>

      <div className="relative p-5 flex flex-col gap-4 flex-1">

        {/* Avatar + identity */}
        <div className="flex items-start gap-3">
          <motion.div
            animate={hovered ? { scale: 1.08 } : { scale: 1 }}
            transition={{ duration: 0.2 }}
            className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black flex-shrink-0"
            style={{ background: creator.accent, color: 'white' }}
          >
            {creator.avatar}
          </motion.div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-bold text-white truncate">{creator.name}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold"
                style={{
                  background: ROLE_BG[creator.role] ?? 'rgba(99,102,241,0.18)',
                  color:      ROLE_FG[creator.role] ?? '#a5b4fc',
                }}
              >
                {creator.roleIcon} {creator.role}
              </span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                {creator.city}
              </span>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {creator.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-lg text-[10px]"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.38)' }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Rating + cases */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Stars rating={creator.rating} />
            <span className="text-[11px] font-black" style={{ color: '#fbbf24' }}>
              {creator.rating.toFixed(1)}
            </span>
          </div>
          <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="flex items-center gap-1">
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>案例</span>
            <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {creator.casesCount}
            </span>
          </div>
        </div>

        {/* Relationship history */}
        {relationship && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            <span className="text-xs">🤝</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold" style={{ color: '#34d399' }}>
                合作过 {relationship.totalJobs} 次
                {isReturningClient(relationship) && (
                  <span
                    className="ml-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                    style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}
                  >
                    老客户
                  </span>
                )}
              </p>
              <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                最近合作：{daysAgo(relationship.lastWorkedAt)}
              </p>
            </div>
            <p className="text-[10px] font-bold flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
              ¥{relationship.totalSpent.toLocaleString()}
            </p>
          </div>
        )}

        {/* CTA */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onContact(creator)}
          className="mt-auto w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
          style={{
            background:  hovered ? creator.accent : 'rgba(255,255,255,0.05)',
            border:      hovered ? '1px solid transparent' : '1px solid rgba(255,255,255,0.08)',
            color:       hovered ? 'white' : 'rgba(255,255,255,0.5)',
            boxShadow:   hovered ? '0 4px 20px rgba(99,102,241,0.3)' : 'none',
            transition:  'all 0.2s',
          }}
        >
          <span>💬</span>
          联系TA
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CityPage() {
  const router         = useRouter()
  const publishJob     = useJobsStore((s) => s.publishJob)
  const acceptJob      = useJobsStore((s) => s.acceptJob)
  const getRelation    = useRelationshipStore((s) => s.get)
  const relationships  = useRelationshipStore((s) => s.relationships)

  const [city, setCity] = useState<CityKey>('all')

  const sorted = useMemo(() => {
    const pool = city === 'all' ? CREATORS : CREATORS.filter((c) => c.city === city)
    return [...pool].sort((a, b) => {
      const relA = relationships.find((r) => r.userId === 'user-me' && r.creatorId === a.id)
      const relB = relationships.find((r) => r.userId === 'user-me' && r.creatorId === b.id)
      // Collaborated creators first
      const collabDiff = (relB ? 1 : 0) - (relA ? 1 : 0)
      if (collabDiff !== 0) return collabDiff
      // Then by totalJobs desc
      const jobsDiff = (relB?.totalJobs ?? 0) - (relA?.totalJobs ?? 0)
      if (jobsDiff !== 0) return jobsDiff
      // Then rating + cases
      return b.rating - a.rating || b.casesCount - a.casesCount
    })
  }, [city, relationships])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of CREATORS) m[c.city] = (m[c.city] ?? 0) + 1
    return m
  }, [])

  const handleContact = (creator: Creator) => {
    const job = publishJob({
      title:       `与 ${creator.name} 的合作`,
      description: '通过城市社群发起的合作请求',
      budgetRange: '面议',
      publisherId: 'user-me',
    })
    acceptJob(job.id, creator.id)
    router.push(`/chat/${job.id}`)
  }

  return (
    <main className="min-h-screen" style={{ background: '#050810', color: '#f9fafb' }}>
      <Nav />

      <div className="pt-14">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden border-b border-white/[0.05]">
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute top-[-60px] left-[15%] w-[500px] h-[500px] rounded-full opacity-[0.055]"
              style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', filter: 'blur(48px)' }}
            />
            <div
              className="absolute top-[-40px] right-[10%] w-[400px] h-[400px] rounded-full opacity-[0.04]"
              style={{ background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)', filter: 'blur(48px)' }}
            />
          </div>

          <div className="relative max-w-5xl mx-auto px-6 py-14">
            <p className="text-[10px] tracking-[0.22em] uppercase font-medium mb-3" style={{ color: '#a5b4fc' }}>
              City Network
            </p>
            <h1 className="text-4xl font-black tracking-tight mb-2">城市创作者</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
              发现各城市顶尖创作者，一键发起合作
            </p>

            {/* Live counts */}
            <div className="flex items-center gap-5 mt-6 flex-wrap">
              {(Object.entries(counts) as [string, number][]).map(([c, n]) => (
                <div key={c} className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#6366f1', boxShadow: '0 0 4px #6366f188' }}
                  />
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.32)' }}>
                    {c}
                    <span className="font-bold ml-1" style={{ color: '#a5b4fc' }}>{n}</span>
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>共</span>
                <span className="text-sm font-black" style={{ color: '#a5b4fc' }}>{CREATORS.length}</span>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>位创作者</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── City tabs ─────────────────────────────────────────────────── */}
        <div className="border-b border-white/[0.05]">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex gap-1 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {CITIES.map((ct) => {
                const count  = ct.key === 'all' ? CREATORS.length : (counts[ct.key] ?? 0)
                const active = city === ct.key
                return (
                  <motion.button
                    key={ct.key}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCity(ct.key)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-medium whitespace-nowrap flex-shrink-0 transition-all"
                    style={
                      active
                        ? { background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)' }
                        : { background: 'transparent', color: 'rgba(255,255,255,0.35)', border: '1px solid transparent' }
                    }
                  >
                    <span>{ct.icon}</span>
                    <span>{ct.label}</span>
                    {count > 0 && (
                      <span
                        className="min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{
                          background: active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)',
                          color:      active ? '#a5b4fc'               : 'rgba(255,255,255,0.28)',
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Creator grid ──────────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-6 py-10">

          {/* Sort hint */}
          <p className="text-[10px] mb-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
            按评分 · 案例数排序 · {sorted.length} 位创作者
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={city}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {sorted.map((creator, i) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  index={i}
                  onContact={handleContact}
                  relationship={getRelation('user-me', creator.id)}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <p className="text-5xl">🌏</p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>该城市暂无创作者</p>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
