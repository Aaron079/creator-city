/**
 * Provider Region Registry
 *
 * Thin façade over the canonical registry in @/lib/regions/registry.ts and
 * router.ts, exposing the helper functions the regional execution system needs.
 *
 * Rule: CN providers → Aliyun FC (cn-executor).
 *       Global providers → Vercel / global execution layer.
 *       Unknown providers → default to global with unknownProvider=true.
 */

import { normalizeProviderAdapterId } from '@/lib/regions/registry'
import {
  getCnProviders as _getCnProviders,
  getGlobalProviders as _getGlobalProviders,
  getProviderRegion as _getProviderRegion,
  resolveProviderExecutionRegion as _resolveProviderExecutionRegion,
} from '@/lib/regions/router'
import type { ProviderRegionConfig } from '@/lib/regions/types'

export { _getCnProviders as getCnProviders }
export { _getGlobalProviders as getGlobalProviders }
export { _getProviderRegion as getProviderRegion }
export { _resolveProviderExecutionRegion as resolveProviderExecutionRegion }

/** True when the provider's home region is China (must route to Aliyun FC). */
export function isCnProvider(provider?: string | null): boolean {
  return _getProviderRegion(provider) === 'cn'
}

/** True when the provider's home region is global (must route to Vercel/global executor). */
export function isGlobalProvider(provider?: string | null): boolean {
  return _getProviderRegion(provider) === 'global'
}

/**
 * Storage region for generated assets follows the provider's execution region.
 * CN providers write to Aliyun OSS (cn). Global providers write to global storage.
 */
export function resolveProviderStorageRegion(provider?: string | null): 'cn' | 'global' {
  return _getProviderRegion(provider)
}

/** Returns true when the provider ID is registered in the region registry. */
export function isKnownProvider(provider?: string | null): boolean {
  return normalizeProviderAdapterId(provider) !== null
}

/** All CN provider runtime IDs (flattened list). */
export function getCnProviderRuntimeIds(): string[] {
  return _getCnProviders().flatMap((p: ProviderRegionConfig) => p.runtimeProviderIds)
}

/** All global provider runtime IDs (flattened list). */
export function getGlobalProviderRuntimeIds(): string[] {
  return _getGlobalProviders().flatMap((p: ProviderRegionConfig) => p.runtimeProviderIds)
}
