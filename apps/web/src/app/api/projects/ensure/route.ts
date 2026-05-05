import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { isProjectCanvasSchemaMissing, projectJsonError } from '@/lib/projects/api-errors'
import { ensureActiveProject } from '@/lib/projects/ensure-active-project'
import { mapCanvasEdge, mapCanvasNode } from '@/lib/projects/canvas-mappers'

export const dynamic = 'force-dynamic'

async function handleEnsure(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: '请先登录',
    }, { status: 401 })
  }

  try {
    const result = await ensureActiveProject(user)
    const includeCanvas = request.nextUrl.searchParams.get('includeCanvas') === '1'
    if (includeCanvas) {
      const [nodes, edges] = await Promise.all([
        db.canvasNode.findMany({
          where: { workflowId: result.workflow.id },
          orderBy: [{ createdAt: 'asc' }, { nodeId: 'asc' }],
          select: {
            id: true,
            nodeId: true,
            kind: true,
            title: true,
            providerId: true,
            status: true,
            x: true,
            y: true,
            width: true,
            height: true,
            prompt: true,
            resultText: true,
            resultImageUrl: true,
            resultVideoUrl: true,
            resultAudioUrl: true,
            resultPreview: true,
            errorMessage: true,
            paramsJson: true,
            metadataJson: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        db.canvasEdge.findMany({
          where: { workflowId: result.workflow.id },
          orderBy: [{ createdAt: 'asc' }, { edgeId: 'asc' }],
          select: {
            id: true,
            edgeId: true,
            sourceNodeId: true,
            targetNodeId: true,
            type: true,
            metadataJson: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ])

      return NextResponse.json({
        success: true,
        project: result.project,
        workflow: result.workflow,
        nodes: nodes.map(mapCanvasNode),
        edges: edges.map(mapCanvasEdge),
        viewport: result.workflow.viewportJson,
        serverUpdatedAt: result.workflow.updatedAt,
        ...(result.membershipWarning ? { membershipWarning: result.membershipWarning } : {}),
      })
    }

    return NextResponse.json({
      success: true,
      project: result.project,
      workflow: result.workflow,
      ...(result.membershipWarning ? { membershipWarning: result.membershipWarning } : {}),
    })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return NextResponse.json({
        success: false,
        errorCode: 'DB_SCHEMA_MISSING',
        message: '项目数据库表未同步',
      }, { status: 503 })
    }
    console.error('[projects/ensure] failed to ensure active project', error)
    return projectJsonError('PROJECT_ACCESS_FAILED', '打开项目失败。', 500)
  }
}

export async function GET(request: NextRequest) {
  return handleEnsure(request)
}

export async function POST(request: NextRequest) {
  return handleEnsure(request)
}
