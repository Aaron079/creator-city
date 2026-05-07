import { db } from '@/lib/db'
import { getGatewayPricing } from '@/lib/gateway/pricing'
import { checkEnvKeys } from '@/lib/providers/env'
import { getAdapter } from '@/lib/providers/registry'
import {
  PROVIDER_GATEWAY_SCHEMA_MISSING_CODE,
  PROVIDER_GATEWAY_SCHEMA_MISSING_MESSAGE,
  isProviderGatewaySchemaMissing,
} from '@/lib/gateway/schema-errors'

export type AdminProviderStatus = 'configured' | 'not-configured' | 'error'
export type AdminProviderLastTestStatus = 'untested' | 'passed' | 'failed'

export type AdminProviderCapability =
  | 'Text'
  | 'Image'
  | 'Video'
  | 'Audio'
  | 'LLM'
  | 'Image-to-Video'
  | 'Voice'
  | 'Storage'
  | 'Payment'

type HealthCheckMode = 'adapter' | 'endpoint-health' | 'env-only'

type AdminProviderDefinition = {
  providerId: string
  displayName: string
  capability: AdminProviderCapability[]
  category: string
  envKeys: string[]
  optionalEnvKeys?: string[]
  nodeType: string
  pricingProviderId?: string
  adapterId?: string
  endpointEnvKey?: string
  setupHint: string
  healthCheckMode: HealthCheckMode
}

export type AdminProviderAccountRow = {
  providerId: string
  displayName: string
  monthlyBudgetUsd: unknown
  currentMonthCostUsd: unknown
  budgetMonth: string | null
  isActive: boolean
  lastCheckedAt: Date | null
}

export type AdminProviderStatusRow = {
  providerId: string
  displayName: string
  capability: AdminProviderCapability[]
  category: string
  envKey: string
  envKeys: string[]
  optionalEnvKeys: string[]
  status: AdminProviderStatus
  configured: boolean
  enabled: boolean
  estimatedCost: number
  creditsPerCall: number
  monthlyBudgetUsd: number | null
  currentMonthCostUsd: number
  budgetMonth: string | null
  missingEnvKeys: string[]
  lastTestStatus: AdminProviderLastTestStatus
  lastCheckedAt: string | null
  canTest: boolean
  setupHint: string
}

export type ProviderManagementResult = {
  providers: AdminProviderStatusRow[]
  summary: {
    total: number
    configured: number
    notConfigured: number
    error: number
    enabled: number
    disabled: number
  }
  categories: string[]
  errorCode?: string
  message?: string
}

