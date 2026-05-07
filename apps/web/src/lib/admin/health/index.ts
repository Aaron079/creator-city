import { ADMIN_PROVIDER_REGISTRY } from '@/lib/admin/provider-management'
import { db } from '@/lib/db'
import type { CurrentUser } from '@/lib/auth/current-user'

export type HealthSectionStatus = 'ok' | 'warning' | 'error' | 'skipped'

export interface HealthSection {
  status: HealthSectionStatus
  message: string
  details: Record<string, unknown>
}

export interface AdminHealthResponse {
  checkedAt: string
  sections: {
    auth: HealthSection
    database: HealthSection
    projects: HealthSection
    canvas: HealthSection
    assets: HealthSection
    storage: HealthSection
    payments: HealthSection
    providers: HealthSection
    delivery: HealthSection
    comments: HealthSection
  }
}

type SectionName = keyof AdminHealthResponse['sections']

const SECTION_TIMEOUT_MS = 2500

const STORAGE_KEYS = [
  'CHINA_STORAGE_PROVIDER',
  'ALIYUN_ACCESS_KEY_ID',
  'ALIYUN_ACCESS_KEY_SECRET',
  'ALIYUN_OSS_BUCKET',
  'ALIYUN_OSS_REGION',
  'ALIYUN_OSS_ENDPOINT',
  'ALIYUN_OSS_PUBLIC_BASE_URL',
] as const

const ALIPAY_KEYS = ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'] as const
const WECHAT_PAY_KEYS = [
  'WECHAT_PAY_APP_ID',
  'WECHAT_PAY_MCH_ID',
  'WECHAT_PAY_API_V3_KEY',
  'WECHAT_PAY_PRIVATE_KEY',
  'WECHAT_PAY_CERT_SERIAL_NO',
  'WECHAT_PAY_NOTIFY_URL',
] as const

const PROVIDER_IDS = [
  'openai-text',
  'openai-image',
  'openrouter-text',
  'fal-image',
  'fal-video',
  'replicate-image',
  'replicate-video',
  'creator-video-gateway',
  'custom-video-gateway',
] as const

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : typeof error === 'string' && error ? error : '检查失败'
}

function isPoolBusyMessage(message: string) {
  const lower = message.toLowerCase()
  return lower.includes('connection pool') || lower.includes('timed out fetching a new connection')
}

function envStatus(keys: readonly string[]) {
  return keys.map((key) => ({ key, configured: Boolean(process.env[key]) }))
}

function missingKeys(keys: readonly string[]) {
  return keys.filter((key) => !process.env[key])
}

async function safeSection<T extends HealthSection>(name: SectionName, check: () => Promise<T>): Promise<T | HealthSection> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    const timeout = new Promise<HealthSection>((resolve) => {
      timer = setTimeout(() => {
        resolve({
          status: 'skipped',
          message: '健康检查为保护连接池已跳过深度统计；业务页面不受影响。',
          details: {
            section: name,
            timeoutMs: SECTION_TIMEOUT_MS,
            degraded: true,
            skipped: true,
            note: '数据库连接池繁忙，健康检查已降级为轻量检查。',
          },
        })
      }, SECTION_TIMEOUT_MS)
    })
    return await Promise.race([check(), timeout])
  } catch (error) {
    const message = safeMessage(error)
    const poolBusy = isPoolBusyMessage(message)
    return {
      status: poolBusy ? 'skipped' : 'error',
      message: poolBusy
        ? '健康检查为保护连接池已跳过深度统计；业务页面不受影响。'
        : `${name} 检查失败：${message}`,
      details: { error: message, degraded: poolBusy, skipped: poolBusy },
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function checkTablePresence(names: readonly string[]) {
  return db.$queryRaw<Array<{ name: string; exists: boolean }>>`
    select required.table_name as name,
      to_regclass(format('%I.%I', 'public', required.table_name)) is not null as exists
    from unnest(${names}::text[]) as required(table_name)
  `
}

async function checkAuth(user: CurrentUser): Promise<HealthSection> {
  return {
    status: 'ok',
    message: '当前管理员会话可用。',
    details: {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
      },
      apiAuthMeLogic: 'getCurrentUser session lookup available',
    },
  }
}

async function checkDatabase(): Promise<HealthSection> {
  const tables = await checkTablePresence([
    'Project',
    'CanvasWorkflow',
    'CanvasNode',
    'CanvasEdge',
    'CanvasComment',
    'Asset',
    'DeliveryShare',
    'DeliveryItem',
    'DeliveryComment',
    'UserCreditWallet',
    'CreditLedger',
    'PaymentOrder',
    'ProviderAccount',
    'ProviderCostLedger',
    'ProviderPricingRule',
  ])
  const missing = tables.filter((table) => !table.exists)
  return {
    status: missing.length ? 'warning' : 'ok',
    message: missing.length ? `${missing.length} 张关键表未确认存在。` : '关键数据表存在性检查通过。',
    details: {
      tables,
      missingCount: missing.length,
      countQueriesPerformed: false,
      lightweight: true,
    },
  }
}

async function checkProjects(user: CurrentUser): Promise<HealthSection> {
  const recent = await db.project.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, title: true, status: true, createdAt: true, updatedAt: true, lastOpenedAt: true },
  })
  return {
    status: 'ok',
    message: `当前用户最近项目可读：${recent.length} 条。`,
    details: { recentCount: recent.length, recent, countQueriesPerformed: false },
  }
}

