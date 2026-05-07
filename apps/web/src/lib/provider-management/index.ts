import { db } from '@/lib/db'
import { getGatewayPricing } from '@/lib/gateway/pricing'
import { checkEnvKeys } from '@/lib/providers/env'
import {
  PROVIDER_GATEWAY_SCHEMA_MISSING_CODE,
  PROVIDER_GATEWAY_SCHEMA_MISSING_MESSAGE,
  isProviderGatewaySchemaMissing,
} from '@/lib/gateway/schema-errors'

export type AdminProviderStatus = 'configured' | 'not-configured' | 'error'
export type AdminProviderAvailabilityStatus = 'available' | 'disabled' | 'not-configured' | 'error'
export type AdminProviderLastTestStatus = 'untested' | 'passed' | 'failed'

export type AdminProviderCapability =
  | 'Text'
  | 'Image'
  | 'Video'
  | 'LLM'
  | 'Image-to-Video'
  | 'Storage'
  | 'Payment'

type AdminProviderDefinition = {
  providerId: string
  displayName: string
  capability: AdminProviderCapability[]
  category: string
  envKeys: string[]
  optionalEnvKeys?: string[]
  nodeType: string
  pricingProviderId?: string
  setupHint: string
}

type AdminProviderAccountRow = {
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
  available: boolean
  availabilityStatus: AdminProviderAvailabilityStatus
  estimatedCost: number
  creditsPerCall: number
  monthlyBudgetUsd: number | null
  currentMonthCostUsd: number
  budgetMonth: string | null
  missingEnv: string[]
  missingEnvKeys: string[]
  lastTestStatus: AdminProviderLastTestStatus
  lastCheckedAt: string | null
  canTest: boolean
  canToggle: boolean
  reason: string
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
    available: number
    unavailable: number
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
    optionalEnvKeys: ['OPENAI_TEXT_MODEL'],
    nodeType: 'text',
    setupHint: '配置 OPENAI_API_KEY；可选 OPENAI_TEXT_MODEL。',
  },
  {
    providerId: 'openai-image',
    displayName: 'OpenAI Image',
    capability: ['Image'],
    category: 'Image',
    envKeys: ['OPENAI_API_KEY'],
    optionalEnvKeys: ['OPENAI_IMAGE_MODEL'],
    nodeType: 'image',
    setupHint: '配置 OPENAI_API_KEY；可选 OPENAI_IMAGE_MODEL。',
  },
  {
    providerId: 'openrouter-text',
    displayName: 'OpenRouter Text',
    capability: ['Text', 'LLM'],
    category: 'LLM',
    envKeys: ['OPENROUTER_API_KEY'],
    nodeType: 'text',
    pricingProviderId: 'openrouter',
    setupHint: '配置 OPENROUTER_API_KEY。',
  },
  {
    providerId: 'fal-image',
    displayName: 'fal.ai Image',
    capability: ['Image'],
    category: 'Image',
    envKeys: ['FAL_KEY'],
    nodeType: 'image',
    pricingProviderId: 'fal',
    setupHint: '配置 FAL_KEY。',
  },
  {
    providerId: 'fal-video',
    displayName: 'fal.ai Video',
    capability: ['Video', 'Image-to-Video'],
    category: 'Video',
    envKeys: ['FAL_KEY'],
    nodeType: 'video',
    pricingProviderId: 'fal',
    setupHint: '配置 FAL_KEY。',
  },
  {
    providerId: 'replicate-image',
    displayName: 'Replicate Image',
    capability: ['Image'],
    category: 'Image',
    envKeys: ['REPLICATE_API_TOKEN'],
    nodeType: 'image',
    pricingProviderId: 'replicate',
    setupHint: '配置 REPLICATE_API_TOKEN。',
  },
  {
    providerId: 'replicate-video',
    displayName: 'Replicate Video',
    capability: ['Video', 'Image-to-Video'],
    category: 'Video',
    envKeys: ['REPLICATE_API_TOKEN'],
    nodeType: 'video',
    pricingProviderId: 'replicate',
    setupHint: '配置 REPLICATE_API_TOKEN。',
  },
  {
    providerId: 'creator-video-gateway',
    displayName: 'Creator Video Gateway',
    capability: ['Video', 'Image-to-Video'],
    category: 'Video',
    envKeys: ['CREATOR_VIDEO_GATEWAY_ENDPOINT'],
    optionalEnvKeys: ['CREATOR_VIDEO_GATEWAY_API_KEY'],
    nodeType: 'video',
    setupHint: '配置 CREATOR_VIDEO_GATEWAY_ENDPOINT；可选 CREATOR_VIDEO_GATEWAY_API_KEY。',
  },
  {
    providerId: 'custom-video-gateway',
    displayName: 'Custom Video Gateway',
    capability: ['Video', 'Image-to-Video'],
    category: 'Video',
    envKeys: ['CUSTOM_VIDEO_PROVIDER_ENDPOINT'],
    optionalEnvKeys: ['CUSTOM_VIDEO_PROVIDER_API_KEY'],
    nodeType: 'video',
    setupHint: '配置 CUSTOM_VIDEO_PROVIDER_ENDPOINT；可选 CUSTOM_VIDEO_PROVIDER_API_KEY。',
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
  },
  {
    providerId: 'alipay',
    displayName: 'Alipay',
    capability: ['Payment'],
    category: 'Payment',
    envKeys: ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY', 'ALIPAY_GATEWAY'],
    nodeType: 'payment',
    setupHint: '配置支付宝应用 ID、应用私钥、支付宝公钥和网关。',
  },
  {
    providerId: 'wechatpay',
    displayName: 'WeChat Pay',
    capability: ['Payment'],
    category: 'Payment',
    envKeys: ['WECHAT_PAY_APP_ID', 'WECHAT_PAY_MCH_ID', 'WECHAT_PAY_API_V3_KEY'],
    nodeType: 'payment',
    setupHint: '配置微信支付应用 ID、商户号和 API v3 key。',
  },
]

