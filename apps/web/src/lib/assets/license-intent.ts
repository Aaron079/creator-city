export const LICENSE_MODES = [
  'private_only',
  'public_showcase',
  'reusable_noncommercial',
  'reusable_commercial',
  'marketplace_license',
] as const

export type LicenseMode = (typeof LICENSE_MODES)[number]

export interface LicenseIntent {
  mode: LicenseMode
  commercialUse: boolean
  derivativeAllowed: boolean
  attributionRequired: boolean
  updatedAt: string
  updatedBy: string
}

export interface LicenseModeConfig {
  label: string
  description: string
  badge: string
  commercialUse: boolean
  derivativeAllowed: boolean
  attributionRequired: boolean
  available: boolean
}

export const LICENSE_MODE_CONFIG: Record<LicenseMode, LicenseModeConfig> = {
  private_only: {
    label: '私有',
    description: '仅自己可见和使用。',
    badge: '🔒 私有',
    commercialUse: false,
    derivativeAllowed: false,
    attributionRequired: true,
    available: true,
  },
  public_showcase: {
    label: '公开展示',
    description: '公开展示，不允许他人复用或商用。',
    badge: '🌐 展示',
    commercialUse: false,
    derivativeAllowed: false,
    attributionRequired: true,
    available: true,
  },
  reusable_noncommercial: {
    label: '可复用 · 非商用',
    description: '允许他人作为创作参考或二创素材使用，但不得商用。',
    badge: '🔄 非商用',
    commercialUse: false,
    derivativeAllowed: true,
    attributionRequired: true,
    available: true,
  },
  reusable_commercial: {
    label: '可复用 · 可商用',
    description: '允许他人复用、二创和商用；当前仅为授权意图声明，不代表正式合同或交易。',
    badge: '💼 商用',
    commercialUse: true,
    derivativeAllowed: true,
    attributionRequired: true,
    available: true,
  },
  marketplace_license: {
    label: '市场授权 · 即将开放',
    description: '正式授权交易、定价和收益分成将在 Marketplace 阶段接入。',
    badge: '🏪 市场',
    commercialUse: true,
    derivativeAllowed: true,
    attributionRequired: true,
    available: false,
  },
}

export function isValidLicenseMode(mode: unknown): mode is LicenseMode {
  return LICENSE_MODES.includes(mode as LicenseMode)
}

export function deriveLicenseFields(mode: LicenseMode): Pick<LicenseIntent, 'commercialUse' | 'derivativeAllowed' | 'attributionRequired'> {
  const cfg = LICENSE_MODE_CONFIG[mode]
  return {
    commercialUse: cfg.commercialUse,
    derivativeAllowed: cfg.derivativeAllowed,
    attributionRequired: cfg.attributionRequired,
  }
}

export function getLicenseIntent(metadataJson: unknown): LicenseIntent | null {
  if (!metadataJson || typeof metadataJson !== 'object') return null
  const mj = metadataJson as Record<string, unknown>
  if (!mj.licenseIntent || typeof mj.licenseIntent !== 'object') return null
  const li = mj.licenseIntent as Record<string, unknown>
  if (!isValidLicenseMode(li.mode)) return null
  return li as unknown as LicenseIntent
}

export function licenseBadgeFromAsset(metadataJson: unknown, isPublic?: boolean | null): string {
  const intent = getLicenseIntent(metadataJson)
  if (intent) return LICENSE_MODE_CONFIG[intent.mode].badge
  return isPublic ? '🌐 展示' : '🔒 私有'
}
