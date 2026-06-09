import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { generateJimengImage } from '@/lib/providers/china/jimeng'
import { generateSeedreamImage } from '@/lib/providers/china/volcengine'
import { buildProviderManagementStatus } from '@/lib/provider-management'
import { persistGeneratedMedia } from '@/lib/assets/persist-generated-media'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Route-level override: generate a neutral reference pose — do NOT copy the original scene.
// This is appended AFTER the slot prompt so it takes precedence over the source image style.
const CHARACTER_CONSTRAINT =
  'Use the provided reference image ONLY for character identity (face, age, hairstyle, body proportions, outfit color palette). ' +
  'Generate a brand-new character reference image with a CLEAN WHITE BACKGROUND and a NEUTRAL STANDING POSE. ' +
  'IMPORTANT: Do NOT recreate the original scene, background, action pose, combat stance, weapon pose, battlefield environment, smoke, fire, or any cinematic composition from the source image. ' +
  'The output must look like a professional character design sheet reference, NOT like a screenshot or movie still.'

function urlDomainExcerpt(url: string | undefined): string {
  if (!url) return '(none)'
  try {
    const u = new URL(url)
    return `${u.hostname}...${u.pathname.slice(-20)}`
  } catch {
    return url.slice(0, 60)
  }
}

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
  projectId?: string
  workflowId?: string
  nodeId?: string
  // When false: text-only generation — do NOT send sourceImageUrl as reference image.
  // Default true keeps backwards compatibility.
  useReferenceImage?: boolean
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

    const {
      sourceImageUrl,
      characterId,
      items,
      providerId = 'volcengine-seedream-image',
      template,
      useReferenceImage = true,
    } = body

    console.log('[char-ref] request received', {
      sourceImageUrlDomain: urlDomainExcerpt(sourceImageUrl),
      characterId,
      itemCount: items?.length ?? 0,
      providerId,
      useReferenceImage,
    })

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

    const currentUser = await getCurrentUser()
    // TODO: production billing required before public launch
    if (!currentUser) {
      return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录。' }, { status: 401 })
    }
    console.log('[char-ref] auth ok', { userId: currentUser.id })

    const mediaPersistenceEnabled = process.env.MEDIA_PERSISTENCE_ENABLED !== 'false'

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
      assetId?: string
      assetUrl?: string
      originalProviderImageUrl?: string
      mediaPersistence?: unknown
      warning?: string
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
      console.log('[char-ref] generating item', {
        kind: item.kind,
        label: item.label,
        promptExcerpt: item.prompt.slice(0, 120),
        referenceImages: [urlDomainExcerpt(sourceImageUrl)],
      })

      try {
        // Description mode: no reference image → pure text-to-image (avoids scene copying).
        // Reference mode: send sourceImageUrl as identity reference.
        const referenceImages = useReferenceImage && sourceImageUrl ? [sourceImageUrl] : []
        console.log('[char-ref] generation input', {
          kind: item.kind,
          useReferenceImage,
          referenceImageCount: referenceImages.length,
        })
        const result = providerId === 'volcengine-seedream-image'
          ? await generateSeedreamImage({ prompt: fullPrompt, aspectRatio: '1:1', referenceImages })
          : await generateJimengImage({ prompt: fullPrompt, aspectRatio: '1:1', referenceImages })

        console.log('[char-ref] generation result', {
          kind: item.kind,
          success: result.success,
          errorCode: result.success ? undefined : (result as { errorCode?: string }).errorCode,
          rawImageUrlExcerpt: result.success ? urlDomainExcerpt(result.imageUrl) : undefined,
        })

        if (result.success) {
          const imageUrl = result.imageUrl ?? result.dataUrl
          if (imageUrl) {
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
                projectId: body.projectId,
                workflowId: body.workflowId,
                nodeId: body.nodeId,
                filenameHint: `character-reference-${item.kind}.png`,
                sourceProvider: providerId,
                userId: currentUser?.id,
                metadata: {
                  source: 'character-reference',
                  characterId,
                  referenceKind: item.kind,
                  label: item.label,
                  model: result.model,
                  generationTemplate: template,
                },
              })
              console.log('[char-ref] persistence result', {
                kind: item.kind,
                ok: persistence.ok,
                stableUrlExcerpt: persistence.ok ? urlDomainExcerpt(persistence.stableUrl) : undefined,
                assetId: persistence.ok ? persistence.assetId : undefined,
                errorCode: persistence.ok ? undefined : persistence.errorCode,
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
                warning = '角色参考图生成成功，但媒体转存失败，该链接可能会过期。'
              }
            }

            console.log('[char-ref] reference ready', {
              kind: item.kind,
              finalImageUrlExcerpt: urlDomainExcerpt(finalImageUrl),
              hasAssetId: Boolean(assetId),
            })

            references.push({
              id: crypto.randomUUID(),
              characterId,
              kind: item.kind,
              label: item.label,
              imageUrl: finalImageUrl,
              sourceImageUrl,
              providerId,
              model: result.model,
              generationTemplate: template,
              assetId,
              assetUrl: assetId ? finalImageUrl : undefined,
              originalProviderImageUrl: imageUrl,
              mediaPersistence,
              warning,
              createdAt: new Date().toISOString(),
            })
          } else {
            console.warn('[char-ref] no imageUrl in successful result', { kind: item.kind })
            errors.push({ kind: item.kind, label: item.label, errorCode: 'NO_IMAGE_URL', message: '生成成功但未返回图片 URL' })
          }
        } else {
          const failResult = result as { errorCode?: string; message?: string }
          console.warn('[char-ref] generation failed', { kind: item.kind, errorCode: failResult.errorCode, message: failResult.message })
          errors.push({
            kind: item.kind,
            label: item.label,
            errorCode: failResult.errorCode ?? 'GENERATION_FAILED',
            message: failResult.message ?? '生成失败',
          })
        }
      } catch (err) {
        console.error('[char-ref] generation exception', { kind: item.kind, error: err instanceof Error ? err.message : String(err) })
        errors.push({
          kind: item.kind,
          label: item.label,
          errorCode: 'GENERATION_FAILED',
          message: err instanceof Error ? err.message : '生成失败',
        })
      }
    }

    console.log('[char-ref] done', { referencesCount: references.length, errorsCount: errors.length })

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
