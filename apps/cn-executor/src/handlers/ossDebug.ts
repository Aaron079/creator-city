import type { IncomingMessage, ServerResponse } from 'http'
import { isAuthorized } from '../auth'
import { jsonOk, jsonUnauthorized } from '../response'
import { uploadToOss } from '../oss'

function maskKey(value: string | undefined, prefixLen = 4): string {
  if (!value) return '<missing>'
  return `<present, prefix=${value.slice(0, prefixLen)}, length=${value.length}>`
}

export function handleOssConfig(req: IncomingMessage, res: ServerResponse): void {
  if (!isAuthorized(req)) {
    jsonUnauthorized(res)
    return
  }

  const bucket = process.env.ALIYUN_OSS_BUCKET ?? ''
  const region = process.env.ALIYUN_OSS_REGION ?? ''
  const endpoint = process.env.ALIYUN_OSS_ENDPOINT ?? ''
  const publicBaseUrl = process.env.ALIYUN_OSS_PUBLIC_BASE_URL ?? ''
  const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID || ''
  const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET || ''

  const expectedPublicUrl = bucket && region
    ? `https://${bucket}.${region}.aliyuncs.com/`
    : '<cannot determine>'

  jsonOk(res, {
    ok: Boolean(bucket && region && accessKeyId && accessKeySecret),
    bucket: bucket || '<missing>',
    region: region || '<missing>',
    endpoint: endpoint || '<missing (optional, SDK derives from region)>',
    publicBaseUrl: publicBaseUrl || '<missing — will use bucket.region.aliyuncs.com>',
    accessKeyId: maskKey(accessKeyId),
    accessKeySecret: accessKeySecret ? `<present, length=${accessKeySecret.length}>` : '<missing>',
    expectedPublicUrl,
    requiredRamPermissions: ['oss:PutObject', 'oss:GetObject', 'oss:GetBucketAcl'],
    requiredRamResource: bucket ? `acs:oss:*:*:${bucket}/*` : '<set ALIYUN_OSS_BUCKET>',
  })
}

export async function handleOssWriteProbe(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    jsonUnauthorized(res)
    return
  }

  const key = `assets/debug/probe-${Date.now()}.txt`
  const content = `OSS write probe — ${new Date().toISOString()}`
  const buffer = Buffer.from(content, 'utf8')

  const result = await uploadToOss(key, buffer, 'text/plain')

  if (result.success) {
    jsonOk(res, {
      ok: true,
      key: result.key,
      url: result.url,
      storageKey: result.storageKey,
      message: 'OSS write probe succeeded — PutObject permission is working.',
    })
  } else {
    jsonOk(res, {
      ok: false,
      errorCode: result.errorCode,
      message: result.message,
      ossBucket: result.ossBucket,
      ossRegion: result.ossRegion,
      ossEndpoint: result.ossEndpoint,
      ossStatusCode: result.ossStatusCode,
      ossErrorCode: result.ossErrorCode,
      ossRequestId: result.ossRequestId,
      hint: result.errorCode === 'oss_permission_error'
        ? 'The AccessKey lacks PutObject permission. Go to Aliyun RAM console → Users → find this AccessKey user → attach AliyunOSSFullAccess or a custom policy with oss:PutObject on the bucket.'
        : result.errorCode === 'oss_bucket_not_found'
          ? 'Bucket not found. Check ALIYUN_OSS_BUCKET env var matches the actual bucket name.'
          : 'Check ALIYUN_OSS_REGION and ALIYUN_OSS_ENDPOINT match the bucket region.',
    })
  }
}
