import { buildProviderManagementStatus } from '@/lib/admin/provider-management'
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

function envStatus(keys: readonly string[]) {
  return keys.map((key) => ({ key, configured: Boolean(process.env[key]) }))
}

function missingKeys(keys: readonly string[]) {
  return keys.filter((key) => !process.env[key])
}

async function section<T extends HealthSection>(fallbackName: SectionName, check: () => Promise<T>): Promise<T | HealthSection> {
  try {
    return await check()
  } catch (error) {
    return {
      status: 'error',
      message: `${fallbackName} 检查失败：${safeMessage(error)}`,
      details: {},
    }
  }
}

async function checkDatabaseTable(name: string, count: () => Promise<number>) {
  try {
    const rowCount = await count()
    return { name, exists: true, count: rowCount }
  } catch (error) {
    return { name, exists: false, error: safeMessage(error) }
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
  const tables = await Promise.all([
    checkDatabaseTable('Project', () => db.project.count()),
    checkDatabaseTable('CanvasWorkflow', () => db.canvasWorkflow.count()),
    checkDatabaseTable('CanvasNode', () => db.canvasNode.count()),
    checkDatabaseTable('CanvasEdge', () => db.canvasEdge.count()),
    checkDatabaseTable('CanvasComment', () => db.canvasComment.count()),
    checkDatabaseTable('Asset', () => db.asset.count()),
    checkDatabaseTable('DeliveryShare', () => db.deliveryShare.count()),
    checkDatabaseTable('DeliveryItem', () => db.deliveryItem.count()),
    checkDatabaseTable('DeliveryComment', () => db.deliveryComment.count()),
    checkDatabaseTable('UserCreditWallet', () => db.userCreditWallet.count()),
    checkDatabaseTable('CreditLedger', () => db.creditLedger.count()),
    checkDatabaseTable('PaymentOrder', () => db.paymentOrder.count()),
    checkDatabaseTable('ProviderAccount', () => db.providerAccount.count()),
    checkDatabaseTable('ProviderCostLedger', () => db.providerCostLedger.count()),
    checkDatabaseTable('ProviderPricingRule', () => db.providerPricingRule.count()),
  ])
  const missing = tables.filter((table) => !table.exists)
  return {
    status: missing.length ? 'error' : 'ok',
    message: missing.length ? `${missing.length} 张关键表不可读。` : '关键数据表只读检查通过。',
    details: { tables, missingCount: missing.length },
  }
}

async function checkProjects(user: CurrentUser): Promise<HealthSection> {
  const [count, recent] = await Promise.all([
    db.project.count({ where: { ownerId: user.id } }),
    db.project.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, title: true, status: true, createdAt: true, updatedAt: true, lastOpenedAt: true },
    }),
  ])
  return {
    status: 'ok',
    message: `当前用户可只读查询 ${count} 个项目。`,
    details: { count, recent },
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
      details: { project: null, workflow: null, nodeCount: 0, edgeCount: 0 },
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
      details: { project, workflow: null, nodeCount: 0, edgeCount: 0 },
    }
  }
  const [nodeCount, edgeCount] = await Promise.all([
    db.canvasNode.count({ where: { workflowId: workflow.id } }),
    db.canvasEdge.count({ where: { workflowId: workflow.id } }),
  ])
  return {
    status: 'ok',
    message: `最近项目画布可读：${nodeCount} nodes / ${edgeCount} edges。`,
    details: { project, workflow, nodeCount, edgeCount },
  }
}

