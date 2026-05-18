import type { ProviderAdapterId, ProviderRegionConfig, Region, StorageAdapterId, StorageRegionConfig } from './types'

export const DEFAULT_USER_REGION: Region = 'cn'
export const DEFAULT_PROJECT_REGION: Region = 'cn'

export const PROVIDER_REGION_REGISTRY: Record<ProviderAdapterId, ProviderRegionConfig> = {
  volcengine_seedream: {
    id: 'volcengine_seedream',
    region: 'cn',
    availability: 'active',
    runtimeProviderIds: ['volcengine-seedream-image'],
    label: 'Volcengine Seedream',
    notes: 'Current China image provider. Runtime behavior is unchanged.',
  },
  volcengine_seedance: {
    id: 'volcengine_seedance',
    region: 'cn',
    availability: 'active',
    runtimeProviderIds: ['volcengine-seedance-video'],
    label: 'Volcengine Seedance',
    notes: 'Current China video provider. Runtime behavior is unchanged.',
  },
  jimeng: {
    id: 'jimeng',
    region: 'cn',
    availability: 'active',
    runtimeProviderIds: ['jimeng-image', 'jimeng-video', 'jimeng'],
    label: 'Jimeng (即梦)',
    notes: 'China image/video provider by ByteDance.',
  },
  deepseek: {
    id: 'deepseek',
    region: 'cn',
    availability: 'active',
    runtimeProviderIds: ['deepseek', 'deepseek-chat', 'deepseek-v3', 'deepseek-r1', 'deepseek-text'],
    label: 'DeepSeek',
    notes: 'China text/LLM provider.',
  },
  openai: {
    id: 'openai',
    region: 'global',
    availability: 'future',
    runtimeProviderIds: ['openai', 'openai-image', 'openai-video'],
    label: 'OpenAI',
    notes: 'Registered for future Global Stack routing only.',
  },
  runway: {
    id: 'runway',
    region: 'global',
    availability: 'future',
    runtimeProviderIds: ['runway', 'runway-video'],
    label: 'Runway',
    notes: 'Registered for future Global Stack routing only.',
  },
  replicate: {
    id: 'replicate',
    region: 'global',
    availability: 'future',
    runtimeProviderIds: ['replicate', 'replicate-image', 'replicate-video'],
    label: 'Replicate',
    notes: 'Registered for future Global Stack routing only.',
  },
  fal: {
    id: 'fal',
    region: 'global',
    availability: 'future',
    runtimeProviderIds: ['fal', 'fal-ai', 'fal-image', 'fal-video'],
    label: 'Fal',
    notes: 'Registered for future Global Stack routing only.',
  },
  stability: {
    id: 'stability',
    region: 'global',
    availability: 'future',
    runtimeProviderIds: ['stability', 'stability-ai', 'stable-diffusion', 'sdxl', 'stability-image'],
    label: 'Stability AI',
    notes: 'Registered for future Global Stack routing only.',
  },
  google: {
    id: 'google',
    region: 'global',
    availability: 'future',
    runtimeProviderIds: ['google', 'google-imagen', 'google-veo', 'google-video', 'google-image'],
    label: 'Google (Imagen / Veo)',
    notes: 'Registered for future Global Stack routing only.',
  },
  midjourney: {
    id: 'midjourney',
    region: 'global',
    availability: 'future',
    runtimeProviderIds: ['midjourney', 'midjourney-image', 'midjourney-video'],
    label: 'Midjourney',
    notes: 'Registered for future Global Stack routing only.',
  },
  kling_global: {
    id: 'kling_global',
    region: 'global',
    availability: 'future',
    runtimeProviderIds: [
      'kling', 'kling-video', 'kling-image', 'kling-image-to-video',
      'kling-3-0-omni', 'kling-edit', 'kling-motion-transfer',
      'kling-2-6', 'kling-2-1', 'kling-2-5', 'kling-o1',
    ],
    label: 'Kling (Global)',
    notes: 'Registered for future Global Stack routing only.',
  },
}

export const STORAGE_REGION_REGISTRY: Record<StorageAdapterId, StorageRegionConfig> = {
  aliyun_oss: {
    id: 'aliyun_oss',
    region: 'cn',
    availability: 'active',
    runtimeStorageProviders: ['aliyun-oss', 'aliyun_oss'],
    label: 'Aliyun OSS',
    notes: 'Current China media persistence target. Runtime behavior is unchanged.',
  },
  s3: {
    id: 's3',
    region: 'global',
    availability: 'future',
    runtimeStorageProviders: ['s3', 'aws-s3'],
    label: 'Amazon S3',
    notes: 'Registered for future Global Stack storage only.',
  },
  cloudflare_r2: {
    id: 'cloudflare_r2',
    region: 'global',
    availability: 'future',
    runtimeStorageProviders: ['cloudflare-r2', 'cloudflare_r2', 'r2'],
    label: 'Cloudflare R2',
    notes: 'Registered for future Global Stack storage only.',
  },
  vercel_blob: {
    id: 'vercel_blob',
    region: 'global',
    availability: 'future',
    runtimeStorageProviders: ['vercel_blob', 'vercel-blob'],
    label: 'Vercel Blob',
    notes: 'Registered for future Global Stack storage only.',
  },
}

export const PROVIDER_RUNTIME_ID_TO_REGION_ID = Object.fromEntries(
  Object.values(PROVIDER_REGION_REGISTRY).flatMap((config) => (
    config.runtimeProviderIds.map((providerId) => [providerId, config.id])
  )),
) as Record<string, ProviderAdapterId>

export const STORAGE_RUNTIME_ID_TO_REGION_ID = Object.fromEntries(
  Object.values(STORAGE_REGION_REGISTRY).flatMap((config) => (
    config.runtimeStorageProviders.map((storageProvider) => [storageProvider, config.id])
  )),
) as Record<string, StorageAdapterId>

export function normalizeProviderAdapterId(provider?: string | null): ProviderAdapterId | null {
  if (!provider) return null
  const normalized = provider.trim().toLowerCase().replace(/-/g, '_')
  if (normalized in PROVIDER_REGION_REGISTRY) return normalized as ProviderAdapterId
  return PROVIDER_RUNTIME_ID_TO_REGION_ID[provider.trim()] ?? PROVIDER_RUNTIME_ID_TO_REGION_ID[provider.trim().toLowerCase()] ?? null
}

export function normalizeStorageAdapterId(storageProvider?: string | null): StorageAdapterId | null {
  if (!storageProvider) return null
  const normalized = storageProvider.trim().toLowerCase().replace(/-/g, '_')
  if (normalized in STORAGE_REGION_REGISTRY) return normalized as StorageAdapterId
  return STORAGE_RUNTIME_ID_TO_REGION_ID[storageProvider.trim()] ?? STORAGE_RUNTIME_ID_TO_REGION_ID[storageProvider.trim().toLowerCase()] ?? null
}
