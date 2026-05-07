import { db } from '@/lib/db'
import { getGatewayPricing } from '@/lib/gateway/pricing'
import { generateDeepSeekText } from '@/lib/providers/china/deepseek'
import { generateKimiText } from '@/lib/providers/china/kimi'
import { testChinaProviderConnection } from '@/lib/providers/china'
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
  | 'Reasoning'
  | 'Image-to-Video'
  | 'Image Understanding'
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
  defaultModel?: string
  modelEnvKey?: string
  defaultBaseUrl?: string
  baseUrlEnvKey?: string
  creditsPerCall?: number
  estimatedCostUsd?: number
  testMode?: 'env-only'
  providerFamily?: 'china-ai'
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
  model: string
  defaultModel: string | null
  baseUrl: string | null
  defaultBaseUrl: string | null
  testMode: 'env-only'
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
  {
    providerId: 'deepseek-text',
    displayName: 'DeepSeek V4 Flash',
    capability: ['Text', 'LLM'],
    category: 'China',
    envKeys: ['DEEPSEEK_API_KEY'],
    optionalEnvKeys: ['DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL_TEXT'],
    nodeType: 'text',
    defaultModel: 'deepseek-v4-flash',
    modelEnvKey: 'DEEPSEEK_MODEL_TEXT',
    defaultBaseUrl: 'https://api.deepseek.com',
    baseUrlEnvKey: 'DEEPSEEK_BASE_URL',
    creditsPerCall: 10,
    estimatedCostUsd: 0.002,
    testMode: 'env-only',
    providerFamily: 'china-ai',
    setupHint: '配置 DEEPSEEK_API_KEY；可选 DEEPSEEK_BASE_URL 和 DEEPSEEK_MODEL_TEXT。',
  },
  {
    providerId: 'deepseek-reasoner',
    displayName: 'DeepSeek V4 Pro',
    capability: ['Text', 'LLM', 'Reasoning'],
    category: 'China',
    envKeys: ['DEEPSEEK_API_KEY'],
    optionalEnvKeys: ['DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL_REASONER'],
    nodeType: 'text',
    defaultModel: 'deepseek-v4-pro',
    modelEnvKey: 'DEEPSEEK_MODEL_REASONER',
    defaultBaseUrl: 'https://api.deepseek.com',
    baseUrlEnvKey: 'DEEPSEEK_BASE_URL',
    creditsPerCall: 30,
    estimatedCostUsd: 0.006,
    testMode: 'env-only',
    providerFamily: 'china-ai',
    setupHint: '配置 DEEPSEEK_API_KEY；可选 DEEPSEEK_BASE_URL 和 DEEPSEEK_MODEL_REASONER。',
  },
  {
    providerId: 'kimi-text',
    displayName: 'Kimi K2.6',
    capability: ['Text', 'LLM'],
    category: 'China',
    envKeys: ['MOONSHOT_API_KEY'],
    optionalEnvKeys: ['MOONSHOT_BASE_URL', 'KIMI_MODEL_TEXT'],
    nodeType: 'text',
    defaultModel: 'kimi-k2.6',
    modelEnvKey: 'KIMI_MODEL_TEXT',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    baseUrlEnvKey: 'MOONSHOT_BASE_URL',
    creditsPerCall: 15,
    estimatedCostUsd: 0.003,
    testMode: 'env-only',
    providerFamily: 'china-ai',
    setupHint: '配置 MOONSHOT_API_KEY；可选 MOONSHOT_BASE_URL 和 KIMI_MODEL_TEXT。',
  },
  {
    providerId: 'kimi-multimodal',
    displayName: 'Kimi K2.6 Multimodal',
    capability: ['Text', 'LLM', 'Image Understanding'],
    category: 'China',
    envKeys: ['MOONSHOT_API_KEY'],
    optionalEnvKeys: ['MOONSHOT_BASE_URL', 'KIMI_MODEL_MULTIMODAL'],
    nodeType: 'text',
    defaultModel: 'kimi-k2.6',
    modelEnvKey: 'KIMI_MODEL_MULTIMODAL',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    baseUrlEnvKey: 'MOONSHOT_BASE_URL',
    creditsPerCall: 25,
    estimatedCostUsd: 0.005,
    testMode: 'env-only',
    providerFamily: 'china-ai',
    setupHint: '配置 MOONSHOT_API_KEY；可选 MOONSHOT_BASE_URL 和 KIMI_MODEL_MULTIMODAL。',
  },
  {
    providerId: 'kling-video',
    displayName: 'Kling 3.0 Video',
    capability: ['Video'],
    category: 'China',
    envKeys: ['KLING_ACCESS_KEY', 'KLING_SECRET_KEY'],
    optionalEnvKeys: ['KLING_BASE_URL', 'KLING_MODEL_VIDEO'],
    nodeType: 'video',
    defaultModel: 'kling-v3',
    modelEnvKey: 'KLING_MODEL_VIDEO',
    baseUrlEnvKey: 'KLING_BASE_URL',
    creditsPerCall: 200,
    estimatedCostUsd: 0.05,
    testMode: 'env-only',
    providerFamily: 'china-ai',
    setupHint: '配置 KLING_ACCESS_KEY 和 KLING_SECRET_KEY；可选 KLING_BASE_URL 和 KLING_MODEL_VIDEO。',
  },
  {
    providerId: 'kling-image',
    displayName: 'Kling 3.0 Image',
    capability: ['Image'],
    category: 'China',
    envKeys: ['KLING_ACCESS_KEY', 'KLING_SECRET_KEY'],
    optionalEnvKeys: ['KLING_BASE_URL', 'KLING_MODEL_IMAGE'],
    nodeType: 'image',
    defaultModel: 'kling-image-v3',
    modelEnvKey: 'KLING_MODEL_IMAGE',
    baseUrlEnvKey: 'KLING_BASE_URL',
    creditsPerCall: 40,
    estimatedCostUsd: 0.005,
    testMode: 'env-only',
    providerFamily: 'china-ai',
    setupHint: '配置 KLING_ACCESS_KEY 和 KLING_SECRET_KEY；可选 KLING_BASE_URL 和 KLING_MODEL_IMAGE。',
  },
  {
    providerId: 'kling-image-to-video',
    displayName: 'Kling 3.0 Image-to-Video',
    capability: ['Image-to-Video', 'Video'],
    category: 'China',
    envKeys: ['KLING_ACCESS_KEY', 'KLING_SECRET_KEY'],
    optionalEnvKeys: ['KLING_BASE_URL', 'KLING_MODEL_I2V'],
    nodeType: 'video',
    defaultModel: 'kling-i2v-v3',
    modelEnvKey: 'KLING_MODEL_I2V',
    baseUrlEnvKey: 'KLING_BASE_URL',
    creditsPerCall: 220,
    estimatedCostUsd: 0.055,
    testMode: 'env-only',
    providerFamily: 'china-ai',
    setupHint: '配置 KLING_ACCESS_KEY 和 KLING_SECRET_KEY；可选 KLING_BASE_URL 和 KLING_MODEL_I2V。',
  },
  {
    providerId: 'volcengine-seedance-video',
    displayName: 'Volcengine Seedance 2.0 Video',
    capability: ['Video'],
    category: 'China',
    envKeys: ['VOLCENGINE_ACCESS_KEY_ID', 'VOLCENGINE_SECRET_ACCESS_KEY'],
    optionalEnvKeys: ['VOLCENGINE_REGION', 'VOLCENGINE_ARK_BASE_URL', 'VOLCENGINE_SEEDANCE_MODEL'],
    nodeType: 'video',
    defaultModel: 'seedance-2-0',
    modelEnvKey: 'VOLCENGINE_SEEDANCE_MODEL',
    baseUrlEnvKey: 'VOLCENGINE_ARK_BASE_URL',
    creditsPerCall: 200,
    estimatedCostUsd: 0.05,
    testMode: 'env-only',
    providerFamily: 'china-ai',
    setupHint: '配置 VOLCENGINE_ACCESS_KEY_ID 和 VOLCENGINE_SECRET_ACCESS_KEY；可选 VOLCENGINE_REGION、VOLCENGINE_ARK_BASE_URL 和 VOLCENGINE_SEEDANCE_MODEL。',
  },
  {
    providerId: 'volcengine-seedream-image',
    displayName: 'Volcengine Seedream 5.0 Image',
    capability: ['Image'],
    category: 'China',
    envKeys: ['VOLCENGINE_ACCESS_KEY_ID', 'VOLCENGINE_SECRET_ACCESS_KEY'],
    optionalEnvKeys: ['VOLCENGINE_REGION', 'VOLCENGINE_ARK_BASE_URL', 'VOLCENGINE_SEEDREAM_MODEL'],
    nodeType: 'image',
    defaultModel: 'seedream-5-0-lite',
    modelEnvKey: 'VOLCENGINE_SEEDREAM_MODEL',
    baseUrlEnvKey: 'VOLCENGINE_ARK_BASE_URL',
    creditsPerCall: 40,
    estimatedCostUsd: 0.005,
    testMode: 'env-only',
    providerFamily: 'china-ai',
    setupHint: '配置 VOLCENGINE_ACCESS_KEY_ID 和 VOLCENGINE_SECRET_ACCESS_KEY；可选 VOLCENGINE_REGION、VOLCENGINE_ARK_BASE_URL 和 VOLCENGINE_SEEDREAM_MODEL。',
  },
  {
    providerId: 'jimeng-image',
    displayName: 'Jimeng Image 4.0',
    capability: ['Image'],
    category: 'China',
    envKeys: ['JIMENG_ACCESS_KEY_ID', 'JIMENG_SECRET_ACCESS_KEY'],
    optionalEnvKeys: ['JIMENG_BASE_URL', 'JIMENG_MODEL_IMAGE'],
    nodeType: 'image',
    defaultModel: 'jimeng-image-4-0',
    modelEnvKey: 'JIMENG_MODEL_IMAGE',
    baseUrlEnvKey: 'JIMENG_BASE_URL',
    creditsPerCall: 40,
    estimatedCostUsd: 0.005,
    testMode: 'env-only',
    providerFamily: 'china-ai',
    setupHint: '配置 JIMENG_ACCESS_KEY_ID 和 JIMENG_SECRET_ACCESS_KEY；可选 JIMENG_BASE_URL 和 JIMENG_MODEL_IMAGE。',
  },
  {
    providerId: 'jimeng-video',
    displayName: 'Jimeng Video 3.0 Pro',
    capability: ['Video', 'Image-to-Video'],
    category: 'China',
    envKeys: ['JIMENG_ACCESS_KEY_ID', 'JIMENG_SECRET_ACCESS_KEY'],
    optionalEnvKeys: ['JIMENG_BASE_URL', 'JIMENG_MODEL_VIDEO'],
    nodeType: 'video',
    defaultModel: 'jimeng-video-3-0-pro',
    modelEnvKey: 'JIMENG_MODEL_VIDEO',
    baseUrlEnvKey: 'JIMENG_BASE_URL',
    creditsPerCall: 220,
    estimatedCostUsd: 0.055,
    testMode: 'env-only',
    providerFamily: 'china-ai',
    setupHint: '配置 JIMENG_ACCESS_KEY_ID 和 JIMENG_SECRET_ACCESS_KEY；可选 JIMENG_BASE_URL 和 JIMENG_MODEL_VIDEO。',
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

type AdminProviderTestMode = 'env-only' | 'text-ping'

export async function testProviderConnection(providerId: string, mode: AdminProviderTestMode = 'env-only') {
  const definition = getAdminProviderDefinition(providerId)
  if (!definition) {
    return {
      ok: false,
      status: 'error' as const,
      errorCode: 'PROVIDER_NOT_FOUND',
      message: `Unknown providerId: ${providerId}`,
      configured: false,
      missingEnv: [],
      missingEnvKeys: [],
      model: '',
      baseUrl: null,
      sample: '',
      checkedAt: new Date().toISOString(),
      mode,
      testMode: mode,
    }
  }

  const chinaResult = definition.providerFamily === 'china-ai' ? testChinaProviderConnection(providerId) : null
  const envCheck = chinaResult
    ? { configured: chinaResult.configured, missing: chinaResult.missingEnv }
    : checkEnvKeys(definition.envKeys)
  const model = chinaResult?.model ?? getDefinitionModel(definition)
  const baseUrl = chinaResult?.baseUrl ?? getDefinitionBaseUrl(definition)
  if (!envCheck.configured) {
    return {
      ok: false,
      status: 'not-configured' as const,
      errorCode: 'PROVIDER_NOT_CONFIGURED',
      message: mode === 'text-ping'
        ? '缺少环境变量，不能测试'
        : `Missing environment variables: ${envCheck.missing.join(', ')}`,
      configured: false,
      missingEnv: envCheck.missing,
      missingEnvKeys: envCheck.missing,
      model,
      baseUrl,
      sample: '',
      checkedAt: new Date().toISOString(),
      mode,
      testMode: mode,
    }
  }

  if (mode === 'text-ping') {
    if (providerId !== 'kimi-text' && providerId !== 'kimi-multimodal' && providerId !== 'deepseek-text' && providerId !== 'deepseek-reasoner') {
      return {
        ok: false,
        status: 'error' as const,
        errorCode: 'PROVIDER_TEXT_PING_UNSUPPORTED',
        message: '该 Provider 暂不支持轻量文本测试。',
        configured: envCheck.configured,
        missingEnv: [],
        missingEnvKeys: [],
        model,
        baseUrl,
        sample: '',
        checkedAt: new Date().toISOString(),
        mode: 'text-ping' as const,
        testMode: 'text-ping' as const,
      }
    }

    const pingResult = providerId === 'kimi-text' || providerId === 'kimi-multimodal'
      ? await generateKimiText({ prompt: '请只回复 OK', maxTokens: 16, providerId })
      : await generateDeepSeekText({ prompt: '请只回复 OK', maxTokens: 16, providerId })

    return {
      ok: pingResult.success,
      status: pingResult.success ? 'configured' as const : 'error' as const,
      errorCode: pingResult.success ? undefined : 'PROVIDER_TEXT_PING_FAILED',
      message: pingResult.success ? '轻量文本测试通过。' : '轻量文本测试失败',
      configured: true,
      missingEnv: [],
      missingEnvKeys: [],
      model: pingResult.model ?? model,
      baseUrl,
      sample: pingResult.success ? pingResult.text : '',
      upstreamStatus: pingResult.success ? undefined : pingResult.upstreamStatus,
      upstreamMessage: pingResult.success ? undefined : pingResult.upstreamMessage ?? pingResult.message,
      rawCode: pingResult.success ? undefined : pingResult.rawCode ?? pingResult.errorCode,
      requestId: pingResult.success ? undefined : pingResult.requestId,
      checkedAt: new Date().toISOString(),
      mode: 'text-ping' as const,
      testMode: 'text-ping' as const,
    }
  }

  return {
    ok: true,
    status: 'configured' as const,
    message: 'Lightweight environment check passed. No generation, payment, credit, or upload call was made.',
    configured: true,
    missingEnv: [],
    missingEnvKeys: [],
    model,
    baseUrl,
    sample: '',
    checkedAt: new Date().toISOString(),
    mode: 'env-only',
    testMode: 'env-only',
  }
}

function toProviderStatusRow(definition: AdminProviderDefinition, account?: AdminProviderAccountRow): AdminProviderStatusRow {
  const envCheck = checkEnvKeys(definition.envKeys)
  const pricing = getGatewayPricing(definition.pricingProviderId ?? definition.providerId, definition.nodeType)
  const model = getDefinitionModel(definition)
  const baseUrl = getDefinitionBaseUrl(definition)
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
    model,
    defaultModel: definition.defaultModel ?? null,
    baseUrl,
    defaultBaseUrl: definition.defaultBaseUrl ?? null,
    testMode: definition.testMode ?? 'env-only',
    status,
    configured,
    enabled,
    available,
    availabilityStatus,
    estimatedCost: definition.estimatedCostUsd ?? pricing.estimatedCostUsd,
    creditsPerCall: definition.creditsPerCall ?? pricing.creditsPerCall,
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

function getDefinitionModel(definition: AdminProviderDefinition) {
  if (!definition.defaultModel) return ''
  return definition.modelEnvKey ? process.env[definition.modelEnvKey] || definition.defaultModel : definition.defaultModel
}

function getDefinitionBaseUrl(definition: AdminProviderDefinition) {
  if (!definition.baseUrlEnvKey && !definition.defaultBaseUrl) return null
  const value = definition.baseUrlEnvKey ? process.env[definition.baseUrlEnvKey] : undefined
  return value || definition.defaultBaseUrl || null
}