export function getAdminProviderDefinition(providerId: string) {
  return ADMIN_PROVIDER_REGISTRY.find((provider) => provider.providerId === providerId) ?? null
}

async function getProviderAccountMap() {
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
    return {
      accountMap: new Map(rows.map((row) => [row.providerId, row])),
      errorCode: undefined,
      message: undefined,
    }
  } catch (error) {
    if (isProviderGatewaySchemaMissing(error)) {
      return {
        accountMap: new Map<string, AdminProviderAccountRow>(),
        errorCode: PROVIDER_GATEWAY_SCHEMA_MISSING_CODE,
        message: PROVIDER_GATEWAY_SCHEMA_MISSING_MESSAGE,
      }
    }
    console.error('[admin/providers/status] lightweight account read failed', error)
    return {
      accountMap: new Map<string, AdminProviderAccountRow>(),
      errorCode: 'PROVIDER_ACCOUNT_READ_SKIPPED',
      message: 'Provider 账户状态读取失败，已降级为环境变量轻量诊断。',
    }
  }
}

export async function buildProviderManagementStatus(): Promise<ProviderManagementResult> {
  const { accountMap, errorCode, message } = await getProviderAccountMap()
  const providers = ADMIN_PROVIDER_REGISTRY.map((definition) => toProviderStatusRow(definition, accountMap.get(definition.providerId)))
  const summary = providers.reduce<ProviderManagementResult['summary']>((acc, provider) => {
    acc.total += 1
    if (provider.status === 'configured') acc.configured += 1
    if (provider.status === 'not-configured') acc.notConfigured += 1
    if (provider.status === 'error') acc.error += 1
    if (provider.available) acc.available += 1
    if (provider.available) acc.enabled += 1
    if (provider.configured && !provider.enabled) acc.disabled += 1
    if (!provider.configured) acc.unavailable += 1
    return acc
  }, { total: 0, configured: 0, notConfigured: 0, error: 0, enabled: 0, disabled: 0, available: 0, unavailable: 0 })

  return {
    providers,
    summary,
    categories: [...new Set(providers.map((provider) => provider.category))],
    ...(errorCode ? { errorCode, message } : {}),
  }
}

export async function setProviderEnabled(providerId: string, enabled: boolean) {
  const definition = getAdminProviderDefinition(providerId)
  if (!definition) {
    return { ok: false, status: 404, body: { success: false, errorCode: 'PROVIDER_NOT_FOUND', message: `Unknown providerId: ${providerId}` } }
  }

  const envCheck = checkEnvKeys(definition.envKeys)
  if (!envCheck.configured) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        message: '缺少环境变量，不能启用该 Provider',
        missingEnv: envCheck.missing,
        missingEnvKeys: envCheck.missing,
      },
    }
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
        available: account.isActive,
        availabilityStatus: account.isActive ? 'available' : 'disabled',
        canToggle: true,
        reason: account.isActive ? '可用' : '已停用',
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
    return {
      ok: false,
      status: 'not-configured' as const,
      message: `Missing environment variables: ${envCheck.missing.join(', ')}`,
      missingEnvKeys: envCheck.missing,
      checkedAt: new Date().toISOString(),
      mode: 'env-only',
    }
  }

  return {
    ok: true,
    status: 'configured' as const,
    message: 'Lightweight environment check passed. No generation, payment, credit, or upload call was made.',
    missingEnvKeys: [],
    checkedAt: new Date().toISOString(),
    mode: 'env-only',
  }
}

function toProviderStatusRow(definition: AdminProviderDefinition, account?: AdminProviderAccountRow): AdminProviderStatusRow {
  const envCheck = checkEnvKeys(definition.envKeys)
  const pricing = getGatewayPricing(definition.pricingProviderId ?? definition.providerId, definition.nodeType)
  const configured = envCheck.configured
  const enabled = configured ? account?.isActive ?? true : false
  const available = configured && enabled
  const status: AdminProviderStatus = envCheck.configured ? 'configured' : 'not-configured'
  const availabilityStatus: AdminProviderAvailabilityStatus = configured ? (enabled ? 'available' : 'disabled') : 'not-configured'
  const reason = configured ? (enabled ? '可用' : '已停用') : `缺少环境变量：${envCheck.missing.join(', ')}`
  return {
    providerId: definition.providerId,
    displayName: account?.displayName || definition.displayName,
    capability: definition.capability,
    category: definition.category,
    envKey: definition.envKeys.join(', '),
    envKeys: definition.envKeys,
    optionalEnvKeys: definition.optionalEnvKeys ?? [],
    status,
    configured,
    enabled,
    available,
    availabilityStatus,
    estimatedCost: pricing.estimatedCostUsd,
    creditsPerCall: pricing.creditsPerCall,
    monthlyBudgetUsd: account?.monthlyBudgetUsd != null ? Number(account.monthlyBudgetUsd) : null,
    currentMonthCostUsd: account?.currentMonthCostUsd != null ? Number(account.currentMonthCostUsd) : 0,
    budgetMonth: account?.budgetMonth ?? null,
    missingEnv: envCheck.missing,
    missingEnvKeys: envCheck.missing,
    lastTestStatus: account?.lastCheckedAt ? (envCheck.configured ? 'passed' : 'failed') : 'untested',
    lastCheckedAt: account?.lastCheckedAt ? account.lastCheckedAt.toISOString() : null,
    canTest: true,
    canToggle: configured,
    reason,
    setupHint: definition.setupHint,
  }
}
