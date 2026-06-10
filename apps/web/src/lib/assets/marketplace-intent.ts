export const MARKETPLACE_INTENT_LICENSES = ['reusable_noncommercial', 'reusable_commercial'] as const
export type MarketplaceIntentLicense = (typeof MARKETPLACE_INTENT_LICENSES)[number]

export const MARKETPLACE_INTENT_STATUSES = ['draft', 'pending_review'] as const
export type MarketplaceIntentStatus = (typeof MARKETPLACE_INTENT_STATUSES)[number]

export interface MarketplaceIntent {
  wantsToList: boolean
  suggestedLicense?: MarketplaceIntentLicense
  suggestedPriceCredits?: number
  description?: string
  status: MarketplaceIntentStatus
  updatedAt: string
  updatedBy: string
}

export type MarketplaceIntentInput = {
  wantsToList: boolean
  suggestedLicense?: string | null
  suggestedPriceCredits?: number | null
  description?: string | null
}

export function isMarketplaceIntentLicense(v: unknown): v is MarketplaceIntentLicense {
  return MARKETPLACE_INTENT_LICENSES.includes(v as MarketplaceIntentLicense)
}

export function getMarketplaceIntent(metadataJson: unknown): MarketplaceIntent | null {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) return null
  const mj = metadataJson as Record<string, unknown>
  const mi = mj.marketplaceIntent
  if (!mi || typeof mi !== 'object' || Array.isArray(mi)) return null
  const obj = mi as Record<string, unknown>
  if (typeof obj.wantsToList !== 'boolean') return null
  return obj as unknown as MarketplaceIntent
}

export function validateMarketplaceIntentInput(input: unknown): { valid: boolean; error?: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, error: '无效的 marketplaceIntent 格式' }
  }
  const body = input as Record<string, unknown>

  if (typeof body.wantsToList !== 'boolean') {
    return { valid: false, error: 'wantsToList 必须是布尔值' }
  }

  if (body.wantsToList) {
    if (body.suggestedLicense !== undefined && body.suggestedLicense !== null) {
      if (!isMarketplaceIntentLicense(body.suggestedLicense)) {
        return { valid: false, error: 'suggestedLicense 只允许 reusable_noncommercial 或 reusable_commercial' }
      }
    }
    if (body.suggestedPriceCredits !== undefined && body.suggestedPriceCredits !== null) {
      const price = Number(body.suggestedPriceCredits)
      if (!Number.isInteger(price) || price < 0 || price > 999999) {
        return { valid: false, error: 'suggestedPriceCredits 必须是 0 到 999999 的整数' }
      }
    }
    if (body.description !== undefined && body.description !== null) {
      if (typeof body.description !== 'string') {
        return { valid: false, error: 'description 必须是字符串' }
      }
      if (body.description.length > 500) {
        return { valid: false, error: 'description 最多 500 字' }
      }
    }
  }

  return { valid: true }
}
