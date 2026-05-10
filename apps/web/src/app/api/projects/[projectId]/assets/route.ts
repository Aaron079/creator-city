import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import {
  PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE,
  isProjectCanvasSchemaMissing,
  projectJsonError,
} from '@/lib/projects/api-errors'
import { serializeAsset, toAssetType } from '@/lib/projects/canvas-mappers'
import { getProjectAccess } from '@/lib/projects/ensure-active-project'
import { persistGeneratedMedia } from '@/lib/assets/persist-generated-media'

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
    const access = await getProjectAccess(user.id, project.id)
    if (!access.canWrite) return projectJsonError('FORBIDDEN', '无权访问该项目。', 403)

    const title = body.title?.trim() || `${body.type ?? 'asset'} asset`
    const mediaType = body.type === 'video' ? 'video' : body.type === 'image' ? 'image' : null
    const mediaUrl = body.url?.trim()
    if (mediaType && mediaUrl && /^https?:\/\//i.test(mediaUrl)) {
      const persisted = await persistGeneratedMedia({
        url: mediaUrl,
        type: mediaType,
        projectId: project.id,
        workflowId: body.workflowId,
        nodeId: body.nodeId,
        filenameHint: mediaType === 'image' ? `${title}.png` : `${title}.mp4`,
        sourceProvider: body.providerId,
        userId: user.id,
        metadata: {
          ...(body.metadataJson && typeof body.metadataJson === 'object' && !Array.isArray(body.metadataJson) ? body.metadataJson as Record<string, unknown> : {}),
          prompt: typeof (body.metadataJson as { prompt?: unknown } | undefined)?.prompt === 'string'
            ? (body.metadataJson as { prompt: string }).prompt
            : undefined,
          generationJobId: body.generationJobId,
          providerJobId: body.generationJobId,
        },
      })

      if (persisted.ok) {
        return NextResponse.json({
          asset: {
            id: persisted.assetId,
            type: toAssetType(body.type),
            title,
            url: persisted.stableUrl,
            dataUrl: null,
            thumbnailUrl: mediaType === 'image' ? persisted.stableUrl : null,
            providerId: 'generated-media-persistence',
            generationJobId: body.generationJobId ?? null,
            projectId: project.id,
            workflowId: body.workflowId ?? null,
            nodeId: body.nodeId ?? null,
            storageProvider: persisted.storageProvider,
            bucket: persisted.bucket,
            storageKey: persisted.storageKey,
            mediaPersistence: persisted,
          },
        }, { status: 201 })
      }

      return NextResponse.json({
        message: persisted.message,
        errorCode: persisted.errorCode,
      }, { status: 502 })
    }

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
