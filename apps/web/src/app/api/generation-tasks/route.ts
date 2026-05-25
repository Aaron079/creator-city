import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'

function safeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

const VALID_STATUSES = new Set(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'])
const VALID_TYPES = new Set(['image', 'video', 'text', 'audio', 'music'])

export async function GET(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ success: false, error: 'AUTH_REQUIRED', message: '请先登录' }, { status: 401 })
  }

  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId')?.trim() || undefined
  const providerId = url.searchParams.get('providerId')?.trim() || undefined
  const rawStatus = url.searchParams.get('status')?.trim().toUpperCase() || undefined
  const rawType = url.searchParams.get('type')?.trim().toLowerCase() || undefined
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 50

  const where: Prisma.GenerationJobWhereInput = { userId: currentUser.id }
  if (projectId) where.projectId = projectId
  if (providerId) where.providerId = providerId
  if (rawStatus && VALID_STATUSES.has(rawStatus)) {
    where.status = rawStatus as Prisma.EnumGenerationJobStatusFilter
  }
  if (rawType && VALID_TYPES.has(rawType)) {
    where.nodeType = rawType
  }

  let jobs
  try {
    jobs = await db.generationJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        nodeId: true,
        projectId: true,
        providerId: true,
        nodeType: true,
        status: true,
        prompt: true,
        output: true,
        errorMessage: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'DB_ERROR', message: '数据库查询失败，请稍后重试' }, { status: 500 })
  }

  const tasks = jobs.map((job) => {
    const out = safeRecord(job.output)
    const resultUrl =
      str(out.stableUrl) ??
      str(out.resultImageUrl) ??
      str(out.resultVideoUrl) ??
      null

    return {
      id: job.id,
      nodeId: job.nodeId ?? null,
      projectId: job.projectId ?? null,
      providerId: job.providerId,
      type: job.nodeType,
      status: job.status.toLowerCase(),
      promptPreview: job.prompt.slice(0, 80),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      durationMs: job.completedAt
        ? job.completedAt.getTime() - job.createdAt.getTime()
        : null,
      errorCode: str(out.errorCode) ?? null,
      errorStage: str(out.errorStage) ?? null,
      errorMessage: job.errorMessage ?? str(out.message) ?? null,
      stageTrace: Array.isArray(out.stageTrace) ? (out.stageTrace as string[]) : null,
      resultUrl,
      executorKind: str(out.executorKind) ?? null,
    }
  })

  return NextResponse.json({ success: true, tasks, total: tasks.length })
}
