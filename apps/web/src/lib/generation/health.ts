import { getExecutorStatus } from '@/lib/executors/executor-gateway'
import { PROVIDER_REGION_REGISTRY } from '@/lib/regions/registry'
import type { GenerationHealthResponse, GenerationHealthSection } from './health-types'

type RequiredEnv =
  | string
  | {
      name: string
      aliases: string[]
    }

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim())
}

function missingEnv(required: RequiredEnv[]) {
  return required
    .filter((entry) => {
      if (typeof entry === 'string') return !hasEnv(entry)
      return !entry.aliases.some(hasEnv)
    })
    .map((entry) => typeof entry === 'string' ? entry : entry.name)
}

function section(provider: string | undefined, required: RequiredEnv[]): GenerationHealthSection {
  const missing = missingEnv(required)
  return {
    ok: missing.length === 0,
    ...(provider ? { provider } : {}),
    missingEnv: missing,
  }
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

export function getGenerationHealth(): GenerationHealthResponse {
  const database = section(undefined, ['DATABASE_URL'])
  const storageEnv = section('aliyun_oss', [
    { name: 'ALIYUN_OSS_ACCESS_KEY_ID', aliases: ['ALIYUN_OSS_ACCESS_KEY_ID', 'ALIYUN_ACCESS_KEY_ID'] },
    { name: 'ALIYUN_OSS_ACCESS_KEY_SECRET', aliases: ['ALIYUN_OSS_ACCESS_KEY_SECRET', 'ALIYUN_ACCESS_KEY_SECRET'] },
    'ALIYUN_OSS_BUCKET',
    'ALIYUN_OSS_REGION',
    'ALIYUN_OSS_ENDPOINT',
  ])
  const publicBaseUrlConfigured = hasEnv('ALIYUN_OSS_PUBLIC_BASE_URL')
  const storage: GenerationHealthSection = {
    ...storageEnv,
    accessMode: publicBaseUrlConfigured ? 'public_base_url_or_signed_url' : 'signed_url_or_proxy',
    publicBaseUrlConfigured,
    isPrivateBucket: !publicBaseUrlConfigured,
    signedUrlAvailable: storageEnv.ok,
    proxyAvailable: storageEnv.ok,
  }
  const imageGeneration = section('volcengine_seedream', [
    'VOLCENGINE_ARK_API_KEY',
    'VOLCENGINE_SEEDREAM_MODEL',
  ])
  const videoGeneration = section('volcengine_seedance', [
    'VOLCENGINE_ARK_API_KEY',
    'VOLCENGINE_SEEDANCE_MODEL',
  ])
  const textGeneration = section('deepseek', [
    'DEEPSEEK_API_KEY',
    'DEEPSEEK_BASE_URL',
    'DEEPSEEK_MODEL',
  ])
  const missing = unique([
    ...database.missingEnv,
    ...storage.missingEnv,
    ...imageGeneration.missingEnv,
    ...videoGeneration.missingEnv,
    ...textGeneration.missingEnv,
  ])

  const executorStatus = getExecutorStatus()
  const cnProviders = Object.values(PROVIDER_REGION_REGISTRY)
    .filter((p) => p.region === 'cn')
    .map((p) => ({ id: p.id, label: p.label, runtimeProviderIds: p.runtimeProviderIds }))
  const globalProviders = Object.values(PROVIDER_REGION_REGISTRY)
    .filter((p) => p.region === 'global')
    .map((p) => ({ id: p.id, label: p.label, runtimeProviderIds: p.runtimeProviderIds }))
  const executors = {
    cn: { ...executorStatus.cn, providers: cnProviders },
    global: { ...executorStatus.global, providers: globalProviders },
  }

  return {
    ok: database.ok && storage.ok && imageGeneration.ok && videoGeneration.ok && textGeneration.ok,
    checkedAt: new Date().toISOString(),
    database,
    storage,
    imageGeneration,
    videoGeneration,
    textGeneration,
    missingEnv: missing,
    executors,
  }
}