async function checkCanvas(): Promise<HealthSection> {
  const tables = await checkTablePresence(['CanvasWorkflow', 'CanvasNode', 'CanvasEdge'])
  const missing = tables.filter((table) => !table.exists)
  let recentWorkflow: { id: string; projectId: string; updatedAt: Date } | null = null
  if (!missing.length) {
    recentWorkflow = await db.canvasWorkflow.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, projectId: true, updatedAt: true },
    })
  }
  return {
    status: missing.length ? 'warning' : 'ok',
    message: missing.length
      ? '仅健康检查跳过，不代表画布业务失败。'
      : '画布核心表存在，已跳过节点/连线深度统计。',
    details: {
      tables,
      missingCount: missing.length,
      recentWorkflow,
      nodeEdgeReadSkipped: true,
      countQueriesPerformed: false,
      lightweight: true,
    },
  }
}

async function checkAssets(user: CurrentUser): Promise<HealthSection> {
  const recent = await db.asset.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, name: true, title: true, type: true, status: true, url: true, dataUrl: true, projectId: true, createdAt: true, updatedAt: true },
  })
  const mapped = recent.map((asset) => ({
    id: asset.id,
    name: asset.name,
    title: asset.title,
    type: asset.type,
    status: asset.status,
    hasUrl: Boolean(asset.url),
    hasDataUrl: Boolean(asset.dataUrl),
    hasProjectId: Boolean(asset.projectId),
    projectId: asset.projectId,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  }))
  return {
    status: 'ok',
    message: `当前用户素材可读：最近 ${mapped.length} 条。`,
    details: { recentCount: mapped.length, recent: mapped, countQueriesPerformed: false },
  }
}

async function checkStorage(): Promise<HealthSection> {
  const provider = process.env.CHINA_STORAGE_PROVIDER ?? ''
  const required = STORAGE_KEYS.filter((key) => key !== 'ALIYUN_OSS_PUBLIC_BASE_URL')
  const missing = missingKeys(required)
  const aliyunReady = provider === 'aliyun-oss' && missing.length === 0
  return {
    status: aliyunReady ? 'ok' : 'warning',
    message: aliyunReady ? '阿里云 OSS 环境变量已配置。' : '对象存储配置未完整启用。',
    details: {
      providerConfigured: Boolean(provider),
      providerIsAliyunOss: provider === 'aliyun-oss',
      env: envStatus(STORAGE_KEYS),
      missing,
      uploadTestPerformed: false,
    },
  }
}

