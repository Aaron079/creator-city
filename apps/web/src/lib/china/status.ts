export type ChinaStatusLevel = 'configured' | 'not-configured' | 'warning'

export type ChinaDatabaseStatus = {
  status: 'china-db-configured' | 'overseas-db-active' | 'db-not-configured'
  activeEnv: 'DATABASE_URL_CN' | 'DATABASE_URL' | null
  chinaReady: boolean
  missing: string[]
  nextStep: string
}

export type ChinaStorageStatus = {
  provider: 'aliyun-oss' | 'tencent-cos' | 'unset'
  status: 'aliyun-oss-configured' | 'tencent-cos-configured' | 'storage-not-configured'
  configured: boolean
  missing: string[]
  nextStep: string
}

export type ChinaPaymentStatus = {
  status: 'configured' | 'not-configured'
  missing: string[]
  nextStep: string
}

export type ChinaComplianceStatus = {
  status: 'configured' | 'not-configured'
  missing: string[]
  nextStep: string
}

export type ChinaInfrastructureStatus = {
  database: ChinaDatabaseStatus
  storage: ChinaStorageStatus
  payments: {
    alipay: ChinaPaymentStatus
    wechatpay: ChinaPaymentStatus
  }
  compliance: {
    icp: ChinaComplianceStatus
    cdn: ChinaComplianceStatus
    kms: ChinaComplianceStatus
    logs: ChinaComplianceStatus
  }
  migration: {
    status: 'not-started' | 'ready-to-plan'
    documentPath: 'docs/china-infra-migration.md'
    nextStep: string
  }
}

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim())
}

function missing(names: string[]) {
  return names.filter((name) => !hasEnv(name))
}

function singleEnvStatus(envName: string, configuredStep: string, missingStep: string): ChinaComplianceStatus {
  const isConfigured = hasEnv(envName)
  return {
    status: isConfigured ? 'configured' : 'not-configured',
    missing: isConfigured ? [] : [envName],
    nextStep: isConfigured ? configuredStep : missingStep,
  }
}

function getDatabaseStatus(): ChinaDatabaseStatus {
  if (hasEnv('DATABASE_URL_CN')) {
    return {
      status: 'china-db-configured',
      activeEnv: 'DATABASE_URL_CN',
      chinaReady: true,
      missing: [],
      nextStep: '在预发环境验证 Prisma schema、用户、积分、项目和画布读写。',
    }
  }
  if (hasEnv('DATABASE_URL')) {
    return {
      status: 'overseas-db-active',
      activeEnv: 'DATABASE_URL',
      chinaReady: false,
      missing: ['DATABASE_URL_CN'],
      nextStep: '准备阿里云 RDS PostgreSQL 或腾讯云 PostgreSQL，并配置 DATABASE_URL_CN。',
    }
  }
  return {
    status: 'db-not-configured',
    activeEnv: null,
    chinaReady: false,
    missing: ['DATABASE_URL_CN', 'DATABASE_URL'],
    nextStep: '先配置数据库连接，再执行 schema 验证。',
  }
}

function getStorageStatus(): ChinaStorageStatus {
  const provider = process.env.CHINA_STORAGE_PROVIDER
  if (provider === 'aliyun-oss') {
    const required = ['ALIYUN_OSS_BUCKET', 'ALIYUN_OSS_REGION', 'ALIYUN_ACCESS_KEY_ID']
    const miss = missing(required)
    return {
      provider,
      status: miss.length === 0 ? 'aliyun-oss-configured' : 'storage-not-configured',
      configured: miss.length === 0,
      missing: miss,
      nextStep: miss.length === 0
        ? '接入签名上传和生成资产落盘前，先验证 bucket 权限和 CDN 域名。'
        : '补齐阿里云 OSS bucket、region 和 access key id。密钥只放在服务端环境变量。',
    }
  }
  if (provider === 'tencent-cos') {
    const required = ['TENCENT_COS_BUCKET', 'TENCENT_COS_REGION', 'TENCENT_SECRET_ID']
    const miss = missing(required)
    return {
      provider,
      status: miss.length === 0 ? 'tencent-cos-configured' : 'storage-not-configured',
      configured: miss.length === 0,
      missing: miss,
      nextStep: miss.length === 0
        ? '接入签名上传和生成资产落盘前，先验证 bucket 权限和 CDN 域名。'
        : '补齐腾讯云 COS bucket、region 和 secret id。密钥只放在服务端环境变量。',
    }
  }
  return {
    provider: 'unset',
    status: 'storage-not-configured',
    configured: false,
    missing: ['CHINA_STORAGE_PROVIDER'],
    nextStep: '设置 CHINA_STORAGE_PROVIDER 为 aliyun-oss 或 tencent-cos。',
  }
}

function getPaymentStatus(required: string[], configuredStep: string, missingStep: string): ChinaPaymentStatus {
  const miss = missing(required)
  return {
    status: miss.length === 0 ? 'configured' : 'not-configured',
    missing: miss,
    nextStep: miss.length === 0 ? configuredStep : missingStep,
  }
}

export function getChinaInfrastructureStatus(): ChinaInfrastructureStatus {
  const database = getDatabaseStatus()
  const storage = getStorageStatus()
  const alipay = getPaymentStatus(
    ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'],
    '接入支付宝 RSA2 验签和正式下单前，先完成沙箱/预发回调验证。',
    '补齐支付宝 app id、公私钥配置。不要在日志或前端暴露密钥。',
  )
  const wechatpay = getPaymentStatus(
    ['WECHAT_PAY_APP_ID', 'WECHAT_PAY_MCH_ID', 'WECHAT_PAY_API_V3_KEY', 'WECHAT_PAY_PRIVATE_KEY', 'WECHAT_PAY_CERT_SERIAL_NO'],
    '接入微信支付 v3 签名、验签和资源解密前，先完成沙箱/预发回调验证。',
    '补齐微信支付 app id、商户号、API v3 key、私钥和证书序列号。',
  )

  const coreReady = database.chinaReady
    && storage.configured
    && alipay.status === 'configured'
    && wechatpay.status === 'configured'

  return {
    database,
    storage,
    payments: { alipay, wechatpay },
    compliance: {
      icp: singleEnvStatus('ICP_BEIAN_NUMBER', '备案号已配置，继续核对域名和 CDN 回源。', '配置 ICP_BEIAN_NUMBER，并确认生产域名已备案。'),
      cdn: singleEnvStatus('CHINA_CDN_PROVIDER', 'CDN provider 已配置，继续验证回源、缓存和证书。', '配置 CHINA_CDN_PROVIDER，并绑定已备案域名。'),
      kms: singleEnvStatus('CHINA_KMS_PROVIDER', 'KMS / Secret Manager 已配置，继续迁移生产密钥。', '配置 CHINA_KMS_PROVIDER，并把支付和存储密钥放入密钥管理。'),
      logs: singleEnvStatus('CHINA_LOG_PROVIDER', '日志服务已配置，继续核对脱敏和留存策略。', '配置 CHINA_LOG_PROVIDER，避免敏感数据进入海外日志。'),
    },
    migration: {
      status: coreReady ? 'ready-to-plan' : 'not-started',
      documentPath: 'docs/china-infra-migration.md',
      nextStep: coreReady
        ? '进入预发迁移演练，按文档验证用户、积分、项目、画布和 Provider Gateway。'
        : '先补齐数据库、对象存储、支付、CDN、备案、KMS 和日志配置。',
    },
  }
}
