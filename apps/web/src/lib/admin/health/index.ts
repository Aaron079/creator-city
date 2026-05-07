import { ADMIN_PROVIDER_REGISTRY } from '@/lib/admin/provider-management'
import { db } from '@/lib/db'
import type { CurrentUser } from '@/lib/auth/current-user'

export type HealthSectionStatus = 'ok' | 'warning' | 'error'

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
          status: 'warning',
          message: '检查超时，可能是数据库连接池繁忙',
          details: {
            section: name,
            timeoutMs: SECTION_TIMEOUT_MS,
            degraded: true,
            note: '数据库连接池繁忙，健康检查已降级为轻量检查。',
          },
        })
      }, SECTION_TIMEOUT_MS)
    })
    return await Promise.race([check(), timeout])
  } catch (error) {
    const message = safeMessage(error)
    return {
      status: isPoolBusyMessage(message) ? 'warning' : 'error',
      message: isPoolBusyMessage(message)
        ? '数据库连接池繁忙，健康检查已降级为轻量检查。'
        : `${name} 检查失败：${message}`,
      details: { error: message, degraded: isPoolBusyMessage(message) },
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
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
  const tables = await db.$queryRaw<Array<{ name: string; exists: boolean }>>`
    select required.table_name as name,
      to_regclass(format('%I.%I', 'public', required.table_name)) is not null as exists
    from (
      values
        ('Project'),
        ('CanvasWorkflow'),
        ('CanvasNode'),
        ('CanvasEdge'),
        ('CanvasComment'),
        ('Asset'),
        ('DeliveryShare'),
        ('DeliveryItem'),
        ('DeliveryComment'),
        ('UserCreditWallet'),
        ('CreditLedger'),
        ('PaymentOrder'),
        ('ProviderAccount'),
        ('ProviderCostLedger'),
        ('ProviderPricingRule')
    ) as required(table_name)
  `
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

async function checkCanvas(user: CurrentUser): Promise<HealthSection> {
  const project = await db.project.findFirst({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true },
  })
  if (!project) {
    return {
      status: 'warning',
      message: '当前用户暂无项目，无法检查最近项目画布。',
      details: { project: null, workflow: null, sampledNodeCount: 0, sampledEdgeCount: 0 },
    }
  }
  const workflow = await db.canvasWorkflow.findFirst({
    where: { projectId: project.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, updatedAt: true },
  })
  if (!workflow) {
    return {
      status: 'warning',
      message: '最近项目暂无 CanvasWorkflow。',
      details: { project, workflow: null, sampledNodeCount: 0, sampledEdgeCount: 0 },
    }
  }
  const nodes = await db.canvasNode.findMany({
    where: { workflowId: workflow.id },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, nodeId: true, kind: true, status: true, updatedAt: true },
  })
  const edges = await db.canvasEdge.findMany({
    where: { workflowId: workflow.id },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, edgeId: true, sourceNodeId: true, targetNodeId: true, updatedAt: true },
  })
  return {
    status: 'ok',
    message: `最近项目画布可读：抽样 ${nodes.length} nodes / ${edges.length} edges。`,
    details: { project, workflow, sampledNodeCount: nodes.length, sampledEdgeCount: edges.length, nodes, edges, countQueriesPerformed: false },
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
  const recentPaymentOrders = await db.paymentOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, provider: true, region: true, status: true, credits: true, amount: true, currency: true, createdAt: true, paidAt: true },
  })
  const recentCreditLedger = await db.creditLedger.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, type: true, delta: true, balance: true, refType: true, createdAt: true },
  })
  const alipayMissing = missingKeys(ALIPAY_KEYS)
  const wechatMissing = missingKeys(WECHAT_PAY_KEYS)
  const simulationConfigured = process.env.PAYMENT_SANDBOX_SIMULATION_ENABLED !== undefined
  const status: HealthSectionStatus = alipayMissing.length === 0 || wechatMissing.length === 0 || simulationConfigured ? 'ok' : 'warning'
  return {
    status,
    message: '支付环境和最近流水只读检查完成。',
    details: {
      alipay: { env: envStatus(ALIPAY_KEYS), missing: alipayMissing },
      wechatpay: { env: envStatus(WECHAT_PAY_KEYS), missing: wechatMissing },
      simulation: { key: 'PAYMENT_SANDBOX_SIMULATION_ENABLED', configured: simulationConfigured },
      recentPaymentOrderCount: recentPaymentOrders.length,
      recentCreditLedgerCount: recentCreditLedger.length,
      recentPaymentOrders,
      recentCreditLedger,
      countQueriesPerformed: false,
      createdOrder: false,
      calledPaymentProvider: false,
      simulatedPayment: false,
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
  const recentShares = await db.deliveryShare.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 3,
    select: { id: true, projectId: true, status: true, token: true, title: true, updatedAt: true },
  })
  const recentItems = await db.deliveryItem.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, shareId: true, type: true, title: true, createdAt: true },
  })
  const recentComments = await db.deliveryComment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, shareId: true, itemId: true, status: true, createdAt: true },
  })
  return {
    status: 'ok',
    message: `交付数据可读：最近 ${recentShares.length} shares / ${recentItems.length} items / ${recentComments.length} comments。`,
    details: {
      recentShareCount: recentShares.length,
      recentItemCount: recentItems.length,
      recentCommentCount: recentComments.length,
      recentShares: recentShares.map((share) => ({ ...share, hasToken: Boolean(share.token) })),
      recentItems,
      recentComments,
      countQueriesPerformed: false,
      openedPublicLink: false,
      createdShare: false,
    },
  }
}

async function checkComments(): Promise<HealthSection> {
  const canvasComments = await db.canvasComment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, projectId: true, workflowId: true, status: true, createdAt: true },
  })
  const deliveryComments = await db.deliveryComment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, shareId: true, itemId: true, status: true, createdAt: true },
  })
  return {
    status: 'ok',
    message: `评论数据可读：最近 Canvas ${canvasComments.length} / Delivery ${deliveryComments.length}。`,
    details: {
      recentCanvasCommentCount: canvasComments.length,
      recentDeliveryCommentCount: deliveryComments.length,
      canvasComments,
      deliveryComments,
      countQueriesPerformed: false,
      createdComment: false,
    },
  }
}

export async function buildAdminHealth(user: CurrentUser): Promise<AdminHealthResponse> {
  const checkedAt = new Date().toISOString()
  const sections = {} as AdminHealthResponse['sections']

  sections.auth = await safeSection('auth', () => checkAuth(user))
  sections.database = await safeSection('database', checkDatabase)
  sections.projects = await safeSection('projects', () => checkProjects(user))
  sections.canvas = await safeSection('canvas', () => checkCanvas(user))
  sections.assets = await safeSection('assets', () => checkAssets(user))
  sections.storage = await safeSection('storage', checkStorage)
  sections.payments = await safeSection('payments', checkPayments)
  sections.providers = await safeSection('providers', checkProviders)
  sections.delivery = await safeSection('delivery', checkDelivery)
  sections.comments = await safeSection('comments', checkComments)

  return { checkedAt, sections }
}
