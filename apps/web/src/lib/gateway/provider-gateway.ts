/**
 * Provider Gateway — Phase 2 skeleton.
 *
 * This class dispatches ProviderRequests to registered GatewayProviderAdapters.
 * Phase 2: skeleton only — no billing, no DB writes, no real provider calls.
 * Phase 3 will add billing (reserve/settle/release) before/after adapter.generate().
 * Phase 4 will wrap existing generate routes to call gateway.call() instead.
 */
import type { ProviderRequest, ProviderResponse } from './types'
import type { GatewayAdapterRegistry } from './adapter-registry'
import { normalizeProviderError } from './error-normalizer'

export class ProviderGateway {
  constructor(private readonly registry: GatewayAdapterRegistry) {}

  async call(request: ProviderRequest): Promise<ProviderResponse> {
    const adapter = this.registry.get(request.providerId)

    if (!adapter) {
      return {
        success: false,
        providerId: request.providerId,
        modelId: request.modelId,
        status: 'failed',
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        message: `Provider adapter not registered: "${request.providerId}". Register it via gatewayRegistry.register() in Phase 3.`,
      }
    }

    if (!adapter.capabilities.nodeTypes.includes(request.nodeType)) {
      return {
        success: false,
        providerId: request.providerId,
        modelId: request.modelId,
        status: 'failed',
        errorCode: 'PROVIDER_UNSUPPORTED_CAPABILITY',
        message: `Provider "${request.providerId}" does not support node type "${request.nodeType}". Supported: ${adapter.capabilities.nodeTypes.join(', ')}.`,
      }
    }

    try {
      return await adapter.generate(request)
    } catch (err) {
      const normalized = normalizeProviderError(err)
      return {
        success: false,
        providerId: request.providerId,
        modelId: request.modelId,
        status: 'failed',
        errorCode: normalized.errorCode,
        message: normalized.message,
        // Only expose raw error detail in development to avoid leaking provider internals.
        raw: process.env.NODE_ENV === 'development' ? err : undefined,
      }
    }
  }
}
