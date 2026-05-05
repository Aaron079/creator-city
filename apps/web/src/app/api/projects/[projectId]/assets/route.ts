import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import {
  PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE,
  isProjectCanvasSchemaMissing,
  projectJsonError,
} from '@/lib/projects/api-errors'
import { serializeAsset, toAssetType } from '@/lib/projects/canvas-mappers'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { projectId: string }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  let body: {
    workflowId?: string
    nodeId?: string
    type?: string
    url?: string
    dataUrl?: string
    mimeType?: string
    title?: string
    providerId?: string
    generationJobId?: string
    metadataJson?: unknown
  }
  try {
    body = await request.json() as typeof body
  } catch {
    return projectJsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
  }

  try {
    const project = await db.project.findUnique({
      where: { id: params.projectId },
      select: { id: true, ownerId: true },
    })
    if (!project) return projectJsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project.ownerId !== user.id) return projectJsonError('FORBIDDEN', '无权访问该项目。', 403)

    const title = body.title?.trim() || `${body.type ?? 'asset'} asset`
    const asset = await db.asset.create({
      data: {
        ownerId: user.id,
        projectId: project.id,
        workflowId: body.workflowId ?? null,
        nodeId: body.nodeId ?? null,
        name: title,
        title,
        type: toAssetType(body.type),
        status: 'READY',
        url: body.url ?? body.dataUrl ?? '',
        dataUrl: body.dataUrl ?? null,
        mimeType: body.mimeType ?? (body.type === 'image' ? 'image/png' : 'text/plain'),
        sizeBytes: 0,
        tags: [],
        providerId: body.providerId ?? null,
        generationJobId: body.generationJobId ?? null,
        metadataJson: body.metadataJson ?? {},
        metadata: body.metadataJson ?? {},
      },
    })

    return NextResponse.json({ asset: serializeAsset(asset) }, { status: 201 })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    console.error('[assets] failed to save asset', error)
    return NextResponse.json({ message: '保存资产失败。' }, { status: 500 })
  }
}
