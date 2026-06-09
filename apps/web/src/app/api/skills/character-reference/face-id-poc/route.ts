import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 90

const DEFAULT_PROMPT =
  'Full body front view, neutral standing pose, arms at sides, clean white background, same face and identity as the reference image, professional character design sheet reference'

// Validate source image URL: must be http/https, not an internal proxy or data URI
function validateSourceImageUrl(url: string): { ok: true } | { ok: false; reason: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, reason: 'Invalid URL format' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'URL must use http or https protocol' }
  }
  const path = parsed.pathname
  if (
    path.startsWith('/api/') ||
    path.startsWith('/api/media/proxy') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return { ok: false, reason: 'Internal proxy, blob, and data URLs are not allowed' }
  }
  const host = parsed.hostname
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local')
  ) {
    return { ok: false, reason: 'Localhost URLs are not allowed' }
  }
  return { ok: true }
}

// fal.ai InstantID call
async function callFalInstantId(
  falKey: string,
  faceImageUrl: string,
  prompt: string,
): Promise<{ imageUrl: string }> {
  const res = await fetch('https://fal.run/fal-ai/instantid', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify({
      face_image_url: faceImageUrl,
      prompt,
      negative_prompt: 'blurry, low quality, deformed, extra limbs, bad anatomy',
      guidance_scale: 5,
      ip_adapter_scale: 0.8,
      controlnet_conditioning_scale: 0.8,
      num_inference_steps: 30,
      enable_safety_checker: true,
    }),
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      detail = (body as { detail?: string; error?: string }).detail ?? (body as { error?: string }).error ?? detail
    } catch {
      // ignore parse error
    }
    throw Object.assign(new Error(`fal.ai InstantID failed: ${detail}`), { code: 'FAL_API_ERROR', detail })
  }

  const data = (await res.json()) as { images?: { url: string }[]; image?: { url: string } }
  const imageUrl =
    data.images?.[0]?.url ?? (data.image as { url?: string } | undefined)?.url
  if (!imageUrl) {
    throw Object.assign(new Error('fal.ai returned no image URL'), { code: 'FAL_NO_IMAGE' })
  }
  return { imageUrl }
}

// Replicate — face_to_sticker or instantid, with polling
async function callReplicateInstantId(
  replicateToken: string,
  faceImageUrl: string,
  prompt: string,
): Promise<{ imageUrl: string }> {
  // Using zsxkib/instant-id as the Replicate model
  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${replicateToken}`,
    },
    body: JSON.stringify({
      version: 'a86b8f0c26e5ed00a8e6f8b6a1c3d9cc70c0ea70cf3fb0c1c0e6bf0eae38e2e5',
      input: {
        image: faceImageUrl,
        prompt,
        negative_prompt: 'blurry, low quality, deformed',
        num_inference_steps: 30,
        guidance_scale: 5,
        ip_adapter_scale: 0.8,
      },
    }),
  })

  if (!createRes.ok) {
    let detail = `HTTP ${createRes.status}`
    try {
      const body = await createRes.json()
      detail = (body as { detail?: string; error?: string }).detail ?? (body as { error?: string }).error ?? detail
    } catch {
      // ignore
    }
    throw Object.assign(new Error(`Replicate prediction create failed: ${detail}`), {
      code: 'REPLICATE_API_ERROR',
      detail,
    })
  }

  const prediction = (await createRes.json()) as { id: string; urls: { get: string } }
  const pollUrl = prediction.urls?.get
  if (!pollUrl) {
    throw Object.assign(new Error('Replicate returned no poll URL'), { code: 'REPLICATE_NO_POLL_URL' })
  }

  // Poll up to 30 times (every 3s = 90s max)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${replicateToken}` },
    })
    if (!pollRes.ok) continue

    const status = (await pollRes.json()) as {
      status: string
      output?: string[]
      error?: string
    }

    if (status.status === 'succeeded') {
      const imageUrl = Array.isArray(status.output) ? status.output[0] : undefined
      if (!imageUrl) {
        throw Object.assign(new Error('Replicate succeeded but returned no output'), {
          code: 'REPLICATE_NO_OUTPUT',
        })
      }
      return { imageUrl }
    }

    if (status.status === 'failed' || status.status === 'canceled') {
      throw Object.assign(
        new Error(`Replicate prediction ${status.status}: ${status.error ?? 'unknown'}`),
        { code: 'REPLICATE_PREDICTION_FAILED', detail: status.error },
      )
    }
    // status === 'starting' | 'processing' — keep polling
  }

  throw Object.assign(new Error('Replicate polling timed out after 90s'), { code: 'FACE_ID_POC_TIMEOUT' })
}

