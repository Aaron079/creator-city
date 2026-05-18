/**
 * Regional Executor Gateway
 *
 * Canonical entry point for resolving which executor to use for a given provider.
 * Re-exports and extends executor-gateway.ts with the full regional shape.
 *
 * Routing rules:
 *   cn provider  → executorKind=aliyun_fc  → CREATOR_CN_API_BASE_URL (Aliyun FC)
 *   global provider → executorKind=vercel  → Vercel runtime (local execution)
 *   unknown provider → default global, unknownProvider=true (for diagnostics)
 *
 * Error codes produced here:
 *   executor_region_missing — cn provider but CREATOR_CN_API_BASE_URL not set
 */

export type {
  ExecutorResolution,
  ExecutorInput,
  ExecutorResult,
  ExecutorStatus,
} from './executor-gateway'

export {
  getExecutorForProvider,
  getExecutorStatus,
  startImageGenerationViaRegion,
  getImageGenerationStatusViaRegion,
  executeVideoGenerationViaRegion,
  executeImageGenerationViaRegion,
} from './executor-gateway'

import type { ExecutorKind } from '@/lib/regions/types'
import type { ExecutorResolution } from './executor-gateway'

/**
 * Structured diagnostic payload for a provider resolution.
 * Intended for logging, error responses, and P0 debug output.
 */
export type RegionalExecutorDiagnostics = {
  providerId: string | null | undefined
  providerRegion: 'cn' | 'global'
  executionRegion: 'cn' | 'global'
  storageRegion: 'cn' | 'global'
  executorKind: ExecutorKind
  configured: boolean
  errorCode?: string
  unknownProvider: boolean
  cnExecutorConfigured: boolean
  globalExecutorConfigured: boolean
}

export function toExecutorDiagnostics(resolution: ExecutorResolution): RegionalExecutorDiagnostics {
  return {
    providerId: resolution.providerId,
    providerRegion: resolution.providerRegion,
    executionRegion: resolution.executionRegion,
    storageRegion: resolution.storageRegion,
    executorKind: resolution.executorKind,
    configured: resolution.executor !== 'none',
    errorCode: resolution.errorCode,
    unknownProvider: resolution.unknownProvider,
    cnExecutorConfigured: resolution.cnBaseUrlConfigured,
    globalExecutorConfigured: resolution.globalConfigured,
  }
}
