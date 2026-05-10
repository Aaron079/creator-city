import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { serializeAsset, toAssetType } from '@/lib/projects/canvas-mappers'
import { uploadAsset } from '@/lib/assets/storage-adapter'

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

function getMetadataJson(args: {
  storageProvider: string
  bucket?: string | null
  key?: string | null
  originalName: string
}) {
  return {
    storageProvider: args.storageProvider,
    bucket: args.bucket,
    key: args.key,
    storageKey: args.key,
    originalName: args.originalName,
    source: 'assets-upload',
  } satisfies Prisma.InputJsonObject
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

  try {
    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      })
      if (!project) return jsonError('PROJECT_NOT_FOUND', '项目不存在', 404)
      if (project.ownerId !== user.id) return jsonError('FORBIDDEN', '无权上传到该项目', 403)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadAsset(buffer, {
      filename: `${assetId}-${safeFileName(file.name)}`,
      mimeType: contentType,
      projectId,
      userId: user.id,
      type: assetType,
    })
    const metadataJson = getMetadataJson({
      storageProvider: uploaded.storageProvider,
      bucket: uploaded.bucket,
      key: uploaded.storageKey,
      originalName: file.name,
    })
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
  } catch (error) {
    console.error('[assets/upload] failed', error)
    return jsonError('ASSET_UPLOAD_FAILED', error instanceof Error ? error.message : '上传素材失败', 500)
  }
}
