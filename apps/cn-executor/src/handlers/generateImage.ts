import type { IncomingMessage, ServerResponse } from 'http'
import { isAuthorized } from '../auth'
import { generateSeedreamImage } from '../volcengine'
import { uploadToOss } from '../oss'
import { jsonError, jsonOk, jsonUnauthorized } from '../response'

export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function randomHex(n: number): string {
  return [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
}

function buildOssKey(projectId?: string | null, nodeId?: string | null): string {
  const prefix = projectId ? `projects/${projectId}` : 'uploads'
  const sub = nodeId ? `nodes/${nodeId}` : 'images'
  return `${prefix}/${sub}/${Date.now()}-${randomHex(8)}.png`
}

async function downloadBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i)
  if (!match) return null
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') }
}

export type ImageExecutionInput = {
  prompt: string
  model?: string
  providerId?: string
  aspectRatio?: string
  resolution?: string
  projectId?: string
  nodeId?: string
}

export type ImageExecutionResult = {
  success: boolean
  errorCode?: string
  message?: string
  provider?: string
  model?: string
  resultImageUrl?: string
  stableUrl?: string
  asset?: Record<string, unknown>
  upstreamStatus?: number
  upstreamMessage?: string
  providerEndpoint?: string
  providerHttpStatus?: number
  requestId?: string
  submittedInput?: Record<string, unknown>
  providerResponse?: unknown
  providerOriginalUrl?: string | null
}

export function parseImageExecutionInput(body: Record<string, unknown>): ImageExecutionInput | { errorCode: string; message: string } {
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    return { errorCode: 'provider_invalid_parameter', message: 'prompt is required.' }
  }

  // model and providerId are UI identifiers — passed for logging only, never used as Volcengine API model
  const model = typeof body.model === 'string' ? body.model.trim() || undefined : undefined
  const providerId = typeof body.provider === 'string' ? body.provider.trim() || undefined : undefined
  const aspectRatio = typeof body.aspectRatio === 'string' ? body.aspectRatio.trim() || undefined : undefined
  const resolution = typeof body.resolution === 'string' ? body.resolution.trim() || undefined : undefined
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() || undefined : undefined
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId.trim() || undefined : undefined
  return { prompt, model, providerId, aspectRatio, resolution, projectId, nodeId }
}

