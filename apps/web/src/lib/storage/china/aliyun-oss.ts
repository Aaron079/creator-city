import { ChinaStorageError } from './errors'
import type {
  ChinaStorageConfiguration,
  ChinaStorageObjectResult,
  ChinaStorageSignedUrlResult,
  PutChinaObjectInput,
  SignedChinaObjectInput,
} from './types'

const REQUIRED = [
  'ALIYUN_ACCESS_KEY_ID',
  'ALIYUN_ACCESS_KEY_SECRET',
  'ALIYUN_OSS_BUCKET',
  'ALIYUN_OSS_REGION',
  'ALIYUN_OSS_ENDPOINT',
] as const

export function getAliyunOssConfiguration(): ChinaStorageConfiguration {
  const missing = REQUIRED.filter((key) => !process.env[key])
  return {
    provider: 'aliyun-oss',
    configured: missing.length === 0,
    missing,
    mode: missing.length === 0 ? 'stub' : 'not-configured',
  }
}

function requireAliyunOss() {
  const config = getAliyunOssConfiguration()
  if (!config.configured) {
    throw new ChinaStorageError('STORAGE_NOT_CONFIGURED', '阿里云 OSS 参数未配置。', 503, {
      provider: 'aliyun-oss',
      missing: config.missing,
    })
  }
}

export async function putAliyunOssObject(input: PutChinaObjectInput): Promise<ChinaStorageObjectResult> {
  requireAliyunOss()
  return {
    provider: 'aliyun-oss',
    bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
    key: input.key,
    raw: { mode: 'stub', contentType: input.contentType, metadata: input.metadata },
  }
}

export async function getAliyunOssSignedUploadUrl(input: SignedChinaObjectInput): Promise<ChinaStorageSignedUrlResult> {
  requireAliyunOss()
  return {
    provider: 'aliyun-oss',
    bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
    key: input.key,
    raw: { mode: 'stub', expiresInSeconds: input.expiresInSeconds },
  }
}

export async function getAliyunOssSignedDownloadUrl(input: SignedChinaObjectInput): Promise<ChinaStorageSignedUrlResult> {
  requireAliyunOss()
  return {
    provider: 'aliyun-oss',
    bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
    key: input.key,
    raw: { mode: 'stub', expiresInSeconds: input.expiresInSeconds },
  }
}

export async function deleteAliyunOssObject(key: string): Promise<ChinaStorageObjectResult> {
  requireAliyunOss()
  return {
    provider: 'aliyun-oss',
    bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
    key,
    raw: { mode: 'stub' },
  }
}