export const ADMIN_PROVIDER_REGISTRY: AdminProviderDefinition[] = [
  {
    providerId: 'openai-text',
    displayName: 'OpenAI Text',
    capability: ['Text', 'LLM'],
    category: 'Text',
    envKeys: ['OPENAI_API_KEY'],
    nodeType: 'text',
    adapterId: 'openai-text',
    setupHint: '配置 OPENAI_API_KEY；可选 OPENAI_TEXT_MODEL。',
    healthCheckMode: 'adapter',
  },
  {
    providerId: 'openai-image',
    displayName: 'OpenAI Image',
    capability: ['Image'],
    category: 'Image',
    envKeys: ['OPENAI_API_KEY'],
    nodeType: 'image',
    adapterId: 'openai-images',
    setupHint: '配置 OPENAI_API_KEY；可选 OPENAI_IMAGE_MODEL。',
    healthCheckMode: 'adapter',
  },
  {
    providerId: 'openrouter-text',
    displayName: 'OpenRouter Text',
    capability: ['Text', 'LLM'],
    category: 'LLM',
    envKeys: ['OPENROUTER_API_KEY'],
    nodeType: 'text',
    pricingProviderId: 'openrouter',
    setupHint: '配置 OPENROUTER_API_KEY。测试入口仅做环境配置检查。',
    healthCheckMode: 'env-only',
  },
  {
    providerId: 'fal-image',
    displayName: 'fal.ai Image',
    capability: ['Image'],
    category: 'Image',
    envKeys: ['FAL_KEY'],
    nodeType: 'image',
    pricingProviderId: 'fal',
    setupHint: '配置 FAL_KEY。测试入口不发起真实生成。',
    healthCheckMode: 'env-only',
  },
  {
    providerId: 'fal-video',
    displayName: 'fal.ai Video',
    capability: ['Video', 'Image-to-Video'],
    category: 'Video',
    envKeys: ['FAL_KEY'],
    nodeType: 'video',
    pricingProviderId: 'fal',
    setupHint: '配置 FAL_KEY。测试入口不发起真实生成。',
    healthCheckMode: 'env-only',
  },
  {
    providerId: 'replicate-image',
    displayName: 'Replicate Image',
    capability: ['Image'],
    category: 'Image',
    envKeys: ['REPLICATE_API_TOKEN'],
    nodeType: 'image',
    pricingProviderId: 'replicate',
    setupHint: '配置 REPLICATE_API_TOKEN。测试入口不发起真实生成。',
    healthCheckMode: 'env-only',
  },
  {
    providerId: 'replicate-video',
    displayName: 'Replicate Video',
    capability: ['Video', 'Image-to-Video'],
    category: 'Video',
    envKeys: ['REPLICATE_API_TOKEN'],
    nodeType: 'video',
    pricingProviderId: 'replicate',
    setupHint: '配置 REPLICATE_API_TOKEN。测试入口不发起真实生成。',
    healthCheckMode: 'env-only',
  },
  {
    providerId: 'creator-video-gateway',
    displayName: 'Creator Video Gateway',
    capability: ['Video', 'Image-to-Video'],
    category: 'Video',
    envKeys: ['CREATOR_VIDEO_GATEWAY_ENDPOINT'],
    optionalEnvKeys: ['CREATOR_VIDEO_GATEWAY_API_KEY'],
    nodeType: 'video',
    endpointEnvKey: 'CREATOR_VIDEO_GATEWAY_ENDPOINT',
    setupHint: '配置 CREATOR_VIDEO_GATEWAY_ENDPOINT；可选 CREATOR_VIDEO_GATEWAY_API_KEY。',
    healthCheckMode: 'endpoint-health',
  },
  {
    providerId: 'custom-video-gateway',
    displayName: 'Custom Video Gateway',
    capability: ['Video', 'Image-to-Video'],
    category: 'Video',
    envKeys: ['CUSTOM_VIDEO_PROVIDER_ENDPOINT'],
    optionalEnvKeys: ['CUSTOM_VIDEO_PROVIDER_API_KEY'],
    nodeType: 'video',
    adapterId: 'custom-video-gateway',
    setupHint: '配置 CUSTOM_VIDEO_PROVIDER_ENDPOINT；可选 CUSTOM_VIDEO_PROVIDER_API_KEY。',
    healthCheckMode: 'adapter',
  },
  {
    providerId: 'elevenlabs',
    displayName: 'ElevenLabs Voice',
    capability: ['Audio', 'Voice'],
    category: 'Voice',
    envKeys: ['ELEVENLABS_API_KEY'],
    nodeType: 'audio',
    adapterId: 'elevenlabs',
    setupHint: '配置 ELEVENLABS_API_KEY。',
    healthCheckMode: 'adapter',
  },
  {
    providerId: 'aliyun-oss',
    displayName: 'Aliyun OSS',
    capability: ['Storage'],
    category: 'Storage',
    envKeys: ['ALIYUN_ACCESS_KEY_ID', 'ALIYUN_ACCESS_KEY_SECRET', 'ALIYUN_OSS_BUCKET', 'ALIYUN_OSS_REGION', 'ALIYUN_OSS_ENDPOINT'],
    optionalEnvKeys: ['ALIYUN_OSS_PUBLIC_BASE_URL'],
    nodeType: 'storage',
    setupHint: '配置阿里云 OSS bucket、region、endpoint 与访问密钥。',
    healthCheckMode: 'env-only',
  },
  {
    providerId: 'alipay',
    displayName: 'Alipay',
    capability: ['Payment'],
    category: 'Payment',
    envKeys: ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'],
    optionalEnvKeys: ['ALIPAY_GATEWAY'],
    nodeType: 'payment',
    setupHint: '配置支付宝应用 ID、应用私钥、支付宝公钥。',
    healthCheckMode: 'env-only',
  },
  {
    providerId: 'wechatpay',
    displayName: 'WeChat Pay',
    capability: ['Payment'],
    category: 'Payment',
    envKeys: ['WECHAT_PAY_APP_ID', 'WECHAT_PAY_MCH_ID', 'WECHAT_PAY_API_V3_KEY', 'WECHAT_PAY_PRIVATE_KEY', 'WECHAT_PAY_CERT_SERIAL_NO', 'WECHAT_PAY_NOTIFY_URL'],
    nodeType: 'payment',
    setupHint: '配置微信支付 v3 商户号、证书序列号、私钥、API v3 key 和通知地址。',
    healthCheckMode: 'env-only',
  },
]

