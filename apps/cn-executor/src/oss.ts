import OSS from 'ali-oss'

function envValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ''
}

function numericEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function buildPublicUrl(key: string): string | undefined {
  const baseUrl = process.env.ALIYUN_OSS_PUBLIC_BASE_URL?.trim()
  if (!baseUrl) return undefined
  return `${baseUrl.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`
}

function getClient(): OSS {
  return new OSS({
    accessKeyId: envValue('ALIYUN_OSS_ACCESS_KEY_ID', 'ALIYUN_ACCESS_KEY_ID'),
    accessKeySecret: envValue('ALIYUN_OSS_ACCESS_KEY_SECRET', 'ALIYUN_ACCESS_KEY_SECRET'),
    bucket: process.env.ALIYUN_OSS_BUCKET!,
    region: process.env.ALIYUN_OSS_REGION!,
    endpoint: process.env.ALIYUN_OSS_ENDPOINT,
    timeout: numericEnv('ALIYUN_OSS_TIMEOUT_MS', 30_000),
  })
}

function isRetryableError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase()
  return /econnreset|eai_again|socket hang up/.test(msg)
}

export async function writeTaskStateJson(taskId: string, state: Record<string, unknown>): Promise<void> {
  try {
    const client = getClient()
    const key = `cn-executor-tasks/${taskId}.json`
    const buffer = Buffer.from(JSON.stringify(state), 'utf8')
    await client.put(key, buffer, {
      timeout: 8_000,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    // best-effort — don't fail the main generation flow
  }
}

export async function readTaskStateJson(taskId: string): Promise<Record<string, unknown> | null> {
  try {
    const client = getClient()
    const key = `cn-executor-tasks/${taskId}.json`
    const result = await client.get(key) as { content?: Buffer | string | null }
    if (!result.content) return null
    const text = Buffer.isBuffer(result.content) ? result.content.toString('utf8') : String(result.content)
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

export type OssUploadResult =
  | { success: true; key: string; url: string; storageKey: string }
  | {
      success: false
      errorCode: string
      message: string
      ossBucket?: string
      ossRegion?: string
      ossEndpoint?: string
      ossStatusCode?: number
      ossErrorCode?: string
      ossRequestId?: string
      upstreamMessage?: string
    }

function classifyOssError(err: unknown): { errorCode: string; ossErrorCode?: string; ossStatusCode?: number; ossRequestId?: string } {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase()
  const e = err as { code?: string; status?: number; requestId?: string }
  const ossErrorCode = typeof e.code === 'string' ? e.code : undefined
  const ossStatusCode = typeof e.status === 'number' ? e.status : undefined
  const ossRequestId = typeof e.requestId === 'string' ? e.requestId : undefined

  let errorCode: string
  if (/timeout|etimedout/.test(msg)) {
    errorCode = 'oss_upload_timeout'
  } else if (ossErrorCode === 'AccessDenied' || ossStatusCode === 403 || /access denied|no right|acl|permission|forbidden/.test(msg)) {
    errorCode = 'oss_permission_error'
  } else if (ossErrorCode === 'NoSuchBucket' || /no such bucket/.test(msg)) {
    errorCode = 'oss_bucket_not_found'
  } else if (ossErrorCode === 'InvalidBucketName' || ossErrorCode === 'InvalidEndpoint') {
    errorCode = 'oss_config_error'
  } else {
    errorCode = 'oss_upload_error'
  }
  return { errorCode, ossErrorCode, ossStatusCode, ossRequestId }
}

export async function uploadToOss(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<OssUploadResult> {
  const timeout = numericEnv('ALIYUN_OSS_UPLOAD_TIMEOUT_MS', numericEnv('ALIYUN_OSS_TIMEOUT_MS', 30_000))
  const ossBucket = process.env.ALIYUN_OSS_BUCKET ?? ''
  const ossRegion = process.env.ALIYUN_OSS_REGION ?? ''
  const ossEndpoint = process.env.ALIYUN_OSS_ENDPOINT ?? ''
  try {
    const client = getClient()
    let attempt = 0
    for (;;) {
      attempt++
      try {
        await client.put(key, buffer, {
          timeout,
          headers: { 'Content-Type': contentType },
        })
        break
      } catch (err) {
        if (attempt <= 2 && isRetryableError(err)) {
          await new Promise((r) => setTimeout(r, 350 * attempt))
          continue
        }
        throw err
      }
    }
    const publicUrl = buildPublicUrl(key)
    const fallbackUrl = `https://${ossBucket}.${ossRegion}.aliyuncs.com/${key}`
    const url = publicUrl ?? fallbackUrl
    return { success: true, key, url, storageKey: key }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const { errorCode, ossErrorCode, ossStatusCode, ossRequestId } = classifyOssError(err)
    return {
      success: false,
      errorCode,
      message: `OSS upload failed: ${msg}`,
      upstreamMessage: msg,
      ossBucket,
      ossRegion,
      ossEndpoint,
      ossErrorCode,
      ossStatusCode,
      ossRequestId,
    }
  }
}
