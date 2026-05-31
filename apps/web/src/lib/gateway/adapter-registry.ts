import type { GatewayProviderAdapter, GatewayNodeType } from './types'

/**
 * Gateway adapter registry — manages GatewayProviderAdapter instances.
 *
 * This is SEPARATE from lib/providers/registry.ts (which holds the existing
 * ProviderAdapter instances used by current generate routes).
 * This registry is the foundation for the Phase 3+ unified gateway.
 * No real adapters are registered here until Phase 3.
 */
export class GatewayAdapterRegistry {
  private readonly adapters = new Map<string, GatewayProviderAdapter>()

  /**
   * Register a GatewayProviderAdapter.
   * Throws if the same providerId is registered twice.
   */
  register(adapter: GatewayProviderAdapter): void {
    if (this.adapters.has(adapter.providerId)) {
      throw new Error(`[GatewayAdapterRegistry] Duplicate registration for providerId: "${adapter.providerId}"`)
    }
    this.adapters.set(adapter.providerId, adapter)
  }

  /** Returns the adapter for the given providerId, or null if not registered. */
  get(providerId: string): GatewayProviderAdapter | null {
    return this.adapters.get(providerId) ?? null
  }

  /** Returns true if an adapter is registered for the given providerId. */
  has(providerId: string): boolean {
    return this.adapters.has(providerId)
  }

  /** Returns all registered adapters. */
  list(): GatewayProviderAdapter[] {
    return Array.from(this.adapters.values())
  }

  /** Returns all adapters that support the given node type. */
  listByNodeType(nodeType: GatewayNodeType): GatewayProviderAdapter[] {
    return this.list().filter((a) => a.capabilities.nodeTypes.includes(nodeType))
  }

  /** Returns the number of registered adapters. */
  get size(): number {
    return this.adapters.size
  }
}

/**
 * Singleton registry for the running process.
 * Phase 3+ adapters will call gatewayRegistry.register() at import time.
 */
export const gatewayRegistry = new GatewayAdapterRegistry()
