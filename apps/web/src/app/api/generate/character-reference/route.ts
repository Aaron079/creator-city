import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { generateJimengImage } from '@/lib/providers/china/jimeng'
import { generateSeedreamImage } from '@/lib/providers/china/volcengine'
import { buildProviderManagementStatus } from '@/lib/provider-management'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CHARACTER_CONSTRAINT =
  '请以来源参考图中的同一角色为唯一角色，保持脸型、年龄、发型、服装、气质、关键道具一致。不要改变角色身份，不要卡通化，不要更换服装，不要改变性别和年龄。'

type GenerateItem = {
  kind: string
  label: string
  prompt: string
}

type RequestBody = {
  sourceImageUrl?: string
  characterId?: string
  template?: string
  items?: GenerateItem[]
  providerId?: string
  model?: string
}

const REFERENCE_SUPPORTED_PROVIDERS = new Set([
  'volcengine-seedream-image',
  'jimeng-image',
])

export async function POST(request: NextRequest) {
  try {
    let body: RequestBody
    try {
      body = await request.json() as RequestBody
    } catch {
      return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT', message: 'Invalid JSON' }, { status: 400 })
    }

    const { sourceImageUrl, characterId, items, providerId = 'volcengine-seedream-image', template } = body

    if (!sourceImageUrl?.trim()) {
      return NextResponse.json({ success: false, errorCode: 'SOURCE_IMAGE_REQUIRED', message: '请提供角色源图 URL。' }, { status: 400 })
    }
    if (!characterId?.trim()) {
      return NextResponse.json({ success: false, errorCode: 'CHARACTER_ID_REQUIRED', message: '请指定角色 ID。' }, { status: 400 })
    }
    if (!items?.length) {
      return NextResponse.json({ success: false, errorCode: 'ITEMS_REQUIRED', message: '请指定至少一个参考图生成项。' }, { status: 400 })
    }

    if (!REFERENCE_SUPPORTED_PROVIDERS.has(providerId)) {
      return NextResponse.json({
        success: false,
        errorCode: 'PROVIDER_REFERENCE_IMAGE_UNSUPPORTED',
        message: `Provider ${providerId} 不支持参考图生成。请使用 volcengine-seedream-image 或 jimeng-image。`,
        providerId,
      }, { status: 200 })
    }

    const status = await buildProviderManagementStatus()
    const providerRow = status.providers.find((p) => p.providerId === providerId)
    if (!providerRow?.available) {
      return NextResponse.json({
        success: false,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        message: `Provider ${providerId} 未配置或不可用，请在 /admin/providers 检查环境变量。`,
        providerId,
        missingEnv: providerRow?.missingEnv ?? [],
      }, { status: 200 })
    }

    await getCurrentUser()

    const references: Array<{
      id: string
      characterId: string
      kind: string
      label: string
      imageUrl: string
      sourceImageUrl: string
      providerId: string
      model?: string
      generationTemplate?: string
      createdAt: string
    }> = []

    const errors: Array<{
      kind: string
      label: string
      errorCode?: string
      message: string
    }> = []

    for (const item of items) {
      const fullPrompt = [item.prompt, CHARACTER_CONSTRAINT].join(' ')
      try {
        const result = providerId === 'volcengine-seedream-image'
          ? await generateSeedreamImage({ prompt: fullPrompt, aspectRatio: '1:1', referenceImages: [sourceImageUrl] })
          : await generateJimengImage({ prompt: fullPrompt, aspectRatio: '1:1', referenceImages: [sourceImageUrl] })

        if (result.success) {
          const imageUrl = result.imageUrl ?? result.dataUrl
          if (imageUrl) {
            references.push({
              id: crypto.randomUUID(),
              characterId,
              kind: item.kind,
              label: item.label,
              imageUrl,
              sourceImageUrl,
              providerId,
              model: result.model,
              generationTemplate: template,
              createdAt: new Date().toISOString(),
            })
          } else {
            errors.push({ kind: item.kind, label: item.label, errorCode: 'NO_IMAGE_URL', message: '生成成功但未返回图片 URL' })
          }
        } else {
          errors.push({
            kind: item.kind,
            label: item.label,
            errorCode: result.errorCode ?? 'GENERATION_FAILED',
            message: result.message ?? '生成失败',
          })
        }
      } catch (err) {
        errors.push({
          kind: item.kind,
          label: item.label,
          errorCode: 'GENERATION_FAILED',
          message: err instanceof Error ? err.message : '生成失败',
        })
      }
    }

    return NextResponse.json({
      success: references.length > 0,
      references,
      errors: errors.length > 0 ? errors : undefined,
      partialSuccess: references.length > 0 && errors.length > 0,
    })
  } catch (err) {
    console.error('[api/generate/character-reference]', err)
    return NextResponse.json({
      success: false,
      errorCode: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : '生成请求失败',
    }, { status: 500 })
  }
}
