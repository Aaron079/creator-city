/**
 * Generation Reliability Layer — unified state machine types and helpers.
 *
 * This module is the single source of truth for generation lifecycle concepts.
 * It is a pure utility module with no React or side-effects; it can be imported
 * by any canvas component or route without adding weight to the core.
 *
 * Relationship to CANVAS_CORE_FREEZE:
 *  - This file is ALLOWED (new util in lib/canvas/ that returns strings/types).
 *  - It must never import from VisualCanvasWorkspace or CanvasNodeCard.
 *  - It may be imported by CanvasNodeCard and by future tool-plugin components.
 */

// ─── Generation phase ────────────────────────────────────────────────────────
// Represents WHERE in the generation lifecycle a node currently is.

export type GenerationPhase =
  | 'idle'           // No generation in progress
  | 'queued'         // Request submitted; provider queued it
  | 'dispatching'    // HTTP POST in flight to /api/generate/*
  | 'polling'        // Provider accepted; client polling for result
  | 'saving'         // Result received; uploading to OSS / creating asset record
  | 'done'           // Generation + persistence complete
  | 'failed'         // Terminal error (see GenerationFailureKind for why)
  | 'cancelled'      // Stopped by user action or page reload
  | 'preview_failed' // Generation succeeded; only the browser media preview failed

export const GENERATION_PHASE_LABELS: Record<GenerationPhase, string> = {
  idle: '',
  queued: '排队中',
  dispatching: '提交中',
  polling: '生成中',
  saving: '保存中',
  done: '已完成',
  failed: '失败',
  cancelled: '已停止',
  preview_failed: '预览不可用',
}

/** Derives the current generation phase from node status + errorCode. */
export function getGenerationPhase(
  status: string,
  errorCode?: string | null,
): GenerationPhase {
  if (status === 'done') return 'done'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'error' || status === 'failed') {
    if (
      errorCode === 'generation_cancelled_by_user' ||
      errorCode === 'generation_stopped_on_reload'
    ) return 'cancelled'
    return 'failed'
  }
  if (status === 'queued' || status === 'pending') return 'queued'
  if (status === 'running' || status === 'generating' || status === 'processing') return 'polling'
  return 'idle'
}

// ─── Failure kind ─────────────────────────────────────────────────────────────
// Categorises WHY generation failed — distinct from WHERE it failed (errorStage).
// Used to show actionable, specific failure messages instead of generic "重试".

export type GenerationFailureKind =
  | 'cancelled'         // User cancelled, or page reloaded mid-generation
  | 'network'           // Client-side network error (ERR_NETWORK_CHANGED, fetch failed)
  | 'auth'              // Session expired or DB auth unavailable
  | 'provider_quota'    // Rate-limit or credits exhausted
  | 'provider_config'   // API key, endpoint, model, or env var missing/invalid
  | 'provider_rejected' // Content policy or invalid prompt
  | 'provider_timeout'  // Provider took too long to respond
  | 'provider_failed'   // Provider returned a non-success response
  | 'save_failed'       // OSS upload or asset-record creation failed (generation OK)
  | 'polling_timeout'   // Polling exceeded max attempts; task may still run on server
  | 'video_not_enabled' // Video generation gated; not yet stable
  | 'preview_only'      // Generation + save OK; only browser media preview failed
  | 'unknown'

export const GENERATION_FAILURE_MESSAGES: Record<GenerationFailureKind, string> = {
  cancelled: '已手动停止生成。',
  network: '浏览器网络错误，生成请求未能到达服务器。请检查网络连接后重试。',
  auth: '登录状态已失效，请刷新页面重新登录后再重试。',
  provider_quota: 'Provider API 额度已用尽或触发限流，请切换 Provider 或稍后重试。',
  provider_config: 'Provider 配置错误（API Key / Endpoint 无效），请检查 API 账户设置。',
  provider_rejected: 'Provider 拒绝了该 Prompt（内容审核或版权限制），请修改后重试。',
  provider_timeout: 'Provider 请求超时，请稍后重试。',
  provider_failed: 'Provider 返回错误，请稍后重试。',
  save_failed: '图片已生成，但保存到资产库失败，请检查 OSS 配置后重试。',
  polling_timeout: '生成超时：轮询次数已达上限。任务可能仍在后台运行，请前往资产库检查。',
  video_not_enabled: '视频生成当前内测中，暂不支持平台额度生成。如需生成，请联系管理员。',
  preview_only: '媒体预览暂时不可用，但生成结果已保存到资产库。',
  unknown: '生成失败，请稍后重试。',
}

