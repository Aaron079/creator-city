import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
  params: { projectId: string }
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 })
  }

  const { projectId } = params
  if (!projectId) {
    return NextResponse.json({ success: false, error: 'MISSING_PROJECT_ID' }, { status: 400 })
  }

  try {
    // Auth: only owner can access
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true,
        canvasWorkflows: {
          select: {
            id: true,
            _count: { select: { nodes: true } },
          },
        },
        _count: {
          select: {
            generatedAssets: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: 'NOT_FOUND', message: '项目不存在' }, { status: 404 })
    }
    if (project.ownerId !== user.id) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN', message: '无权访问该项目' }, { status: 403 })
    }

    // Stats: asset counts
    const [imageAssetCount, videoAssetCount] = await Promise.all([
      db.asset.count({ where: { projectId, ownerId: user.id, type: 'IMAGE' } }),
      db.asset.count({ where: { projectId, ownerId: user.id, type: 'VIDEO' } }),
    ])
    const assetCount = imageAssetCount + videoAssetCount

    // Stats: task counts
    const [runningTaskCount, succeededTaskCount, failedTaskCount] = await Promise.all([
      db.generationJob.count({ where: { projectId, userId: user.id, status: { in: ['QUEUED', 'PROCESSING'] } } }),
      db.generationJob.count({ where: { projectId, userId: user.id, status: 'SUCCEEDED' } }),
      db.generationJob.count({ where: { projectId, userId: user.id, status: 'FAILED' } }),
    ])
    const taskCount = runningTaskCount + succeededTaskCount + failedTaskCount

    const workflowCount = project.canvasWorkflows.length
    const nodeCount = project.canvasWorkflows.reduce((sum, wf) => sum + wf._count.nodes, 0)

    // Recent assets — safe fields only, no storageKey/bucket/error
    const recentAssets = await db.asset.findMany({
      where: { projectId, ownerId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        type: true,
        url: true,
        thumbnailUrl: true,
        providerId: true,
        prompt: true,
        generationJobId: true,
        createdAt: true,
      },
    })

    // Recent tasks — safe fields only, no input/error raw fields
    const recentJobs = await db.generationJob.findMany({
      where: { projectId, userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        nodeId: true,
        nodeType: true,
        providerId: true,
        status: true,
        prompt: true,
        output: true,
        errorMessage: true,
        completedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        title: project.title,
        type: project.type,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      stats: {
        workflowCount,
        nodeCount,
        assetCount,
        imageAssetCount,
        videoAssetCount,
        taskCount,
        runningTaskCount,
        succeededTaskCount,
        failedTaskCount,
      },
      recentAssets: recentAssets.map((a) => ({
        id: a.id,
        type: a.type,
        url: a.url || null,
        thumbnailUrl: a.thumbnailUrl || null,
        providerId: a.providerId || null,
        promptPreview: a.prompt ? a.prompt.slice(0, 80) : null,
        generationJobId: a.generationJobId || null,
        createdAt: a.createdAt.toISOString(),
      })),
      recentTasks: recentJobs.map((job) => {
        const out = safeRecord(job.output)
        return {
          id: job.id,
          nodeId: job.nodeId ?? null,
          type: job.nodeType,
          status: job.status.toLowerCase(),
          promptPreview: job.prompt ? job.prompt.slice(0, 80) : null,
          providerId: job.providerId,
          errorCode: str(out.errorCode) ?? null,
          errorStage: str(out.errorStage) ?? null,
          createdAt: job.createdAt.toISOString(),
          completedAt: job.completedAt?.toISOString() ?? null,
          durationMs: job.completedAt ? job.completedAt.getTime() - job.createdAt.getTime() : null,
        }
      }),
    })
  } catch {
    return NextResponse.json({ success: false, error: 'DB_ERROR', message: '数据库查询失败' }, { status: 500 })
  }
}
