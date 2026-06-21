/**
 * Creator City → Railway Gateway Service client.
 *
 * This is the only module in CC that calls the Railway Gateway Service.
 * HMAC-signed on every request. Secrets never reach the client.
 *
 * Architecture (Option B — APPROVED):
 *   CC Gateway (Vercel)
 *     → gatewayServiceClient.submit(...)
 *     → Railway Gateway Service POST /submit  (HMAC)
 *       → RunPod /run
 *
 *   CC Gateway (Vercel)
 *     → gatewayServiceClient.getStatus(ctid)
 *     → Railway Gateway Service GET /status/{ctid}  (HMAC)
 *       → RunPod /status/{rpjid}
 *       → (on COMPLETED) → CC Internal Ingest API  (HMAC)
 */

import { buildGatewayHmacHeaders } from './assetTransformHmac'

// ─── Environment ─────────────────────────────────────────────────────────────

function getGatewayUrl(): string {
  const url = process.env.ASSET_TRANSFORM_GATEWAY_URL
  if (!url) throw new Error('ASSET_TRANSFORM_GATEWAY_URL is not set')
  return url.replace(/\/+$/, '')
}

function getGatewaySecret(): string {
  const secret = process.env.ASSET_TRANSFORM_GATEWAY_SERVICE_TOKEN
  if (!secret) throw new Error('ASSET_TRANSFORM_GATEWAY_SERVICE_TOKEN is not set')
  return secret
}

// ─── Request / Response types ─────────────────────────────────────────────────

export interface GatewaySubmitPayload {
  ctid: string
  userId: string
  projectId: string
  nodeId: string
  sourceUrl: string         // presigned GET URL (5-min TTL)
  outputKey: string         // assets/transforms/{ctid}/subject.png
  outputPutUrl: string      // presigned PUT URL (10-min TTL)
  maskKey: string           // assets/transforms/{ctid}/mask.png
  maskPutUrl: string        // presigned PUT URL (10-min TTL)
  transformKind: 'remove-background'
  params: { mode: 'auto'; featherRadius: number }
}

export interface GatewaySubmitResponse {
  transformId: string       // equals ctid (opaque to browser)
  status: 'queued'
}

export interface GatewayStatusResponse {
  transformId: string
  status: 'queued' | 'running' | 'uploading' | 'ingesting' | 'done' | 'failed' | 'cancelled' | 'expired' | 'needs_user_selection'
  errorCode?: string
  canRetry?: boolean
  outputAssetId?: string
  stableOutputMediaUrl?: string
  maskUrl?: string
  outputOwner?: 'creator-city'
  ingestionStatus?: 'validated' | 'pending' | 'failed'
  metadata?: Record<string, unknown>
}

// ─── Client ──────────────────────────────────────────────────────────────────

const SUBMIT_TIMEOUT_MS = 20_000
const STATUS_TIMEOUT_MS = 10_000
const CANCEL_TIMEOUT_MS = 10_000

async function gatewayRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: object,
  timeoutMs = 10_000,
): Promise<T> {
  const gatewayUrl = getGatewayUrl()
  const secret = getGatewaySecret()
  const url = `${gatewayUrl}${path}`

  const bodyBuffer = body ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0)
  const headers = buildGatewayHmacHeaders(secret, bodyBuffer)

  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers,
      ...(method === 'POST' && body ? { body: bodyBuffer } : {}),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(tid)
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw Object.assign(new Error(`Gateway ${method} ${path} → ${res.status}: ${errText.slice(0, 200)}`), {
      gatewayStatus: res.status,
    })
  }

  return res.json() as Promise<T>
}

export async function submitTransform(payload: GatewaySubmitPayload): Promise<GatewaySubmitResponse> {
  // Serialize: snake_case for Gateway Service Python contract
  const body = {
    ctid: payload.ctid,
    user_id: payload.userId,
    project_id: payload.projectId,
    node_id: payload.nodeId,
    source_url: payload.sourceUrl,
    output_key: payload.outputKey,
    output_put_url: payload.outputPutUrl,
    mask_key: payload.maskKey,
    mask_put_url: payload.maskPutUrl,
    transform_kind: payload.transformKind,
    params: {
      mode: payload.params.mode,
      feather_radius: payload.params.featherRadius,
    },
  }
  const raw = await gatewayRequest<{ transform_id: string; status: 'queued' }>(
    'POST', '/submit', body, SUBMIT_TIMEOUT_MS,
  )
  return { transformId: raw.transform_id, status: raw.status }
}

export async function getTransformStatus(ctid: string): Promise<GatewayStatusResponse> {
  const raw = await gatewayRequest<{
    transform_id: string
    status: string
    error_code?: string
    can_retry?: boolean
    output_asset_id?: string
    stable_output_media_url?: string
    mask_url?: string
    output_owner?: string
    ingestion_status?: string
    metadata?: Record<string, unknown>
  }>('GET', `/status/${encodeURIComponent(ctid)}`, undefined, STATUS_TIMEOUT_MS)

  return {
    transformId: raw.transform_id,
    status: raw.status as GatewayStatusResponse['status'],
    errorCode: raw.error_code,
    canRetry: raw.can_retry,
    outputAssetId: raw.output_asset_id,
    stableOutputMediaUrl: raw.stable_output_media_url,
    maskUrl: raw.mask_url,
    outputOwner: raw.output_owner === 'creator-city' ? 'creator-city' : undefined,
    ingestionStatus: raw.ingestion_status as GatewayStatusResponse['ingestionStatus'],
    metadata: raw.metadata,
  }
}

export async function cancelTransform(ctid: string): Promise<void> {
  await gatewayRequest('POST', `/cancel/${encodeURIComponent(ctid)}`, undefined, CANCEL_TIMEOUT_MS)
}

export interface GatewayCapabilityEntry {
  kind: string
  available: boolean
  reason?: string
}

export async function getCapabilities(): Promise<GatewayCapabilityEntry[]> {
  const raw = await gatewayRequest<{ capabilities: GatewayCapabilityEntry[] }>(
    'GET', '/capabilities', undefined, STATUS_TIMEOUT_MS,
  )
  return raw.capabilities ?? []
}
