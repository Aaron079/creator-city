import type { IncomingMessage, ServerResponse } from 'http'
import { isAuthorized } from '../auth'
import { generateSeedreamImage } from '../volcengine'
import { uploadToOss } from '../oss'
import { jsonError, jsonOk, jsonUnauthorized } from '../response'

function readBody(req: IncomingMessage): Promise<string> {
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

export async function handleGenerateImage(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    jsonUnauthorized(res)
    return
  }

  let body: Record<string, unknown> = {}
  try {
    const raw = await readBody(req)
    if (raw.trim()) body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    jsonError(res, { errorCode: 'invalid_request', message: 'Request body must be valid JSON.' })
    return
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    jsonError(res, { errorCode: 'provider_invalid_parameter', message: 'prompt is required.' })
    return
  }

  // model and providerId are UI identifiers — passed for logging only, never used as Volcengine API model
  const model = typeof body.model === 'string' ? body.model.trim() || undefined : undefined
  const providerId = typeof body.provider === 'string' ? body.provider.trim() || undefined : undefined
  const aspectRatio = typeof body.aspectRatio === 'string' ? body.aspectRatio.trim() || undefined : undefined
  const resolution = typeof body.resolution === 'string' ? body.resolution.trim() || undefined : undefined
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() || undefined : undefined
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId.trim() || undefined : undefined

  // 1. Generate via Volcengine Seedream
  const genResult = await generateSeedreamImage({ prompt, model, providerId, aspectRatio, resolution })
  if (!genResult.success) {
    jsonError(res, {
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
    })
    return
  }

  // 2. Obtain image buffer — URL download or base64 decode
  let imageBuffer: Buffer | null = null
  let contentType = 'image/png'
  const providerOriginalUrl = genResult.providerOriginalUrl

  if (genResult.isBase64 && genResult.dataUrl) {
    const parsed = parseDataUrl(genResult.dataUrl)
    if (parsed) {
      imageBuffer = parsed.buffer
      contentType = parsed.contentType
    }
  } else {
    imageBuffer = await downloadBuffer(genResult.imageUrl)
  }

  if (!imageBuffer || imageBuffer.byteLength === 0) {
    jsonError(res, {
      errorCode: 'provider_media_download_failed',
      message: 'Failed to download generated image from provider.',
      providerOriginalUrl: providerOriginalUrl ?? null,
    })
    return
  }

  // 3. Upload to Aliyun OSS
  const ossKey = buildOssKey(projectId, nodeId)
  const uploadResult = await uploadToOss(ossKey, imageBuffer, contentType)
  if (!uploadResult.success) {
    jsonError(res, {
      errorCode: uploadResult.errorCode,
      message: uploadResult.message,
      providerOriginalUrl: providerOriginalUrl ?? null,
    })
    return
  }

  // 4. Return structured success response
  jsonOk(res, {
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
  })
}