export async function POST(req: NextRequest) {
  // 1. Feature gate
  if (process.env.CHARACTER_FACE_ID_POC_ENABLED !== 'true') {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'FACE_ID_POC_DISABLED',
        message: 'Face-ID POC is not enabled on this environment. Set CHARACTER_FACE_ID_POC_ENABLED=true.',
      },
      { status: 501 },
    )
  }

  // 2. Provider selection
  const providerEnv = (process.env.FACE_ID_PROVIDER ?? 'fal').toLowerCase()
  const falKey = process.env.FAL_KEY
  const replicateToken = process.env.REPLICATE_API_TOKEN

  const hasProvider =
    (providerEnv === 'fal' && !!falKey) ||
    (providerEnv === 'replicate' && !!replicateToken) ||
    (providerEnv === 'auto' && (!!falKey || !!replicateToken))

  if (!hasProvider) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'FACE_ID_PROVIDER_NOT_CONFIGURED',
        message:
          'No Face-ID provider API key is configured. Set FAL_KEY (fal.ai) or REPLICATE_API_TOKEN (Replicate) and CHARACTER_FACE_ID_POC_ENABLED=true.',
        requiredEnv: ['CHARACTER_FACE_ID_POC_ENABLED', 'FAL_KEY or REPLICATE_API_TOKEN'],
      },
      { status: 501 },
    )
  }

  // 3. Auth
  let currentUser: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    currentUser = await getCurrentUser()
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'AUTH_ERROR',
        message: '登录验证失败，请重新登录。',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 401 },
    )
  }

  if (!currentUser) {
    return NextResponse.json(
      { success: false, errorCode: 'UNAUTHENTICATED', message: '请先登录。' },
      { status: 401 },
    )
  }

  // 4. Parse body
  let body: { sourceImageUrl?: string; prompt?: string }
  try {
    body = (await req.json()) as { sourceImageUrl?: string; prompt?: string }
  } catch {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      { status: 400 },
    )
  }

  const { sourceImageUrl, prompt: userPrompt } = body

  if (!sourceImageUrl) {
    return NextResponse.json(
      { success: false, errorCode: 'MISSING_SOURCE_IMAGE', message: 'sourceImageUrl is required.' },
      { status: 400 },
    )
  }

  const urlCheck = validateSourceImageUrl(sourceImageUrl)
  if (!urlCheck.ok) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'INVALID_SOURCE_IMAGE_URL',
        message: `sourceImageUrl rejected: ${urlCheck.reason}`,
      },
      { status: 400 },
    )
  }

  const prompt = (userPrompt ?? '').trim() || DEFAULT_PROMPT

  // 5. Call provider
  try {
    let imageUrl: string
    let usedProvider: string

    // Determine which provider to actually use
    const useReplicate =
      providerEnv === 'replicate' ||
      (providerEnv === 'auto' && !falKey && !!replicateToken)

    if (useReplicate && replicateToken) {
      usedProvider = 'replicate'
      ;({ imageUrl } = await callReplicateInstantId(replicateToken, sourceImageUrl, prompt))
    } else if (falKey) {
      usedProvider = 'fal'
      ;({ imageUrl } = await callFalInstantId(falKey, sourceImageUrl, prompt))
    } else {
      // Should not reach here given hasProvider check above
      return NextResponse.json(
        { success: false, errorCode: 'FACE_ID_PROVIDER_NOT_CONFIGURED', message: 'No provider key available.' },
        { status: 501 },
      )
    }

    return NextResponse.json({
      success: true,
      provider: usedProvider,
      imageUrl,
      prompt,
      note: 'POC — no OSS upload, no canvas node, no credits consumed by this route',
    })
  } catch (err) {
    const code = (err as Error & { code?: string }).code ?? 'FACE_ID_POC_ERROR'
    const detail = (err as Error & { detail?: string }).detail ?? (err instanceof Error ? err.message : String(err))

    if (code === 'FACE_ID_POC_TIMEOUT') {
      return NextResponse.json(
        { success: false, errorCode: code, message: '生成超时，请稍候重试。', detail },
        { status: 504 },
      )
    }

    return NextResponse.json(
      { success: false, errorCode: code, message: '人物参考生成失败。', detail },
      { status: 500 },
    )
  }
}