export const GENERATION_FAILURE_TITLES: Record<GenerationFailureKind, string> = {
  cancelled: '已停止生成',
  network: '网络错误',
  auth: '登录失效',
  provider_quota: 'Provider 额度不足',
  provider_config: 'Provider 配置错误',
  provider_rejected: 'Prompt 被拒绝',
  provider_timeout: '请求超时',
  provider_failed: '生成失败',
  save_failed: '保存失败',
  polling_timeout: '生成超时',
  video_not_enabled: '视频内测中',
  preview_only: '预览不可用',
  unknown: '生成失败',
}

/**
 * Maps a raw errorCode string to a GenerationFailureKind.
 * Useful for determining which message bucket to show without duplicating
 * the normalization logic that already exists in VisualCanvasWorkspace and CanvasNodeCard.
 */
export function classifyGenerationFailure(
  errorCode: string | null | undefined,
): GenerationFailureKind {
  if (!errorCode) return 'unknown'
  const c = errorCode

  if (c === 'generation_cancelled_by_user' || c === 'generation_stopped_on_reload') return 'cancelled'
  if (c === 'client_fetch_failed' || c === 'provider_network_failed') return 'network'
  if (
    c === 'auth_required' || c === 'UNAUTHORIZED' || c === 'UNAUTHENTICATED' ||
    c === 'GENERATION_AUTH_UNAVAILABLE' || c === 'DB_CONNECTION_UNAVAILABLE'
  ) return 'auth'
  if (
    c === 'PROVIDER_RATE_LIMITED' || c === 'PROVIDER_BUDGET_EXCEEDED' ||
    c === 'OPENAI_RATE_LIMITED' || c === 'PROVIDER_INSUFFICIENT_CREDITS'
  ) return 'provider_quota'
  if (
    c === 'PROVIDER_AUTH_FAILED' || c === 'OPENAI_AUTH_FAILED' ||
    c === 'provider_env_missing' || c === 'PROVIDER_NOT_CONFIGURED'
  ) return 'provider_config'
  if (c === 'VIDEO_GENERATION_NOT_READY' || c === 'video_not_enabled') return 'video_not_enabled'
  if (
    c === 'content_policy_rejected' || c === 'SEEDANCE_TASK_FAILED' ||
    c === 'prompt_rejected_or_invalid'
  ) return 'provider_rejected'
  if (
    c === 'provider_timeout' || c === 'generation_post_timeout' ||
    c === 'executor_trigger_timeout' || c === 'KIMI_REQUEST_TIMEOUT'
  ) return 'provider_timeout'
  if (c === 'generation_polling_timeout') return 'polling_timeout'
  if (
    c === 'oss_upload_error' || c === 'oss_upload_timeout' || c === 'oss_auth_error' ||
    c === 'oss_permission_error' || c === 'oss_config_error' ||
    c === 'asset_persistence_error' || c === 'MEDIA_ASSET_CREATE_FAILED' ||
    c === 'MEDIA_UPLOAD_FAILED' || c === 'canvas_save_error'
  ) return 'save_failed'

  return 'unknown'
}

/**
 * Returns true when a node's media display failure is a preview-only issue
 * (e.g. expired OSS signed URL) rather than a real generation failure.
 * In this case the generation result is preserved — only the browser thumbnail failed.
 */
export function isPreviewOnlyFailure(
  nodeStatus: string,
  assetId: string | null | undefined,
): boolean {
  return nodeStatus === 'done' && Boolean(assetId)
}