async function checkAssets(user: CurrentUser): Promise<HealthSection> {
  const [count, recent] = await Promise.all([
    db.asset.count({ where: { ownerId: user.id } }),
    db.asset.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, name: true, title: true, type: true, status: true, url: true, dataUrl: true, projectId: true, createdAt: true, updatedAt: true },
    }),
  ])
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
    message: `当前用户素材可读：${count} 条。`,
    details: { count, recent: mapped },
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
  const [paymentOrderCount, creditLedgerCount] = await Promise.all([
    db.paymentOrder.count(),
    db.creditLedger.count(),
  ])
  const alipayMissing = missingKeys(ALIPAY_KEYS)
  const wechatMissing = missingKeys(WECHAT_PAY_KEYS)
  const simulationConfigured = process.env.PAYMENT_SANDBOX_SIMULATION_ENABLED !== undefined
  const status: HealthSectionStatus = alipayMissing.length === 0 || wechatMissing.length === 0 || simulationConfigured ? 'ok' : 'warning'
  return {
    status,
    message: '支付环境和流水表只读检查完成。',
    details: {
      alipay: { env: envStatus(ALIPAY_KEYS), missing: alipayMissing },
      wechatpay: { env: envStatus(WECHAT_PAY_KEYS), missing: wechatMissing },
      simulation: { key: 'PAYMENT_SANDBOX_SIMULATION_ENABLED', configured: simulationConfigured },
      paymentOrderCount,
      creditLedgerCount,
      createdOrder: false,
      calledPaymentProvider: false,
      simulatedPayment: false,
    },
  }
}

async function checkProviders(): Promise<HealthSection> {
  const status = await buildProviderManagementStatus()
  const providers = status.providers
    .filter((provider) => (PROVIDER_IDS as readonly string[]).includes(provider.providerId))
    .map((provider) => ({
      providerId: provider.providerId,
      displayName: provider.displayName,
      status: provider.status,
      configured: provider.configured,
      enabled: provider.enabled,
      envKeys: provider.envKeys.map((key) => ({ key, configured: Boolean(process.env[key]) })),
      missingEnvKeys: provider.missingEnvKeys,
    }))
  const notConfigured = providers.filter((provider) => !provider.configured)
  return {
    status: status.errorCode ? 'warning' : notConfigured.length === providers.length ? 'warning' : 'ok',
    message: status.errorCode ?? `Provider 配置只读检查完成：${providers.length - notConfigured.length}/${providers.length} configured。`,
    details: {
      providers,
      summary: status.summary,
      providerGatewayWarning: status.message ?? null,
      generationCallPerformed: false,
      creditsConsumed: false,
    },
  }
}

async function checkDelivery(): Promise<HealthSection> {
  const [shareCount, itemCount, commentCount, recentShare] = await Promise.all([
    db.deliveryShare.count(),
    db.deliveryItem.count(),
    db.deliveryComment.count(),
    db.deliveryShare.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, projectId: true, status: true, token: true, title: true, updatedAt: true },
    }),
  ])
  return {
    status: 'ok',
    message: `交付数据可读：${shareCount} shares / ${itemCount} items / ${commentCount} comments。`,
    details: {
      shareCount,
      itemCount,
      commentCount,
      recentShare: recentShare ? { ...recentShare, hasToken: Boolean(recentShare.token) } : null,
      openedPublicLink: false,
      createdShare: false,
    },
  }
}

async function checkComments(): Promise<HealthSection> {
  const [canvasCommentCount, deliveryCommentCount] = await Promise.all([
    db.canvasComment.count(),
    db.deliveryComment.count(),
  ])
  return {
    status: 'ok',
    message: `评论数据可读：Canvas ${canvasCommentCount} / Delivery ${deliveryCommentCount}。`,
    details: {
      canvasCommentCount,
      deliveryCommentCount,
      createdComment: false,
    },
  }
}

export async function buildAdminHealth(user: CurrentUser): Promise<AdminHealthResponse> {
  const checkedAt = new Date().toISOString()
  const [
    auth,
    database,
    projects,
    canvas,
    assets,
    storage,
    payments,
    providers,
    delivery,
    comments,
  ] = await Promise.all([
    section('auth', () => checkAuth(user)),
    section('database', checkDatabase),
    section('projects', () => checkProjects(user)),
    section('canvas', () => checkCanvas(user)),
    section('assets', () => checkAssets(user)),
    section('storage', checkStorage),
    section('payments', checkPayments),
    section('providers', checkProviders),
    section('delivery', checkDelivery),
    section('comments', checkComments),
  ])

  return {
    checkedAt,
    sections: {
      auth,
      database,
      projects,
      canvas,
      assets,
      storage,
      payments,
      providers,
      delivery,
      comments,
    },
  }
}