export function getAdminProviderDefinition(providerId: string) {
  return ADMIN_PROVIDER_REGISTRY.find((provider) => provider.providerId === providerId) ?? null
}

export async function getProviderAccountMap() {
  try {
    const rows = await db.providerAccount.findMany({
      select: {
        providerId: true,
        displayName: true,
        monthlyBudgetUsd: true,
        currentMonthCostUsd: true,
        budgetMonth: true,
        isActive: true,
        lastCheckedAt: true,
      },
    })
    return { accountMap: new Map(rows.map((row) => [row.providerId, row])), schemaMissing: false }
  } catch (error) {
    if (isProviderGatewaySchemaMissing(error)) {
      return { accountMap: new Map<string, AdminProviderAccountRow>(), schemaMissing: true }
    }
    throw error
  }
}

export async function buildProviderManagementStatus(): Promise<ProviderManagementResult> {
  const { accountMap, schemaMissing } = await getProviderAccountMap()
  const providers = ADMIN_PROVIDER_REGISTRY.map((definition) => toProviderStatusRow(definition, accountMap.get(definition.providerId)))
  const summary = providers.reduce<ProviderManagementResult['summary']>((acc, provider) => {
    acc.total += 1
    if (provider.status === 'configured') acc.configured += 1
    if (provider.status === 'not-configured') acc.notConfigured += 1
    if (provider.status === 'error') acc.error += 1
    if (provider.enabled) acc.enabled += 1
    else acc.disabled += 1
    return acc
  }, { total: 0, configured: 0, notConfigured: 0, error: 0, enabled: 0, disabled: 0 })

  return {
    providers,
    summary,
    categories: [...new Set(providers.map((provider) => provider.category))],
    ...(schemaMissing ? {
      errorCode: PROVIDER_GATEWAY_SCHEMA_MISSING_CODE,
      message: PROVIDER_GATEWAY_SCHEMA_MISSING_MESSAGE,
    } : {}),
  }
}

export async function setProviderEnabled(providerId: string, enabled: boolean) {
  const definition = getAdminProviderDefinition(providerId)
  if (!definition) {
    return { ok: false, status: 404, body: { success: false, errorCode: 'PROVIDER_NOT_FOUND', message: `Unknown providerId: ${providerId}` } }
  }

  try {
    const account = await db.providerAccount.upsert({
      where: { providerId },
      create: {
        providerId,
        displayName: definition.displayName,
        isActive: enabled,
      },
      update: {
        displayName: definition.displayName,
        isActive: enabled,
      },
    })
    return {
      ok: true,
      status: 200,
      body: {
        success: true,
        providerId,
        enabled: account.isActive,
        account: {
          providerId: account.providerId,
          displayName: account.displayName,
          isActive: account.isActive,
        },
      },
    }
  } catch (error) {
    if (isProviderGatewaySchemaMissing(error)) {
      return {
        ok: false,
        status: 503,
        body: {
          success: false,
          errorCode: PROVIDER_GATEWAY_SCHEMA_MISSING_CODE,
          message: PROVIDER_GATEWAY_SCHEMA_MISSING_MESSAGE,
        },
      }
    }
    throw error
  }
}

