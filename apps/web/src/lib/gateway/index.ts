// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  GatewayNodeType,
  GatewayRegion,
  GatewayJobStatus,
  GatewayAsset,
  ProviderRequest,
  ProviderResponse,
  GatewayErrorCode,
  ProviderAdapterCapability,
  GatewayProviderAdapter,
} from './types'

// ── Error normalizer ──────────────────────────────────────────────────────────
export { normalizeProviderError } from './error-normalizer'
export type { NormalizedProviderError } from './error-normalizer'

// ── Adapter registry ──────────────────────────────────────────────────────────
export { GatewayAdapterRegistry, gatewayRegistry } from './adapter-registry'

// ── Gateway ───────────────────────────────────────────────────────────────────
export { ProviderGateway } from './provider-gateway'

// ── Existing gateway utilities (pre-Phase 2) ──────────────────────────────────
export { gatewayGenerate } from './generate'
export { getGatewayPricing, getAllGatewayPricing } from './pricing'
export type { GatewayPricingRule } from './pricing'
export { getGatewayAccountStatuses, getGatewayAccountStatus } from './accounts'
export { recordProviderCost } from './cost-recorder'
export { isProviderGatewaySchemaMissing } from './schema-errors'
