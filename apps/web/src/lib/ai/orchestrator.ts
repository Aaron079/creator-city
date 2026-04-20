// This module is only ever called from 'use client' components.
// All store .getState() calls execute client-side only.

import { generateTasksFromIdea } from './director'
import { generateCrew } from './crew'
import { generatePrice } from './pricing'
import type { DirectorTask } from './director'
import type { CrewMember } from './crew'
import type { PricingResult } from './pricing'
import { CREATORS } from '@/lib/data/creators'
import { useRelationshipStore } from '@/store/relationship.store'
import { useJobsStore } from '@/store/jobs.store'
import { useOrderStore } from '@/store/order.store'
import { useTeamStore } from '@/store/team.store'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineResult {
  tasks:   DirectorTask[]
  crew:    CrewMember[]
  price:   PricingResult
  orderId: string
  jobId:   string
}

// ─── Step definitions (exported for UI) ──────────────────────────────────────

export const PIPELINE_STEPS = [
  { phase: '生成任务', icon: '⚡', label: '生成项目任务' },
  { phase: '匹配团队', icon: '👥', label: 'AI 匹配团队'  },
  { phase: '计算报价', icon: '💰', label: '计算报价预估' },
  { phase: '创建项目', icon: '📋', label: '创建项目订单' },
] as const

export type PipelinePhase = typeof PIPELINE_STEPS[number]['phase'] | ''

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 8) }
function delay(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)) }

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Orchestrates the full project-generation pipeline:
 *   idea → tasks → crew → price → job + order + team
 *
 * `onStep` is called before each phase to drive loading UI.
 * All logic is mock — no real API calls.
 */
export async function runProjectPipeline(
  idea:   string,
  onStep: (phase: PipelinePhase) => void,
): Promise<PipelineResult> {
  const trimmed = idea.trim() || '创意短片'

  // ── 1. Tasks ────────────────────────────────────────────────────────────────
  onStep('生成任务')
  await delay(420)
  const tasks = generateTasksFromIdea(trimmed)

  // ── 2. Crew ─────────────────────────────────────────────────────────────────
  onStep('匹配团队')
  await delay(520)
  const collaborated = useRelationshipStore.getState().relationships
    .filter((r) => r.userId === 'user-me')
    .map((r) => r.creatorId)
  const crew = generateCrew({ idea: trimmed, tasks, users: CREATORS, collaborated })

  // ── 3. Price ─────────────────────────────────────────────────────────────────
  onStep('计算报价')
  await delay(380)
  const price = generatePrice({ tasks, duration: 3, quality: 'standard' })

  // ── 4. Order + Team ──────────────────────────────────────────────────────────
  onStep('创建项目')
  await delay(360)

  const job = useJobsStore.getState().publishJob({
    title:       trimmed.slice(0, 30),
    description: trimmed,
    budgetRange: `¥${price.totalPrice.toLocaleString()}`,
    publisherId: 'user-me',
  })
  // Auto-accept with the primary crew member so the chat page is usable immediately
  useJobsStore.getState().acceptJob(job.id, crew[0]?.userId ?? 'ai-crew')

  const order = useOrderStore.getState().createOrder(
    job.id,
    `quote-orch-${uid()}`,
    price.totalPrice,
  )

  const team    = useTeamStore.getState().createTeam(order.id, 'user-me', '我 (发布方)')
  const perSplit = Math.floor(70 / Math.max(crew.length, 1))
  crew.forEach((m) => {
    useTeamStore.getState().inviteMember(team.id, {
      userId: m.userId,
      name:   m.name,
      role:   m.role,
      split:  perSplit,
    })
  })

  return { tasks, crew, price, orderId: order.id, jobId: job.id }
}