export async function executeImageGeneration(input: ImageExecutionInput): Promise<ImageExecutionResult> {
  const logCtx = { providerId: input.providerId, aspectRatio: input.aspectRatio }

  // 1. Generate via Volcengine Seedream
  console.log('[cn-executor][executeImage] step 1/3: calling Seedream', logCtx)
  const t0 = Date.now()
  const genResult = await generateSeedreamImage(input)
  const seedreamMs = Date.now() - t0
  if (!genResult.success) {
    console.error('[cn-executor][executeImage] step 1/3 FAILED: Seedream error', {
      ...logCtx,
      seedreamMs,
      errorCode: genResult.errorCode,
      message: genResult.message?.slice(0, 300),
      upstreamStatus: genResult.upstreamStatus,
    })
    return {
      success: false,
      errorCode: genResult.errorCode,
      message: genResult.message,
      provider: 'volcengine_seedream',
      ...(genResult.upstreamStatus !== undefined ? { upstreamStatus: genResult.upstreamStatus } : {}),
      ...(genResult.upstreamMessage !== undefined ? { upstreamMessage: genResult.upstreamMessage } : {}),
      ...(genResult.providerEndpoint !== undefined ? { providerEndpoint: genResult.providerEndpoint } : {}),
      ...(genResult.providerHttpStatus !== undefined ? { providerHttpStatus: genResult.providerHttpStatus } : {}),
      ...(genResult.requestId !== undefined ? { requestId: genResult.requestId } : {}),
      ...(genResult.submittedInput !== undefined ? { submittedInput: genResult.submittedInput } : {}),
      ...(genResult.providerResponse !== undefined ? { providerResponse: genResult.providerResponse } : {}),
    }
  }
  console.log('[cn-executor][executeImage] step 1/3 OK: Seedream success', {
    ...logCtx,
    seedreamMs,
    model: genResult.model,
    isBase64: genResult.isBase64,
    hasUrl: Boolean(genResult.imageUrl),
  })

  // 2. Obtain image buffer — URL download or base64 decode
  let imageBuffer: Buffer | null = null
  let contentType = 'image/png'
  const providerOriginalUrl = genResult.providerOriginalUrl

  if (genResult.isBase64 && genResult.dataUrl) {
    console.log('[cn-executor][executeImage] step 2/3: decoding base64 image', logCtx)
    const parsed = parseDataUrl(genResult.dataUrl)
    if (parsed) {
      imageBuffer = parsed.buffer
      contentType = parsed.contentType
    }
    console.log('[cn-executor][executeImage] step 2/3 base64', { ...logCtx, ok: Boolean(imageBuffer), bytes: imageBuffer?.byteLength })
  } else {
    console.log('[cn-executor][executeImage] step 2/3: downloading image from provider URL', { ...logCtx, urlLen: genResult.imageUrl?.length })
    const t1 = Date.now()
    imageBuffer = await downloadBuffer(genResult.imageUrl)
    console.log('[cn-executor][executeImage] step 2/3 download', { ...logCtx, ok: Boolean(imageBuffer), bytes: imageBuffer?.byteLength, durationMs: Date.now() - t1 })
  }

  if (!imageBuffer || imageBuffer.byteLength === 0) {
    console.error('[cn-executor][executeImage] step 2/3 FAILED: image buffer empty or download failed', logCtx)
    return {
      success: false,
      errorCode: 'provider_media_download_failed',
      message: 'Failed to download generated image from provider.',
      providerOriginalUrl: providerOriginalUrl ?? null,
      submittedInput: genResult.submittedInput,
    }
  }

  // 3. Upload to Aliyun OSS
  const ossKey = buildOssKey(input.projectId, input.nodeId)
  console.log('[cn-executor][executeImage] step 3/3: uploading to OSS', { ...logCtx, ossKey, bytes: imageBuffer.byteLength })
  const t2 = Date.now()
  const uploadResult = await uploadToOss(ossKey, imageBuffer, contentType)
  const ossMs = Date.now() - t2
  if (!uploadResult.success) {
    console.error('[cn-executor][executeImage] step 3/3 FAILED: OSS upload error', {
      ...logCtx,
      ossMs,
      errorCode: uploadResult.errorCode,
      message: uploadResult.message?.slice(0, 300),
    })
    return {
      success: false,
      errorCode: uploadResult.errorCode,
      message: uploadResult.message,
      providerOriginalUrl: providerOriginalUrl ?? null,
      submittedInput: genResult.submittedInput,
    }
  }
  console.log('[cn-executor][executeImage] step 3/3 OK: OSS upload success', {
    ...logCtx,
    ossMs,
    ossKey: uploadResult.storageKey,
    url: uploadResult.url.slice(0, 80),
  })

  return {
    success: true,
    provider: 'volcengine_seedream',
    model: genResult.model,
    resultImageUrl: uploadResult.url,
    stableUrl: uploadResult.url,
    asset: {
      storageKey: uploadResult.storageKey,
      resolvedUrl: uploadResult.url,
      providerOriginalUrl: providerOriginalUrl ?? null,
    },
    providerOriginalUrl: providerOriginalUrl ?? null,
    submittedInput: genResult.submittedInput,
  }
}

export async function parseImageExecutionRequest(req: IncomingMessage): Promise<ImageExecutionInput | { errorCode: string; message: string }> {
  let body: Record<string, unknown> = {}
  try {
    const raw = await readBody(req)
    if (raw.trim()) body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { errorCode: 'invalid_request', message: 'Request body must be valid JSON.' }
  }

  return parseImageExecutionInput(body)
}

function isImageExecutionError(input: ImageExecutionInput | { errorCode: string; message: string }): input is { errorCode: string; message: string } {
  return 'errorCode' in input
}

export async function handleGenerateImage(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    jsonUnauthorized(res)
    return
  }

  const input = await parseImageExecutionRequest(req)
  if (isImageExecutionError(input)) {
    jsonError(res, input)
    return
  }

  const result = await executeImageGeneration(input)
  if (result.success) {
    jsonOk(res, result)
    return
  }

  jsonError(res, {
    errorCode: result.errorCode ?? 'image_generation_failed',
    message: result.message ?? 'Image generation failed.',
    provider: result.provider ?? 'volcengine_seedream',
    ...(result.upstreamStatus !== undefined ? { upstreamStatus: result.upstreamStatus } : {}),
    ...(result.upstreamMessage !== undefined ? { upstreamMessage: result.upstreamMessage } : {}),
    ...(result.providerEndpoint !== undefined ? { providerEndpoint: result.providerEndpoint } : {}),
    ...(result.providerHttpStatus !== undefined ? { providerHttpStatus: result.providerHttpStatus } : {}),
    ...(result.requestId !== undefined ? { requestId: result.requestId } : {}),
    ...(result.submittedInput !== undefined ? { submittedInput: result.submittedInput } : {}),
    ...(result.providerResponse !== undefined ? { providerResponse: result.providerResponse } : {}),
    ...(result.providerOriginalUrl !== undefined ? { providerOriginalUrl: result.providerOriginalUrl } : {}),
  })
}
