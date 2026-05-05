import { ChinaStorageError } from './errors'
import type {
  ChinaStorageConfiguration,
  ChinaStorageObjectResult,
  ChinaStorageSignedUrlResult,
  PutChinaObjectInput,
  SignedChinaObjectInput,
} from './types'

const REQUIRED = [
  'TENCENT_SECRET_ID',
  'TENCENT_SECRET_KEY',
  'TENCENT_COS_BUCKET',
  'TENCENT_COS_REGION',
] as const

export function getTencentCosConfiguration(): ChinaStorageConfiguration {
  const missing = REQUIRED.filter((key) => !process.env[key])
  return {
    provider: 'tencent-cos',
    configured: missing.length === 0,
    missing,
    mode: missing.length === 0 ? 'stub' : 'not-configured',
  }
}

function requireTencentCos() {
  const config = getTencentCosConfiguration()
  if (!config.configured) {
    throw new ChinaStorageError('STORAGE_NOT_CONFIGURED', '腾讯云 COS 参数未配置。', 503, {
      provider: 'tencent-cos',
      missing: config.missing,
    })
  }
}

export async function putTencentCosObject(input: PutChinaObjectInput): Promise<ChinaStorageObjectResult> {
  requireTencentCos()
  return {
    provider: 'tencent-cos',
    bucket: process.env.TENCENT_COS_BUCKET ?? '',
    key: input.key,
    raw: { mode: 'stub', contentType: input.contentType, metadata: input.metadata },
  }
}

export async function getTencentCosSignedUploadUrl(input: SignedChinaObjectInput): Promise<ChinaStorageSignedUrlResult> {
  requireTencentCos()
  return {
    provider: 'tencent-cos',
    bucket: process.env.TENCENT_COS_BUCKET ?? '',
    key: input.key,
    raw: { mode: 'stub', expiresInSeconds: input.expiresInSeconds },
  }
}

export async function getTencentCosSignedDownloadUrl(input: SignedChinaObjectInput): Promise<ChinaStorageSignedUrlResult> {
  requireTencentCos()
  return {
    provider: 'tencent-cos',
    bucket: process.env.TENCENT_COS_BUCKET ?? '',
    key: input.key,
    raw: { mode: 'stub', expiresInSeconds: input.expiresInSeconds },
  }
}

export async function deleteTencentCosObject(key: string): Promise<ChinaStorageObjectResult> {
  requireTencentCos()
  return {
    provider: 'tencent-cos',
    bucket: process.env.TENCENT_COS_BUCKET ?? '',
    key,
    raw: { mode: 'stub' },
  }
}
