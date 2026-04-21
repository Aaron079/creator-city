'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useJobsStore } from '@/store/jobs.store'
import { useChatStore } from '@/store/chat.store'
import { useOrderStore, ORDER_STATUS_META } from '@/store/order.store'
import { useRelationshipStore, daysAgo, isReturningClient } from '@/store/relationship.store'
import { useTeamStore } from '@/store/team.store'
import { useTaskStore, TASK_STATUS_META } from '@/store/task.store'
import type { Team, TeamMember, ProjectStage } from '@/store/team.store'
import type { Task, TaskStatus } from '@/store/task.store'
import type { Order } from '@/store/order.store'
import type { Quote } from '@/store/chat.store'
import type { Message } from '@/store/jobs.store'

// ─── Types ────────────────────────────────────────────────────────────────────

type Perspective = 'creator' | 'publisher'

type TimelineItem =
  | { kind: 'message'; data: Message }
  | { kind: 'quote';   data: Quote   }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function deriveChatStatus(quotes: Quote[]): { label: string; color: string; bg: string } {
  if (quotes.some((q) => q.status === 'accepted')) {
    return { label: '已成交', color: '#34d399', bg: 'rgba(16,185,129,0.12)' }
  }
  if (quotes.some((q) => q.status === 'pending')) {
    return { label: '报价中', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' }
  }
  return { label: '联系中', color: '#a5b4fc', bg: 'rgba(99,102,241,0.12)' }
}

// ─── Stage constants ──────────────────────────────────────────────────────────

const STAGE_META: Record<ProjectStage, { label: string; icon: string; color: string; bg: string }> = {
  idea:       { label: '创意阶段', icon: '💡', color: '#a5b4fc', bg: 'rgba(99,102,241,0.15)'  },
  storyboard: { label: '分镜策划', icon: '📐', color: '#f9a8d4', bg: 'rgba(236,72,153,0.15)'  },
  shooting:   { label: '拍摄执行', icon: '📷', color: '#67e8f9', bg: 'rgba(6,182,212,0.15)'   },
  editing:    { label: '后期剪辑', icon: '✂️', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)'  },
  delivery:   { label: '最终交付', icon: '📦', color: '#34d399', bg: 'rgba(16,185,129,0.15)'  },
}
const STAGE_KEYS: ProjectStage[] = ['idea', 'storyboard', 'shooting', 'editing', 'delivery']

// ─── Stage modal ──────────────────────────────────────────────────────────────

function StageModal({ current, onClose, onSelect }: {
  current:  ProjectStage
  onClose:  () => void
  onSelect: (stage: ProjectStage) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{ opacity: 0,   y: 16, scale: 0.97  }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm rounded-2xl p-5 flex flex-col gap-3"
        style={{ background: 'rgba(8,12,22,0.99)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-bold text-white">切换项目阶段</p>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}
          >✕</button>
        </div>
        {STAGE_KEYS.map((stage) => {
          const m      = STAGE_META[stage]
          const active = stage === current
          return (
            <motion.button
              key={stage}
              whileTap={{ scale: 0.97 }}
              onClick={() => { onSelect(stage); onClose() }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
              style={
                active
                  ? { background: m.bg, border: `1px solid ${m.color}50` }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }
              }
            >
              <span className="text-base">{m.icon}</span>
              <p className="flex-1 text-sm font-medium" style={{ color: active ? m.color : 'rgba(255,255,255,0.55)' }}>
                {m.label}
              </p>
              {active && (
                <span className="text-[10px] font-bold" style={{ color: m.color }}>当前 ✓</span>
              )}
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}

// ─── Task panel ───────────────────────────────────────────────────────────────

type ShotSnap = { label?: string; idea?: string; shotType?: string }

function TaskPanel({ tasks, team, shots, onCreateTask, onUpdateStatus }: {
  tasks:          Task[]
  team:           Team
  shots:          ShotSnap[]
  onCreateTask:   (title: string, assignedTo: string, assignedName: string) => void
  onUpdateStatus: (taskId: string, status: TaskStatus) => void
}) {
  const [showForm,    setShowForm]    = useState(false)
  const [newTitle,    setNewTitle]    = useState('')
  const [newAssignee, setNewAssignee] = useState(() => team.members.find((m) => m.status === 'joined')?.userId ?? '')

  const joined = team.members.filter((m) => m.status === 'joined')

  const grouped: { status: TaskStatus; label: string; icon: string; color: string; items: Task[] }[] = [
    { status: 'doing', label: '进行中', icon: '▶', color: '#fbbf24', items: tasks.filter((t) => t.status === 'doing') },
    { status: 'todo',  label: '待处理', icon: '○', color: 'rgba(255,255,255,0.4)', items: tasks.filter((t) => t.status === 'todo') },
    { status: 'done',  label: '已完成', icon: '✓', color: '#34d399', items: tasks.filter((t) => t.status === 'done') },
  ]

  const handleCreate = () => {
    const member = team.members.find((m) => m.userId === newAssignee)
    if (!newTitle.trim() || !member) return
    onCreateTask(newTitle.trim(), member.userId, member.name)
    setNewTitle('')
    setShowForm(false)
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      <div className="p-4 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {tasks.length} 个任务
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowForm((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold"
            style={{
              background: showForm ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)',
              border:     '1px solid rgba(99,102,241,0.35)',
              color:      '#a5b4fc',
            }}
          >
            <span>{showForm ? '✕' : '+'}</span>
            {showForm ? '取消' : '新建任务'}
          </motion.button>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="rounded-2xl p-4 flex flex-col gap-3"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="任务标题…"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <select
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {joined.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.name} · {m.role}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}
                  >
                    取消
                  </button>
                  <motion.button
                    whileHover={newTitle.trim() ? { scale: 1.02 } : {}}
                    whileTap={newTitle.trim() ? { scale: 0.97 } : {}}
                    onClick={handleCreate}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-white"
                    style={{
                      background: newTitle.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(99,102,241,0.2)',
                      opacity:    newTitle.trim() ? 1 : 0.5,
                    }}
                  >
                    创建
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task groups */}
        {grouped.map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.status} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: group.color }}>{group.icon}</span>
                <p className="text-[10px] font-semibold" style={{ color: group.color }}>
                  {group.label} · {group.items.length}
                </p>
              </div>
              {group.items.map((task) => {
                const sm   = TASK_STATUS_META[task.status]
                const next = sm.next
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[12px] font-medium leading-snug"
                        style={{
                          color:          task.status === 'done' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)',
                          textDecoration: task.status === 'done' ? 'line-through' : 'none',
                        }}
                      >
                        {task.title}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        {task.assignedName}
                      </p>
                    </div>
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                      style={{ background: sm.bg, color: sm.color }}
                    >
                      {sm.label}
                    </span>
                    {next && (
                      <motion.button
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => onUpdateStatus(task.id, next)}
                        className="text-[9px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                        style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)' }}
                      >
                        {sm.nextLabel} →
                      </motion.button>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )
        )}

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-3xl">✅</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>暂无任务，点击新建开始分工</p>
          </div>
        )}

        {/* Shared shots */}
        {shots.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            <div
              className="flex items-center gap-2 pb-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-[11px]">🎬</span>
              <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                分镜共享 · {shots.length} 个
              </p>
            </div>
            {shots.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)' }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">{s.label ?? `Shot ${i + 1}`}</p>
                  {s.idea && (
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {s.idea}
                    </p>
                  )}
                </div>
                {s.shotType && (
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-md font-semibold flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}
                  >
                    {s.shotType}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Team constants ───────────────────────────────────────────────────────────

const INVITE_CANDIDATES = [
  { id: 'city-creator-1', name: '陈灵一',   avatar: '陈', defaultRole: '摄影师' },
  { id: 'city-creator-2', name: 'Yuki Mori', avatar: 'Y',  defaultRole: '摄影师' },
  { id: 'city-creator-3', name: '林泽宇',   avatar: '林', defaultRole: '剪辑师' },
  { id: 'city-creator-4', name: '方晓晴',   avatar: '方', defaultRole: '配乐'  },
  { id: 'city-creator-6', name: '顾蕾',     avatar: '顾', defaultRole: '摄影师' },
  { id: 'city-creator-7', name: 'Max Chen', avatar: 'M',  defaultRole: '剪辑师' },
] as const

const MEMBER_ROLES = ['导演', '摄影师', '剪辑师', '配乐', '编剧', '后期', '发布方'] as const

const TROLE_BG: Record<string, string> = {
  '导演':   'rgba(99,102,241,0.2)',  '摄影师': 'rgba(236,72,153,0.2)',
  '剪辑师': 'rgba(6,182,212,0.2)',   '配乐':   'rgba(16,185,129,0.2)',
  '发布方': 'rgba(251,146,60,0.2)',  '编剧':   'rgba(234,179,8,0.2)',
  '后期':   'rgba(168,85,247,0.2)',
}
const TROLE_FG: Record<string, string> = {
  '导演':   '#a5b4fc', '摄影师': '#f9a8d4', '剪辑师': '#67e8f9',
  '配乐':   '#6ee7b7', '发布方': '#fb923c', '编剧':   '#fde047',
  '后期':   '#d8b4fe',
}

// ─── Team panel ───────────────────────────────────────────────────────────────

function TeamPanel({ team, perspective, onInvite, onAccept }: {
  team:        Team
  perspective: Perspective
  onInvite:    () => void
  onAccept:    (userId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const joined  = team.members.filter((m) => m.status === 'joined')
  const invited = team.members.filter((m) => m.status === 'invited')
  const isOwner = perspective === 'publisher'

  return (
    <div className="flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      {/* Collapsed header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-2 transition-colors hover:bg-white/[0.02]"
        style={{ background: 'rgba(99,102,241,0.025)' }}
      >
        {/* Avatar stack */}
        <div className="flex -space-x-1.5">
          {joined.slice(0, 4).map((m) => (
            <div
              key={m.userId}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
              style={{
                background: TROLE_BG[m.role] ?? 'rgba(99,102,241,0.2)',
                color:      TROLE_FG[m.role] ?? '#a5b4fc',
                border:     '1.5px solid #050810',
              }}
              title={m.name}
            >
              {m.name.slice(0, 1)}
            </div>
          ))}
          {invited.length > 0 && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
              style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1.5px solid #050810' }}
            >
              +{invited.length}
            </div>
          )}
        </div>

        <p className="text-[10px] font-medium flex-1 text-left" style={{ color: 'rgba(255,255,255,0.32)' }}>
          <span>团队</span>
          <span className="ml-1.5 font-bold" style={{ color: '#a5b4fc' }}>{team.members.length} 人</span>
          {invited.length > 0 && (
            <span className="ml-2" style={{ color: '#fbbf24' }}>· {invited.length} 人待加入</span>
          )}
        </p>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[9px]"
          style={{ color: 'rgba(255,255,255,0.18)' }}
        >
          ▼
        </motion.span>
      </button>

      {/* Expanded */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 py-3 flex flex-col gap-2">
              {team.members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black flex-shrink-0"
                    style={{
                      background: m.status === 'invited'
                        ? 'rgba(255,255,255,0.04)'
                        : (TROLE_BG[m.role] ?? 'rgba(99,102,241,0.2)'),
                      color: m.status === 'invited'
                        ? 'rgba(255,255,255,0.3)'
                        : (TROLE_FG[m.role] ?? '#a5b4fc'),
                      border: m.status === 'invited' ? '1px dashed rgba(255,255,255,0.1)' : 'none',
                    }}
                  >
                    {m.name.slice(0, 1)}
                  </div>

                  {/* Name + role */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{m.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold"
                        style={{ background: TROLE_BG[m.role] ?? 'rgba(99,102,241,0.18)', color: TROLE_FG[m.role] ?? '#a5b4fc' }}
                      >
                        {m.role}
                      </span>
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                        {m.split}%
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  {m.status === 'joined' ? (
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}
                    >
                      ✓ 已加入
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}
                      >
                        待加入
                      </span>
                      {perspective === 'creator' && (
                        <motion.button
                          whileHover={{ scale: 1.06 }}
                          whileTap={{ scale: 0.94 }}
                          onClick={() => onAccept(m.userId)}
                          className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                          style={{ background: 'rgba(99,102,241,0.22)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)' }}
                        >
                          接受
                        </motion.button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Invite button */}
              {isOwner && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onInvite}
                  className="mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold"
                  style={{
                    background: 'rgba(99,102,241,0.06)',
                    border:     '1px dashed rgba(99,102,241,0.28)',
                    color:      '#a5b4fc',
                  }}
                >
                  <span className="text-sm leading-none">+</span>
                  邀请成员
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteModal({ team, onClose, onInvite }: {
  team:     Team
  onClose:  () => void
  onInvite: (member: Omit<TeamMember, 'status'>) => void
}) {
  const existingIds = new Set(team.members.map((m) => m.userId))
  const available   = INVITE_CANDIDATES.filter((c) => !existingIds.has(c.id))

  const [selected, setSelected] = useState('')
  const [role,     setRole]     = useState('')
  const [split,    setSplit]    = useState('10')

  const candidate = INVITE_CANDIDATES.find((c) => c.id === selected)
  const splitNum  = parseInt(split, 10)
  const usedSplit = team.members.reduce((s, m) => s + m.split, 0)
  const remaining = 100 - usedSplit
  const valid     = !!selected && !!role && splitNum > 0 && splitNum <= remaining

  useEffect(() => {
    if (candidate) setRole(candidate.defaultRole)
  }, [candidate])

  const handleSubmit = () => {
    if (!valid || !candidate) return
    onInvite({ userId: candidate.id, name: candidate.name, role, split: splitNum })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{ opacity: 0,   y: 20, scale: 0.97  }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md rounded-2xl flex flex-col gap-5 p-6"
        style={{ background: 'rgba(8,12,22,0.98)', border: '1px solid rgba(99,102,241,0.25)', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
      >
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">邀请团队成员</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              剩余可分配：<span className="font-bold" style={{ color: '#a5b4fc' }}>{remaining}%</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}
          >✕</button>
        </div>

        {/* User grid */}
        {available.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            暂无可邀请的用户
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.32)' }}>
              选择成员
            </label>
            <div className="grid grid-cols-3 gap-2">
              {available.map((c) => {
                const isActive = selected === c.id
                return (
                  <motion.button
                    key={c.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelected(c.id)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl"
                    style={
                      isActive
                        ? { background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.45)' }
                        : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }
                    }
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black"
                      style={{
                        background: isActive ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)',
                        color:      isActive ? '#a5b4fc'               : 'rgba(255,255,255,0.55)',
                      }}
                    >
                      {c.avatar}
                    </div>
                    <p
                      className="text-[10px] font-medium leading-tight text-center"
                      style={{ color: isActive ? '#a5b4fc' : 'rgba(255,255,255,0.5)' }}
                    >
                      {c.name}
                    </p>
                  </motion.button>
                )
              })}
            </div>
          </div>
        )}

        {/* Role + split */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] tracking-widest uppercase mb-2 block" style={{ color: 'rgba(255,255,255,0.32)' }}>
              职能角色
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <option value="">选择角色</option>
              {MEMBER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="w-28">
            <label className="text-[10px] tracking-widest uppercase mb-2 block" style={{ color: 'rgba(255,255,255,0.32)' }}>
              分成比例
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={remaining}
                value={split}
                onChange={(e) => setSplit(e.target.value)}
                className="w-full rounded-xl pl-3 pr-6 py-2.5 text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                %
              </span>
            </div>
          </div>
        </div>

        {/* Preview */}
        {candidate && role && splitNum > 0 && (
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.25)', color: '#a5b4fc' }}
            >
              {candidate.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{candidate.name}</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {role} · {splitNum}% 分成
              </p>
            </div>
            <span
              className="text-[10px] px-2 py-1 rounded-lg font-semibold flex-shrink-0"
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
            >
              待接受
            </span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
          >
            取消
          </button>
          <motion.button
            whileHover={valid ? { scale: 1.02 } : {}}
            whileTap={valid ? { scale: 0.97 } : {}}
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{
              background: valid ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(99,102,241,0.15)',
              boxShadow:  valid ? '0 4px 20px rgba(99,102,241,0.4)' : 'none',
              cursor:     valid ? 'pointer' : 'not-allowed',
              opacity:    valid ? 1 : 0.5,
            }}
          >
            发送邀请
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Quote card ───────────────────────────────────────────────────────────────

function QuoteCard({
  quote,
  isMine,
  onAccept,
  onReject,
}: {
  quote:     Quote
  isMine:    boolean
  onAccept:  (id: string) => void
  onReject:  (id: string) => void
}) {
  const isPending  = quote.status === 'pending'
  const isAccepted = quote.status === 'accepted'
  const isRejected = quote.status === 'rejected'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mx-4 my-3 rounded-2xl overflow-hidden"
      style={{
        background: isAccepted
          ? 'rgba(16,185,129,0.08)'
          : isRejected
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(99,102,241,0.08)',
        border: isAccepted
          ? '1px solid rgba(16,185,129,0.3)'
          : isRejected
            ? '1px solid rgba(255,255,255,0.06)'
            : '1px solid rgba(99,102,241,0.3)',
      }}
    >
      {/* Top accent strip */}
      <div
        className="h-[2px]"
        style={{
          background: isAccepted
            ? 'linear-gradient(90deg, #10b981, #34d39944)'
            : isRejected
              ? 'linear-gradient(90deg, rgba(255,255,255,0.1), transparent)'
              : 'linear-gradient(90deg, #6366f1, #6366f144)',
        }}
      />

      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <span className="text-xs font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>
              报价单
            </span>
          </div>
          <span
            className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
            style={
              isAccepted
                ? { background: 'rgba(16,185,129,0.2)',  color: '#34d399' }
                : isRejected
                  ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }
                  : { background: 'rgba(99,102,241,0.2)',  color: '#a5b4fc' }
            }
          >
            {isAccepted ? '✓ 已确认' : isRejected ? '✕ 已拒绝' : '● 待确认'}
          </span>
        </div>

        {/* Price + days */}
        <div className="flex items-end gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
              报价金额
            </p>
            <p
              className="text-3xl font-black"
              style={{ color: isRejected ? 'rgba(255,255,255,0.3)' : isAccepted ? '#34d399' : '#a5b4fc' }}
            >
              ¥{quote.price.toLocaleString()}
            </p>
          </div>
          <div
            className="w-px self-stretch"
            style={{ background: 'rgba(255,255,255,0.07)', margin: '2px 0' }}
          />
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
              交付周期
            </p>
            <p className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {quote.deliveryDays} 天
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-[12px] leading-[1.7]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {quote.description}
        </p>

        {/* Actions — only for publisher on pending quotes */}
        {!isMine && isPending && (
          <div className="flex gap-3 pt-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onAccept(quote.id)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow:  '0 4px 16px rgba(16,185,129,0.35)',
              }}
            >
              接受报价
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onReject(quote.id)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border:     '1px solid rgba(255,255,255,0.1)',
                color:      'rgba(255,255,255,0.45)',
              }}
            >
              拒绝
            </motion.button>
          </div>
        )}

        {/* Creator-side pending hint */}
        {isMine && isPending && (
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            等待对方确认…
          </p>
        )}

        {/* Order created notice */}
        {isAccepted && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            <span className="text-xs">📦</span>
            <p className="text-[11px] font-medium" style={{ color: '#34d399' }}>
              订单已创建 · 请前往
            </p>
            <Link
              href="/orders"
              className="text-[11px] font-bold underline"
              style={{ color: '#34d399' }}
            >
              订单中心 →
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Quote modal ──────────────────────────────────────────────────────────────

function QuoteModal({
  onClose,
  onSubmit,
}: {
  onClose:  () => void
  onSubmit: (price: number, days: number, desc: string) => void
}) {
  const [price, setPrice] = useState('')
  const [days,  setDays]  = useState('')
  const [desc,  setDesc]  = useState('')

  const priceNum = parseInt(price.replace(/,/g, ''), 10)
  const daysNum  = parseInt(days, 10)
  const valid    = priceNum > 0 && daysNum > 0 && desc.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{ opacity: 0,   y: 20, scale: 0.97  }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md rounded-2xl flex flex-col gap-5 p-6"
        style={{
          background: 'rgba(8,12,22,0.98)',
          border:     '1px solid rgba(99,102,241,0.25)',
          boxShadow:  '0 32px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">发送报价</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              填写报价信息，发布方确认后正式成交
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}
          >
            ✕
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          {/* Price */}
          <div>
            <label className="text-[10px] tracking-widest uppercase mb-2 block" style={{ color: 'rgba(255,255,255,0.35)' }}>
              报价金额（¥）
            </label>
            <div className="relative">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                ¥
              </span>
              <input
                type="number"
                placeholder="5000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-xl pl-8 pr-4 py-3 text-sm font-bold text-white placeholder-white/20 outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border:     '1px solid rgba(255,255,255,0.1)',
                }}
              />
            </div>
          </div>

          {/* Delivery days */}
          <div>
            <label className="text-[10px] tracking-widest uppercase mb-2 block" style={{ color: 'rgba(255,255,255,0.35)' }}>
              交付时间（天）
            </label>
            <input
              type="number"
              placeholder="5"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border:     '1px solid rgba(255,255,255,0.1)',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] tracking-widest uppercase mb-2 block" style={{ color: 'rgba(255,255,255,0.35)' }}>
              报价说明
            </label>
            <textarea
              rows={3}
              placeholder="包含的内容、交付物、注意事项…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none resize-none leading-[1.6]"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border:     '1px solid rgba(255,255,255,0.1)',
              }}
            />
          </div>
        </div>

        {/* Preview */}
        {priceNum > 0 && daysNum > 0 && (
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-4 text-sm"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <span className="font-black text-indigo-300">¥{priceNum.toLocaleString()}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{daysNum} 天交付</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border:     '1px solid rgba(255,255,255,0.08)',
              color:      'rgba(255,255,255,0.4)',
            }}
          >
            取消
          </button>
          <motion.button
            whileHover={valid ? { scale: 1.02 } : {}}
            whileTap={valid ? { scale: 0.97 } : {}}
            onClick={() => valid && onSubmit(priceNum, daysNum, desc.trim())}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity"
            style={{
              background: valid ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(99,102,241,0.2)',
              boxShadow:  valid ? '0 4px 20px rgba(99,102,241,0.4)' : 'none',
              cursor:     valid ? 'pointer' : 'not-allowed',
              opacity:    valid ? 1 : 0.5,
            }}
          >
            确认发送
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Payment modal ────────────────────────────────────────────────────────────

function PaymentModal({ order, onClose, onPay }: {
  order:   Order
  onClose: () => void
  onPay:   () => void
}) {
  const [paying, setPaying] = useState(false)
  const [done,   setDone]   = useState(false)
  const [piId,   setPiId]   = useState('')
  const [error,  setError]  = useState('')

  const handlePay = async () => {
    setPaying(true)
    setError('')
    try {
      // Step 1: Create PaymentIntent via API
      const res = await fetch('/api/payment/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orderId: order.id, amount: order.price }),
      })
      if (!res.ok) throw new Error('API error')
      const { clientSecret, paymentIntentId } = await res.json() as {
        clientSecret: string; paymentIntentId: string
      }

      // Step 2: Confirm payment (real: stripe.confirmPayment({ clientSecret }))
      setPiId(paymentIntentId)
      console.info('[Payment] intent created:', paymentIntentId, '| secret:', clientSecret.slice(0, 20) + '…')
      await new Promise((r) => setTimeout(r, 700))

      // Step 3: Simulate webhook — server confirms payment and returns orderId
      const whRes = await fetch('/api/payment/webhook', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          type: 'payment_intent.succeeded',
          data: { object: { id: paymentIntentId } },
        }),
      })
      const whData = await whRes.json() as { handled: boolean; action?: string }
      if (!whData.handled || whData.action !== 'mark_paid') throw new Error('webhook_rejected')

      // Step 4: Update order state only after server confirms
      onPay()
      setDone(true)
      await new Promise((r) => setTimeout(r, 900))
      onClose()
    } catch {
      setError('支付请求失败，请重试')
      setPaying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{ opacity: 0,   y: 20, scale: 0.97  }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'rgba(8,12,22,0.99)', border: '1px solid rgba(251,146,60,0.3)', boxShadow: '0 32px 80px rgba(0,0,0,0.75)' }}
      >
        {/* Orange top strip */}
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #fb923c, #f59e0b44)' }} />

        <div className="p-6 flex flex-col gap-5">
          {done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-4"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                style={{ background: 'rgba(16,185,129,0.2)', border: '2px solid #34d399' }}
              >
                ✓
              </div>
              <p className="text-base font-bold text-white">支付成功</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>订单已进入制作流程</p>
            </motion.div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>模拟支付</p>
                  <p className="text-base font-bold text-white mt-0.5">确认支付订单</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}
                >✕</button>
              </div>

              {/* Amount */}
              <div
                className="rounded-2xl p-5 flex flex-col items-center gap-1"
                style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)' }}
              >
                <p className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>支付金额</p>
                <p className="text-4xl font-black" style={{ color: '#fb923c' }}>
                  ¥{order.price.toLocaleString()}
                </p>
              </div>

              {/* Mock QR / payment icons */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-28 h-28 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="grid grid-cols-5 gap-0.5 opacity-30">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded-[2px]"
                        style={{ background: Math.random() > 0.4 ? 'white' : 'transparent' }}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>扫码支付（模拟）</p>
              </div>

              {/* Pay button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handlePay}
                disabled={paying}
                className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                style={{
                  background: paying ? 'rgba(251,146,60,0.4)' : 'linear-gradient(135deg, #fb923c, #f59e0b)',
                  boxShadow:  paying ? 'none' : '0 4px 20px rgba(251,146,60,0.45)',
                }}
              >
                {paying ? (
                  <>
                    <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      ⟳
                    </motion.span>
                    支付中…
                  </>
                ) : '确认模拟支付'}
              </motion.button>

              {error && (
                <p className="text-[11px] text-center" style={{ color: '#f87171' }}>{error}</p>
              )}

              {piId && (
                <p className="text-[9px] text-center font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>
                  {piId.slice(0, 28)}…
                </p>
              )}

              <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.15)' }}>
                仅做状态模拟，不涉及真实资金
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { jobId } = useParams<{ jobId: string }>()

  const jobs        = useJobsStore((s) => s.jobs)
  const sendMsg     = useJobsStore((s) => s.sendMessage)
  const quotes      = useChatStore((s) => s.quotes)
  const addQuote    = useChatStore((s) => s.addQuote)
  const setStatus   = useChatStore((s) => s.updateQuoteStatus)
  const createOrder   = useOrderStore((s) => s.createOrder)
  const payOrder      = useOrderStore((s) => s.payOrder)
  const allOrders     = useOrderStore((s) => s.orders)
  const getRelation   = useRelationshipStore((s) => s.get)
  const teams         = useTeamStore((s) => s.teams)
  const createTeam    = useTeamStore((s) => s.createTeam)
  const inviteMember  = useTeamStore((s) => s.inviteMember)
  const acceptInvite  = useTeamStore((s) => s.acceptInvite)
  const updateStage   = useTeamStore((s) => s.updateStage)
  const allTasks      = useTaskStore((s) => s.tasks)
  const createTask    = useTaskStore((s) => s.createTask)
  const updateTask    = useTaskStore((s) => s.updateStatus)

  const job = jobs.find((j) => j.id === jobId)

  const [perspective,  setPerspective] = useState<Perspective>('publisher')
  const [text,         setText]        = useState('')
  const [showModal,    setShowModal]   = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showInvite,   setShowInvite]   = useState(false)
  const [showStage,    setShowStage]    = useState(false)
  const [activeTab,    setActiveTab]    = useState<'messages' | 'tasks'>('messages')
  const bottomRef = useRef<HTMLDivElement>(null)

  const jobQuotes  = quotes.filter((q) => q.jobId === jobId)
  const chatStatus = deriveChatStatus(jobQuotes)

  const chatOrders    = allOrders.filter((o) => o.chatId === jobId)
  const activeOrder   = chatOrders[chatOrders.length - 1] ?? null
  const orderMeta     = activeOrder ? ORDER_STATUS_META[activeOrder.status] : null
  const relationship  = job?.creatorId ? getRelation('user-me', job.creatorId) : undefined
  const activeTeam    = activeOrder ? teams.find((t) => t.projectId === activeOrder.id) : undefined
  const teamTasks     = activeTeam ? allTasks.filter((t) => t.teamId === activeTeam.id) : []
  const shots         = (job?.delivery?.data ?? []).map((s) => ({ label: s.label, idea: s.idea, shotType: s.shotType }))

  const myId = perspective === 'creator'
    ? (job?.creatorId ?? 'user-creator')
    : (job?.publisherId ?? 'user-publisher')

  // Build sorted timeline
  const timeline: TimelineItem[] = [
    ...(job?.messages ?? []).map((m): TimelineItem => ({ kind: 'message', data: m })),
    ...jobQuotes.map((q): TimelineItem => ({ kind: 'quote', data: q })),
  ].sort((a, b) => {
    const ta = a.kind === 'message' ? a.data.createdAt : a.data.createdAt
    const tb = b.kind === 'message' ? b.data.createdAt : b.data.createdAt
    return ta - tb
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [timeline.length])

  const handleSend = useCallback(() => {
    const t = text.trim()
    if (!t || !jobId) return
    sendMsg(jobId, myId, t)
    setText('')
  }, [text, jobId, myId, sendMsg])

  const handleAccept = useCallback((quoteId: string) => {
    const q = jobQuotes.find((x) => x.id === quoteId)
    if (!q || !jobId) return
    setStatus(quoteId, 'accepted')
    const order = createOrder(jobId, quoteId, q.price)
    createTeam(order.id, 'user-me', '我 (发布方)')
  }, [jobQuotes, jobId, setStatus, createOrder, createTeam])

  const handleQuoteSubmit = useCallback((price: number, deliveryDays: number, description: string) => {
    if (!jobId) return
    addQuote({ jobId, senderId: myId, price, deliveryDays, description, status: 'pending' })
    setShowModal(false)
  }, [jobId, myId, addQuote])

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050810' }}>
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-4">找不到该项目</p>
          <Link href="/jobs" className="text-indigo-400 text-sm hover:underline">← 返回接单广场</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: '#050810', color: '#f9fafb' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-4 px-5 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(5,8,16,0.95)', backdropFilter: 'blur(16px)' }}
      >
        <Link
          href="/jobs"
          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 transition-colors hover:bg-white/[0.08]"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}
        >
          ←
        </Link>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{job.title}</p>
          <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {job.budgetRange}
          </p>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold"
            style={{ background: chatStatus.bg, color: chatStatus.color, border: `1px solid ${chatStatus.color}40` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: chatStatus.color }} />
            {chatStatus.label}
          </span>

          {orderMeta && (
            <Link
              href="/orders"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold transition-opacity hover:opacity-80"
              style={{ background: orderMeta.bg, color: orderMeta.color, border: `1px solid ${orderMeta.color}40` }}
            >
              <span>📦</span>
              订单：{orderMeta.label}
            </Link>
          )}

          {relationship && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}
              title={`最近合作：${daysAgo(relationship.lastWorkedAt)}`}
            >
              <span>🤝</span>
              合作 {relationship.totalJobs} 次
            </span>
          )}

          {relationship && isReturningClient(relationship) && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}
            >
              ⭐ 老客户
            </span>
          )}

          {activeTeam && (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setShowStage(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold"
              style={{
                background: STAGE_META[activeTeam.stage].bg,
                color:      STAGE_META[activeTeam.stage].color,
                border:     `1px solid ${STAGE_META[activeTeam.stage].color}45`,
              }}
            >
              <span>{STAGE_META[activeTeam.stage].icon}</span>
              {STAGE_META[activeTeam.stage].label}
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Perspective toggle ──────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-2 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}
      >
        <p className="text-[10px] mr-1" style={{ color: 'rgba(255,255,255,0.2)' }}>视角：</p>
        {(['publisher', 'creator'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPerspective(p)}
            className="px-3 py-1 rounded-lg text-[10px] font-medium transition-all"
            style={
              perspective === p
                ? { background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)' }
                : { background: 'transparent', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }
            }
          >
            {p === 'publisher' ? '📋 发布方' : '🎬 创作者'}
          </button>
        ))}
      </div>

      {/* ── Team panel ─────────────────────────────────────────────────── */}
      {activeTeam && (
        <TeamPanel
          team={activeTeam}
          perspective={perspective}
          onInvite={() => setShowInvite(true)}
          onAccept={(userId) => acceptInvite(activeTeam.id, userId)}
        />
      )}

      {/* ── Tab strip ──────────────────────────────────────────────────── */}
      {activeTeam && (
        <div className="flex-shrink-0 flex border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
          {(['messages', 'tasks'] as const).map((tab) => {
            const active = activeTab === tab
            const label  = tab === 'messages'
              ? '💬 消息'
              : `✅ 任务${teamTasks.length > 0 ? ` · ${teamTasks.length}` : ''}`
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2.5 text-[11px] font-semibold transition-all"
                style={{
                  color:        active ? '#a5b4fc' : 'rgba(255,255,255,0.3)',
                  borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Payment banner ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeOrder?.paymentStatus === 'unpaid' && activeTab === 'messages' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div
              className="flex items-center justify-between px-5 py-3 gap-4"
              style={{
                background:   'rgba(251,146,60,0.1)',
                borderBottom: '1px solid rgba(251,146,60,0.25)',
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: '#fb923c', boxShadow: '0 0 6px #fb923c88', animation: 'orb-pulse 2s ease-in-out infinite' }}
                />
                <p className="text-xs font-medium truncate" style={{ color: '#fb923c' }}>
                  订单待支付 · <span className="font-black">¥{activeOrder.price.toLocaleString()}</span>
                  <span className="ml-1.5 font-normal" style={{ color: 'rgba(251,146,60,0.6)' }}>· 请在 24h 内完成</span>
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowPayModal(true)}
                className="flex-shrink-0 px-4 py-1.5 rounded-xl text-xs font-bold"
                style={{
                  background: 'linear-gradient(135deg, #fb923c, #f59e0b)',
                  color:      'white',
                  boxShadow:  '0 2px 12px rgba(251,146,60,0.4)',
                }}
              >
                前往支付 →
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {activeTab === 'tasks' && activeTeam ? (
        <TaskPanel
          tasks={teamTasks}
          team={activeTeam}
          shots={shots}
          onCreateTask={(title, assignedTo, assignedName) =>
            createTask(activeTeam.id, title, assignedTo, assignedName)
          }
          onUpdateStatus={updateTask}
        />
      ) : (
      <div className="flex-1 overflow-y-auto py-4" style={{ scrollbarWidth: 'thin' }}>

        {timeline.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>还没有消息，开始聊天吧</p>
          </div>
        )}

        {timeline.map((item, i) => {
          if (item.kind === 'quote') {
            return (
              <QuoteCard
                key={item.data.id}
                quote={item.data}
                isMine={item.data.senderId === myId}
                onAccept={handleAccept}
                onReject={(id) => setStatus(id, 'rejected')}
              />
            )
          }

          const msg    = item.data
          const isMine = msg.senderId === myId

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.15) }}
              className={`flex px-4 mb-2 ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              {/* Avatar (other side) */}
              {!isMine && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mr-2.5 flex-shrink-0 mt-auto mb-0.5"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
                >
                  {msg.senderId.slice(-2).toUpperCase()}
                </div>
              )}

              <div className={`flex flex-col gap-1 max-w-[72%] ${isMine ? 'items-end' : 'items-start'}`}>
                <div
                  className="rounded-2xl px-4 py-2.5 text-sm leading-[1.65]"
                  style={
                    isMine
                      ? { background: 'rgba(99,102,241,0.22)', color: '#e0e7ff', borderBottomRightRadius: 6 }
                      : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)', borderBottomLeftRadius: 6 }
                  }
                >
                  {msg.content}
                </div>
                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </motion.div>
          )
        })}

        <div ref={bottomRef} />
      </div>
      )}

      {/* ── Input bar (messages tab only) ───────────────────────────────── */}
      {activeTab === 'messages' && (
      <div
        className="flex-shrink-0 flex items-end gap-3 px-4 py-3 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(5,8,16,0.98)' }}
      >
        {/* Quote button — creator only */}
        {perspective === 'creator' && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowModal(true)}
            className="flex-shrink-0 h-10 px-4 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all"
            style={{
              background: 'rgba(99,102,241,0.15)',
              border:     '1px solid rgba(99,102,241,0.35)',
              color:      '#a5b4fc',
            }}
          >
            <span>📋</span>
            <span>发送报价</span>
          </motion.button>
        )}

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            placeholder="发送消息…"
            className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none resize-none leading-[1.6]"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border:     '1px solid rgba(255,255,255,0.1)',
              maxHeight:  120,
            }}
          />
        </div>

        {/* Send */}
        <motion.button
          whileHover={text.trim() ? { scale: 1.05 } : {}}
          whileTap={text.trim() ? { scale: 0.95 } : {}}
          onClick={handleSend}
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all"
          style={{
            background: text.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)',
            color:      text.trim() ? 'white' : 'rgba(255,255,255,0.2)',
            boxShadow:  text.trim() ? '0 4px 16px rgba(99,102,241,0.4)' : 'none',
          }}
        >
          ↑
        </motion.button>
      </div>
      )}

      {/* ── Quote modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <QuoteModal
            onClose={() => setShowModal(false)}
            onSubmit={handleQuoteSubmit}
          />
        )}
      </AnimatePresence>

      {/* ── Payment modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPayModal && activeOrder && (
          <PaymentModal
            order={activeOrder}
            onClose={() => setShowPayModal(false)}
            onPay={() => payOrder(activeOrder.id)}
          />
        )}
      </AnimatePresence>

      {/* ── Invite modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showInvite && activeTeam && (
          <InviteModal
            team={activeTeam}
            onClose={() => setShowInvite(false)}
            onInvite={(member) => inviteMember(activeTeam.id, member)}
          />
        )}
      </AnimatePresence>

      {/* ── Stage modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showStage && activeTeam && (
          <StageModal
            current={activeTeam.stage}
            onClose={() => setShowStage(false)}
            onSelect={(stage) => updateStage(activeTeam.id, stage)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
