export const PROVIDER_GATEWAY_SCHEMA_MISSING_CODE = 'DB_SCHEMA_MISSING'
export const PROVIDER_GATEWAY_SCHEMA_MISSING_MESSAGE = 'Provider Gateway 数据表未同步，请在 Supabase 执行 provider-gateway-setup.sql'

export function isProviderGatewaySchemaMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const maybeError = error as { code?: string; message?: string; meta?: unknown }
  if (maybeError.code === 'P2021' || maybeError.code === 'P2022') return true

  const text = [
    maybeError.message,
    typeof maybeError.meta === 'string' ? maybeError.meta : JSON.stringify(maybeError.meta ?? ''),
  ].join(' ')

  return /Provider(Account|PricingRule|CostLedger|TopUpLedger)/.test(text)
    && /(does not exist|not exist|relation|table|column|missing)/i.test(text)
}
