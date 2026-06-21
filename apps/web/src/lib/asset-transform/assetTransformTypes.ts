/**
 * Asset Transform Contract — shared types for background removal, upscale, and future transforms.
 *
 * Design constraints:
 *  - Pure types; no UI imports, no React, no side effects.
 *  - Gateway knows nothing about canvas layout.
 *  - Adapter never patches the source asset.
 *  - All operations are async-capable (status polling supported).
 *  - Executor capability is discovered at runtime, not hardcoded in UI.
 */

// ─── Transform kinds ─────────────────────────────────────────────────────────

export type AssetTransformKind =
  | 'remove-background'   // isolate foreground subject; output: transparent PNG
  | 'segment'             // user-guided or text-guided subject segmentation
  | 'upscale'             // resolution reconstruction (2×, 4×)
  | 'inpaint'             // fill masked region (future)
  | 'outpaint'            // extend beyond original border (future)
  | 'variation'           // style-consistent variant via img2img (future)
  | 'extract-control-map' // depth, canny, pose, normal extraction (future)
  | 'interrogate'         // prompt reverse-engineering from image (future)

// ─── Billing mode ────────────────────────────────────────────────────────────

export type TransformBillingMode = 'platform' | 'byok' | 'local'

// ─── Client request body ──────────────────────────────────────────────────────
//
// This is what clients send to POST /api/asset-transform.
// sourceMediaUrl is NOT accepted from clients — the server resolves it from the DB.

export interface AssetTransformClientBody {
  transformKind: AssetTransformKind
  projectId: string
  workflowId?: string
  sourceNodeId: string
  /** Kind-specific parameters (scale factor, mode, threshold, etc.). Sanitized server-side. */
  params?: Record<string, unknown>
  /**
   * Optional client-side idempotency hint. The server generates its own canonical
   * requestId and does not blindly trust this value for idempotency.
   */
  requestId?: string
}

// ─── Executor request ─────────────────────────────────────────────────────────
//
// This is what the API route sends to the external GPU executor.
// sourceMediaUrl is populated server-side from the DB — never from client body.

export interface AssetTransformRequest {
  /** Stable kind identifier; must match a registered capability. */
  transformKind: AssetTransformKind
  projectId: string
  workflowId?: string
  sourceNodeId: string
  /** assetId from the source canvas node (if available). */
  sourceAssetId?: string
  /**
   * Server-resolved media URL from the source CanvasNode.resultImageUrl.
   * NEVER populated from client-supplied body. Domain-allowlisted before forwarding.
   */
  sourceMediaUrl: string
  /** Kind-specific parameters — sanitized and allowlisted server-side. */
  params: Record<string, unknown>
  /** Always 'asset-transform-executor' — not accepted from client. */
  executorId: string
  billingMode: TransformBillingMode
  /** Server-generated idempotency key. */
  requestId: string
}

// ─── Result ──────────────────────────────────────────────────────────────────

export interface AssetTransformResult {
  transformId: string
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

  // ── Platform ingestion fields — all four required for derived node creation ──
  //
  // A result with status='done' but missing ANY of these four fields must be treated
  // as TRANSFORM_OUTPUT_INGESTION_BLOCKED. Never create a derived node without them.

  /** Platform-assigned Asset ID — populated after successful ingestion into Creator City. */
  outputAssetId?: string
  /**
   * Stable, platform-owned media URL written to Creator City OSS.
   * This is the ONLY URL that may be written to a canvas node's resultImageUrl.
   * Only present after successful ingestion. Never use executor-ephemeral outputMediaUrl
   * for persistent storage.
   */
  stableOutputMediaUrl?: string
  /**
   * Must equal 'creator-city' — confirms the output is owned by the platform,
   * not an executor-ephemeral resource.
   */
  outputOwner?: 'creator-city'
  /**
   * Ingestion pipeline status. Must be 'validated' before a derived node may be created.
   * 'pending' = ingestion in progress; 'failed' = ingestion failed.
   */
  ingestionStatus?: 'validated' | 'pending' | 'failed'

  // ── Executor-ephemeral fields — display-only, never persist ──────────────────
  /**
   * @deprecated Executor-generated temporary URL. Use ONLY for in-panel preview display.
   * NEVER write to canvas node resultImageUrl, never store in DB, never return to frontend
   * as a final output. Use stableOutputMediaUrl for all persistent operations.
   */
  outputMediaUrl?: string
  /** Output mask URL (remove-background / segment) — ephemeral, display only. */
  maskUrl?: string

  // ── Standard fields ──────────────────────────────────────────────────────────
  /** Executor-reported metadata: model used, output dimensions, timing. */
  metadata?: Record<string, unknown>
  errorCode?: string
  errorMessage?: string
  /** ISO timestamp for the last status change. */
  updatedAt?: string
}

// ─── Executor capability descriptor ──────────────────────────────────────────

export interface AssetTransformExecutorCapability {
  executorId: string
  displayName: string
  /** Which transform kinds this executor supports. */
  supportedKinds: AssetTransformKind[]
  /** Maximum input image dimensions this executor can handle. */
  maxInputWidth?: number
  maxInputHeight?: number
  /** Maximum output dimensions. */
  maxOutputWidth?: number
  maxOutputHeight?: number
  /** Whether this executor supports cancellation. */
  supportsCancellation: boolean
  /** Whether this executor supports async polling vs. synchronous response. */
  supportsPolling: boolean
  /** Health check result (populated at runtime, not stored). */
  health?: 'ok' | 'unavailable' | 'misconfigured'
  healthMessage?: string
}

// ─── Executor adapter interface ───────────────────────────────────────────────

export interface AssetTransformExecutorAdapter {
  executorId: string
  /** Returns the runtime capability descriptor including current health. */
  getCapability(): Promise<AssetTransformExecutorCapability>
  /** Submit a transform job. Returns immediately with a transformId. */
  submit(request: AssetTransformRequest): Promise<AssetTransformResult>
  /** Poll status of an existing transform job. */
  poll(transformId: string): Promise<AssetTransformResult>
  /** Cancel an in-flight job. */
  cancel?(transformId: string): Promise<void>
}

// ─── Lineage metadata written to canvas node metadataJson ────────────────────

export interface AssetTransformLineage {
  transformKind: AssetTransformKind
  transformId: string
  sourceNodeId: string
  sourceAssetId?: string
  outputAssetId?: string
  executorId: string
  modelId?: string
  params: Record<string, unknown>
  createdAt: string
}
