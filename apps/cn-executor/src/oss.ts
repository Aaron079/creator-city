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
    timeout: numericEnv('ALIYUN_OSS_TIMEOUT_MS', 120_000),
  })
}

function isRetryableError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase()
  return /timeout|etimedout|econnreset|eai_again|socket hang up/.test(msg)
}

export type OssUploadResult =
  | { success: true; key: string; url: string; storageKey: string }
  | { success: false; errorCode: string; message: string }

export async function uploadToOss(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<OssUploadResult> {
  const timeout = numericEnv('ALIYUN_OSS_UPLOAD_TIMEOUT_MS', numericEnv('ALIYUN_OSS_TIMEOUT_MS', 120_000))
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
    const bucket = process.env.ALIYUN_OSS_BUCKET ?? ''
    const region = process.env.ALIYUN_OSS_REGION ?? ''
    const fallbackUrl = `https://${bucket}.${region}.aliyuncs.com/${key}`
    const url = publicUrl ?? fallbackUrl
    return { success: true, key, url, storageKey: key }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const lower = msg.toLowerCase()
    const errorCode = /timeout|etimedout/.test(lower) ? 'oss_upload_timeout' : 'oss_upload_error'
    return { success: false, errorCode, message: `OSS upload failed: ${msg}` }
  }
}
