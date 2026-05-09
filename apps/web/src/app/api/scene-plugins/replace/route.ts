import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { persistGeneratedMedia } from '@/lib/assets/persist-generated-media'

type ScenePluginRegion = {
  x: number
  y: number
  width: number
  height: number
}

type ScenePluginRequest = {
  sourceImageUrl?: unknown
  region?: unknown
  targetDescription?: unknown
  preserveInstruction?: unknown
  negativeInstruction?: unknown
  styleInheritance?: unknown
  projectId?: unknown
  sourceNodeId?: unknown
}

function jsonError(errorCode: string, message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, errorCode, message, ...extra }, { status })
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeRegion(input: unknown): ScenePluginRegion | null {
  const region = recordValue(input)
  const x = Number(region.x)
  const y = Number(region.y)
  const width = Number(region.width)
  const height = Number(region.height)
  if (![x, y, width, height].every(Number.isFinite)) return null
  if (width <= 0 || height <= 0) return null
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    width: Math.min(1, Math.max(0, width)),
    height: Math.min(1, Math.max(0, height)),
  }
}

function findImageUrl(input: unknown): string {
  const json = recordValue(input)
  const data = recordValue(json.data)
  const output = recordValue(json.output)
  const images = Array.isArray(json.images) ? json.images : []
  const firstImage = recordValue(images[0])
  return stringValue(json.imageUrl)
    || stringValue(json.resultImageUrl)
    || stringValue(data.imageUrl)
    || stringValue(output.imageUrl)
    || stringValue(firstImage.url)
}

function upstreamMessage(input: unknown) {
  const json = recordValue(input)
  return stringValue(json.message)
    || stringValue(json.error)
    || stringValue(json.errorMessage)
    || stringValue(recordValue(json.data).message)
}

export async function POST(request: Request) {
  const endpoint = stringValue(process.env.SCENE_PLUGIN_ENDPOINT)
  if (!endpoint) {
    return jsonError(
      'SCENE_PLUGIN_NOT_CONFIGURED',
      '场景替换插件未配置，请配置 SCENE_PLUGIN_ENDPOINT。',
      200,
    )
  }

  let body: ScenePluginRequest
  try {
    body = await request.json() as ScenePluginRequest
  } catch {
    return jsonError('SCENE_PLUGIN_INVALID_REQUEST', '请求体不是合法 JSON。')
  }

  const sourceImageUrl = stringValue(body.sourceImageUrl)
  const targetDescription = stringValue(body.targetDescription)
  const region = normalizeRegion(body.region)
  if (!sourceImageUrl) return jsonError('SCENE_PLUGIN_SOURCE_IMAGE_REQUIRED', '缺少 sourceImageUrl。')
  if (!region) return jsonError('SCENE_PLUGIN_REGION_REQUIRED', '缺少有效的 region。')
  if (!targetDescription) return jsonError('SCENE_PLUGIN_TARGET_REQUIRED', '缺少 targetDescription。')

  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  const apiKey = stringValue(process.env.SCENE_PLUGIN_API_KEY)
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  let upstreamJson: unknown
  let upstreamStatus = 0
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sourceImageUrl,
        region,
        prompt: targetDescription,
        preserveInstruction: stringValue(body.preserveInstruction),
        negativeInstruction: stringValue(body.negativeInstruction),
        styleInheritance: stringValue(body.styleInheritance) || 'high',
        workflowId: stringValue(process.env.SCENE_REPLACE_WORKFLOW_ID),
      }),
    })
    upstreamStatus = response.status
    const text = await response.text()
    upstreamJson = text ? JSON.parse(text) : {}
    if (!response.ok) {
      return jsonError(
        'SCENE_PLUGIN_UPSTREAM_FAILED',
        '场景插件调用失败。',
        502,
        { upstreamStatus, upstreamMessage: upstreamMessage(upstreamJson) || response.statusText },
      )
    }
  } catch (error) {
    return jsonError(
      'SCENE_PLUGIN_UPSTREAM_FAILED',
      '场景插件调用失败。',
      502,
      { upstreamMessage: error instanceof Error ? error.message : String(error) },
    )
  }

  const imageUrl = findImageUrl(upstreamJson)
  if (!imageUrl) {
    return jsonError(
      'SCENE_PLUGIN_RESPONSE_UNRECOGNIZED',
      '场景插件返回结构无法识别。',
      502,
      { upstreamMessage: upstreamMessage(upstreamJson), upstreamStatus },
    )
  }

  const currentUser = await getCurrentUser()
  const mediaPersistenceEnabled = process.env.MEDIA_PERSISTENCE_ENABLED !== 'false'
  let finalImageUrl = imageUrl
  let assetId: string | undefined
  let mediaPersistence: unknown = imageUrl.startsWith('data:')
    ? { status: 'skipped' }
    : mediaPersistenceEnabled
      ? { status: 'pending' }
      : { status: 'disabled' }
  let warning: string | undefined

  if (mediaPersistenceEnabled && !imageUrl.startsWith('data:')) {
    const persistence = await persistGeneratedMedia({
      url: imageUrl,
      type: 'image',
      projectId: stringValue(body.projectId),
      nodeId: stringValue(body.sourceNodeId),
      filenameHint: 'scene-plugin-result.png',
      sourceProvider: stringValue(process.env.SCENE_PLUGIN_PROVIDER) || 'custom-scene-plugin',
      userId: currentUser?.id,
      metadata: {
        source: 'scene-plugin-replace',
        sourceNodeId: stringValue(body.sourceNodeId),
        region,
        targetDescription,
      },
    })
    if (persistence.ok) {
      finalImageUrl = persistence.stableUrl
      assetId = persistence.assetId
      mediaPersistence = { status: 'persisted', ...persistence }
    } else {
      mediaPersistence = {
        status: 'failed',
        errorCode: persistence.errorCode,
        message: persistence.message,
      }
      warning = '场景插件已返回新图，但媒体转存失败，该链接可能会过期。'
    }
  }

  return NextResponse.json({
    success: true,
    imageUrl: finalImageUrl,
    assetUrl: assetId ? finalImageUrl : undefined,
    assetId,
    originalProviderImageUrl: imageUrl,
    mediaPersistence,
    warning,
    pluginProvider: stringValue(process.env.SCENE_PLUGIN_PROVIDER) || 'custom',
    workflowId: stringValue(process.env.SCENE_REPLACE_WORKFLOW_ID),
    result: {
      upstream: upstreamJson,
      imageUrl: finalImageUrl,
      assetUrl: assetId ? finalImageUrl : undefined,
      assetId,
      originalProviderImageUrl: imageUrl,
      mediaPersistence,
      warning,
    },
  })
}