export async function testProviderConnection(providerId: string) {
  const definition = getAdminProviderDefinition(providerId)
  if (!definition) {
    return { ok: false, status: 'error' as const, message: `Unknown providerId: ${providerId}`, missingEnvKeys: [] }
  }

  const envCheck = checkEnvKeys(definition.envKeys)
  if (!envCheck.configured) {
    await touchProviderLastChecked(definition).catch(() => undefined)
    return {
      ok: false,
      status: 'not-configured' as const,
      message: `Missing environment variables: ${envCheck.missing.join(', ')}`,
      missingEnvKeys: envCheck.missing,
    }
  }

  if (definition.healthCheckMode === 'adapter' && definition.adapterId) {
    const adapter = getAdapter(definition.adapterId)
    if (!adapter) {
      await touchProviderLastChecked(definition).catch(() => undefined)
      return { ok: false, status: 'error' as const, message: `Adapter "${definition.adapterId}" not implemented.`, missingEnvKeys: [] }
    }
    const result = await adapter.testConnection()
    await touchProviderLastChecked(definition).catch(() => undefined)
    return {
      ok: result.ok,
      status: result.ok ? 'configured' as const : 'error' as const,
      message: result.message,
      missingEnvKeys: [],
    }
  }

  if (definition.healthCheckMode === 'endpoint-health' && definition.endpointEnvKey) {
    const result = await testEndpointHealth(process.env[definition.endpointEnvKey] ?? '', definition.optionalEnvKeys?.[0])
    await touchProviderLastChecked(definition).catch(() => undefined)
    return {
      ok: result.ok,
      status: result.ok ? 'configured' as const : 'error' as const,
      message: result.message,
      missingEnvKeys: [],
    }
  }

  await touchProviderLastChecked(definition).catch(() => undefined)
  return {
    ok: true,
    status: 'configured' as const,
    message: 'Configuration check passed. No generation or paid API call was made.',
    missingEnvKeys: [],
  }
}

function toProviderStatusRow(definition: AdminProviderDefinition, account?: AdminProviderAccountRow): AdminProviderStatusRow {
  const envCheck = checkEnvKeys(definition.envKeys)
  const pricing = getGatewayPricing(definition.pricingProviderId ?? definition.providerId, definition.nodeType)
  const status: AdminProviderStatus = envCheck.configured ? 'configured' : 'not-configured'
  return {
    providerId: definition.providerId,
    displayName: account?.displayName || definition.displayName,
    capability: definition.capability,
    category: definition.category,
    envKey: definition.envKeys.join(', '),
    envKeys: definition.envKeys,
    optionalEnvKeys: definition.optionalEnvKeys ?? [],
    status,
    configured: envCheck.configured,
    enabled: account?.isActive ?? true,
    estimatedCost: pricing.estimatedCostUsd,
    creditsPerCall: pricing.creditsPerCall,
    monthlyBudgetUsd: account?.monthlyBudgetUsd != null ? Number(account.monthlyBudgetUsd) : null,
    currentMonthCostUsd: account?.currentMonthCostUsd != null ? Number(account.currentMonthCostUsd) : 0,
    budgetMonth: account?.budgetMonth ?? null,
    missingEnvKeys: envCheck.missing,
    lastTestStatus: account?.lastCheckedAt ? (envCheck.configured ? 'passed' : 'failed') : 'untested',
    lastCheckedAt: account?.lastCheckedAt ? account.lastCheckedAt.toISOString() : null,
    canTest: true,
    setupHint: definition.setupHint,
  }
}

async function touchProviderLastChecked(definition: AdminProviderDefinition) {
  await db.providerAccount.upsert({
    where: { providerId: definition.providerId },
    create: {
      providerId: definition.providerId,
      displayName: definition.displayName,
      lastCheckedAt: new Date(),
    },
    update: {
      displayName: definition.displayName,
      lastCheckedAt: new Date(),
    },
  })
}

async function testEndpointHealth(endpoint: string, optionalApiKeyEnv?: string) {
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    const apiKey = optionalApiKeyEnv ? process.env[optionalApiKeyEnv] : undefined
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(`${endpoint.replace(/\/+$/, '')}/health`, {
        method: 'GET',
        headers,
        signal: controller.signal,
        cache: 'no-store',
      })
      return {
        ok: response.ok || response.status < 500,
        message: response.ok ? 'Health endpoint reachable.' : `Health endpoint returned HTTP ${response.status}.`,
      }
    } finally {
      clearTimeout(timer)
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Health check failed.',
    }
  }
}
