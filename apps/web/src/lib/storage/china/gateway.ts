import {
  deleteAliyunOssObject,
  getAliyunOssConfiguration,
  getAliyunOssObject,
  getAliyunOssSignedDownloadUrl,
  getAliyunOssSignedUploadUrl,
  headAliyunOssObject,
  putAliyunOssObject,
} from './aliyun-oss'
import { ChinaStorageError } from './errors'
import {
  deleteTencentCosObject,
  getTencentCosConfiguration,
  getTencentCosObject,
  getTencentCosSignedDownloadUrl,
  getTencentCosSignedUploadUrl,
  headTencentCosObject,
  putTencentCosObject,
} from './tencent-cos'
import type {
  ChinaStorageConfiguration,
  ChinaStorageObjectMetadataResult,
  ChinaStorageReadObjectResult,
  ChinaStorageObjectResult,
  ChinaStorageProvider,
  ChinaStorageSignedUrlResult,
  PutChinaObjectInput,
  SignedChinaObjectInput,
} from './types'

export function getConfiguredChinaStorageProvider(): ChinaStorageProvider {
  const provider = process.env.CHINA_STORAGE_PROVIDER
  if (provider === 'aliyun-oss' || provider === 'tencent-cos') return provider
  return 'aliyun-oss'
}

export function getChinaStorageConfigurations(): Record<ChinaStorageProvider, ChinaStorageConfiguration> {
  return {
    'aliyun-oss': getAliyunOssConfiguration(),
    'tencent-cos': getTencentCosConfiguration(),
  }
}

export function getChinaStorageStatus(provider = getConfiguredChinaStorageProvider()) {
  return getChinaStorageConfigurations()[resolveProvider(provider)]
}

export function isChinaStorageConfigured(provider = getConfiguredChinaStorageProvider()) {
  return getChinaStorageStatus(provider).configured
}

function resolveProvider(provider = getConfiguredChinaStorageProvider()): ChinaStorageProvider {
  if (provider === 'aliyun-oss' || provider === 'tencent-cos') return provider
  throw new ChinaStorageError('STORAGE_PROVIDER_UNSUPPORTED', '不支持的中国对象存储服务商。', 400)
}

export async function putObject(input: PutChinaObjectInput & { provider?: ChinaStorageProvider }): Promise<ChinaStorageObjectResult> {
  return resolveProvider(input.provider) === 'aliyun-oss'
    ? putAliyunOssObject(input)
    : putTencentCosObject(input)
}

export const putChinaObject = putObject

export async function headObject(input: { key: string; provider?: ChinaStorageProvider }): Promise<ChinaStorageObjectMetadataResult> {
  return resolveProvider(input.provider) === 'aliyun-oss'
    ? headAliyunOssObject(input.key)
    : headTencentCosObject(input.key)
}

export const headChinaObject = headObject

export async function getObject(input: { key: string; provider?: ChinaStorageProvider }): Promise<ChinaStorageReadObjectResult> {
  return resolveProvider(input.provider) === 'aliyun-oss'
    ? getAliyunOssObject(input.key)
    : getTencentCosObject(input.key)
}

export const getChinaObject = getObject

export async function getSignedUploadUrl(
  input: SignedChinaObjectInput & { provider?: ChinaStorageProvider },
): Promise<ChinaStorageSignedUrlResult> {
  return resolveProvider(input.provider) === 'aliyun-oss'
    ? getAliyunOssSignedUploadUrl(input)
    : getTencentCosSignedUploadUrl(input)
}

export async function getSignedDownloadUrl(
  input: SignedChinaObjectInput & { provider?: ChinaStorageProvider },
): Promise<ChinaStorageSignedUrlResult> {
  return resolveProvider(input.provider) === 'aliyun-oss'
    ? getAliyunOssSignedDownloadUrl(input)
    : getTencentCosSignedDownloadUrl(input)
}

export async function deleteObject(input: { key: string; provider?: ChinaStorageProvider }): Promise<ChinaStorageObjectResult> {
  return resolveProvider(input.provider) === 'aliyun-oss'
    ? deleteAliyunOssObject(input.key)
    : deleteTencentCosObject(input.key)
}