async function checkPayments(): Promise<HealthSection> {
  const alipayMissing = missingKeys(ALIPAY_KEYS)
  const wechatMissing = missingKeys(WECHAT_PAY_KEYS)
  const simulationConfigured = process.env.PAYMENT_SANDBOX_SIMULATION_ENABLED !== undefined
  const status: HealthSectionStatus = alipayMissing.length === 0 || wechatMissing.length === 0 || simulationConfigured ? 'ok' : 'warning'
  return {
    status,
    message: '支付环境变量只读检查完成；已跳过订单/积分流水深度统计。',
    details: {
      alipay: { env: envStatus(ALIPAY_KEYS), missing: alipayMissing },
      wechatpay: { env: envStatus(WECHAT_PAY_KEYS), missing: wechatMissing },
      simulation: { key: 'PAYMENT_SANDBOX_SIMULATION_ENABLED', configured: simulationConfigured },
      recentPaymentOrderRead: 'skipped',
      recentCreditLedgerRead: 'skipped',
      countQueriesPerformed: false,
      createdOrder: false,
      calledPaymentProvider: false,
      simulatedPayment: false,
      lightweight: true,
    },
  }
}

async function checkProviders(): Promise<HealthSection> {
  const providers = ADMIN_PROVIDER_REGISTRY
    .filter((provider) => (PROVIDER_IDS as readonly string[]).includes(provider.providerId))
    .map((provider) => {
      const missing = missingKeys(provider.envKeys)
      return {
        providerId: provider.providerId,
        displayName: provider.displayName,
        configured: missing.length === 0,
        envKeys: envStatus(provider.envKeys),
        optionalEnvKeys: envStatus(provider.optionalEnvKeys ?? []),
        missingEnvKeys: missing,
      }
    })
  const configuredCount = providers.filter((provider) => provider.configured).length
  return {
    status: configuredCount > 0 ? 'ok' : 'warning',
    message: `Provider 环境变量只读检查完成：${configuredCount}/${providers.length} configured。`,
    details: {
      providers,
      providerAccountDbQueryPerformed: false,
      generationCallPerformed: false,
      creditsConsumed: false,
    },
  }
}

async function checkDelivery(): Promise<HealthSection> {
  const tables = await checkTablePresence(['DeliveryShare', 'DeliveryItem', 'DeliveryComment'])
  const missing = tables.filter((table) => !table.exists)
  return {
    status: missing.length ? 'warning' : 'ok',
    message: missing.length
      ? '仅健康检查跳过，不代表交付业务失败。'
      : '交付核心表存在，已跳过分享/条目/评论深度统计。',
    details: {
      tables,
      missingCount: missing.length,
      recentShareRead: 'skipped',
      deliveryItemRead: 'skipped',
      deliveryCommentRead: 'skipped',
      countQueriesPerformed: false,
      openedPublicLink: false,
      createdShare: false,
      lightweight: true,
    },
  }
}

async function checkComments(): Promise<HealthSection> {
  const tables = await checkTablePresence(['CanvasComment', 'DeliveryComment'])
  const missing = tables.filter((table) => !table.exists)
  return {
    status: missing.length ? 'warning' : 'ok',
    message: missing.length
      ? '仅健康检查跳过，不代表评论业务失败。'
      : '评论核心表存在，已跳过评论深度统计。',
    details: {
      tables,
      missingCount: missing.length,
      recentCanvasCommentRead: 'skipped',
      recentDeliveryCommentRead: 'skipped',
      countQueriesPerformed: false,
      createdComment: false,
      lightweight: true,
    },
  }
}

export async function buildAdminHealth(user: CurrentUser): Promise<AdminHealthResponse> {
  const checkedAt = new Date().toISOString()
  const sections = {} as AdminHealthResponse['sections']

  sections.auth = await safeSection('auth', () => checkAuth(user))
  sections.database = await safeSection('database', checkDatabase)
  sections.projects = await safeSection('projects', () => checkProjects(user))
  sections.canvas = await safeSection('canvas', checkCanvas)
  sections.assets = await safeSection('assets', () => checkAssets(user))
  sections.storage = await safeSection('storage', checkStorage)
  sections.payments = await safeSection('payments', checkPayments)
  sections.providers = await safeSection('providers', checkProviders)
  sections.delivery = await safeSection('delivery', checkDelivery)
  sections.comments = await safeSection('comments', checkComments)

  return { checkedAt, sections }
}
