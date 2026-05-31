/**
 * Provider Gateway — unified type definitions.
 *
 * These types describe the FUTURE unified gateway interface (Phase 2+).
 * The existing GenerateRequest/GenerateResponse in lib/providers/types.ts remain
 * the runtime types used by current generate routes. These types are additive and
 * do not replace or conflict with the existing ProviderAdapter in lib/providers/types.ts.
 */

// ─── Node types ───────────────────────────────────────────────────────────────

export type GatewayNodeType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'music'
  | 'voice'
  | 'character'
  | 'upscale'
  | 'background-removal'
  | 'lip-sync'
  | 'camera-motion'

// ─── Region ───────────────────────────────────────────────────────────────────

/** 'cn' routes through cn-executor (Aliyun FC). 'global' runs in Vercel. */
export type GatewayRegion = 'cn' | 'global'

// ─── Job status ───────────────────────────────────────────────────────────────

export type GatewayJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

// ─── Asset ────────────────────────────────────────────────────────────────────

export type GatewayAsset = {
  id?: string
  type: 'image' | 'video' | 'audio' | 'text' | 'file'
  url?: string
  storageKey?: string
  mimeType?: string
  width?: number
  height?: number
  durationSeconds?: number
  metadata?: Record<string, unknown>
}

// ─── Request / Response ───────────────────────────────────────────────────────

export type ProviderRequest = {
  userId: string
  projectId: string
  nodeId?: string
  prompt?: string
  inputAssetIds?: string[]
  providerId: string
  modelId: string
  nodeType: GatewayNodeType
  options: Record<string, unknown>
  /** Caller-supplied idempotency key for deduplication. */
  requestId?: string
}

export type ProviderResponse = {
  success: boolean
  providerId: string
  modelId: string
  jobId?: string
  status: GatewayJobStatus
  assets?: GatewayAsset[]
  creditsEstimated?: number
  creditsCharged?: number
  platformCostUsd?: number
  raw?: unknown
  errorCode?: GatewayErrorCode
  message?: string
}

// ─── Error codes ──────────────────────────────────────────────────────────────

export type GatewayErrorCode =
  // Provider configuration / availability
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_DISABLED'
  | 'PROVIDER_UNSUPPORTED_CAPABILITY'
  // Authentication / authorization
  | 'PROVIDER_AUTH_FAILED'
  | 'PROVIDER_RATE_LIMITED'
  // Network / timeout
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_BAD_REQUEST'
  // Content / safety
  | 'PROVIDER_CONTENT_POLICY'
  // Credits / budget
  | 'PROVIDER_INSUFFICIENT_CREDITS'
  | 'PROVIDER_BUDGET_EXCEEDED'
  // Task lifecycle
  | 'PROVIDER_TASK_FAILED'
  | 'PROVIDER_TASK_CANCELLED'
  | 'PROVIDER_OUTPUT_INVALID'
  // Asset persistence
  | 'ASSET_PERSIST_FAILED'
  // Billing
  | 'BILLING_RESERVE_FAILED'
  | 'BILLING_SETTLE_FAILED'
  | 'BILLING_RELEASE_FAILED'
  // Catch-all
  | 'UNKNOWN_PROVIDER_ERROR'

// ─── Adapter capability descriptor ───────────────────────────────────────────

export type ProviderAdapterCapability = {
  nodeTypes: GatewayNodeType[]
  supportsPolling?: boolean
  supportsCancel?: boolean
  supportsInputAssets?: boolean
  supportsStreaming?: boolean
}

// ─── Unified adapter interface (Gateway v2) ───────────────────────────────────
//
// NOTE: This is distinct from the existing ProviderAdapter in lib/providers/types.ts.
// The existing one splits methods by node type (generateImage, generateVideo, …).
// GatewayProviderAdapter unifies all generation behind a single generate() call
// and separates region + capability metadata explicitly.

export interface GatewayProviderAdapter {
  /** Stable ID, matches ADMIN_PROVIDER_REGISTRY providerId. */
  providerId: string
  displayName: string
  region: GatewayRegion
  capabilities: ProviderAdapterCapability

  /** Optional: returns estimated credit cost before calling generate(). */
  estimateCredits?(request: ProviderRequest): Promise<number> | number

  /** Primary generation entry point. Must be idempotent when requestId is set. */
  generate(request: ProviderRequest): Promise<ProviderResponse>

  /** Poll an async job by its provider-assigned job ID. */
  getJob?(jobId: string, request?: Partial<ProviderRequest>): Promise<ProviderResponse>

  /** Cancel an in-flight async job. */
  cancelJob?(jobId: string, request?: Partial<ProviderRequest>): Promise<void>

  /** Lightweight connectivity check (env-key validation, no real generation). */
  healthCheck?(): Promise<{ ok: boolean; message?: string; raw?: unknown }>
}
