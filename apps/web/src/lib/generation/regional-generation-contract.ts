/**
 * Creator City Regional Generation Contract
 *
 * Defines the request/response shapes for the regional execution system.
 * All generation routes must populate these fields so the frontend, admin debug,
 * and asset persistence code can reason about where work happened.
 */

import type { ExecutorKind } from '@/lib/regions/types'

export type { ExecutorKind }

/**
 * Canonical request shape passed to an executor (cn-executor or Vercel handler).
 * Created by the API route after resolving the executor via getExecutorForProvider().
 */
export type RegionalGenerationRequest = {
  /** Resolved provider adapter ID. */
  providerId: string
  providerRegion: 'cn' | 'global'
  executionRegion: 'cn' | 'global'
  storageRegion: 'cn' | 'global'
  executorKind: ExecutorKind
  projectId?: string | null
  workflowId?: string | null
  nodeId?: string | null
  prompt: string
  model?: string | null
  aspectRatio?: string | null
  resolution?: string | null
  duration?: number | null
  /**
   * Input assets (reference images, etc.).
   * Each asset carries its own storageRegion so the executor can detect
   * cross-region usage before attempting generation.
   */
  inputAssets?: Array<{
    type: 'image' | 'video' | string
    url: string
    storageRegion?: 'cn' | 'global' | null
    assetId?: string | null
  }>
  /**
   * Pre-computed bridge plan from detectAssetRegionBridgeRequirement().
   * The executor MUST refuse generation if required=true and bridge has not run.
   */
  assetBridgePlan?: {
    required: boolean
    reason?: string
    sourceStorageRegion?: 'cn' | 'global' | null
    targetExecutionRegion?: 'cn' | 'global'
  } | null
  metadata?: Record<string, unknown>
}

/**
 * Canonical response from any regional executor.
 * Both the sync cn-executor result and the Vercel-local result must map to this.
 */
export type RegionalGenerationResponse = {
  success: boolean
  status: 'succeeded' | 'failed' | 'running' | 'pending'
  /** DB GenerationJob.id */
  generationJobId?: string | null
  /** Provider-side job or task ID (cn-executor taskId or upstream providerJobId). */
  providerJobId?: string | null
  taskId?: string | null
  providerRegion: 'cn' | 'global'
  executionRegion: 'cn' | 'global'
  storageRegion: 'cn' | 'global'
  executorKind: ExecutorKind
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  stableUrl?: string | null
  asset?: {
    id: string
    type: 'IMAGE' | 'VIDEO' | string
    url: string
    storageKey?: string | null
    storageProvider?: string | null
    storageRegion?: 'cn' | 'global' | null
  } | null
  errorCode?: string
  message?: string
  diagnostics?: {
    crossRegion: boolean
    assetBridgeRequired: boolean
    unknownProvider: boolean
    executorConfigured: boolean
    cnExecutorConfigured: boolean
    globalExecutorConfigured: boolean
  }
}

/**
 * Unified error codes for the regional execution system.
 * Use these in errorCode fields — never raw provider error strings.
 */
export const REGIONAL_ERROR_CODES = {
  /** Provider is CN but CREATOR_CN_API_BASE_URL is not set. */
  EXECUTOR_REGION_MISSING: 'executor_region_missing',
  /** Provider region does not match the request's expected region. */
  PROVIDER_REGION_MISMATCH: 'provider_region_mismatch',
  /** Asset is in cn storage but execution is in global (or vice-versa). Bridge required. */
  ASSET_REGION_BRIDGE_REQUIRED: 'asset_region_bridge_required',
  /** Bridge was required but failed. */
  ASSET_REGION_BRIDGE_FAILED: 'asset_region_bridge_failed',
  /** Provider network unreachable (timeout, DNS, TCP). */
  PROVIDER_NETWORK_FAILED: 'provider_network_failed',
  /** Provider rejected parameters. */
  PROVIDER_INVALID_PARAMETER: 'provider_invalid_parameter',
  /** Model/endpoint ID not found in provider. */
  PROVIDER_MODEL_INVALID: 'provider_model_invalid',
  /** OSS upload failed. */
  OSS_UPLOAD_ERROR: 'oss_upload_error',
  /** CanvasNode DB write failed. */
  CANVAS_SAVE_ERROR: 'canvas_save_error',
  /** Generic regional execution error. */
  REGIONAL_EXECUTION_ERROR: 'regional_execution_error',
} as const

export type RegionalErrorCode = typeof REGIONAL_ERROR_CODES[keyof typeof REGIONAL_ERROR_CODES]
