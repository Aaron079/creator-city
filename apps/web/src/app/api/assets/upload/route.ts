import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { serializeAsset, toAssetType } from '@/lib/projects/canvas-mappers'
import { uploadAsset } from '@/lib/assets/storage-adapter'
import {
  buildUploadAssetMetadata,
  parseStoryboardGridSplitLineage,
} from './storyboard-grid-split-metadata'
import { verifyUploadProjectAccess } from './project-validation'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

function jsonError(errorCode: string, message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json({ success: false, errorCode, message, ...details }, { status })
}

function safeFileName(name: string) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned.slice(0, 120) || 'asset'
}

function inferAssetType(input: string | null, contentType: string) {
  if (input === 'image' || input === 'video' || input === 'audio' || input === 'text' || input === 'file') return input
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('video/')) return 'video'
  if (contentType.startsWith('audio/')) return 'audio'
  if (contentType.startsWith('text/')) return 'text'
  return 'file'
}

function safePrismaError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error || fallback)
  // Never expose raw Prisma internals to the client
  if (message.includes('prisma.') || message.includes('Prisma') || message.includes('PrismaClient')) {
    return fallback
  }
  return message || fallback
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '请先登录', 401)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError('INVALID_FORM_DATA', '请使用 multipart/form-data 上传文件', 400)
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return jsonError('FILE_REQUIRED', '请选择要上传的文件', 400)
  if (file.size > MAX_FILE_SIZE_BYTES) return jsonError('FILE_TOO_LARGE', '文件不能超过 20MB', 413)

  const projectId = String(formData.get('projectId') ?? '').trim() || null
  const workflowId = String(formData.get('workflowId') ?? '').trim() || null
  const nodeId = String(formData.get('nodeId') ?? '').trim() || null
  const requestedType = String(formData.get('type') ?? '').trim() || null
  const contentType = file.type || 'application/octet-stream'
  const assetType = inferAssetType(requestedType, contentType)
  const title = String(formData.get('title') ?? '').trim() || file.name || 'Uploaded asset'
  const assetId = crypto.randomUUID()
  const lineageResult = parseStoryboardGridSplitLineage(formData)
  if (!lineageResult.ok) {
    return jsonError(lineageResult.errorCode, lineageResult.message, 400)
  }

  // Step 1: verify project ownership. Storyboard grid crops must be bound to a
  // saved project so crop assets stay recoverable from /assets after reload.
  const projectAccess = await verifyUploadProjectAccess({
    projectId,
    userId: user.id,
    required: Boolean(lineageResult.lineage),
    lookupProjectOwnerId: async (id) => db.project.findUnique({
      where: { id },
      select: { ownerId: true },
    }),
  })
  if (!projectAccess.ok) {
    if (projectAccess.cause) {
      console.error('[assets/upload] project check failed', {
        projectIdPrefix: projectId?.slice(0, 8) ?? null,
        attempts: projectAccess.attempts,
        errorCode: projectAccess.errorCode,
        err: projectAccess.cause,
      })
    }
    return jsonError(projectAccess.errorCode, projectAccess.message, projectAccess.status)
  }

  // Step 2: upload file to storage
  let uploaded: Awaited<ReturnType<typeof uploadAsset>>
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    uploaded = await uploadAsset(buffer, {
      filename: `${assetId}-${safeFileName(file.name)}`,
      mimeType: contentType,
      projectId,
      userId: user.id,
      type: assetType,
    })
  } catch (err) {
    console.error('[assets/upload] storage upload failed', { assetId, err })
    const msg = err instanceof Error ? err.message : '文件上传失败'
    const isTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('abort')
    return jsonError('STORAGE_UPLOAD_FAILED', isTimeout ? '上传超时，请重试' : '文件存储失败，请重试', 500)
  }

  // Step 3: create Asset record in DB
  try {
    const metadataJson = buildUploadAssetMetadata({
      storageProvider: uploaded.storageProvider,
      bucket: uploaded.bucket,
      key: uploaded.storageKey,
      originalName: file.name,
      lineage: lineageResult.lineage,
    }) as Prisma.InputJsonObject
    const asset = await db.asset.create({
      data: {
        id: assetId,
        name: file.name || title,
        title,
        type: toAssetType(assetType),
        status: 'READY',
        ownerId: user.id,
        projectId,
        workflowId,
        nodeId,
        source: 'uploaded',
        storageProvider: uploaded.storageProvider,
        bucket: uploaded.bucket ?? null,
        storageKey: uploaded.storageKey ?? null,
        url: uploaded.url,
        dataUrl: null,
        thumbnailUrl: assetType === 'image' ? uploaded.url : null,
        originalUrl: null,
        filename: file.name || null,
        mimeType: contentType,
        size: BigInt(uploaded.size),
        sizeBytes: BigInt(uploaded.size),
        metadata: metadataJson,
        metadataJson,
        providerId: uploaded.storageProvider,
        tags: ['upload', assetType],
      },
    })
    return NextResponse.json({ success: true, asset: serializeAsset(asset) }, { status: 201 })
  } catch (err) {
    console.error('[assets/upload] asset DB create failed', { assetId, url: uploaded.url, err })
    return jsonError('ASSET_RECORD_FAILED', safePrismaError(err, '素材记录创建失败，请重试'), 500)
  }
}
