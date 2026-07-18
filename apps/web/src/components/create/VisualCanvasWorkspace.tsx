'use client'

import { Component, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { CanvasFlowEdge } from '@/components/create/CanvasFlowEdge'
import { CanvasNodeCard, type CanvasNodePreviewType, type VisualCanvasNode as CanvasNodeCardNode, type VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { CanvasPromptBox, type CanvasPromptFooterItem } from '@/components/create/CanvasPromptBox'
import { CanvasToolDock } from '@/components/create/CanvasToolDock'
import { CanvasCommentsPanel, type CanvasComment } from '@/components/create/CanvasCommentsPanel'
import { CanvasHistoryPanel, type CanvasHistoryItem } from '@/components/create/CanvasHistoryPanel'
import { CanvasTemplatePanel } from '@/components/create/CanvasTemplatePanel'
import { CanvasSkillPanel } from '@/components/create/CanvasSkillPanel'
import { CreativeAssetsPanel } from '@/components/create/CreativeAssetsPanel'
import { EdgeDirectorPanel } from '@/components/create/EdgeDirectorPanel'
import { GenerationTasksPanel } from '@/components/create/GenerationTasksPanel'
import { ImageEditorPanel } from '@/components/create/ImageEditorPanel'
import { MediaDiagnosticsPanel } from '@/components/create/MediaDiagnosticsPanel'
import { P0MediaDebugPanel } from '@/components/create/P0MediaDebugPanel'
import { PromptInspectorPanel } from '@/components/create/PromptInspectorPanel'
import { CameraLexiconPanel } from '@/components/create/CameraLexiconPanel'
import { AssetVariantPlannerPanel } from '@/components/create/AssetVariantPlannerPanel'
import { CharacterLockPanel } from '@/components/create/CharacterLockPanel'
import { ABComparePanel } from '@/components/create/ABComparePanel'
import { isComparableNode } from '@/lib/canvas/compare-utils'
import { KeyframeExtractorPanel } from '@/components/create/KeyframeExtractorPanel'
import { ShotListBuilderPanel, type CompatibilityShotNodeOptions } from '@/components/create/ShotListBuilderPanel'
import { ShotSequencerPanel } from '@/components/create/ShotSequencerPanel'
import {
  parseShotSequenceFromWorkflowMetadata,
  normalizeShotSequenceItems,
} from '@/lib/canvas/shot-sequence'
import type { ShotSequenceState, ShotSequenceItem } from '@/lib/canvas/shot-sequence'
import { ContinuityCheckerPanel } from '@/components/create/ContinuityCheckerPanel'
import { CharacterBiblePanel } from '@/components/create/CharacterBiblePanel'
import { SceneBiblePanel } from '@/components/create/SceneBiblePanel'
import { PromptBoosterPanel } from '@/components/create/PromptBoosterPanel'
import { BatchPromptRewriterPanel } from '@/components/create/BatchPromptRewriterPanel'
import { LookPackagePanel } from '@/components/create/LookPackagePanel'
import { ColorGradePalettePanel } from '@/components/create/ColorGradePalettePanel'
import { RemoveBackgroundPanel } from '@/components/create/RemoveBackgroundPanel'
import { HdReconstructionPanel } from '@/components/create/HdReconstructionPanel'
import { AnnotationPanel } from '@/components/create/AnnotationPanel'
import { ScriptSegmentationPanel } from '@/components/create/canvas/skills/ScriptSegmentationPanel'
import type { SceneNodeMaterializationPlan } from '@/components/create/canvas/skills/scriptSegmentationMaterialization'
import { NarrativeBeatAnalysisPanel } from '@/components/create/canvas/skills/NarrativeBeatAnalysisPanel'
import type { GroupedSkillNodePlan } from '@/components/create/canvas/skills/groupedSkillMaterialization'
import {
  StoryboardGridSplitPanel,
  type StoryboardGridSessionSummary,
  type StoryboardGridUploadedCell,
} from '@/components/create/StoryboardGridSplitPanel'
import { mergeAnnotationMetadata, type CanvasAnnotationState } from '@/lib/canvas/annotationMetadata'

// ─── Asset Transform capability cache (module-level, session-scoped) ──────────
// Fetched once per page session from GET /api/asset-transform.
// Defaults to fully disabled so toolbar entries are hidden until confirmed available.

type AssetTransformCaps = { removeBackground: boolean; upscale: boolean }
let _atCapCache: AssetTransformCaps | null = null
let _atCapFetchedAt = 0
const AT_CAP_TTL_MS = 5 * 60 * 1000 // 5 min

async function fetchAssetTransformCaps(): Promise<AssetTransformCaps> {
  const disabled: AssetTransformCaps = { removeBackground: false, upscale: false }
  const now = Date.now()
  if (_atCapCache && now - _atCapFetchedAt < AT_CAP_TTL_MS) return _atCapCache
  try {
    const res = await fetch('/api/asset-transform', {
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) { _atCapCache = disabled; _atCapFetchedAt = now; return disabled }
    const data = await res.json() as {
      enabled?: boolean
      executorReady?: boolean
      capabilities?: Array<{ kind: string; available: boolean }>
    }
    if (!data.enabled || !data.executorReady) { _atCapCache = disabled; _atCapFetchedAt = now; return disabled }
    const caps = data.capabilities ?? []
    _atCapCache = {
      removeBackground: caps.some((c) => c.kind === 'remove-background' && c.available),
      upscale: caps.some((c) => c.kind === 'upscale' && c.available),
    }
    _atCapFetchedAt = now
    return _atCapCache
  } catch {
    // Executor unreachable — keep tools hidden
    return disabled
  }
}
import { SceneToolLayer } from '@/components/create/SceneToolLayer'
import { CanvasWorkspaceShell } from '@/components/canvas/shell/CanvasWorkspaceShell'
import { CanvasTopCommandBar } from '@/components/canvas/shell/CanvasTopCommandBar'
// CanvasRightInspector removed — inspector panel not used
import { CanvasBottomDock } from '@/components/canvas/dock/CanvasBottomDock'
import type { CanvasModalId } from '@/components/canvas/modal/canvasModalTypes'
import { SceneToolPalette } from '@/components/create/SceneToolPalette'
import { StoryboardPreviewPanel } from '@/components/create/StoryboardPreviewPanel'
import { StoryboardDirectorPanel } from '@/components/create/StoryboardDirectorPanel'
import { readDirectorState, writeDirectorState, createShotCard, addNodeToShot } from '@/lib/storyboard/director'
import type { StoryboardState } from '@/lib/storyboard/types'
import { ProjectAssetsPanel, type ProjectAssetItem } from '@/components/create/ProjectAssetsPanel'
import { NewProjectDialog } from '@/components/projects/NewProjectDialog'
import {
  getPublicTemplateById,
  type PublicTemplate,
} from '@/lib/templates/public-template-catalog'
import {
  CANVAS_PROVIDER_FALLBACKS,
  getCanvasProvider,
  getCanvasProviderLabel,
  getCanvasProviderNoticeFromStatus,
  getCanvasProviders,
  getCanvasProviderStatus,
  type CanvasProviderKind,
} from '@/lib/tools/provider-groups'
import { useProviderLiveStatus } from '@/lib/tools/useProviderLiveStatus'
import type { GenerateResponse } from '@/lib/providers/types'
import { estimateCreditCost } from '@/lib/credits/cost-rules'
import { BeginnerGuidePanel } from './BeginnerGuidePanel'
import { CreditBalanceBadge } from './CreditBalanceBadge'
import { CreditInsufficientModal } from './CreditInsufficientModal'
import { normalizeAssetType } from '@/lib/assets/normalize'
import { getToolProviderById, type ToolProviderNodeType, type ToolProviderStatus } from '@/lib/tools/provider-catalog'
import { isPlaceholderProjectId } from '@/lib/routing/placeholders'
import { getNodeImageUrl, getNodeVideoUrl } from '@/lib/canvas/media-urls'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'
import { collectGenerationTasks, type CanvasGenerationTask } from '@/lib/canvas/generation-tasks'
import type { GenerationHealthResponse } from '@/lib/generation/health-types'
import { getEdgeDirectorConfig } from '@/lib/canvas/edge-director'
import { buildStoryboardFromCanvas } from '@/lib/storyboard'
import { CREATOR_SKILL_REGISTRY, getDefaultCreatorSkillIds, resolveCreatorSkills, type CreatorSkillSourceNode, type ProjectStyleBible } from '@/lib/skills'
import {
  characterIdsMetadata,
  getNodeCharacterIds,
  loadCharacterBible,
  saveCharacterBible,
  type CharacterBible,
} from '@/lib/characters'
import {
  getNodeSceneIds,
  getSceneEdits,
  loadSceneBible,
  saveSceneBible,
  sceneEditsMetadata,
  sceneIdsMetadata,
  summarizeSceneEdits,
  type SceneBible,
  type SceneEditMark,
  type SceneEditTool,
} from '@/lib/scenes'
import type { ScenePluginRun } from '@/lib/scene-plugins'
import canvasStyles from '@/components/create/canvas.module.css'
import { AssetAgentToolbar, type ReframeMode } from '@/components/create/AssetAgentToolbar'
import { resolveImageInputForVideoNode } from '@/lib/workflow/resolveNodeInputs'
import { clearProjectScopedLocalState } from '@/lib/client-storage/clearUserLocalState'
import { appendBibleContextToPrompt, buildBiblePromptContext, hasBibleContent } from '@/lib/canvas/biblePromptContext'
import { appendCameraContextToPrompt, buildCameraPromptContext, buildCameraSummaryText, DEFAULT_CAMERA_SETTINGS, hasCameraContext, type CameraSettings } from '@/lib/canvas/cameraPromptContext'
import { getCameraModelLabel } from '@/lib/canvas/cameraModelDatabase'
import { appendSceneLightingContextToPrompt, buildSceneLightingPromptContext, buildLightingSummaryText, DEFAULT_SCENE_LIGHTING, hasSceneLightingContext, activeSceneLightingCount, type SceneLightingSettings } from '@/lib/canvas/sceneLightingPromptContext'
import { loadCameraSettingsForNode, loadSceneLightingForNode, saveCameraSettingsForNode, saveSceneLightingForNode } from '@/lib/canvas/nodeDirectorContextStorage'
import { CinematicCameraControlPanel } from '@/components/create/CinematicCameraControlPanel'
import { SceneLightingControlPanel } from '@/components/create/SceneLightingControlPanel'
import { UpstreamTaskStrip } from '@/components/create/canvas/task/UpstreamTaskStrip'
import { LocalReferenceStrip } from '@/components/create/canvas/task/LocalReferenceStrip'
import type { NodeToolContext } from '@/lib/canvas/nodeToolContext'
import { getTaskInputMode, getTaskInputModeLabel, CURRENT_PROVIDER_CAPABILITIES } from '@/lib/canvas/taskInputMode'
import {
  CANVAS_SAVE_CLIENT_TIMEOUT_MS,
  canvasSaveFailure,
  consumePendingCanvasSave,
  type CanvasSaveResponseData,
} from '@/lib/canvas/canvasSaveIntegrity'
import { decideCanvasDraftRecovery } from '@/lib/canvas/canvasDraftRecovery'
import {
  validateLocalImageFile,
  readImageDimensions,
  buildLocalImportMetadata,
  buildUploadFormData,
  getImportNodeTitle,
  uploadImageWithTimeout,
  type LocalRefEntry,
} from '@/lib/canvas/localImageImport'
import {
  validateLocalScriptFile,
  readScriptFile,
  type LocalScriptEntry,
} from '@/lib/canvas/localScriptImport'

class CanvasNodeErrorBoundary extends Component<
  { children: ReactNode; nodeId: string },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode; nodeId: string }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override componentDidCatch(error: Error) {
    console.error('[CanvasNodeCard] render error, nodeId:', this.props.nodeId, error)
  }
  override render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minWidth: 220,
            padding: '12px 16px',
            background: 'rgba(30,0,0,0.88)',
            border: '1px solid rgba(255,60,60,0.35)',
            borderRadius: 12,
            color: '#ffa0a0',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>节点渲染异常（已隔离）</div>
          <div style={{ opacity: 0.72, wordBreak: 'break-all' }}>
            {this.state.error.message?.slice(0, 160) ?? '未知错误'}
          </div>
          <div style={{ marginTop: 6, opacity: 0.5, fontSize: 10 }}>nodeId: {this.props.nodeId}</div>
        </div>
      )
    }
    return this.props.children
  }
}

type UserProviderAccount = {
  id: string
  providerId: string
  accountLabel: string
  keyLast4: string
  status: string
  fieldMeta?: Record<string, { label: string; last4: string; updatedAt: string }> | null
}

interface VisualCanvasWorkspaceProps {
  projectTitle: string
  templateName?: string | null
  canOpenClientDelivery?: boolean
  onOpenTimeline: () => void
  onOpenAssets: () => void
  onOpenDelivery: () => void
  onShowStartup: () => void
}

type SaveStatus = 'idle' | 'opening' | 'dirty' | 'saving' | 'saved' | 'failed' | 'local-draft' | 'restored-draft'

interface CanvasLoadResponse {
  success?: boolean
  errorCode?: string
  message?: string
  project?: { id: string; title: string }
  workflow?: { id: string; viewportJson?: unknown; metadataJson?: unknown; updatedAt?: string }
  nodes?: VisualCanvasNode[]
  edges?: CanvasEdge[]
  viewport?: unknown
  serverUpdatedAt?: string
}

interface CanvasDraft {
  projectId: string
  workflowId: string
  title?: string
  nodes: VisualCanvasNode[]
  edges: CanvasEdge[]
  viewport: { zoom: number; pan: { x: number; y: number } }
  updatedAt: string
  syncedAt?: string
  reason?: 'autosave-draft' | 'save-401-emergency' | string
}

interface CanvasCache extends CanvasDraft {
  serverUpdatedAt?: string
}

interface CanvasLocalSnapshot extends CanvasCache {
  version: 1
  source: 'local'
  commentsPreview?: CanvasComment[]
}

interface DraftRestorePrompt {
  projectId: string
  workflowId: string
  nodes: VisualCanvasNode[]
  edges: CanvasEdge[]
  viewport: { zoom: number; pan: { x: number; y: number } }
  source: 'snapshot' | 'cache' | 'draft'
}

type LocalCanvasSource = 'snapshot' | 'cache' | 'draft'

function getDraftKey(projectId: string) {
  return `creator-city-canvas-draft:${projectId}`
}

function getLegacyDraftKey(projectId: string) {
  return `creator-city:draft:${projectId}`
}

function getCanvasCacheKey(projectId: string) {
  return `creator-city:canvas-cache:${projectId}`
}

function getCanvasSnapshotKey(projectId: string) {
  return `creator-city:canvas-snapshot:${projectId}`
}

function getStyleBibleKey(projectId: string) {
  return `creator-city:style-bible:${projectId}`
}

function getCameraSettingsKey(projectId: string) {
  return `creator-city:camera-settings:${projectId}`
}

function getSceneLightingKey(projectId: string) {
  return `creator-city:scene-lighting:${projectId}`
}

function getEnabledSkillsKey(projectId: string) {
  return `creator-city:enabled-skills:${projectId}`
}

function timeValue(input?: string) {
  if (!input) return 0
  const value = new Date(input).getTime()
  return Number.isFinite(value) ? value : 0
}

function getCommentsCacheKey(projectId: string) {
  return `creator-city:canvas-comments-cache:${projectId}`
}

function getPendingCommentsKey(projectId: string) {
  return `creator-city:canvas-comments-pending:${projectId}`
}

function createLocalCommentId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isPendingCanvasComment(comment: CanvasComment) {
  return comment.id.startsWith('local-') || comment.status === 'pending' || comment.status === 'syncing'
}

function devPerf(label: string, mode: 'mark' | 'start' | 'end' = 'mark') {
  if (process.env.NODE_ENV === 'production' || typeof performance === 'undefined') return
  const name = `create:${label}`
  if (mode === 'start') {
    console.time(name)
    performance.mark(`${name}:start`)
    return
  }
  if (mode === 'end') {
    console.timeEnd(name)
    performance.mark(`${name}:end`)
    return
  }
  performance.mark(name)
  console.debug(`[perf] ${name}`)
}

type VisualCanvasNode = CanvasNodeCardNode & {
  assetId?: string
  resultImageUrl?: string
  resultVideoUrl?: string
  resultAudioUrl?: string
  resultText?: string
  metadataJson?: unknown
}

function nodeHasMediaResult(node: VisualCanvasNode): boolean {
  if (node.kind === 'image') return Boolean(node.resultImageUrl?.trim())
  if (node.kind === 'video') return Boolean(node.resultVideoUrl?.trim())
  return false
}

const ACTIVE_GENERATION_STATUSES = new Set(['generating', 'running', 'queued', 'pending', 'processing'])

type GenerationAbortContext = 'background' | 'stale' | 'deleted' | 'manual'

type GenerationAbortReason = {
  context: GenerationAbortContext
  canvasIdentity: string
  nodeId: string
}

function isActiveGenerationStatus(status?: string | null) {
  return ACTIVE_GENERATION_STATUSES.has(status ?? '')
}

function generationCanvasIdentity(projectId: string, workflowId: string) {
  return `${projectId}\u0000${workflowId}`
}

function generationAbortContext(signal: AbortSignal): GenerationAbortContext | null {
  if (!signal.aborted) return null
  const reason = signal.reason as Partial<GenerationAbortReason> | undefined
  if (reason?.context === 'background' || reason?.context === 'stale' || reason?.context === 'deleted' || reason?.context === 'manual') {
    return reason.context
  }
  return 'stale'
}

function stoppedGenerationMetadata(metadataJson: unknown, reason: 'reload' | 'cancelled' | 'background') {
  const metadata = metadataRecord(metadataJson)
  const message = reason === 'reload'
    ? 'Generation was stopped after reload to prevent token drain.'
    : reason === 'background'
      ? 'Generation was cancelled when the tab moved to the background. Retry to continue.'
      : 'Generation cancelled by user.'
  const errorCode = reason === 'reload'
    ? 'generation_stopped_on_reload'
    : 'generation_cancelled_by_user'
  const priorTrace = Array.isArray(metadata.stageTrace) ? metadata.stageTrace : []
  return {
    ...metadata,
    errorCode,
    errorStage: reason === 'reload' ? 'client_reload' : reason === 'background' ? 'client_visibility' : 'client_cancelled',
    errorMessage: message,
    message,
    loading: false,
    isRegenerating: false,
    regenerating: false,
    stageTrace: [...priorTrace, reason === 'reload' ? 'client_reload_stop' : reason === 'background' ? 'client_visibility_stop' : 'client_stop_all_generations'],
  }
}

function cancelBackgroundGenerationNodes(nodes: VisualCanvasNode[], activeNodeIds: Set<string>) {
  let changed = false
  const next = nodes.map((node) => {
    if (!activeNodeIds.has(node.id) || !isActiveGenerationStatus(node.status)) return node
    changed = true
    return {
      ...node,
      status: 'cancelled' as const,
      errorMessage: 'Generation was cancelled when the tab moved to the background. Retry to continue.',
      metadataJson: stoppedGenerationMetadata(node.metadataJson, 'background'),
    }
  })
  return changed ? next : nodes
}

type CanvasAssetResolveResult = {
  assetId: string
  status: 'ready' | 'missing' | 'needs_signed_url' | 'proxy_required' | 'missing_env' | 'storage_permission_error' | 'object_missing' | 'signing_error' | 'proxy_error' | 'provider_error' | 'no_recovery_source' | 'unrecoverable_blob_url' | 'unrecoverable_data_url_without_file' | 'unrecoverable_expired_signed_url_without_storage_key' | 'unrecoverable_provider_expired' | 'unrecoverable_provider_retrieve_not_implemented' | 'unrecoverable_no_record'
  resolvedUrl?: string | null
  proxyUrl?: string | null
  signedUrlAvailable?: boolean | null
  proxyAvailable?: boolean | null
  thumbnailUrl?: string | null
  storageKey?: string | null
  storageProvider?: string | null
  bucket?: string | null
  providerJobId?: string | null
  recoveryStatus?: string | null
  error?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  actionTaken?: string | null
  nextAction?: string | null
  proxyFallbackUrl?: string | null
  proxyHttpStatus?: number | null
  proxyErrorCode?: string | null
  proxyErrorMessage?: string | null
  proxyRejectedHost?: string | null
}

type CanvasEdgeStatus = 'idle' | 'active' | 'done'

interface CanvasEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  status: CanvasEdgeStatus
  type?: string
  metadataJson?: unknown
  label?: string
}

type MediaReviewWindow = {
  id: string
  nodeId: string
  type: 'image' | 'video'
  x: number
  y: number
  width: number
  height: number
  zIndex: number
}

const NODE_META: Record<VisualCanvasNodeKind, { title: string; subtitle: string; model: string; ratio?: string }> = {
  text: { title: '文本', subtitle: '从一句想法、脚本片段或 brief 开始。', model: 'deepseek-text' },
  image: { title: '图片', subtitle: '先做视觉方向、关键画面与风格参考。', model: 'volcengine-seedream-image', ratio: '16:9' },
  video: { title: '视频', subtitle: '直接推进镜头、节奏和画面运动。', model: 'volcengine-seedance-video', ratio: '16:9' },
  audio: { title: '音频', subtitle: '补充音乐、旁白和声音氛围。', model: 'elevenlabs' },
  asset: { title: '素材', subtitle: '导入图片、视频或音频参考素材。', model: 'asset-drop' },
  template: { title: '模板', subtitle: '从模板流程继续创作。', model: 'asset-drop' },
  delivery: { title: '交付', subtitle: '整理版本摘要与客户确认信息。', model: 'delivery-agent' },
  world: { title: '3D 世界', subtitle: '建立场景结构、空间层级与世界观。', model: 'spatial-world' },
  upload: { title: '上传', subtitle: '导入图片、视频或音频参考素材。', model: 'asset-drop' },
}

const NODE_SIZE: Record<VisualCanvasNodeKind, { width: number; height: number }> = {
  text: { width: 360, height: 300 },
  image: { width: 380, height: 320 },
  video: { width: 380, height: 320 },
  audio: { width: 360, height: 260 },
  asset: { width: 360, height: 280 },
  template: { width: 360, height: 280 },
  delivery: { width: 360, height: 280 },
  world: { width: 380, height: 320 },
  upload: { width: 360, height: 280 },
}

const ASSET_RECOVERY_TOOLS_ENABLED = false
const STORYBOARD_TOOLS_ENABLED = false

const WORKSPACE_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9']
const MIN_CANVAS_ZOOM = 0.35
const MAX_CANVAS_ZOOM = 1.8
// Hard ceiling on video generation polling (36 × 5s = 180s).
// Prevents unbounded loops when the provider stalls without returning error/success.
const MAX_VIDEO_GENERATION_POLLS = 36
// Context chips (Bible/Camera/Lighting) in the generation dialog are hidden while
// these tools transition to a derived-node workflow. The underlying engines and
// storage are retained so no existing node data is lost.
const SHOW_GENERATION_CONTEXT_CHIPS = false
const CANVAS_ZOOM_STEP = 0.1
const CONNECTOR_CENTER_OFFSET = 23
const CONNECTION_DRAFT_HANDLE_OFFSET = 36
const DOWNSTREAM_NODE_X_GAP = 820
const DOWNSTREAM_NODE_Y_GAP = 220
const NODE_MENU_WIDTH = 214
const NODE_MENU_HEIGHT = 252
const NODE_ADD_MENU_WIDTH = 214
const NODE_ADD_MENU_HEIGHT = 440
const NODE_DIALOG_GAP = 56
const NODE_DIALOG_HEIGHT = 500
const REVIEW_WINDOW_GAP = 18
const REVIEW_WINDOW_TOP_GUARD = 104
const REVIEW_WINDOW_MIN_WIDTH = 320
const REVIEW_WINDOW_MIN_HEIGHT = 240
const REVIEW_WINDOW_IMAGE_WIDTH = 520
const REVIEW_WINDOW_VIDEO_WIDTH = 640
const STAGE_OPTIONS = [
  { value: 'draft', label: '起稿', hint: '先把方向和内容结构定下来' },
  { value: 'lookdev', label: '视觉开发', hint: '推进风格、关键帧和 look & feel' },
  { value: 'motion', label: '生成阶段', hint: '进入镜头、动画和运动生成' },
  { value: 'delivery', label: '交付准备', hint: '整理输出和交付说明' },
] as const

const ASSET_OPTIONS = [
  { value: 'none', label: '无素材', hint: '完全从 prompt 开始' },
  { value: 'upload', label: '上传参考', hint: '先导入已有图片、视频或音频' },
  { value: 'current', label: '使用当前节点', hint: '把已生成结果继续作为上游素材' },
  { value: 'generated', label: '首帧 / 生成素材', hint: '用关键帧或中间结果继续推进' },
] as const

const PARAMETER_OPTIONS = [
  { value: '16:9-balanced', label: '16:9 电影感', hint: '横版默认比例与平衡细节' },
  { value: '9:16-vertical', label: '9:16 竖屏', hint: '适合短视频和竖屏预览' },
  { value: '1:1-square', label: '1:1 方形', hint: '适合封面和静帧摘要' },
  { value: '16:9-detail', label: '16:9 高细节', hint: '更强调质感与细节占位' },
] as const

// DeepSeek is first — default for CN deployment. OpenAI is available but not prioritized
// because it requires international balance that is frequently exhausted.
const TEXT_NODE_PROVIDER_OPTIONS = [
  { value: 'deepseek-text', label: 'DeepSeek V4 Flash', hint: '推荐 · 中文友好 · 快速', badge: 'available', duration: '10~20s' },
  { value: 'deepseek-reasoner', label: 'DeepSeek V4 Pro', hint: '中文 · 推理增强', badge: 'available', duration: '15~30s' },
  { value: 'kimi-text', label: 'Kimi K2.6', hint: '中文文本 · Kimi', badge: 'available', duration: '10~20s' },
  { value: 'openai-text', label: 'OpenAI Text', hint: '海外 · 需 OpenAI 余额', badge: 'available', duration: '10~20s' },
] as const

const IMAGE_NODE_PROVIDER_OPTIONS = [
  { value: 'volcengine-seedream-image', label: 'Volcengine Seedream Image', hint: '中国图片 · Seedream', duration: '30~90s' },
  { value: 'jimeng-image', label: 'Jimeng Image', hint: '中国图片 · 即梦', duration: '30~90s' },
  { value: 'openai-image', label: 'OpenAI Image', hint: '海外图片 · OpenAI', duration: '30~90s' },
] as const

const VIDEO_NODE_PROVIDER_OPTIONS = [
  { value: 'volcengine-seedance-video', label: 'Volcengine Seedance Video', hint: '中国视频 · Seedance', duration: '2~10 min' },
  { value: 'custom-video-gateway', label: 'Custom Video Gateway', hint: '自有视频生成网关', duration: '1~3 min' },
] as const

const PARAMETER_RATIO_MAP: Record<(typeof PARAMETER_OPTIONS)[number]['value'], string> = {
  '16:9-balanced': '16:9',
  '9:16-vertical': '9:16',
  '1:1-square': '1:1',
  '16:9-detail': '16:9',
}

function getEntryKindLabel(kind: VisualCanvasNodeKind) {
  return kind === 'text'
    ? '文本'
    : kind === 'image'
      ? '图片'
      : kind === 'video'
        ? '视频'
        : kind === 'upload'
          ? '上传'
          : kind === 'audio'
            ? '音频'
            : kind === 'world'
              ? '3D 世界'
              : kind === 'delivery'
                ? '交付'
                : '素材'
}

function getOptionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value
}

function createNodeId(kind: VisualCanvasNodeKind) {
  return `${kind}-${Math.random().toString(36).slice(2, 8)}`
}

function getDefaultPosition(index: number) {
  return {
    x: 420 + index * 34,
    y: 260 + index * 28,
  }
}

function clampCanvasZoom(value: number) {
  return Math.max(MIN_CANVAS_ZOOM, Math.min(value, MAX_CANVAS_ZOOM))
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

function getProviderIdsForKind(kind: VisualCanvasNodeKind) {
  if (kind === 'text') return TEXT_NODE_PROVIDER_OPTIONS.map((provider) => provider.value)
  if (kind === 'image') return IMAGE_NODE_PROVIDER_OPTIONS.map((provider) => provider.value)
  if (kind === 'video') return VIDEO_NODE_PROVIDER_OPTIONS.map((provider) => provider.value)

  const providerKind = getProviderKind(kind)
  const providers = getCanvasProviders(providerKind)
  return providers.length > 0
    ? providers.map((provider) => provider.id)
    : [CANVAS_PROVIDER_FALLBACKS[providerKind]]
}

function normalizeProviderId(providerId: string) {
  if (providerId === 'gpt-5') return 'openai-text'
  if (providerId === 'openai-gpt-images' || providerId === 'openai-images' || providerId === 'openai-image2') return 'openai-image'
  if (providerId === 'openai-text-script') return 'openai-text'
  return providerId
}

function getTextNodeProviderOption(providerId: string) {
  return TEXT_NODE_PROVIDER_OPTIONS.find((provider) => provider.value === providerId) ?? null
}

function getImageNodeProviderOption(providerId: string) {
  return IMAGE_NODE_PROVIDER_OPTIONS.find((provider) => provider.value === providerId) ?? null
}

function getVideoNodeProviderOption(providerId: string) {
  return VIDEO_NODE_PROVIDER_OPTIONS.find((provider) => provider.value === providerId) ?? null
}

function getDefaultImageProviderId(statusMap: Map<string, ImageProviderStatusInfo>) {
  return IMAGE_NODE_PROVIDER_OPTIONS.find((provider) => statusMap.get(provider.value)?.available)?.value ?? null
}

function getDefaultVideoProviderId(statusMap: Map<string, VideoProviderStatusInfo>) {
  return VIDEO_NODE_PROVIDER_OPTIONS.find((provider) => statusMap.get(provider.value)?.available)?.value ?? null
}

function getImageProviderStatus(
  statusMap: Map<string, ImageProviderStatusInfo>,
  providerId: string,
  liveStatusMap: Map<string, ToolProviderStatus>,
  liveStatusLoading: boolean,
) {
  const known = statusMap.get(providerId)
  if (known) return known.available ? 'available' : known.status
  return liveStatusMap.get(normalizeProviderId(providerId)) ?? (liveStatusLoading ? 'checking' : 'unknown')
}

function getVideoProviderStatus(
  statusMap: Map<string, VideoProviderStatusInfo>,
  providerId: string,
  liveStatusMap: Map<string, ToolProviderStatus>,
  liveStatusLoading: boolean,
) {
  const known = statusMap.get(providerId)
  if (known) return known.available ? 'available' : known.status
  return liveStatusMap.get(normalizeProviderId(providerId)) ?? (liveStatusLoading ? 'checking' : 'unknown')
}

function imageProviderUnavailableMessage(providerId: string, info?: ImageProviderStatusInfo) {
  if (providerId === 'openai-image') return 'OPENAI_IMAGE_UNAVAILABLE: OpenAI Image 暂不可用，请配置中国图片 Provider。'
  const missing = info?.missingEnv?.length ? `缺少 ${info.missingEnv.join(', ')}` : '缺少必要环境变量'
  return `PROVIDER_NOT_CONFIGURED: 图片 Provider 未配置，请先在 /admin/providers 配置环境变量。${missing ? `（${missing}）` : ''}`
}

function videoProviderUnavailableMessage(info?: VideoProviderStatusInfo) {
  const missing = info?.missingEnv?.length ? `缺少 ${info.missingEnv.join(', ')}` : '缺少必要环境变量'
  return `PROVIDER_NOT_CONFIGURED: 视频 Provider 未配置，请先在 /admin/providers 配置环境变量。${missing ? `（${missing}）` : ''}`
}

function getProviderKind(kind: VisualCanvasNodeKind): CanvasProviderKind {
  if (kind === 'asset' || kind === 'template') return 'upload'
  return kind as CanvasProviderKind
}

function getProviderNodeType(kind: VisualCanvasNodeKind): ToolProviderNodeType {
  if (kind === 'image') return 'image'
  if (kind === 'video') return 'video'
  if (kind === 'audio') return 'audio'
  return 'text'
}

function getNodeStatusLabel(status: VisualCanvasNode['status']) {
  if (status === 'queued' || status === 'pending') return '排队中'
  if (status === 'running' || status === 'generating' || status === 'processing') return '运行中'
  if (status === 'done') return '完成'
  if (status === 'error' || status === 'failed') return '失败'
  if (status === 'cancelled') return '已停止'
  return '待运行'
}

function getNodeKindForPublicTemplate(nodeType: PublicTemplate['nodeType']): VisualCanvasNodeKind {
  if (nodeType === 'text' || nodeType === 'image' || nodeType === 'video' || nodeType === 'audio') {
    return nodeType
  }
  return 'template'
}

type GenerateApiResult = GenerateResponse & {
  requiredCredits?: number
  availableCredits?: number
  model?: string
  text?: string
  resultText?: string
  imageUrl?: string
  dataUrl?: string
  asset?: { id?: string; url?: string | null; generationJobId?: string | null }
  assetId?: string
  assetUrl?: string
  stableUrl?: string
  resolvedUrl?: string
  proxyUrl?: string
  generationJobId?: string
  signedUrlAvailable?: boolean
  proxyAvailable?: boolean
  storageProvider?: string
  bucket?: string
  storageKey?: string
  displayUrl?: string
  resultImageUrl?: string
  resultVideoUrl?: string
  originalProviderImageUrl?: string
  originalProviderVideoUrl?: string
  providerOriginalUrl?: string
  temporaryUrl?: string
  generationStatus?: string
  persistenceStatus?: string
  assetStatus?: string
  persistenceError?: string
  retryPersistenceAvailable?: boolean
  mediaPersistence?: unknown
  assetIntelligence?: unknown
  warning?: string
  httpStatus?: number
  errorMessage?: string
  upstreamStatus?: number
  upstreamMessage?: string
  errorStage?: string
  stageTrace?: unknown
  executorKind?: string
  generationStage?: string
  stage?: string
    rawCode?: string
    requestId?: string
    ossRequestId?: string
    providerEndpoint?: string
    providerRequestMethod?: string
    providerHttpStatus?: number
    providerFetchError?: string
    providerFetchCause?: unknown
    attemptedUploadKey?: string
    mediaDownloadUrl?: string
    sourceUrl?: string
  requestUrl?: string
  method?: string
  hint?: string
  generationRequestUrl?: string
  generationRequestMethod?: string
  generationHttpStatus?: number
  generationFetchError?: string
  generationResponseTextPreview?: string
  submittedInput?: unknown
  providerResponse?: unknown
  missingEnv?: string[]
  missingEnvKeys?: string[]
  missingFields?: string[]
  async?: boolean
  taskId?: string
  videoUrl?: string
  submittedAt?: string
  completedAt?: string
}

type ImageProviderStatusInfo = {
  providerId: string
  label: string
  configured: boolean
  available: boolean
  status: ToolProviderStatus | 'disabled' | 'unknown'
  missingEnv: string[]
  missingEnvKeys?: string[]
  reason?: string
  model?: string
}

type VideoProviderStatusInfo = ImageProviderStatusInfo

function normalizeGenerateErrorMessage(result: Pick<GenerateApiResult, 'errorCode' | 'message' | 'errorMessage'>) {
  const message = result.errorMessage || result.message || ''
  if (result.errorCode === 'auth_required') return '登录状态失效，请刷新并重新登录'
  if (result.errorCode === 'GENERATION_AUTH_UNAVAILABLE' || result.errorCode === 'DB_CONNECTION_UNAVAILABLE') return '数据库连接繁忙，请稍等几秒后重试。'
  if (result.errorCode === 'OPENAI_RATE_LIMITED' || result.errorCode === 'PROVIDER_RATE_LIMITED' || result.errorCode === 'PROVIDER_BUDGET_EXCEEDED' || result.errorCode === 'PROVIDER_INSUFFICIENT_CREDITS') {
    const prefix = result.errorCode === 'OPENAI_RATE_LIMITED'
      ? 'OpenAI 额度不足或触发限流，请切换至 DeepSeek 或其他可用 Provider 继续生成'
      : 'Provider 额度不足或触发限流，请切换至 DeepSeek 或其他可用 Provider 继续生成'
    return `${prefix}。${message ? `（${message}）` : ''}`
  }
  if (
    result.errorCode === 'KIMI_REQUEST_TIMEOUT'
    || (result.errorCode === 'KIMI_TEXT_FAILED' && message.toLowerCase().includes('abort'))
  ) {
    return 'Kimi 请求超时或被中断，请重试。'
  }
  if (result.errorCode === 'VIDEO_GENERATION_NOT_READY' || result.errorCode === 'video_not_enabled') return '视频生成当前内测中，请使用图片生成。'
  if (result.errorCode === 'generation_stopped_on_reload') return '页面已刷新，生成任务已自动停止。重新生成请点击生成按钮。'
  if (result.errorCode === 'generation_cancelled_by_user') return '已手动停止生成。'
  if (result.errorCode === 'generation_polling_timeout') return '生成轮询超时，任务可能仍在后台运行，请前往资产库（/assets）检查。'
  return message
}

function normalizeVisibleGenerateErrorCode(result: Pick<GenerateApiResult, 'errorCode' | 'httpStatus' | 'generationHttpStatus' | 'upstreamStatus' | 'upstreamMessage' | 'message' | 'missingEnv' | 'missingEnvKeys'>) {
  const errorCode = result.errorCode ?? ''
  const upstreamMessage = result.upstreamMessage ?? ''
  const message = result.message ?? ''
  const haystack = `${errorCode} ${message} ${upstreamMessage}`.toLowerCase()
  const generationHttpStatus = result.generationHttpStatus ?? result.httpStatus
  if (errorCode === 'auth_required' || errorCode === 'UNAUTHORIZED' || errorCode === 'UNAUTHENTICATED' || generationHttpStatus === 401) return 'auth_required'
  if (errorCode === 'GENERATION_AUTH_UNAVAILABLE' || errorCode === 'DB_CONNECTION_UNAVAILABLE') return 'generation_auth_unavailable'
  if (errorCode === 'OPENAI_RATE_LIMITED' || errorCode === 'PROVIDER_RATE_LIMITED' || errorCode === 'PROVIDER_BUDGET_EXCEEDED' || errorCode === 'PROVIDER_INSUFFICIENT_CREDITS') return 'provider_quota_or_billing_error'
  if (errorCode === 'OPENAI_AUTH_FAILED' || errorCode === 'PROVIDER_AUTH_FAILED') return 'provider_auth_failed'
  if (errorCode === 'api_error' || (typeof generationHttpStatus === 'number' && generationHttpStatus >= 500)) return 'api_error'
  if (errorCode === 'client_fetch_failed') return 'client_fetch_failed'
  if (errorCode === 'MISSING_GENERATION_INPUT' || errorCode === 'missing_generation_input' || errorCode === 'missing_or_invalid_video_input') return 'missing_generation_input'
  const hasMissingEnv = Boolean(result.missingEnvKeys?.length || result.missingEnv?.length)
  if (hasMissingEnv || errorCode === 'PROVIDER_NOT_CONFIGURED' || errorCode === 'provider_env_missing' || errorCode.includes('MODEL_REQUIRED') || haystack.includes('not configured')) return 'provider_env_missing'
  if (errorCode === 'oss_upload_timeout' || errorCode === 'oss_upload_error' || errorCode === 'oss_auth_error' || errorCode === 'oss_permission_error' || errorCode === 'oss_config_error') return errorCode
  if (errorCode === 'canvas_save_error') return 'canvas_save_error'
  if (errorCode === 'provider_media_download_failed' || errorCode === 'PROVIDER_MEDIA_DOWNLOAD_FAILED' || errorCode === 'MEDIA_FETCH_FAILED' || errorCode === 'ASSET_DOWNLOAD_FAILED' || errorCode === 'ASSET_DOWNLOAD_ERROR' || errorCode === 'ASSET_DOWNLOAD_TIMEOUT' || /media download failed|download failed|external asset/.test(haystack)) return 'provider_media_download_failed'
  if (errorCode === 'generation_post_timeout' || errorCode === 'executor_trigger_timeout' || errorCode === 'executor_not_started' || errorCode === 'generation_job_stalled' || errorCode === 'video_status_auth_required') return errorCode
    if (errorCode === 'provider_timeout' || /timeout|abort/.test(haystack)) return 'provider_timeout'
    if (errorCode === 'provider_network_failed' || /fetch failed|failed to fetch|network|econn|enotfound|dns/.test(haystack)) return 'provider_network_failed'
    if (errorCode === 'provider_request_failed') return 'provider_request_failed'
    if (result.upstreamStatus === 401 || result.upstreamStatus === 403 || /auth|unauthorized|forbidden|permission|access denied/.test(haystack)) return 'provider_auth_failed'
  if (result.upstreamStatus === 402 || result.upstreamStatus === 429 || /quota|billing|credits|insufficient|余额|额度|rate limit/.test(haystack)) return 'provider_quota_or_billing_error'
  if (/invalid parameter|invalid_param|invalid request|bad request|parameter/.test(haystack)) return 'provider_invalid_parameter'
  if (/prompt.*reject|rejected|sensitive|违规|不合规|blocked/.test(haystack)) return 'prompt_rejected_or_invalid'
  if (errorCode === 'PROVIDER_NO_DOWNLOAD_URL' || errorCode === 'provider_no_download_url' || errorCode === 'VIDEO_URL_EMPTY' || errorCode === 'IMAGE_URL_EMPTY' || errorCode.includes('URL_MISSING') || errorCode.includes('URL_EMPTY')) return 'provider_no_download_url'
  if (errorCode === 'MEDIA_UPLOAD_FAILED' || errorCode === 'oss_upload_error') return 'oss_upload_error'
  if (errorCode === 'MEDIA_ASSET_CREATE_FAILED' || errorCode === 'MEDIA_PERSISTENCE_FAILED' || errorCode === 'MEDIA_PERSIST_FAILED' || errorCode === 'asset_persistence_error') return 'asset_persistence_error'
  if (/canvas|save/.test(haystack)) return 'canvas_save_error'
  if (errorCode === 'VIDEO_GENERATION_NOT_READY' || errorCode === 'video_not_enabled') return 'video_not_enabled'
  if (errorCode === 'generation_stopped_on_reload') return 'generation_stopped_on_reload'
  if (errorCode === 'generation_cancelled_by_user') return 'generation_cancelled_by_user'
  if (errorCode === 'generation_polling_timeout') return 'generation_polling_timeout'
  return errorCode ? 'generation_failed' : ''
}

function formatGenerateError(result: GenerateApiResult) {
  const visibleCode = normalizeVisibleGenerateErrorCode(result)
  const message = normalizeGenerateErrorMessage(result)
  if (visibleCode === 'auth_required') return '登录状态失效，请刷新并重新登录'
  // When upstream signals quota/rate-limit via status code or keywords but the specific errorCode
  // wasn't handled by normalizeGenerateErrorMessage, produce a user-friendly Chinese message.
  if (visibleCode === 'provider_quota_or_billing_error' && !message.includes('额度') && !message.includes('DeepSeek')) {
    return `Provider 额度不足或触发限流，请切换至 DeepSeek 或其他可用 Provider 继续生成。${message ? `（${message}）` : ''}`
  }
  return message || visibleCode || '生成失败'
}

function getGeneratedText(result: GenerateApiResult) {
  return result.result?.text ?? result.resultText ?? result.text
}

function metadataRecord(metadataJson: unknown) {
  return metadataJson && typeof metadataJson === 'object' && !Array.isArray(metadataJson)
    ? metadataJson as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function summarizeUrlForDiagnostics(url?: string) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.host,
      pathnameTail: pathParts.slice(-2).join('/'),
      hasQuery: Boolean(parsed.search),
    }
  } catch {
    return { kind: url.startsWith('data:') ? 'data-url' : 'non-url', length: url.length }
  }
}

function mediaPersistenceRecord(metadata: Record<string, unknown>) {
  return metadata.mediaPersistence && typeof metadata.mediaPersistence === 'object' && !Array.isArray(metadata.mediaPersistence)
    ? metadata.mediaPersistence as Record<string, unknown>
    : {}
}

function persistenceFromGenerateResult(result: GenerateApiResult) {
  return result.mediaPersistence && typeof result.mediaPersistence === 'object' && !Array.isArray(result.mediaPersistence)
    ? result.mediaPersistence as Record<string, unknown>
    : {}
}

function isPersistencePendingResult(result: GenerateApiResult) {
  const mediaPersistence = persistenceFromGenerateResult(result)
  return result.persistenceStatus === 'pending_persistence'
    || result.assetStatus === 'pending_persistence'
    || stringValue(mediaPersistence.status) === 'pending_persistence'
    || stringValue(mediaPersistence.persistenceStatus) === 'pending_persistence'
}

function displayUrlFromGenerateResult(result: GenerateApiResult) {
  const resultMetadata = result.result?.metadata && typeof result.result.metadata === 'object'
    ? result.result.metadata as Record<string, unknown>
    : {}
  const mediaPersistence = persistenceFromGenerateResult(result)
  return stringValue(result.displayUrl)
    || result.resolvedUrl
    || result.stableUrl
    || result.assetUrl
    || result.result?.imageUrl
    || result.resultImageUrl
    || result.imageUrl
    || result.dataUrl
    || result.result?.videoUrl
    || result.resultVideoUrl
    || result.videoUrl
    || result.providerOriginalUrl
    || result.temporaryUrl
    || result.originalProviderImageUrl
    || result.originalProviderVideoUrl
    || stringValue(resultMetadata.providerOriginalUrl)
    || stringValue(resultMetadata.temporaryUrl)
    || stringValue(mediaPersistence.providerOriginalUrl)
    || stringValue(mediaPersistence.temporaryUrl)
    || ''
}

function nestedRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/s$/i, ''))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function nodeParamValue(node: VisualCanvasNode, key: string) {
  const nodeRecord = node as unknown as Record<string, unknown>
  const metadata = metadataRecord(node.metadataJson)
  const params = nestedRecord(metadata.params)
  const generationParams = nestedRecord(metadata.generationParams)
  const requestParams = nestedRecord(metadata.submittedInput)
  const nodeParams = nestedRecord(nodeRecord.params)
  return metadata[key]
    ?? params[key]
    ?? generationParams[key]
    ?? requestParams[key]
    ?? nodeParams[key]
    ?? nodeRecord[key]
}

function buildRegenerationParams(node: VisualCanvasNode) {
  const negativePrompt = stringValue(nodeParamValue(node, 'negativePrompt'))
    || stringValue(nodeParamValue(node, 'negative_prompt'))
  const aspectRatio = stringValue(nodeParamValue(node, 'aspectRatio'))
    || stringValue(nodeParamValue(node, 'ratio'))
    || stringValue(node.ratio)
    || '16:9'
  const duration = numberValue(nodeParamValue(node, 'duration'))
  const resolution = stringValue(nodeParamValue(node, 'resolution'))
    || stringValue(nodeParamValue(node, 'quality'))
    || stringValue(nodeParamValue(node, 'size'))
  return {
    ratio: aspectRatio,
    aspectRatio,
    ...(node.kind === 'video' ? { duration: duration ?? 5 } : duration ? { duration } : {}),
    ...(resolution ? { resolution, size: resolution } : {}),
    ...(negativePrompt ? { negativePrompt } : {}),
  } satisfies Record<string, string | number | boolean | undefined>
}

function isProviderAccessibleUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function buildRegenerationInputAssets(node: VisualCanvasNode): Array<{ id: string; type: string; url?: string }> | undefined {
  const candidates = [
    stringValue(nodeParamValue(node, 'imageUrl')),
    stringValue(nodeParamValue(node, 'sourceImageUrl')),
    stringValue(nodeParamValue(node, 'firstFrameUrl')),
    stringValue(nodeParamValue(node, 'referenceImageUrl')),
    stringValue(nodeParamValue(node, 'referenceUrl')),
  ].filter((url): url is string => Boolean(url) && isProviderAccessibleUrl(url))
  const imageUrl = candidates[0]
  if (!imageUrl) return undefined
  return [{ id: `${node.id}-reference-image`, type: 'image', url: imageUrl }]
}

function defaultProviderForRegenerationNode(node: VisualCanvasNode) {
  if (node.kind === 'image') return IMAGE_NODE_PROVIDER_OPTIONS[0]?.value ?? 'volcengine-seedream-image'
  if (node.kind === 'video') return VIDEO_NODE_PROVIDER_OPTIONS[0]?.value ?? 'volcengine-seedance-video'
  return ''
}

function defaultModelForRegenerationNode(node: VisualCanvasNode, providerId: string) {
  if (node.kind === 'image') return providerId || IMAGE_NODE_PROVIDER_OPTIONS[0]?.value || NODE_META.image.model
  if (node.kind === 'video') return providerId || VIDEO_NODE_PROVIDER_OPTIONS[0]?.value || NODE_META.video.model
  return providerId
}

function providerForRegenerationNode(node: VisualCanvasNode) {
  const metadata = metadataRecord(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  const submittedInput = nestedRecord(metadata.submittedInput)
  const lastGenerationError = nestedRecord(metadata.lastGenerationError)
  return stringValue(metadata.providerId)
    || stringValue(metadata.provider)
    || stringValue(metadata.sourceProvider)
    || stringValue(metadata.generationSource)
    || stringValue(mediaPersistence.providerId)
    || stringValue(mediaPersistence.provider)
    || stringValue(mediaPersistence.sourceProvider)
    || stringValue(submittedInput.providerId)
    || stringValue(lastGenerationError.providerId)
    || stringValue(node.providerId)
    || stringValue(node.model)
}

function modelForRegenerationNode(node: VisualCanvasNode) {
  const metadata = metadataRecord(node.metadataJson)
  const submittedInput = nestedRecord(metadata.submittedInput)
  const lastGenerationError = nestedRecord(metadata.lastGenerationError)
  return stringValue(metadata.model)
    || stringValue(nodeParamValue(node, 'model'))
    || stringValue(submittedInput.model)
    || stringValue(lastGenerationError.model)
    || stringValue(node.model)
}

function getNodeAssetId(node: VisualCanvasNode) {
  const nodeRecord = node as unknown as Record<string, unknown>
  const metadata = metadataRecord(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  const topMediaPersistence = nestedRecord(nodeRecord.mediaPersistence)
  const assetRecord = nestedRecord(metadata.asset)
  const nodeData = nestedRecord(nodeRecord.data)
  const generationJob = nestedRecord(metadata.generationJob)
  const topGenerationJob = nestedRecord(nodeRecord.generationJob)
  const generationResult = nestedRecord(metadata.generationResult)
  const pluginResult = nestedRecord(metadata.pluginResult)
  return (
    stringValue(node.assetId) ||
    stringValue(nodeData.assetId) ||
    stringValue(nodeRecord.resultAssetId) ||
    stringValue(nodeRecord.mediaAssetId) ||
    stringValue(metadata.assetId) ||
    stringValue(assetRecord.id) ||
    stringValue(metadata.asset_id) ||
    stringValue(metadata.mediaAssetId) ||
    stringValue(metadata.resultAssetId) ||
    stringValue(metadata.result_asset_id) ||
    stringValue(metadata.media_asset_id) ||
    stringValue(metadata.outputAssetId) ||
    stringValue(generationJob.outputAssetId) ||
    stringValue(topGenerationJob.outputAssetId) ||
    stringValue(generationResult.outputAssetId) ||
    stringValue(pluginResult.outputAssetId) ||
    stringValue(mediaPersistence.assetId) ||
    stringValue(mediaPersistence.outputAssetId) ||
    stringValue(topMediaPersistence.assetId) ||
    stringValue(topMediaPersistence.outputAssetId)
  )
}

function legacyMediaUrlForNode(node: VisualCanvasNode) {
  if (node.kind === 'image') return getNodeImageUrl(node)
  if (node.kind === 'video') return getNodeVideoUrl(node)
  return ''
}

function unresolvedLegacyStatus(url: string) {
  const lower = url.toLowerCase()
  if (!url) return 'no_recovery_source'
  if (lower.startsWith('blob:')) return 'unrecoverable_blob_url'
  if (!/^https?:\/\//i.test(url) && !lower.startsWith('data:')) return 'no_recovery_source'
  if (/x-tos-signature|x-tos-expires|x-amz-signature|x-amz-expires|x-oss-signature|x-oss-expires|signature=|expires=|security-token=/i.test(url)) {
    return 'needs_signed_url'
  }
  // Use 'old_url_expired' for consistency with CanvasNodeCard audit terminal state.
  // Both sides writing the same code prevents the oscillation loop where
  // workspace writes 'provider_error' ↔ audit writes 'old_url_expired' indefinitely.
  return 'old_url_expired'
}

function applyResolvedAssetToNode(node: VisualCanvasNode, result: CanvasAssetResolveResult): VisualCanvasNode {
  const metadata = metadataRecord(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  const displayUrl = result.resolvedUrl || result.proxyUrl || ''
  const nextMetadata = {
    ...metadata,
    assetId: result.assetId,
    assetResolveStatus: result.status,
    recoveryStatus: result.recoveryStatus ?? result.status,
    ...(result.proxyUrl ? { proxyUrl: result.proxyUrl } : {}),
    signedUrlAvailable: result.signedUrlAvailable ?? null,
    proxyAvailable: result.proxyAvailable ?? Boolean(result.proxyUrl),
    ...(result.storageKey ? { storageKey: result.storageKey } : {}),
    ...(result.storageProvider ? { storageProvider: result.storageProvider } : {}),
    ...(result.bucket ? { bucket: result.bucket } : {}),
    ...(result.providerJobId ? { providerJobId: result.providerJobId } : {}),
    ...(result.error ? { error: result.error } : {}),
    ...(result.errorCode ? { errorCode: result.errorCode } : {}),
    ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    ...(result.nextAction ? { nextAction: result.nextAction } : {}),
    ...(typeof result.proxyHttpStatus === 'number' ? { proxyHttpStatus: result.proxyHttpStatus } : {}),
    ...(result.proxyErrorCode ? { proxyErrorCode: result.proxyErrorCode } : {}),
    ...(result.proxyErrorMessage ? { proxyErrorMessage: result.proxyErrorMessage } : {}),
    ...(result.proxyRejectedHost ? { proxyRejectedHost: result.proxyRejectedHost } : {}),
    p0LastResolveResult: result,
    p0LastResolveAt: new Date().toISOString(),
    mediaPersistence: {
      ...mediaPersistence,
      status: result.status === 'ready' ? 'persisted' : result.status,
      assetId: result.assetId,
      storageKey: result.storageKey ?? mediaPersistence.storageKey,
      storageProvider: result.storageProvider ?? mediaPersistence.storageProvider,
      bucket: result.bucket ?? mediaPersistence.bucket,
      providerJobId: result.providerJobId ?? mediaPersistence.providerJobId,
      ...(result.proxyUrl ? { proxyUrl: result.proxyUrl } : {}),
      resolvedAt: new Date().toISOString(),
    },
  }
  if (result.status !== 'ready' || !displayUrl) {
    return {
      ...node,
      assetId: result.assetId,
      errorMessage: result.errorMessage ?? result.error ?? result.errorCode ?? node.errorMessage,
      metadataJson: nextMetadata,
    }
  }
  return {
    ...node,
    assetId: result.assetId,
    ...(node.kind === 'image' ? { resultImageUrl: displayUrl } : {}),
    ...(node.kind === 'video' ? { resultVideoUrl: displayUrl, preview: { ...(node.preview ?? { type: 'remote-video' as const }), type: 'remote-video' as const, url: displayUrl, poster: result.thumbnailUrl ?? node.preview?.poster } } : {}),
    metadataJson: {
      ...nextMetadata,
      ...(result.resolvedUrl ? { assetUrl: result.resolvedUrl, resolvedUrl: result.resolvedUrl, stableUrl: result.resolvedUrl } : {}),
    },
  }
}

function recoveryResolveResultFromPatch(patch: Partial<VisualCanvasNode>): CanvasAssetResolveResult | null {
  const metadata = metadataRecord(patch.metadataJson)
  const recovery = metadataRecord(metadata.p0LastRecoveryResult)
  const assetId = stringValue(patch.assetId)
    || stringValue(metadata.assetId)
    || stringValue(recovery.assetId)
  const resolvedUrl = stringValue(patch.resultImageUrl)
    || stringValue(patch.resultVideoUrl)
    || stringValue(metadata.resolvedUrl)
    || stringValue(metadata.assetUrl)
    || stringValue(metadata.stableUrl)
    || stringValue(recovery.resolvedUrl)
    || stringValue(recovery.assetUrl)
    || stringValue(recovery.stableUrl)
  const recoveryStatus = stringValue(metadata.recoveryStatus) || stringValue(recovery.recoveryStatus)
  if (!assetId || !resolvedUrl || recoveryStatus !== 'ready') return null
  return {
    assetId,
    status: 'ready',
    resolvedUrl,
    proxyUrl: stringValue(metadata.proxyUrl) || stringValue(recovery.proxyUrl) || stringValue(recovery.proxyFallbackUrl) || null,
    signedUrlAvailable: typeof metadata.signedUrlAvailable === 'boolean'
      ? metadata.signedUrlAvailable
      : typeof recovery.signedUrlAvailable === 'boolean'
        ? recovery.signedUrlAvailable
        : null,
    proxyAvailable: typeof metadata.proxyAvailable === 'boolean'
      ? metadata.proxyAvailable
      : typeof recovery.proxyAvailable === 'boolean'
        ? recovery.proxyAvailable
        : null,
    thumbnailUrl: null,
    storageKey: stringValue(metadata.storageKey) || stringValue(recovery.storageKey) || null,
    storageProvider: stringValue(metadata.storageProvider) || stringValue(recovery.storageProvider) || null,
    bucket: stringValue(metadata.bucket) || stringValue(recovery.bucket) || null,
    providerJobId: stringValue(metadata.providerJobId) || stringValue(recovery.providerJobId) || null,
    recoveryStatus: 'ready',
    error: null,
    actionTaken: stringValue(recovery.actionTaken) || stringValue(recovery.action) || null,
  }
}


function compactText(value: string | undefined, limit: number) {
  const text = value?.trim() ?? ''
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function normalizeStyleBible(input: unknown): ProjectStyleBible {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const record = input as Record<string, unknown>
  const read = (key: keyof ProjectStyleBible) => typeof record[key] === 'string' ? String(record[key]) : undefined
  const keywords = Array.isArray(record.referenceKeywords)
    ? record.referenceKeywords.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : undefined
  return {
    logline: read('logline'),
    storyWorld: read('storyWorld'),
    visualStyle: read('visualStyle'),
    colorPalette: read('colorPalette'),
    cameraLanguage: read('cameraLanguage'),
    characterRules: read('characterRules'),
    sceneRules: read('sceneRules'),
    negativeRules: read('negativeRules'),
    referenceKeywords: keywords,
    updatedAt: read('updatedAt'),
  }
}

function workflowStyleBible(metadataJson: unknown) {
  const metadata = metadataRecord(metadataJson)
  return metadata.styleBible ? normalizeStyleBible(metadata.styleBible) : null
}

function workflowCharacterBible(metadataJson: unknown) {
  const metadata = metadataRecord(metadataJson)
  return metadata.characterBible ? loadCharacterBible('', metadataJson) : null
}

function workflowSceneBible(metadataJson: unknown) {
  const metadata = metadataRecord(metadataJson)
  return metadata.sceneBible ? loadSceneBible('', metadataJson) : null
}

function persistWorkflowStyleBibleFallback(projectId: string, metadataJson: unknown) {
  if (typeof window === 'undefined' || !projectId) return
  const fromWorkflow = workflowStyleBible(metadataJson)
  if (!fromWorkflow) return
  try {
    window.localStorage.setItem(getStyleBibleKey(projectId), JSON.stringify(fromWorkflow))
  } catch {
    // Style Bible also remains in memory if localStorage is unavailable.
  }
}

function persistWorkflowCharacterBibleFallback(projectId: string, metadataJson: unknown) {
  if (typeof window === 'undefined' || !projectId) return
  const fromWorkflow = workflowCharacterBible(metadataJson)
  if (!fromWorkflow) return
  saveCharacterBible(projectId, fromWorkflow)
}

function persistWorkflowSceneBibleFallback(projectId: string, metadataJson: unknown) {
  if (typeof window === 'undefined' || !projectId) return
  const fromWorkflow = workflowSceneBible(metadataJson)
  if (!fromWorkflow) return
  saveSceneBible(projectId, fromWorkflow)
}

function edgeDirectorRecord(metadataJson: unknown) {
  const metadata = metadataRecord(metadataJson)
  return metadataRecord(metadata.edgeDirector)
}

type CharacterContextEdge = {
  fromNodeId: string
  toNodeId: string
  metadataJson?: unknown
}

function edgeRequestsCharacterInheritance(edge: CharacterContextEdge) {
  const config = getEdgeDirectorConfig(edge.metadataJson)
  if (config) return config.type === 'character-lock' || config.inheritCharacter
  const director = edgeDirectorRecord(edge.metadataJson)
  return director.characterLock === true || director.inheritCharacter === true
}

function edgeLocksCharacter(edge: CharacterContextEdge) {
  const config = getEdgeDirectorConfig(edge.metadataJson)
  if (config) return config.type === 'character-lock'
  return edgeDirectorRecord(edge.metadataJson).characterLock === true
}

function edgeRequestsSceneInheritance(edge: CharacterContextEdge) {
  const config = getEdgeDirectorConfig(edge.metadataJson)
  if (config) return config.type === 'scene-continuity' || config.inheritScene
  const director = edgeDirectorRecord(edge.metadataJson)
  return director.inheritScene === true
}

function edgeLocksScene(edge: CharacterContextEdge) {
  const config = getEdgeDirectorConfig(edge.metadataJson)
  if (config) return config.type === 'scene-continuity'
  return edgeDirectorRecord(edge.metadataJson).sceneContinuity === true
}

function resolveCharacterPromptContext({
  node,
  upstreamNodes,
  incomingEdges,
  characterBible,
}: {
  node: VisualCanvasNode
  upstreamNodes: VisualCanvasNode[]
  incomingEdges: CharacterContextEdge[]
  characterBible: CharacterBible
}) {
  const ownIds = getNodeCharacterIds(node)
  const upstreamById = new Map(upstreamNodes.map((upstreamNode) => [upstreamNode.id, upstreamNode]))
  const inheritedCharacterIds = incomingEdges
    .filter(edgeRequestsCharacterInheritance)
    .flatMap((edge) => getNodeCharacterIds(upstreamById.get(edge.fromNodeId)))
  const characterIds = [...new Set([...ownIds, ...inheritedCharacterIds])]
  const characterIdSet = new Set(characterIds)
  const inheritedCharacterIdSet = new Set(inheritedCharacterIds)
  const characters = characterBible.characters.filter((character) => characterIdSet.has(character.id))
  const inheritedCharacters = characterBible.characters.filter((character) => inheritedCharacterIdSet.has(character.id))
  return {
    characters,
    boundCharacters: characterBible.characters.filter((character) => ownIds.includes(character.id)),
    inheritedCharacters,
    inheritedCharacterIdsFromEdges: [...new Set(inheritedCharacterIds)],
    lockCharacterConsistency: incomingEdges.some(edgeLocksCharacter),
  }
}

function creativeAssetLabelForNode(node: VisualCanvasNode) {
  const characterCount = getNodeCharacterIds(node).length
  const sceneCount = getNodeSceneIds(node).length
  if (characterCount && sceneCount) return `角色 ${characterCount} · 场景 ${sceneCount}`
  if (characterCount) return `角色 ${characterCount}`
  if (sceneCount) return `场景 ${sceneCount}`
  return '创作资产'
}

function resolveScenePromptContext({
  node,
  upstreamNodes,
  incomingEdges,
  sceneBible,
}: {
  node: VisualCanvasNode
  upstreamNodes: VisualCanvasNode[]
  incomingEdges: CharacterContextEdge[]
  sceneBible: SceneBible
}) {
  const ownIds = getNodeSceneIds(node)
  const upstreamById = new Map(upstreamNodes.map((upstreamNode) => [upstreamNode.id, upstreamNode]))
  const inheritedSceneIds = incomingEdges
    .filter(edgeRequestsSceneInheritance)
    .flatMap((edge) => getNodeSceneIds(upstreamById.get(edge.fromNodeId)))
  const sceneIds = [...new Set([...ownIds, ...inheritedSceneIds])]
  const sceneIdSet = new Set(sceneIds)
  const inheritedSceneIdSet = new Set(inheritedSceneIds)
  const scenes = sceneBible.scenes.filter((scene) => sceneIdSet.has(scene.id))
  const inheritedScenes = sceneBible.scenes.filter((scene) => inheritedSceneIdSet.has(scene.id))
  return {
    scenes,
    boundScenes: sceneBible.scenes.filter((scene) => ownIds.includes(scene.id)),
    inheritedScenes,
    inheritedSceneIdsFromEdges: [...new Set(inheritedSceneIds)],
    lockSceneConsistency: incomingEdges.some(edgeLocksScene),
  }
}

function deriveStyleBibleTemplate(nodes: VisualCanvasNode[], current: ProjectStyleBible): ProjectStyleBible {
  const textSeed = nodes
    .map((node) => node.resultText || node.prompt || node.resultPreview)
    .filter((value): value is string => Boolean(value?.trim()))
    .join('\n')
  const seed = compactText(textSeed, 280)
  return {
    ...current,
    logline: current.logline || seed || '一句话描述项目核心冲突、主角和目标。',
    storyWorld: current.storyWorld || '设定故事发生的地点、时代、社会规则和世界观边界。',
    visualStyle: current.visualStyle || '电影感、写实质感、统一媒介语言和高制作值。',
    colorPalette: current.colorPalette || '定义主色调、辅助色、光影对比和整体氛围。',
    cameraLanguage: current.cameraLanguage || '定义景别、焦段、机位、构图、运动方式和摄影风格。',
    characterRules: current.characterRules || '定义主角外貌、服装、道具、年龄、身份和不可改变特征。',
    sceneRules: current.sceneRules || '定义主要场景结构、建筑/室内外、天气和时代符号。',
    negativeRules: current.negativeRules || '避免风格漂移、角色变形、年龄变化、场景时代错乱和低质量画面。',
    updatedAt: new Date().toISOString(),
  }
}

function textSuccessMetadata(node: VisualCanvasNode, result: GenerateApiResult, providerId: string) {
  return {
    ...metadataRecord(node.metadataJson),
    model: result.model ?? result.result?.metadata?.model,
    providerId: result.providerId || providerId,
  }
}

function textErrorMetadata(node: VisualCanvasNode, result: GenerateApiResult) {
  return {
    ...metadataRecord(node.metadataJson),
    lastError: {
      errorCode: result.errorCode,
      message: normalizeGenerateErrorMessage(result),
      upstreamStatus: result.upstreamStatus,
      upstreamMessage: result.upstreamMessage,
      rawCode: result.rawCode,
      requestId: result.requestId,
      submittedInput: result.submittedInput,
      providerResponse: result.providerResponse,
      at: new Date().toISOString(),
    },
  }
}

function imageSuccessMetadata(node: VisualCanvasNode, result: GenerateApiResult, providerId: string) {
  const resultMetadata = result.result?.metadata && typeof result.result.metadata === 'object'
    ? result.result.metadata as Record<string, unknown>
    : {}
  const persistedMedia = persistenceFromGenerateResult(result)
  const persistencePending = isPersistencePendingResult(result)
  const displayUrl = displayUrlFromGenerateResult(result)
  const resultImageUrl = result.result?.imageUrl ?? result.resultImageUrl ?? result.imageUrl ?? result.dataUrl ?? displayUrl
  const assetUrl = typeof resultMetadata.assetUrl === 'string'
    ? resultMetadata.assetUrl
    : result.assetUrl || result.asset?.url || undefined
  const resolvedUrl = result.resolvedUrl
    || (typeof resultMetadata.resolvedUrl === 'string' ? resultMetadata.resolvedUrl : undefined)
    || (typeof persistedMedia.resolvedUrl === 'string' ? persistedMedia.resolvedUrl : undefined)
  const stableUrl = result.stableUrl
    || (typeof resultMetadata.stableUrl === 'string' ? resultMetadata.stableUrl : undefined)
    || resolvedUrl
    || assetUrl
    || resultImageUrl
  const proxyUrl = result.proxyUrl
    || (typeof resultMetadata.proxyUrl === 'string' ? resultMetadata.proxyUrl : undefined)
    || (typeof persistedMedia.proxyUrl === 'string' ? persistedMedia.proxyUrl : undefined)
  const assetId = result.asset?.id ?? result.assetId ?? (typeof resultMetadata.assetId === 'string' ? resultMetadata.assetId : undefined)
  const generationJobId = result.generationJobId
    ?? result.jobId
    ?? result.billingJobId
    ?? (typeof resultMetadata.generationJobId === 'string' ? resultMetadata.generationJobId : undefined)
    ?? result.asset?.generationJobId
  return {
    ...metadataRecord(node.metadataJson),
    providerId: result.providerId || providerId,
    model: result.model ?? resultMetadata.model,
    generationSource: result.providerId || providerId,
    generationStatus: result.generationStatus ?? 'generation_success',
    persistenceStatus: persistencePending ? 'pending_persistence' : result.persistenceStatus ?? 'persistence_success',
    assetStatus: persistencePending ? 'pending_persistence' : result.assetStatus ?? (assetId ? 'ready' : undefined),
    recoveryStatus: persistencePending ? 'pending_persistence' : 'ready',
    mediaRecoveryStatus: 'regenerated',
    nextAction: persistencePending ? 'retry_persistence' : 'show_media',
    isRecovering: false,
    recovering: false,
    loading: false,
    isRegenerating: false,
    regenerating: false,
    errorCode: null,
    errorMessage: null,
    lastError: null,
    lastGenerationError: null,
    assetId,
    outputAssetId: assetId,
    generationJobId,
    generationJob: {
      ...metadataRecord(metadataRecord(node.metadataJson).generationJob),
      ...(generationJobId ? { id: generationJobId } : {}),
      ...(assetId ? { outputAssetId: assetId } : {}),
    },
    resultImageUrl: stableUrl || resultImageUrl || displayUrl,
    ...(persistencePending ? {} : { assetUrl: stableUrl || assetUrl }),
    ...(stableUrl ? (persistencePending ? { stableUrl } : { resolvedUrl: stableUrl, stableUrl }) : {}),
    ...(proxyUrl ? { proxyUrl } : {}),
    signedUrlAvailable: result.signedUrlAvailable ?? (assetUrl ? true : undefined),
    proxyAvailable: result.proxyAvailable ?? Boolean(proxyUrl),
    storageProvider: result.storageProvider ?? (typeof persistedMedia.storageProvider === 'string' ? persistedMedia.storageProvider : resultMetadata.storageProvider),
    bucket: result.bucket ?? (typeof persistedMedia.bucket === 'string' ? persistedMedia.bucket : resultMetadata.bucket),
    storageKey: result.storageKey ?? (typeof persistedMedia.storageKey === 'string' ? persistedMedia.storageKey : resultMetadata.storageKey),
    originalProviderImageUrl: result.originalProviderImageUrl ?? (typeof resultMetadata.originalProviderImageUrl === 'string' ? resultMetadata.originalProviderImageUrl : undefined),
    providerOriginalUrl: result.providerOriginalUrl ?? (typeof resultMetadata.providerOriginalUrl === 'string' ? resultMetadata.providerOriginalUrl : result.originalProviderImageUrl ?? displayUrl),
    temporaryUrl: result.temporaryUrl ?? (typeof resultMetadata.temporaryUrl === 'string' ? resultMetadata.temporaryUrl : result.providerOriginalUrl ?? result.originalProviderImageUrl ?? displayUrl),
    persistenceError: result.persistenceError ?? (typeof resultMetadata.persistenceError === 'string' ? resultMetadata.persistenceError : undefined),
    retryPersistenceAvailable: result.retryPersistenceAvailable ?? (typeof resultMetadata.retryPersistenceAvailable === 'boolean' ? resultMetadata.retryPersistenceAvailable : persistencePending && Boolean(assetId)),
    attemptedUploadKey: result.attemptedUploadKey ?? (typeof resultMetadata.attemptedUploadKey === 'string' ? resultMetadata.attemptedUploadKey : undefined),
    ossRequestId: result.ossRequestId ?? (typeof resultMetadata.ossRequestId === 'string' ? resultMetadata.ossRequestId : undefined),
    submittedInput: result.submittedInput ?? resultMetadata.submittedInput,
    providerResponse: result.providerResponse ?? resultMetadata.providerResponse,
    mediaPersistence: {
      ...metadataRecord(resultMetadata.mediaPersistence),
      ...metadataRecord(result.mediaPersistence),
      status: persistencePending ? 'pending_persistence' : stringValue(persistedMedia.status) || 'persisted',
      persistenceStatus: persistencePending ? 'pending_persistence' : stringValue(persistedMedia.persistenceStatus) || 'persistence_success',
      ...(assetId ? { assetId, outputAssetId: assetId } : {}),
      ...(stableUrl ? { stableUrl, resolvedUrl: stableUrl } : {}),
    },
    assetIntelligence: result.assetIntelligence ?? resultMetadata.assetIntelligence ?? metadataRecord(node.metadataJson).assetIntelligence,
    ...(result.warning ? { mediaPersistenceWarning: result.warning } : {}),
  }
}

function imageRunningMetadata(node: VisualCanvasNode, result: GenerateApiResult, providerId: string) {
  const resultMetadata = result.result?.metadata && typeof result.result.metadata === 'object'
    ? result.result.metadata as Record<string, unknown>
    : {}
  const taskId = result.taskId ?? (typeof resultMetadata.taskId === 'string' ? resultMetadata.taskId : undefined)
  const generationJobId = result.generationJobId
    ?? result.jobId
    ?? result.billingJobId
    ?? (typeof resultMetadata.generationJobId === 'string' ? resultMetadata.generationJobId : undefined)
    ?? taskId
  return {
    ...metadataRecord(node.metadataJson),
    providerId: result.providerId || providerId,
    model: result.model ?? (typeof resultMetadata.model === 'string' ? resultMetadata.model : undefined),
    taskId,
    generationJobId,
    generationStatus: 'generation_running',
    recoveryStatus: 'regenerating',
    mediaRecoveryStatus: 'regenerating',
    nextAction: 'poll_generation_status',
    loading: true,
    isRegenerating: true,
    regenerating: true,
    errorCode: null,
    errorMessage: null,
    lastError: null,
    lastGenerationError: null,
    submittedInput: result.submittedInput ?? resultMetadata.submittedInput,
    generationJob: {
      ...metadataRecord(metadataRecord(node.metadataJson).generationJob),
      ...(generationJobId ? { id: generationJobId } : {}),
    },
  }
}

function imageErrorMetadata(node: VisualCanvasNode, result: Pick<GenerateApiResult, 'errorCode' | 'message' | 'errorMessage' | 'httpStatus' | 'upstreamStatus' | 'upstreamMessage' | 'errorStage' | 'stageTrace' | 'executorKind' | 'generationStage' | 'stage' | 'rawCode' | 'requestId' | 'ossRequestId' | 'providerEndpoint' | 'providerRequestMethod' | 'providerHttpStatus' | 'providerFetchError' | 'providerFetchCause' | 'storageProvider' | 'bucket' | 'storageKey' | 'attemptedUploadKey' | 'mediaDownloadUrl' | 'sourceUrl' | 'requestUrl' | 'method' | 'hint' | 'generationRequestUrl' | 'generationRequestMethod' | 'generationHttpStatus' | 'generationFetchError' | 'generationResponseTextPreview' | 'model' | 'providerId' | 'generationJobId' | 'missingEnv' | 'missingEnvKeys' | 'missingFields' | 'submittedInput' | 'providerResponse'>, providerId: string) {
  const visibleErrorCode = normalizeVisibleGenerateErrorCode(result) || result.errorCode || 'generation_failed'
  const requestUrl = result.generationRequestUrl || result.requestUrl
  const requestMethod = result.generationRequestMethod || result.method
  const generationHttpStatus = result.generationHttpStatus ?? result.httpStatus
  const lastGenerationError = {
    errorCode: visibleErrorCode,
    rawErrorCode: result.errorCode,
    message: normalizeGenerateErrorMessage(result),
    errorMessage: result.errorMessage || normalizeGenerateErrorMessage(result),
    httpStatus: result.httpStatus,
    generationRequestUrl: requestUrl,
    generationRequestMethod: requestMethod,
    generationHttpStatus,
    generationFetchError: result.generationFetchError,
    generationResponseTextPreview: result.generationResponseTextPreview,
    requestUrl,
    method: requestMethod,
    hint: result.hint,
    generationJobId: result.generationJobId,
    executorKind: result.executorKind,
    errorStage: result.errorStage,
    stageTrace: result.stageTrace,
    generationStage: result.generationStage || result.stage,
    stage: result.stage || result.generationStage,
    upstreamStatus: result.upstreamStatus,
      upstreamMessage: result.upstreamMessage,
      rawCode: result.rawCode,
      requestId: result.requestId,
      ossRequestId: result.ossRequestId,
      providerEndpoint: result.providerEndpoint,
      providerRequestMethod: result.providerRequestMethod,
      providerHttpStatus: result.providerHttpStatus,
      providerFetchError: result.providerFetchError,
      providerFetchCause: result.providerFetchCause,
      storageProvider: result.storageProvider,
      bucket: result.bucket,
      storageKey: result.storageKey,
      attemptedUploadKey: result.attemptedUploadKey,
      mediaDownloadUrl: result.mediaDownloadUrl,
      sourceUrl: result.sourceUrl,
    missingEnv: result.missingEnvKeys?.length ? result.missingEnvKeys : result.missingEnv,
    missingFields: result.missingFields,
    submittedInput: result.submittedInput,
    providerResponse: result.providerResponse,
    at: new Date().toISOString(),
  }
  return {
    ...metadataRecord(node.metadataJson),
    providerId: result.providerId || providerId,
    model: result.model,
    generationJobId: result.generationJobId,
    executorKind: result.executorKind,
    recoveryStatus: visibleErrorCode,
    mediaRecoveryStatus: 'generation_failed',
    nextAction: visibleErrorCode === 'missing_generation_input' || visibleErrorCode === 'provider_env_missing' || visibleErrorCode === 'auth_required' || visibleErrorCode === 'api_error' ? 'manual_debug' : 'regenerate_from_prompt',
    isRecovering: false,
    recovering: false,
    loading: false,
    isRegenerating: false,
    regenerating: false,
    errorCode: visibleErrorCode,
    errorMessage: normalizeGenerateErrorMessage(result),
    generationRequestUrl: requestUrl,
    generationRequestMethod: requestMethod,
    generationHttpStatus,
    generationFetchError: result.generationFetchError,
    generationResponseTextPreview: result.generationResponseTextPreview,
    errorStage: result.errorStage,
    stageTrace: result.stageTrace,
    generationStage: result.generationStage || result.stage,
    stage: result.stage || result.generationStage,
    upstreamStatus: result.upstreamStatus,
      upstreamMessage: result.upstreamMessage,
      requestId: result.requestId,
      ossRequestId: result.ossRequestId,
      providerEndpoint: result.providerEndpoint,
      providerRequestMethod: result.providerRequestMethod,
      providerHttpStatus: result.providerHttpStatus,
      providerFetchError: result.providerFetchError,
      providerFetchCause: result.providerFetchCause,
      storageProvider: result.storageProvider,
      bucket: result.bucket,
      storageKey: result.storageKey,
      attemptedUploadKey: result.attemptedUploadKey,
      mediaDownloadUrl: result.mediaDownloadUrl,
      sourceUrl: result.sourceUrl,
    submittedInput: result.submittedInput,
    lastError: lastGenerationError,
    lastGenerationError,
  }
}

function videoSuccessMetadata(node: VisualCanvasNode, result: GenerateApiResult, providerId: string) {
  const resultMetadata = result.result?.metadata && typeof result.result.metadata === 'object'
    ? result.result.metadata as Record<string, unknown>
    : {}
  const persistedMedia = persistenceFromGenerateResult(result)
  const persistencePending = isPersistencePendingResult(result)
  const taskId = result.taskId ?? (typeof resultMetadata.taskId === 'string' ? resultMetadata.taskId : undefined)
  const generationJobId = result.jobId
    ?? result.generationJobId
    ?? result.billingJobId
    ?? (typeof resultMetadata.generationJobId === 'string' ? resultMetadata.generationJobId : undefined)
    ?? taskId
  const submittedAt = result.submittedAt ?? (typeof resultMetadata.submittedAt === 'string' ? resultMetadata.submittedAt : undefined)
  const completedAt = result.completedAt ?? (typeof resultMetadata.completedAt === 'string' ? resultMetadata.completedAt : undefined)
  const displayUrl = displayUrlFromGenerateResult(result)
  const resultVideoUrl = result.result?.videoUrl ?? result.resultVideoUrl ?? result.videoUrl ?? displayUrl
  const assetUrl = typeof resultMetadata.assetUrl === 'string'
    ? resultMetadata.assetUrl
    : result.assetUrl || result.asset?.url || undefined
  const resolvedUrl = result.resolvedUrl
    || (typeof resultMetadata.resolvedUrl === 'string' ? resultMetadata.resolvedUrl : undefined)
    || (typeof persistedMedia.resolvedUrl === 'string' ? persistedMedia.resolvedUrl : undefined)
  const stableUrl = result.stableUrl
    || (typeof resultMetadata.stableUrl === 'string' ? resultMetadata.stableUrl : undefined)
    || resolvedUrl
    || assetUrl
    || resultVideoUrl
  const proxyUrl = result.proxyUrl
    || (typeof resultMetadata.proxyUrl === 'string' ? resultMetadata.proxyUrl : undefined)
    || (typeof persistedMedia.proxyUrl === 'string' ? persistedMedia.proxyUrl : undefined)
  const assetId = result.asset?.id ?? result.assetId ?? (typeof resultMetadata.assetId === 'string' ? resultMetadata.assetId : undefined)
  return {
    ...metadataRecord(node.metadataJson),
    providerId: result.providerId || providerId,
    model: result.model ?? (typeof resultMetadata.model === 'string' ? resultMetadata.model : undefined),
    generationStatus: result.generationStatus ?? 'generation_success',
    persistenceStatus: persistencePending ? 'pending_persistence' : result.persistenceStatus ?? 'persistence_success',
    assetStatus: persistencePending ? 'pending_persistence' : result.assetStatus ?? (assetId ? 'ready' : undefined),
    recoveryStatus: result.async ? 'regenerating' : persistencePending ? 'pending_persistence' : 'ready',
    mediaRecoveryStatus: result.async ? 'regenerating' : 'regenerated',
    nextAction: persistencePending ? 'retry_persistence' : 'show_media',
    isRecovering: false,
    recovering: false,
    loading: false,
    isRegenerating: Boolean(result.async),
    regenerating: Boolean(result.async),
    errorCode: null,
    errorMessage: null,
    lastError: null,
    lastGenerationError: null,
    taskId,
    generationJobId,
    assetId,
    outputAssetId: assetId,
    generationJob: {
      ...metadataRecord(metadataRecord(node.metadataJson).generationJob),
      ...(generationJobId ? { id: generationJobId } : {}),
      ...(assetId ? { outputAssetId: assetId } : {}),
    },
    resultVideoUrl: stableUrl || resultVideoUrl || displayUrl,
    ...(persistencePending ? {} : { assetUrl: stableUrl || assetUrl }),
    ...(stableUrl ? (persistencePending ? { stableUrl } : { resolvedUrl: stableUrl, stableUrl }) : {}),
    ...(proxyUrl ? { proxyUrl } : {}),
    signedUrlAvailable: result.signedUrlAvailable ?? (assetUrl ? true : undefined),
    proxyAvailable: result.proxyAvailable ?? Boolean(proxyUrl),
    storageProvider: result.storageProvider ?? (typeof persistedMedia.storageProvider === 'string' ? persistedMedia.storageProvider : resultMetadata.storageProvider),
    bucket: result.bucket ?? (typeof persistedMedia.bucket === 'string' ? persistedMedia.bucket : resultMetadata.bucket),
    storageKey: result.storageKey ?? (typeof persistedMedia.storageKey === 'string' ? persistedMedia.storageKey : resultMetadata.storageKey),
    originalProviderVideoUrl: result.originalProviderVideoUrl ?? (typeof resultMetadata.originalProviderVideoUrl === 'string' ? resultMetadata.originalProviderVideoUrl : undefined),
    providerOriginalUrl: result.providerOriginalUrl ?? (typeof resultMetadata.providerOriginalUrl === 'string' ? resultMetadata.providerOriginalUrl : result.originalProviderVideoUrl ?? displayUrl),
    temporaryUrl: result.temporaryUrl ?? (typeof resultMetadata.temporaryUrl === 'string' ? resultMetadata.temporaryUrl : result.providerOriginalUrl ?? result.originalProviderVideoUrl ?? displayUrl),
    persistenceError: result.persistenceError ?? (typeof resultMetadata.persistenceError === 'string' ? resultMetadata.persistenceError : undefined),
    retryPersistenceAvailable: result.retryPersistenceAvailable ?? (typeof resultMetadata.retryPersistenceAvailable === 'boolean' ? resultMetadata.retryPersistenceAvailable : persistencePending && Boolean(assetId)),
    attemptedUploadKey: result.attemptedUploadKey ?? (typeof resultMetadata.attemptedUploadKey === 'string' ? resultMetadata.attemptedUploadKey : undefined),
    ossRequestId: result.ossRequestId ?? (typeof resultMetadata.ossRequestId === 'string' ? resultMetadata.ossRequestId : undefined),
    submittedInput: result.submittedInput ?? resultMetadata.submittedInput,
    providerResponse: result.providerResponse ?? resultMetadata.providerResponse,
    mediaPersistence: {
      ...metadataRecord(resultMetadata.mediaPersistence),
      ...metadataRecord(result.mediaPersistence),
      status: persistencePending ? 'pending_persistence' : stringValue(persistedMedia.status) || 'persisted',
      persistenceStatus: persistencePending ? 'pending_persistence' : stringValue(persistedMedia.persistenceStatus) || 'persistence_success',
      ...(assetId ? { assetId, outputAssetId: assetId } : {}),
      ...(stableUrl ? { stableUrl, resolvedUrl: stableUrl } : {}),
    },
    assetIntelligence: result.assetIntelligence ?? resultMetadata.assetIntelligence ?? metadataRecord(node.metadataJson).assetIntelligence,
    ...(result.warning ? { mediaPersistenceWarning: result.warning } : {}),
    ...(submittedAt ? { submittedAt } : {}),
    ...(completedAt ? { completedAt } : {}),
  }
}

function videoErrorMetadata(node: VisualCanvasNode, result: Pick<GenerateApiResult, 'errorCode' | 'message' | 'errorMessage' | 'httpStatus' | 'upstreamStatus' | 'upstreamMessage' | 'errorStage' | 'stageTrace' | 'executorKind' | 'generationStage' | 'stage' | 'rawCode' | 'requestId' | 'ossRequestId' | 'providerEndpoint' | 'providerRequestMethod' | 'providerHttpStatus' | 'providerFetchError' | 'providerFetchCause' | 'storageProvider' | 'bucket' | 'storageKey' | 'attemptedUploadKey' | 'mediaDownloadUrl' | 'sourceUrl' | 'requestUrl' | 'method' | 'hint' | 'generationRequestUrl' | 'generationRequestMethod' | 'generationHttpStatus' | 'generationFetchError' | 'generationResponseTextPreview' | 'model' | 'providerId' | 'generationJobId' | 'taskId' | 'missingEnv' | 'missingEnvKeys' | 'missingFields' | 'submittedInput' | 'providerResponse'>, providerId: string) {
  const visibleErrorCode = normalizeVisibleGenerateErrorCode(result) || result.errorCode || 'generation_failed'
  const requestUrl = result.generationRequestUrl || result.requestUrl
  const requestMethod = result.generationRequestMethod || result.method
  const generationHttpStatus = result.generationHttpStatus ?? result.httpStatus
  const lastGenerationError = {
    errorCode: visibleErrorCode,
    rawErrorCode: result.errorCode,
    message: normalizeGenerateErrorMessage(result),
    errorMessage: result.errorMessage || normalizeGenerateErrorMessage(result),
    httpStatus: result.httpStatus,
    generationRequestUrl: requestUrl,
    generationRequestMethod: requestMethod,
    generationHttpStatus,
    generationFetchError: result.generationFetchError,
    generationResponseTextPreview: result.generationResponseTextPreview,
    requestUrl,
    method: requestMethod,
    hint: result.hint,
    generationJobId: result.generationJobId,
    executorKind: result.executorKind,
    errorStage: result.errorStage,
    stageTrace: result.stageTrace,
    generationStage: result.generationStage || result.stage,
    stage: result.stage || result.generationStage,
    upstreamStatus: result.upstreamStatus,
      upstreamMessage: result.upstreamMessage,
      rawCode: result.rawCode,
      requestId: result.requestId,
      ossRequestId: result.ossRequestId,
      providerEndpoint: result.providerEndpoint,
      providerRequestMethod: result.providerRequestMethod,
      providerHttpStatus: result.providerHttpStatus,
      providerFetchError: result.providerFetchError,
      providerFetchCause: result.providerFetchCause,
      storageProvider: result.storageProvider,
      bucket: result.bucket,
      storageKey: result.storageKey,
      attemptedUploadKey: result.attemptedUploadKey,
      mediaDownloadUrl: result.mediaDownloadUrl,
      sourceUrl: result.sourceUrl,
    missingEnv: result.missingEnvKeys?.length ? result.missingEnvKeys : result.missingEnv,
    missingFields: result.missingFields,
    submittedInput: result.submittedInput,
    providerResponse: result.providerResponse,
    at: new Date().toISOString(),
  }
  return {
    ...metadataRecord(node.metadataJson),
    providerId: result.providerId || providerId,
    model: result.model,
    taskId: result.taskId,
    generationJobId: result.generationJobId ?? result.taskId,
    executorKind: result.executorKind,
    recoveryStatus: visibleErrorCode,
    mediaRecoveryStatus: 'generation_failed',
    nextAction: visibleErrorCode === 'missing_generation_input' || visibleErrorCode === 'provider_env_missing' || visibleErrorCode === 'auth_required' || visibleErrorCode === 'api_error' ? 'manual_debug' : 'regenerate_from_prompt',
    isRecovering: false,
    recovering: false,
    loading: false,
    isRegenerating: false,
    regenerating: false,
    errorCode: visibleErrorCode,
    errorMessage: normalizeGenerateErrorMessage(result),
    generationRequestUrl: requestUrl,
    generationRequestMethod: requestMethod,
    generationHttpStatus,
    generationFetchError: result.generationFetchError,
    generationResponseTextPreview: result.generationResponseTextPreview,
    errorStage: result.errorStage,
    stageTrace: result.stageTrace,
    generationStage: result.generationStage || result.stage,
    stage: result.stage || result.generationStage,
    upstreamStatus: result.upstreamStatus,
      upstreamMessage: result.upstreamMessage,
      requestId: result.requestId,
      ossRequestId: result.ossRequestId,
      providerEndpoint: result.providerEndpoint,
      providerRequestMethod: result.providerRequestMethod,
      providerHttpStatus: result.providerHttpStatus,
      providerFetchError: result.providerFetchError,
      providerFetchCause: result.providerFetchCause,
      storageProvider: result.storageProvider,
      bucket: result.bucket,
      storageKey: result.storageKey,
      attemptedUploadKey: result.attemptedUploadKey,
      mediaDownloadUrl: result.mediaDownloadUrl,
      sourceUrl: result.sourceUrl,
    submittedInput: result.submittedInput,
    lastError: lastGenerationError,
    lastGenerationError,
  }
}

const GENERATION_FETCH_HINT = 'Browser could not complete request. Check Network tab, route availability, auth redirect, or CORS.'

async function callGenerationApi(
  nodeType: ToolProviderNodeType,
  providerId: string,
  prompt: string,
  params?: Record<string, string | number | boolean | undefined>,
  nodeId?: string,
  inputAssets?: Array<{ id: string; type: string; url?: string }>,
  projectId?: string,
  workflowId?: string,
  system?: string,
  model?: string,
  signal?: AbortSignal,
  billingMode?: 'platform_credits' | 'user_provider_account',
  userProviderAccountId?: string,
): Promise<GenerateApiResult> {
  const endpoint =
    nodeType === 'image' ? '/api/generate/image'
    : nodeType === 'video' ? '/api/generate/video'
    : nodeType === 'audio' ? '/api/generate/audio'
    : '/api/generate/text'
  const method = 'POST'
  const requestMeta = {
    requestUrl: endpoint,
    method,
    generationRequestUrl: endpoint,
    generationRequestMethod: method,
  }
  const maxTokens = nodeType === 'text' ? 1024 : undefined

  if (process.env.NODE_ENV !== 'production') {
    console.info('[canvas-generate] submit', { nodeType, providerId })
  }

  const aspectRatio = typeof params?.aspectRatio === 'string'
    ? params.aspectRatio
    : typeof params?.ratio === 'string'
      ? params.ratio
      : undefined
  const duration = typeof params?.duration === 'number' ? params.duration : undefined
  const resolution = typeof params?.resolution === 'string'
    ? params.resolution
    : typeof params?.size === 'string'
      ? params.size
      : typeof params?.quality === 'string'
        ? params.quality
        : undefined
  const requestBody = nodeType === 'image'
    ? {
        prompt,
        providerId,
        aspectRatio: aspectRatio ?? '16:9',
        projectId,
        workflowId,
        nodeId,
        ...(billingMode === 'user_provider_account' && userProviderAccountId
          ? { billingMode, userProviderAccountId }
          : {}),
      }
    : nodeType === 'video'
      ? {
          prompt,
          providerId,
          aspectRatio: aspectRatio ?? '16:9',
          duration: duration ?? 5,
          projectId,
          workflowId,
          nodeId,
          ...(typeof params?.imageUrl === 'string' && params.imageUrl ? { imageUrl: params.imageUrl } : {}),
        }
      : {
          providerId,
          provider: providerId,
          model,
          nodeType,
          kind: nodeType,
          prompt,
          compiledPrompt: prompt,
          system,
          params: {
            ...(params ?? {}),
            ...(model ? { model } : {}),
          },
          maxTokens,
          nodeId,
          inputAssets,
          projectId,
          workflowId,
          aspectRatio,
          duration,
          resolution,
          ...(billingMode === 'user_provider_account' && userProviderAccountId
            ? { billingMode, userProviderAccountId }
            : {}),
        }

  let response: Response
  // image: backend awaits cn-executor up to 50s, so frontend must exceed that
  // video: cn-executor takes 60-180s, backend times out at 12s and returns queued
  const postTimeoutMs = nodeType === 'image' ? 70_000 : nodeType === 'video' ? 90_000 : undefined
  try {
    response = await fetch(endpoint, {
      method,
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
      ...(postTimeoutMs ? { signal: timeoutSignal(postTimeoutMs, signal) } : {}),
    })
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
    const isUserAbort = Boolean(signal?.aborted)
    const reason = err instanceof Error ? err.message : String(err || '网络请求失败')
    const timeoutSec = postTimeoutMs ? Math.round(postTimeoutMs / 1000) : 30
    const errorMessage = isUserAbort
      ? 'Generation cancelled by user.'
      : isTimeout
      ? `POST ${endpoint} 超过 ${timeoutSec} 秒未响应，任务可能已提交但无法确认 — 请刷新页面后查看节点状态。`
      : `${method} ${endpoint} fetch failed: ${reason}`
    return {
      success: false,
      providerId,
      mode: 'unavailable',
      status: 'failed',
      message: errorMessage,
      errorMessage,
      errorCode: isUserAbort ? 'generation_cancelled_by_user' : isTimeout ? 'generation_post_timeout' : 'client_fetch_failed',
      hint: GENERATION_FETCH_HINT,
      generationFetchError: reason,
      upstreamMessage: reason,
      ...requestMeta,
    }
  }

  const raw = await response.text().catch(() => '')
  const responseTextPreview = raw.slice(0, 500)
  const responseMeta = {
    ...requestMeta,
    httpStatus: response.status,
    generationHttpStatus: response.status,
    generationResponseTextPreview: responseTextPreview,
  }
  if (!raw.trim()) {
    const errorMessage = response.status === 401
      ? '登录状态失效，请刷新并重新登录'
      : `生成接口返回空响应（HTTP ${response.status}）`
    return {
      success: false,
      providerId,
      mode: 'unavailable',
      status: 'failed',
      message: errorMessage,
      errorMessage,
      errorCode: response.status === 401 ? 'auth_required' : response.status >= 500 ? 'api_error' : 'EMPTY_RESPONSE',
      upstreamMessage: '',
      ...responseMeta,
    }
  }
  try {
    const parsedValue = JSON.parse(raw) as unknown
    const parsedRecord = nestedRecord(parsedValue)
    const parsed = parsedRecord as unknown as GenerateApiResult
    if (!response.ok || parsed.success === false) {
      const parsedStatus = typeof parsedRecord.status === 'string' ? parsedRecord.status as GenerateApiResult['status'] : 'failed'
      const parsedMode = typeof parsedRecord.mode === 'string' ? parsedRecord.mode as GenerateApiResult['mode'] : 'unavailable'
      const upstreamStatus = typeof parsedRecord.upstreamStatus === 'number' ? parsedRecord.upstreamStatus : undefined
      const upstreamMessage = stringValue(parsedRecord.upstreamMessage) || responseTextPreview
      const responseErrorCode = stringValue(parsedRecord.errorCode)
      const parsedMissingFields = Array.isArray(parsedRecord.missingFields)
        ? parsedRecord.missingFields.filter((value): value is string => typeof value === 'string')
        : Array.isArray(parsedRecord.missing)
          ? parsedRecord.missing.filter((value): value is string => typeof value === 'string')
          : undefined
      const apiErrorCode = response.status === 401
        ? 'auth_required'
        : response.status >= 500
          ? 'api_error'
          : responseErrorCode || `HTTP_${response.status}`
      const errorMessage = response.status === 401
        ? '登录状态失效，请刷新并重新登录'
        : stringValue(parsedRecord.errorMessage)
        || stringValue(parsedRecord.message)
        || `生成接口返回 HTTP ${response.status}`
      const displayUrl = displayUrlFromGenerateResult(parsed)
      const pendingPersistenceWithDisplay = isPersistencePendingResult(parsed) && Boolean(displayUrl)
      return {
        ...parsed,
        success: pendingPersistenceWithDisplay ? true : false,
        providerId: parsed.providerId || providerId,
        mode: pendingPersistenceWithDisplay && parsedMode === 'unavailable' ? 'real' : parsedMode,
        status: pendingPersistenceWithDisplay ? 'succeeded' : parsedStatus,
        displayUrl: pendingPersistenceWithDisplay ? displayUrl : parsed.displayUrl,
        errorCode: pendingPersistenceWithDisplay ? undefined : apiErrorCode,
        message: pendingPersistenceWithDisplay ? stringValue(parsedRecord.message) || '媒体已生成，资产库上传待重试。' : errorMessage,
        errorMessage: pendingPersistenceWithDisplay ? undefined : errorMessage,
        upstreamStatus,
        upstreamMessage,
        missingFields: parsed.missingFields ?? parsedMissingFields,
        rawCode: responseErrorCode || parsed.rawCode,
        requestId: stringValue(parsedRecord.requestId) || undefined,
        ...responseMeta,
      }
    }
    return {
      ...parsed,
      ...responseMeta,
    }
  } catch {
    const errorMessage = `生成接口返回非 JSON 响应（HTTP ${response.status}）`
    return {
      success: false,
      providerId,
      mode: 'unavailable',
      status: 'failed',
      message: errorMessage,
      errorMessage,
      errorCode: response.status === 401 ? 'auth_required' : response.status >= 500 ? 'api_error' : response.ok ? 'NON_JSON_RESPONSE' : `HTTP_${response.status}`,
      upstreamMessage: responseTextPreview,
      ...responseMeta,
    }
  }
}

async function pollGenerationJob(jobId: string, signal?: AbortSignal): Promise<GenerateApiResult> {
  let response: Response
  try {
    response = await fetch(`/api/generate/jobs/${encodeURIComponent(jobId)}`, {
      credentials: 'include',
      signal,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '网络请求失败'
    return { success: false, providerId: '', mode: 'unavailable', status: 'failed', message, errorCode: signal?.aborted ? 'generation_cancelled_by_user' : 'client_fetch_failed' }
  }
  const raw = await response.text().catch(() => '')
  if (!raw.trim()) {
    return { success: false, providerId: '', mode: 'unavailable', status: 'failed', message: `任务状态接口返回空响应（HTTP ${response.status}）` }
  }
  try {
    return JSON.parse(raw) as GenerateApiResult
  } catch {
    return { success: false, providerId: '', mode: 'unavailable', status: 'failed', message: `任务状态接口返回非 JSON 响应（HTTP ${response.status}）` }
  }
}

async function pollSeedanceVideoTask(
  providerId: string,
  taskId: string,
  context?: { projectId?: string; workflowId?: string; nodeId?: string; prompt?: string; compiledPrompt?: string },
): Promise<GenerateApiResult> {
  let response: Response
  try {
    const params = new URLSearchParams({ providerId, taskId })
    if (context?.projectId) params.set('projectId', context.projectId)
    if (context?.workflowId) params.set('workflowId', context.workflowId)
    if (context?.nodeId) params.set('nodeId', context.nodeId)
    if (context?.prompt) params.set('prompt', context.prompt)
    if (context?.compiledPrompt) params.set('compiledPrompt', context.compiledPrompt)
    response = await fetch(`/api/generate/video/status?${params.toString()}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '网络请求失败'
    return { success: false, providerId, mode: 'unavailable', status: 'failed', message, taskId }
  }
  const raw = await response.text().catch(() => '')
  if (!raw.trim()) {
    return { success: false, providerId, mode: 'unavailable', status: 'failed', message: `任务状态接口返回空响应（HTTP ${response.status}）`, taskId }
  }
  try {
    return JSON.parse(raw) as GenerateApiResult
  } catch {
    return { success: false, providerId, mode: 'unavailable', status: 'failed', message: `任务状态接口返回非 JSON 响应（HTTP ${response.status}）`, taskId }
  }
}

async function pollImageGenerationTask(
  providerId: string,
  generationJobId: string,
  signal?: AbortSignal,
): Promise<GenerateApiResult> {
  let response: Response
  try {
    const params = new URLSearchParams({ generationJobId })
    response = await fetch(`/api/generate/image/status?${params.toString()}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '网络请求失败'
    return { success: false, providerId, mode: 'unavailable', status: 'failed', message, generationJobId, errorCode: signal?.aborted ? 'generation_cancelled_by_user' : 'client_fetch_failed' }
  }
  const raw = await response.text().catch(() => '')
  if (!raw.trim()) {
    return { success: false, providerId, mode: 'unavailable', status: 'failed', message: `任务状态接口返回空响应（HTTP ${response.status}）`, generationJobId }
  }
  try {
    const parsed = JSON.parse(raw) as GenerateApiResult
    return {
      ...parsed,
      providerId: parsed.providerId || providerId,
      generationJobId: parsed.generationJobId ?? generationJobId,
      jobId: parsed.jobId ?? generationJobId,
    }
  } catch {
    return { success: false, providerId, mode: 'unavailable', status: 'failed', message: `任务状态接口返回非 JSON 响应（HTTP ${response.status}）`, generationJobId }
  }
}

async function pollVideoGenerationTask(
  providerId: string,
  generationJobId: string,
  signal?: AbortSignal,
): Promise<GenerateApiResult> {
  let response: Response
  try {
    const params = new URLSearchParams({ generationJobId })
    response = await fetch(`/api/generate/video/status?${params.toString()}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '网络请求失败'
    return { success: false, providerId, mode: 'unavailable', status: 'failed', message, generationJobId, errorCode: signal?.aborted ? 'generation_cancelled_by_user' : 'client_fetch_failed' }
  }
  const raw = await response.text().catch(() => '')
  if (!raw.trim()) {
    return { success: false, providerId, mode: 'unavailable', status: 'failed', message: `视频状态接口返回空响应（HTTP ${response.status}）`, generationJobId }
  }
  try {
    const parsed = JSON.parse(raw) as GenerateApiResult
    return {
      ...parsed,
      providerId: parsed.providerId || providerId,
      generationJobId: parsed.generationJobId ?? generationJobId,
      jobId: parsed.jobId ?? generationJobId,
    }
  } catch {
    return { success: false, providerId, mode: 'unavailable', status: 'failed', message: `视频状态接口返回非 JSON 响应（HTTP ${response.status}）`, generationJobId }
  }
}

function getTemplateFromSession(templateId: string) {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem('creator-city-template-payload')
  if (!raw) return null
  try {
    const template = JSON.parse(raw) as PublicTemplate
    return template.id === templateId ? template : null
  } catch {
    return null
  }
}

function getNodeSize(kind: VisualCanvasNodeKind) {
  return NODE_SIZE[kind] ?? NODE_SIZE.text
}

function doNodesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return !(
    left.x + left.width + 24 < right.x ||
    right.x + right.width + 24 < left.x ||
    left.y + left.height + 24 < right.y ||
    right.y + right.height + 24 < left.y
  )
}

function resolveNonOverlappingPosition(
  candidate: { x: number; y: number; width: number; height: number },
  nodes: VisualCanvasNode[],
) {
  let next = { ...candidate }
  let guard = 0

  while (nodes.some((node) => doNodesOverlap(next, node)) && guard < 8) {
    next = { ...next, y: next.y + 320 }
    guard += 1
  }

  if (nodes.some((node) => doNodesOverlap(next, node))) {
    next = { ...candidate, x: candidate.x + 120, y: candidate.y }
    guard = 0
    while (nodes.some((node) => doNodesOverlap(next, node)) && guard < 8) {
      next = { ...next, y: next.y + 320 }
      guard += 1
    }
  }

  return { x: next.x, y: next.y }
}

function clampMenuPosition(clientX: number, clientY: number, width: number, height: number) {
  if (typeof window === 'undefined') return { x: clientX, y: clientY }
  return {
    x: Math.max(12, Math.min(clientX, window.innerWidth - width - 12)),
    y: Math.max(12, Math.min(clientY, window.innerHeight - height - 12)),
  }
}

function clampReviewWindowGeometry(input: { x: number; y: number; width: number; height: number }) {
  if (typeof window === 'undefined') return input
  const maxWidth = Math.max(REVIEW_WINDOW_MIN_WIDTH, window.innerWidth * 0.42)
  const maxHeight = Math.max(REVIEW_WINDOW_MIN_HEIGHT, window.innerHeight * 0.72)
  const width = Math.max(REVIEW_WINDOW_MIN_WIDTH, Math.min(input.width, maxWidth, window.innerWidth - 24))
  const height = Math.max(REVIEW_WINDOW_MIN_HEIGHT, Math.min(input.height, maxHeight, window.innerHeight - REVIEW_WINDOW_TOP_GUARD - 12))
  return {
    width,
    height,
    x: Math.max(12, Math.min(input.x, window.innerWidth - width - 12)),
    y: Math.max(REVIEW_WINDOW_TOP_GUARD, Math.min(input.y, window.innerHeight - height - 12)),
  }
}

function getSurfaceOffset(surface: HTMLDivElement | null) {
  return {
    left: surface?.offsetLeft ?? 0,
    top: surface?.offsetTop ?? 0,
  }
}

function buildMockResult(node: VisualCanvasNode, prompt: string) {
  const promptCopy = prompt || '未填写 prompt'
  if (node.kind === 'image') return `图片结果 · ${promptCopy.slice(0, 72)}${promptCopy.length > 72 ? '...' : ''}`
  if (node.kind === 'video') return `视频镜头 · ${promptCopy.slice(0, 72)}${promptCopy.length > 72 ? '...' : ''}`
  if (node.kind === 'audio') return `音频草稿 · ${promptCopy.slice(0, 72)}${promptCopy.length > 72 ? '...' : ''}`
  if (node.kind === 'upload') return '上传素材已记录，可作为后续节点输入。'
  return `文本结果 · ${promptCopy.slice(0, 88)}${promptCopy.length > 88 ? '...' : ''}`
}

function abortError() {
  return new DOMException('Generation request aborted', 'AbortError')
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      window.clearTimeout(timer)
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function timeoutSignal(ms: number, externalSignal?: AbortSignal) {
  const timeout = AbortSignal.timeout(ms)
  if (!externalSignal) return timeout
  const abortSignalAny = (AbortSignal as typeof AbortSignal & { any?: (signals: AbortSignal[]) => AbortSignal }).any
  return abortSignalAny ? abortSignalAny([externalSignal, timeout]) : externalSignal
}

function FloatingMediaReviewWindow({
  review,
  node,
  displayUrl,
  posterUrl,
  onClose,
  onFocus,
  onMove,
  onResize,
}: {
  review: MediaReviewWindow
  node: VisualCanvasNode
  displayUrl: string
  posterUrl?: string
  onClose: (id: string) => void
  onFocus: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, width: number, height: number) => void
}) {
  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    onFocus(review.id)
    const startX = event.clientX
    const startY = event.clientY
    const startLeft = review.x
    const startTop = review.y

    const handleMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault()
      const next = clampReviewWindowGeometry({
        x: startLeft + moveEvent.clientX - startX,
        y: startTop + moveEvent.clientY - startY,
        width: review.width,
        height: review.height,
      })
      onMove(review.id, next.x, next.y)
    }
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    onFocus(review.id)
    const startX = event.clientX
    const startY = event.clientY
    const startWidth = review.width
    const startHeight = review.height

    const handleMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault()
      const next = clampReviewWindowGeometry({
        x: review.x,
        y: review.y,
        width: startWidth + moveEvent.clientX - startX,
        height: startHeight + moveEvent.clientY - startY,
      })
      onMove(review.id, next.x, next.y)
      onResize(review.id, next.width, next.height)
    }
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }

  return (
    <section
      className={`canvas-floating-review-window is-${review.type}`}
      role="dialog"
      aria-label={review.type === 'image' ? 'Image Preview' : 'Video Preview'}
      data-node-preview-overlay="true"
      data-no-node-drag="true"
      style={{
        left: review.x,
        top: review.y,
        width: review.width,
        height: review.height,
        zIndex: 2700 + review.zIndex,
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        onFocus(review.id)
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <header className="canvas-floating-review-head" onPointerDown={startDrag}>
        <div className="canvas-floating-review-title">
          <span>{review.type === 'image' ? 'Image Preview' : 'Video Preview'}</span>
          <small>{node.title}</small>
        </div>
        <button
          type="button"
          className="canvas-floating-review-close"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onClose(review.id)
          }}
          aria-label="Close preview"
        >
          ×
        </button>
      </header>
      <div className="canvas-floating-review-stage">
        {review.type === 'image' ? (
          <img
            src={displayUrl}
            alt={node.title}
            className="canvas-floating-review-media"
            draggable={false}
          />
        ) : (
          <video
            src={displayUrl}
            poster={posterUrl}
            className="canvas-floating-review-media"
            controls
            playsInline
          />
        )}
      </div>
      <button
        type="button"
        className="canvas-floating-review-resize"
        onPointerDown={startResize}
        aria-label="Resize preview"
      />
    </section>
  )
}

export function VisualCanvasWorkspace({
  projectTitle,
  templateName,
  canOpenClientDelivery = true,
  onOpenTimeline: _onOpenTimeline,
  onOpenAssets: _onOpenAssets,
  onOpenDelivery: _onOpenDelivery,
  onShowStartup,
}: VisualCanvasWorkspaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamTemplateId = searchParams.get('template')
  const searchParamProjectId = searchParams.get('projectId')
  const { statusMap: liveStatusMap, isLoading: liveStatusLoading } = useProviderLiveStatus()
  const [projectId, setProjectId] = useState(searchParamProjectId ?? '')
  const [workflowId, setWorkflowId] = useState('')
  const [loadedProjectTitle, setLoadedProjectTitle] = useState(projectTitle)
  const [projectTitleDraft, setProjectTitleDraft] = useState(projectTitle)
  const [projectTitleEditing, setProjectTitleEditing] = useState(false)
  const [projectTitleSaving, setProjectTitleSaving] = useState(false)
  const [projectTitleError, setProjectTitleError] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('opening')
  const [saveMessage, setSaveMessage] = useState('')
  const [draftRestorePrompt, setDraftRestorePrompt] = useState<DraftRestorePrompt | null>(null)
  const [nodes, setNodes] = useState<VisualCanvasNode[]>([])
  const [edges, setEdges] = useState<CanvasEdge[]>([])
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [isRightInspectorOpen, setIsRightInspectorOpen] = useState(false)
  const [isBottomDockExpanded, setIsBottomDockExpanded] = useState(false)
  const [reframeMode, setReframeMode] = useState<ReframeMode>('original')
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<string>('add')
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const [isLexiconOpen, setIsLexiconOpen] = useState(false)
  const [isVariantPlannerOpen, setIsVariantPlannerOpen] = useState(false)
  const [isCharacterLockOpen, setIsCharacterLockOpen] = useState(false)
  const [isABCompareOpen, setIsABCompareOpen] = useState(false)
  const [isKeyframeExtractorOpen, setIsKeyframeExtractorOpen] = useState(false)
  const [isShotListBuilderOpen, setIsShotListBuilderOpen] = useState(false)
  const [isShotSequencerOpen, setIsShotSequencerOpen] = useState(false)
  const [cloudShotSequence, setCloudShotSequence] = useState<ShotSequenceState | null>(null)
  const [isContinuityCheckerOpen, setIsContinuityCheckerOpen] = useState(false)
  const [isCharacterBibleOpen, setIsCharacterBibleOpen] = useState(false)
  const [isSceneBibleOpen, setIsSceneBibleOpen] = useState(false)
  const [isCameraControlOpen, setIsCameraControlOpen] = useState(false)
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>(DEFAULT_CAMERA_SETTINGS)
  const [isSceneLightingOpen, setIsSceneLightingOpen] = useState(false)
  const [sceneLightingSettings, setSceneLightingSettings] = useState<SceneLightingSettings>(DEFAULT_SCENE_LIGHTING)
  const [pendingAutoGenerateIds, setPendingAutoGenerateIds] = useState<string[]>([])
  const pendingAutoGenerateIdsRef = useRef<string[]>([])
  const [isPromptBoosterOpen, setIsPromptBoosterOpen] = useState(false)
  const [isBatchRewriterOpen, setIsBatchRewriterOpen] = useState(false)
  const [isLookPackageOpen, setIsLookPackageOpen] = useState(false)
  const [isColorGradePaletteOpen, setIsColorGradePaletteOpen] = useState(false)
  const [isRemoveBackgroundOpen, setIsRemoveBackgroundOpen] = useState(false)
  const [isHdReconstructionOpen, setIsHdReconstructionOpen] = useState(false)
  const [isStoryboardGridSplitOpen, setIsStoryboardGridSplitOpen] = useState(false)
  const [isAnnotationPanelOpen, setIsAnnotationPanelOpen] = useState(false)
  const [assetTransformCaps, setAssetTransformCaps] = useState<AssetTransformCaps>({ removeBackground: false, upscale: false })
  const [activeCanvasModal, setActiveCanvasModal] = useState<CanvasModalId | null>(null)
  const [lockedNodeToolContext, setLockedNodeToolContext] = useState<NodeToolContext | null>(null)
  const [scriptSegmentationSource, setScriptSegmentationSource] = useState<CreatorSkillSourceNode | null>(null)
  const [narrativeBeatSource, setNarrativeBeatSource] = useState<CreatorSkillSourceNode | null>(null)
  const [shotListSourceId, setShotListSourceId] = useState<string | null>(null)
  const [canvasPrompt, setCanvasPrompt] = useState('')
  const [promptModel, setPromptModel] = useState('custom-video-gateway')
  const [billingMode, setBillingMode] = useState<'platform_credits' | 'user_provider_account'>('user_provider_account')
  const [selectedUserAccountId, setSelectedUserAccountId] = useState('')
  const [userProviderAccounts, setUserProviderAccounts] = useState<UserProviderAccount[]>([])
  const [userAccountsLoading, setUserAccountsLoading] = useState(false)
  const [promptRatio, setPromptRatio] = useState('16:9')
  const [preferredKind, setPreferredKind] = useState<VisualCanvasNodeKind>('video')
  const [promptStage, setPromptStage] = useState<(typeof STAGE_OPTIONS)[number]['value']>('draft')
  const [promptAssetMode, setPromptAssetMode] = useState<(typeof ASSET_OPTIONS)[number]['value']>('none')
  const [promptParameter, setPromptParameter] = useState<(typeof PARAMETER_OPTIONS)[number]['value']>('16:9-balanced')
  const [hasStarted, setHasStarted] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [generationTasksOpen, setGenerationTasksOpen] = useState(false)
  const [storyboardPreviewOpen, setStoryboardPreviewOpen] = useState(false)
  const [storyboardDirectorOpen, setStoryboardDirectorOpen] = useState(false)
  const [p0MediaDebugOpen, setP0MediaDebugOpen] = useState(false)
  const [directorState, setDirectorState] = useState<StoryboardState>({ version: '1', shots: [], updatedAt: '' })
  const [directorActiveShotId, setDirectorActiveShotId] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<'assets' | 'templates' | 'history' | 'image-editor' | 'skills' | null>(null)
  const [commentsEnabled, setCommentsEnabled] = useState(false)
  const [comments, setComments] = useState<CanvasComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState('')
  const [commentsSyncing, setCommentsSyncing] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedHistoryId, setSelectedHistoryId] = useState('')
  const [appliedImageEdit, setAppliedImageEdit] = useState('')
  const [canvasFeedback, setCanvasFeedback] = useState('')
  const [dialogLocalRefs, setDialogLocalRefs] = useState<LocalRefEntry[]>([])
  const [dialogScriptInputs, setDialogScriptInputs] = useState<LocalScriptEntry[]>([])
  const [assetRecoverBatchStatus, setAssetRecoverBatchStatus] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')
  const [recoverNodeStatus, setRecoverNodeStatus] = useState<'idle' | 'running' | 'done-recovered' | 'done-empty' | 'failed'>('idle')
  const [recoverNodeCount, setRecoverNodeCount] = useState(0)
  const [styleBible, setStyleBible] = useState<ProjectStyleBible>({})
  const [characterBible, setCharacterBible] = useState<CharacterBible>({ characters: [] })
  const [sceneBible, setSceneBible] = useState<SceneBible>({ scenes: [] })
  const [enabledSkillIds, setEnabledSkillIds] = useState<string[]>(() => getDefaultCreatorSkillIds())
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [nodeAddMenu, setNodeAddMenu] = useState<{ nodeId: string; direction: 'in' | 'out'; x: number; y: number; worldX: number; worldY: number } | null>(null)
  const [nodeCreateMenu, setNodeCreateMenu] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null)
  const [activePreviewNodeId, setActivePreviewNodeId] = useState<string | null>(null)
  const [activePreviewType, setActivePreviewType] = useState<CanvasNodePreviewType | null>(null)
  const [mediaReviewWindows, setMediaReviewWindows] = useState<MediaReviewWindow[]>([])
  const [activeInspectorNodeId, setActiveInspectorNodeId] = useState<string | null>(null)
  const [activeMediaDiagnostics, setActiveMediaDiagnostics] = useState<{ nodeId: string; type: 'image' | 'video' } | null>(null)
  const [activeCreativeAssetsNodeId, setActiveCreativeAssetsNodeId] = useState<string | null>(null)
  const [activeCreativeAssetsTab, setActiveCreativeAssetsTab] = useState<'intelligence' | 'characters' | 'scenes' | 'scene-lab' | 'palette' | 'props' | 'camera'>('characters')
  const [activeSceneLabSourceNodeId, setActiveSceneLabSourceNodeId] = useState('')
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null)
  const [openContextMenuAnchor, setOpenContextMenuAnchor] = useState<{ nodeId: string; x: number; y: number } | null>(null)

  const [workflowContext, setWorkflowContext] = useState<{ sourceNodeId: string; targetNodeId: string } | null>(null)
  const [textEditorDraft, setTextEditorDraft] = useState('')
  const [textEditorCopied, setTextEditorCopied] = useState(false)
  const [previewLinkCopied, setPreviewLinkCopied] = useState(false)
  const [activeSceneTool, setActiveSceneTool] = useState<SceneEditTool>('weather')
  const [selectedSceneEditId, setSelectedSceneEditId] = useState('')
  const [sceneEditInstructionsCopied, setSceneEditInstructionsCopied] = useState(false)
  const [panelPortalTarget, setPanelPortalTarget] = useState<HTMLDivElement | null>(null)
  const [imageProviderStatusMap, setImageProviderStatusMap] = useState<Map<string, ImageProviderStatusInfo>>(new Map())
  const [videoProviderStatusMap, setVideoProviderStatusMap] = useState<Map<string, VideoProviderStatusInfo>>(new Map())
  const [generationHealth, setGenerationHealth] = useState<GenerationHealthResponse | null>(null)
  const [, setClipboardNode] = useState<VisualCanvasNode | null>(null)
  const [draggingNodeId, setDraggingNodeId] = useState<string>('')
  const [connectionDraft, setConnectionDraft] = useState<{
    nodeId: string
    x1: number
    y1: number
    x2: number
    y2: number
  } | null>(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isLocalImageDragOver, setIsLocalImageDragOver] = useState(false)
  const timersRef = useRef<number[]>([])
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [creditModal, setCreditModal] = useState<{ open: boolean; requiredCredits?: number; availableCredits?: number }>({ open: false })
  const initialTemplateAppliedRef = useRef('')
  const canvasLoadedRef = useRef(false)
  const hasHydratedCanvasRef = useRef(false)
  const isInitializingRef = useRef(true)
  const initStartedRef = useRef('')
  const initAbortRef = useRef<AbortController | null>(null)
  const saveAbortRef = useRef<AbortController | null>(null)
  const generationAbortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const activeGenerationNodeIdsRef = useRef<Set<string>>(new Set())
  const generationCanvasIdentityRef = useRef('')
  const isSwitchingProjectRef = useRef(false)
  const skipNextAutosaveRef = useRef(false)
  const hasUnsyncedLocalChangesRef = useRef(false)
  const providerStatusPerfStartedRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const saveInFlightRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const saveCanvasRef = useRef<() => Promise<void>>(async () => {})
  const serverSaveVersionRef = useRef<string | undefined>(undefined)
  const saveRetryTimerRef = useRef<number | null>(null)
  const saveRetryAttemptRef = useRef(0)
  const saveBackoffUntilRef = useRef(0)
  const deletedNodeIdsRef = useRef<string[]>([])
  const deletedEdgeIdsRef = useRef<string[]>([])
  const latestNodesRef = useRef<VisualCanvasNode[]>([])
  const latestEdgesRef = useRef<CanvasEdge[]>([])
  const prevEditingNodeIdRef = useRef<string | null>(null)
  const latestViewportRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } })
  const latestCommentsRef = useRef<CanvasComment[]>([])
  const mediaReviewZRef = useRef(1)
  const assetResolveRunKeyRef = useRef('')
  // Tracks which node's camera/lighting settings the panel is editing (avoids ambiguous activeNode vs editingNode).
  const directorTargetNodeIdRef = useRef<string | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const promptInputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const panStartRef = useRef({
    pointerId: 0,
    clientX: 0,
    clientY: 0,
    panX: 0,
    panY: 0,
  })
  const nodeDragRef = useRef<{
    nodeId: string
    pointerId: number
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    latestX: number
    latestY: number
  } | null>(null)
  const connectionDragRef = useRef<{
    nodeId: string
    direction: 'in' | 'out'
    sourceHandle: 'left' | 'right'
    startClientX: number
    startClientY: number
  } | null>(null)

  generationCanvasIdentityRef.current = generationCanvasIdentity(projectId, workflowId)

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      if (saveRetryTimerRef.current) window.clearTimeout(saveRetryTimerRef.current)
      pendingAutoGenerateIdsRef.current = []
      const canvasIdentity = generationCanvasIdentityRef.current
      generationAbortControllersRef.current.forEach((controller, nodeId) => controller.abort({
        context: 'stale',
        canvasIdentity,
        nodeId,
      } satisfies GenerationAbortReason))
      generationAbortControllersRef.current.clear()
      activeGenerationNodeIdsRef.current.clear()
    }
  }, [])

  // Fetch asset transform capabilities once per session (module-level cache).
  // Toolbar entries are hidden by default; only shown when confirmed available.
  useEffect(() => {
    fetchAssetTransformCaps().then(setAssetTransformCaps).catch(() => {/* stay disabled */})
  }, [])

  useEffect(() => {
    latestCommentsRef.current = comments
  }, [comments])

  // Load user-owned provider accounts on demand (only when user switches to user_provider_account mode).
  useEffect(() => {
    if (billingMode !== 'user_provider_account') return
    setUserAccountsLoading(true)
    fetch('/api/provider-accounts', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { success?: boolean; accounts?: UserProviderAccount[] }) => {
        if (data.success && Array.isArray(data.accounts)) setUserProviderAccounts(data.accounts)
      })
      .catch(() => { /* silently ignore — billing mode switch shows empty state */ })
      .finally(() => setUserAccountsLoading(false))
  }, [billingMode])

  useEffect(() => {
    if (typeof window === 'undefined' || !projectId) return
    try {
      const rawStyle = window.localStorage.getItem(getStyleBibleKey(projectId))
      setStyleBible(rawStyle ? normalizeStyleBible(JSON.parse(rawStyle)) : {})
    } catch {
      setStyleBible({})
    }
    setCharacterBible(loadCharacterBible(projectId))
    setSceneBible(loadSceneBible(projectId))
    try {
      const rawCamera = window.localStorage.getItem(getCameraSettingsKey(projectId))
      setCameraSettings(rawCamera ? (JSON.parse(rawCamera) as CameraSettings) : DEFAULT_CAMERA_SETTINGS)
    } catch {
      setCameraSettings(DEFAULT_CAMERA_SETTINGS)
    }
    try {
      const rawLighting = window.localStorage.getItem(getSceneLightingKey(projectId))
      setSceneLightingSettings(rawLighting ? (JSON.parse(rawLighting) as SceneLightingSettings) : DEFAULT_SCENE_LIGHTING)
    } catch {
      setSceneLightingSettings(DEFAULT_SCENE_LIGHTING)
    }
    try {
      const rawSkills = window.localStorage.getItem(getEnabledSkillsKey(projectId))
      const parsed = rawSkills ? JSON.parse(rawSkills) : null
      setEnabledSkillIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : getDefaultCreatorSkillIds())
    } catch {
      setEnabledSkillIds(getDefaultCreatorSkillIds())
    }
    setDirectorState(readDirectorState(projectId))
  }, [projectId])

  useEffect(() => {
    if (!directorState.updatedAt) return
    writeDirectorState(directorState, projectId)
  }, [directorState, projectId])

  useEffect(() => {
    const stopAutosave = () => {
      isSwitchingProjectRef.current = true
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      if (saveRetryTimerRef.current) {
        window.clearTimeout(saveRetryTimerRef.current)
        saveRetryTimerRef.current = null
      }
      saveAbortRef.current?.abort()
    }
    const resumeAutosave = () => {
      isSwitchingProjectRef.current = false
    }

    window.addEventListener('creator-city:switching-project', stopAutosave)
    window.addEventListener('creator-city:switching-project-cancelled', resumeAutosave)
    return () => {
      window.removeEventListener('creator-city:switching-project', stopAutosave)
      window.removeEventListener('creator-city:switching-project-cancelled', resumeAutosave)
    }
  }, [])

  useEffect(() => {
    if (liveStatusLoading) {
      providerStatusPerfStartedRef.current = true
      devPerf('providers', 'start')
    } else if (providerStatusPerfStartedRef.current) {
      providerStatusPerfStartedRef.current = false
      devPerf('providers', 'end')
    }
  }, [liveStatusLoading])

  useEffect(() => {
    let disposed = false
    fetch('/api/generation/health', { credentials: 'include', cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: GenerationHealthResponse | null) => {
        if (disposed || !data) return
        setGenerationHealth(data)
      })
      .catch(() => undefined)
    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    let disposed = false
    fetch('/api/generate/image', { credentials: 'include', cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { success?: boolean; providers?: ImageProviderStatusInfo[] } | null) => {
        if (disposed || !data?.success || !Array.isArray(data.providers)) return
        const next = new Map<string, ImageProviderStatusInfo>()
        for (const provider of data.providers) {
          if (!provider.providerId) continue
          next.set(provider.providerId, {
            ...provider,
            missingEnv: provider.missingEnv ?? provider.missingEnvKeys ?? [],
          })
        }
        setImageProviderStatusMap(next)
      })
      .catch(() => undefined)
    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    let disposed = false
    fetch('/api/generate/video', { credentials: 'include', cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { success?: boolean; providers?: VideoProviderStatusInfo[] } | null) => {
        if (disposed || !data?.success || !Array.isArray(data.providers)) return
        const next = new Map<string, VideoProviderStatusInfo>()
        for (const provider of data.providers) {
          if (!provider.providerId) continue
          next.set(provider.providerId, {
            ...provider,
            missingEnv: provider.missingEnv ?? provider.missingEnvKeys ?? [],
          })
        }
        setVideoProviderStatusMap(next)
      })
      .catch(() => undefined)
    return () => {
      disposed = true
    }
  }, [])

  // ── Canvas Modal Manager ─────────────────────────────────────────────────
  // Single-modal coordinator: at most one panel open at a time.
  // All useState setters from useState are stable — empty deps is safe here.

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Shared reset — used by closeCanvasPanel, openCanvasPanel, and project lifecycle
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resetCanvasModalStates = useCallback(() => {
    setIsLexiconOpen(false)
    setIsVariantPlannerOpen(false)
    setIsCharacterLockOpen(false)
    setIsABCompareOpen(false)
    setIsKeyframeExtractorOpen(false)
    setIsShotListBuilderOpen(false)
    setIsShotSequencerOpen(false)
    setIsContinuityCheckerOpen(false)
    setIsCharacterBibleOpen(false)
    setIsSceneBibleOpen(false)
    setIsCameraControlOpen(false)
    setIsSceneLightingOpen(false)
    setIsPromptBoosterOpen(false)
    setIsBatchRewriterOpen(false)
    setIsLookPackageOpen(false)
    setIsColorGradePaletteOpen(false)
    setIsRemoveBackgroundOpen(false)
    setIsHdReconstructionOpen(false)
    setIsStoryboardGridSplitOpen(false)
    setIsAnnotationPanelOpen(false)
    setEditingNodeId(null)
    setLockedNodeToolContext(null)
    setScriptSegmentationSource(null)
    setNarrativeBeatSource(null)
    setShotListSourceId(null)
    setActiveCanvasModal(null)
  }, [])

  const closeCanvasPanel = useCallback(() => {
    resetCanvasModalStates()
  }, [resetCanvasModalStates])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const openCanvasPanel = useCallback((id: CanvasModalId, payload?: { nodeId?: string }) => {
    resetCanvasModalStates()
    setActiveCanvasModal(id)
    switch (id) {
      case 'camera-lexicon':     setIsLexiconOpen(true); break
      case 'variant-planner':    setIsVariantPlannerOpen(true); break
      case 'character-lock':     setIsCharacterLockOpen(true); break
      case 'ab-compare':         setIsABCompareOpen(true); break
      case 'keyframe-extractor': setIsKeyframeExtractorOpen(true); break
      case 'shot-list-builder':  setIsShotListBuilderOpen(true); break
      case 'shot-sequencer':     setIsShotSequencerOpen(true); break
      case 'continuity-checker': setIsContinuityCheckerOpen(true); break
      case 'character-bible':    setIsCharacterBibleOpen(true); break
      case 'scene-bible':        setIsSceneBibleOpen(true); break
      case 'camera-control':     setIsCameraControlOpen(true); break
      case 'scene-lighting':     setIsSceneLightingOpen(true); break
      case 'prompt-booster':     setIsPromptBoosterOpen(true); break
      case 'narrative-beat-analysis': break
      case 'batch-rewriter':     setIsBatchRewriterOpen(true); break
      case 'look-package':       setIsLookPackageOpen(true); break
      case 'color-grade':        setIsColorGradePaletteOpen(true); break
      case 'remove-background':  setIsRemoveBackgroundOpen(true); break
      case 'hd-reconstruction':  setIsHdReconstructionOpen(true); break
      case 'storyboard-grid-split': setIsStoryboardGridSplitOpen(true); break
      case 'draw-annotation':    setIsAnnotationPanelOpen(true); break
      case 'generation':
        if (payload?.nodeId) setEditingNodeId(payload.nodeId)
        break
    }
  }, [resetCanvasModalStates])

  const openGenerationDialog = useCallback(
    (nodeId: string) => { openCanvasPanel('generation', { nodeId }) },
    [openCanvasPanel],
  )

  const openNodeScopedTool = useCallback(
    (panelId: CanvasModalId, node: VisualCanvasNode) => {
      // resetCanvasModalStates (called inside openCanvasPanel) sets lockedNodeToolContext to null.
      // Calling setLockedNodeToolContext(ctx) AFTER openCanvasPanel in the same event handler
      // causes React to batch both updates; ctx wins because it is the later setState call.
      openCanvasPanel(panelId)
      setLockedNodeToolContext({
        projectId: projectId ?? '',
        targetNodeId: node.id,
        targetAssetId: node.assetId,
        targetKind: node.kind,
        targetTitle: node.title,
        prompt: node.prompt,
        resultImageUrl: node.resultImageUrl,
        resultVideoUrl: node.resultVideoUrl,
        posterUrl: node.preview?.poster,
        hasMediaResult: nodeHasMediaResult(node),
      })
    },
    [openCanvasPanel, projectId],
  )
  // ── End Canvas Modal Manager ─────────────────────────────────────────────

  const commitNodes = useCallback((next: VisualCanvasNode[] | ((current: VisualCanvasNode[]) => VisualCanvasNode[])) => {
    const resolved = typeof next === 'function' ? next(latestNodesRef.current) : next
    latestNodesRef.current = resolved
    setNodes(resolved)
  }, [])

  const commitEdges = useCallback((next: CanvasEdge[] | ((current: CanvasEdge[]) => CanvasEdge[])) => {
    const resolved = typeof next === 'function' ? next(latestEdgesRef.current) : next
    latestEdgesRef.current = resolved
    setEdges(resolved)
  }, [])

  const clearGenerationTimersAndRequests = useCallback((
    context: GenerationAbortContext = 'stale',
    expectedCanvasIdentity = generationCanvasIdentityRef.current,
  ) => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current.length = 0
    const activeNodeIds = new Set(generationAbortControllersRef.current.keys())
    generationAbortControllersRef.current.forEach((controller, nodeId) => controller.abort({
      context,
      canvasIdentity: expectedCanvasIdentity,
      nodeId,
    } satisfies GenerationAbortReason))
    generationAbortControllersRef.current.clear()
    activeGenerationNodeIdsRef.current.clear()
    if (context === 'background' && generationCanvasIdentityRef.current === expectedCanvasIdentity) {
      commitNodes((current) => cancelBackgroundGenerationNodes(current, activeNodeIds))
    }
  }, [commitNodes])

  const beginNodeGeneration = useCallback((nodeId: string) => {
    if (activeGenerationNodeIdsRef.current.has(nodeId)) return null
    const controller = new AbortController()
    activeGenerationNodeIdsRef.current.add(nodeId)
    generationAbortControllersRef.current.set(nodeId, controller)
    return controller
  }, [])

  const finishNodeGeneration = useCallback((nodeId: string, controller?: AbortController | null) => {
    if (!controller || generationAbortControllersRef.current.get(nodeId) === controller) {
      generationAbortControllersRef.current.delete(nodeId)
      activeGenerationNodeIdsRef.current.delete(nodeId)
    }
  }, [])

  const getCanvasSnapshot = useCallback(() => ({
    nodes: latestNodesRef.current,
    edges: latestEdgesRef.current,
    viewport: latestViewportRef.current,
  }), [])

  const normalizeLocalCanvasSnapshot = useCallback((
    id: string,
    raw: string | null,
  ): CanvasLocalSnapshot | null => {
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as Partial<CanvasLocalSnapshot>
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null
      const parsedProjectId = typeof parsed.projectId === 'string' ? parsed.projectId : id
      if (parsedProjectId !== id) return null
      const workflow = typeof parsed.workflowId === 'string' ? parsed.workflowId : ''
      if (!workflow) return null
      const viewport = parsed.viewport && typeof parsed.viewport === 'object'
        ? parsed.viewport as CanvasLocalSnapshot['viewport']
        : { zoom: 1, pan: { x: 0, y: 0 } }
      return {
        version: 1,
        source: 'local',
        projectId: parsedProjectId,
        workflowId: workflow,
        title: typeof parsed.title === 'string' ? parsed.title : undefined,
        nodes: parsed.nodes as VisualCanvasNode[],
        edges: parsed.edges as CanvasEdge[],
        viewport,
        commentsPreview: Array.isArray(parsed.commentsPreview) ? parsed.commentsPreview as CanvasComment[] : undefined,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        syncedAt: typeof parsed.syncedAt === 'string' ? parsed.syncedAt : undefined,
        serverUpdatedAt: typeof parsed.serverUpdatedAt === 'string' ? parsed.serverUpdatedAt : undefined,
        reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
      }
    } catch {
      return null
    }
  }, [])

  const readBestLocalCanvasSnapshot = useCallback((id: string): { source: LocalCanvasSource; value: CanvasLocalSnapshot } | null => {
    if (typeof window === 'undefined') return null
    const candidates: Array<{ source: LocalCanvasSource; value: CanvasLocalSnapshot }> = []
    try {
      const snapshot = normalizeLocalCanvasSnapshot(id, window.localStorage.getItem(getCanvasSnapshotKey(id)))
      if (snapshot?.nodes.length) candidates.push({ source: 'snapshot', value: snapshot })
      const cache = normalizeLocalCanvasSnapshot(id, window.localStorage.getItem(getCanvasCacheKey(id)))
      if (cache?.nodes.length) candidates.push({ source: 'cache', value: cache })
      const draft = normalizeLocalCanvasSnapshot(id, window.localStorage.getItem(getDraftKey(id)))
      if (draft?.nodes.length) candidates.push({ source: 'draft', value: draft })
      const legacyDraft = normalizeLocalCanvasSnapshot(id, window.localStorage.getItem(getLegacyDraftKey(id)))
      if (legacyDraft?.nodes.length) candidates.push({ source: 'draft', value: legacyDraft })
    } catch {
      return null
    }
    return candidates.sort((left, right) => {
      const delta = timeValue(right.value.updatedAt) - timeValue(left.value.updatedAt)
      if (delta !== 0) return delta
      const sourceRank: Record<LocalCanvasSource, number> = { snapshot: 3, cache: 2, draft: 1 }
      return sourceRank[right.source] - sourceRank[left.source]
    })[0] ?? null
  }, [normalizeLocalCanvasSnapshot])

  const readCommentsCache = useCallback((id: string): CanvasComment[] | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(getCommentsCacheKey(id))
      const parsed = raw ? JSON.parse(raw) as { comments?: CanvasComment[] } : null
      return Array.isArray(parsed?.comments) ? parsed.comments : null
    } catch {
      return null
    }
  }, [])

  const readPendingComments = useCallback((id: string): CanvasComment[] => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(getPendingCommentsKey(id))
      const parsed = raw ? JSON.parse(raw) as { comments?: CanvasComment[] } : null
      return Array.isArray(parsed?.comments) ? parsed.comments : []
    } catch {
      return []
    }
  }, [])

  const writePendingComments = useCallback((id: string, nextComments: CanvasComment[]) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(getPendingCommentsKey(id), JSON.stringify({
        comments: nextComments,
        updatedAt: new Date().toISOString(),
      }))
    } catch {
      // Pending comments stay visible in memory if localStorage is unavailable.
    }
  }, [])

  const writeCommentsCache = useCallback((id: string, nextComments: CanvasComment[]) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(getCommentsCacheKey(id), JSON.stringify({
        comments: nextComments,
        updatedAt: new Date().toISOString(),
      }))
    } catch {
      // Comments are persisted in the database; this cache only speeds panel open.
    }
  }, [])

  const mergeComments = useCallback((serverComments: CanvasComment[], pendingComments: CanvasComment[]) => {
    const seen = new Set<string>()
    return [...pendingComments, ...serverComments]
      .filter((comment) => {
        if (seen.has(comment.id)) return false
        seen.add(comment.id)
        return true
      })
      .sort((left, right) => right.createdAt - left.createdAt)
  }, [])

  const writeCanvasCache = useCallback((args?: {
    projectId?: string
    workflowId?: string
    syncedAt?: string
    serverUpdatedAt?: string
    updatedAt?: string
    nodes?: VisualCanvasNode[]
    edges?: CanvasEdge[]
    viewport?: { zoom: number; pan: { x: number; y: number } }
  }) => {
    const targetProjectId = args?.projectId ?? projectId
    const targetWorkflowId = args?.workflowId ?? workflowId
    if (typeof window === 'undefined' || !targetProjectId || !targetWorkflowId) return
    const snapshot = getCanvasSnapshot()
    const cache: CanvasCache = {
      projectId: targetProjectId,
      workflowId: targetWorkflowId,
      title: loadedProjectTitle,
      nodes: args?.nodes ?? snapshot.nodes,
      edges: args?.edges ?? snapshot.edges,
      viewport: args?.viewport ?? snapshot.viewport,
      updatedAt: args?.updatedAt ?? args?.syncedAt ?? new Date().toISOString(),
      serverUpdatedAt: args?.serverUpdatedAt,
      ...(args?.syncedAt ? { syncedAt: args.syncedAt } : {}),
    }
    try {
      window.localStorage.setItem(getCanvasCacheKey(targetProjectId), JSON.stringify(cache))
    } catch {
      // Cache is an acceleration layer only.
    }
  }, [getCanvasSnapshot, loadedProjectTitle, projectId, workflowId])

  const writeUnifiedLocalSnapshot = useCallback((args?: {
    projectId?: string
    workflowId?: string
    syncedAt?: string
    serverUpdatedAt?: string
    updatedAt?: string
    nodes?: VisualCanvasNode[]
    edges?: CanvasEdge[]
    viewport?: { zoom: number; pan: { x: number; y: number } }
  }) => {
    const targetProjectId = args?.projectId ?? projectId
    const targetWorkflowId = args?.workflowId ?? workflowId
    if (typeof window === 'undefined' || !targetProjectId || !targetWorkflowId) return
    hasUnsyncedLocalChangesRef.current = !args?.syncedAt
    const snapshot = getCanvasSnapshot()
    const updatedAt = args?.updatedAt ?? args?.syncedAt ?? new Date().toISOString()
    const nodesForSnapshot = args?.nodes ?? snapshot.nodes
    const edgesForSnapshot = args?.edges ?? snapshot.edges
    const viewportForSnapshot = args?.viewport ?? snapshot.viewport
    const localSnapshot: CanvasLocalSnapshot = {
      version: 1,
      projectId: targetProjectId,
      workflowId: targetWorkflowId,
      title: loadedProjectTitle,
      nodes: nodesForSnapshot,
      edges: edgesForSnapshot,
      viewport: viewportForSnapshot,
      commentsPreview: latestCommentsRef.current.slice(0, 20),
      updatedAt,
      source: 'local',
      ...(args?.syncedAt ? { syncedAt: args.syncedAt } : {}),
      ...(args?.serverUpdatedAt ? { serverUpdatedAt: args.serverUpdatedAt } : {}),
    }
    const draft: CanvasDraft = {
      projectId: targetProjectId,
      workflowId: targetWorkflowId,
      title: loadedProjectTitle,
      nodes: nodesForSnapshot,
      edges: edgesForSnapshot,
      viewport: viewportForSnapshot,
      updatedAt,
      reason: 'autosave-draft',
      ...(args?.syncedAt ? { syncedAt: args.syncedAt } : {}),
    }
    const cache: CanvasCache = {
      ...draft,
      ...(args?.serverUpdatedAt ? { serverUpdatedAt: args.serverUpdatedAt } : {}),
    }
    try {
      window.localStorage.setItem(getCanvasSnapshotKey(targetProjectId), JSON.stringify(localSnapshot))
      window.localStorage.setItem(getCanvasCacheKey(targetProjectId), JSON.stringify(cache))
      window.localStorage.setItem(getDraftKey(targetProjectId), JSON.stringify(draft))
      window.localStorage.setItem('creator-city:last-project-id', targetProjectId)
      window.localStorage.setItem('creator-city:last-workflow-id', targetWorkflowId)
    } catch {
      // localStorage can fail in private mode; do not disrupt the canvas.
    }
  }, [getCanvasSnapshot, loadedProjectTitle, projectId, workflowId])

  const applyCanvasSnapshot = useCallback((args: {
    projectId: string
    workflowId: string
    title?: string
    nodes: VisualCanvasNode[]
    edges: CanvasEdge[]
    viewport?: unknown
    allowEmpty?: boolean
    status?: SaveStatus
    message?: string
  }) => {
    setProjectId(args.projectId)
    setWorkflowId(args.workflowId)
    if (args.title) {
      setLoadedProjectTitle(args.title)
      if (!projectTitleEditing) setProjectTitleDraft(args.title)
    }
    skipNextAutosaveRef.current = true
    const sanitizedNodes = args.nodes.map((node) => {
      if (!isActiveGenerationStatus(node.status)) return node
      const meta = metadataRecord(node.metadataJson)
      const hasJobId = typeof meta.generationJobId === 'string' && meta.generationJobId.length > 0
      if (hasJobId) {
        // A generationJobId exists — the Asset may already be READY in the DB even though
        // CanvasNode was not updated (cn-executor race). Keep the node alive with its current
        // status so the one-shot recover effect can resolve it. Do NOT mark failed here.
        return {
          ...node,
          metadataJson: { ...meta, reloadRecoveryPending: true },
        }
      }
      // No jobId — no way to recover; downgrade immediately.
      return {
        ...node,
        status: 'failed' as const,
        errorMessage: 'Generation was stopped after reload to prevent token drain.',
        metadataJson: stoppedGenerationMetadata(node.metadataJson, 'reload'),
      }
    })
    // Non-authoritative empty snapshots cannot erase in-memory work. An authorized
    // project load opts in so stale nodes from another project cannot remain visible.
    const existingNodeCount = latestNodesRef.current.length
    if (!args.allowEmpty && sanitizedNodes.length === 0 && existingNodeCount > 0) {
      if (args.status) setSaveStatus(args.status)
      if (args.message !== undefined) setSaveMessage(args.message)
      return
    }
    latestNodesRef.current = sanitizedNodes
    latestEdgesRef.current = args.edges
    commitNodes(sanitizedNodes)
    commitEdges(args.edges)
    const viewport = args.viewport as { zoom?: number; pan?: { x?: number; y?: number } } | undefined
    if (viewport?.zoom) setCanvasZoom(Number(viewport.zoom))
    if (viewport?.pan) setCanvasPan({ x: Number(viewport.pan.x ?? 0), y: Number(viewport.pan.y ?? 0) })
    if (viewport) {
      latestViewportRef.current = {
        zoom: Number(viewport.zoom ?? 1),
        pan: { x: Number(viewport.pan?.x ?? 0), y: Number(viewport.pan?.y ?? 0) },
      }
    }
    setHasStarted(sanitizedNodes.length > 0)
    if (args.status) setSaveStatus(args.status)
    if (args.message !== undefined) setSaveMessage(args.message)
  }, [commitEdges, commitNodes, projectTitleEditing])

  const flushLocalSnapshot = useCallback((syncedAt?: string) => {
    writeUnifiedLocalSnapshot(syncedAt ? { syncedAt, serverUpdatedAt: syncedAt } : undefined)
  }, [writeUnifiedLocalSnapshot])

  useEffect(() => {
    if (!projectTitleEditing) setProjectTitleDraft(loadedProjectTitle)
  }, [loadedProjectTitle, projectTitleEditing])

  const saveCanvas = useCallback(async () => {
    if (!projectId || !workflowId || !hasHydratedCanvasRef.current || isInitializingRef.current || isSwitchingProjectRef.current) return
    // In-flight lock: instead of aborting the current save, queue one pending save.
    // This eliminates the "canceled" requests visible in Network and reduces server concurrency.
    if (saveInFlightRef.current) {
      pendingSaveRef.current = true
      return
    }
    saveInFlightRef.current = true
    const snapshot = getCanvasSnapshot()
    flushLocalSnapshot()
    setSaveStatus('saving')
    setSaveMessage('')
    const controller = new AbortController()
    saveAbortRef.current = controller
    let lastResponseStatus = 0
    let fetchTimedOut = false
    // The client waits beyond the server's internal deadline so a structured
    // failure arrives before this last-resort browser abort.
    const fetchTimeoutId = window.setTimeout(
      () => { fetchTimedOut = true; controller.abort() },
      CANVAS_SAVE_CLIENT_TIMEOUT_MS,
    )
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/canvas`, {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          workflowId,
          viewport: snapshot.viewport,
          nodes: snapshot.nodes,
          edges: snapshot.edges,
          deletedNodeIds: deletedNodeIdsRef.current,
          deletedEdgeIds: deletedEdgeIdsRef.current,
          baseUpdatedAt: serverSaveVersionRef.current,
        }),
      })
      lastResponseStatus = response.status
      const raw = await response.text()
      let data: CanvasSaveResponseData & {
        errorCode?: string
        skipped?: boolean
        reason?: string
      }
      try { data = JSON.parse(raw) as typeof data } catch { data = {} }
      const responseServerVersion = data.serverUpdatedAt ?? data.details?.serverUpdatedAt
      if (responseServerVersion && data.errorCode !== 'CANVAS_SAVE_CONFLICT') {
        serverSaveVersionRef.current = responseServerVersion
      }
      if (response.status === 401) {
        // Do NOT navigate away — that would lose all in-memory canvas state.
        // Write an emergency localStorage draft so nothing is lost, then surface an error.
        try {
          const emergencySnap = getCanvasSnapshot()
          window.localStorage.setItem(
            getDraftKey(projectId),
            JSON.stringify({
              projectId,
              workflowId,
              nodes: emergencySnap.nodes,
              edges: emergencySnap.edges,
              viewport: emergencySnap.viewport,
              updatedAt: new Date().toISOString(),
              reason: 'save-401-emergency',
            }),
          )
        } catch { /* localStorage unavailable — nothing we can do */ }
        setSaveStatus('failed')
        setSaveMessage('登录状态失效，画布暂未保存到服务器。节点已保留在本地草稿中，重新登录后可恢复。')
        return
      }
      const saveFailure = canvasSaveFailure(response.ok, data)
      if (saveFailure) throw new Error(saveFailure)
      if (data.skipped) {
        setSaveStatus('saved')
        setSaveMessage('已同步到云端')
        saveRetryAttemptRef.current = 0
        return
      }
      deletedNodeIdsRef.current = []
      deletedEdgeIdsRef.current = []
      const savedAt = data.serverUpdatedAt ?? data.savedAt ?? new Date().toISOString()
      serverSaveVersionRef.current = savedAt
      flushLocalSnapshot(savedAt)
      setSaveStatus('saved')
      setSaveMessage('已同步到云端')
      saveRetryAttemptRef.current = 0
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError' && !fetchTimedOut) return
      flushLocalSnapshot()
      setSaveStatus('failed')
      setSaveMessage(lastResponseStatus === 0
        ? '网络不稳定，云端保存失败，本地草稿已保存。'
        : '云端保存暂不可用，本地草稿已保存。')
    } finally {
      window.clearTimeout(fetchTimeoutId)
      if (saveAbortRef.current === controller) saveAbortRef.current = null
      saveInFlightRef.current = false
      const shouldDrainPendingSave = consumePendingCanvasSave(pendingSaveRef)
      if (shouldDrainPendingSave && !isSwitchingProjectRef.current) {
        window.queueMicrotask(() => { void saveCanvasRef.current() })
      }
    }
  }, [getCanvasSnapshot, projectId, workflowId, flushLocalSnapshot])

  useEffect(() => {
    saveCanvasRef.current = saveCanvas
  }, [saveCanvas])

  const restoreDraftToServer = useCallback(async () => {
    if (!draftRestorePrompt?.workflowId) return
    const draft = draftRestorePrompt
    setDraftRestorePrompt(null)
    hasUnsyncedLocalChangesRef.current = true
    applyCanvasSnapshot({
      projectId: draft.projectId,
      workflowId: draft.workflowId,
      nodes: draft.nodes,
      edges: draft.edges,
      viewport: draft.viewport,
      status: 'restored-draft',
      message: '本地草稿已恢复，正在同步...',
    })
    hasHydratedCanvasRef.current = true
    isInitializingRef.current = false
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(draft.projectId)}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workflowId: draft.workflowId,
          viewport: draft.viewport,
          nodes: draft.nodes,
          edges: draft.edges,
          deletedNodeIds: [],
          deletedEdgeIds: [],
        }),
      })
      const data = await response.json().catch(() => ({})) as CanvasSaveResponseData & { errorCode?: string }
      const responseServerVersion = data.serverUpdatedAt ?? data.details?.serverUpdatedAt
      if (responseServerVersion && data.errorCode !== 'CANVAS_SAVE_CONFLICT') {
        serverSaveVersionRef.current = responseServerVersion
      }
      const saveFailure = canvasSaveFailure(response.ok, data)
      if (saveFailure) throw new Error(saveFailure)
      const savedAt = data.serverUpdatedAt ?? data.savedAt ?? new Date().toISOString()
      serverSaveVersionRef.current = savedAt
      writeUnifiedLocalSnapshot({
        projectId: draft.projectId,
        workflowId: draft.workflowId,
        nodes: draft.nodes,
        edges: draft.edges,
        viewport: draft.viewport,
        syncedAt: savedAt,
        serverUpdatedAt: savedAt,
      })
      setSaveStatus('saved')
      setSaveMessage('草稿已恢复并同步')
    } catch (error) {
      hasUnsyncedLocalChangesRef.current = true
      setSaveStatus('local-draft')
      setSaveMessage(error instanceof Error ? error.message : '草稿已恢复到本地，稍后可再次保存')
    }
  }, [applyCanvasSnapshot, draftRestorePrompt, writeUnifiedLocalSnapshot])

  const keepServerCanvas = useCallback(() => {
    if (serverSaveVersionRef.current) flushLocalSnapshot(serverSaveVersionRef.current)
    setDraftRestorePrompt(null)
    setSaveStatus('saved')
    setSaveMessage('继续使用服务器版本')
  }, [flushLocalSnapshot])

  const scheduleCanvasSave = useCallback((_delay?: number) => {
    if (!projectId || !workflowId || !hasHydratedCanvasRef.current || isInitializingRef.current || isSwitchingProjectRef.current) return
    // Autosave is local-only — no automatic server PUT.
    // Cloud sync only happens when user clicks "保存到云端".
    flushLocalSnapshot()
    setSaveStatus('local-draft')
    setSaveMessage('本地草稿已保存')
  }, [projectId, workflowId, flushLocalSnapshot])

  const handleManualSave = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void saveCanvas()
  }, [saveCanvas])

  const handleSaveSequenceToCloud = useCallback(async (items: ShotSequenceItem[]): Promise<'success' | 'failed'> => {
    if (!projectId || !workflowId) return 'failed'
    const normalized = normalizeShotSequenceItems(items)
    const state: ShotSequenceState = {
      version: 1,
      projectId,
      items: normalized,
      updatedAt: new Date().toISOString(),
    }
    const snapshot = getCanvasSnapshot()
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/canvas`, {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workflowId,
          viewport: snapshot.viewport,
          nodes: snapshot.nodes,
          edges: snapshot.edges,
          deletedNodeIds: [],
          deletedEdgeIds: [],
          workflowMetadata: { shotSequence: state },
          baseUpdatedAt: serverSaveVersionRef.current,
        }),
      })
      const data = await response.json().catch(() => ({})) as CanvasSaveResponseData & { errorCode?: string; skipped?: boolean }
      const responseServerVersion = data.serverUpdatedAt ?? data.details?.serverUpdatedAt
      if (responseServerVersion && data.errorCode !== 'CANVAS_SAVE_CONFLICT') {
        serverSaveVersionRef.current = responseServerVersion
      }
      if (canvasSaveFailure(response.ok, data)) return 'failed'
      const savedAt = data.serverUpdatedAt ?? data.savedAt
      if (savedAt) {
        serverSaveVersionRef.current = savedAt
        flushLocalSnapshot(savedAt)
      }
      setCloudShotSequence(state)
      return 'success'
    } catch {
      return 'failed'
    }
  }, [flushLocalSnapshot, projectId, workflowId, getCanvasSnapshot])

  const createGeneratedAsset = useCallback(async (args: {
    nodeId: string
    type: 'text' | 'image' | 'video' | 'audio'
    title: string
    url?: string
    dataUrl?: string
    providerId?: string
    generationJobId?: string
    metadataJson?: unknown
  }) => {
    if (!projectId || !workflowId) return
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workflowId,
          nodeId: args.nodeId,
          type: args.type,
          title: args.title,
          url: args.url,
          dataUrl: args.dataUrl,
          providerId: args.providerId,
          generationJobId: args.generationJobId,
          metadataJson: args.metadataJson ?? {},
        }),
      })
      const data = await response.json().catch(() => ({})) as {
        asset?: {
          id?: string
          url?: string | null
          thumbnailUrl?: string | null
          storageProvider?: string | null
          bucket?: string | null
          storageKey?: string | null
          mediaPersistence?: unknown
          generationJobId?: string | null
        }
      }
      if (!response.ok || !data.asset?.id || (args.type !== 'image' && args.type !== 'video')) return

      const stableUrl = typeof data.asset.url === 'string' ? data.asset.url : ''
      const nextNodes = latestNodesRef.current.map((node) => {
        if (node.id !== args.nodeId) return node
        const metadata = metadataRecord(node.metadataJson)
        const mediaPersistence = mediaPersistenceRecord(metadata)
        return {
          ...node,
          assetId: data.asset?.id,
          ...(args.type === 'image' && stableUrl ? { resultImageUrl: stableUrl } : {}),
          ...(args.type === 'video' && stableUrl ? {
            resultVideoUrl: stableUrl,
            preview: { ...(node.preview ?? { type: 'remote-video' as const }), type: 'remote-video' as const, url: stableUrl, poster: data.asset?.thumbnailUrl ?? node.preview?.poster },
          } : {}),
          metadataJson: {
            ...metadata,
            assetId: data.asset?.id,
            ...(stableUrl ? { assetUrl: stableUrl, resolvedUrl: stableUrl } : {}),
            assetResolveStatus: stableUrl ? 'ready' : metadata.assetResolveStatus,
            recoveryStatus: stableUrl ? 'resolved_from_storage_key' : metadata.recoveryStatus,
            storageProvider: data.asset?.storageProvider ?? metadata.storageProvider,
            bucket: data.asset?.bucket ?? metadata.bucket,
            storageKey: data.asset?.storageKey ?? metadata.storageKey,
            generationJobId: data.asset?.generationJobId ?? args.generationJobId ?? metadata.generationJobId,
            mediaPersistence: {
              ...mediaPersistence,
              ...(data.asset?.mediaPersistence && typeof data.asset.mediaPersistence === 'object' ? data.asset.mediaPersistence as Record<string, unknown> : {}),
              status: stableUrl ? 'persisted' : mediaPersistence.status,
              assetId: data.asset?.id,
              storageProvider: data.asset?.storageProvider ?? mediaPersistence.storageProvider,
              bucket: data.asset?.bucket ?? mediaPersistence.bucket,
              storageKey: data.asset?.storageKey ?? mediaPersistence.storageKey,
              persistedAt: new Date().toISOString(),
            },
          },
        }
      })
      commitNodes(nextNodes)
      flushLocalSnapshot()
      void saveCanvas()
    } catch (error) {
      console.warn('[canvas] failed to record generated asset', error)
    }
  }, [commitNodes, flushLocalSnapshot, projectId, saveCanvas, workflowId])

  useEffect(() => {
    let cancelled = false

    async function loadOrCreateProject() {
      devPerf('init')
      isSwitchingProjectRef.current = false
      const nextProjectId = searchParamProjectId
      const initKey = nextProjectId ? `project:${nextProjectId}` : 'ensure'
      if (initStartedRef.current === initKey) return
      initStartedRef.current = initKey
      initAbortRef.current?.abort()
      const abortController = new AbortController()
      initAbortRef.current = abortController

      pendingAutoGenerateIdsRef.current = []
      setPendingAutoGenerateIds([])
      clearGenerationTimersAndRequests()
      resetCanvasModalStates()
      setSaveStatus('opening')
      setSaveMessage('')
      setDraftRestorePrompt(null)
      canvasLoadedRef.current = false
      hasHydratedCanvasRef.current = false
      isInitializingRef.current = true
      serverSaveVersionRef.current = undefined

      try {
        const resolvedProjectId = nextProjectId
        if (isPlaceholderProjectId(resolvedProjectId)) {
          setSaveStatus('failed')
          setSaveMessage('这是示例地址，请从项目列表选择真实项目。')
          isInitializingRef.current = false
          return
        }

        if (!resolvedProjectId) {
          setSaveMessage('正在打开项目...')
          // Do NOT fall back to last-project-id from localStorage here.
          // That key may belong to a previously logged-in user and would cause
          // a cross-account 403 before the entry-point fix could prevent it.
          // /api/projects/ensure always returns the current user's own project.
          devPerf('canvas-fetch', 'start')
          const ensureRes = await fetch('/api/projects/ensure?includeCanvas=1', {
            method: 'POST',
            credentials: 'include',
            signal: abortController.signal,
          })
          devPerf('canvas-fetch', 'end')
          const ensureData = await ensureRes.json().catch(() => ({})) as {
            success?: boolean; errorCode?: string; message?: string
            project?: { id: string; title: string }; workflow?: { id: string; viewportJson?: unknown; metadataJson?: unknown; updatedAt?: string }
            nodes?: VisualCanvasNode[]; edges?: CanvasEdge[]; viewport?: unknown; serverUpdatedAt?: string
          }
          if (ensureRes.status === 401) { router.replace(`/auth/login?next=${encodeURIComponent('/create')}`); return }
          if (ensureData.errorCode === 'DB_SCHEMA_MISSING') throw new Error('项目表未同步，请执行 project-canvas-setup.sql')
          if (!ensureRes.ok || !ensureData.project?.id || !ensureData.workflow?.id) throw new Error(ensureData.message ?? '打开项目失败。')
          if (cancelled) return
          persistWorkflowStyleBibleFallback(ensureData.project.id, ensureData.workflow.metadataJson)
          persistWorkflowCharacterBibleFallback(ensureData.project.id, ensureData.workflow.metadataJson)
          persistWorkflowSceneBibleFallback(ensureData.project.id, ensureData.workflow.metadataJson)
          setCharacterBible(loadCharacterBible(ensureData.project.id, ensureData.workflow.metadataJson))
          setSceneBible(loadSceneBible(ensureData.project.id, ensureData.workflow.metadataJson))
          setCloudShotSequence(parseShotSequenceFromWorkflowMetadata(ensureData.workflow.metadataJson))
          try {
            window.localStorage.setItem('creator-city:last-project-id', ensureData.project.id)
            if (ensureData.workflow?.id) window.localStorage.setItem('creator-city:last-workflow-id', ensureData.workflow.id)
          } catch (_) { /* private mode */ }
          serverSaveVersionRef.current = ensureData.serverUpdatedAt ?? ensureData.workflow.updatedAt
          applyCanvasSnapshot({
            projectId: ensureData.project.id,
            workflowId: ensureData.workflow.id,
            title: ensureData.project.title,
            nodes: (ensureData.nodes ?? []) as VisualCanvasNode[],
            edges: (ensureData.edges ?? []) as CanvasEdge[],
            viewport: ensureData.viewport ?? ensureData.workflow.viewportJson,
            allowEmpty: true,
            status: 'saved',
            message: '已同步',
          })
          writeCanvasCache({
            projectId: ensureData.project.id,
            workflowId: ensureData.workflow.id,
            nodes: (ensureData.nodes ?? []) as VisualCanvasNode[],
            edges: (ensureData.edges ?? []) as CanvasEdge[],
            viewport: (ensureData.viewport ?? ensureData.workflow.viewportJson) as CanvasCache['viewport'],
            serverUpdatedAt: ensureData.serverUpdatedAt ?? ensureData.workflow.updatedAt,
            syncedAt: ensureData.serverUpdatedAt ?? ensureData.workflow.updatedAt,
          })
          hasUnsyncedLocalChangesRef.current = false
          canvasLoadedRef.current = true
          hasHydratedCanvasRef.current = true
          isInitializingRef.current = false
          initStartedRef.current = `project:${ensureData.project.id}`
          router.replace(`/create?projectId=${encodeURIComponent(ensureData.project.id)}`)
          return
        }

        // Do NOT render local draft before API authorization is confirmed.
        // A stale draft from a previous user session would leak cross-account canvas data
        // if shown before the server returns 403/401.
        const localPreview = readBestLocalCanvasSnapshot(resolvedProjectId)

        devPerf('canvas-fetch', 'start')
        const response = await fetch(`/api/projects/${encodeURIComponent(resolvedProjectId)}/canvas`, {
          credentials: 'include',
          signal: abortController.signal,
        })
        devPerf('canvas-fetch', 'end')
        const data = await response.json().catch(() => ({})) as CanvasLoadResponse
        if (response.status === 401) {
          // Session invalid — never display local draft on 401.
          // Local state may belong to a different user who was previously logged in
          // on the same browser; rendering it would expose cross-account data.
          // Clear the project pointer so the next navigation re-resolves via /api/projects/ensure.
          try {
            window.localStorage.removeItem('creator-city:last-project-id')
            window.localStorage.removeItem('creator-city:last-workflow-id')
          } catch (_) { /* private mode */ }
          setSaveStatus('failed')
          setSaveMessage('登录状态失效，请重新登录后再加载画布。')
          hasHydratedCanvasRef.current = false
          isInitializingRef.current = false
          return
        }
        if (data.errorCode === 'DB_SCHEMA_MISSING') throw new Error('项目表未同步，请执行 project-canvas-setup.sql')
        if (!response.ok && (data.errorCode === 'PROJECT_NOT_FOUND' || data.errorCode === 'FORBIDDEN')) {
          // Clear all local state for this project — it belongs to a different user.
          // Without this, a stale draft persists in localStorage and leaks on the next visit.
          clearProjectScopedLocalState(resolvedProjectId)
          try {
            if (window.localStorage.getItem('creator-city:last-project-id') === resolvedProjectId) {
              window.localStorage.removeItem('creator-city:last-project-id')
              window.localStorage.removeItem('creator-city:last-workflow-id')
            }
          } catch (_) {
            // Fall through to server ensure through /create.
          }
          // Immediately clear canvas state so no stale nodes are visible during redirect.
          commitNodes([])
          commitEdges([])
          hasHydratedCanvasRef.current = false
          isInitializingRef.current = false
          router.replace('/create')
          return
        }
        if (!response.ok) throw new Error(data.message ?? '加载画布失败。')
        if (cancelled) return
        persistWorkflowStyleBibleFallback(resolvedProjectId, data.workflow?.metadataJson)
        persistWorkflowCharacterBibleFallback(resolvedProjectId, data.workflow?.metadataJson)
        persistWorkflowSceneBibleFallback(resolvedProjectId, data.workflow?.metadataJson)
        setCharacterBible(loadCharacterBible(resolvedProjectId, data.workflow?.metadataJson))
        setSceneBible(loadSceneBible(resolvedProjectId, data.workflow?.metadataJson))
        setCloudShotSequence(parseShotSequenceFromWorkflowMetadata(data.workflow?.metadataJson))

        // Persist so next visit to /create (without ?projectId) reopens this project
        try {
          window.localStorage.setItem('creator-city:last-project-id', resolvedProjectId)
          if (data.workflow?.id) window.localStorage.setItem('creator-city:last-workflow-id', data.workflow.id)
        } catch (_) { /* private mode */ }

        setProjectId(resolvedProjectId)
        setWorkflowId(data.workflow?.id ?? '')
        const serverNodes = (data.nodes ?? []) as VisualCanvasNode[]
        const serverEdges = (data.edges ?? []) as CanvasEdge[]
        const serverUpdatedAtText = data.serverUpdatedAt ?? data.workflow?.updatedAt
        serverSaveVersionRef.current = serverUpdatedAtText
        const localCandidate = readBestLocalCanvasSnapshot(resolvedProjectId) ?? localPreview
        const viewport = data.viewport ?? data.workflow?.viewportJson
        const serverWorkflowId = data.workflow?.id ?? ''
        const recoveryDecision = decideCanvasDraftRecovery({
          projectId: resolvedProjectId,
          workflowId: serverWorkflowId,
          serverUpdatedAt: serverUpdatedAtText,
          serverNodeCount: serverNodes.length,
          local: localCandidate ? {
            projectId: localCandidate.value.projectId,
            workflowId: localCandidate.value.workflowId,
            updatedAt: localCandidate.value.updatedAt,
            syncedAt: localCandidate.value.syncedAt,
            serverUpdatedAt: localCandidate.value.serverUpdatedAt,
            nodeCount: localCandidate.value.nodes.length,
          } : null,
        })
        applyCanvasSnapshot({
          projectId: resolvedProjectId,
          workflowId: serverWorkflowId,
          title: data.project?.title ?? projectTitle,
          nodes: serverNodes,
          edges: serverEdges,
          viewport,
          allowEmpty: true,
        })
        if (recoveryDecision.action === 'prompt-local-recovery' && localCandidate) {
          setDraftRestorePrompt({
            projectId: resolvedProjectId,
            workflowId: serverWorkflowId,
            nodes: localCandidate.value.nodes,
            edges: localCandidate.value.edges,
            viewport: localCandidate.value.viewport,
            source: localCandidate.source,
          })
          setSaveStatus('saved')
          setSaveMessage('检测到未同步的本地草稿，可选择恢复。')
        } else {
          setDraftRestorePrompt(null)
          writeCanvasCache({
            projectId: resolvedProjectId,
            workflowId: serverWorkflowId,
            nodes: serverNodes,
            edges: serverEdges,
            viewport: viewport as CanvasCache['viewport'],
            serverUpdatedAt: serverUpdatedAtText,
            syncedAt: serverUpdatedAtText,
          })
          setSaveStatus('saved')
          setSaveMessage('已同步')
        }
        hasUnsyncedLocalChangesRef.current = false
        canvasLoadedRef.current = true
        hasHydratedCanvasRef.current = true
        isInitializingRef.current = false
        devPerf('first-render')
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') return
        if (cancelled) return
        const fallbackProjectId = searchParamProjectId
        const localFallback = fallbackProjectId ? readBestLocalCanvasSnapshot(fallbackProjectId) : null
        if (localFallback?.value.workflowId && !latestNodesRef.current.length) {
          applyCanvasSnapshot({
            projectId: fallbackProjectId || localFallback.value.projectId,
            workflowId: localFallback.value.workflowId,
            title: localFallback.value.title,
            nodes: localFallback.value.nodes,
            edges: localFallback.value.edges,
            viewport: localFallback.value.viewport,
            status: 'local-draft',
            message: '远端画布加载失败，已保留本地草稿。',
          })
          hasUnsyncedLocalChangesRef.current = true
          hasHydratedCanvasRef.current = true
        }
        setSaveStatus(localFallback?.value.nodes.length ? 'local-draft' : 'failed')
        setSaveMessage(`${error instanceof Error ? error.message : '加载项目失败。'}${localFallback?.value.nodes.length ? '；已保留本地草稿' : ''}`)
        isInitializingRef.current = false
      }
    }

    void loadOrCreateProject()
    return () => {
      cancelled = true
      initAbortRef.current?.abort()
    }
  }, [applyCanvasSnapshot, clearGenerationTimersAndRequests, projectTitle, readBestLocalCanvasSnapshot, router, searchParamProjectId, writeCanvasCache])

  useEffect(() => {
    latestViewportRef.current = { zoom: canvasZoom, pan: canvasPan }
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false
      return
    }
    if (hasHydratedCanvasRef.current && !isInitializingRef.current) {
      flushLocalSnapshot()
    }
    scheduleCanvasSave()
  }, [canvasPan, canvasZoom, edges, nodes, scheduleCanvasSave, flushLocalSnapshot])

  // Flush pending save on page leave / tab hide / component unmount
  useEffect(() => {
    if (!projectId || !workflowId) return
    const canvasIdentity = generationCanvasIdentity(projectId, workflowId)

    function flushBeforeLeave(context: 'background' | 'stale') {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      if (context === 'background') {
        clearGenerationTimersAndRequests('background', canvasIdentity)
        flushLocalSnapshot()
        scheduleCanvasSave(0)
      } else {
        if (hasUnsyncedLocalChangesRef.current) flushLocalSnapshot()
        clearGenerationTimersAndRequests('stale', canvasIdentity)
      }
    }

    const onPageHide = () => flushBeforeLeave('stale')
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flushBeforeLeave('background') }
    const onBeforeUnload = () => flushBeforeLeave('stale')

    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      flushBeforeLeave('stale')
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [clearGenerationTimersAndRequests, flushLocalSnapshot, projectId, scheduleCanvasSave, workflowId])

  // One-shot DB recovery: after canvas loads, for each node flagged reloadRecoveryPending=true,
  // check if a READY Asset already exists in the DB (cn-executor may have written Asset but
  // failed to back-fill CanvasNode). Recovered nodes → done + URL. Non-recovered or network
  // failure → leave in current active status unchanged (do NOT mark failed).
  const reloadRecoveryDoneRef = useRef(false)
  useEffect(() => {
    if (!projectId || !workflowId) return
    if (reloadRecoveryDoneRef.current) return
    const pendingNodes = latestNodesRef.current.filter(
      (n) => metadataRecord(n.metadataJson).reloadRecoveryPending === true
    )
    if (pendingNodes.length === 0) return
    reloadRecoveryDoneRef.current = true
    const abortCtrl = new AbortController()
    void (async () => {
      try {
        const resp = await fetch(
          `/api/assets/recover-canvas-nodes?projectId=${encodeURIComponent(projectId)}`,
          { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' }, signal: abortCtrl.signal }
        )
        if (!resp.ok) return // network/auth error → leave all nodes in current active status
        const data = await resp.json() as { items?: Array<{ nodeId: string; kind: string; url: string; assetId: string }> }
        const recoveredMap = new Map((data.items ?? []).map((i) => [i.nodeId, i]))
        // Only patch nodes that were actually recovered — leave the rest untouched (still active).
        const anyRecovered = (data.items ?? []).length > 0
        if (!anyRecovered) return
        commitNodes((current) =>
          current.map((node) => {
            if (metadataRecord(node.metadataJson).reloadRecoveryPending !== true) return node
            const hit = recoveredMap.get(node.id)
            if (!hit) return node // not recovered → keep active status as-is
            const meta = metadataRecord(node.metadataJson)
            return {
              ...node,
              status: 'done' as const,
              errorMessage: undefined,
              resultImageUrl: hit.kind === 'image' ? hit.url : node.resultImageUrl,
              resultVideoUrl: hit.kind === 'video' ? hit.url : node.resultVideoUrl,
              metadataJson: {
                ...meta,
                reloadRecoveryPending: undefined,
                recoveryStatus: 'ready',
                assetId: hit.assetId,
                loading: false,
                errorCode: null,
                errorMessage: null,
              },
            }
          })
        )
        scheduleCanvasSave(0)
      } catch (err) {
        // Navigation abort (page unload / project switch) — suppress, not an error.
        if (err instanceof DOMException && err.name === 'AbortError') return
        // Other network errors → keep all pending nodes in their current active status.
      }
    })()
    return () => { abortCtrl.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, workflowId])

  const setZoomAroundPoint = useCallback((nextZoomInput: number, clientPoint?: { x: number; y: number }) => {
    const nextZoom = clampCanvasZoom(nextZoomInput)
    setCanvasZoom((currentZoom) => {
      const viewportRect = viewportRef.current?.getBoundingClientRect()
      if (!viewportRect || Math.abs(nextZoom - currentZoom) < 0.001) return nextZoom

      const focalX = (clientPoint?.x ?? viewportRect.left + viewportRect.width / 2) - viewportRect.left
      const focalY = (clientPoint?.y ?? viewportRect.top + viewportRect.height / 2) - viewportRect.top
      const scale = nextZoom / currentZoom

      setCanvasPan((currentPan) => ({
        x: focalX - (focalX - currentPan.x) * scale,
        y: focalY - (focalY - currentPan.y) * scale,
      }))

      return nextZoom
    })
  }, [])

  const resetCanvasView = useCallback(() => {
    setCanvasZoom(1)
    setCanvasPan({ x: 0, y: 0 })
  }, [])

  const fitCanvasView = useCallback(() => {
    setCanvasZoom(0.82)
    setCanvasPan({ x: 70, y: 20 })
  }, [])

  const showCanvasFeedback = useCallback((message: string) => {
    setCanvasFeedback(message)
    const timer = window.setTimeout(() => setCanvasFeedback(''), 2200)
    timersRef.current.push(timer)
  }, [])

  const saveProjectTitle = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!projectId || projectTitleSaving) return

    const nextTitle = projectTitleDraft.trim() || 'Untitled Project'
    if (nextTitle === loadedProjectTitle) {
      setProjectTitleEditing(false)
      setProjectTitleError('')
      return
    }

    setProjectTitleSaving(true)
    setProjectTitleError('')
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ title: nextTitle }),
      })
      const raw = await response.text()
      const data = raw ? JSON.parse(raw) as { project?: { title?: string }; message?: string; errorCode?: string } : {}
      if (!response.ok) throw new Error(data.message ?? data.errorCode ?? '项目名称保存失败。')

      const savedTitle = data.project?.title || nextTitle
      setLoadedProjectTitle(savedTitle)
      setProjectTitleDraft(savedTitle)
      setProjectTitleEditing(false)
      showCanvasFeedback('项目名称已保存。')

      try {
        const rawCanvasCache = window.localStorage.getItem(`creator-city:canvas-cache:${projectId}`)
        if (rawCanvasCache) {
          const cachedCanvas = JSON.parse(rawCanvasCache) as Record<string, unknown>
          window.localStorage.setItem(`creator-city:canvas-cache:${projectId}`, JSON.stringify({
            ...cachedCanvas,
            title: savedTitle,
            updatedAt: new Date().toISOString(),
          }))
        }
        const rawProjects = window.localStorage.getItem('creator-city:projects-cache')
        if (rawProjects) {
          const cached = JSON.parse(rawProjects) as { projects?: Array<{ id?: string; title?: string }> }
          if (Array.isArray(cached.projects)) {
            window.localStorage.setItem('creator-city:projects-cache', JSON.stringify({
              ...cached,
              projects: cached.projects.map((project) => (
                project.id === projectId ? { ...project, title: savedTitle, updatedAt: new Date().toISOString() } : project
              )),
              updatedAt: new Date().toISOString(),
            }))
          }
        }
      } catch {
        // Cache refresh is best-effort.
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '项目名称保存失败。'
      setProjectTitleError(message)
      showCanvasFeedback(message)
    } finally {
      setProjectTitleSaving(false)
    }
  }, [loadedProjectTitle, projectId, projectTitleDraft, projectTitleSaving, showCanvasFeedback])

  const closeActivePreview = useCallback((options?: { closeReviewWindows?: boolean }) => {
    setActivePreviewNodeId(null)
    setActivePreviewType(null)
    if (options?.closeReviewWindows !== false) {
      setMediaReviewWindows([])
    }
    setTextEditorDraft('')
    setTextEditorCopied(false)
    setPreviewLinkCopied(false)
    setSelectedSceneEditId('')
    setSceneEditInstructionsCopied(false)
  }, [])

  const closePromptInspector = useCallback(() => {
    setActiveInspectorNodeId(null)
  }, [])

  const closeMediaDiagnostics = useCallback(() => {
    setActiveMediaDiagnostics(null)
  }, [])

  const closeCreativeAssets = useCallback(() => {
    setActiveCreativeAssetsNodeId(null)
    setActiveSceneLabSourceNodeId('')
  }, [])

  const closeEdgeDirector = useCallback(() => {
    setActiveEdgeId(null)
  }, [])

  const deleteNode = useCallback((nodeId: string) => {
    pendingAutoGenerateIdsRef.current = pendingAutoGenerateIdsRef.current.filter((id) => id !== nodeId)
    setPendingAutoGenerateIds((prev) => prev.filter((id) => id !== nodeId))
    const generationController = generationAbortControllersRef.current.get(nodeId)
    generationController?.abort({
      context: 'deleted',
      canvasIdentity: generationCanvasIdentityRef.current,
      nodeId,
    } satisfies GenerationAbortReason)
    generationAbortControllersRef.current.delete(nodeId)
    activeGenerationNodeIdsRef.current.delete(nodeId)
    deletedNodeIdsRef.current = [...new Set([...deletedNodeIdsRef.current, nodeId])]
    const removedEdges = edges
      .filter((edge) => edge.fromNodeId === nodeId || edge.toNodeId === nodeId)
      .map((edge) => edge.id)
    deletedEdgeIdsRef.current = [...new Set([...deletedEdgeIdsRef.current, ...removedEdges])]
    commitNodes((current) => current.filter((node) => node.id !== nodeId))
    commitEdges((current) => current.filter((edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId))
    setActiveNodeId((current) => (current === nodeId ? null : current))
    setEditingNodeId((current) => (current === nodeId ? null : current))
    if (activePreviewNodeId === nodeId) {
      closeActivePreview()
    }
    setMediaReviewWindows((current) => current.filter((review) => review.nodeId !== nodeId))
    if (activeInspectorNodeId === nodeId) {
      closePromptInspector()
    }
    if (activeMediaDiagnostics?.nodeId === nodeId) {
      closeMediaDiagnostics()
    }
    if (activeCreativeAssetsNodeId === nodeId) {
      closeCreativeAssets()
    }
    setActiveEdgeId((current) => current && removedEdges.includes(current) ? null : current)
    setContextMenu(null)
    setNodeAddMenu(null)
    setConnectionDraft(null)
  }, [activeCreativeAssetsNodeId, activeInspectorNodeId, activeMediaDiagnostics?.nodeId, activePreviewNodeId, closeActivePreview, closeCreativeAssets, closeMediaDiagnostics, closePromptInspector, commitEdges, commitNodes, edges])

  const duplicateNode = useCallback((node: VisualCanvasNode, offset = 40) => {
    const position = resolveNonOverlappingPosition(
      { x: node.x + offset, y: node.y + offset, width: node.width, height: node.height },
      nodes,
    )
    const nodeId = createNodeId(node.kind)
    const duplicate: VisualCanvasNode = {
      ...node,
      id: nodeId,
      title: `${node.title} 副本`,
      x: position.x,
      y: position.y,
      status: isActiveGenerationStatus(node.status) ? 'idle' : node.status,
      createdAt: Date.now(),
    }

    commitNodes((current) => [...current, duplicate])
    setActiveNodeId(nodeId)
    setEditingNodeId(null)
    closeActivePreview({ closeReviewWindows: false })
    setContextMenu(null)
    setNodeAddMenu(null)
    return duplicate
  }, [closeActivePreview, commitNodes, nodes])

  const createStableCopyFromExpiredNode = useCallback((node: VisualCanvasNode) => {
    if (node.kind !== 'image' && node.kind !== 'video') return
    const position = resolveNonOverlappingPosition(
      { x: node.x + node.width + 120, y: node.y, width: node.width, height: node.height },
      nodes,
    )
    const now = new Date().toISOString()
    const nodeId = createNodeId(node.kind)
    const previousMetadata = metadataRecord(node.metadataJson)
    const providerId = normalizeProviderId(node.providerId || node.model || (node.kind === 'image' ? NODE_META.image.model : NODE_META.video.model))
    const expiredMediaUrl = node.kind === 'image' ? getNodeImageUrl(node) : getNodeVideoUrl(node)
    const metadataJson = {
      providerId,
      model: previousMetadata.model ?? node.model,
      params: previousMetadata.params,
      generationParams: previousMetadata.generationParams,
      aspectRatio: previousMetadata.aspectRatio,
      ratio: previousMetadata.ratio ?? node.ratio,
      recreatedFromExpiredNodeId: node.id,
      recreatedFromExpiredMediaUrl: expiredMediaUrl,
      recreatedAt: now,
      mediaPersistence: {
        status: 'missing',
        message: '源媒体链接已过期，旧结果未转存到素材库。此节点用于重新生成稳定副本。',
      },
    }
    const nextNode: VisualCanvasNode = {
      id: nodeId,
      type: node.kind,
      kind: node.kind,
      title: `${node.title || (node.kind === 'image' ? 'Image' : 'Video')} 稳定副本`,
      subtitle: node.subtitle,
      prompt: node.prompt,
      model: providerId,
      providerId,
      stage: node.stage || promptStage,
      ratio: node.ratio,
      status: 'idle',
      resultPreview: undefined,
      outputLabel: undefined,
      x: position.x,
      y: position.y,
      width: node.width,
      height: node.height,
      createdAt: Date.now(),
      metadataJson,
    }
    commitNodes((current) => [...current, nextNode])
    setActiveNodeId(nodeId)
    openGenerationDialog(nodeId)
    setCanvasPrompt(node.prompt)
    setPromptModel(providerId)
    setPreferredKind(node.kind)
    closeActivePreview()
    flushLocalSnapshot()
    scheduleCanvasSave(0)
    showCanvasFeedback('已创建稳定副本节点，未自动生成。')
  }, [closeActivePreview, commitNodes, flushLocalSnapshot, nodes, openGenerationDialog, promptStage, scheduleCanvasSave, showCanvasFeedback])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      return Boolean(element?.closest('input, textarea, [contenteditable="true"]'))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (event.isComposing) return
        // If a managed modal/panel is open, close only that one and stop.
        if (activeCanvasModal) {
          event.preventDefault()
          event.stopPropagation()
          closeCanvasPanel()
          return
        }
        if (activePreviewNodeId || mediaReviewWindows.length > 0 || activeInspectorNodeId || activeCreativeAssetsNodeId) {
          event.preventDefault()
        }
        if (activePreviewNodeId || mediaReviewWindows.length > 0) {
          closeActivePreview()
        }
        if (activeInspectorNodeId) {
          closePromptInspector()
        }
        if (activeCreativeAssetsNodeId) {
          closeCreativeAssets()
        }
        if (activeEdgeId) {
          closeEdgeDirector()
        }
        setStoryboardPreviewOpen(false)
        setStoryboardDirectorOpen(false)
        closeCanvasPanel()
        setContextMenu(null)
        setNodeAddMenu(null)
        setNodeCreateMenu(null)
        setConnectionDraft(null)
        connectionDragRef.current = null
        setIsAddMenuOpen(false)
        return
      }

      if (isEditableTarget(event.target)) return
      if (event.code === 'Space') {
        setIsSpacePressed(true)
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && activeNodeId) {
        event.preventDefault()
        deleteNode(activeNodeId)
        return
      }

      if (!event.metaKey && !event.ctrlKey) return
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setZoomAroundPoint(canvasZoom + CANVAS_ZOOM_STEP)
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        setZoomAroundPoint(canvasZoom - CANVAS_ZOOM_STEP)
      }
      if (event.key === '0') {
        event.preventDefault()
        resetCanvasView()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsSpacePressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [activeCanvasModal, activeCreativeAssetsNodeId, activeEdgeId, activeInspectorNodeId, activeNodeId, activePreviewNodeId, canvasZoom, closeActivePreview, closeCanvasPanel, closeCreativeAssets, closeEdgeDirector, closePromptInspector, deleteNode, mediaReviewWindows.length, resetCanvasView, setZoomAroundPoint])

  const activeNode = useMemo(
    () => nodes.find((node) => node.id === activeNodeId) ?? null,
    [activeNodeId, nodes],
  )
  const activeEdge = useMemo(
    () => edges.find((edge) => edge.id === activeEdgeId) ?? null,
    [activeEdgeId, edges],
  )
  const activeEdgeSourceNode = useMemo(
    () => nodes.find((node) => node.id === activeEdge?.fromNodeId) ?? null,
    [activeEdge?.fromNodeId, nodes],
  )
  const activeEdgeTargetNode = useMemo(
    () => nodes.find((node) => node.id === activeEdge?.toNodeId) ?? null,
    [activeEdge?.toNodeId, nodes],
  )
  const activeInspectorNode = useMemo(
    () => nodes.find((node) => node.id === activeInspectorNodeId) ?? null,
    [activeInspectorNodeId, nodes],
  )
  const activeMediaDiagnosticsNode = useMemo(
    () => nodes.find((node) => node.id === activeMediaDiagnostics?.nodeId) ?? null,
    [activeMediaDiagnostics?.nodeId, nodes],
  )
  const activeMediaDiagnosticsUrl = activeMediaDiagnosticsNode && activeMediaDiagnostics
    ? activeMediaDiagnostics.type === 'image'
      ? getNodeImageUrl(activeMediaDiagnosticsNode)
      : getNodeVideoUrl(activeMediaDiagnosticsNode)
    : ''
  const activeCreativeAssetsNode = useMemo(
    () => nodes.find((node) => node.id === activeCreativeAssetsNodeId) ?? null,
    [activeCreativeAssetsNodeId, nodes],
  )
  const activeInspectorUpstreamNodes = useMemo(() => {
    if (!activeInspectorNodeId) return []
    const upstreamIds = new Set(
      edges
        .filter((edge) => edge.toNodeId === activeInspectorNodeId)
        .map((edge) => edge.fromNodeId),
    )
    return nodes.filter((node) => upstreamIds.has(node.id))
  }, [activeInspectorNodeId, edges, nodes])
  const activeInspectorIncomingEdges = useMemo(
    () => activeInspectorNodeId
      ? edges.filter((edge) => edge.toNodeId === activeInspectorNodeId)
      : [],
    [activeInspectorNodeId, edges],
  )
  const activeInspectorCharacterContext = useMemo(() => (
    activeInspectorNode
      ? resolveCharacterPromptContext({
          node: activeInspectorNode,
          upstreamNodes: activeInspectorUpstreamNodes,
          incomingEdges: activeInspectorIncomingEdges,
          characterBible,
        })
      : null
  ), [activeInspectorIncomingEdges, activeInspectorNode, activeInspectorUpstreamNodes, characterBible])
  const activeInspectorSceneContext = useMemo(() => (
    activeInspectorNode
      ? resolveScenePromptContext({
          node: activeInspectorNode,
          upstreamNodes: activeInspectorUpstreamNodes,
          incomingEdges: activeInspectorIncomingEdges,
          sceneBible,
        })
      : null
  ), [activeInspectorIncomingEdges, activeInspectorNode, activeInspectorUpstreamNodes, sceneBible])
  const storyboardShotCount = useMemo(
    () => buildStoryboardFromCanvas(nodes, edges).length,
    [edges, nodes],
  )
  const enabledCreatorSkills = useMemo(
    () => resolveCreatorSkills(enabledSkillIds),
    [enabledSkillIds],
  )

  const persistStyleBibleSettings = useCallback((nextStyleBible = styleBible, nextSkillIds = enabledSkillIds) => {
    if (typeof window === 'undefined' || !projectId) return
    const styleBibleWithTimestamp = {
      ...nextStyleBible,
      updatedAt: new Date().toISOString(),
    }
    setStyleBible(styleBibleWithTimestamp)
    setEnabledSkillIds(nextSkillIds)
    try {
      window.localStorage.setItem(getStyleBibleKey(projectId), JSON.stringify(styleBibleWithTimestamp))
      window.localStorage.setItem(getEnabledSkillsKey(projectId), JSON.stringify(nextSkillIds))
    } catch {
      // Local persistence is a fallback; generation can still use in-memory settings.
    }
    flushLocalSnapshot()
    scheduleCanvasSave(0)
  }, [enabledSkillIds, flushLocalSnapshot, projectId, scheduleCanvasSave, styleBible])

  const persistCharacterBibleSettings = useCallback((nextBible: CharacterBible) => {
    if (!projectId) return
    const savedBible = saveCharacterBible(projectId, nextBible)
    setCharacterBible(savedBible)
    showCanvasFeedback('角色库已保存。')
  }, [projectId, showCanvasFeedback])

  const updateCameraSettings = useCallback((next: CameraSettings) => {
    setCameraSettings(next)
    const targetId = directorTargetNodeIdRef.current
    if (!projectId || !targetId) return
    saveCameraSettingsForNode(projectId, targetId, next)
  }, [projectId])

  const updateSceneLightingSettings = useCallback((next: SceneLightingSettings) => {
    setSceneLightingSettings(next)
    const targetId = directorTargetNodeIdRef.current
    if (!projectId || !targetId) return
    saveSceneLightingForNode(projectId, targetId, next)
  }, [projectId])

  const persistSceneBibleSettings = useCallback((nextBible: SceneBible) => {
    if (!projectId) return
    const savedBible = saveSceneBible(projectId, nextBible)
    setSceneBible(savedBible)
    showCanvasFeedback('场景库已保存。')
  }, [projectId, showCanvasFeedback])

  const toggleCreatorSkill = useCallback((skillId: string) => {
    setEnabledSkillIds((current) => (
      current.includes(skillId)
        ? current.filter((id) => id !== skillId)
        : [...current, skillId]
    ))
  }, [])

  const generateStyleBibleTemplate = useCallback(() => {
    setStyleBible((current) => deriveStyleBibleTemplate(latestNodesRef.current, current))
    showCanvasFeedback('已根据当前节点生成风格圣经模板。')
  }, [showCanvasFeedback])

  const nodeTitleById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n.title || n.kind])),
    [nodes],
  )

  const inspectorSourceNode = useMemo(() => {
    if (!activeNode) return undefined
    const meta = metadataRecord(activeNode.metadataJson)
    const draft = metadataRecord(meta.generationDraft)
    const sid = typeof draft.sourceNodeId === 'string' ? draft.sourceNodeId : undefined
    if (!sid) return undefined
    return nodes.find((n) => n.id === sid) ?? undefined
  }, [activeNode, nodes])


  const generationTasks = useMemo(() => collectGenerationTasks(nodes), [nodes])
  const runningGenerationTaskCount = useMemo(
    () => generationTasks.filter((task) => task.status === 'running').length,
    [generationTasks],
  )

  const dockTaskNodes = useMemo(() => {
    const STATUS_ORDER: Record<string, number> = {
      generating: 0, running: 0, processing: 0, queued: 1, pending: 1, draft: 2,
      error: 3, failed: 3, done: 4,
    }
    return nodes
      .filter((n) => {
        const meta = metadataRecord(n.metadataJson)
        const draft = metadataRecord(meta.generationDraft)
        const hasDraftStatus = Boolean(draft.status)
        return (
          n.status === 'queued' || n.status === 'pending' ||
          n.status === 'running' || n.status === 'generating' || n.status === 'processing' ||
          n.status === 'error' || n.status === 'failed' ||
          (n.status === 'done' && Boolean(n.resultImageUrl || n.resultVideoUrl || n.resultText)) ||
          Boolean(meta.derivedFromTool) ||
          hasDraftStatus
        )
      })
      .sort((a, b) => {
        const metaA = metadataRecord(a.metadataJson)
        const draftA = metadataRecord(metaA.generationDraft)
        const metaB = metadataRecord(b.metadataJson)
        const draftB = metadataRecord(metaB.generationDraft)
        const sA = a.status === 'idle' && draftA.status === 'draft' ? 'draft' : a.status
        const sB = b.status === 'idle' && draftB.status === 'draft' ? 'draft' : b.status
        const oa = STATUS_ORDER[sA] ?? 5
        const ob = STATUS_ORDER[sB] ?? 5
        if (oa !== ob) return oa - ob
        return (b.createdAt ?? 0) - (a.createdAt ?? 0)
      })
      .slice(0, 12)
  }, [nodes])

  const editingNode = useMemo(
    () => nodes.find((node) => node.id === editingNodeId) ?? null,
    [editingNodeId, nodes],
  )
  const activePreviewNode = useMemo(
    () => nodes.find((node) => node.id === activePreviewNodeId) ?? null,
    [activePreviewNodeId, nodes],
  )
  const textEditorNode = useMemo(
    () => activePreviewType === 'text'
      ? activePreviewNode && activePreviewNode.kind === 'text' ? activePreviewNode : null
      : null,
    [activePreviewNode, activePreviewType],
  )
  const textEditorMetadata = useMemo(
    () => metadataRecord(textEditorNode?.metadataJson),
    [textEditorNode?.metadataJson],
  )
  const textEditorProviderId = textEditorNode
    ? normalizeProviderId(textEditorNode.providerId || textEditorNode.model)
    : ''
  const textEditorProviderLabel = textEditorProviderId
    ? getTextNodeProviderOption(textEditorProviderId)?.label ?? getCanvasProviderLabel('text', textEditorProviderId)
    : ''
  const textEditorModel = typeof textEditorMetadata.model === 'string'
    ? textEditorMetadata.model
    : textEditorNode?.model
  const activePreviewSceneEdits = useMemo(
    () => getSceneEdits(activePreviewNode?.metadataJson),
    [activePreviewNode?.metadataJson],
  )
  const showSceneToolPreview = activePreviewNode?.kind === 'image' && activePreviewSceneEdits.length > 0
  const activePreviewImageUrl = activePreviewNode?.kind === 'image' ? getNodeImageUrl(activePreviewNode) : ''
  const activePreviewVideoUrl = activePreviewNode?.kind === 'video' ? getNodeVideoUrl(activePreviewNode) : ''
  const activePreviewImageDisplayUrl = getProxiedMediaUrl(activePreviewImageUrl)
  const activePreviewVideoDisplayUrl = getProxiedMediaUrl(activePreviewVideoUrl)
  const closeMediaReviewWindow = useCallback((id: string) => {
    setMediaReviewWindows((current) => current.filter((review) => review.id !== id))
  }, [])

  const focusMediaReviewWindow = useCallback((id: string) => {
    mediaReviewZRef.current += 1
    const nextZ = mediaReviewZRef.current
    setMediaReviewWindows((current) => current.map((review) => (
      review.id === id ? { ...review, zIndex: nextZ } : review
    )))
  }, [])

  const moveMediaReviewWindow = useCallback((id: string, x: number, y: number) => {
    setMediaReviewWindows((current) => current.map((review) => (
      review.id === id ? { ...review, x, y } : review
    )))
  }, [])

  const resizeMediaReviewWindow = useCallback((id: string, width: number, height: number) => {
    setMediaReviewWindows((current) => current.map((review) => (
      review.id === id ? { ...review, width, height } : review
    )))
  }, [])
  const menuNode = useMemo(
    () => nodes.find((node) => node.id === contextMenu?.nodeId) ?? null,
    [contextMenu?.nodeId, nodes],
  )
  const connectorNode = useMemo(
    () => nodes.find((node) => node.id === nodeAddMenu?.nodeId) ?? null,
    [nodeAddMenu?.nodeId, nodes],
  )
  const workspaceModels = useMemo(
    () => getProviderIdsForKind(preferredKind),
    [preferredKind],
  )
  const normalizedPromptModel = normalizeProviderId(promptModel)
  const activeTextProvider = preferredKind === 'text'
    ? getTextNodeProviderOption(normalizedPromptModel)
    : null
  const activeImageProvider = preferredKind === 'image'
    ? getImageNodeProviderOption(normalizedPromptModel)
    : null
  const activeVideoProvider = preferredKind === 'video'
    ? getVideoNodeProviderOption(normalizedPromptModel)
    : null
  const activeProvider = useMemo(
    () => getCanvasProvider(getProviderKind(preferredKind), normalizedPromptModel),
    [preferredKind, normalizedPromptModel],
  )
  const providerOptionLabels = useMemo(
    () => preferredKind === 'text'
      ? Object.fromEntries(TEXT_NODE_PROVIDER_OPTIONS.map((provider) => [provider.value, provider.label]))
      : preferredKind === 'image'
        ? Object.fromEntries(IMAGE_NODE_PROVIDER_OPTIONS.map((provider) => [provider.value, provider.label]))
      : preferredKind === 'video'
        ? Object.fromEntries(VIDEO_NODE_PROVIDER_OPTIONS.map((provider) => [provider.value, provider.label]))
      : Object.fromEntries(getCanvasProviders(getProviderKind(preferredKind)).map((provider) => [provider.id, provider.name])),
    [preferredKind],
  )
  const activeProviderLabel = activeTextProvider?.label ?? activeImageProvider?.label ?? activeVideoProvider?.label ?? activeProvider?.name ?? getCanvasProviderLabel(getProviderKind(preferredKind), normalizedPromptModel)
  const activeProviderLiveStatus = liveStatusMap.get(normalizedPromptModel)
  const activeProviderImageStatus = preferredKind === 'image' ? imageProviderStatusMap.get(normalizedPromptModel) : undefined
  const activeProviderVideoStatus = preferredKind === 'video' ? videoProviderStatusMap.get(normalizedPromptModel) : undefined
  const activeProviderStatus = activeProviderLiveStatus
    ?? (activeProviderImageStatus ? (activeProviderImageStatus.available ? 'available' : activeProviderImageStatus.status) : undefined)
    ?? (activeProviderVideoStatus ? (activeProviderVideoStatus.available ? 'available' : activeProviderVideoStatus.status) : undefined)
    ?? (activeTextProvider?.badge ?? (liveStatusLoading ? 'checking' : activeProvider?.status ?? getCanvasProviderStatus(getProviderKind(preferredKind), normalizedPromptModel) ?? 'unknown'))
  const defaultImageProviderId = getDefaultImageProviderId(imageProviderStatusMap)
  const defaultVideoProviderId = getDefaultVideoProviderId(videoProviderStatusMap)
  const activeProviderNotice = activeProviderStatus === 'checking'
    ? '正在检查 provider 实时状态'
    : activeProviderStatus === 'unknown'
      ? (preferredKind === 'image' ? '请先在 /admin/providers 配置图片 Provider' : preferredKind === 'video' ? '请先在 /admin/providers 配置视频 Provider' : '暂时无法确认 provider 实时状态')
      : preferredKind === 'image' && activeProviderImageStatus && !activeProviderImageStatus.available
        ? activeProviderImageStatus.reason || `未配置：缺少 ${activeProviderImageStatus.missingEnv.join(', ')}`
        : preferredKind === 'video' && activeProviderVideoStatus && !activeProviderVideoStatus.available
          ? activeProviderVideoStatus.reason || `未配置：缺少 ${activeProviderVideoStatus.missingEnv.join(', ')}`
        : preferredKind === 'image' && normalizedPromptModel === 'openai-image' && defaultImageProviderId && defaultImageProviderId !== 'openai-image'
          ? '建议切换到已配置的中国图片 Provider。'
          : preferredKind === 'video' && defaultVideoProviderId && defaultVideoProviderId !== normalizedPromptModel
            ? '建议切换到已配置的视频 Provider。'
          : activeProviderStatus === 'disabled'
            ? '该 Provider 已停用'
            : getCanvasProviderNoticeFromStatus(activeProviderStatus)
  const stageLabel = useMemo(
    () => getOptionLabel(STAGE_OPTIONS, promptStage),
    [promptStage],
  )
  const assetLabel = useMemo(
    () => getOptionLabel(ASSET_OPTIONS, promptAssetMode),
    [promptAssetMode],
  )
  const parameterLabel = useMemo(
    () => getOptionLabel(PARAMETER_OPTIONS, promptParameter),
    [promptParameter],
  )
  const canvasHistoryItems = useMemo<CanvasHistoryItem[]>(() => {
    const nodeItems = nodes.slice(-4).reverse().map((node) => ({
      id: `node-${node.id}`,
      title: `创建节点 · ${node.title}`,
      detail: `${getEntryKindLabel(node.kind)} 节点已加入画布。`,
      type: node.kind === 'video' ? 'video' as const : node.kind === 'world' ? 'world' as const : 'image' as const,
    }))

    return [
      ...nodeItems,
      { id: 'history-product-keyframe', title: 'Tech Product Ad', detail: '产品广告关键帧 · 已可复用', type: 'image' },
      { id: 'history-f1-video', title: 'F1 Rapid Tire Swap', detail: '高速运动镜头 · 可继续生成', type: 'video' },
      { id: 'history-world-stage', title: '日式木屋场景', detail: '3D 世界场景草案 · 可作为上游', type: 'world' },
      { id: 'mock-params', title: '高级镜头参数', detail: `当前参数为 ${parameterLabel}，可继续套用到新镜头。`, type: 'video' },
    ]
  }, [nodes, parameterLabel])

  useEffect(() => {
    setReframeMode('original')
  }, [activeNodeId])

  useEffect(() => {
    if (!activeNodeId) setIsRightInspectorOpen(false)
    // Inspector does not auto-open on node select
  }, [activeNodeId])

  useEffect(() => {
    if (!activeNode) return
    setCanvasPrompt(activeNode.prompt)
    setPromptModel(normalizeProviderId(activeNode.providerId || activeNode.model))
    setPreferredKind(activeNode.kind)
    if (activeNode.ratio) {
      setPromptRatio(activeNode.ratio)
    }
    // Load per-node camera/lighting so chips + panel show this node's settings
    if (projectId) {
      setCameraSettings(loadCameraSettingsForNode(projectId, activeNode.id))
      setSceneLightingSettings(loadSceneLightingForNode(projectId, activeNode.id))
      directorTargetNodeIdRef.current = activeNode.id
    }
  }, [activeNode])

  useEffect(() => {
    setDialogError(null)
    // Load per-node camera/lighting so generation dialog chips show the editing node's settings
    if (editingNodeId && projectId) {
      setCameraSettings(loadCameraSettingsForNode(projectId, editingNodeId))
      setSceneLightingSettings(loadSceneLightingForNode(projectId, editingNodeId))
      directorTargetNodeIdRef.current = editingNodeId
    }
  }, [editingNodeId])

  // Initialize dialog local refs from node metadata when dialog opens for a new node
  useEffect(() => {
    if (editingNodeId === prevEditingNodeIdRef.current) return
    prevEditingNodeIdRef.current = editingNodeId
    if (!editingNodeId) {
      setDialogLocalRefs([])
      setDialogScriptInputs([])
      return
    }
    const node = latestNodesRef.current.find((n) => n.id === editingNodeId)
    const meta = metadataRecord(node?.metadataJson)
    const taskInputs = meta.taskInputs as { references?: unknown[] } | undefined
    const refs = Array.isArray(taskInputs?.references)
      ? (taskInputs.references as LocalRefEntry[]).filter(
          (r): r is LocalRefEntry =>
            typeof r === 'object' && r !== null &&
            typeof (r as LocalRefEntry).inputId === 'string' &&
            (r as LocalRefEntry).status === 'done',
        )
      : []
    setDialogLocalRefs(refs)
    setDialogScriptInputs([])
  }, [editingNodeId])

  useEffect(() => {
    if (!contextMenu && !nodeAddMenu && !isAddMenuOpen && !nodeCreateMenu) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.canvas-context-menu, .canvas-node-add-menu, .canvas-node-create-menu, .canvas-add-menu, .canvas-toolbar-shell, .canvas-side-panel, .canvas-user-menu')) return
      setContextMenu(null)
      setNodeAddMenu(null)
      setNodeCreateMenu(null)
      setIsAddMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [contextMenu, isAddMenuOpen, nodeAddMenu, nodeCreateMenu])

  const createNode = useCallback((
    kind: VisualCanvasNodeKind,
    options?: {
      title?: string
      prompt?: string
      model?: string
      ratio?: string
      position?: { x: number; y: number }
      status?: VisualCanvasNode['status']
      parentNodeId?: string
      resultImageUrl?: string
      resultVideoUrl?: string
      assetId?: string
      metadataJson?: Record<string, unknown>
      edgeLabel?: string
      edgeToolId?: string
      edgeToolIcon?: string
    },
  ) => {
    const meta = NODE_META[kind]
    const size = getNodeSize(kind)
    const nodeId = createNodeId(kind)
    const parentNode = options?.parentNodeId
      ? nodes.find((item) => item.id === options.parentNodeId)
      : null
    const viewportRect = viewportRef.current?.getBoundingClientRect()
    const surfaceOffset = getSurfaceOffset(surfaceRef.current)
    const centeredPosition = viewportRect
      ? {
        x: (viewportRect.width / 2 - surfaceOffset.left - canvasPan.x) / canvasZoom - size.width / 2,
        y: (viewportRect.height * 0.42 - surfaceOffset.top - canvasPan.y) / canvasZoom - size.height / 2,
      }
      : getDefaultPosition(nodes.length)
    const basePosition = options?.position
      ?? (parentNode
        ? { x: parentNode.x + parentNode.width + 240, y: parentNode.y }
        : centeredPosition)
    const position = resolveNonOverlappingPosition(
      { ...basePosition, ...size },
      nodes,
    )
    const providerId = normalizeProviderId(options?.model ?? meta.model)
    const node: VisualCanvasNode = {
      id: nodeId,
      type: kind,
      kind,
      title: options?.title ?? meta.title,
      subtitle: meta.subtitle,
      prompt: options?.prompt ?? '',
      model: providerId,
      providerId,
      stage: promptStage,
      ratio: options?.ratio ?? meta.ratio,
      status: options?.status ?? 'idle',
      resultPreview: undefined,
      resultImageUrl: options?.resultImageUrl,
      resultVideoUrl: options?.resultVideoUrl,
      assetId: options?.assetId,
      metadataJson: options?.metadataJson,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      createdAt: Date.now(),
    }

    commitNodes((current) => [...current, node])
    if (parentNode) {
      const edgeId = `${parentNode.id}-${node.id}`
      const edgeMetaJson: Record<string, unknown> | undefined = options?.edgeLabel
        ? {
            derivedToolChannel: {
              toolId: options.edgeToolId ?? options.edgeLabel,
              label: options.edgeLabel,
              ...(options.edgeToolIcon ? { icon: options.edgeToolIcon } : {}),
              sourceNodeId: parentNode.id,
              createdAt: new Date().toISOString(),
            },
          }
        : undefined
      commitEdges((current) => [
        ...current.filter((edge) => edge.id !== edgeId),
        {
          id: edgeId,
          fromNodeId: parentNode.id,
          toNodeId: node.id,
          status: 'active',
          label: options?.edgeLabel,
          ...(edgeMetaJson ? { metadataJson: edgeMetaJson } : {}),
        },
      ])
    }
    setActiveNodeId(node.id)
    setCanvasPrompt(node.prompt)
    setPromptModel(providerId)
    setPreferredKind(kind)
    return node
  }, [canvasPan.x, canvasPan.y, canvasZoom, commitEdges, commitNodes, nodes, promptStage])

  const openScriptSegmentation = useCallback((node: VisualCanvasNode) => {
    if (node.kind !== 'text') return
    const sourceSnapshot: CreatorSkillSourceNode = Object.freeze({
      id: node.id,
      kind: 'text',
      title: node.title,
      prompt: node.prompt ?? '',
      resultText: typeof node.resultText === 'string' ? node.resultText : undefined,
      metadataJson: node.metadataJson,
    })
    openNodeScopedTool('script-segmentation', node)
    setScriptSegmentationSource(sourceSnapshot)
  }, [openNodeScopedTool])

  const handleApplyScriptSegmentation = useCallback((plans: SceneNodeMaterializationPlan[]) => {
    const analyzedSource = scriptSegmentationSource
    if (!analyzedSource) return
    const currentSource = latestNodesRef.current.find((node) => node.id === analyzedSource.id)
    const analyzedSourceText = analyzedSource.resultText?.trim()
      ? analyzedSource.resultText
      : analyzedSource.prompt
    const currentSourceText = currentSource?.resultText?.trim()
      ? currentSource.resultText
      : currentSource?.prompt

    if (
      !currentSource
      || currentSource.kind !== 'text'
      || currentSourceText !== analyzedSourceText
    ) {
      closeCanvasPanel()
      showCanvasFeedback('源文本已变化，请重新运行剧本分场。')
      return
    }

    const textNodeSize = getNodeSize('text')
    const occupancy = [...latestNodesRef.current]
    plans.forEach((plan, index) => {
      const position = resolveNonOverlappingPosition({
        x: currentSource.x + currentSource.width + 240,
        y: currentSource.y + index * (textNodeSize.height + 64),
        width: textNodeSize.width,
        height: textNodeSize.height,
      }, occupancy)
      const createdNode = createNode('text', {
        title: plan.title,
        prompt: plan.prompt,
        parentNodeId: analyzedSource.id,
        metadataJson: plan.metadataJson,
        edgeLabel: '剧本分场',
        edgeToolId: 'script-segmentation',
        edgeToolIcon: '§',
        position,
      })
      occupancy.push(createdNode)
    })
    flushLocalSnapshot()
    scheduleCanvasSave(0)
    showCanvasFeedback(`已创建 ${plans.length} 个剧本分场节点。`)
  }, [closeCanvasPanel, createNode, flushLocalSnapshot, scheduleCanvasSave, scriptSegmentationSource, showCanvasFeedback])

  useEffect(() => {
    if (activeCanvasModal !== 'script-segmentation' || !scriptSegmentationSource) return
    const currentSource = nodes.find((node) => node.id === scriptSegmentationSource.id)
    if (!currentSource || currentSource.kind !== 'text') closeCanvasPanel()
  }, [activeCanvasModal, closeCanvasPanel, nodes, scriptSegmentationSource])

  const openNarrativeBeatAnalysis = useCallback((node: VisualCanvasNode) => {
    if (node.kind !== 'text') return
    const sourceSnapshot: CreatorSkillSourceNode = Object.freeze({
      id: node.id,
      kind: 'text',
      title: node.title,
      prompt: node.prompt ?? '',
      resultText: typeof node.resultText === 'string' ? node.resultText : undefined,
      metadataJson: node.metadataJson,
    })
    openNodeScopedTool('narrative-beat-analysis', node)
    setNarrativeBeatSource(sourceSnapshot)
  }, [openNodeScopedTool])

  const openShotListBuilderForNode = useCallback((node: VisualCanvasNode) => {
    if (node.kind !== 'text') return
    openCanvasPanel('shot-list-builder')
    setShotListSourceId(node.id)
  }, [openCanvasPanel])

  const handleApplyNarrativeBeatPlans = useCallback((plans: GroupedSkillNodePlan[]) => {
    if (plans.length === 0) return
    const analyzedSource = narrativeBeatSource
    if (!analyzedSource) return
    const currentSource = latestNodesRef.current.find((node) => node.id === analyzedSource.id)
    const analyzedSourceText = analyzedSource.resultText?.trim()
      ? analyzedSource.resultText
      : analyzedSource.prompt
    const currentSourceText = currentSource?.resultText?.trim()
      ? currentSource.resultText
      : currentSource?.prompt

    if (
      !currentSource
      || currentSource.kind !== 'text'
      || currentSourceText !== analyzedSourceText
    ) {
      closeCanvasPanel()
      showCanvasFeedback('源文本已变化，请重新运行叙事节拍分析。')
      return
    }

    const textNodeSize = getNodeSize('text')
    const occupancy = [...latestNodesRef.current]
    plans.forEach((plan, index) => {
      const position = resolveNonOverlappingPosition({
        x: currentSource.x + currentSource.width + 240,
        y: currentSource.y + index * (textNodeSize.height + 64),
        width: textNodeSize.width,
        height: textNodeSize.height,
      }, occupancy)
      const createdNode = createNode('text', {
        title: plan.title,
        prompt: plan.prompt,
        parentNodeId: analyzedSource.id,
        metadataJson: plan.metadataJson,
        edgeLabel: '叙事节拍',
        edgeToolId: 'narrative-beat-analysis',
        edgeToolIcon: '◆',
        position,
      })
      occupancy.push(createdNode)
    })
    flushLocalSnapshot()
    scheduleCanvasSave(0)
    showCanvasFeedback(`已创建 ${plans.length} 个叙事节拍节点。`)
  }, [closeCanvasPanel, createNode, flushLocalSnapshot, narrativeBeatSource, scheduleCanvasSave, showCanvasFeedback])

  const handleApplyShotPlans = useCallback((plans: GroupedSkillNodePlan[]) => {
    if (plans.length === 0) return
    const sourceNodeIds = plans.map((plan) => {
      const creatorSkill = metadataRecord(metadataRecord(plan.metadataJson).creatorSkill)
      const ids = creatorSkill.sourceNodeIds
      return Array.isArray(ids) && typeof ids[0] === 'string' ? ids[0] : ''
    })
    const analyzedSourceId = sourceNodeIds[0] ?? ''
    const currentSource = latestNodesRef.current.find((node) => node.id === analyzedSourceId)
    const currentSourceText = currentSource?.resultText?.trim()
      ? currentSource.resultText
      : currentSource?.prompt ?? ''
    const sourceLines = currentSourceText.replace(/\r\n?/g, '\n').split('\n')
    const shotPlansMatchCurrentSource = Boolean(analyzedSourceId)
      && sourceNodeIds.every((sourceNodeId) => sourceNodeId === analyzedSourceId)
      && plans.every((plan) => {
        const creatorSkill = metadataRecord(metadataRecord(plan.metadataJson).creatorSkill)
        const evidence = creatorSkill.evidence
        return Array.isArray(evidence) && evidence.length > 0 && evidence.every((item) => {
          const entry = metadataRecord(item)
          const lineStart = entry.lineStart
          const lineEnd = entry.lineEnd
          const excerpt = entry.excerpt
          if (!Number.isInteger(lineStart) || !Number.isInteger(lineEnd)
            || typeof excerpt !== 'string' || !excerpt.trim()) return false
          const sourceExcerpt = sourceLines.slice(
            Number(lineStart) - 1,
            Number(lineEnd),
          ).join('\n')
          return sourceExcerpt.includes(excerpt.trim())
        })
      })

    if (
      !currentSource
      || currentSource.kind !== 'text'
      || !shotPlansMatchCurrentSource
    ) {
      closeCanvasPanel()
      showCanvasFeedback('源文本已变化，请重新运行分镜规划。')
      return
    }

    const textNodeSize = getNodeSize('text')
    const occupancy = [...latestNodesRef.current]
    plans.forEach((plan, index) => {
      const position = resolveNonOverlappingPosition({
        x: currentSource.x + currentSource.width + 240,
        y: currentSource.y + index * (textNodeSize.height + 64),
        width: textNodeSize.width,
        height: textNodeSize.height,
      }, occupancy)
      const createdNode = createNode('text', {
        title: plan.title,
        prompt: plan.prompt,
        parentNodeId: analyzedSourceId,
        metadataJson: plan.metadataJson,
        edgeLabel: '镜头规划',
        edgeToolId: 'shot-planning',
        edgeToolIcon: '◇',
        position,
      })
      occupancy.push(createdNode)
    })
    flushLocalSnapshot()
    scheduleCanvasSave(0)
    showCanvasFeedback(`已创建 ${plans.length} 个镜头规划节点。`)
  }, [closeCanvasPanel, createNode, flushLocalSnapshot, scheduleCanvasSave, showCanvasFeedback])

  const handleCreateCompatibilityShotNode = useCallback((
    kind: VisualCanvasNodeKind,
    options: CompatibilityShotNodeOptions,
  ) => {
    if (kind !== 'image' && kind !== 'video') return ''
    const creatorSkill = metadataRecord(metadataRecord(options.metadataJson).creatorSkill)
    const skillId = creatorSkill.skillId
    const runFingerprint = creatorSkill.runFingerprint
    const resultId = creatorSkill.resultId
    if (typeof skillId !== 'string' || !skillId
      || typeof runFingerprint !== 'string' || !runFingerprint
      || typeof resultId !== 'string' || !resultId) return ''

    const duplicateExists = latestNodesRef.current.some((node) => {
      const existingCreatorSkill = metadataRecord(metadataRecord(node.metadataJson).creatorSkill)
      return existingCreatorSkill.skillId === skillId
        && existingCreatorSkill.runFingerprint === runFingerprint
        && existingCreatorSkill.resultId === resultId
    })
    if (duplicateExists) return ''

    const { index = 0, total = 1, parentNodeId, ...rest } = options
    const parentNode = parentNodeId
      ? latestNodesRef.current.find((node) => node.id === parentNodeId)
      : null
    const viewportRect = viewportRef.current?.getBoundingClientRect()
    const surfaceOffset = getSurfaceOffset(surfaceRef.current)
    let baseX: number
    let baseY: number
    if (parentNode) {
      baseX = parentNode.x + parentNode.width + 240
      baseY = parentNode.y - Math.floor(total / 2) * 340
    } else if (viewportRect) {
      baseX = (viewportRect.width / 2 - surfaceOffset.left - canvasPan.x) / canvasZoom + 200
      baseY = (viewportRect.height * 0.42 - surfaceOffset.top - canvasPan.y) / canvasZoom - Math.floor(total / 2) * 340
    } else {
      baseX = 600
      baseY = 200 - Math.floor(total / 2) * 340
    }
    const maxRowsPerColumn = 5
    const column = Math.floor(index / maxRowsPerColumn)
    const row = index % maxRowsPerColumn
    const nodeSize = getNodeSize(kind)
    const position = resolveNonOverlappingPosition({
      x: baseX + column * 460,
      y: baseY + row * 340,
      width: nodeSize.width,
      height: nodeSize.height,
    }, latestNodesRef.current)
    const createdNode = createNode(kind, { ...rest, parentNodeId, position })
    return createdNode.id
  }, [canvasPan.x, canvasPan.y, canvasZoom, createNode])

  useEffect(() => {
    if (activeCanvasModal === 'narrative-beat-analysis' && narrativeBeatSource) {
      const currentSource = nodes.find((node) => node.id === narrativeBeatSource.id)
      if (!currentSource || currentSource.kind !== 'text') closeCanvasPanel()
    }
    if (activeCanvasModal === 'shot-list-builder' && shotListSourceId) {
      const currentSource = nodes.find((node) => node.id === shotListSourceId)
      if (!currentSource || currentSource.kind !== 'text') closeCanvasPanel()
    }
  }, [activeCanvasModal, closeCanvasPanel, narrativeBeatSource, nodes, shotListSourceId])

  const handleNodePatch = useCallback((nodeId: string, patch: Partial<VisualCanvasNode>) => {
    commitNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)))
  }, [commitNodes])

  const handleSaveNodeAnnotations = useCallback((nodeId: string, annotations: CanvasAnnotationState) => {
    commitNodes((current) => current.map((node) => {
      if (node.id !== nodeId) return node
      return {
        ...node,
        metadataJson: mergeAnnotationMetadata({
          metadataJson: node.metadataJson,
          annotations,
        }),
      }
    }))
    flushLocalSnapshot()
    setSaveStatus('local-draft')
    setSaveMessage('本地草稿已保存')
    showCanvasFeedback('画面标注已保存到节点，请保存项目以同步云端。')
    setLockedNodeToolContext(null)
    closeCanvasPanel()
  }, [closeCanvasPanel, commitNodes, flushLocalSnapshot, showCanvasFeedback])

  const handleStoryboardGridSourceSession = useCallback((summary: StoryboardGridSessionSummary) => {
    commitNodes((current) => current.map((node) => {
      if (node.id !== summary.sourceNodeId) return node
      return {
        ...node,
        metadataJson: {
          ...metadataRecord(node.metadataJson),
          gridCropSession: summary,
        },
      }
    }))
    flushLocalSnapshot()
    scheduleCanvasSave(0)
  }, [commitNodes, flushLocalSnapshot, scheduleCanvasSave])

  const handleCreateStoryboardGridCellNode = useCallback((
    sourceNodeId: string,
    cell: StoryboardGridUploadedCell,
    placementIndex: number,
    _total: number,
  ) => {
    const sourceNode = latestNodesRef.current.find((node) => node.id === sourceNodeId)
    if (!sourceNode) return null
    const title = cell.title || `${sourceNode.title || '分镜'} · ${cell.metadata.index + 1}`
    const position = {
      x: sourceNode.x + sourceNode.width + 240 + Math.floor(placementIndex / 4) * 440,
      y: sourceNode.y + cell.metadata.row * 340,
    }
    const node = createNode('image', {
      title,
      prompt: sourceNode.prompt ?? '',
      parentNodeId: sourceNode.id,
      position,
      status: 'done',
      resultImageUrl: cell.assetUrl,
      assetId: cell.assetId,
      metadataJson: {
        assetId: cell.assetId,
        assetUrl: cell.assetUrl,
        resolvedUrl: cell.assetUrl,
        derivedFromTool: 'storyboard-grid-split',
        derivedFromToolLabel: '分镜拆格',
        toolSummaryText: `第 ${cell.metadata.index + 1} 格 · R${cell.metadata.row + 1} C${cell.metadata.col + 1}`,
        sourceNodeTitle: sourceNode.title || sourceNode.kind,
        cropLineage: cell.metadata,
        generationDraft: {
          status: 'asset-derived',
          sourceNodeId: sourceNode.id,
          sourceKind: sourceNode.kind,
          targetKind: 'image',
          sourceImageUrl: (getNodeImageUrl(sourceNode) || sourceNode.resultImageUrl) ?? null,
          createdAt: new Date().toISOString(),
        },
        mediaPersistence: {
          status: 'persisted',
          assetId: cell.assetId,
          assetUrl: cell.assetUrl,
          persistedAt: new Date().toISOString(),
        },
      },
      edgeLabel: '分镜拆格',
      edgeToolId: 'storyboard-grid-split',
      edgeToolIcon: '▦',
    })
    flushLocalSnapshot()
    scheduleCanvasSave(0)
    showCanvasFeedback('分镜格已放入画布。')
    return node.id
  }, [createNode, flushLocalSnapshot, scheduleCanvasSave, showCanvasFeedback])

  const handleMediaDiagnosticsPatch = useCallback((nodeId: string, patch: Partial<VisualCanvasNode>) => {
    handleNodePatch(nodeId, patch)
    flushLocalSnapshot()
    scheduleCanvasSave(0)
    showCanvasFeedback('媒体已重新同步到素材库。')
  }, [flushLocalSnapshot, handleNodePatch, scheduleCanvasSave, showCanvasFeedback])

  const handleMediaRecoveryPatch = useCallback((nodeId: string, patch: Partial<VisualCanvasNode>) => {
    const resolved = recoveryResolveResultFromPatch(patch)
    commitNodes((current) => current.map((node) => {
      if (node.id !== nodeId) return node
      const patched = { ...node, ...patch }
      return resolved ? applyResolvedAssetToNode(patched, resolved) : patched
    }))
    flushLocalSnapshot()
    scheduleCanvasSave(0)
  }, [commitNodes, flushLocalSnapshot, scheduleCanvasSave])

  const handleRegenerateNodeFromPrompt = useCallback((node: VisualCanvasNode) => {
    if (node.kind !== 'image' && node.kind !== 'video') return
    if (activeGenerationNodeIdsRef.current.has(node.id) || isActiveGenerationStatus(node.status)) {
      const errMsg = 'generation_already_running: 该节点已有生成任务在运行。请先点击"停止所有生成"，再重新生成。'
      handleNodePatch(node.id, {
        errorMessage: errMsg,
        metadataJson: {
          ...metadataRecord(node.metadataJson),
          errorCode: 'generation_already_running',
          errorStage: 'client_duplicate_guard',
          errorMessage: errMsg,
        },
      })
      showCanvasFeedback(errMsg)
      return
    }
    const rawPrompt = node.prompt?.trim() ?? ''
    const bibleCtx = buildBiblePromptContext({ characterBible, sceneBible, styleBible })
    // Read per-node camera/lighting — avoids cross-node contamination from global state
    const nodeCameraCtx = projectId ? loadCameraSettingsForNode(projectId, node.id) : cameraSettings
    const nodeLightingCtx = projectId ? loadSceneLightingForNode(projectId, node.id) : sceneLightingSettings
    const cameraCtx = buildCameraPromptContext(nodeCameraCtx)
    const lightingCtx = buildSceneLightingPromptContext(nodeLightingCtx)
    const prompt = appendSceneLightingContextToPrompt(appendCameraContextToPrompt(appendBibleContextToPrompt(rawPrompt, bibleCtx) || rawPrompt, cameraCtx), lightingCtx)
    const fallbackProviderId = providerForRegenerationNode(node)
    const selectedProviderId = fallbackProviderId || defaultProviderForRegenerationNode(node)
    const fallbackModel = modelForRegenerationNode(node)
    const selectedModel = fallbackModel || defaultModelForRegenerationNode(node, selectedProviderId)
    const initialRegenerationParams = buildRegenerationParams(node)
    const initialRegenerationInputAssets = buildRegenerationInputAssets(node)
    const nodeMetaRecord = metadataRecord(node.metadataJson)
    // Fall back to projectId stored in the node's own submittedInput when component state is still empty (async load not yet settled).
    const effectiveProjectId = projectId
      || stringValue(metadataRecord(nodeMetaRecord.submittedInput).projectId)
    const submittedInputBase = {
      projectId: effectiveProjectId,
      workflowId,
      nodeId: node.id,
      kind: node.kind,
      promptChars: prompt?.length ?? 0,
      providerId: selectedProviderId || null,
      model: selectedModel || null,
      aspectRatio: typeof initialRegenerationParams.aspectRatio === 'string' ? initialRegenerationParams.aspectRatio : null,
      duration: typeof initialRegenerationParams.duration === 'number' ? initialRegenerationParams.duration : null,
      resolution: typeof initialRegenerationParams.resolution === 'string' ? initialRegenerationParams.resolution : null,
      inputAssets: initialRegenerationInputAssets?.map((asset) => ({ id: asset.id, type: asset.type, hasUrl: Boolean(asset.url), url: summarizeUrlForDiagnostics(asset.url) })) ?? null,
    }
    const failNode = (result: GenerateApiResult, providerId: string) => {
      const failureResult = {
        ...result,
        providerId: result.providerId || providerId,
        model: result.model || selectedModel || providerId,
        submittedInput: result.submittedInput ?? submittedInputBase,
      }
      const errMsg = formatGenerateError(failureResult)
      handleNodePatch(node.id, {
        status: 'error',
        errorMessage: errMsg,
        resultPreview: node.kind === 'image' ? '图片生成失败' : '视频生成失败',
        outputLabel: node.kind === 'image' ? '图片生成失败' : '视频生成失败',
        metadataJson: node.kind === 'image'
          ? imageErrorMetadata(node, failureResult, providerId)
          : videoErrorMetadata(node, failureResult, providerId),
      })
      flushLocalSnapshot()
      scheduleCanvasSave(0)
      showCanvasFeedback(errMsg)
    }
    const clearRegenerationLoading = () => {
      commitNodes((current) => current.map((currentNode) => {
        if (currentNode.id !== node.id) return currentNode
        const metadata = metadataRecord(currentNode.metadataJson)
        if (!metadata.loading && !metadata.isRegenerating && !metadata.regenerating) return currentNode
        return {
          ...currentNode,
          metadataJson: {
            ...metadata,
            loading: false,
            isRegenerating: false,
            regenerating: false,
            isRecovering: false,
            recovering: false,
          },
        }
      }))
    }

    const missingFields = [
      ...(!effectiveProjectId ? ['projectId'] : []),
      ...(!prompt ? ['prompt'] : []),
      ...(!selectedProviderId ? ['provider'] : []),
      ...(!selectedModel ? ['model'] : []),
    ]
    if (missingFields.length) {
      failNode({
        success: false,
        providerId: selectedProviderId,
        mode: 'unavailable',
        status: 'failed',
        errorCode: 'missing_generation_input',
        message: `该节点缺少重新生成所需字段：${missingFields.join(', ')}。`,
        missingFields,
        submittedInput: {
          ...submittedInputBase,
          hasPrompt: Boolean(prompt),
          params: initialRegenerationParams,
        },
      }, selectedProviderId)
      return
    }

    const generationController = beginNodeGeneration(node.id)
    if (!generationController) {
      const errMsg = 'generation_already_running: 该节点已有生成任务在运行。请先点击"停止所有生成"，再重新生成。'
      handleNodePatch(node.id, {
        errorMessage: errMsg,
        metadataJson: {
          ...metadataRecord(node.metadataJson),
          errorCode: 'generation_already_running',
          errorStage: 'client_duplicate_guard',
          errorMessage: errMsg,
        },
      })
      showCanvasFeedback(errMsg)
      return
    }

    void (async () => {
      const requestedAt = new Date().toISOString()
      try {
        const regenerationParams = initialRegenerationParams
        const regenerationInputAssets = initialRegenerationInputAssets
        const regenerateInputPreview = {
          prompt,
          providerId: selectedProviderId,
          model: selectedModel,
          params: regenerationParams,
          inputAssets: regenerationInputAssets?.map((asset) => ({ id: asset.id, type: asset.type, hasUrl: Boolean(asset.url), url: summarizeUrlForDiagnostics(asset.url) })),
          nodeId: node.id,
          requestedAt,
        }
        handleNodePatch(node.id, {
          status: 'generating',
          errorMessage: undefined,
          resultPreview: node.kind === 'image' ? '图片生成中...' : '视频生成中...',
          outputLabel: node.kind === 'image' ? '图片生成中' : '视频生成中',
          metadataJson: {
            ...metadataRecord(node.metadataJson),
            providerId: selectedProviderId,
            model: selectedModel,
            recoveryStatus: 'regenerating',
            mediaRecoveryStatus: 'regenerating',
            isRecovering: false,
            recovering: false,
            loading: true,
            isRegenerating: true,
            regenerating: true,
            error: null,
            errorCode: null,
            errorMessage: null,
            lastError: null,
            lastGenerationError: null,
            nextAction: 'show_media',
            regenerateInputPreview,
            regenerationInputPreview: regenerateInputPreview,
          },
        })
        const nodeType = node.kind === 'image' ? 'image' : 'video'
        let result = await callGenerationApi(
          nodeType,
          selectedProviderId,
          prompt,
          regenerationParams,
          node.id,
          regenerationInputAssets,
          effectiveProjectId,
          workflowId,
          undefined,
          selectedModel,
          generationController.signal,
        )
        if (generationController.signal.aborted) return

        if (node.kind === 'image' && (result.status === 'running' || result.status === 'queued') && (result.generationJobId || result.jobId)) {
          const generationJobId = result.generationJobId ?? result.jobId!
          const taskId = result.taskId ?? generationJobId
          handleNodePatch(node.id, {
            status: 'running',
            resultPreview: '图片生成中',
            outputLabel: '图片生成中',
            errorMessage: undefined,
            metadataJson: imageRunningMetadata(node, { ...result, generationJobId, taskId }, selectedProviderId),
          })
          flushLocalSnapshot()
          scheduleCanvasSave(0)
          showCanvasFeedback('图片生成中')
          let polls = 0
          while (polls < 12) {
            await delay(5000, generationController.signal)
            const statusResult = await pollImageGenerationTask(selectedProviderId, generationJobId, generationController.signal)
            result = {
              ...statusResult,
              generationJobId,
              jobId: statusResult.jobId ?? generationJobId,
              taskId: statusResult.taskId ?? taskId,
            }
            if (!statusResult.success || !isActiveGenerationStatus(statusResult.status)) break
            handleNodePatch(node.id, {
              status: 'running',
              resultPreview: `图片生成中，已查询 ${polls + 1} 次`,
              outputLabel: '图片生成中',
              metadataJson: imageRunningMetadata(node, result, selectedProviderId),
            })
            polls += 1
          }
          if (result.success && isActiveGenerationStatus(result.status)) {
            handleNodePatch(node.id, {
              status: 'failed',
              errorMessage: '图片生成超时：轮询 12 次未完成，请手动检查任务状态。',
              metadataJson: imageErrorMetadata(node, { ...result, errorCode: 'generation_polling_timeout' }, selectedProviderId),
            })
            showCanvasFeedback('图片生成超时，请手动检查任务状态。')
            return
          }
        }

        if (node.kind === 'video' && (result.status === 'running' || result.status === 'queued') && (result.generationJobId || result.jobId)) {
          const generationJobId = result.generationJobId ?? result.jobId!
          const taskId = result.taskId ?? generationJobId
          handleNodePatch(node.id, {
            status: 'running',
            resultPreview: '视频任务已提交，正在生成中',
            outputLabel: '视频生成中',
            errorMessage: undefined,
            metadataJson: {
              ...videoSuccessMetadata(node, { ...result, generationJobId, taskId }, selectedProviderId),
              recoveryStatus: 'regenerating',
              mediaRecoveryStatus: 'regenerating',
              loading: true,
              isRegenerating: true,
              regenerating: true,
            },
          })
          flushLocalSnapshot()
          scheduleCanvasSave(0)
          showCanvasFeedback('视频生成中')
          let polls = 0
          while (polls < 12) {
            await delay(5000, generationController.signal)
            const statusResult = await pollVideoGenerationTask(selectedProviderId, generationJobId, generationController.signal)
            result = {
              ...statusResult,
              generationJobId,
              jobId: statusResult.jobId ?? generationJobId,
              taskId: statusResult.taskId ?? taskId,
            }
            if (!statusResult.success || !isActiveGenerationStatus(statusResult.status)) break
            handleNodePatch(node.id, {
              status: 'running',
              resultPreview: `视频生成中，已查询 ${polls + 1} 次`,
              outputLabel: '视频生成中',
              metadataJson: {
                ...videoSuccessMetadata(node, result, selectedProviderId),
                recoveryStatus: 'regenerating',
                mediaRecoveryStatus: 'regenerating',
                loading: true,
                isRegenerating: true,
                regenerating: true,
              },
            })
            polls += 1
          }
          if (result.success && isActiveGenerationStatus(result.status)) {
            failNode({
              ...result,
              success: false,
              providerId: selectedProviderId,
              mode: 'real',
              status: 'failed',
              errorCode: 'generation_polling_timeout',
              message: '视频生成轮询超时（已查询 12 次），任务可能仍在后台运行，请前往资产库（/assets）检查生成结果。',
            }, selectedProviderId)
            return
          }
        }

        if (generationController.signal.aborted) return

        if (!result.success) {
          failNode(result, selectedProviderId)
          return
        }

        const resultText = getGeneratedText(result)
        const generatedDisplayUrl = displayUrlFromGenerateResult(result)
        const generatedImageUrl = result.resolvedUrl ?? result.stableUrl ?? result.assetUrl ?? result.result?.imageUrl ?? result.resultImageUrl ?? result.imageUrl ?? result.dataUrl ?? generatedDisplayUrl
        const generatedVideoUrl = result.resolvedUrl ?? result.stableUrl ?? result.assetUrl ?? result.result?.videoUrl ?? result.resultVideoUrl ?? result.videoUrl ?? generatedDisplayUrl
        const resultImageUrl = node.kind === 'image' ? generatedImageUrl : undefined
        const resultVideoUrl = node.kind === 'video' ? generatedVideoUrl : undefined
        if (!resultImageUrl && !resultVideoUrl) {
          failNode({
            ...result,
            success: false,
            providerId: selectedProviderId,
            mode: 'real',
            status: 'failed',
            errorCode: 'PROVIDER_NO_DOWNLOAD_URL',
            message: node.kind === 'image' ? '图片生成接口未返回可下载图片 URL。' : '视频生成接口未返回可下载视频 URL。',
          }, selectedProviderId)
          return
        }
        const successMetadata = node.kind === 'image'
          ? imageSuccessMetadata(node, result, selectedProviderId)
          : videoSuccessMetadata(node, result, selectedProviderId)
        const generatedAssetId = getNodeAssetId({ ...node, metadataJson: successMetadata })
        const generatedButPersistencePending = isPersistencePendingResult(result)
        if (!generatedAssetId && !generatedButPersistencePending) {
          failNode({
            ...result,
            success: false,
            providerId: selectedProviderId,
            mode: 'real',
            status: 'failed',
            errorCode: 'asset_persistence_error',
            message: node.kind === 'image'
              ? '图片生成接口已返回媒体 URL，但没有返回可写回的 assetId。'
              : '视频生成接口已返回媒体 URL，但没有返回可写回的 assetId。',
          }, selectedProviderId)
          return
        }
        handleNodePatch(node.id, {
          status: 'done',
          resultText,
          resultPreview: generatedButPersistencePending ? '已生成，资产库上传待重试' : resultImageUrl ? '图片已生成' : resultVideoUrl ? '视频已生成' : resultText?.slice(0, 200) ?? '生成完成',
          outputLabel: generatedButPersistencePending ? '已生成，资产库上传待重试' : resultImageUrl ? '图片已生成' : resultVideoUrl ? '视频已生成' : '生成完成',
          resultImageUrl: node.kind === 'image' ? resultImageUrl : node.resultImageUrl,
          resultVideoUrl: node.kind === 'video' ? resultVideoUrl : node.resultVideoUrl,
          ...(generatedAssetId ? { assetId: generatedAssetId } : {}),
          errorMessage: undefined,
          metadataJson: {
            ...successMetadata,
            regeneratedFromPromptAt: new Date().toISOString(),
          },
          preview: resultVideoUrl
            ? { type: 'remote-video', url: resultVideoUrl, poster: result.result?.previewUrl, licenseType: 'original', attribution: 'Generated by configured video provider' }
            : node.preview,
        })
        flushLocalSnapshot()
        scheduleCanvasSave(0)
        showCanvasFeedback(generatedButPersistencePending ? '媒体已生成，资产库上传待重试。' : resultImageUrl || resultVideoUrl ? '已用原 Prompt 重新生成并写回节点。' : '重新生成完成。')
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError' || generationController.signal.aborted) return
        failNode({
          success: false,
          providerId: selectedProviderId,
          mode: 'unavailable',
          status: 'failed',
          errorCode: 'CARD_REGENERATE_FAILED',
          message: error instanceof Error ? error.message : '节点卡片重新生成失败。',
        }, selectedProviderId)
      } finally {
        const abortContext = generationAbortContext(generationController.signal)
        finishNodeGeneration(node.id, generationController)
        if (abortContext === null) {
          clearRegenerationLoading()
        }
      }
    })()
  }, [beginNodeGeneration, cameraSettings, characterBible, commitNodes, finishNodeGeneration, flushLocalSnapshot, handleNodePatch, projectId, sceneBible, sceneLightingSettings, scheduleCanvasSave, showCanvasFeedback, styleBible, workflowId])

  useEffect(() => {
    const queuedIds = pendingAutoGenerateIdsRef.current
    if (queuedIds.length === 0) return
    const dispatchedIds: string[] = []
    const discardedIds: string[] = []
    for (const nodeId of queuedIds) {
      const node = latestNodesRef.current.find((n) => n.id === nodeId)
      if (!node || (node.kind !== 'image' && node.kind !== 'video')) {
        discardedIds.push(nodeId)
        continue
      }
      try {
        handleRegenerateNodeFromPrompt(node)
        dispatchedIds.push(nodeId)
      } catch {
        // Keep undispatched IDs queued; the node handler owns normal generation failures.
      }
    }
    if (dispatchedIds.length > 0 || discardedIds.length > 0) {
      setPendingAutoGenerateIds((prev) => {
        const next = prev.filter((id) => !dispatchedIds.includes(id) && !discardedIds.includes(id))
        pendingAutoGenerateIdsRef.current = next
        return next
      })
    }
  }, [pendingAutoGenerateIds, handleRegenerateNodeFromPrompt])

  const assetResolveKey = useMemo(() => nodes
    .filter((node) => node.kind === 'image' || node.kind === 'video')
    .map((node) => {
      const assetId = getNodeAssetId(node)
      const legacyUrl = assetId ? '' : legacyMediaUrlForNode(node)
      const metadata = metadataRecord(node.metadataJson)
      return [
        node.id,
        node.kind,
        assetId,
        legacyUrl,
        stringValue(metadata.assetResolveStatus),
        stringValue(metadata.recoveryStatus),
      ].join(':')
    })
    .join('|'), [nodes])

  useEffect(() => {
    if (!ASSET_RECOVERY_TOOLS_ENABLED) return
    if (!projectId || !hasHydratedCanvasRef.current) return
    const mediaNodes = latestNodesRef.current.filter((node) => node.kind === 'image' || node.kind === 'video')
    if (!mediaNodes.length) return

    const assetIds = [...new Set(mediaNodes.map(getNodeAssetId).filter((assetId): assetId is string => Boolean(assetId)))]
    const legacyNodes = mediaNodes.filter((node) => !getNodeAssetId(node))
    const runKey = `${projectId}:${assetResolveKey}`
    if (assetResolveRunKeyRef.current === runKey) return
    assetResolveRunKeyRef.current = runKey

    let cancelled = false
    void (async () => {
      let nextNodes = latestNodesRef.current
      let changed = false

      if (assetIds.length) {
        const response = await fetch('/api/assets/resolve-batch', {
          method: 'POST',
          cache: 'no-store',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ assetIds }),
        })
        const data = await response.json().catch(() => ({})) as { assets?: CanvasAssetResolveResult[] }
        if (!cancelled && response.ok && Array.isArray(data.assets)) {
          const byId = new Map(data.assets.map((asset) => [asset.assetId, asset]))
          nextNodes = nextNodes.map((node) => {
            const assetId = getNodeAssetId(node)
            const resolved = assetId ? byId.get(assetId) : undefined
            if (!resolved || (node.kind !== 'image' && node.kind !== 'video')) return node
            const patched = applyResolvedAssetToNode(node, resolved)
            changed = changed || patched !== node
            return patched
          })
        }
      }

      for (const legacyNode of legacyNodes) {
        if (cancelled) return
        const current = nextNodes.find((node) => node.id === legacyNode.id)
        if (!current || getNodeAssetId(current)) continue
        const url = legacyMediaUrlForNode(current)
        const metadata = metadataRecord(current.metadataJson)
        const recoveryStatus = stringValue(metadata.recoveryStatus)
        // Skip nodes already in a terminal recovery state. Adding 'old_url_expired',
        // 'no_recovery_source', 'provider_media_download_failed', and 'provider_error'
        // here breaks the loop where this effect and CanvasNodeCard's audit alternate
        // writing different recovery codes and each change re-triggers the other.
        const isTrulyUnrecoverable = recoveryStatus === 'unrecoverable_blob_url'
          || recoveryStatus === 'unrecoverable_data_url_without_file'
          || recoveryStatus === 'old_url_expired'
          || recoveryStatus === 'no_recovery_source'
          || recoveryStatus === 'provider_media_download_failed'
          || recoveryStatus === 'provider_error'
        if (isTrulyUnrecoverable) continue

        if (!url || url.startsWith('blob:') || (!/^https?:\/\//i.test(url) && !url.startsWith('data:'))) {
          const recoveryStatus = unresolvedLegacyStatus(url)
          nextNodes = nextNodes.map((node) => node.id === current.id
            ? {
                ...node,
                metadataJson: {
                  ...metadataRecord(node.metadataJson),
                  assetResolveStatus: recoveryStatus,
                  recoveryStatus,
                  error: recoveryStatus === 'unrecoverable_blob_url'
                    ? '该资产当时只保存为浏览器临时 blob URL，刷新后无法恢复。'
                    : '当前画布节点没有 assetId，也没有可恢复的原始 URL。',
                },
              }
            : node)
          changed = true
          continue
        }

        // Legacy node has a URL — let the browser try to load it.
        // If it fails, CanvasNodeCard's onError handler cycles candidates and
        // the recovery useEffect writes old_url_expired without any network requests.
      }

      if (!cancelled && changed) {
        commitNodes(nextNodes)
        writeUnifiedLocalSnapshot({ nodes: nextNodes })
        scheduleCanvasSave(0)
      }
    })().catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [assetResolveKey, commitNodes, projectId, scheduleCanvasSave, workflowId, writeUnifiedLocalSnapshot])

  const handleRecoverCanvasAssets = useCallback(async () => {
    const mediaNodes = latestNodesRef.current.filter((node) => node.kind === 'image' || node.kind === 'video')
    const assetIds = [...new Set(mediaNodes.map(getNodeAssetId).filter((assetId): assetId is string => Boolean(assetId)))]
    if (!assetIds.length) {
      showCanvasFeedback('当前画布没有可按 assetId 恢复的媒体节点。')
      return
    }

    setAssetRecoverBatchStatus('running')
    try {
      const response = await fetch('/api/assets/recover-batch', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ assetIds }),
      })
      const data = await response.json().catch(() => ({})) as {
        success?: boolean
        summary?: { total?: number; ready?: number; recovered?: number; unrecoverable?: number }
        assets?: CanvasAssetResolveResult[]
        message?: string
        errorCode?: string
      }
      if (!response.ok || !Array.isArray(data.assets)) {
        throw new Error(data.message || data.errorCode || '批量恢复资产失败。')
      }

      const byId = new Map(data.assets.map((asset) => [asset.assetId, asset]))
      let changed = false
      const nextNodes = latestNodesRef.current.map((node) => {
        if (node.kind !== 'image' && node.kind !== 'video') return node
        const assetId = getNodeAssetId(node)
        const result = assetId ? byId.get(assetId) : undefined
        if (!result) return node
        const patched = applyResolvedAssetToNode(node, result)
        changed = changed || patched !== node
        return patched
      })

      if (changed) {
        commitNodes(nextNodes)
        writeUnifiedLocalSnapshot({ nodes: nextNodes })
        scheduleCanvasSave(0)
      }
      setAssetRecoverBatchStatus('done')
      showCanvasFeedback(`资产恢复完成：ready ${data.summary?.ready ?? 0}，重新上传 ${data.summary?.recovered ?? 0}，不可恢复 ${data.summary?.unrecoverable ?? 0}。`)
    } catch (error) {
      setAssetRecoverBatchStatus('failed')
      showCanvasFeedback(error instanceof Error ? error.message : '批量恢复资产失败。')
    }
  }, [commitNodes, scheduleCanvasSave, showCanvasFeedback, writeUnifiedLocalSnapshot])

  const handleRecoverCanvasNodes = useCallback(async () => {
    if (!projectId) return
    setRecoverNodeStatus('running')
    setRecoverNodeCount(0)
    try {
      const resp = await fetch(
        `/api/assets/recover-canvas-nodes?projectId=${encodeURIComponent(projectId)}`,
        { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } }
      )
      const data = await resp.json().catch(() => ({})) as {
        recovered?: number
        items?: Array<{ nodeId: string; kind: string; url: string; assetId: string }>
      }
      if (!resp.ok) throw new Error('恢复接口返回错误')
      const items = data.items ?? []
      const recoveredMap = new Map(items.map((i) => [i.nodeId, i]))
      const patches = new Map<string, VisualCanvasNode>()
      for (const node of latestNodesRef.current) {
        const hit = recoveredMap.get(node.id)
        if (!hit) continue
        if (hit.kind === 'image' && node.resultImageUrl) continue // already has URL
        if (hit.kind === 'video' && node.resultVideoUrl) continue // already has URL
        const meta = metadataRecord(node.metadataJson)
        patches.set(node.id, {
          ...node,
          status: 'done' as const,
          errorMessage: undefined,
          resultImageUrl: hit.kind === 'image' ? hit.url : node.resultImageUrl,
          resultVideoUrl: hit.kind === 'video' ? hit.url : node.resultVideoUrl,
          metadataJson: {
            ...meta,
            reloadRecoveryPending: undefined,
            recoveryStatus: 'ready',
            assetId: hit.assetId,
            loading: false,
            errorCode: null,
            errorMessage: null,
          },
        })
      }
      if (patches.size > 0) {
        commitNodes((current) => current.map((node) => patches.get(node.id) ?? node))
        scheduleCanvasSave(0)
      }
      setRecoverNodeCount(patches.size)
      setRecoverNodeStatus(patches.size > 0 ? 'done-recovered' : 'done-empty')
      showCanvasFeedback(patches.size > 0 ? `已恢复 ${patches.size} 个历史素材。` : '暂无可恢复素材。')
    } catch {
      // Network or HTTP error — do not touch nodes, do not mark anything failed
      setRecoverNodeStatus('failed')
      showCanvasFeedback('恢复历史素材失败，请稍后重试。')
    }
  }, [commitNodes, projectId, scheduleCanvasSave, showCanvasFeedback])

  const handleEdgePatch = useCallback((edgeId: string, patch: Partial<CanvasEdge>) => {
    commitEdges((current) => current.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge)))
    flushLocalSnapshot()
    scheduleCanvasSave(0)
    showCanvasFeedback('连接导演已保存。')
  }, [commitEdges, flushLocalSnapshot, scheduleCanvasSave, showCanvasFeedback])

  const handleQueryGenerationTask = useCallback(async (task: CanvasGenerationTask) => {
    if (task.kind !== 'video' || task.providerId !== 'volcengine-seedance-video') {
      const message = '当前任务中心第一版仅支持查询 Volcengine Seedance Video。'
      showCanvasFeedback(message)
      return message
    }

    const nodeSnapshot = latestNodesRef.current.find((node) => node.id === task.nodeId)
    if (!nodeSnapshot) {
      const message = '任务对应节点已不存在。'
      showCanvasFeedback(message)
      return message
    }

    const checkedAt = new Date().toISOString()
    const currentMetadata = metadataRecord(nodeSnapshot.metadataJson)
    const statusResult = await pollSeedanceVideoTask(task.providerId, task.taskId, {
      projectId,
      workflowId,
      nodeId: task.nodeId,
      prompt: nodeSnapshot.prompt,
      compiledPrompt: typeof currentMetadata.compiledPromptPreview === 'string' ? currentMetadata.compiledPromptPreview : undefined,
    })
    const normalizedStatus = String(statusResult.status ?? '')

    if (statusResult.success && normalizedStatus === 'running') {
      handleNodePatch(task.nodeId, {
        status: 'running',
        resultPreview: '视频生成中，请稍后再查。',
        outputLabel: '视频生成中',
        metadataJson: {
          ...currentMetadata,
          providerId: statusResult.providerId || task.providerId,
          model: statusResult.model ?? task.model ?? currentMetadata.model,
          taskId: task.taskId,
          generationJobId: task.taskId,
          lastCheckedAt: checkedAt,
        },
      })
      flushLocalSnapshot()
      scheduleCanvasSave(0)
      showCanvasFeedback('仍在生成中')
      return '仍在生成中'
    }

    const videoUrl = statusResult.videoUrl ?? statusResult.result?.videoUrl
    if (statusResult.success && (normalizedStatus === 'done' || normalizedStatus === 'succeeded') && videoUrl) {
      const completedAt = new Date().toISOString()
      const metadataJson = {
        ...currentMetadata,
        providerId: statusResult.providerId || task.providerId,
        model: statusResult.model ?? task.model ?? currentMetadata.model,
        taskId: task.taskId,
        generationJobId: task.taskId,
        assetId: statusResult.asset?.id ?? statusResult.assetId ?? currentMetadata.assetId,
        assetUrl: statusResult.assetUrl ?? statusResult.asset?.url ?? (statusResult.assetId ? videoUrl : currentMetadata.assetUrl),
        originalProviderVideoUrl: statusResult.originalProviderVideoUrl ?? currentMetadata.originalProviderVideoUrl,
        mediaPersistence: statusResult.mediaPersistence ?? currentMetadata.mediaPersistence,
        assetIntelligence: statusResult.assetIntelligence ?? currentMetadata.assetIntelligence,
        ...(statusResult.warning ? { mediaPersistenceWarning: statusResult.warning } : {}),
        completedAt,
        lastCheckedAt: checkedAt,
      }
      handleNodePatch(task.nodeId, {
        status: 'done',
        resultVideoUrl: videoUrl,
        resultPreview: '视频已生成',
        outputLabel: '视频已生成',
        errorMessage: undefined,
        metadataJson,
        preview: { type: 'remote-video', url: videoUrl, poster: videoUrl, licenseType: 'original', attribution: 'Generated by Volcengine Seedance' },
      })
      flushLocalSnapshot()
      scheduleCanvasSave(0)
      showCanvasFeedback('视频生成完成')
      return '视频生成完成'
    }

    const errMsg = formatGenerateError(statusResult)
    handleNodePatch(task.nodeId, {
      status: 'error',
      errorMessage: errMsg,
      resultPreview: nodeSnapshot.resultPreview ?? '视频任务失败',
      outputLabel: '视频任务失败',
      metadataJson: {
        ...currentMetadata,
        providerId: statusResult.providerId || task.providerId,
        model: statusResult.model ?? task.model ?? currentMetadata.model,
        taskId: task.taskId,
        generationJobId: task.taskId,
        lastCheckedAt: checkedAt,
        lastError: {
          errorCode: statusResult.errorCode,
          message: normalizeGenerateErrorMessage(statusResult),
          upstreamStatus: statusResult.upstreamStatus,
          upstreamMessage: statusResult.upstreamMessage,
          rawCode: statusResult.rawCode,
          requestId: statusResult.requestId,
          at: checkedAt,
        },
      },
    })
    flushLocalSnapshot()
    scheduleCanvasSave(0)
    showCanvasFeedback(errMsg)
    return errMsg
  }, [flushLocalSnapshot, handleNodePatch, projectId, scheduleCanvasSave, showCanvasFeedback, workflowId])

  const handleNodeDragStart = useCallback((
    nodeId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return

    event.preventDefault()
    event.stopPropagation()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Window pointer listeners still handle the drag if capture is unavailable.
    }
    nodeDragRef.current = {
      nodeId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node.x,
      startY: node.y,
      latestX: node.x,
      latestY: node.y,
    }
    setActiveNodeId(nodeId)
    setIsRightInspectorOpen(true)
    setActiveEdgeId(null)
    if (activePreviewNodeId && activePreviewNodeId !== nodeId) {
      closeActivePreview({ closeReviewWindows: false })
    }
    setEditingNodeId(null)
    setDraggingNodeId(nodeId)
    setContextMenu(null)
    setNodeAddMenu(null)
  }, [activePreviewNodeId, closeActivePreview, nodes])
  const pendingCommentCount = useMemo(() => comments.filter(isPendingCanvasComment).length, [comments])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = nodeDragRef.current
      if (!drag) return
      event.preventDefault()
      event.stopPropagation()
      const nextX = drag.startX + (event.clientX - drag.startClientX) / canvasZoom
      const nextY = drag.startY + (event.clientY - drag.startClientY) / canvasZoom
      drag.latestX = Number.isFinite(nextX) ? nextX : drag.startX
      drag.latestY = Number.isFinite(nextY) ? nextY : drag.startY
      handleNodePatch(drag.nodeId, {
        x: drag.latestX,
        y: drag.latestY,
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      const drag = nodeDragRef.current
      nodeDragRef.current = null
      setDraggingNodeId('')
      if (!drag) return
      event.preventDefault()
      event.stopPropagation()
      handleNodePatch(drag.nodeId, {
        x: drag.latestX,
        y: drag.latestY,
      })
      flushLocalSnapshot()
      scheduleCanvasSave(0)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [canvasZoom, flushLocalSnapshot, handleNodePatch, scheduleCanvasSave])

  const syncPromptPreset = useCallback((kind: VisualCanvasNodeKind) => {
    const meta = NODE_META[kind]
    const providerKind = getProviderKind(kind)
    // Text providers (deepseek-text, kimi-text, etc.) live only in TEXT_NODE_PROVIDER_OPTIONS —
    // they are not registered in the canvas provider catalog, so getCanvasProvider would miss
    // them and fall back to 'anthropic-claude'. Use the options list directly instead.
    const defaultModel = kind === 'image'
      ? getDefaultImageProviderId(imageProviderStatusMap) ?? meta.model
      : kind === 'video'
        ? getDefaultVideoProviderId(videoProviderStatusMap) ?? meta.model
      : kind === 'text'
        ? TEXT_NODE_PROVIDER_OPTIONS[0]?.value ?? meta.model
      : getCanvasProvider(providerKind, meta.model)?.id ?? CANVAS_PROVIDER_FALLBACKS[providerKind]
    setPreferredKind(kind)
    setPromptModel(defaultModel)
    if (meta.ratio) {
      setPromptRatio(meta.ratio)
      const preset = Object.entries(PARAMETER_RATIO_MAP).find(([, value]) => value === meta.ratio)?.[0]
      if (preset) {
        setPromptParameter(preset as keyof typeof PARAMETER_RATIO_MAP)
      }
    }
  }, [imageProviderStatusMap, videoProviderStatusMap])

  const focusPromptForNode = useCallback((node: VisualCanvasNode) => {
    if (activePreviewNodeId && activePreviewNodeId !== node.id) {
      closeActivePreview({ closeReviewWindows: false })
    }
    setActiveNodeId(node.id)
    setActiveEdgeId(null)
    openGenerationDialog(node.id)
    setCanvasPrompt(node.prompt)
    syncPromptPreset(node.kind)
    setPromptModel(normalizeProviderId(node.providerId || node.model))
    if (node.ratio) {
      setPromptRatio(node.ratio)
    }
    window.setTimeout(() => {
      promptInputRef.current?.focus()
      promptInputRef.current?.select()
    }, 0)
  }, [activePreviewNodeId, closeActivePreview, openGenerationDialog, syncPromptPreset])

  const selectNodeForMove = useCallback((node: VisualCanvasNode) => {
    if (activePreviewNodeId && activePreviewNodeId !== node.id) {
      closeActivePreview({ closeReviewWindows: false })
    }
    setActiveNodeId(node.id)
    setIsRightInspectorOpen(true)
    setActiveEdgeId(null)
    setEditingNodeId(null)
    setContextMenu(null)
    setNodeAddMenu(null)
    setNodeCreateMenu(null)
  }, [activePreviewNodeId, closeActivePreview])

  const openNodePreview = useCallback((node: VisualCanvasNode, type: CanvasNodePreviewType) => {
    if (type !== 'text' && type !== node.kind) return
    if (type === 'text' && node.kind !== 'text') return
    setActiveNodeId(node.id)
    setActiveEdgeId(null)
    setEditingNodeId(null)
    if (type === 'image' || type === 'video') {
      const defaultWidth = type === 'image' ? REVIEW_WINDOW_IMAGE_WIDTH : REVIEW_WINDOW_VIDEO_WIDTH
      const initial = clampReviewWindowGeometry({
        x: 120,
        y: REVIEW_WINDOW_TOP_GUARD,
        width: defaultWidth,
        height: Math.round(defaultWidth * (type === 'image' ? 0.72 : 0.62)),
      })
      const viewportRect = viewportRef.current?.getBoundingClientRect()
      const surfaceOffset = getSurfaceOffset(surfaceRef.current)
      const nodeScreenX = (viewportRect?.left ?? 0) + surfaceOffset.left + canvasPan.x + node.x * canvasZoom
      const nodeScreenY = (viewportRect?.top ?? 0) + surfaceOffset.top + canvasPan.y + node.y * canvasZoom
      const nodeScreenWidth = node.width * canvasZoom
      const nodeScreenHeight = node.height * canvasZoom
      const rightX = nodeScreenX + nodeScreenWidth + REVIEW_WINDOW_GAP
      const leftX = nodeScreenX - initial.width - REVIEW_WINDOW_GAP
      const hasRightSpace = typeof window === 'undefined' || rightX + initial.width <= window.innerWidth - 12
      const positioned = clampReviewWindowGeometry({
        ...initial,
        x: hasRightSpace ? rightX : leftX,
        y: nodeScreenY + Math.max(0, (nodeScreenHeight - initial.height) / 2),
      })
      mediaReviewZRef.current += 1
      const reviewId = `${node.id}-${type}`
      setActivePreviewNodeId(null)
      setActivePreviewType(null)
      setMediaReviewWindows((current) => {
        const existing = current.find((review) => review.id === reviewId)
        if (existing) {
          return current.map((review) => (
            review.id === reviewId
              ? { ...review, ...positioned, zIndex: mediaReviewZRef.current }
              : review
          ))
        }
        return [
          ...current,
          {
            id: reviewId,
            nodeId: node.id,
            type,
            ...positioned,
            zIndex: mediaReviewZRef.current,
          },
        ]
      })
      setTextEditorDraft('')
      setTextEditorCopied(false)
      setPreviewLinkCopied(false)
      return
    }
    setActivePreviewNodeId(node.id)
    setActivePreviewType(type)
    setPreviewLinkCopied(false)
    if (type === 'text') {
      setTextEditorDraft(node.resultText ?? '')
    } else {
      setTextEditorDraft('')
    }
    setTextEditorCopied(false)
  }, [canvasPan.x, canvasPan.y, canvasZoom])

  const openPromptInspector = useCallback((nodeId: string) => {
    setActiveNodeId(nodeId)
    setActiveInspectorNodeId(nodeId)
    setContextMenu(null)
    setNodeAddMenu(null)
    setNodeCreateMenu(null)
  }, [])

  const openMediaDiagnostics = useCallback((nodeId: string, type: 'image' | 'video') => {
    setActiveNodeId(nodeId)
    setActiveMediaDiagnostics({ nodeId, type })
    setContextMenu(null)
    setNodeAddMenu(null)
    setNodeCreateMenu(null)
  }, [])

  const openEdgeDirector = useCallback((edgeId: string) => {
    const edge = latestEdgesRef.current.find((item) => item.id === edgeId)
    if (!edge) return
    setActiveEdgeId(edgeId)
    setActiveNodeId(null)
    setEditingNodeId(null)
    closeActivePreview()
    closePromptInspector()
    setStoryboardPreviewOpen(false)
    setContextMenu(null)
    setNodeAddMenu(null)
    setNodeCreateMenu(null)
  }, [closeActivePreview, closePromptInspector])

  const saveTextEditor = useCallback(() => {
    if (!textEditorNode) return
    const now = new Date().toISOString()
    handleNodePatch(textEditorNode.id, {
      resultText: textEditorDraft,
      resultPreview: textEditorDraft.slice(0, 200),
      outputLabel: textEditorDraft.slice(0, 80) || '文本已手动保存',
      status: 'done',
      errorMessage: undefined,
      metadataJson: {
        ...metadataRecord(textEditorNode.metadataJson),
        manuallyEdited: true,
        editedAt: now,
      },
    })
    if (editingNodeId === textEditorNode.id) setDialogError(null)
    flushLocalSnapshot()
    scheduleCanvasSave(0)
    showCanvasFeedback('文本修改已保存。')
    closeActivePreview()
  }, [closeActivePreview, editingNodeId, flushLocalSnapshot, handleNodePatch, scheduleCanvasSave, showCanvasFeedback, textEditorDraft, textEditorNode])

  const copyTextEditor = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(textEditorDraft)
      setTextEditorCopied(true)
      window.setTimeout(() => setTextEditorCopied(false), 1200)
    } catch {
      showCanvasFeedback('复制失败，请手动选择文本复制。')
    }
  }, [showCanvasFeedback, textEditorDraft])

  const copyActivePreviewLink = useCallback(async (url: string) => {
    try {
      await navigator.clipboard?.writeText(url)
      setPreviewLinkCopied(true)
      window.setTimeout(() => setPreviewLinkCopied(false), 1200)
    } catch {
      showCanvasFeedback('复制失败，请手动复制链接。')
    }
  }, [showCanvasFeedback])

  const openActivePreviewLink = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  const handleNodeSceneEditsChange = useCallback((nodeId: string, sceneEdits: SceneEditMark[]) => {
    const node = latestNodesRef.current.find((item) => item.id === nodeId)
    if (!node) return
    handleNodePatch(nodeId, {
      metadataJson: sceneEditsMetadata(node.metadataJson, sceneEdits),
    })
    flushLocalSnapshot()
    scheduleCanvasSave()
  }, [flushLocalSnapshot, handleNodePatch, scheduleCanvasSave])

  const copySceneEditInstructions = useCallback(async (sceneEdits: SceneEditMark[]) => {
    try {
      await navigator.clipboard?.writeText(summarizeSceneEdits(sceneEdits))
      setSceneEditInstructionsCopied(true)
      window.setTimeout(() => setSceneEditInstructionsCopied(false), 1200)
    } catch {
      showCanvasFeedback('复制失败，请手动复制场景编辑指令。')
    }
  }, [showCanvasFeedback])

  const buildResultLabel = useCallback((title: string) => {
    const assetCopy = promptAssetMode === 'none' ? '无素材' : assetLabel
    const providerCopy = activeProviderNotice ? ` · ${activeProviderNotice}` : ''
    return `${title} · ${stageLabel} · ${assetCopy} · ${parameterLabel}${providerCopy}。结果已就绪，可继续追加下一个节点。`
  }, [activeProviderNotice, assetLabel, parameterLabel, promptAssetMode, stageLabel])

  const handleAddNode = useCallback((kind: VisualCanvasNodeKind, presetTitle?: string) => {
    setHasStarted(true)
    syncPromptPreset(kind)
    const model = kind === 'image'
      ? getDefaultImageProviderId(imageProviderStatusMap) ?? NODE_META[kind].model
      : kind === 'video'
        ? getDefaultVideoProviderId(videoProviderStatusMap) ?? NODE_META[kind].model
      : NODE_META[kind].model
    createNode(kind, {
      title: presetTitle ?? NODE_META[kind].title,
      model,
      ratio: NODE_META[kind].ratio,
    })
    setEditingNodeId(null)
  }, [createNode, imageProviderStatusMap, syncPromptPreset, videoProviderStatusMap])

  const closeSidePanel = useCallback(() => {
    setActivePanel(null)
  }, [])


  const handleAddNodeToDirector = useCallback((node: CanvasNodeCardNode) => {
    setDirectorState((current) => {
      const thumbnailUrl = node.kind === 'image' ? (node.resultImageUrl ?? undefined) : node.kind === 'video' ? (node.resultVideoUrl ?? undefined) : undefined
      if (current.shots.length === 0) {
        const newShot = createShotCard(0)
        const updated = addNodeToShot(newShot, node.id, thumbnailUrl)
        const next = { ...current, shots: [updated], updatedAt: new Date().toISOString() }
        setDirectorActiveShotId(updated.id)
        setStoryboardDirectorOpen(true)
        return next
      }
      const targetId = directorActiveShotId ?? current.shots[current.shots.length - 1]?.id
      if (!targetId) return current
      const nextShots = current.shots.map((s) => s.id === targetId ? addNodeToShot(s, node.id, !s.thumbnailUrl ? thumbnailUrl : s.thumbnailUrl) : s)
      return { ...current, shots: nextShots, updatedAt: new Date().toISOString() }
    })
    if (!storyboardDirectorOpen) setStoryboardDirectorOpen(true)
  }, [directorActiveShotId, storyboardDirectorOpen])

  const handleNodeCharacterIdsChange = useCallback((nodeId: string, characterIds: string[]) => {
    handleNodePatch(nodeId, {
      metadataJson: characterIdsMetadata(
        latestNodesRef.current.find((node) => node.id === nodeId)?.metadataJson,
        characterIds,
      ),
    })
    flushLocalSnapshot()
    scheduleCanvasSave()
  }, [flushLocalSnapshot, handleNodePatch, scheduleCanvasSave])

  const handleNodeSceneIdsChange = useCallback((nodeId: string, sceneIds: string[]) => {
    handleNodePatch(nodeId, {
      metadataJson: sceneIdsMetadata(
        latestNodesRef.current.find((node) => node.id === nodeId)?.metadataJson,
        sceneIds,
      ),
    })
    flushLocalSnapshot()
    scheduleCanvasSave()
  }, [flushLocalSnapshot, handleNodePatch, scheduleCanvasSave])

  const openCreativeAssets = useCallback((
    nodeId: string,
    options?: { tab?: 'intelligence' | 'characters' | 'scenes' | 'scene-lab' | 'palette' | 'props' | 'camera'; sourceNodeId?: string },
  ) => {
    flushLocalSnapshot()
    setActiveCreativeAssetsTab(options?.tab ?? 'characters')
    setActiveSceneLabSourceNodeId(options?.sourceNodeId ?? '')
    setActiveCreativeAssetsNodeId(nodeId)
    setEditingNodeId(null)
    setContextMenu(null)
    setNodeAddMenu(null)
    setNodeCreateMenu(null)
  }, [flushLocalSnapshot])

  const handleSceneLabPromptMetadata = useCallback((nodeId: string, prompt: string, sourceNodeId?: string) => {
    const node = latestNodesRef.current.find((item) => item.id === nodeId)
    if (!node) return
    handleNodePatch(nodeId, {
      metadataJson: {
        ...metadataRecord(node.metadataJson),
        sceneEditPromptPreview: compactText(prompt, 1200),
        sceneEditPromptSourceNodeId: sourceNodeId,
        sceneEditPromptUpdatedAt: new Date().toISOString(),
      },
    })
    flushLocalSnapshot()
    scheduleCanvasSave()
  }, [flushLocalSnapshot, handleNodePatch, scheduleCanvasSave])

  const handleSendSceneLabPromptToNode = useCallback((nodeId: string, prompt: string, sourceNodeId?: string) => {
    const node = latestNodesRef.current.find((item) => item.id === nodeId)
    if (!node) return
    const metadataJson = {
      ...metadataRecord(node.metadataJson),
      sceneEditPromptPreview: compactText(prompt, 1200),
      sceneEditPromptSourceNodeId: sourceNodeId,
      sceneEditPromptUpdatedAt: new Date().toISOString(),
    }
    handleNodePatch(nodeId, { prompt, metadataJson })
    if (editingNodeId === nodeId || activeNodeId === nodeId) setCanvasPrompt(prompt)
    flushLocalSnapshot()
    scheduleCanvasSave()
    showCanvasFeedback('已发送到当前 Image 节点 Prompt，未自动生成。')
  }, [activeNodeId, editingNodeId, flushLocalSnapshot, handleNodePatch, scheduleCanvasSave, showCanvasFeedback])

  const handleCreateSceneReplaceImageNode = useCallback((input: {
    sourceNodeId: string
    run: ScenePluginRun
    prompt: string
  }) => {
    const sourceNode = latestNodesRef.current.find((node) => node.id === input.sourceNodeId)
    const imageUrl = input.run.resultImageUrl
    if (!sourceNode || !imageUrl) {
      showCanvasFeedback('场景替换插件没有返回可用图片。')
      return
    }

    const size = getNodeSize('image')
    const nodeId = createNodeId('image')
    const pluginProvider = input.run.pluginProvider || 'custom'
    const pluginResult = metadataRecord(input.run.pluginResult)
    const pluginAssetId = typeof pluginResult.assetId === 'string' ? pluginResult.assetId : undefined
    const pluginAssetUrl = typeof pluginResult.assetUrl === 'string' ? pluginResult.assetUrl : undefined
    const pluginOriginalProviderImageUrl = typeof pluginResult.originalProviderImageUrl === 'string' ? pluginResult.originalProviderImageUrl : undefined
    const metadataJson = {
      sourceImageNodeId: sourceNode.id,
      sourceImageUrl: input.run.sourceImageUrl || sourceNode.resultImageUrl,
      scenePluginRunId: input.run.id,
      scenePluginType: 'scene-replace',
      selectedRegion: input.run.region,
      targetDescription: input.run.targetDescription,
      preserveInstruction: input.run.preserveInstruction,
      negativeInstruction: input.run.negativeInstruction,
      pluginProvider,
      pluginResult: input.run.pluginResult,
      sceneReplacePrompt: input.prompt,
      ...(pluginAssetId ? { assetId: pluginAssetId } : {}),
      ...(pluginAssetUrl ? { assetUrl: pluginAssetUrl } : {}),
      ...(pluginOriginalProviderImageUrl ? { originalProviderImageUrl: pluginOriginalProviderImageUrl } : {}),
      ...(pluginResult.mediaPersistence ? { mediaPersistence: pluginResult.mediaPersistence } : {}),
      ...(typeof pluginResult.warning === 'string' ? { mediaPersistenceWarning: pluginResult.warning } : {}),
    }
    const newNode: VisualCanvasNode = {
      id: nodeId,
      type: 'image',
      kind: 'image',
      title: `${sourceNode.title || 'Image'} · 场景替换`,
      subtitle: 'Scene Replace Plugin 输出',
      prompt: input.prompt,
      model: 'scene-replace-plugin',
      providerId: pluginProvider,
      stage: sourceNode.stage || promptStage,
      ratio: sourceNode.ratio || NODE_META.image.ratio,
      status: 'done',
      resultImageUrl: imageUrl,
      resultPreview: '场景替换插件已返回新图',
      outputLabel: '场景替换完成',
      x: sourceNode.x + 520,
      y: sourceNode.y,
      width: size.width,
      height: size.height,
      createdAt: Date.now(),
      metadataJson,
    }
    const edgeId = `${sourceNode.id}-${nodeId}`
    const newEdge: CanvasEdge = {
      id: edgeId,
      fromNodeId: sourceNode.id,
      toNodeId: nodeId,
      status: 'done',
      type: 'scene-continuity',
      metadataJson: {
        edgeDirector: {
          type: 'scene-continuity',
          inheritScene: true,
          inheritColor: true,
          lockStyle: true,
          customInstruction: '基于原图进行场景替换，保持未选区稳定，只修改选区。',
        },
      },
    }

    commitNodes((current) => [...current, newNode])
    commitEdges((current) => [...current.filter((edge) => edge.id !== edgeId), newEdge])
    setActiveNodeId(nodeId)
    setCanvasPrompt(input.prompt)
    setPromptModel(pluginProvider)
    setPreferredKind('image')
    flushLocalSnapshot()
    scheduleCanvasSave(0)
    showCanvasFeedback('场景替换完成，已创建新的 Image 节点并连接原图。')
  }, [commitEdges, commitNodes, flushLocalSnapshot, promptStage, scheduleCanvasSave, showCanvasFeedback])


  const handleAddProjectAssetToCanvas = useCallback((asset: ProjectAssetItem) => {
    setHasStarted(true)
    const normalizedType = normalizeAssetType(asset.normalizedType || asset.type)
    const kind: VisualCanvasNodeKind = normalizedType === 'image'
      ? 'image'
      : normalizedType === 'script' || normalizedType === 'text'
        ? 'text'
        : normalizedType === 'video'
          ? 'video'
          : normalizedType === 'audio'
            ? 'audio'
            : 'asset'
    const title = asset.title?.trim() || asset.name?.trim() || '素材'
    const assetUrl = asset.url || asset.dataUrl || ''
    const metadata = asset.metadataJson && typeof asset.metadataJson === 'object'
      ? asset.metadataJson as Record<string, unknown>
      : {}
    const contentText = typeof metadata.contentText === 'string' && metadata.contentText.trim()
      ? metadata.contentText.trim()
      : title
    const resultPreview = kind === 'image'
      ? '图片素材已加入画布。'
      : kind === 'text'
        ? contentText.slice(0, 220)
        : assetUrl
          ? `链接占位 · ${assetUrl}`
          : `${title} 已加入画布。`
    const providerId = asset.providerId || 'asset-library'
    const node = createNode(kind, {
      title,
      prompt: title,
      model: providerId,
      status: 'done',
    })
    handleNodePatch(node.id, {
      providerId,
      model: providerId,
      resultImageUrl: kind === 'image' ? assetUrl : undefined,
      resultText: kind === 'text' ? contentText.slice(0, 1000) : undefined,
      resultVideoUrl: kind === 'video' ? assetUrl : undefined,
      resultAudioUrl: kind === 'audio' ? assetUrl : undefined,
      resultPreview,
      outputLabel: kind === 'image' ? '图片素材' : getEntryKindLabel(kind),
      metadataJson: {
        assetId: asset.id,
        assetUrl,
        assetType: asset.type,
        source: 'asset-library',
        providerId,
      },
    })
    setActivePanel(null)
    setEditingNodeId(null)
    scheduleCanvasSave(0)
    showCanvasFeedback(`${title} 已加入画布。`)
  }, [createNode, handleNodePatch, scheduleCanvasSave, showCanvasFeedback])

  const handleSelectTemplate = useCallback((template: PublicTemplate) => {
    setSelectedTemplateId(template.id)
    setHasStarted(true)
    setActivePanel(null)

    const viewportWidth = viewportRef.current?.getBoundingClientRect().width ?? 1200
    const compactWorkflowLayout = viewportWidth < 760
    const existingMaxX = nodes.length > 0
      ? Math.max(...nodes.map((node) => node.x + node.width))
      : 420
    const basePosition = {
      x: nodes.length > 0 ? existingMaxX + 180 : compactWorkflowLayout ? 0 : 420,
      y: nodes.length > 0 ? 220 + (nodes.length % 3) * 96 : 260,
    }
    const idMap = new Map<string, string>()
    const nextNodes: VisualCanvasNode[] = []

    template.nodeGraph.nodes.forEach((graphNode) => {
      const kind = getNodeKindForPublicTemplate(graphNode.type)
      const size = getNodeSize(kind)
      const nodeId = createNodeId(kind)
      idMap.set(graphNode.id, nodeId)
      const graphPosition = compactWorkflowLayout
        ? { x: 0, y: template.nodeGraph.nodes.indexOf(graphNode) * 240 }
        : { x: graphNode.x, y: graphNode.y }
      const position = resolveNonOverlappingPosition(
        {
          x: basePosition.x + graphPosition.x,
          y: basePosition.y + graphPosition.y,
          ...size,
        },
        [...nodes, ...nextNodes],
      )
      const providerId = NODE_META[kind].model
      // Image nodes show gradient (placeholder until generated); video nodes show template preview
      const preview = graphNode.type === 'video'
        ? {
          ...template.preview,
          gradientFrom: template.thumbnail.gradientFrom ?? '#101827',
          gradientTo: template.thumbnail.gradientTo ?? '#315cff',
        }
        : graphNode.type === 'image'
          ? {
            type: 'none' as const,
            gradientFrom: template.thumbnail.gradientFrom ?? '#101827',
            gradientTo: template.thumbnail.gradientTo ?? '#315cff',
          }
          : undefined

      nextNodes.push({
        id: nodeId,
        type: kind,
        kind,
        title: graphNode.title,
        subtitle: NODE_META[kind].subtitle,
        prompt: graphNode.prompt,
        model: providerId,
        providerId,
        stage: promptStage,
        ratio: template.aspectRatio,
        status: 'done',
        resultPreview: graphNode.resultPreview,
        outputLabel: '模板工作流',
        preview,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        createdAt: Date.now(),
      })
    })

    const nextEdges = template.nodeGraph.edges.flatMap((edge) => {
      const fromNodeId = idMap.get(edge.from)
      const toNodeId = idMap.get(edge.to)
      if (!fromNodeId || !toNodeId) return []
      return [{
        id: `${fromNodeId}-${toNodeId}`,
        fromNodeId,
        toNodeId,
        status: 'active' as const,
      }]
    })

    commitNodes((current) => [...current, ...nextNodes])
    commitEdges((current) => [...current, ...nextEdges])

    const firstNode = nextNodes.find((node) => node.kind === 'video' || node.kind === 'image') ?? nextNodes[0]
    if (firstNode) {
      setActiveNodeId(firstNode.id)
      setEditingNodeId(null)
      setCanvasPrompt(firstNode.prompt)
      setPromptModel(normalizeProviderId(firstNode.providerId || firstNode.model))
      syncPromptPreset(firstNode.kind)
    }

    showCanvasFeedback('已应用模板，可继续创作。')
  }, [commitEdges, commitNodes, nodes, promptStage, showCanvasFeedback, syncPromptPreset])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const queryTemplateId = searchParamTemplateId ?? new URLSearchParams(window.location.search).get('template')
    const storedTemplateId = window.sessionStorage.getItem('creator-city-template-id')
    const templateId = queryTemplateId ?? storedTemplateId
    console.debug(`[template apply] template=${templateId ?? ''} nodes=${nodes.length}`)
    if (!templateId) return
    if (initialTemplateAppliedRef.current === templateId && nodes.length > 0) return
    const resolvedTemplateId = templateId
    let disposed = false
    const sessionTemplate = getTemplateFromSession(resolvedTemplateId)
    const localTemplate = sessionTemplate ?? getPublicTemplateById(resolvedTemplateId)
    console.debug(`[template apply] local=${localTemplate?.title ?? ''}`)

    const cleanupTemplateIntent = () => {
      window.sessionStorage.removeItem('creator-city-template-id')
      window.sessionStorage.removeItem('creator-city-template-payload')
      window.history.replaceState({}, '', window.location.pathname)
      window.setTimeout(() => {
        window.history.replaceState({}, '', window.location.pathname)
      }, 0)
    }

    if (localTemplate) {
      initialTemplateAppliedRef.current = resolvedTemplateId
      console.debug(`[template apply] applying=${localTemplate.title}`)
      handleSelectTemplate(localTemplate)
      cleanupTemplateIntent()
      return
    }

    async function applyTemplateFromApi() {
      try {
        const response = await fetch('/api/templates/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: resolvedTemplateId }),
        })
        const data = await response.json() as { success?: boolean; template?: PublicTemplate }
        if (disposed) return
        const template = data.success && data.template ? data.template : undefined
        if (template) {
          initialTemplateAppliedRef.current = resolvedTemplateId
          handleSelectTemplate(template)
        }
      } catch {
        if (disposed) return
      } finally {
        if (!disposed) cleanupTemplateIntent()
      }
    }

    void applyTemplateFromApi()

    return () => {
      disposed = true
    }
  }, [handleSelectTemplate, nodes.length, searchParamTemplateId])

  const loadCanvasComments = useCallback(async () => {
    if (!projectId) return
    const cachedComments = readCommentsCache(projectId)
    const pendingComments = readPendingComments(projectId)
    if (cachedComments || pendingComments.length) {
      setComments(mergeComments(cachedComments ?? [], pendingComments))
    }
    setCommentsLoading(true)
    setCommentsError('')
    try {
      const workflowQuery = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : ''
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/comments${workflowQuery}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const raw = await response.text()
      let data: {
        success?: boolean
        errorCode?: string
        message?: string
        comments?: Array<{ id: string; body: string; status?: string; createdAt: string }>
      }
      try { data = JSON.parse(raw) as typeof data } catch { data = {} }
      if (!response.ok || data.success === false) {
        throw new Error(data.errorCode ? `${data.errorCode}: ${data.message ?? '加载评论失败'}` : data.message ?? '加载评论失败')
      }
      const nextComments = (data.comments ?? []).map((comment) => ({
        id: comment.id,
        text: comment.body,
        status: comment.status,
        authorName: '我',
        createdAt: new Date(comment.createdAt).getTime(),
      }))
      const stillPending = readPendingComments(projectId)
      setComments(mergeComments(nextComments, stillPending))
      writeCommentsCache(projectId, nextComments)
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载评论失败，本地评论已保留。'
      setCommentsError(message)
      showCanvasFeedback(message)
    } finally {
      setCommentsLoading(false)
    }
  }, [mergeComments, projectId, readCommentsCache, readPendingComments, showCanvasFeedback, workflowId, writeCommentsCache])

  const postCanvasComment = useCallback(async (comment: CanvasComment) => {
    if (!projectId) throw new Error('项目仍在加载，请稍后再评论。')
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/comments`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ workflowId: workflowId || undefined, body: comment.text }),
    })
    const raw = await response.text()
    let data: {
      success?: boolean
      errorCode?: string
      message?: string
      comment?: { id: string; body: string; status?: string; createdAt: string }
    }
    try { data = JSON.parse(raw) as typeof data } catch { data = {} }
    if (!response.ok || data.success === false || !data.comment) {
      throw new Error(data.errorCode ? `${data.errorCode}: ${data.message ?? '保存评论失败'}` : data.message ?? '保存评论失败')
    }
    return {
      id: data.comment.id,
      text: data.comment.body,
      status: data.comment.status ?? 'open',
      authorName: '我',
      createdAt: new Date(data.comment.createdAt).getTime(),
    } satisfies CanvasComment
  }, [projectId, workflowId])

  const handleAddComment = useCallback(async (text: string) => {
    if (!projectId) {
      setCommentsError('项目仍在加载，请稍后再评论。')
      return false
    }
    setCommentsError('')
    const localComment: CanvasComment = {
      id: createLocalCommentId(),
      text,
      status: 'syncing',
      authorName: '我',
      createdAt: Date.now(),
    }
    const pendingComments = [localComment, ...readPendingComments(projectId)]
    writePendingComments(projectId, pendingComments)
    setComments((current) => mergeComments(current, [localComment]))

    try {
      const savedComment = await postCanvasComment(localComment)
      const nextPending = readPendingComments(projectId).filter((comment) => comment.id !== localComment.id)
      writePendingComments(projectId, nextPending)
      setComments((current) => {
        const nextComments = [savedComment, ...current.filter((comment) => comment.id !== localComment.id && comment.id !== savedComment.id)]
          .sort((left, right) => right.createdAt - left.createdAt)
        writeCommentsCache(projectId, nextComments.filter((comment) => !isPendingCanvasComment(comment)))
        return nextComments
      })
      showCanvasFeedback('评论已保存。')
      return true
    } catch (error) {
      const pendingComment = { ...localComment, status: 'pending' }
      writePendingComments(projectId, readPendingComments(projectId).map((comment) => (
        comment.id === localComment.id ? pendingComment : comment
      )))
      setComments((current) => current.map((comment) => (
        comment.id === localComment.id ? pendingComment : comment
      )))
      const detail = error instanceof Error ? error.message : '网络请求失败'
      const message = `评论已保存到本地，网络恢复后可重试同步。${detail ? `（${detail}）` : ''}`
      setCommentsError(message)
      showCanvasFeedback(message)
      return true
    }
  }, [mergeComments, postCanvasComment, projectId, readPendingComments, showCanvasFeedback, writeCommentsCache, writePendingComments])

  const retryPendingComments = useCallback(async () => {
    if (!projectId) return
    const pendingComments = readPendingComments(projectId)
    if (!pendingComments.length) return
    setCommentsSyncing(true)
    setCommentsError('')
    setComments((current) => current.map((comment) => (
      isPendingCanvasComment(comment) ? { ...comment, status: 'syncing' } : comment
    )))
    const remaining: CanvasComment[] = []
    const saved: CanvasComment[] = []
    for (const comment of pendingComments) {
      try {
        saved.push(await postCanvasComment({ ...comment, status: 'syncing' }))
      } catch {
        remaining.push({ ...comment, status: 'pending' })
      }
    }
    writePendingComments(projectId, remaining)
    setComments((current) => {
      const savedSourceIds = new Set(pendingComments.map((comment) => comment.id))
      const savedIds = new Set(saved.map((comment) => comment.id))
      const nextComments = [...saved, ...remaining, ...current.filter((comment) => !savedSourceIds.has(comment.id) && !savedIds.has(comment.id))]
        .sort((left, right) => right.createdAt - left.createdAt)
      writeCommentsCache(projectId, nextComments.filter((comment) => !isPendingCanvasComment(comment)))
      return nextComments
    })
    if (remaining.length) {
      setCommentsError('部分评论仍未同步，已继续保存在本地。')
      showCanvasFeedback('部分评论仍未同步，已继续保存在本地。')
    } else {
      setCommentsError('')
      showCanvasFeedback('待同步评论已保存。')
    }
    setCommentsSyncing(false)
  }, [postCanvasComment, projectId, readPendingComments, showCanvasFeedback, writeCommentsCache, writePendingComments])

  useEffect(() => {
    if (!commentsEnabled) return
    void loadCanvasComments()
  }, [commentsEnabled, loadCanvasComments])

  const handleSelectHistoryItem = useCallback((item: CanvasHistoryItem) => {
    setSelectedHistoryId(item.id)
    if (item.id.startsWith('history-')) {
      const kind = item.type === 'video' ? 'video' : item.type === 'world' ? 'world' : 'image'
      const node = createNode(kind, {
        title: item.title,
        prompt: `${item.title} · 从历史记录恢复，可继续作为当前画布节点使用。`,
        model: NODE_META[kind].model,
        ratio: NODE_META[kind].ratio,
        status: 'done',
      })
      handleNodePatch(node.id, {
        resultPreview: item.detail,
        outputLabel: '历史记录已恢复',
      })
    }
    showCanvasFeedback(`${item.title} · ${item.detail}`)
  }, [createNode, handleNodePatch, showCanvasFeedback])

  const handleApplyImageEdit = useCallback((action: string) => {
    setAppliedImageEdit(action)
    const targetKind: VisualCanvasNodeKind = action === '涂鸦生视频' ? 'video' : 'image'
    const shouldCreateNode = action !== '图片编辑器节点' || activeNode?.kind !== 'image'
    const targetNode = shouldCreateNode
      ? createNode(targetKind, {
        title: action,
        prompt: `${action} · 根据当前参考图/草图生成可继续编辑的${targetKind === 'video' ? '视频镜头' : '图片结果'}。`,
        model: NODE_META[targetKind].model,
        ratio: NODE_META[targetKind].ratio,
        status: 'done',
      })
      : activeNode
    if (targetNode) {
      handleNodePatch(targetNode.id, {
        resultPreview: `${action} 已创建可用节点，可继续接下游节点生成。`,
        outputLabel: `${action} 已应用`,
        status: 'done',
      })
    }
    if (activeNode?.kind === 'image') {
      handleNodePatch(activeNode.id, {
        resultPreview: `图片编辑器 · ${action} · 已应用编辑效果。`,
        outputLabel: `已应用编辑效果。`,
        status: 'done',
      })
    }
    showCanvasFeedback(`${action} 已执行，节点已加入画布。`)
  }, [activeNode, createNode, handleNodePatch, showCanvasFeedback])

  const handleNodeDialogGenerate = useCallback(() => {
    if (!editingNode) return

    const nodeSnapshot = editingNode
    const nodeType = getProviderNodeType(nodeSnapshot.kind)
    const trimmedPrompt = canvasPrompt.trim()
    const currentMetadata = metadataRecord(nodeSnapshot.metadataJson)
    const currentTaskId = typeof currentMetadata.taskId === 'string'
      ? currentMetadata.taskId
      : typeof currentMetadata.generationJobId === 'string'
        ? currentMetadata.generationJobId
        : ''
    const currentGenerationJobId = typeof currentMetadata.generationJobId === 'string'
      ? currentMetadata.generationJobId
      : ''
    const selectedVideoStatusForGenerate = nodeSnapshot.kind === 'video'
      ? getVideoProviderStatus(videoProviderStatusMap, normalizedPromptModel, liveStatusMap, liveStatusLoading)
      : null
    const selectedImageStatusForGenerate = nodeSnapshot.kind === 'image'
      ? getImageProviderStatus(imageProviderStatusMap, normalizedPromptModel, liveStatusMap, liveStatusLoading)
      : null
    const generationProviderId = nodeSnapshot.kind === 'image' && selectedImageStatusForGenerate !== 'available' && defaultImageProviderId
      ? defaultImageProviderId
      : nodeSnapshot.kind === 'video' && selectedVideoStatusForGenerate !== 'available' && defaultVideoProviderId
        ? defaultVideoProviderId
        : normalizedPromptModel
    if ((nodeSnapshot.kind === 'image' || nodeSnapshot.kind === 'video') && (activeGenerationNodeIdsRef.current.has(nodeSnapshot.id) || isActiveGenerationStatus(nodeSnapshot.status))) {
      const errMsg = 'generation_already_running: 该节点已有生成任务在运行。请先点击"停止所有生成"，再重新生成。'
      handleNodePatch(nodeSnapshot.id, {
        errorMessage: errMsg,
        metadataJson: {
          ...metadataRecord(nodeSnapshot.metadataJson),
          errorCode: 'generation_already_running',
          errorStage: 'client_duplicate_guard',
          errorMessage: errMsg,
          generationJobId: currentGenerationJobId || stringValue(currentMetadata.generationJobId),
        },
      })
      setDialogError(errMsg)
      showCanvasFeedback(errMsg)
      return
    }
    // Guard: queued nodes cannot re-POST (they are already waiting for a job)
    if ((nodeSnapshot.kind === 'image' || nodeSnapshot.kind === 'video') && nodeSnapshot.status === 'queued') {
      const errMsg = 'generation_already_running: 该节点已在队列中，请等待任务完成，或点击"停止所有生成"后重试。'
      setDialogError(errMsg)
      showCanvasFeedback(errMsg)
      return
    }
    // Guard: running node without a trackable jobId cannot safely re-POST
    if ((nodeSnapshot.kind === 'image' || nodeSnapshot.kind === 'video') && nodeSnapshot.status === 'running' && !currentGenerationJobId) {
      const errMsg = 'generation_already_running: 该节点正在运行但缺少任务 ID，点击"停止所有生成"后重试。'
      handleNodePatch(nodeSnapshot.id, {
        status: 'error',
        errorMessage: errMsg,
        metadataJson: {
          ...metadataRecord(nodeSnapshot.metadataJson),
          errorCode: 'generation_already_running',
          errorMessage: errMsg,
          loading: false,
          isRegenerating: false,
          regenerating: false,
        },
      })
      setDialogError(errMsg)
      showCanvasFeedback(errMsg)
      return
    }
    if (nodeSnapshot.kind === 'image' && nodeSnapshot.status === 'running' && currentGenerationJobId) {
      setDialogError(null)
      showCanvasFeedback('正在查询图片任务状态...')
      void pollImageGenerationTask(generationProviderId, currentGenerationJobId).then((statusResult) => {
        if (statusResult.status === 'running') {
          handleNodePatch(nodeSnapshot.id, {
            status: 'running',
            resultPreview: '图片生成中，请稍后再查。',
            outputLabel: '图片生成中',
            metadataJson: imageRunningMetadata(nodeSnapshot, statusResult, generationProviderId),
          })
          showCanvasFeedback('图片生成中，请稍后再查。')
          return
        }
        if (!statusResult.success || statusResult.status === 'failed') {
          const errMsg = formatGenerateError(statusResult)
          handleNodePatch(nodeSnapshot.id, {
            status: 'error',
            errorMessage: errMsg,
            resultPreview: nodeSnapshot.resultPreview ?? '图片任务失败',
            outputLabel: '图片任务失败',
            metadataJson: imageErrorMetadata(nodeSnapshot, statusResult, generationProviderId),
          })
          setDialogError(errMsg)
          showCanvasFeedback(errMsg)
          return
        }
        const imageUrl = statusResult.result?.imageUrl ?? statusResult.resultImageUrl ?? statusResult.imageUrl ?? statusResult.stableUrl
        if (!imageUrl) {
          const errMsg = 'IMAGE_GENERATION_EMPTY: 图片任务已完成，但未返回图片 URL。'
          handleNodePatch(nodeSnapshot.id, {
            status: 'error',
            errorMessage: errMsg,
            resultPreview: nodeSnapshot.resultPreview ?? '图片任务未返回 URL',
            outputLabel: '图片任务未返回 URL',
          })
          setDialogError(errMsg)
          showCanvasFeedback(errMsg)
          return
        }
        const metadataJson = imageSuccessMetadata(nodeSnapshot, statusResult, generationProviderId)
        handleNodePatch(nodeSnapshot.id, {
          status: 'done',
          resultImageUrl: imageUrl,
          resultPreview: '图片已生成',
          outputLabel: '图片已生成',
          errorMessage: undefined,
          metadataJson,
        })
        if (!statusResult.asset?.id && !statusResult.assetId) {
          void createGeneratedAsset({
            nodeId: nodeSnapshot.id,
            type: 'image',
            title: `${nodeSnapshot.title} 图片结果`,
            url: imageUrl,
            providerId: generationProviderId,
            generationJobId: currentGenerationJobId,
            metadataJson,
          })
        }
        commitEdges((current) => current.map((edge) => (
          edge.toNodeId === nodeSnapshot.id || edge.fromNodeId === nodeSnapshot.id ? { ...edge, status: 'done' } : edge
        )))
        showCanvasFeedback('图片生成完成')
      })
      return
    }
    if (nodeSnapshot.kind === 'video' && nodeSnapshot.status === 'running' && currentGenerationJobId) {
      setDialogError(null)
      showCanvasFeedback('正在查询视频任务状态...')
      void pollVideoGenerationTask(generationProviderId, currentGenerationJobId).then((statusResult) => {
        if (statusResult.status === 'running') {
          handleNodePatch(nodeSnapshot.id, {
            status: 'running',
            resultPreview: '视频生成中，请稍后再查。',
            outputLabel: '视频生成中',
            metadataJson: {
              ...metadataRecord(nodeSnapshot.metadataJson),
              providerId: statusResult.providerId || generationProviderId,
              model: statusResult.model ?? currentMetadata.model,
              taskId: currentTaskId,
              generationJobId: currentGenerationJobId,
            },
          })
          showCanvasFeedback('视频生成中，请稍后再查。')
          return
        }
        if (!statusResult.success || statusResult.status === 'failed') {
          const errMsg = formatGenerateError(statusResult)
          handleNodePatch(nodeSnapshot.id, {
            status: 'error',
            errorMessage: errMsg,
            resultPreview: nodeSnapshot.resultPreview ?? '视频任务失败',
            outputLabel: '视频任务失败',
            metadataJson: videoErrorMetadata(nodeSnapshot, { ...statusResult, taskId: currentTaskId }, generationProviderId),
          })
          setDialogError(errMsg)
          showCanvasFeedback(errMsg)
          return
        }
        const videoUrl = statusResult.resultVideoUrl ?? statusResult.videoUrl ?? statusResult.result?.videoUrl
        if (!videoUrl) {
          const errMsg = 'VOLCENGINE_SEEDANCE_VIDEO_EMPTY: 视频任务已完成，但未返回视频 URL。'
          handleNodePatch(nodeSnapshot.id, {
            status: 'error', errorMessage: errMsg,
            resultPreview: nodeSnapshot.resultPreview ?? '视频任务未返回 URL',
            outputLabel: '视频任务未返回 URL',
          })
          setDialogError(errMsg)
          showCanvasFeedback(errMsg)
          return
        }
        const metadataJson = {
          ...metadataRecord(nodeSnapshot.metadataJson),
          ...videoSuccessMetadata(nodeSnapshot, { ...statusResult, taskId: currentTaskId, generationJobId: currentGenerationJobId, resultVideoUrl: videoUrl, videoUrl }, generationProviderId),
        }
        handleNodePatch(nodeSnapshot.id, {
          status: 'done', resultVideoUrl: videoUrl, resultPreview: '视频已生成', outputLabel: '视频已生成', errorMessage: undefined,
          metadataJson,
          preview: { type: 'remote-video', url: videoUrl, poster: videoUrl, licenseType: 'original', attribution: 'Generated by Volcengine Seedance' },
        })
        commitEdges((current) => current.map((edge) => (
          edge.toNodeId === nodeSnapshot.id || edge.fromNodeId === nodeSnapshot.id ? { ...edge, status: 'done' } : edge
        )))
        showCanvasFeedback('视频生成完成')
      })
      return
    }

    const incomingEdges = edges.filter((edge) => edge.toNodeId === nodeSnapshot.id)
    const upstreamNodes = incomingEdges
      .map((edge) => nodes.find((node) => node.id === edge.fromNodeId))
      .filter((node): node is VisualCanvasNode => Boolean(node))
    const upstreamTextPrompt = nodeSnapshot.kind === 'image' || nodeSnapshot.kind === 'video'
      ? upstreamNodes
          .map((node) => node.resultText)
          .filter((value): value is string => Boolean(value?.trim()))
          .join('\n\n')
          .trim()
      : ''
    const rawPrompt = trimmedPrompt || upstreamTextPrompt
    const bibleContext = buildBiblePromptContext({ characterBible, sceneBible, styleBible })
    // Read per-node camera/lighting — avoids cross-node contamination from global state
    const nodeCamera = projectId ? loadCameraSettingsForNode(projectId, nodeSnapshot.id) : cameraSettings
    const nodeLighting = projectId ? loadSceneLightingForNode(projectId, nodeSnapshot.id) : sceneLightingSettings
    const cameraContext = buildCameraPromptContext(nodeCamera)
    const lightingContext = buildSceneLightingPromptContext(nodeLighting)
    const generationPrompt = appendSceneLightingContextToPrompt(appendCameraContextToPrompt(appendBibleContextToPrompt(rawPrompt, bibleContext), cameraContext), lightingContext)
    const upstreamImageAssets = upstreamNodes
      .flatMap((upstreamNode) => {
        const imageUrl = getNodeImageUrl(upstreamNode) || upstreamNode.resultImageUrl
        if (!imageUrl || !isProviderAccessibleUrl(imageUrl)) return []
        return [{ id: upstreamNode.id, type: 'image', url: imageUrl }]
      })
    if (!generationPrompt && !(nodeSnapshot.kind === 'video' && upstreamImageAssets.length > 0)) {
      const errMsg = nodeSnapshot.kind === 'image'
        ? '请先输入图片 prompt，或连接一个已有文本结果的 Text 节点。'
        : nodeSnapshot.kind === 'video'
          ? '请先输入视频 prompt，或连接一个已有 Text/Image 结果的上游节点。'
        : '请先输入 prompt 再生成。'
      setDialogError(errMsg)
      return
    }

    const generationContextMissing = nodeSnapshot.kind === 'image' || nodeSnapshot.kind === 'video'
      ? [
          ...(!projectId ? ['projectId'] : []),
          ...(!nodeSnapshot.id ? ['nodeId'] : []),
          ...(!generationPrompt.trim() ? ['prompt'] : []),
        ]
      : []
    if (generationContextMissing.length) {
      const result: GenerateApiResult = {
        success: false,
        providerId: generationProviderId,
        mode: 'unavailable',
        status: 'failed',
        errorCode: 'missing_generation_input',
        message: `缺少生成必要字段：${generationContextMissing.join(', ')}。`,
        missingFields: generationContextMissing,
        submittedInput: {
          projectId,
          workflowId,
          nodeId: nodeSnapshot.id,
          kind: nodeSnapshot.kind,
          promptChars: generationPrompt.length,
        },
      }
      const errMsg = formatGenerateError(result)
      handleNodePatch(nodeSnapshot.id, {
        status: 'error',
        errorMessage: errMsg,
        resultPreview: nodeSnapshot.kind === 'image' ? '图片生成失败' : '视频生成失败',
        outputLabel: nodeSnapshot.kind === 'image' ? '图片生成失败' : '视频生成失败',
        metadataJson: nodeSnapshot.kind === 'image'
          ? imageErrorMetadata(nodeSnapshot, result, generationProviderId)
          : videoErrorMetadata(nodeSnapshot, result, generationProviderId),
      })
      setDialogError(errMsg)
      showCanvasFeedback(errMsg)
      return
    }

    // Validate provider supports this node type
    const providerEntry = getToolProviderById(generationProviderId)
    if (providerEntry && !providerEntry.nodeTypes.includes(nodeType)) {
      const supportedTypes = providerEntry.nodeTypes.join(' / ')
      const errMsg = `${providerEntry.name} 仅支持 ${supportedTypes} 节点，当前节点类型为 ${nodeType}。请切换到对应节点后重试。`
      setDialogError(errMsg)
      showCanvasFeedback(errMsg)
      return
    }
    if (nodeSnapshot.kind === 'image') {
      const selectedProviderInfo = imageProviderStatusMap.get(generationProviderId)
      const selectedProviderStatus = getImageProviderStatus(imageProviderStatusMap, generationProviderId, liveStatusMap, liveStatusLoading)
      // Only block when the server has explicitly told us this provider is unavailable.
      // 'unknown' / 'checking' means the status map hasn't loaded yet — let the API validate instead.
      const definitivelyUnavailable = (selectedProviderStatus === 'not-configured' || selectedProviderStatus === 'coming-soon' || selectedProviderStatus === 'disabled') && imageProviderStatusMap.size > 0
      if (definitivelyUnavailable) {
        const errMsg = imageProviderUnavailableMessage(generationProviderId, selectedProviderInfo)
        const missingEnv = selectedProviderInfo?.missingEnvKeys?.length ? selectedProviderInfo.missingEnvKeys : selectedProviderInfo?.missingEnv
        const result: GenerateApiResult = {
          success: false,
          providerId: generationProviderId,
          mode: 'unavailable',
          status: 'not-configured',
          errorCode: 'generation_post_not_sent',
          message: errMsg,
          missingEnv,
          missingEnvKeys: missingEnv,
        }
        setDialogError(errMsg)
        handleNodePatch(nodeSnapshot.id, {
          status: 'error',
          errorMessage: errMsg,
          resultPreview: '请先选择并配置可用图片 Provider。',
          outputLabel: '图片 Provider 未配置',
          metadataJson: imageErrorMetadata(nodeSnapshot, result, generationProviderId),
        })
        showCanvasFeedback(errMsg)
        return
      }
    }
    if (nodeSnapshot.kind === 'video') {
      const selectedProviderInfo = videoProviderStatusMap.get(generationProviderId)
      const selectedProviderStatus = getVideoProviderStatus(videoProviderStatusMap, generationProviderId, liveStatusMap, liveStatusLoading)
      // Only block when the server has explicitly told us this provider is unavailable.
      // 'unknown' / 'checking' means the status map hasn't loaded yet — let the API validate instead.
      const definitivelyUnavailable = (selectedProviderStatus === 'not-configured' || selectedProviderStatus === 'coming-soon' || selectedProviderStatus === 'disabled') && videoProviderStatusMap.size > 0
      if (definitivelyUnavailable) {
        const errMsg = videoProviderUnavailableMessage(selectedProviderInfo)
        const missingEnv = selectedProviderInfo?.missingEnvKeys?.length ? selectedProviderInfo.missingEnvKeys : selectedProviderInfo?.missingEnv
        const result: GenerateApiResult = {
          success: false,
          providerId: generationProviderId,
          mode: 'unavailable',
          status: 'not-configured',
          errorCode: 'PROVIDER_NOT_CONFIGURED',
          message: errMsg,
          missingEnv,
          missingEnvKeys: missingEnv,
        }
        setDialogError(errMsg)
        handleNodePatch(nodeSnapshot.id, {
          status: 'error',
          errorMessage: errMsg,
          resultPreview: '请先选择并配置可用视频 Provider。',
          outputLabel: '视频 Provider 未配置',
          metadataJson: videoErrorMetadata(nodeSnapshot, result, generationProviderId),
        })
        showCanvasFeedback(errMsg)
        return
      }
    }

    const generationNodeSnapshot: VisualCanvasNode = {
      ...nodeSnapshot,
      metadataJson: nodeSnapshot.metadataJson,
    }

    const generationController = nodeSnapshot.kind === 'image' || nodeSnapshot.kind === 'video'
      ? beginNodeGeneration(nodeSnapshot.id)
      : null
    if ((nodeSnapshot.kind === 'image' || nodeSnapshot.kind === 'video') && !generationController) {
      const errMsg = 'generation_already_running: 该节点已有生成任务在运行。请先点击"停止所有生成"，再重新生成。'
      setDialogError(errMsg)
      showCanvasFeedback(errMsg)
      return
    }

    // Guard: user_provider_account mode requires a selected account
    if ((nodeType === 'text' || nodeType === 'image') && billingMode === 'user_provider_account' && !selectedUserAccountId) {
      setDialogError('请先选择一个 API 账户。')
      return
    }
    // Guard: image BYOK requires endpointId to be configured in the account
    if (nodeType === 'image' && billingMode === 'user_provider_account' && selectedUserAccountId) {
      const selectedAccount = userProviderAccounts.find((a) => a.id === selectedUserAccountId)
      if (!selectedAccount?.fieldMeta?.endpointId) {
        setDialogError('缺少 Endpoint ID，请到我的 API 账户补充火山方舟 Endpoint ID。')
        return
      }
    }

    setDialogError(null)
    handleNodePatch(editingNode.id, {
      prompt: trimmedPrompt,
      model: generationProviderId,
      providerId: generationProviderId,
      stage: promptStage,
      ratio: editingNode.ratio ? promptRatio : editingNode.ratio,
      status: 'generating',
      errorMessage: undefined,
      metadataJson: nodeSnapshot.metadataJson,
    })

    // Resolve upstream image for image-to-video workflow
    const videoImageResolution = nodeSnapshot.kind === 'video'
      ? resolveImageInputForVideoNode({ videoNode: nodeSnapshot, allNodes: nodes, edges })
      : null
    // Fall back to local uploaded reference if no upstream edge image
    const videoLocalRefImageUrl = nodeSnapshot.kind === 'video' && !videoImageResolution?.imageUrl
      ? (dialogLocalRefs.find((r) => r.status === 'done' && r.mediaUrl && isProviderAccessibleUrl(r.mediaUrl))?.mediaUrl ?? null)
      : null

    void callGenerationApi(
      nodeType,
      generationProviderId,
      generationPrompt,
      nodeSnapshot.kind === 'video'
        ? {
            ratio: promptRatio,
            duration: 5,
            ...((videoImageResolution?.imageUrl ?? videoLocalRefImageUrl)
              ? { imageUrl: (videoImageResolution?.imageUrl ?? videoLocalRefImageUrl)! }
              : {}),
          }
        : { ratio: promptRatio },
      nodeSnapshot.id,
      nodeSnapshot.kind === 'image' || nodeSnapshot.kind === 'video' ? [] : upstreamImageAssets.length > 0 ? upstreamImageAssets : undefined,
      nodeType === 'image' || nodeType === 'video' ? projectId : undefined,
      nodeType === 'image' || nodeType === 'video' ? workflowId : undefined,
      undefined,
      generationProviderId,
      generationController?.signal,
      (nodeType === 'text' || nodeType === 'image') ? billingMode : undefined,
      (nodeType === 'text' || nodeType === 'image') && billingMode === 'user_provider_account' ? selectedUserAccountId : undefined,
    ).then(async (result) => {
      if (generationController?.signal.aborted) return
      if (nodeSnapshot.kind === 'image' && result.success && (result.status === 'running' || result.status === 'queued') && !(result.generationJobId || result.jobId)) {
        const errMsg = 'missing_generation_job_id: 任务已提交但未返回任务 ID，无法追踪进度。'
        handleNodePatch(nodeSnapshot.id, {
          status: 'failed',
          errorMessage: errMsg,
          resultPreview: '任务 ID 缺失',
          outputLabel: '任务 ID 缺失',
          metadataJson: imageErrorMetadata(generationNodeSnapshot, { ...result, errorCode: 'missing_generation_job_id' }, generationProviderId),
        })
        setDialogError(errMsg)
        showCanvasFeedback(errMsg)
        return
      }
      if (nodeSnapshot.kind === 'image' && (result.status === 'running' || result.status === 'queued') && (result.generationJobId || result.jobId)) {
        const generationJobId = result.generationJobId ?? result.jobId!
        const taskId = result.taskId ?? generationJobId
        handleNodePatch(nodeSnapshot.id, {
          status: 'running',
          resultPreview: '图片生成中',
          outputLabel: '图片生成中',
          errorMessage: undefined,
          metadataJson: imageRunningMetadata(generationNodeSnapshot, { ...result, generationJobId, taskId }, generationProviderId),
        })
        showCanvasFeedback('图片生成中')
        let polls = 0
        while (polls < 12) {
          await delay(5000, generationController?.signal)
          const statusResult = await pollImageGenerationTask(generationProviderId, generationJobId, generationController?.signal)
          result = {
            ...statusResult,
            generationJobId,
            jobId: statusResult.jobId ?? generationJobId,
            taskId: statusResult.taskId ?? taskId,
          }
          if (!statusResult.success || !isActiveGenerationStatus(statusResult.status)) break
          handleNodePatch(nodeSnapshot.id, {
            status: 'running',
            resultPreview: `图片生成中，已查询 ${polls + 1} 次`,
            outputLabel: '图片生成中',
            metadataJson: imageRunningMetadata(generationNodeSnapshot, result, generationProviderId),
          })
          polls += 1
        }
        if (result.success && isActiveGenerationStatus(result.status)) {
          const errMsg = '图片生成超时：轮询 12 次未完成，请手动点击"重试"检查任务状态。'
          handleNodePatch(nodeSnapshot.id, {
            status: 'failed',
            errorMessage: errMsg,
            resultPreview: '生成超时',
            outputLabel: '生成超时',
            metadataJson: imageErrorMetadata(generationNodeSnapshot, { ...result, errorCode: 'generation_polling_timeout' }, generationProviderId),
          })
          setDialogError(errMsg)
          showCanvasFeedback(errMsg)
          return
        }
      }

      if (nodeSnapshot.kind === 'video' && (result.status === 'running' || result.status === 'queued') && (result.generationJobId || result.jobId)) {
        const generationJobId = result.generationJobId ?? result.jobId!
        const taskId = result.taskId ?? generationJobId
        const runningMeta = {
          ...videoSuccessMetadata(generationNodeSnapshot, { ...result, generationJobId, taskId }, generationProviderId),
          loading: true,
          isRegenerating: true,
          regenerating: true,
        }
        handleNodePatch(nodeSnapshot.id, {
          status: 'running',
          resultPreview: '视频任务已提交，正在生成中',
          outputLabel: '视频生成中',
          errorMessage: undefined,
          metadataJson: runningMeta,
        })
        showCanvasFeedback('视频任务已提交，正在生成中')
        let videoPolls = 0
        const videoStartMs = Date.now()
        while (videoPolls < MAX_VIDEO_GENERATION_POLLS && !generationController?.signal.aborted) {
          await delay(5000, generationController?.signal)
          const statusResult = await pollVideoGenerationTask(generationProviderId, generationJobId, generationController?.signal)
          videoPolls += 1
          if (statusResult.success && isActiveGenerationStatus(statusResult.status)) {
            const elapsedMs = Date.now() - videoStartMs
            const elapsedMin = Math.floor(elapsedMs / 60000)
            const waitingPreview = elapsedMs > 8 * 60 * 1000
              ? `仍在等待 provider 返回结果（已等待约 ${elapsedMin} 分钟）。若后台最终失败，会显示具体错误。`
              : elapsedMs > 2 * 60 * 1000
                ? `视频仍在生成中（已等待约 ${elapsedMin} 分钟）。Seedance 图生视频可能需要较长时间，请保持页面打开。`
                : `视频生成中，已查询 ${videoPolls} 次`
            handleNodePatch(nodeSnapshot.id, {
              status: 'running',
              resultPreview: waitingPreview,
              outputLabel: '视频生成中',
              metadataJson: {
                ...videoSuccessMetadata(generationNodeSnapshot, { ...statusResult, generationJobId, taskId }, generationProviderId),
                loading: true, isRegenerating: true, regenerating: true,
              },
            })
            continue
          }
          if (!statusResult.success || statusResult.status === 'failed') {
            const errMsg = formatGenerateError(statusResult)
            handleNodePatch(nodeSnapshot.id, {
              status: 'error',
              errorMessage: errMsg,
              resultPreview: nodeSnapshot.resultPreview ?? '视频任务失败',
              outputLabel: '视频任务失败',
              metadataJson: videoErrorMetadata(generationNodeSnapshot, { ...statusResult, taskId }, generationProviderId),
            })
            setDialogError(errMsg)
            showCanvasFeedback(errMsg)
            return
          }
          const videoUrl = statusResult.resultVideoUrl ?? statusResult.videoUrl ?? statusResult.result?.videoUrl
          if (!videoUrl) {
            const errMsg = 'VOLCENGINE_SEEDANCE_VIDEO_EMPTY: 视频任务已完成，但未返回视频 URL。'
            handleNodePatch(nodeSnapshot.id, { status: 'error', errorMessage: errMsg, resultPreview: nodeSnapshot.resultPreview ?? '未返回 URL', outputLabel: '未返回 URL' })
            setDialogError(errMsg)
            showCanvasFeedback(errMsg)
            return
          }
          const successMeta = videoSuccessMetadata(generationNodeSnapshot, { ...statusResult, generationJobId, taskId, resultVideoUrl: videoUrl, videoUrl }, generationProviderId)
          handleNodePatch(nodeSnapshot.id, {
            status: 'done', resultVideoUrl: videoUrl, resultPreview: '视频已生成', outputLabel: '视频已生成', errorMessage: undefined,
            metadataJson: successMeta,
            preview: { type: 'remote-video', url: videoUrl, poster: videoUrl, licenseType: 'original', attribution: 'Generated by Volcengine Seedance' },
          })
          commitEdges((current) => current.map((edge) => (
            edge.toNodeId === nodeSnapshot.id || edge.fromNodeId === nodeSnapshot.id ? { ...edge, status: 'done' } : edge
          )))
          showCanvasFeedback('视频生成完成')
          return
        }
        // Loop exited: either cap reached or abort signal fired.
        if (videoPolls >= MAX_VIDEO_GENERATION_POLLS && !generationController?.signal.aborted) {
          const timeoutMsg = `视频生成轮询超时（已查询 ${MAX_VIDEO_GENERATION_POLLS} 次），任务可能仍在后台运行，请前往资产库（/assets）检查生成结果。`
          handleNodePatch(nodeSnapshot.id, {
            status: 'failed',
            errorMessage: timeoutMsg,
            resultPreview: '生成超时',
            outputLabel: '生成超时',
            metadataJson: videoErrorMetadata(generationNodeSnapshot, {
              ...result,
              errorCode: 'generation_polling_timeout',
              message: timeoutMsg,
            }, generationProviderId),
          })
          setDialogError(timeoutMsg)
          showCanvasFeedback(timeoutMsg)
        }
        return
      }

      if (generationController?.signal.aborted) return

      // Async job queued (e.g. Runway): poll until done or failed
      if ((result.status === 'queued' || result.status === 'running') && result.jobId) {
        const queuingPreview = `${result.providerId} · 生成中，请稍候…`
        handleNodePatch(nodeSnapshot.id, {
          resultPreview: queuingPreview,
          outputLabel: result.message,
        })
        const maxPolls = nodeSnapshot.kind === 'image' || nodeSnapshot.kind === 'video' ? 12 : 60
        let polls = 0
        while (polls < maxPolls && result.jobId) {
          await delay(5000, generationController?.signal)
          const jobResult = await pollGenerationJob(result.jobId, generationController?.signal)
          polls += 1
          if (isActiveGenerationStatus(jobResult.status)) {
            handleNodePatch(nodeSnapshot.id, { resultPreview: jobResult.result?.text?.slice(0, 200) ?? queuingPreview })
            continue
          }
          const jobFallback = buildResultLabel(nodeSnapshot.title)
          if (!jobResult.success) {
            if (jobResult.errorCode === 'INSUFFICIENT_CREDITS') {
              const byokMsg = '平台积分生成暂未对外开放。请切换至「我的 API 账户」并前往 /account/providers 添加你的 API Key。'
              handleNodePatch(nodeSnapshot.id, { status: 'error', errorMessage: byokMsg })
              setDialogError(byokMsg)
              return
            }
            const errMsg = formatGenerateError(jobResult)
            handleNodePatch(nodeSnapshot.id, {
              status: 'error',
              errorMessage: errMsg,
              resultPreview: jobFallback,
              outputLabel: jobFallback,
              ...(nodeSnapshot.kind === 'text' ? { metadataJson: textErrorMetadata(generationNodeSnapshot, jobResult) } : {}),
              ...(nodeSnapshot.kind === 'image' ? { metadataJson: imageErrorMetadata(generationNodeSnapshot, jobResult, generationProviderId) } : {}),
              ...(nodeSnapshot.kind === 'video' ? { metadataJson: videoErrorMetadata(generationNodeSnapshot, jobResult, generationProviderId) } : {}),
            })
            if (jobResult.status === 'not-configured' || jobResult.errorCode === 'PROVIDER_NOT_CONFIGURED') {
              showCanvasFeedback('该模型 API 未配置，请到 /tools 配置 provider。')
            } else {
              showCanvasFeedback(errMsg)
            }
            setDialogError(errMsg)
            return
          }
          const jobResultText = getGeneratedText(jobResult)
          handleNodePatch(nodeSnapshot.id, {
            status: 'done',
            resultText: jobResultText,
            resultPreview: jobResultText?.slice(0, 200) ?? jobFallback,
            outputLabel: jobFallback,
            resultVideoUrl: jobResult.result?.videoUrl ?? nodeSnapshot.resultVideoUrl,
            ...(nodeSnapshot.kind === 'video'
              ? {
                  assetId: jobResult.asset?.id ?? jobResult.assetId ?? getNodeAssetId({
                    ...generationNodeSnapshot,
                    metadataJson: videoSuccessMetadata(generationNodeSnapshot, jobResult, generationProviderId),
                  }),
                }
              : {}),
            errorMessage: undefined,
            ...(nodeSnapshot.kind === 'text' ? { metadataJson: textSuccessMetadata(generationNodeSnapshot, jobResult, normalizedPromptModel) } : {}),
            preview: jobResult.result?.videoUrl
              ? { type: 'remote-video', url: jobResult.result.videoUrl, poster: jobResult.result.previewUrl, licenseType: 'original', attribution: 'Generated by configured video provider' }
              : nodeSnapshot.preview,
          })
          if (jobResultText) {
            void createGeneratedAsset({
              nodeId: nodeSnapshot.id,
              type: 'text',
              title: `${nodeSnapshot.title} 文本结果`,
              providerId: generationProviderId,
              generationJobId: result.jobId,
              metadataJson: { resultText: jobResultText.slice(0, 500) },
            })
          }
          if (jobResult.result?.videoUrl) {
            void createGeneratedAsset({
              nodeId: nodeSnapshot.id,
              type: 'video',
              title: `${nodeSnapshot.title} 视频结果`,
              url: jobResult.result.videoUrl,
              providerId: generationProviderId,
              generationJobId: result.jobId,
            })
          }
          commitEdges((current) => current.map((edge) => (
            edge.toNodeId === nodeSnapshot.id || edge.fromNodeId === nodeSnapshot.id ? { ...edge, status: 'done' } : edge
          )))
          return
        }
        const timeoutMessage = `${nodeSnapshot.kind === 'video' ? '视频' : nodeSnapshot.kind === 'image' ? '图片' : '节点'}生成超时：轮询 ${maxPolls} 次未完成，请手动检查任务状态。`
        handleNodePatch(nodeSnapshot.id, {
          status: 'failed',
          errorMessage: timeoutMessage,
          resultPreview: '生成超时',
          outputLabel: '生成超时',
          ...(nodeSnapshot.kind === 'text' ? { metadataJson: textErrorMetadata(generationNodeSnapshot, { ...result, success: false, status: 'failed', errorCode: 'generation_polling_timeout', message: timeoutMessage }) } : {}),
          ...(nodeSnapshot.kind === 'image' ? { metadataJson: imageErrorMetadata(generationNodeSnapshot, { ...result, errorCode: 'generation_polling_timeout', message: timeoutMessage }, generationProviderId) } : {}),
          ...(nodeSnapshot.kind === 'video' ? { metadataJson: videoErrorMetadata(generationNodeSnapshot, { ...result, errorCode: 'generation_polling_timeout', message: timeoutMessage }, generationProviderId) } : {}),
        })
        setDialogError(timeoutMessage)
        showCanvasFeedback(timeoutMessage)
        return
      }

      if (generationController?.signal.aborted) return

      // Immediate result
      const fallbackPreview = generationPrompt ? buildMockResult(nodeSnapshot, generationPrompt) : buildResultLabel(nodeSnapshot.title)

      if (!result.success) {
        if (result.errorCode === 'INSUFFICIENT_CREDITS') {
          const byokMsg = '平台积分生成暂未对外开放。请切换至「我的 API 账户」并前往 /account/providers 添加你的 API Key。'
          handleNodePatch(nodeSnapshot.id, { status: 'error', errorMessage: byokMsg })
          setDialogError(byokMsg)
          return
        }
        const errMsg = formatGenerateError(result)
        handleNodePatch(nodeSnapshot.id, {
          status: 'error',
          errorMessage: errMsg,
          resultPreview: fallbackPreview,
          outputLabel: fallbackPreview,
          ...(nodeSnapshot.kind === 'text' ? { metadataJson: textErrorMetadata(generationNodeSnapshot, result) } : {}),
          ...(nodeSnapshot.kind === 'image' ? { metadataJson: imageErrorMetadata(generationNodeSnapshot, result, generationProviderId) } : {}),
          ...(nodeSnapshot.kind === 'video' ? { metadataJson: videoErrorMetadata(generationNodeSnapshot, result, generationProviderId) } : {}),
        })
        flushLocalSnapshot()
        // If generation failed due to DB unavailability, pre-arm the canvas save backoff so
        // the immediate scheduleCanvasSave(0) call below doesn't fire another PUT into an
        // already-exhausted DB pool before a canvas-save 503 has had a chance to set it.
        if (
          result.errorCode === 'GENERATION_AUTH_UNAVAILABLE' ||
          result.errorCode === 'DB_CONNECTION_UNAVAILABLE' ||
          result.errorCode === 'AUTH_DB_UNAVAILABLE'
        ) {
          saveBackoffUntilRef.current = Math.max(saveBackoffUntilRef.current, Date.now() + 10_000)
        }
        scheduleCanvasSave(0)
        setDialogError(errMsg)
        if (result.status === 'not-configured' || result.errorCode === 'PROVIDER_NOT_CONFIGURED') {
          showCanvasFeedback('该模型 API 未配置，请到 /tools 配置 provider。')
        } else {
          showCanvasFeedback(errMsg)
        }
        return
      }

      const resultText = getGeneratedText(result)
      const displayUrl = displayUrlFromGenerateResult(result)
      const resultImageUrl = result.result?.imageUrl ?? result.resultImageUrl ?? result.imageUrl ?? result.dataUrl ?? (nodeSnapshot.kind === 'image' ? displayUrl : undefined)
      const resultVideoUrl = result.result?.videoUrl ?? result.resultVideoUrl ?? result.videoUrl ?? (nodeSnapshot.kind === 'video' ? displayUrl : undefined)
      const generatedButPersistencePending = isPersistencePendingResult(result)
      const resultPreview = generatedButPersistencePending
        ? '已生成，资产库上传待重试'
        : resultText?.slice(0, 200) ?? (resultImageUrl ? '图片已生成' : resultVideoUrl ? '视频已生成' : fallbackPreview)
      const successMetadata = nodeSnapshot.kind === 'image'
        ? imageSuccessMetadata(generationNodeSnapshot, result, normalizedPromptModel)
        : nodeSnapshot.kind === 'video'
          ? videoSuccessMetadata(generationNodeSnapshot, result, generationProviderId)
          : undefined
      const generatedAssetId = successMetadata ? getNodeAssetId({ ...generationNodeSnapshot, metadataJson: successMetadata }) : undefined
      handleNodePatch(nodeSnapshot.id, {
        status: 'done',
        resultText,
        resultPreview,
        outputLabel: generatedButPersistencePending ? '已生成，资产库上传待重试' : resultText?.slice(0, 80) ?? fallbackPreview,
        resultImageUrl: resultImageUrl ?? nodeSnapshot.resultImageUrl,
        resultVideoUrl: resultVideoUrl ?? nodeSnapshot.resultVideoUrl,
        ...(generatedAssetId ? { assetId: generatedAssetId } : {}),
        errorMessage: undefined,
        ...(nodeSnapshot.kind === 'text' ? { metadataJson: textSuccessMetadata(generationNodeSnapshot, result, normalizedPromptModel) } : {}),
        ...(nodeSnapshot.kind === 'image' && successMetadata ? { metadataJson: successMetadata } : {}),
        ...(nodeSnapshot.kind === 'video' && successMetadata ? { metadataJson: successMetadata } : {}),
        preview: resultVideoUrl
          ? { type: 'remote-video', url: resultVideoUrl, poster: result.result?.previewUrl, licenseType: 'original', attribution: 'Generated by configured video provider' }
          : nodeSnapshot.preview,
      })
      if (resultText) {
        void createGeneratedAsset({
          nodeId: nodeSnapshot.id,
          type: 'text',
          title: `${nodeSnapshot.title} 文本结果`,
          providerId: generationProviderId,
          generationJobId: result.jobId,
          metadataJson: { resultText: resultText.slice(0, 500) },
        })
      }
      if (resultImageUrl && !result.asset?.id && !result.result?.metadata?.assetId) {
        void createGeneratedAsset({
          nodeId: nodeSnapshot.id,
          type: 'image',
          title: `${nodeSnapshot.title} 图片结果`,
          url: resultImageUrl,
          providerId: generationProviderId,
          generationJobId: result.jobId,
        })
      }
      if (resultVideoUrl && !result.asset?.id && !result.assetId) {
        void createGeneratedAsset({
          nodeId: nodeSnapshot.id,
          type: 'video',
          title: `${nodeSnapshot.title} 视频结果`,
          url: resultVideoUrl,
          providerId: generationProviderId,
          generationJobId: result.jobId,
        })
      }
      commitEdges((current) => current.map((edge) => (
        edge.toNodeId === nodeSnapshot.id || edge.fromNodeId === nodeSnapshot.id ? { ...edge, status: 'done' } : edge
      )))
      // Keep dialog open so user can see the result — they close it manually
    }).catch((error: unknown) => {
      if ((error as { name?: string }).name === 'AbortError' || generationController?.signal.aborted) return
      const result: GenerateApiResult = {
        success: false,
        providerId: generationProviderId,
        mode: 'unavailable',
        status: 'failed',
        errorCode: 'generation_failed',
        message: error instanceof Error ? error.message : '生成请求失败。',
      }
      const errMsg = formatGenerateError(result)
      handleNodePatch(nodeSnapshot.id, {
        status: 'failed',
        errorMessage: errMsg,
        resultPreview: nodeSnapshot.kind === 'image' ? '图片生成失败' : nodeSnapshot.kind === 'video' ? '视频生成失败' : '生成失败',
        outputLabel: nodeSnapshot.kind === 'image' ? '图片生成失败' : nodeSnapshot.kind === 'video' ? '视频生成失败' : '生成失败',
        ...(nodeSnapshot.kind === 'text' ? { metadataJson: textErrorMetadata(generationNodeSnapshot, result) } : {}),
        ...(nodeSnapshot.kind === 'image' ? { metadataJson: imageErrorMetadata(generationNodeSnapshot, result, generationProviderId) } : {}),
        ...(nodeSnapshot.kind === 'video' ? { metadataJson: videoErrorMetadata(generationNodeSnapshot, result, generationProviderId) } : {}),
      })
      flushLocalSnapshot()
      scheduleCanvasSave(0)
      setDialogError(errMsg)
      showCanvasFeedback(errMsg)
    }).finally(() => {
      if (generationController) finishNodeGeneration(nodeSnapshot.id, generationController)
    })
  }, [beginNodeGeneration, billingMode, buildResultLabel, cameraSettings, canvasPrompt, characterBible, commitEdges, createGeneratedAsset, defaultVideoProviderId, dialogLocalRefs, edges, editingNode, finishNodeGeneration, flushLocalSnapshot, handleNodePatch, imageProviderStatusMap, liveStatusLoading, liveStatusMap, nodes, normalizedPromptModel, projectId, promptParameter, promptRatio, promptStage, scheduleCanvasSave, sceneBible, sceneLightingSettings, selectedUserAccountId, setDialogError, showCanvasFeedback, styleBible, videoProviderStatusMap, workflowId])

  const handlePromptChange = useCallback((value: string) => {
    setCanvasPrompt(value)
    if (editingNode) {
      handleNodePatch(editingNode.id, { prompt: value })
    }
  }, [editingNode, handleNodePatch])

  const handleLexiconInsert = useCallback((fragment: string) => {
    const targetId = workflowContext?.targetNodeId ?? editingNode?.id
    if (!targetId) return
    const isEditing = editingNode?.id === targetId
    const base = isEditing ? canvasPrompt : (nodes.find((n) => n.id === targetId)?.prompt ?? '')
    const next = base.trim() ? `${base.trim()}, ${fragment}` : fragment
    if (isEditing) setCanvasPrompt(next)
    handleNodePatch(targetId, { prompt: next })
    if (workflowContext) showCanvasFeedback('已追加到下游 Prompt')
  }, [workflowContext, editingNode, nodes, canvasPrompt, handleNodePatch, showCanvasFeedback])

  const handleVariantInsert = useCallback((fragment: string) => {
    const targetId = workflowContext?.targetNodeId ?? editingNode?.id
    if (!targetId) return
    const isEditing = editingNode?.id === targetId
    const base = isEditing ? canvasPrompt : (nodes.find((n) => n.id === targetId)?.prompt ?? '')
    const next = base.trim() ? `${base.trim()}, ${fragment}` : fragment
    if (isEditing) setCanvasPrompt(next)
    handleNodePatch(targetId, { prompt: next })
    if (workflowContext) showCanvasFeedback('已追加到下游 Prompt')
  }, [workflowContext, editingNode, nodes, canvasPrompt, handleNodePatch, showCanvasFeedback])

  const handleCharacterLockInsert = useCallback((fragment: string) => {
    const targetId = workflowContext?.targetNodeId ?? editingNode?.id
    if (!targetId) return
    const isEditing = editingNode?.id === targetId
    const base = isEditing ? canvasPrompt : (nodes.find((n) => n.id === targetId)?.prompt ?? '')
    const next = base.trim() ? `${base.trim()}${fragment}` : fragment.trimStart()
    if (isEditing) setCanvasPrompt(next)
    handleNodePatch(targetId, { prompt: next })
    if (workflowContext) showCanvasFeedback('已追加到下游 Prompt')
  }, [workflowContext, editingNode, nodes, canvasPrompt, handleNodePatch, showCanvasFeedback])

  const handleVariantCreateNode = useCallback(
    (kind: 'image' | 'video', title: string, prompt: string) => {
      const source = editingNode ?? activeNode
      createNode(kind, { title, prompt, parentNodeId: source?.id ?? undefined })
    },
    [createNode, editingNode, activeNode],
  )

  // ─── Workflow Connection Context Tools ──────────────────────────────────────
  // For each image/video target node that has an upstream image/video node with
  // media results, compute whether a portrait asset is likely so we can surface
  // the Character Lock option more prominently.
  const PORTRAIT_RE = /人|人物|角色|女孩|男孩|女|男|girl|boy|man|woman|person|portrait|face|character|child/i

  const upstreamContextMap = useMemo(() => {
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const result = new Map<string, { isPortraitLikely: boolean; sourceNodeId: string }>()
    for (const edge of edges) {
      if (result.has(edge.toNodeId)) continue
      const source = nodeById.get(edge.fromNodeId)
      const target = nodeById.get(edge.toNodeId)
      if (!source || !target) continue
      if (target.kind !== 'image' && target.kind !== 'video') continue
      // Source is valid if it has any content: media result, asset binding, or prompt
      const sourceHasContent = Boolean(
        source.resultImageUrl || source.resultVideoUrl || source.assetId || source.prompt?.trim(),
      )
      if (!sourceHasContent) continue
      result.set(edge.toNodeId, {
        isPortraitLikely: PORTRAIT_RE.test(source.prompt ?? ''),
        sourceNodeId: source.id,
      })
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  const handleUpstreamTool = useCallback((
    targetNode: VisualCanvasNode,
    tool: 'character-lock' | 'variant-planner' | 'camera-lexicon',
    sourceNode?: VisualCanvasNode | null,
  ) => {
    // Always focus TARGET — tools write to the downstream node
    focusPromptForNode(targetNode)
    // Store source→target so panels can display source info and route writes to target
    setWorkflowContext(sourceNode ? { sourceNodeId: sourceNode.id, targetNodeId: targetNode.id } : null)
    if (tool === 'camera-lexicon') openCanvasPanel('camera-lexicon')
    else if (tool === 'variant-planner') openCanvasPanel('variant-planner')
    else if (tool === 'character-lock') openCanvasPanel('character-lock')
  }, [focusPromptForNode, openCanvasPanel])

  const handleWorkflowContinue = useCallback((nodeId: string, event: React.MouseEvent) => {
    const x = event.clientX
    const y = event.clientY
    setOpenContextMenuAnchor((prev) => (prev?.nodeId === nodeId ? null : { nodeId, x, y }))
  }, [])

  // Creates a downstream target node, wires source→target edge, and opens the given workflow tool panel.
  const handleWorkflowCreateAndOpen = useCallback((
    sourceNodeId: string,
    targetKind: 'image' | 'video',
    tool: 'character-lock' | 'variant-planner' | 'camera-lexicon',
  ) => {
    const newNode = createNode(targetKind, {
      parentNodeId: sourceNodeId,
      model: NODE_META[targetKind].model,
      ratio: NODE_META[targetKind].ratio,
      position: nodeAddMenu ? { x: nodeAddMenu.worldX, y: nodeAddMenu.worldY } : undefined,
    })
    setWorkflowContext({ sourceNodeId, targetNodeId: newNode.id })
    if (tool === 'camera-lexicon') openCanvasPanel('camera-lexicon')
    else if (tool === 'variant-planner') openCanvasPanel('variant-planner')
    else if (tool === 'character-lock') openCanvasPanel('character-lock')
    setNodeAddMenu(null)
    setConnectionDraft(null)
  }, [createNode, nodeAddMenu, openCanvasPanel])
  // ────────────────────────────────────────────────────────────────────────────

  const handleProviderChange = useCallback((value: string) => {
    const providerId = normalizeProviderId(value)
    setPromptModel(providerId)
    if (editingNode) {
      handleNodePatch(editingNode.id, {
        model: providerId,
        providerId,
      })
    }
  }, [editingNode, handleNodePatch])

  const handleAddSpecificNextNode = useCallback((nodeId: string, kind: VisualCanvasNodeKind) => {
    syncPromptPreset(kind)
    const direction = nodeAddMenu?.direction ?? 'out'
    const node = createNode(kind, {
      parentNodeId: direction === 'out' ? nodeId : undefined,
      model: NODE_META[kind].model,
      ratio: NODE_META[kind].ratio,
      position: nodeAddMenu ? { x: nodeAddMenu.worldX, y: nodeAddMenu.worldY } : undefined,
    })
    if (direction === 'in') {
      const edgeId = `${node.id}-${nodeId}`
      commitEdges((current) => [
        ...current.filter((edge) => edge.id !== edgeId),
        {
          id: edgeId,
          fromNodeId: node.id,
          toNodeId: nodeId,
          status: 'active',
        },
      ])
    }
    setActiveNodeId(node.id)
    setEditingNodeId(null)
    setNodeAddMenu(null)
    setConnectionDraft(null)
  }, [commitEdges, createNode, nodeAddMenu, syncPromptPreset])

  const openNodeAddMenuAt = useCallback((
    nodeId: string,
    direction: 'in' | 'out',
    clientX: number,
    clientY: number,
    worldX: number,
    worldY: number,
  ) => {
    const position = clampMenuPosition(clientX, clientY, NODE_ADD_MENU_WIDTH, NODE_ADD_MENU_HEIGHT)
    setNodeAddMenu({ nodeId, direction, ...position, worldX, worldY })
    setContextMenu(null)
    setEditingNodeId(null)
    setActiveNodeId(nodeId)
  }, [])

  const openNodeAddMenu = useCallback((nodeId: string, direction: 'in' | 'out' = 'out') => {
    const sourceNode = nodes.find((node) => node.id === nodeId)
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!sourceNode || !rect) return

    const size = getNodeSize('video')
    const targetX = direction === 'out'
      ? sourceNode.x + sourceNode.width + DOWNSTREAM_NODE_X_GAP
      : sourceNode.x - DOWNSTREAM_NODE_X_GAP - size.width
    const resolved = resolveNonOverlappingPosition(
      {
        x: targetX,
        y: sourceNode.y + DOWNSTREAM_NODE_Y_GAP,
        width: size.width,
        height: size.height,
      },
      nodes,
    )
    const surfaceOffset = getSurfaceOffset(surfaceRef.current)
    const sourceLeft = rect.left + surfaceOffset.left + canvasPan.x + sourceNode.x * canvasZoom
    const sourceTop = rect.top + surfaceOffset.top + canvasPan.y + sourceNode.y * canvasZoom
    const sourceRight = sourceLeft + sourceNode.width * canvasZoom
    const sourceBottom = sourceTop + sourceNode.height * canvasZoom
    const desiredX = direction === 'out' ? sourceRight + 24 : sourceLeft - NODE_ADD_MENU_WIDTH - 24
    const desiredY = sourceTop + sourceNode.height * canvasZoom / 2 - NODE_ADD_MENU_HEIGHT / 2
    let position = clampMenuPosition(desiredX, desiredY, NODE_ADD_MENU_WIDTH, NODE_ADD_MENU_HEIGHT)
    const overlapsSource = !(
      position.x + NODE_ADD_MENU_WIDTH < sourceLeft ||
      sourceRight < position.x ||
      position.y + NODE_ADD_MENU_HEIGHT < sourceTop ||
      sourceBottom < position.y
    )
    if (overlapsSource) {
      position = clampMenuPosition(sourceLeft, sourceBottom + 24, NODE_ADD_MENU_WIDTH, NODE_ADD_MENU_HEIGHT)
      const stillOverlaps = !(
        position.x + NODE_ADD_MENU_WIDTH < sourceLeft ||
        sourceRight < position.x ||
        position.y + NODE_ADD_MENU_HEIGHT < sourceTop ||
        sourceBottom < position.y
      )
      if (stillOverlaps) {
        position = clampMenuPosition(sourceLeft, sourceTop - NODE_ADD_MENU_HEIGHT - 24, NODE_ADD_MENU_WIDTH, NODE_ADD_MENU_HEIGHT)
        const overlapsAbove = !(
          position.x + NODE_ADD_MENU_WIDTH < sourceLeft ||
          sourceRight < position.x ||
          position.y + NODE_ADD_MENU_HEIGHT < sourceTop ||
          sourceBottom < position.y
        )
        if (overlapsAbove) {
          position = clampMenuPosition(sourceLeft - NODE_ADD_MENU_WIDTH - 24, desiredY, NODE_ADD_MENU_WIDTH, NODE_ADD_MENU_HEIGHT)
        }
      }
    }
    openNodeAddMenuAt(nodeId, direction, position.x, position.y, resolved.x, resolved.y)
  }, [canvasPan.x, canvasPan.y, canvasZoom, nodes, openNodeAddMenuAt])

  const startConnectionDrag = useCallback((nodeId: string, direction: 'in' | 'out', event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    const sourceNode = nodes.find((node) => node.id === nodeId)
    if (!sourceNode) return

    event.preventDefault()
    event.stopPropagation()
    connectionDragRef.current = {
      nodeId,
      direction,
      sourceHandle: direction === 'out' ? 'right' : 'left',
      startClientX: event.clientX,
      startClientY: event.clientY,
    }
    setActiveNodeId(nodeId)
    if (activePreviewNodeId && activePreviewNodeId !== nodeId) {
      closeActivePreview({ closeReviewWindows: false })
    }
    setContextMenu(null)
    setNodeAddMenu(null)
    setEditingNodeId(null)
    setConnectionDraft({
      nodeId,
      x1: direction === 'out'
        ? sourceNode.x + sourceNode.width + CONNECTOR_CENTER_OFFSET
        : sourceNode.x - CONNECTOR_CENTER_OFFSET,
      y1: sourceNode.y + sourceNode.height / 2,
      x2: direction === 'out'
        ? sourceNode.x + sourceNode.width + CONNECTOR_CENTER_OFFSET + CONNECTION_DRAFT_HANDLE_OFFSET
        : sourceNode.x - CONNECTOR_CENTER_OFFSET - CONNECTION_DRAFT_HANDLE_OFFSET,
      y2: sourceNode.y + sourceNode.height / 2,
    })
  }, [activePreviewNodeId, closeActivePreview, nodes])

  const openNodeContextMenu = useCallback((nodeId: string, clientX: number, clientY: number) => {
    const position = clampMenuPosition(clientX, clientY, NODE_MENU_WIDTH, NODE_MENU_HEIGHT)
    setContextMenu({ nodeId, ...position })
    setNodeAddMenu(null)
    setIsAddMenuOpen(false)
    setActiveNodeId(nodeId)
    if (activePreviewNodeId && activePreviewNodeId !== nodeId) {
      closeActivePreview({ closeReviewWindows: false })
    }
  }, [activePreviewNodeId, closeActivePreview])

  const copyNodeToClipboard = useCallback((node: VisualCanvasNode) => {
    setClipboardNode(node)
    setContextMenu(null)
  }, [])

  const markNodeSaved = useCallback((nodeId: string, label: string) => {
    handleNodePatch(nodeId, {
      resultPreview: label,
      outputLabel: label,
    })
    setContextMenu(null)
  }, [handleNodePatch])

  const getViewportWorldPoint = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: 420, y: 240 }
    const surfaceOffset = getSurfaceOffset(surfaceRef.current)

    return {
      x: (clientX - rect.left - surfaceOffset.left - canvasPan.x) / canvasZoom,
      y: (clientY - rect.top - surfaceOffset.top - canvasPan.y) / canvasZoom,
    }
  }, [canvasPan.x, canvasPan.y, canvasZoom])

  // ── Dialog local reference upload ──────────────────────────────────────────

  const handleDialogReferenceUpload = useCallback(async (file: File) => {
    if (!editingNode) return
    const nodeId = editingNode.id
    const validation = validateLocalImageFile(file)
    if (!validation.ok) {
      showCanvasFeedback(validation.error.message)
      return
    }
    const inputId = `local-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setDialogLocalRefs((prev) => [...prev, {
      inputId,
      status: 'uploading' as const,
      originalFileName: file.name,
      mimeType: file.type,
    }])
    try {
      await readImageDimensions(file)
      const fd = buildUploadFormData(file, projectId, workflowId ?? undefined, nodeId)
      const asset = await uploadImageWithTimeout(fd)
      const doneEntry: LocalRefEntry = {
        inputId,
        status: 'done',
        assetId: asset.id,
        mediaUrl: asset.url,
        originalFileName: file.name,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
      }
      setDialogLocalRefs((prev) => prev.map((r) => r.inputId === inputId ? doneEntry : r))
      // Persist into node metadata
      const currentNode = latestNodesRef.current.find((n) => n.id === nodeId)
      const meta = metadataRecord(currentNode?.metadataJson)
      const existingRefs = ((meta.taskInputs as { references?: unknown[] } | undefined)?.references ?? []) as LocalRefEntry[]
      const updatedRefs = [...existingRefs.filter((r) => r.inputId !== inputId), doneEntry]
      handleNodePatch(nodeId, {
        metadataJson: { ...meta, taskInputs: { version: 1, references: updatedRefs } },
      })
      flushLocalSnapshot()
      scheduleCanvasSave(0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '上传失败'
      setDialogLocalRefs((prev) => prev.map((r) => r.inputId === inputId
        ? { ...r, status: 'error' as const, errorMessage: msg }
        : r
      ))
      showCanvasFeedback(msg === 'UPLOAD_TIMEOUT' ? '上传超时，请重试' : msg)
    }
  }, [editingNode, projectId, workflowId, handleNodePatch, flushLocalSnapshot, scheduleCanvasSave, showCanvasFeedback])

  const handleDialogReferenceRemove = useCallback((inputId: string) => {
    if (!editingNode) return
    const nodeId = editingNode.id
    setDialogLocalRefs((prev) => prev.filter((r) => r.inputId !== inputId))
    const currentNode = latestNodesRef.current.find((n) => n.id === nodeId)
    const meta = metadataRecord(currentNode?.metadataJson)
    const existingRefs = ((meta.taskInputs as { references?: unknown[] } | undefined)?.references ?? []) as LocalRefEntry[]
    handleNodePatch(nodeId, {
      metadataJson: {
        ...meta,
        taskInputs: { version: 1, references: existingRefs.filter((r) => r.inputId !== inputId) },
      },
    })
    flushLocalSnapshot()
    scheduleCanvasSave(0)
  }, [editingNode, handleNodePatch, flushLocalSnapshot, scheduleCanvasSave])

  const handleDialogScriptUpload = useCallback(async (file: File) => {
    const validation = validateLocalScriptFile(file)
    if (!validation.ok) {
      showCanvasFeedback(validation.error.message)
      return
    }
    try {
      const entry = await readScriptFile(file)
      setDialogScriptInputs((prev) => [...prev, entry])
    } catch (err) {
      showCanvasFeedback(err instanceof Error ? err.message : '文件读取失败')
    }
  }, [showCanvasFeedback])

  const handleDialogScriptRemove = useCallback((inputId: string) => {
    setDialogScriptInputs((prev) => prev.filter((s) => s.inputId !== inputId))
  }, [])

  const handleDialogScriptApply = useCallback((text: string) => {
    const newPrompt = canvasPrompt.trim() ? `${canvasPrompt}\n\n${text}` : text
    setCanvasPrompt(newPrompt)
    if (editingNode) handleNodePatch(editingNode.id, { prompt: newPrompt })
  }, [canvasPrompt, editingNode, handleNodePatch])

  // ── End dialog local reference upload ──────────────────────────────────────

  const handleLocalImageDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsLocalImageDragOver(false)

    const validFiles: File[] = []
    let hasInvalidType = false
    let hasTooLarge = false

    for (const f of Array.from(e.dataTransfer.files)) {
      const v = validateLocalImageFile(f)
      if (v.ok) {
        validFiles.push(f)
      } else if (v.error.code === 'INVALID_TYPE') {
        hasInvalidType = true
      } else if (v.error.code === 'TOO_LARGE') {
        hasTooLarge = true
      }
    }

    if (hasInvalidType && hasTooLarge) {
      showCanvasFeedback('部分文件无法导入：仅支持 JPG / PNG / WebP，且不能超过 20MB')
    } else if (hasInvalidType) {
      showCanvasFeedback('仅支持 JPG / PNG / WebP 图片')
    } else if (hasTooLarge) {
      showCanvasFeedback('图片不能超过 20MB')
    }

    const files = validFiles.slice(0, 10)

    if (files.length === 0) return

    const basePos = getViewportWorldPoint(e.clientX, e.clientY)
    const NODE_H_OFFSET = 280

    const nodeEntries = files.map((file, index) => {
      const node = createNode('image', {
        title: getImportNodeTitle(file),
        status: 'running',
        position: { x: basePos.x + index * NODE_H_OFFSET, y: basePos.y },
        metadataJson: {
          importedFromLocal: true,
          importSource: 'drag-drop',
          originalFileName: file.name,
          mimeType: file.type,
        },
      })
      handleNodePatch(node.id, { resultPreview: '上传中…' })
      return { file, nodeId: node.id }
    })

    const CONCURRENT = 3
    for (let i = 0; i < nodeEntries.length; i += CONCURRENT) {
      const batch = nodeEntries.slice(i, i + CONCURRENT)
      await Promise.all(
        batch.map(async ({ file, nodeId }) => {
          try {
            await readImageDimensions(file)
            const fd = buildUploadFormData(file, projectId, workflowId || undefined, nodeId)
            const asset = await uploadImageWithTimeout(fd)
            handleNodePatch(nodeId, {
              resultImageUrl: asset.url,
              status: 'idle',
              resultPreview: undefined,
              assetId: asset.id,
              metadataJson: buildLocalImportMetadata(file, asset.id),
            })
            flushLocalSnapshot()
            scheduleCanvasSave(0)
          } catch (err) {
            const raw = err instanceof Error ? err.message : '上传失败'
            handleNodePatch(nodeId, {
              status: 'error',
              errorMessage: raw === 'UPLOAD_TIMEOUT' ? '上传超时，请重试' : raw,
              resultPreview: undefined,
            })
          }
        }),
      )
    }
  }, [createNode, flushLocalSnapshot, getViewportWorldPoint, handleNodePatch, projectId, scheduleCanvasSave, showCanvasFeedback, workflowId])

  const findConnectorTarget = useCallback((clientX: number, clientY: number): { nodeId: string; handle: 'left' | 'right' } | null => {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    const connector = element?.closest('[data-canvas-connector="true"]') as HTMLElement | null
    const nodeId = connector?.dataset.nodeId
    const handle = connector?.dataset.handle
    if (!nodeId || (handle !== 'left' && handle !== 'right')) return null
    return { nodeId, handle }
  }, [])

  const createEdgeFromConnectorDrag = useCallback((
    drag: NonNullable<typeof connectionDragRef.current>,
    target: { nodeId: string; handle: 'left' | 'right' },
  ) => {
    const sourceNodeId = drag.direction === 'out' ? drag.nodeId : target.nodeId
    const targetNodeId = drag.direction === 'out' ? target.nodeId : drag.nodeId
    const sourceHandle = drag.direction === 'out' ? drag.sourceHandle : target.handle
    const targetHandle = drag.direction === 'out' ? target.handle : drag.sourceHandle

    if (sourceNodeId === targetNodeId) {
      showCanvasFeedback('不能连接到自身')
      return false
    }

    const exists = latestEdgesRef.current.some((edge) => (
      edge.fromNodeId === sourceNodeId && edge.toNodeId === targetNodeId
    ))
    if (exists) {
      showCanvasFeedback('连接已存在')
      return false
    }

    const edgeId = `edge-${sourceNodeId}-${targetNodeId}-${Date.now()}`
    commitEdges((current) => [
      ...current,
      {
        id: edgeId,
        fromNodeId: sourceNodeId,
        toNodeId: targetNodeId,
        status: 'active',
        type: 'flow',
        metadataJson: {
          sourceHandle,
          targetHandle,
          createdFrom: 'plus-handle',
        },
      },
    ])
    setActiveNodeId(targetNodeId)
    showCanvasFeedback('已连接')
    scheduleCanvasSave(0)
    return true
  }, [commitEdges, scheduleCanvasSave, showCanvasFeedback])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = connectionDragRef.current
      if (!drag) return
      const point = getViewportWorldPoint(event.clientX, event.clientY)
      setConnectionDraft((current) => current && current.nodeId === drag.nodeId
        ? { ...current, x2: point.x, y2: point.y }
        : current)
    }

    const handlePointerUp = (event: PointerEvent) => {
      const drag = connectionDragRef.current
      if (!drag) return
      connectionDragRef.current = null
      setConnectionDraft(null)

      const distance = Math.hypot(
        event.clientX - drag.startClientX,
        event.clientY - drag.startClientY,
      )
      if (distance < 8) {
        openNodeAddMenu(drag.nodeId, drag.direction)
        return
      }

      const target = findConnectorTarget(event.clientX, event.clientY)
      if (target) {
        createEdgeFromConnectorDrag(drag, target)
        return
      }

      const point = getViewportWorldPoint(event.clientX, event.clientY)
      openNodeAddMenuAt(drag.nodeId, drag.direction, event.clientX, event.clientY, point.x, point.y)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [createEdgeFromConnectorDrag, findConnectorTarget, getViewportWorldPoint, openNodeAddMenu, openNodeAddMenuAt])

  const canStartCanvasPan = useCallback((target: EventTarget | null) => {
    const element = target as HTMLElement | null
    return !element?.closest('button, input, textarea, select, a, video, audio, [contenteditable="true"], [data-node-preview-overlay="true"], [data-prompt-inspector="true"], [data-media-diagnostics="true"], [data-creative-assets="true"], [data-storyboard-preview="true"], [data-edge-director="true"], .canvas-node-card, .canvas-node-dialog, .canvas-prompt-box, .canvas-prompt-console, .canvas-topbar, .canvas-toolbar-shell, .canvas-add-menu, .canvas-zoom-controls, .canvas-context-menu, .canvas-node-add-menu, .canvas-node-create-menu, .canvas-side-panel, .canvas-user-menu')
  }, [])

  // Keep a ref so the wheel handler always reads the current zoom without
  // needing to re-attach the listener on every zoom step.
  const canvasZoomForWheelRef = useRef(canvasZoom)
  useEffect(() => { canvasZoomForWheelRef.current = canvasZoom }, [canvasZoom])

  // Native wheel listener registered with { passive: false } so preventDefault works.
  // React's onWheel is passive in modern browsers and cannot call preventDefault.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const handler = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const normalizedDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      const zoomFactor = Math.exp(-normalizedDelta * 0.0014)
      setZoomAroundPoint(canvasZoomForWheelRef.current * zoomFactor, { x: event.clientX, y: event.clientY })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [setZoomAroundPoint])

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!canStartCanvasPan(event.target)) return
    setActiveNodeId(null)
  }, [canStartCanvasPan])

  const handleCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !canStartCanvasPan(event.target)) return

    closeActivePreview({ closeReviewWindows: false })
    closePromptInspector()
    closeCreativeAssets()
    closeEdgeDirector()
    setStoryboardPreviewOpen(false)
    setEditingNodeId(null)
    setIsPanning(true)
    setContextMenu(null)
    setNodeAddMenu(null)
    panStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      panX: canvasPan.x,
      panY: canvasPan.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [canStartCanvasPan, canvasPan.x, canvasPan.y, closeActivePreview, closeCreativeAssets, closeEdgeDirector, closePromptInspector])

  const handleCanvasPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || event.pointerId !== panStartRef.current.pointerId) return
    setCanvasPan({
      x: panStartRef.current.panX + event.clientX - panStartRef.current.clientX,
      y: panStartRef.current.panY + event.clientY - panStartRef.current.clientY,
    })
  }, [isPanning])

  const handleCanvasPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== panStartRef.current.pointerId) return
    setIsPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const promptFooterItems = useMemo<CanvasPromptFooterItem[]>(() => [
    {
      id: 'tool',
      label: '工具',
      value: getEntryKindLabel(preferredKind),
      options: [
        { value: 'text', label: '写文本', hint: '先把脚本和文案说清楚' },
        { value: 'image', label: '生成图片', hint: '先做关键画面和风格方向' },
        { value: 'video', label: '直接生成视频', hint: '直接进入镜头与动作' },
        { value: 'audio', label: '做声音', hint: '生成旁白、配乐或声音氛围' },
        { value: 'upload', label: '上传素材', hint: '导入图片、视频或音频参考' },
        { value: 'template', label: '打开模板', hint: '切换到模板入口，不直接生成节点' },
      ],
      onSelect: (value) => {
        if (value === 'template') {
          onShowStartup()
          return
        }
        syncPromptPreset(value as VisualCanvasNodeKind)
      },
    },
    {
      id: 'api',
      label: 'API / 模型',
      value: activeProviderLabel,
      options: preferredKind === 'text'
        ? TEXT_NODE_PROVIDER_OPTIONS.map((provider) => ({
            value: provider.value,
            label: provider.label,
            hint: provider.hint,
            badge: liveStatusMap.get(normalizeProviderId(provider.value)) ?? provider.badge,
            duration: provider.duration,
          }))
        : preferredKind === 'image'
          ? IMAGE_NODE_PROVIDER_OPTIONS.map((provider) => {
              const info = imageProviderStatusMap.get(provider.value)
              const status = getImageProviderStatus(imageProviderStatusMap, provider.value, liveStatusMap, liveStatusLoading)
              const missing = info?.missingEnv?.length ? `未配置：缺少 ${info.missingEnv.join(', ')}` : provider.hint
              return {
                value: provider.value,
                label: provider.label,
                hint: info?.available ? provider.hint : missing,
                badge: status,
                duration: provider.duration,
                disabled: status === 'not-configured' || status === 'disabled',
              }
            })
        : preferredKind === 'video'
          ? VIDEO_NODE_PROVIDER_OPTIONS.map((provider) => {
              const info = videoProviderStatusMap.get(provider.value)
              const status = getVideoProviderStatus(videoProviderStatusMap, provider.value, liveStatusMap, liveStatusLoading)
              const missing = info?.missingEnv?.length ? `未配置：缺少 ${info.missingEnv.join(', ')}` : provider.hint
              return {
                value: provider.value,
                label: provider.label,
                hint: info?.available ? provider.hint : missing,
                badge: status,
                duration: provider.duration,
                disabled: status === 'not-configured' || status === 'disabled',
              }
            })
        : getCanvasProviders(getProviderKind(preferredKind)).map((provider) => ({
            value: provider.id,
            label: provider.name,
            hint: provider.description.length > 30 ? provider.description.slice(0, 30) + '…' : provider.description,
            badge: liveStatusMap.get(normalizeProviderId(provider.id)) ?? (liveStatusLoading ? 'checking' : provider.status),
            duration: provider.estimatedTime,
          })),
      onSelect: handleProviderChange,
    },
    {
      id: 'stage',
      label: '阶段',
      value: stageLabel,
      options: STAGE_OPTIONS.map((option) => ({ ...option })),
      onSelect: (value) => setPromptStage(value as (typeof STAGE_OPTIONS)[number]['value']),
    },
    {
      id: 'asset',
      label: '素材',
      value: assetLabel,
      options: ASSET_OPTIONS.map((option) => ({ ...option })),
      onSelect: (value) => setPromptAssetMode(value as (typeof ASSET_OPTIONS)[number]['value']),
    },
    {
      id: 'params',
      label: '参数',
      value: parameterLabel,
      options: PARAMETER_OPTIONS.map((option) => ({ ...option })),
      onSelect: (value) => {
        const nextValue = value as (typeof PARAMETER_OPTIONS)[number]['value']
        setPromptParameter(nextValue)
        setPromptRatio(PARAMETER_RATIO_MAP[nextValue])
      },
    },
  ], [activeProviderLabel, assetLabel, handleProviderChange, imageProviderStatusMap, liveStatusLoading, liveStatusMap, onShowStartup, parameterLabel, preferredKind, stageLabel, syncPromptPreset, videoProviderStatusMap])

  const handleCreateMenuSelect = useCallback((kind: VisualCanvasNodeKind) => {
    const size = getNodeSize(kind)
    const position = nodeCreateMenu
      ? {
        x: nodeCreateMenu.worldX - (size.width - NODE_SIZE.text.width) / 2,
        y: nodeCreateMenu.worldY,
      }
      : undefined
    syncPromptPreset(kind)
    const model = kind === 'image'
      ? getDefaultImageProviderId(imageProviderStatusMap) ?? NODE_META[kind].model
      : kind === 'video'
        ? getDefaultVideoProviderId(videoProviderStatusMap) ?? NODE_META[kind].model
      : NODE_META[kind].model
    const node = createNode(kind, {
      title: NODE_META[kind].title,
      model,
      ratio: NODE_META[kind].ratio,
      position,
    })
    openCanvasPanel('generation', { nodeId: node.id })
    setNodeCreateMenu(null)
  }, [createNode, imageProviderStatusMap, nodeCreateMenu, openCanvasPanel, syncPromptPreset, videoProviderStatusMap])

  const handleCanvasDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const element = event.target as HTMLElement | null
    if (element?.closest('button, input, textarea')) return
    if (!canStartCanvasPan(event.target)) return
    event.preventDefault()
    event.stopPropagation()

    setHasStarted(true)
    closeActivePreview()
    const viewportRect = viewportRef.current?.getBoundingClientRect()
    const referencePoint = viewportRect
      ? getViewportWorldPoint(
        viewportRect.left + viewportRect.width / 2,
        viewportRect.top + clampNumber(viewportRect.height * 0.24, 150, 230),
      )
      : getViewportWorldPoint(event.clientX, event.clientY)
    syncPromptPreset('video')
    const node = createNode('video', {
      title: NODE_META.video.title,
      model: NODE_META.video.model,
      ratio: NODE_META.video.ratio,
      position: {
        x: referencePoint.x - NODE_SIZE.video.width / 2,
        y: referencePoint.y - NODE_SIZE.video.height / 2,
      },
    })
    focusPromptForNode(node)
    setContextMenu(null)
    setNodeAddMenu(null)
    setNodeCreateMenu(null)
    setIsAddMenuOpen(false)
  }, [canStartCanvasPan, closeActivePreview, createNode, focusPromptForNode, getViewportWorldPoint, syncPromptPreset])

  const handleShareCanvasLink = useCallback(async () => {
    flushLocalSnapshot()
    const href = window.location.href
    const showCopyPrompt = () => {
      try {
        window.prompt('复制这个链接', href)
      } catch {
        // Some embedded test browsers disable prompt(); keep the copy action non-disruptive.
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await Promise.race([
          navigator.clipboard.writeText(href),
          new Promise<void>((_, reject) => {
            window.setTimeout(() => reject(new Error('clipboard-timeout')), 600)
          }),
        ])
      } else {
        showCopyPrompt()
      }
    } catch {
      showCopyPrompt()
    }

    setShareCopied(true)
    const timer = window.setTimeout(() => setShareCopied(false), 1600)
    timersRef.current.push(timer)
  }, [flushLocalSnapshot])

  const handleBeforeNewProject = useCallback(() => {
    const confirmed = window.confirm('将立即创建并进入新项目。旧画布会保留本地草稿，后台保存失败不会阻塞新项目。')
    if (!confirmed) return false
    flushLocalSnapshot()
    isSwitchingProjectRef.current = true
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (saveRetryTimerRef.current) {
      window.clearTimeout(saveRetryTimerRef.current)
      saveRetryTimerRef.current = null
    }
    clearGenerationTimersAndRequests()
    saveAbortRef.current?.abort()
    return true
  }, [clearGenerationTimersAndRequests, flushLocalSnapshot])

  const handleOpenClientDelivery = useCallback(() => {
    flushLocalSnapshot()
    const currentProjectId = projectId || new URLSearchParams(window.location.search).get('projectId') || ''
    if (!currentProjectId || isPlaceholderProjectId(currentProjectId)) {
      window.alert('请先打开一个项目，再创建客户交付。')
      router.push('/projects')
      return
    }
    router.push(`/projects/${encodeURIComponent(currentProjectId)}/delivery`)
  }, [projectId, router, flushLocalSnapshot])

  const handleOpenProjects = useCallback(() => {
    flushLocalSnapshot()
    try {
      if (projectId) window.localStorage.setItem('creator-city:last-project-id', projectId)
      if (workflowId) window.localStorage.setItem('creator-city:last-workflow-id', workflowId)
    } catch {
      // Explicit /projects navigation still works without localStorage.
    }
    router.push('/projects')
  }, [projectId, router, workflowId, flushLocalSnapshot])

  const handleCanvasRootClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    const navigatesFromCanvas = target?.closest('a[href], button[data-flush-canvas-before-nav="true"]')
    if (!navigatesFromCanvas) return
    flushLocalSnapshot()
  }, [flushLocalSnapshot])

  const nodeDialogStyle = useMemo<CSSProperties | undefined>(() => {
    if (!editingNode || typeof window === 'undefined') return undefined
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return undefined

    const viewportMargin = 24
    const dialogScale = clampNumber(canvasZoom, 0.56, 1)
    const dialogWidth = Math.max(320, Math.min(720, window.innerWidth - viewportMargin * 2))
    const visualDialogWidth = dialogWidth * dialogScale
    const surfaceOffset = getSurfaceOffset(surfaceRef.current)
    const nodeLeft = rect.left + surfaceOffset.left + canvasPan.x + editingNode.x * canvasZoom
    const nodeTop = rect.top + surfaceOffset.top + canvasPan.y + editingNode.y * canvasZoom
    const nodeWidth = editingNode.width * canvasZoom
    const nodeHeight = editingNode.height * canvasZoom
    const nodeBottom = nodeTop + nodeHeight
    const nodeCenterX = nodeLeft + nodeWidth / 2
    const dialogHeight = window.innerWidth <= 900 ? 190 : NODE_DIALOG_HEIGHT
    const visualDialogHeight = dialogHeight * dialogScale
    const belowTop = nodeBottom + NODE_DIALOG_GAP
    const aboveTop = nodeTop - NODE_DIALOG_GAP - visualDialogHeight
    const hasRoomBelow = belowTop + visualDialogHeight <= window.innerHeight - viewportMargin
    const hasRoomAbove = aboveTop >= viewportMargin
    // Default to below; only flip above if the node bottom is at the screen edge AND there's room above
    const top = (!hasRoomBelow && belowTop >= window.innerHeight - viewportMargin && hasRoomAbove)
      ? aboveTop
      : clampNumber(belowTop, viewportMargin, window.innerHeight - visualDialogHeight - viewportMargin)

    return {
      left: clampNumber(nodeCenterX - visualDialogWidth / 2, viewportMargin, window.innerWidth - visualDialogWidth - viewportMargin),
      height: dialogHeight,
      top,
      transform: `scale(${dialogScale})`,
      transformOrigin: 'top left',
      width: dialogWidth,
    }
  }, [canvasPan.x, canvasPan.y, canvasZoom, editingNode, isRightInspectorOpen, isBottomDockExpanded])

  // Toolbar position as fixed-screen coords so it escapes canvas-viewport overflow:hidden
  const toolbarFixedStyle = useMemo<CSSProperties | undefined>(() => {
    const node = activeNode
    if (!node) return undefined
    // Show toolbar for text (always), image (always), video (always).
    // Configuration tools (camera/lighting/prompt) are useful before any result exists.
    if (node.kind !== 'text' && node.kind !== 'image' && node.kind !== 'video') return undefined
    if (typeof window === 'undefined') return undefined
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return undefined
    const surfaceOffset = getSurfaceOffset(surfaceRef.current)
    const centerX = rect.left + surfaceOffset.left + canvasPan.x + (node.x + node.width / 2) * canvasZoom
    const nodeScreenTop = rect.top + surfaceOffset.top + canvasPan.y + node.y * canvasZoom
    return {
      position: 'fixed' as const,
      left: Math.round(centerX),
      top: Math.round(nodeScreenTop - 14),
      transform: 'translateX(-50%) translateY(-100%)',
      zIndex: 90,
      pointerEvents: 'auto',
    }
  }, [activeNode, canvasPan.x, canvasPan.y, canvasZoom, isRightInspectorOpen, isBottomDockExpanded])

  // Resolve upstream image for video node editing dialog
  const videoModeInfo = useMemo(() => {
    if (!editingNode || editingNode.kind !== 'video') return undefined

    // Check for video→video derived node: upstream is a video node (not image)
    const upstreamEdges = edges.filter((e) => e.toNodeId === editingNode.id)
    const upstreamVideoNode = upstreamEdges
      .map((e) => nodes.find((n) => n.id === e.fromNodeId))
      .find((n) => n?.kind === 'video')
    if (upstreamVideoNode) {
      return {
        mode: 'video-to-video' as const,
        sourceNodeTitle: upstreamVideoNode.title,
        thumbnailUrl: upstreamVideoNode.preview?.poster ? getProxiedMediaUrl(upstreamVideoNode.preview.poster) : undefined,
      }
    }

    const resolved = resolveImageInputForVideoNode({
      videoNode: editingNode,
      allNodes: nodes,
      edges,
    })
    if (resolved.mode === 'image-to-video') {
      const sourceNode = nodes.find((n) => n.id === resolved.sourceImageNodeId)
      return {
        mode: 'image-to-video' as const,
        thumbnailUrl: getProxiedMediaUrl(resolved.imageUrl),
        sourceNodeTitle: sourceNode?.title ?? 'Image',
      }
    }
    if (resolved.reason === 'upstream_image_missing_url') {
      const sourceNode = nodes.find((n) => n.id === resolved.sourceImageNodeId)
      return {
        mode: 'image-missing' as const,
        sourceNodeTitle: sourceNode?.title,
      }
    }

    // Check local uploaded reference images (done + stable URL)
    const stableLocalRef = dialogLocalRefs.find(
      (r) => r.status === 'done' && r.mediaUrl && isProviderAccessibleUrl(r.mediaUrl)
    )
    if (stableLocalRef) {
      return {
        mode: 'image-to-video' as const,
        thumbnailUrl: getProxiedMediaUrl(stableLocalRef.mediaUrl!),
        sourceNodeTitle: stableLocalRef.originalFileName,
      }
    }

    return { mode: 'text-to-video' as const }
  }, [editingNode, nodes, edges, dialogLocalRefs])

  const selectedImageProviderStatus = editingNode?.kind === 'image'
    ? getImageProviderStatus(imageProviderStatusMap, normalizedPromptModel, liveStatusMap, liveStatusLoading)
    : null
  const selectedVideoProviderStatus = editingNode?.kind === 'video'
    ? getVideoProviderStatus(videoProviderStatusMap, normalizedPromptModel, liveStatusMap, liveStatusLoading)
    : null
  const imageGenerateDisabled = editingNode?.kind === 'image'
    && selectedImageProviderStatus !== 'available'
    && !defaultImageProviderId
  const videoGenerateDisabled = editingNode?.kind === 'video'
    && selectedVideoProviderStatus !== 'available'
    && !defaultVideoProviderId
    && !(normalizedPromptModel === 'volcengine-seedance-video' && editingNode.status === 'running' && metadataRecord(editingNode.metadataJson).taskId)

  const handleStopAllGenerations = useCallback(() => {
    clearGenerationTimersAndRequests('manual')
    commitNodes((current) => current.map((node) => {
      if (!isActiveGenerationStatus(node.status)) return node
      return {
        ...node,
        status: 'cancelled' as const,
        errorMessage: 'Generation cancelled by user.',
        metadataJson: stoppedGenerationMetadata(node.metadataJson, 'cancelled'),
      }
    }))
    flushLocalSnapshot()
    scheduleCanvasSave(0)
    showCanvasFeedback('已停止所有生成中的节点。')
  }, [clearGenerationTimersAndRequests, commitNodes, flushLocalSnapshot, scheduleCanvasSave, showCanvasFeedback])

  const hasActiveGenerations = useMemo(
    () => nodes.some((node) => isActiveGenerationStatus(node.status)),
    [nodes],
  )

  const topCommandBar = (
    <CanvasTopCommandBar>
      <div className="canvas-topbar create-glass-panel">
        <div className="canvas-topbar-brand">
          <div
            className="canvas-topbar-home-link"
            title={templateName ? `${loadedProjectTitle} · ${templateName}` : loadedProjectTitle}
          >
            <a href="/" className="canvas-topbar-logo-link" aria-label="回到首页">
              <span className="canvas-topbar-logo" aria-hidden="true" />
              <span className="canvas-topbar-title">Creator City</span>
            </a>
            <span className="canvas-topbar-home-copy">
              {projectTitleEditing ? (
                <form className="canvas-title-edit-form" onSubmit={saveProjectTitle}>
                  <input
                    value={projectTitleDraft}
                    onChange={(event) => {
                      setProjectTitleDraft(event.target.value)
                      setProjectTitleError('')
                    }}
                    className="canvas-title-edit-input"
                    aria-label="项目名称"
                    autoFocus
                    maxLength={80}
                  />
                  <button
                    type="submit"
                    className="canvas-title-edit-action"
                    disabled={projectTitleSaving}
                  >
                    {projectTitleSaving ? '保存中' : '保存'}
                  </button>
                  <button
                    type="button"
                    className="canvas-title-edit-action is-muted"
                    disabled={projectTitleSaving}
                    onClick={() => {
                      setProjectTitleDraft(loadedProjectTitle)
                      setProjectTitleError('')
                      setProjectTitleEditing(false)
                    }}
                  >
                    取消
                  </button>
                  {projectTitleError ? <span className="canvas-title-edit-error">{projectTitleError}</span> : null}
                </form>
              ) : (
                <button
                  type="button"
                  className="canvas-project-title-button"
                  onClick={() => {
                    setProjectTitleDraft(loadedProjectTitle)
                    setProjectTitleError('')
                    setProjectTitleEditing(true)
                  }}
                  title="编辑项目名称"
                >
                  {loadedProjectTitle || 'Untitled Project'}
                </button>
              )}
            </span>
          </div>
        </div>

        <div className="canvas-topbar-actions">
          {/* Credits balance — read-only display */}
          <CreditBalanceBadge />
          {/* Save status pill */}
          <button
            type="button"
            className={`canvas-topbar-status-pill${saveStatus === 'saving' ? ' is-saving' : saveStatus === 'failed' ? ' is-error' : saveStatus === 'saved' ? ' is-saved' : ' is-local'}`}
            title={saveMessage || '将本地草稿同步到云端'}
            disabled={saveStatus === 'opening' || saveStatus === 'saving' || !projectId}
            onClick={handleManualSave}
          >
            {saveStatus === 'saving'
              ? '同步中...'
              : saveStatus === 'saved'
                ? '已同步到云端'
                : saveStatus === 'failed'
                  ? '云端保存失败，重试'
                  : '保存到云端'}
          </button>

          {/* Link share — direct primary action */}
          <button
            type="button"
            onClick={() => { void handleShareCanvasLink() }}
            className="canvas-nav-link"
            title="复制画布链接"
            aria-label="复制画布链接"
          >
            {shareCopied ? '已复制' : '链接分享'}
          </button>

          {/* Community — direct platform entry */}
          <a href="/community" className="canvas-nav-link" title="进入社群" aria-label="进入社群">
            社区
          </a>

          {/* More — collapsed dropdown for all secondary entries */}
          <div className="canvas-topbar-more-wrap">
            <button type="button" className="canvas-nav-link canvas-topbar-more-trigger" aria-label="更多功能" aria-haspopup="menu">
              其它
            </button>
            <div className="canvas-topbar-more-menu" role="menu">
              {/* A: Project ops */}
              <div className="canvas-topbar-more-group">
                <span className="canvas-topbar-more-label">项目</span>
                <button type="button" onClick={() => setNewProjectOpen(true)} className="canvas-topbar-more-item" title="新建项目">
                  新建项目
                </button>
                <button type="button" onClick={handleOpenProjects} className="canvas-topbar-more-item" title="打开项目列表" data-flush-canvas-before-nav="true">
                  项目
                </button>
                <a href="/projects" className="canvas-topbar-more-item" title="项目中心">
                  项目中心
                </a>
              </div>
              {/* B: Production & assets */}
              <div className="canvas-topbar-more-group">
                <span className="canvas-topbar-more-label">生产与资产</span>
                <button
                  type="button"
                  className="canvas-topbar-more-item canvas-generation-tasks-trigger"
                  disabled={nodes.length === 0}
                  onClick={() => setGenerationTasksOpen(true)}
                  title="查看当前画布异步生成任务"
                >
                  生成任务
                  {runningGenerationTaskCount > 0 ? <span className="canvas-generation-tasks-badge">{runningGenerationTaskCount}</span> : null}
                </button>
                <button
                  type="button"
                  className="canvas-topbar-more-item"
                  disabled={recoverNodeStatus === 'running' || !projectId}
                  onClick={() => { void handleRecoverCanvasNodes() }}
                  title="从数据库补回当前项目已生成但未写入画布的历史素材"
                >
                  {recoverNodeStatus === 'running' ? '恢复中…' : recoverNodeStatus === 'done-recovered' ? `已恢复 ${recoverNodeCount} 个素材` : recoverNodeStatus === 'done-empty' ? '暂无可恢复素材' : recoverNodeStatus === 'failed' ? '恢复失败，请稍后重试' : '恢复历史素材'}
                </button>
                <a href="/assets" className="canvas-topbar-more-item" title="资产中心">
                  资产中心
                </a>
              </div>
              {/* C: Workspace entries */}
              <div className="canvas-topbar-more-group">
                <span className="canvas-topbar-more-label">工作入口</span>
                <a href="/dashboard" className="canvas-topbar-more-item" title="工作台">工作台</a>
                {canOpenClientDelivery ? (
                  <button type="button" onClick={handleOpenClientDelivery} className="canvas-topbar-more-item" title="客户交付" data-flush-canvas-before-nav="true">
                    客户
                  </button>
                ) : null}
              </div>
              {/* D: Debug / advanced (conditional) */}
              {(hasActiveGenerations || ASSET_RECOVERY_TOOLS_ENABLED || STORYBOARD_TOOLS_ENABLED) ? (
                <div className="canvas-topbar-more-group">
                  <span className="canvas-topbar-more-label">调试</span>
                  {hasActiveGenerations ? (
                    <button
                      type="button"
                      className="canvas-topbar-more-item"
                      style={{ color: '#f87171' }}
                      title="停止当前所有生成中的节点，清空 timers，节点标记为 cancelled"
                      onClick={handleStopAllGenerations}
                    >
                      停止所有生成
                    </button>
                  ) : null}
                  {ASSET_RECOVERY_TOOLS_ENABLED ? (
                    <>
                      <button
                        type="button"
                        className="canvas-topbar-more-item"
                        disabled={assetRecoverBatchStatus === 'running' || !projectId || nodes.length === 0}
                        onClick={() => { void handleRecoverCanvasAssets() }}
                        title="扫描当前画布并按 assetId 恢复历史图片/视频资产"
                      >
                        {assetRecoverBatchStatus === 'running' ? '恢复中...' : assetRecoverBatchStatus === 'done' ? '已扫描恢复' : assetRecoverBatchStatus === 'failed' ? '恢复失败，重试' : '扫描并恢复历史资产'}
                      </button>
                      <button
                        type="button"
                        className="canvas-topbar-more-item"
                        disabled={!projectId}
                        onClick={() => setP0MediaDebugOpen(true)}
                        title="诊断当前画布真实图片/视频节点"
                      >
                        P0 媒体自检
                      </button>
                    </>
                  ) : null}
                  {STORYBOARD_TOOLS_ENABLED ? (
                    <>
                      <button
                        type="button"
                        className="canvas-topbar-more-item canvas-generation-tasks-trigger"
                        disabled={nodes.length === 0}
                        onClick={() => setStoryboardPreviewOpen(true)}
                        title="按连接顺序查看 Storyboard Timeline"
                      >
                        组合预览
                        {storyboardShotCount > 0 ? <span className="canvas-generation-tasks-badge">{storyboardShotCount}</span> : null}
                      </button>
                      <button
                        type="button"
                        className="canvas-topbar-more-item"
                        onClick={() => setStoryboardDirectorOpen(true)}
                        title="打开分镜导演"
                      >
                        分镜
                        {directorState.shots.length > 0 ? <span className="canvas-generation-tasks-badge">{directorState.shots.length}</span> : null}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </CanvasTopCommandBar>
  )

  const leftToolRail = (
    <div className={`${canvasStyles.scope} h-full`}>
      <CanvasToolDock
        onAddNode={handleAddNode}
        activeTool={activeTool}
        onToolSelect={setActiveTool}
        isAddMenuOpen={isAddMenuOpen}
        onToggleAddMenu={() => setIsAddMenuOpen((current) => !current)}
        hasActiveGenerations={hasActiveGenerations}
        onStopAllGenerations={handleStopAllGenerations}
        onOpenDirectorTool={(tool) => {
          if (tool === 'shot-list-builder') openCanvasPanel('shot-list-builder')
          else if (tool === 'continuity-checker') openCanvasPanel('continuity-checker')
          else if (tool === 'character-bible') openCanvasPanel('character-bible')
          else if (tool === 'scene-bible') openCanvasPanel('scene-bible')
          else if (tool === 'shot-sequencer') openCanvasPanel('shot-sequencer')
        }}
        onOpenPromptTool={(tool) => {
          if (tool === 'batch-rewriter') openCanvasPanel('batch-rewriter')
        }}
      />
    </div>
  )

  return (
    <CanvasWorkspaceShell
      topCommand={topCommandBar}
      leftRail={leftToolRail}
      showLeftRail
      rightInspector={undefined}
      showRightInspector={false}
      bottomDock={
        <CanvasBottomDock
          expanded={isBottomDockExpanded}
          onToggle={() => setIsBottomDockExpanded((v) => !v)}
          activeNode={activeNode}
          sourceNode={inspectorSourceNode}
          taskNodes={dockTaskNodes}
          onSelectNode={(nodeId) => {
            setActiveNodeId(nodeId)
            setIsRightInspectorOpen(true)
          }}
          onOpenGenerationDialog={(nodeId) => openGenerationDialog(nodeId)}
        />
      }
      showBottomDock
    >
    <div className={`${canvasStyles.scope} h-full min-h-0`} onClickCapture={handleCanvasRootClickCapture}>
    <div className={`canvas-root ${hasStarted ? 'is-started' : ''}`}>
      <div className="canvas-background-glow" />
      <div className="canvas-grid" />

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        source="create"
        beforeCreate={handleBeforeNewProject}
      />

      {draftRestorePrompt ? (
        <div className="fixed left-1/2 top-28 z-[70] w-[min(92vw,520px)] -translate-x-1/2 rounded-lg border border-amber-300/25 bg-slate-950/95 p-4 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="text-sm font-semibold text-white">发现本地画布草稿，是否恢复？</div>
          <div className="mt-1 text-xs text-white/50">
            服务器版本已保留。{draftRestorePrompt.source === 'cache' ? '本地缓存' : '本地草稿'}包含 {draftRestorePrompt.nodes.length} 个节点。
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { void restoreDraftToServer() }}
              className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-100"
            >
              恢复草稿
            </button>
            <button
              type="button"
              onClick={keepServerCanvas}
              className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:border-white/25 hover:text-white"
            >
              使用服务器版本
            </button>
          </div>
        </div>
      ) : null}

      {saveStatus === 'opening' ? (
        <div className="canvas-empty-overlay">
          <div className="canvas-empty-hint-row">
            <span className="canvas-empty-hint-text">正在打开项目...</span>
          </div>
        </div>
      ) : null}

      {/* CanvasToolDock moved to Shell leftRail slot */}

      {activeCanvasModal === 'script-segmentation'
        && scriptSegmentationSource?.kind === 'text'
        && nodes.find((node) => node.id === scriptSegmentationSource.id)?.kind === 'text' ? (
        <ScriptSegmentationPanel
          sourceNode={scriptSegmentationSource}
          existingNodes={nodes.map((node) => ({ metadataJson: node.metadataJson }))}
          onApply={handleApplyScriptSegmentation}
          onClose={closeCanvasPanel}
        />
      ) : null}

      {activeCanvasModal === 'narrative-beat-analysis'
        && narrativeBeatSource?.kind === 'text'
        && nodes.find((node) => node.id === narrativeBeatSource.id)?.kind === 'text' ? (
        <NarrativeBeatAnalysisPanel
          sourceNode={narrativeBeatSource}
          existingNodes={nodes.map((node) => ({ metadataJson: node.metadataJson }))}
          onApply={handleApplyNarrativeBeatPlans}
          onClose={closeCanvasPanel}
        />
      ) : null}

      {/* Camera Lexicon panel — triggered from left dock or workflow context menu */}
      {isLexiconOpen && saveStatus !== 'opening' ? (
        (() => {
          const lexTarget = lockedNodeToolContext
            ? (nodes.find((n) => n.id === lockedNodeToolContext.targetNodeId) ?? null)
            : (editingNode ?? activeNode)
          const lexApplicable = lexTarget?.kind === 'image' || lexTarget?.kind === 'video'
          if (!lexApplicable || !lexTarget) return null
          const lexSourceNode = {
            title: lexTarget.title ?? '',
            kind: (lexTarget.kind === 'image' || lexTarget.kind === 'video' ? lexTarget.kind : 'text') as 'image' | 'video' | 'text',
            resultImageUrl: lexTarget.resultImageUrl,
            resultVideoUrl: lexTarget.resultVideoUrl,
          }
          return (
            <CameraLexiconPanel
              nodeKind={lexTarget.kind as 'image' | 'video'}
              canInsert={editingNode !== null || workflowContext !== null}
              onInsert={handleLexiconInsert}
              sourceNode={lexSourceNode}
              onCreateDerived={(fragment, selectedLabels) => {
                const sourcePrompt = (lexTarget.prompt ?? '').trim()
                const derivedPrompt = sourcePrompt ? `${sourcePrompt}\n${fragment}` : fragment
                const topLabels = selectedLabels.slice(0, 3)
                const extra = selectedLabels.length - topLabels.length
                const toolSummaryText = topLabels.length
                  ? topLabels.join(' · ') + (extra > 0 ? ` +${extra}` : '')
                  : undefined
                const node = createNode(
                  lexTarget.kind === 'video' ? 'video' : 'image',
                  {
                    title: `${lexTarget.title} · 镜头`,
                    prompt: derivedPrompt,
                    parentNodeId: lexTarget.id,
                    status: 'idle',
                    metadataJson: {
                      derivedFromTool: 'camera-lexicon',
                      derivedFromToolLabel: '镜头词典',
                      ...(toolSummaryText ? { toolSummaryText } : {}),
                      sourceNodeTitle: lexTarget.title || lexTarget.kind,
                      generationDraft: {
                        status: 'draft',
                        sourceNodeId: lexTarget.id,
                        sourceKind: lexTarget.kind,
                        targetKind: lexTarget.kind === 'video' ? 'video' : 'image',
                        basePrompt: sourcePrompt,
                        derivedPrompt,
                        sourceImageUrl: lexTarget.resultImageUrl ?? null,
                        sourceVideoUrl: lexTarget.resultVideoUrl ?? null,
                        createdAt: new Date().toISOString(),
                      },
                    },
                    edgeLabel: '镜头词典',
                    edgeToolId: 'camera-lexicon',
                    edgeToolIcon: '🎬',
                  },
                )
                setWorkflowContext(null)
                openCanvasPanel('generation', { nodeId: node.id })
                flushLocalSnapshot()
                scheduleCanvasSave(0)
              }}
              onClose={() => { setLockedNodeToolContext(null); closeCanvasPanel(); setWorkflowContext(null) }}
              workflowTargetNodeTitle={workflowContext ? (nodes.find((n) => n.id === workflowContext.targetNodeId)?.title ?? '下游任务') : undefined}
            />
          )
        })()
      ) : null}

      {/* Asset Variant Planner panel — triggered from left dock or workflow context menu */}
      {isVariantPlannerOpen && saveStatus !== 'opening' ? (
        <>
          <div
            className="fixed inset-0 z-[1199]"
            aria-hidden="true"
            onPointerDown={() => { closeCanvasPanel(); setWorkflowContext(null) }}
          />
          <AssetVariantPlannerPanel
            node={lockedNodeToolContext
              ? (nodes.find((n) => n.id === lockedNodeToolContext.targetNodeId) ?? null)
              : workflowContext
                ? (nodes.find((n) => n.id === workflowContext.sourceNodeId) ?? editingNode ?? activeNode)
                : (editingNode ?? activeNode)}
            canvasPrompt={workflowContext ? (nodes.find((n) => n.id === workflowContext.sourceNodeId)?.prompt ?? '') : canvasPrompt}
            canInsert={editingNode !== null || workflowContext !== null}
            onInsert={handleVariantInsert}
            onCreateNode={handleVariantCreateNode}
            onClose={() => { setLockedNodeToolContext(null); closeCanvasPanel(); setWorkflowContext(null) }}
            workflowTargetNodeTitle={workflowContext ? (nodes.find((n) => n.id === workflowContext.targetNodeId)?.title ?? '下游任务') : undefined}
          />
        </>
      ) : null}

      {/* Character Lock panel — Tool 4, triggered from left dock or workflow context menu */}
      {isCharacterLockOpen && saveStatus !== 'opening' ? (
        <>
          <div
            className="fixed inset-0 z-[1199]"
            aria-hidden="true"
            onPointerDown={() => { closeCanvasPanel(); setWorkflowContext(null) }}
          />
          <CharacterLockPanel
            node={workflowContext ? (nodes.find((n) => n.id === workflowContext.sourceNodeId) ?? editingNode ?? activeNode) : (editingNode ?? activeNode)}
            characterBible={characterBible}
            canInsert={editingNode !== null || workflowContext !== null}
            onInsert={handleCharacterLockInsert}
            onSaveBible={persistCharacterBibleSettings}
            onClose={() => { closeCanvasPanel(); setWorkflowContext(null) }}
            workflowTargetNodeTitle={workflowContext ? (nodes.find((n) => n.id === workflowContext.targetNodeId)?.title ?? '下游任务') : undefined}
          />
        </>
      ) : null}

      {/* A/B Compare panel — Tool 5, triggered from Asset tools group in left dock */}
      {isABCompareOpen && saveStatus !== 'opening' ? (
        <>
          <div
            className="fixed inset-0 z-[1199]"
            aria-hidden="true"
            onPointerDown={() => closeCanvasPanel()}
          />
          <ABComparePanel
            nodes={nodes.filter(isComparableNode)}
            initialNodeAId={activeNodeId ?? undefined}
            onFocusNode={(nodeId) => {
              setActiveNodeId(nodeId)
              const target = nodes.find((n) => n.id === nodeId)
              if (target) {
                setCanvasPan({
                  x: -(target.x * canvasZoom) + window.innerWidth / 2 - 120,
                  y: -(target.y * canvasZoom) + window.innerHeight / 2 - 80,
                })
              }
            }}
            onClose={() => closeCanvasPanel()}
          />
        </>
      ) : null}

      {/* Keyframe Extractor panel — Tool 6, triggered from Asset tools group in left dock */}
      {isKeyframeExtractorOpen && saveStatus !== 'opening' ? (
        <>
          <div
            className="fixed inset-0 z-[1199]"
            aria-hidden="true"
            onPointerDown={() => closeCanvasPanel()}
          />
          <KeyframeExtractorPanel
            nodes={nodes}
            initialNodeId={activeNodeId ?? undefined}
            onCreateNode={(kind, options) => {
              createNode(kind, options)
            }}
            onFocusNode={(nodeId) => {
              setActiveNodeId(nodeId)
              const target = nodes.find((n) => n.id === nodeId)
              if (target) {
                setCanvasPan({
                  x: -(target.x * canvasZoom) + window.innerWidth / 2 - 120,
                  y: -(target.y * canvasZoom) + window.innerHeight / 2 - 80,
                })
              }
            }}
            onClose={() => closeCanvasPanel()}
          />
        </>
      ) : null}

      {isShotListBuilderOpen && saveStatus !== 'opening' ? (
        <ShotListBuilderPanel
          nodes={nodes.map((node) => ({
            id: node.id,
            title: node.title,
            kind: node.kind,
            prompt: node.prompt,
            resultText: node.resultText,
            metadataJson: node.metadataJson,
          }))}
          initialNodeId={shotListSourceId ?? activeNodeId ?? undefined}
          existingNodes={nodes.map((node) => ({ metadataJson: node.metadataJson }))}
          onApplyShotPlans={handleApplyShotPlans}
          onCreateNode={handleCreateCompatibilityShotNode}
          onAutoGenerateNodes={(nodeIds) => {
            pendingAutoGenerateIdsRef.current = nodeIds
            setPendingAutoGenerateIds(nodeIds)
          }}
          onClose={() => closeCanvasPanel()}
        />
      ) : null}

      {isShotSequencerOpen && saveStatus !== 'opening' && projectId ? (
        <ShotSequencerPanel
          projectId={projectId}
          nodes={nodes}
          initialCloudSequence={cloudShotSequence}
          onSaveToCloud={handleSaveSequenceToCloud}
          onSelectNode={(nodeId) => {
            setActiveNodeId(nodeId)
            setIsRightInspectorOpen(true)
          }}
          onClose={() => closeCanvasPanel()}
        />
      ) : null}

      {isContinuityCheckerOpen && saveStatus !== 'opening' ? (
        <>
          <div
            className="fixed inset-0 z-[1199]"
            aria-hidden="true"
            onPointerDown={() => closeCanvasPanel()}
          />
          <ContinuityCheckerPanel
            nodes={nodes}
            edges={edges}
            onFocusNode={(nodeId) => {
              setActiveNodeId(nodeId)
              const target = nodes.find((n) => n.id === nodeId)
              if (target) {
                setCanvasPan({
                  x: -(target.x * canvasZoom) + window.innerWidth / 2 - 120,
                  y: -(target.y * canvasZoom) + window.innerHeight / 2 - 80,
                })
              }
            }}
            onClose={() => closeCanvasPanel()}
          />
        </>
      ) : null}

      {isCharacterBibleOpen && saveStatus !== 'opening' ? (
        <CharacterBiblePanel
          bible={characterBible}
          onClose={() => closeCanvasPanel()}
          onSave={persistCharacterBibleSettings}
        />
      ) : null}

      {isSceneBibleOpen && saveStatus !== 'opening' ? (
        <SceneBiblePanel
          open={isSceneBibleOpen}
          bible={sceneBible}
          onClose={() => closeCanvasPanel()}
          onSave={persistSceneBibleSettings}
        />
      ) : null}

      {saveStatus !== 'opening' ? (
        <CinematicCameraControlPanel
          open={isCameraControlOpen}
          value={cameraSettings}
          onChange={updateCameraSettings}
          onClose={() => { setLockedNodeToolContext(null); closeCanvasPanel() }}
          sourceNode={isCameraControlOpen ? (() => {
            const sn = nodes.find((n) => n.id === (lockedNodeToolContext?.targetNodeId ?? null))
            if (!sn) return null
            return { title: sn.title ?? '', kind: (sn.kind === 'image' || sn.kind === 'video' ? sn.kind : 'text') as 'image' | 'video' | 'text', resultImageUrl: sn.resultImageUrl, resultVideoUrl: sn.resultVideoUrl }
          })() : null}
          onCreateDerived={(settings) => {
            const sourceId = lockedNodeToolContext?.targetNodeId ?? null
            const sourceNode = sourceId ? nodes.find((n) => n.id === sourceId) : null
            if (!sourceNode) return
            const cameraCtx = buildCameraPromptContext(settings)
            const derivedPrompt = appendCameraContextToPrompt(sourceNode.prompt ?? '', cameraCtx)
            const toolSummaryText = buildCameraSummaryText(settings) || undefined
            const node = createNode(
              sourceNode.kind === 'video' ? 'video' : 'image',
              {
                title: `${sourceNode.title} · 摄影机`,
                prompt: derivedPrompt,
                parentNodeId: sourceNode.id,
                status: 'idle',
                metadataJson: {
                  derivedFromTool: 'camera-control',
                  derivedFromToolLabel: '摄影机控制',
                  ...(toolSummaryText ? { toolSummaryText } : {}),
                  sourceNodeTitle: sourceNode.title || sourceNode.kind,
                  generationDraft: {
                    status: 'draft',
                    sourceNodeId: sourceNode.id,
                    sourceKind: sourceNode.kind,
                    targetKind: sourceNode.kind === 'video' ? 'video' : 'image',
                    basePrompt: sourceNode.prompt ?? '',
                    derivedPrompt,
                    sourceImageUrl: sourceNode.resultImageUrl ?? null,
                    sourceVideoUrl: sourceNode.resultVideoUrl ?? null,
                    createdAt: new Date().toISOString(),
                  },
                },
                edgeLabel: '摄影机控制',
                edgeToolId: 'camera-control',
                edgeToolIcon: '🎥',
              },
            )
            if (projectId) saveCameraSettingsForNode(projectId, node.id, settings)
            openCanvasPanel('generation', { nodeId: node.id })
            flushLocalSnapshot()
            scheduleCanvasSave(0)
          }}
        />
      ) : null}

      {saveStatus !== 'opening' ? (
        <SceneLightingControlPanel
          open={isSceneLightingOpen}
          value={sceneLightingSettings}
          onChange={updateSceneLightingSettings}
          onClose={() => { setLockedNodeToolContext(null); closeCanvasPanel() }}
          sourceNode={isSceneLightingOpen ? (() => {
            const sn = nodes.find((n) => n.id === (lockedNodeToolContext?.targetNodeId ?? null))
            if (!sn) return null
            return { title: sn.title ?? '', kind: (sn.kind === 'image' || sn.kind === 'video' ? sn.kind : 'text') as 'image' | 'video' | 'text', resultImageUrl: sn.resultImageUrl, resultVideoUrl: sn.resultVideoUrl }
          })() : null}
          onCreateDerived={(settings) => {
            const sourceId = lockedNodeToolContext?.targetNodeId ?? null
            const sourceNode = sourceId ? nodes.find((n) => n.id === sourceId) : null
            if (!sourceNode) return
            const lightingCtx = buildSceneLightingPromptContext(settings)
            const derivedPrompt = appendSceneLightingContextToPrompt(sourceNode.prompt ?? '', lightingCtx)
            const toolSummaryText = buildLightingSummaryText(settings) || undefined
            const node = createNode(
              sourceNode.kind === 'video' ? 'video' : 'image',
              {
                title: `${sourceNode.title} · 光线`,
                prompt: derivedPrompt,
                parentNodeId: sourceNode.id,
                status: 'idle',
                metadataJson: {
                  derivedFromTool: 'scene-lighting',
                  derivedFromToolLabel: '场景光线',
                  ...(toolSummaryText ? { toolSummaryText } : {}),
                  sourceNodeTitle: sourceNode.title || sourceNode.kind,
                  generationDraft: {
                    status: 'draft',
                    sourceNodeId: sourceNode.id,
                    sourceKind: sourceNode.kind,
                    targetKind: sourceNode.kind === 'video' ? 'video' : 'image',
                    basePrompt: sourceNode.prompt ?? '',
                    derivedPrompt,
                    sourceImageUrl: sourceNode.resultImageUrl ?? null,
                    sourceVideoUrl: sourceNode.resultVideoUrl ?? null,
                    createdAt: new Date().toISOString(),
                  },
                },
                edgeLabel: '场景光线',
                edgeToolId: 'scene-lighting',
                edgeToolIcon: '💡',
              },
            )
            if (projectId) saveSceneLightingForNode(projectId, node.id, settings)
            openCanvasPanel('generation', { nodeId: node.id })
            flushLocalSnapshot()
            scheduleCanvasSave(0)
          }}
        />
      ) : null}

      {isPromptBoosterOpen && saveStatus !== 'opening' ? (
        (() => {
          const boostTargetId = lockedNodeToolContext?.targetNodeId ?? null
          const boostSrc = boostTargetId ? nodes.find((n) => n.id === boostTargetId) : null
          const boostSourceNode = boostSrc
            ? { title: boostSrc.title ?? '', kind: (boostSrc.kind === 'image' || boostSrc.kind === 'video' ? boostSrc.kind : 'text') as 'image' | 'video' | 'text', resultImageUrl: boostSrc.resultImageUrl, resultVideoUrl: boostSrc.resultVideoUrl }
            : null
          return (
            <PromptBoosterPanel
              nodes={nodes}
              initialNodeId={boostTargetId ?? undefined}
              lockedNodeId={lockedNodeToolContext?.targetNodeId ?? undefined}
              sourceNode={boostSourceNode}
              onAppendPrompt={(nodeId, appendText) => {
                const target = nodes.find((n) => n.id === nodeId)
                if (!target) return
                const current = (target.prompt ?? '').trim()
                const separator = current ? '\n[Prompt Booster]\n' : ''
                const newPrompt = current + separator + appendText
                handleNodePatch(nodeId, { prompt: newPrompt })
                flushLocalSnapshot()
                scheduleCanvasSave(0)
              }}
              onCreateDerived={(nodeId, appendText, suggestionTitle) => {
                const sourceNode = nodes.find((n) => n.id === nodeId)
                if (!sourceNode) return
                const current = (sourceNode.prompt ?? '').trim()
                const separator = current ? '\n[Prompt Booster]\n' : ''
                const derivedPrompt = current + separator + appendText
                const targetKind = sourceNode.kind === 'video' ? 'video' : (sourceNode.kind === 'text' ? 'text' : 'image')
                const toolSummaryText = suggestionTitle || undefined
                const node = createNode(
                  targetKind,
                  {
                    title: `${sourceNode.title} · 增强`,
                    prompt: derivedPrompt,
                    parentNodeId: sourceNode.id,
                    status: 'idle',
                    metadataJson: {
                      derivedFromTool: 'prompt-booster',
                      derivedFromToolLabel: '提示词增强',
                      ...(toolSummaryText ? { toolSummaryText } : {}),
                      sourceNodeTitle: sourceNode.title || sourceNode.kind,
                      generationDraft: {
                        status: 'draft',
                        sourceNodeId: sourceNode.id,
                        sourceKind: sourceNode.kind,
                        targetKind,
                        basePrompt: current,
                        derivedPrompt,
                        sourceImageUrl: sourceNode.resultImageUrl ?? null,
                        sourceVideoUrl: sourceNode.resultVideoUrl ?? null,
                        createdAt: new Date().toISOString(),
                      },
                    },
                    edgeLabel: '提示词增强',
                    edgeToolId: 'prompt-booster',
                    edgeToolIcon: '✨',
                  },
                )
                openCanvasPanel('generation', { nodeId: node.id })
                flushLocalSnapshot()
                scheduleCanvasSave(0)
              }}
              onClose={() => { setLockedNodeToolContext(null); closeCanvasPanel() }}
            />
          )
        })()
      ) : null}

      {isBatchRewriterOpen && saveStatus !== 'opening' ? (
        <>
          <div
            className="fixed inset-0 z-[1199]"
            aria-hidden="true"
            onPointerDown={() => closeCanvasPanel()}
          />
          <BatchPromptRewriterPanel
            nodes={nodes}
            onBatchPatch={(updates) => {
              for (const { nodeId, prompt } of updates) {
                handleNodePatch(nodeId, { prompt })
              }
              flushLocalSnapshot()
              scheduleCanvasSave(0)
            }}
            onClose={() => closeCanvasPanel()}
          />
        </>
      ) : null}

      {isLookPackageOpen && saveStatus !== 'opening' ? (
        (() => {
          const lookTargetId = lockedNodeToolContext?.targetNodeId ?? null
          const lookSrc = lookTargetId ? nodes.find((n) => n.id === lookTargetId) : null
          const lookSourceNode = lookSrc
            ? { title: lookSrc.title ?? '', kind: (lookSrc.kind === 'image' || lookSrc.kind === 'video' ? lookSrc.kind : 'text') as 'image' | 'video' | 'text', resultImageUrl: lookSrc.resultImageUrl, resultVideoUrl: lookSrc.resultVideoUrl }
            : null
          return (
            <LookPackagePanel
              nodes={nodes.map((n) => ({ ...n, resultImageUrl: n.resultImageUrl ?? null }))}
              lockedNodeId={lockedNodeToolContext?.targetNodeId ?? undefined}
              sourceNode={lookSourceNode}
              onApplyLook={(updates) => {
                for (const { nodeId, prompt } of updates) {
                  handleNodePatch(nodeId, { prompt })
                  if (nodeId === editingNodeId || nodeId === activeNodeId) {
                    setCanvasPrompt(prompt)
                  }
                }
                flushLocalSnapshot()
                scheduleCanvasSave(0)
              }}
              onCreateDerivedNode={({ sourceNodeId, prompt, lookName }) => {
                const sourceNode = nodes.find((n) => n.id === sourceNodeId)
                const sourceTitle = sourceNode?.title?.trim()
                const title = sourceTitle ? `${sourceTitle} · ${lookName}` : `视觉风格版本 · ${lookName}`
                const node = createNode('image', {
                  title,
                  prompt,
                  parentNodeId: sourceNodeId,
                  status: 'idle',
                  metadataJson: {
                    derivedFromTool: 'look-package',
                    derivedFromToolLabel: '视觉风格',
                    toolSummaryText: lookName,
                    sourceNodeTitle: sourceTitle || sourceNode?.kind || 'image',
                    generationDraft: {
                      status: 'draft',
                      sourceNodeId,
                      sourceKind: sourceNode?.kind ?? 'image',
                      targetKind: 'image',
                      basePrompt: sourceNode?.prompt ?? '',
                      derivedPrompt: prompt,
                      sourceImageUrl: sourceNode?.resultImageUrl ?? null,
                      sourceVideoUrl: sourceNode?.resultVideoUrl ?? null,
                      createdAt: new Date().toISOString(),
                    },
                  },
                  edgeLabel: '视觉风格',
                  edgeToolId: 'look-package',
                  edgeToolIcon: '🎨',
                })
                openCanvasPanel('generation', { nodeId: node.id })
                flushLocalSnapshot()
                scheduleCanvasSave(0)
              }}
              onClose={() => { setLockedNodeToolContext(null); closeCanvasPanel() }}
              defaultSelectedNodeId={lookTargetId ?? undefined}
            />
          )
        })()
      ) : null}

      {/* Color Grade Palette — Tool 12, Editing group */}
      {isColorGradePaletteOpen && saveStatus !== 'opening' ? (
        <>
          <div
            className="fixed inset-0 z-[1199]"
            aria-hidden="true"
            onPointerDown={() => closeCanvasPanel()}
          />
          <ColorGradePalettePanel
            nodes={nodes}
            lockedNodeId={lockedNodeToolContext?.targetNodeId ?? undefined}
            onApplyGrade={(updates) => {
              for (const { nodeId, prompt } of updates) {
                handleNodePatch(nodeId, { prompt })
                if (nodeId === editingNodeId || nodeId === activeNodeId) {
                  setCanvasPrompt(prompt)
                }
              }
              flushLocalSnapshot()
              scheduleCanvasSave(0)
            }}
            onCreateGradeNode={(req) => {
              const sourceNode = nodes.find((n) => n.id === req.sourceNodeId)
              const sourceTitle = sourceNode?.title?.trim()
              const title = sourceTitle
                ? `调色版 · ${sourceTitle}`
                : (req.kind === 'image' ? '图片调色版' : '视频调色版')
              const hasAsset = req.kind === 'image'
                ? Boolean(sourceNode?.resultImageUrl?.trim())
                : Boolean(sourceNode?.resultVideoUrl?.trim())
              createNode(req.kind as VisualCanvasNodeKind, {
                title,
                prompt: req.prompt,
                parentNodeId: req.sourceNodeId,
                status: hasAsset ? 'done' : 'idle',
                resultImageUrl: req.kind === 'image' ? (sourceNode?.resultImageUrl ?? undefined) : undefined,
                resultVideoUrl: req.kind === 'video' ? (sourceNode?.resultVideoUrl ?? undefined) : undefined,
                metadataJson: req.cssFilter && req.cssFilter !== 'none'
                  ? { colorGradeCssFilter: req.cssFilter }
                  : undefined,
              })
              flushLocalSnapshot()
              scheduleCanvasSave(0)
            }}
            onClose={() => { setLockedNodeToolContext(null); closeCanvasPanel() }}
            defaultSelectedNodeId={lockedNodeToolContext?.targetNodeId ?? undefined}
          />
        </>
      ) : null}

      {/* Image Annotation — metadata-only drawing layer */}
      {isAnnotationPanelOpen && saveStatus !== 'opening' ? (
        (() => {
          const annotationTargetId = lockedNodeToolContext?.targetNodeId ?? activeNode?.id ?? null
          const annotationSource = annotationTargetId ? nodes.find((node) => node.id === annotationTargetId) ?? null : null
          if (!annotationSource || annotationSource.kind !== 'image') return null
          const mediaUrl = getProxiedMediaUrl(getNodeImageUrl(annotationSource) || (annotationSource.resultImageUrl ?? ''))
          if (!mediaUrl) return null
          return (
            <>
              <div
                className="fixed inset-0 z-[1199]"
                aria-hidden="true"
                onPointerDown={() => { setLockedNodeToolContext(null); closeCanvasPanel() }}
              />
              <AnnotationPanel
                sourceNode={{
                  id: annotationSource.id,
                  title: annotationSource.title,
                  prompt: annotationSource.prompt,
                  mediaUrl,
                  metadataJson: annotationSource.metadataJson,
                }}
                onSave={(annotations) => handleSaveNodeAnnotations(annotationSource.id, annotations)}
                onClose={() => { setLockedNodeToolContext(null); closeCanvasPanel() }}
              />
            </>
          )
        })()
      ) : null}

      {/* Storyboard Grid Split — client-side crop to real Assets */}
      {isStoryboardGridSplitOpen && saveStatus !== 'opening' ? (
        (() => {
          const splitTargetId = lockedNodeToolContext?.targetNodeId ?? activeNode?.id ?? null
          const splitSource = splitTargetId ? nodes.find((node) => node.id === splitTargetId) ?? null : null
          if (!splitSource || splitSource.kind !== 'image') return null
          const sourceMediaUrl = getProxiedMediaUrl(getNodeImageUrl(splitSource) || (splitSource.resultImageUrl ?? ''))
          const sourceAssetId = getNodeAssetId(splitSource)
          return (
            <>
              <div
                className="fixed inset-0 z-[1199]"
                aria-hidden="true"
                onPointerDown={() => { setLockedNodeToolContext(null); closeCanvasPanel() }}
              />
              <StoryboardGridSplitPanel
                projectId={projectId ?? ''}
                workflowId={workflowId}
                sourceNode={{
                  id: splitSource.id,
                  title: splitSource.title,
                  prompt: splitSource.prompt,
                  mediaUrl: sourceMediaUrl,
                  assetId: sourceAssetId,
                }}
                onCreateCellNode={(cell, placementIndex, total) => (
                  handleCreateStoryboardGridCellNode(splitSource.id, cell, placementIndex, total)
                )}
                onUpdateSourceSession={handleStoryboardGridSourceSession}
                onClose={() => { setLockedNodeToolContext(null); closeCanvasPanel() }}
              />
            </>
          )
        })()
      ) : null}

      {/* Remove Background — Asset Remix Tool 1 */}
      {isRemoveBackgroundOpen && saveStatus !== 'opening' && activeNode?.kind === 'image' ? (
        <>
          <div
            className="fixed inset-0 z-[1199]"
            aria-hidden="true"
            onPointerDown={() => closeCanvasPanel()}
          />
          <RemoveBackgroundPanel
            sourceNode={{
              id: activeNode.id,
              title: activeNode.title ?? undefined,
              kind: 'image',
              resultImageUrl: activeNode.resultImageUrl ?? null,
            }}
            projectId={projectId ?? ''}
            workflowId={workflowId}
            onCreateDerivedNode={({ sourceNodeId, title, resultImageUrl, maskUrl, assetTransformMeta }) => {
              // Defense-in-depth: require outputAssetId to confirm platform ingestion.
              // Panels already gate this in handleDone/handleCreateNode. This guard prevents
              // accidental node creation with executor-ephemeral URLs if that check is bypassed.
              const hasStableAsset = !!(assetTransformMeta.outputAssetId as string | undefined)
              const sourceNode = nodes.find((n) => n.id === sourceNodeId)
              createNode('image', {
                title,
                prompt: sourceNode?.prompt ?? '',
                parentNodeId: sourceNodeId,
                status: hasStableAsset && resultImageUrl ? 'done' : 'idle',
                resultImageUrl: hasStableAsset ? resultImageUrl : undefined,
                metadataJson: {
                  assetTransform: assetTransformMeta,
                  ...(maskUrl ? { maskUrl } : {}),
                  toolSummaryText: '主体抠图 · 主体已提取',
                  sourceNodeTitle: sourceNode?.title ?? undefined,
                  derivedToolChannel: {
                    toolId: 'remove-background',
                    label: '✂ 主体抠图',
                    icon: '✂',
                    sourceNodeId,
                  },
                },
              })
              flushLocalSnapshot()
              scheduleCanvasSave(0)
              closeCanvasPanel()
            }}
            onClose={() => closeCanvasPanel()}
          />
        </>
      ) : null}

      {/* HD Reconstruction — Asset Remix Tool 2 */}
      {isHdReconstructionOpen && saveStatus !== 'opening' && activeNode?.kind === 'image' ? (
        <>
          <div
            className="fixed inset-0 z-[1199]"
            aria-hidden="true"
            onPointerDown={() => closeCanvasPanel()}
          />
          <HdReconstructionPanel
            sourceNode={{
              id: activeNode.id,
              title: activeNode.title ?? undefined,
              kind: 'image',
              resultImageUrl: activeNode.resultImageUrl ?? null,
            }}
            projectId={projectId ?? ''}
            workflowId={workflowId}
            onCreateDerivedNode={({ sourceNodeId, title, resultImageUrl, assetTransformMeta }) => {
              // Defense-in-depth: require outputAssetId to confirm platform ingestion.
              const hasStableAsset = !!(assetTransformMeta.outputAssetId as string | undefined)
              const sourceNode = nodes.find((n) => n.id === sourceNodeId)
              createNode('image', {
                title,
                prompt: sourceNode?.prompt ?? '',
                parentNodeId: sourceNodeId,
                status: hasStableAsset && resultImageUrl ? 'done' : 'idle',
                resultImageUrl: hasStableAsset ? resultImageUrl : undefined,
                metadataJson: {
                  assetTransform: assetTransformMeta,
                  toolSummaryText: `高清重建 · ${(assetTransformMeta.params as { scale?: number } | undefined)?.scale ?? 2}×`,
                  sourceNodeTitle: sourceNode?.title ?? undefined,
                  derivedToolChannel: {
                    toolId: 'hd-reconstruction',
                    label: '⬆ 高清重建',
                    icon: '⬆',
                    sourceNodeId,
                  },
                },
              })
              flushLocalSnapshot()
              scheduleCanvasSave(0)
              closeCanvasPanel()
            }}
            onClose={() => closeCanvasPanel()}
          />
        </>
      ) : null}

      <AnimatePresence mode="wait">
        {activePanel === 'assets' ? (
          <motion.section
            key="assets"
            className="canvas-side-panel is-assets-panel"
            aria-label="素材库面板"
            onPointerDown={(event) => event.stopPropagation()}
            initial={{ opacity: 0, x: -18, scale: 0.98, filter: 'blur(8px)' }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -18, scale: 0.98, filter: 'blur(8px)' }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <ProjectAssetsPanel
              projectId={projectId}
              onClose={closeSidePanel}
              onAddAssetToCanvas={handleAddProjectAssetToCanvas}
            />
          </motion.section>
        ) : activePanel === 'templates' ? (
          <motion.div
            key="templates"
            className="canvas-motion-panel-layer"
            initial={{ opacity: 0, x: -20, y: 10, scale: 0.985, filter: 'blur(10px)' }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -20, y: 10, scale: 0.985, filter: 'blur(10px)' }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <CanvasTemplatePanel
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={handleSelectTemplate}
              onClose={closeSidePanel}
            />
          </motion.div>
        ) : activePanel === 'history' ? (
          <motion.div
            key="history"
            className="canvas-motion-panel-layer"
            initial={{ opacity: 0, x: -18, scale: 0.985, filter: 'blur(8px)' }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -18, scale: 0.985, filter: 'blur(8px)' }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <CanvasHistoryPanel
              items={canvasHistoryItems}
              selectedId={selectedHistoryId}
              onSelectItem={handleSelectHistoryItem}
              onClose={closeSidePanel}
            />
          </motion.div>
        ) : activePanel === 'image-editor' ? (
          <motion.div
            key="image-editor"
            className="canvas-motion-panel-layer"
            initial={{ opacity: 0, x: -18, y: 12, scale: 0.985, filter: 'blur(8px)' }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -18, y: 12, scale: 0.985, filter: 'blur(8px)' }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <ImageEditorPanel
              nodeTitle={activeNode?.kind === 'image' ? activeNode.title : '图片编辑器'}
              appliedAction={appliedImageEdit}
              onApply={handleApplyImageEdit}
              onClose={closeSidePanel}
            />
          </motion.div>
        ) : activePanel === 'skills' ? (
          <motion.div
            key="skills"
            className="canvas-motion-panel-layer"
            initial={{ opacity: 0, x: -18, y: 12, scale: 0.985, filter: 'blur(8px)' }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -18, y: 12, scale: 0.985, filter: 'blur(8px)' }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <CanvasSkillPanel
              styleBible={styleBible}
              skills={CREATOR_SKILL_REGISTRY}
              enabledSkillIds={enabledSkillIds}
              onStyleBibleChange={setStyleBible}
              onToggleSkill={toggleCreatorSkill}
              onGenerateTemplate={generateStyleBibleTemplate}
              onApply={() => {
                persistStyleBibleSettings(styleBible, enabledSkillIds)
                showCanvasFeedback('风格圣经与 Skills 已应用。')
              }}
              onClose={closeSidePanel}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {commentsEnabled ? (
        <CanvasCommentsPanel
          comments={comments}
          loading={commentsLoading}
          error={commentsError}
          pendingCount={pendingCommentCount}
          syncingPending={commentsSyncing}
          onAddComment={handleAddComment}
          onRetrySync={retryPendingComments}
          onClose={() => {
            setCommentsEnabled(false)
            showCanvasFeedback('评论模式已关闭。')
          }}
        />
      ) : null}

      {canvasFeedback ? (
        <div className="canvas-feedback-toast" role="status">
          {canvasFeedback}
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className={`canvas-viewport ${isPanning ? 'is-panning' : ''} ${isSpacePressed ? 'is-space-panning' : ''}`}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onDoubleClick={handleCanvasDoubleClick}
        onClick={handleCanvasClick}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.types).includes('Files')) {
            e.preventDefault()
            setIsLocalImageDragOver(true)
          }
        }}
        onDragLeave={(e) => {
          if (!viewportRef.current?.contains(e.relatedTarget as Node)) {
            setIsLocalImageDragOver(false)
          }
        }}
        onDrop={(e) => { void handleLocalImageDrop(e) }}
      >
        {isLocalImageDragOver ? (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 9999,
            background: 'rgba(0,180,255,0.08)',
            border: '2px dashed rgba(0,180,255,0.5)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(0,0,0,0.7)', borderRadius: 10,
              padding: '14px 24px', color: 'rgba(0,200,255,0.9)',
              fontSize: 15, fontWeight: 600, letterSpacing: '0.02em',
            }}>
              拖放图片到画布
            </div>
          </div>
        ) : null}
        {saveStatus !== 'opening' && !hasStarted && nodes.length === 0 ? (
          <div className="canvas-empty-overlay">
            <div className="canvas-empty-hint-row">
              <span className="canvas-empty-hint-badge">
                <span className="canvas-empty-cursor-icon" aria-hidden="true">↖</span>
                <span>双击</span>
              </span>
              <span className="canvas-empty-hint-text">画布自由生成，或查看模板</span>
            </div>
            <div className="canvas-empty-shortcuts">
              {([
                { label: '文字生视频', icon: '⊡', kind: 'video' },
                { label: '图片换背景', icon: '▦', kind: 'image' },
                { label: '首帧生成视频', icon: '✦', kind: 'video' },
                { label: '音频生视频', icon: '♫', kind: 'audio' },
              ] as { label: string; icon: string; kind: VisualCanvasNodeKind }[]).map(({ label, icon, kind }) => (
                <button
                  key={label}
                  type="button"
                  className="canvas-empty-shortcut"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleAddNode(kind, label)
                  }}
                >
                  <span className="canvas-empty-shortcut-icon" aria-hidden="true">{icon}</span>
                  {label}
                </button>
              ))}
              <button
                type="button"
                className="canvas-empty-shortcut"
                onClick={(event) => {
                  event.stopPropagation()
                  setHasStarted(true)
                  onShowStartup()
                }}
              >
                <span className="canvas-empty-shortcut-icon" aria-hidden="true">⊞</span>
                模板
              </button>
            </div>
          </div>
        ) : null}

        <div
          ref={surfaceRef}
          className="canvas-flow-surface"
          style={{
            transform: `translate3d(${canvasPan.x}px, ${canvasPan.y}px, 0) scale(${canvasZoom})`,
          }}
        >

          {edges.length > 0 ? (
            <>
              {edges.map((edge) => {
                const fromNode = nodes.find((node) => node.id === edge.fromNodeId)
                const toNode = nodes.find((node) => node.id === edge.toNodeId)
                if (!fromNode || !toNode) return null

                // UI-only fallback for edges whose labels were lost before the cloud-persistence
                // fix: if the target node has derivedFromToolLabel and its generationDraft.sourceNodeId
                // matches this edge's fromNodeId, recover the label for display without writing to DB.
                const renderedEdgeLabel = edge.label ?? (() => {
                  const toMeta = metadataRecord(toNode.metadataJson)
                  const toolLabel = typeof toMeta.derivedFromToolLabel === 'string' ? toMeta.derivedFromToolLabel : undefined
                  if (!toolLabel) return undefined
                  const draft = metadataRecord(toMeta.generationDraft)
                  return typeof draft.sourceNodeId === 'string' && draft.sourceNodeId === edge.fromNodeId
                    ? toolLabel
                    : undefined
                })()

                const edgeMeta = metadataRecord(edge.metadataJson)
                const edgeChannel = metadataRecord(edgeMeta.derivedToolChannel)
                const renderedToolIcon = typeof edgeChannel.icon === 'string' ? edgeChannel.icon : undefined

                return (
                  <CanvasFlowEdge
                    key={edge.id}
                    id={edge.id}
                    x1={fromNode.x + fromNode.width + CONNECTOR_CENTER_OFFSET}
                    y1={fromNode.y + fromNode.height / 2}
                    x2={toNode.x - CONNECTOR_CENTER_OFFSET}
                    y2={toNode.y + toNode.height / 2}
                    active={edge.id === activeEdgeId || edge.status === 'active' || activeNodeId === fromNode.id || activeNodeId === toNode.id}
                    directorType={getEdgeDirectorConfig(edge.metadataJson)?.type}
                    label={renderedEdgeLabel}
                    toolIcon={renderedToolIcon}
                    onOpenDirector={() => openEdgeDirector(edge.id)}
                  />
                )
              })}
            </>
          ) : null}

          {connectionDraft ? (
            <CanvasFlowEdge
              id={`draft-${connectionDraft.nodeId}`}
              x1={connectionDraft.x1}
              y1={connectionDraft.y1}
              x2={connectionDraft.x2}
              y2={connectionDraft.y2}
              active
            />
          ) : null}

          {nodes.map((node) => (
            <div
              key={node.id}
              className="absolute"
              style={{
                left: node.x,
                top: node.y,
                zIndex: draggingNodeId === node.id ? 12 : activeNodeId === node.id ? 8 : 4,
              }}
            >
              <CanvasNodeErrorBoundary nodeId={node.id}>
                <CanvasNodeCard
                  node={node}
                  active={node.id === activeNode?.id}
                  projectId={projectId}
                  workflowId={workflowId}
                  dragging={draggingNodeId === node.id}
                  onSelect={() => {
                    selectNodeForMove(node)
                  }}
                  onAddPrev={(event) => startConnectionDrag(node.id, 'in', event)}
                  onAddNext={(event) => startConnectionDrag(node.id, 'out', event)}
                  onDragStart={(event) => handleNodeDragStart(node.id, event)}
                  onOpenContextMenu={(event) => openNodeContextMenu(node.id, event.clientX, event.clientY)}
                  onEdit={() => focusPromptForNode(node)}
                  onOpenPreview={(type) => openNodePreview(node, type)}
                  onOpenPromptInspector={() => openPromptInspector(node.id)}
                  onOpenMediaDiagnostics={ASSET_RECOVERY_TOOLS_ENABLED ? (type) => openMediaDiagnostics(node.id, type) : undefined}
                  onCreateStableCopy={ASSET_RECOVERY_TOOLS_ENABLED ? () => createStableCopyFromExpiredNode(node) : undefined}
                  onRecoverMedia={ASSET_RECOVERY_TOOLS_ENABLED ? handleMediaRecoveryPatch : undefined}
                  onRegenerateFromPrompt={ASSET_RECOVERY_TOOLS_ENABLED ? () => handleRegenerateNodeFromPrompt(node) : undefined}
                  enabledSkillCount={0}
                  onOpenSkillPanel={undefined}
                  creativeAssetLabel={creativeAssetLabelForNode(node)}
                  onOpenCreativeAssets={() => openCreativeAssets(node.id)}
                  onOpenAssetIntelligence={() => openCreativeAssets(node.id, { tab: 'intelligence' })}
                  onAddToStoryboard={STORYBOARD_TOOLS_ENABLED ? () => handleAddNodeToDirector(node) : undefined}
                  generationHealth={generationHealth}
                  reframeMode={node.id === activeNodeId ? reframeMode : 'original'}
                  workflowIncomingContext={(() => {
                    const ctx = upstreamContextMap.get(node.id)
                    if (!ctx) return undefined
                    const sourceNode = nodes.find((n) => n.id === ctx.sourceNodeId)
                    if (!sourceNode) return undefined
                    return { sourceNode, isPortraitLikely: ctx.isPortraitLikely }
                  })()}
                  onWorkflowContinue={upstreamContextMap.has(node.id)
                    ? (e) => handleWorkflowContinue(node.id, e)
                    : undefined}
                  onCreateDerivedVideo={node.kind === 'image' && node.status === 'done' && node.resultImageUrl ? () => {
                    const videoNode = createNode('video', { parentNodeId: node.id })
                    openCanvasPanel('generation', { nodeId: videoNode.id })
                  } : undefined}
                  sourceNodeTitle={(() => {
                    const meta = metadataRecord(node.metadataJson)
                    const draft = metadataRecord(meta.generationDraft)
                    const sid = typeof draft.sourceNodeId === 'string' ? draft.sourceNodeId : undefined
                    if (!sid) return undefined
                    return nodeTitleById.get(sid) ?? undefined
                  })()}
                  sourceNodeMissing={(() => {
                    const meta = metadataRecord(node.metadataJson)
                    const draft = metadataRecord(meta.generationDraft)
                    const sid = typeof draft.sourceNodeId === 'string' ? draft.sourceNodeId : undefined
                    return Boolean(sid && !nodeTitleById.has(sid))
                  })()}
                  onOpenGenerationDialog={node.kind === 'text' ? () => openGenerationDialog(node.id) : undefined}
                />
              </CanvasNodeErrorBoundary>
            </div>
          ))}

        </div>
      </div>

      {/* Workflow Connection Context — button lives inside CanvasNodeCard; only the dropdown is rendered here */}

      {/* Global backdrop — closes any open workflow context menu */}
      {openContextMenuAnchor && saveStatus !== 'opening' && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 1079 }}
          onClick={() => setOpenContextMenuAnchor(null)}
        />
      )}

      {/* Dropdown anchored to click position */}
      {openContextMenuAnchor && saveStatus !== 'opening' && (() => {
        const { nodeId, x, y } = openContextMenuAnchor
        const targetNode = nodes.find((n) => n.id === nodeId)
        const ctx = upstreamContextMap.get(nodeId)
        const sourceNode = ctx ? nodes.find((n) => n.id === ctx.sourceNodeId) : undefined
        if (!targetNode) return null
        return (
          <div
            className="w-[230px] overflow-hidden rounded-xl border border-white/12 bg-black/92 shadow-2xl backdrop-blur-md"
            style={{ position: 'fixed', left: x, top: y + 6, zIndex: 1082 }}
            data-no-node-drag="true"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* source → target context header */}
            <div className="border-b border-white/8 px-3 pb-2 pt-2.5">
              <p className="mb-1.5 text-[10px] font-semibold text-white/40">基于上一节点继续</p>
              <div className="space-y-0.5">
                <p className="truncate text-[10px] text-white/30">
                  <span className="text-white/18">来源</span>{' '}
                  <span className="text-white/50">{sourceNode?.title || (sourceNode?.kind === 'image' ? '图片节点' : '视频节点')}</span>
                  {sourceNode?.prompt ? <span className="text-white/22"> · {sourceNode.prompt.slice(0, 18)}{sourceNode.prompt.length > 18 ? '…' : ''}</span> : null}
                </p>
                <p className="truncate text-[10px] text-white/30">
                  <span className="text-white/18">目标</span>{' '}
                  <span className="text-white/50">{targetNode.title || (targetNode.kind === 'image' ? '图片任务' : '视频任务') || '空白任务'}</span>
                </p>
              </div>
            </div>
            {/* Menu items */}
            <div className="py-1">
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition hover:bg-white/[0.06]"
                onClick={() => { handleUpstreamTool(targetNode, 'character-lock', sourceNode); setOpenContextMenuAnchor(null) }}
              >
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-white/80">
                  <span className="text-amber-300/80">👤</span>
                  角色参考 → 传给下游
                </span>
                <span className="pl-5 text-[10px] text-white/30">把上游资产作为下游任务的角色参考</span>
              </button>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition hover:bg-white/[0.06]"
                onClick={() => { handleUpstreamTool(targetNode, 'variant-planner', sourceNode); setOpenContextMenuAnchor(null) }}
              >
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-white/80">
                  <span className="text-violet-300/80">⬡</span>
                  资产变体 → 写入下游
                </span>
                <span className="pl-5 text-[10px] text-white/30">基于上游资产规划变体，追加到下游 Prompt</span>
              </button>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition hover:bg-white/[0.06]"
                onClick={() => { handleUpstreamTool(targetNode, 'camera-lexicon', sourceNode); setOpenContextMenuAnchor(null) }}
              >
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-white/80">
                  <span className="text-sky-300/80">🎬</span>
                  镜头语言 → 添加到下游
                </span>
                <span className="pl-5 text-[10px] text-white/30">给下游任务添加景别 / 运镜 / 光线词</span>
              </button>
            </div>
          </div>
        )
      })()}

      {/* Asset Agent Toolbar — position:fixed to escape canvas-viewport overflow:hidden */}
      {activeNode && toolbarFixedStyle ? (
        <div
          style={toolbarFixedStyle}
          data-no-node-drag="true"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <AssetAgentToolbar
            nodeKind={activeNode.kind}
            hasMediaResult={nodeHasMediaResult(activeNode)}
            mediaUrl={activeNode.kind !== 'text' ? getProxiedMediaUrl(
              activeNode.kind === 'image' ? getNodeImageUrl(activeNode) : getNodeVideoUrl(activeNode),
            ) : ''}
            nodeTitle={activeNode.title}
            nodeId={activeNode.id}
            assetId={activeNode.assetId}
            reframeMode={reframeMode}
            onReframeChange={setReframeMode}
            onFullscreen={() => openNodePreview(activeNode, activeNode.kind === 'image' ? 'image' : 'video')}
            onOpenGenerationDialog={() => openGenerationDialog(activeNode.id)}
            assetTransformCaps={assetTransformCaps}
            onOpenColorGrade={() => openNodeScopedTool('color-grade', activeNode)}
            onOpenLookPackage={() => openNodeScopedTool('look-package', activeNode)}
            onOpenVariantPlanner={() => openNodeScopedTool('variant-planner', activeNode)}
            onOpenABCompare={() => openCanvasPanel('ab-compare')}
            onOpenKeyframeExtractor={() => openCanvasPanel('keyframe-extractor')}
            onOpenCameraControl={() => openNodeScopedTool('camera-control', activeNode)}
            onOpenSceneLighting={() => openNodeScopedTool('scene-lighting', activeNode)}
            onOpenCameraLexicon={() => {
              setWorkflowContext({ sourceNodeId: activeNode.id, targetNodeId: activeNode.id })
              openNodeScopedTool('camera-lexicon', activeNode)
            }}
            onOpenPromptBooster={() => openNodeScopedTool('prompt-booster', activeNode)}
            onOpenScriptSegmentation={
              activeNode.kind === 'text'
                ? () => openScriptSegmentation(activeNode)
                : undefined
            }
            onOpenNarrativeBeatAnalysis={
              activeNode.kind === 'text'
                ? () => openNarrativeBeatAnalysis(activeNode)
                : undefined
            }
            onOpenShotListBuilder={
              activeNode.kind === 'text'
                ? () => openShotListBuilderForNode(activeNode)
                : undefined
            }
            onOpenRemoveBackground={
              activeNode.kind === 'image' && nodeHasMediaResult(activeNode) && assetTransformCaps.removeBackground
                ? () => openCanvasPanel('remove-background')
                : undefined
            }
            onOpenHdReconstruction={
              activeNode.kind === 'image' && nodeHasMediaResult(activeNode) && assetTransformCaps.upscale
                ? () => openCanvasPanel('hd-reconstruction')
                : undefined
            }
            onOpenStoryboardGridSplit={
              activeNode.kind === 'image' && nodeHasMediaResult(activeNode)
                ? () => openNodeScopedTool('storyboard-grid-split', activeNode)
                : undefined
            }
            onOpenDrawAnnotation={
              activeNode.kind === 'image' && nodeHasMediaResult(activeNode)
                ? () => openNodeScopedTool('draw-annotation', activeNode)
                : undefined
            }
          />
        </div>
      ) : null}


      <GenerationTasksPanel
        open={generationTasksOpen}
        tasks={generationTasks}
        onClose={() => setGenerationTasksOpen(false)}
        onQueryTask={handleQueryGenerationTask}
      />

      <EdgeDirectorPanel
        open={Boolean(activeEdge)}
        edge={activeEdge}
        sourceNode={activeEdgeSourceNode}
        targetNode={activeEdgeTargetNode}
        onClose={closeEdgeDirector}
        onPatchEdge={handleEdgePatch}
      />

      {STORYBOARD_TOOLS_ENABLED ? (
        <>
          <StoryboardPreviewPanel
            open={storyboardPreviewOpen}
            nodes={nodes}
            edges={edges}
            projectId={projectId}
            onClose={() => setStoryboardPreviewOpen(false)}
            onOpenPromptInspector={(nodeId) => {
              setStoryboardPreviewOpen(false)
              openPromptInspector(nodeId)
            }}
          />

          <StoryboardDirectorPanel
            open={storyboardDirectorOpen}
            state={directorState}
            activeShotId={directorActiveShotId}
            projectId={projectId}
            canvasNodes={nodes.map((n) => ({
              id: n.id,
              kind: n.kind,
              title: n.title,
              resultImageUrl: n.resultImageUrl,
              resultVideoUrl: n.resultVideoUrl,
            }))}
            onStateChange={(next) => setDirectorState(next)}
            onActiveShotChange={(id) => setDirectorActiveShotId(id)}
            onClose={() => setStoryboardDirectorOpen(false)}
          />
        </>
      ) : null}

      <PromptInspectorPanel
        open={Boolean(activeInspectorNode)}
        node={activeInspectorNode}
        upstreamNodes={activeInspectorUpstreamNodes}
        styleBible={styleBible}
        enabledSkills={enabledCreatorSkills}
        characterContext={activeInspectorCharacterContext}
        sceneContext={activeInspectorSceneContext}
        onClose={closePromptInspector}
      />

      {ASSET_RECOVERY_TOOLS_ENABLED ? (
        <>
          <MediaDiagnosticsPanel
            open={Boolean(activeMediaDiagnostics && activeMediaDiagnosticsNode)}
            node={activeMediaDiagnosticsNode}
            mediaType={activeMediaDiagnostics?.type ?? 'image'}
            mediaUrl={activeMediaDiagnosticsUrl}
            projectId={projectId}
            onClose={closeMediaDiagnostics}
            onPatchNode={handleMediaDiagnosticsPatch}
          />

          <P0MediaDebugPanel
            open={p0MediaDebugOpen}
            projectId={projectId}
            workflowId={workflowId}
            nodes={nodes}
            generationHealth={generationHealth}
            onClose={() => setP0MediaDebugOpen(false)}
            onPatchNode={handleMediaRecoveryPatch}
          />
        </>
      ) : null}

      {activeCreativeAssetsNode ? (
        <CreativeAssetsPanel
          open
          nodeTitle={activeCreativeAssetsNode.title}
          nodes={nodes}
          currentNodeId={activeCreativeAssetsNode.id}
          projectId={projectId}
          characterBible={characterBible}
          sceneBible={sceneBible}
          selectedCharacterIds={getNodeCharacterIds(activeCreativeAssetsNode)}
          selectedSceneIds={getNodeSceneIds(activeCreativeAssetsNode)}
          initialTab={activeCreativeAssetsTab}
          initialSceneLabSourceNodeId={activeSceneLabSourceNodeId}
          onCharacterBibleSave={persistCharacterBibleSettings}
          onSceneBibleSave={persistSceneBibleSettings}
          onCharacterIdsChange={(characterIds) => handleNodeCharacterIdsChange(activeCreativeAssetsNode.id, characterIds)}
          onSceneIdsChange={(sceneIds) => handleNodeSceneIdsChange(activeCreativeAssetsNode.id, sceneIds)}
          onSendPromptToNode={handleSendSceneLabPromptToNode}
          onSceneEditPromptChange={handleSceneLabPromptMetadata}
          onCreateSceneReplaceImageNode={handleCreateSceneReplaceImageNode}
          onClose={closeCreativeAssets}
        />
      ) : null}

      {mediaReviewWindows.map((review) => {
        const reviewNode = nodes.find((node) => node.id === review.nodeId)
        if (!reviewNode) return null
        const mediaUrl = review.type === 'image'
          ? getNodeImageUrl(reviewNode)
          : getNodeVideoUrl(reviewNode)
        if (!mediaUrl) return null
        return (
          <FloatingMediaReviewWindow
            key={review.id}
            review={review}
            node={reviewNode}
            displayUrl={getProxiedMediaUrl(mediaUrl)}
            posterUrl={review.type === 'video' && reviewNode.preview?.poster ? getProxiedMediaUrl(reviewNode.preview.poster) : undefined}
            onClose={closeMediaReviewWindow}
            onFocus={focusMediaReviewWindow}
            onMove={moveMediaReviewWindow}
            onResize={resizeMediaReviewWindow}
          />
        )
      })}

      {/* Portal root for provider panel — outside canvas-node-dialog so the panel escapes overflowY:auto clipping */}
      <div ref={setPanelPortalTarget} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 89 }} />

      {editingNode && nodeDialogStyle ? (
        <div
          className="canvas-node-dialog create-floating-console"
          style={{ ...nodeDialogStyle, height: 'auto', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <UpstreamTaskStrip
            targetNodeId={editingNode.id}
            nodes={nodes}
            edges={edges}
          />
          <LocalReferenceStrip
            nodeKind={editingNode.kind}
            refs={dialogLocalRefs}
            scriptInputs={dialogScriptInputs}
            onImageUpload={(file) => { void handleDialogReferenceUpload(file) }}
            onRemoveRef={handleDialogReferenceRemove}
            onScriptUpload={(file) => { void handleDialogScriptUpload(file) }}
            onRemoveScript={handleDialogScriptRemove}
            onApplyScript={handleDialogScriptApply}
          />
          <CanvasPromptBox
            layout="node"
            multiline
            prompt={canvasPrompt}
            onPromptChange={handlePromptChange}
            model={promptModel}
            modelLabel={activeProviderLabel}
            modelOptionLabels={providerOptionLabels}
            providerStatus={activeProviderStatus}
            providerNotice={activeProviderNotice}
            resultSummary={editingNode.kind === 'text' ? undefined : editingNode.status === 'done' ? (editingNode.resultText ?? editingNode.resultPreview ?? editingNode.outputLabel) : undefined}
            errorMessage={dialogError ?? undefined}
            models={workspaceModels}
            onModelChange={handleProviderChange}
            ratio={promptRatio}
            ratios={WORKSPACE_RATIOS}
            onRatioChange={setPromptRatio}
            placeholder="描述这个节点要生成的内容"
            onGenerate={handleNodeDialogGenerate}
            generateDisabled={
              imageGenerateDisabled ||
              videoGenerateDisabled ||
              isActiveGenerationStatus(editingNode.status) ||
              ((editingNode.kind === 'text' || editingNode.kind === 'image') && billingMode === 'user_provider_account' && !selectedUserAccountId) ||
              (editingNode.kind === 'image' && billingMode === 'user_provider_account' && Boolean(selectedUserAccountId) && !userProviderAccounts.find((a) => a.id === selectedUserAccountId)?.fieldMeta?.endpointId) ||
              editingNode.kind === 'video'
            }
            generateLabel={
              isActiveGenerationStatus(editingNode.status)
                ? '生成中…'
                : editingNode.kind === 'video'
                  ? '视频生成内测中'
                : editingNode.kind === 'image' && !defaultImageProviderId
                  ? '请先配置图片 Provider'
                : editingNode.kind === 'image' && imageGenerateDisabled
                  ? '未配置'
                : editingNode.status === 'error' || editingNode.status === 'failed' || editingNode.status === 'cancelled'
                  ? '重试'
                  : editingNode.status === 'done'
                    ? '重新生成'
                    : activeProviderStatus === 'not-configured'
                      ? '未配置'
                      : activeProviderStatus === 'available'
                        ? '生成'
                        : activeProviderStatus === 'checking'
                          ? '检查中'
                          : '模拟生成'
            }
            estimatedCredits={
              editingNode.kind === 'video'
                ? undefined
                : estimateCreditCost(normalizedPromptModel, getProviderNodeType(editingNode.kind))
            }
            footerItems={promptFooterItems}
            videoModeInfo={editingNode.kind === 'video' ? videoModeInfo : undefined}
            taskInputModeLabel={(() => {
              const hasUpstream = videoModeInfo?.mode === 'image-to-video'
              const hasLocalRef = dialogLocalRefs.some((r) => r.status === 'done' && r.mediaUrl && isProviderAccessibleUrl(r.mediaUrl))
              const mode = getTaskInputMode(
                editingNode.kind as 'text' | 'image' | 'video',
                hasUpstream,
                hasLocalRef,
                CURRENT_PROVIDER_CAPABILITIES,
              )
              if (editingNode.kind === 'video' && videoModeInfo?.mode !== 'text-to-video') return undefined
              return getTaskInputModeLabel(mode)
            })()}
            inputRef={(element) => {
              promptInputRef.current = element
            }}
            onClose={() => closeCanvasPanel()}
            panelPortalTarget={panelPortalTarget}
          />
          {SHOW_GENERATION_CONTEXT_CHIPS && (editingNode.kind === 'text' || editingNode.kind === 'image' || editingNode.kind === 'video') && (
            hasBibleContent({ characterBible, sceneBible, styleBible }) ||
            editingNode.kind === 'image' ||
            editingNode.kind === 'video'
          ) && (
            <div className="border-t border-white/[0.06] px-4 pt-2.5 pb-2 flex flex-wrap gap-1.5">
              {/* Bible context chips — only when content is present */}
              {characterBible.characters.filter((c) => c.name?.trim()).length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-violet-300/70 bg-violet-500/[0.07] border border-violet-500/20 rounded-full px-2.5 py-0.5">
                  ✦ 角色设定 ×{characterBible.characters.filter((c) => c.name?.trim()).length}
                </span>
              )}
              {sceneBible.scenes.filter((s) => s.name?.trim()).length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-violet-300/70 bg-violet-500/[0.07] border border-violet-500/20 rounded-full px-2.5 py-0.5">
                  ✦ 场景设定 ×{sceneBible.scenes.filter((s) => s.name?.trim()).length}
                </span>
              )}
              {hasBibleContent({ styleBible }) && (
                <span className="inline-flex items-center gap-1 text-[10px] text-violet-300/70 bg-violet-500/[0.07] border border-violet-500/20 rounded-full px-2.5 py-0.5">
                  ✦ 风格设定
                </span>
              )}
              {/* Camera control — always visible for image/video nodes */}
              {(editingNode.kind === 'image' || editingNode.kind === 'video') && (
                <button
                  type="button"
                  onClick={() => openNodeScopedTool('camera-control', editingNode)}
                  className={`inline-flex items-center gap-1 text-[10px] rounded-full px-2.5 py-0.5 border transition ${hasCameraContext(cameraSettings) ? 'text-violet-300/70 bg-violet-500/[0.07] border-violet-500/20 hover:bg-violet-500/[0.14] hover:text-violet-200' : 'text-white/30 bg-white/[0.02] border-white/[0.07] hover:text-white/55 hover:border-white/[0.13]'}`}
                >
                  🎥 {hasCameraContext(cameraSettings) ? `摄影机：${getCameraModelLabel(cameraSettings.cameraBody)}` : '摄影机控制'}
                </button>
              )}
              {/* Scene lighting — always visible for image/video nodes */}
              {(editingNode.kind === 'image' || editingNode.kind === 'video') && (
                <button
                  type="button"
                  onClick={() => openNodeScopedTool('scene-lighting', editingNode)}
                  className={`inline-flex items-center gap-1 text-[10px] rounded-full px-2.5 py-0.5 border transition ${hasSceneLightingContext(sceneLightingSettings) ? 'text-amber-300/70 bg-amber-500/[0.07] border-amber-500/20 hover:bg-amber-500/[0.14] hover:text-amber-200' : 'text-white/30 bg-white/[0.02] border-white/[0.07] hover:text-white/55 hover:border-white/[0.13]'}`}
                >
                  💡 {hasSceneLightingContext(sceneLightingSettings) ? `场景光线 ×${activeSceneLightingCount(sceneLightingSettings)}` : '场景光线'}
                </button>
              )}
            </div>
          )}
          {(editingNode.kind === 'text' || editingNode.kind === 'image' || editingNode.kind === 'video') && (
            <div className="border-t border-white/[0.06] px-3 pb-2 pt-2 space-y-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/25">API 费用来源</p>
              {/* Billing mode icon cards */}
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setBillingMode('user_provider_account')}
                  className={`flex flex-col gap-0 rounded-lg border p-1.5 text-left transition ${billingMode === 'user_provider_account' ? 'border-violet-500/40 bg-violet-500/[0.09] text-violet-200' : 'border-white/[0.07] bg-white/[0.02] text-white/45 hover:border-white/[0.13] hover:text-white/65'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs leading-none">🔑</span>
                    <span className={`text-[7px] font-bold rounded-full px-1 py-0.5 ${billingMode === 'user_provider_account' ? 'bg-violet-500/25 text-violet-300' : 'bg-white/[0.05] text-white/25'}`}>推荐</span>
                  </div>
                  <span className="text-[10px] font-semibold mt-0.5 leading-tight">我的 API 账户</span>
                  <span className="text-[8px] leading-tight opacity-55">自有 Key · 费用直扣</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBillingMode('platform_credits')}
                  className={`flex flex-col gap-0 rounded-lg border p-1.5 text-left transition ${billingMode === 'platform_credits' ? 'border-white/20 bg-white/[0.07] text-white' : 'border-white/[0.07] bg-white/[0.02] text-white/45 hover:border-white/[0.13] hover:text-white/65'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs leading-none">🏛</span>
                    <span className="text-[7px] font-bold rounded-full px-1 py-0.5 bg-white/[0.05] text-white/20">内部</span>
                  </div>
                  <span className="text-[10px] font-semibold mt-0.5 leading-tight">平台额度</span>
                  <span className="text-[8px] leading-tight opacity-55">平台积分（内部）</span>
                </button>
              </div>
              {editingNode.kind === 'video' ? (
                billingMode === 'user_provider_account' ? (
                  <p className="text-[10px] text-amber-400/70 leading-relaxed">
                    视频生成 BYOK 即将开放。请先前往{' '}
                    <a href="/account/providers" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-300">API 账户中心</a>
                    {' '}配置火山 / Seedance API Key，开放后即可使用。
                  </p>
                ) : (
                  <p className="text-[10px] text-white/25 leading-relaxed">平台积分视频生成暂未对外开放，不建议使用此模式。</p>
                )
              ) : (
                <>
                  {billingMode === 'platform_credits' && (
                    <p className="text-[10px] text-white/25 leading-relaxed">使用 Creator City 平台额度，由平台代付 Provider 调用费用。</p>
                  )}
                  {billingMode === 'user_provider_account' && (
                    <div className="space-y-1.5">
                      {editingNode.kind === 'image' ? (
                        <p className="text-[9px] text-violet-300/45 leading-relaxed">
                          Seedream 图片 · 费用计入 Volcengine 账户 · Creator City 不代扣
                        </p>
                      ) : (
                        <p className="text-[9px] text-violet-300/45 leading-relaxed">Provider 费用直接计入你的服务商账户，Creator City 不代扣。</p>
                      )}
                      {userAccountsLoading ? (
                        <p className="text-[11px] text-white/30">加载账户中…</p>
                      ) : (() => {
                        const matchingAccounts = editingNode.kind === 'image'
                          ? userProviderAccounts.filter((a) => a.providerId === 'volcengine-seedream-image' && a.status === 'active')
                          : userProviderAccounts.filter((a) => a.providerId === normalizedPromptModel && a.status === 'active')
                        if (matchingAccounts.length === 0) {
                          return (
                            <p className="text-[11px] text-amber-400/70">
                              {editingNode.kind === 'image'
                                ? '没有可用的 Volcengine / Seedream 账户（需要 API Key + Endpoint ID）。'
                                : `没有与 ${normalizedPromptModel} 匹配的可用账户。`}
                              <a href="/account/providers" target="_blank" rel="noopener noreferrer" className="ml-1 underline hover:text-amber-300">前往添加</a>
                            </p>
                          )
                        }
                        const selectedAcc = matchingAccounts.find((a) => a.id === selectedUserAccountId)
                        const missingEndpointId = editingNode.kind === 'image' && Boolean(selectedUserAccountId) && !selectedAcc?.fieldMeta?.endpointId
                        return (
                          <>
                            {/* Visual account card list */}
                            <div className="space-y-1">
                              {matchingAccounts.map((a) => {
                                const isSelected = selectedUserAccountId === a.id
                                const hasEndpoint = Boolean(a.fieldMeta?.endpointId)
                                return (
                                  <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => setSelectedUserAccountId(isSelected ? '' : a.id)}
                                    className={`w-full rounded-xl border px-3 py-2 text-left transition flex items-center justify-between gap-2 ${isSelected ? 'border-violet-500/35 bg-violet-500/[0.09] text-violet-200' : 'border-white/[0.07] bg-white/[0.02] text-white/60 hover:border-white/[0.13] hover:text-white/80'}`}
                                  >
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                      <span className="text-[11px] font-medium truncate">{a.accountLabel}</span>
                                      <span className={`text-[9px] ${isSelected ? 'text-violet-300/50' : 'text-white/30'}`}>
                                        ···· {a.keyLast4}
                                        {hasEndpoint ? ` · EP: ···· ${a.fieldMeta?.endpointId?.last4 ?? '????'}` : ' · 缺少 Endpoint ID'}
                                      </span>
                                    </div>
                                    <div className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center text-[8px] transition ${isSelected ? 'border-violet-500/50 bg-violet-500/20 text-violet-300' : 'border-white/[0.12] text-transparent'}`}>
                                      {isSelected ? '✓' : ''}
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                            {missingEndpointId && (
                              <p className="text-[11px] text-amber-400/70">
                                ⚠ 缺少 Endpoint ID，请到
                                <a href="/account/providers" target="_blank" rel="noopener noreferrer" className="ml-1 underline hover:text-amber-300">我的 API 账户</a>
                                补充火山方舟 Endpoint ID。
                              </p>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ) : null}

      {activePreviewType === 'image' && activePreviewNode?.kind === 'image' && activePreviewImageUrl ? (
        <div
          className="canvas-image-preview-backdrop"
          role="presentation"
          data-node-preview-overlay="true"
          data-no-node-drag="true"
          onClick={() => closeActivePreview()}
        >
          <section
            className={`canvas-image-preview-dialog ${showSceneToolPreview ? 'has-scene-tools' : 'is-node-content-preview'}`}
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
            data-node-preview-overlay="true"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            onWheelCapture={(event) => event.stopPropagation()}
          >
            {showSceneToolPreview ? (
              <div className="canvas-image-preview-head">
                <span>{activePreviewNode.title}</span>
                <button type="button" onClick={() => closeActivePreview()} aria-label="关闭图片预览">×</button>
              </div>
            ) : null}
            <div className={`canvas-image-preview-stage ${showSceneToolPreview ? 'has-scene-tools' : 'is-lightbox'}`}>
              {showSceneToolPreview ? (
                <>
              <SceneToolLayer
                imageUrl={activePreviewImageUrl}
                imageAlt={activePreviewNode.title}
                activeTool={activeSceneTool}
                sceneEdits={activePreviewSceneEdits}
                selectedEditId={selectedSceneEditId}
                onSceneEditsChange={(sceneEdits) => handleNodeSceneEditsChange(activePreviewNode.id, sceneEdits)}
                onSelectEdit={setSelectedSceneEditId}
              />
              <SceneToolPalette
                activeTool={activeSceneTool}
                sceneEdits={activePreviewSceneEdits}
                selectedEditId={selectedSceneEditId}
                copied={sceneEditInstructionsCopied}
                onToolChange={setActiveSceneTool}
                onSelectEdit={setSelectedSceneEditId}
                onInstructionChange={(editId, instruction) => {
                  handleNodeSceneEditsChange(activePreviewNode.id, activePreviewSceneEdits.map((edit) => (
                    edit.id === editId ? { ...edit, instruction } : edit
                  )))
                }}
                onDeleteEdit={(editId) => {
                  handleNodeSceneEditsChange(activePreviewNode.id, activePreviewSceneEdits.filter((edit) => edit.id !== editId))
                  if (selectedSceneEditId === editId) setSelectedSceneEditId('')
                }}
                onClearEdits={() => {
                  handleNodeSceneEditsChange(activePreviewNode.id, [])
                  setSelectedSceneEditId('')
                }}
                onCopyInstructions={() => { void copySceneEditInstructions(activePreviewSceneEdits) }}
                onSaveLayer={() => showCanvasFeedback('场景工具层已保存到当前图片节点。')}
              />
                </>
              ) : (
                <img
                  src={activePreviewImageDisplayUrl}
                  alt={activePreviewNode.title}
                  className="canvas-image-preview-media"
                  draggable={false}
                />
              )}
            </div>
            {showSceneToolPreview ? (
              <div className="canvas-image-preview-actions">
                <button type="button" onClick={() => { void copyActivePreviewLink(activePreviewImageUrl) }}>
                  {previewLinkCopied ? '已复制' : '复制图片链接'}
                </button>
                <button type="button" onClick={() => openActivePreviewLink(activePreviewImageUrl)}>
                  新标签页打开
                </button>
                <button type="button" onClick={() => closeActivePreview()}>关闭</button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {activePreviewType === 'video' && activePreviewNode?.kind === 'video' && activePreviewVideoUrl ? (
        <div
          className="canvas-video-preview-backdrop"
          role="presentation"
          data-node-preview-overlay="true"
          data-no-node-drag="true"
          onClick={() => closeActivePreview()}
        >
          <section
            className="canvas-video-preview-dialog is-node-content-preview"
            role="dialog"
            aria-modal="true"
            aria-label="视频预览"
            data-node-preview-overlay="true"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <video
              src={activePreviewVideoDisplayUrl}
              poster={activePreviewNode.preview?.poster ? getProxiedMediaUrl(activePreviewNode.preview.poster) : undefined}
              className="canvas-video-preview-media"
              controls
              autoPlay
              playsInline
            />
          </section>
        </div>
      ) : null}

      {textEditorNode ? (
        <div
          className="canvas-text-editor-backdrop"
          role="presentation"
          data-node-preview-overlay="true"
        >
          <section
            className="canvas-text-editor-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="canvas-text-editor-title"
            data-node-preview-overlay="true"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <div className="canvas-text-editor-head">
              <div className="min-w-0">
                <h2 id="canvas-text-editor-title">查看/编辑文本</h2>
                <div className="canvas-text-editor-meta">
                  <span>{textEditorProviderLabel || textEditorProviderId || 'Text Provider'}</span>
                  <span>{textEditorModel || 'default'}</span>
                  <span>{getNodeStatusLabel(textEditorNode.status)}</span>
                </div>
              </div>
              <button type="button" className="canvas-text-editor-close" onClick={() => closeActivePreview()} aria-label="关闭">
                ×
              </button>
            </div>

            <textarea
              className="canvas-text-editor-textarea"
              value={textEditorDraft}
              onChange={(event) => setTextEditorDraft(event.target.value)}
              onWheel={(event) => event.stopPropagation()}
              onWheelCapture={(event) => event.stopPropagation()}
              placeholder=""
            />

            <div className="canvas-text-editor-actions">
              <button type="button" className="canvas-text-editor-button" onClick={copyTextEditor}>
                {textEditorCopied ? '已复制' : '复制文本'}
              </button>
              <div className="canvas-text-editor-action-spacer" />
              <button type="button" className="canvas-text-editor-button" onClick={() => closeActivePreview()}>
                取消
              </button>
              <button type="button" className="canvas-text-editor-button is-primary" onClick={saveTextEditor}>
                保存修改
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {nodeAddMenu && connectorNode ? (
        <div
          className="canvas-node-add-menu"
          style={{ left: nodeAddMenu.x, top: nodeAddMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {/* Source summary */}
          <div className="px-2.5 pb-1.5 pt-2">
            <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/30">引用该节点生成</p>
            <p className="truncate text-[10px] text-white/55">
              {connectorNode.title || (connectorNode.kind === 'image' ? '图片节点' : connectorNode.kind === 'video' ? '视频节点' : '文本节点')}
              {connectorNode.prompt?.trim() ? (
                <span className="text-white/30"> · {connectorNode.prompt.trim().slice(0, 24)}{connectorNode.prompt.trim().length > 24 ? '…' : ''}</span>
              ) : null}
            </p>
          </div>

          {/* ── 继续创作 section — shown when source has any content ── */}
          {(connectorNode.resultImageUrl || connectorNode.resultVideoUrl || connectorNode.assetId || connectorNode.prompt?.trim()) ? (
            <>
              <div className="canvas-menu-divider" />
              <div className="canvas-menu-label">继续创作</div>

              <button
                type="button"
                className="flex w-full flex-col gap-0.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.07]"
                onClick={() => handleWorkflowCreateAndOpen(connectorNode.id, 'image', 'character-lock')}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300/90">
                  <span>👤</span>角色参考生成
                </span>
                <span className="pl-5 text-[9px] leading-tight text-white/35">把该资产传给下游角色任务</span>
              </button>

              <button
                type="button"
                className="flex w-full flex-col gap-0.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.07]"
                onClick={() => handleWorkflowCreateAndOpen(connectorNode.id, connectorNode.kind === 'video' ? 'video' : 'image', 'variant-planner')}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-violet-300/90">
                  <span>⬡</span>资产变体生成
                </span>
                <span className="pl-5 text-[9px] leading-tight text-white/35">基于该资产规划不同版本</span>
              </button>

              <button
                type="button"
                className="flex w-full flex-col gap-0.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.07]"
                onClick={() => handleWorkflowCreateAndOpen(connectorNode.id, 'video', 'camera-lexicon')}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-sky-300/90">
                  <span>🎬</span>镜头语言生成
                </span>
                <span className="pl-5 text-[9px] leading-tight text-white/35">为下一个视频补充景别运镜</span>
              </button>
            </>
          ) : null}

          {/* ── 新建任务 section ── */}
          <div className="canvas-menu-divider" />
          <div className="canvas-menu-label">新建任务</div>
          {([
            { kind: 'text', label: '文本生成' },
            { kind: 'image', label: '图片生成' },
            { kind: 'video', label: '视频生成' },
            { kind: 'audio', label: '音频' },
            { kind: 'world', label: '3D 世界', badge: 'Beta' },
          ] as { kind: VisualCanvasNodeKind; label: string; badge?: string }[]).map(({ kind, label, badge }) => (
            <button
              key={kind}
              type="button"
              onClick={() => handleAddSpecificNextNode(connectorNode.id, kind)}
              className="canvas-menu-item"
            >
              <span>{label}</span>
              {badge ? <span className="canvas-menu-badge">{badge}</span> : <span className="canvas-menu-shortcut">+</span>}
            </button>
          ))}
        </div>
      ) : null}

      {nodeCreateMenu ? (
        <div
          className="canvas-node-create-menu"
          style={{ left: nodeCreateMenu.x, top: nodeCreateMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="canvas-menu-label">创建节点</div>
          {([
            { kind: 'text', label: '文本', icon: '✦' },
            { kind: 'image', label: '图片', icon: '◫' },
            { kind: 'video', label: '视频', icon: '▣' },
            { kind: 'audio', label: '音频', icon: '♫' },
            { kind: 'world', label: '3D 世界', icon: '◎', badge: 'Beta' },
          ] as { kind: VisualCanvasNodeKind; label: string; icon: string; badge?: string }[]).map(({ kind, label, icon, badge }) => (
            <button
              key={kind}
              type="button"
              onClick={() => handleCreateMenuSelect(kind)}
              className="canvas-menu-item"
            >
              <span className="canvas-menu-item-row">
                <span className="canvas-menu-item-icon">{icon}</span>
                <span>{label}</span>
              </span>
              {badge ? <span className="canvas-menu-badge">{badge}</span> : null}
            </button>
          ))}
          <div className="canvas-menu-divider" />
          <button
            type="button"
            onClick={() => handleCreateMenuSelect('upload')}
            className="canvas-menu-item"
          >
            <span className="canvas-menu-item-row">
              <span className="canvas-menu-item-icon">↑</span>
              <span>上传</span>
            </span>
          </button>
        </div>
      ) : null}

      {contextMenu && menuNode ? (
        <div
          className="canvas-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => markNodeSaved(menuNode.id, '已模拟保存到素材库，可在 Assets 中继续接入真实素材库。')}
            className="canvas-menu-item"
          >
            保存到素材库
          </button>
          <button
            type="button"
            onClick={() => copyNodeToClipboard(menuNode)}
            className="canvas-menu-item"
          >
            复制
          </button>
          <button
            type="button"
            onClick={() => duplicateNode(menuNode)}
            className="canvas-menu-item"
          >
            副本
          </button>
          <div className="canvas-menu-divider" />
          <button
            type="button"
            onClick={() => deleteNode(menuNode.id)}
            className="canvas-menu-item is-danger"
          >
            删除
          </button>
          <button
            type="button"
            onClick={() => markNodeSaved(menuNode.id, '已记录问题反馈占位，后续可接入真实反馈系统。')}
            className="canvas-menu-item"
          >
            问题反馈
          </button>
        </div>
      ) : null}

      <BeginnerGuidePanel />

      <div className="canvas-zoom-controls">
        <span className="canvas-zoom-icon">⌗</span>
        <button type="button" onClick={fitCanvasView} className="canvas-zoom-reset">
          Fit
        </button>
        <input
          aria-label="Canvas zoom"
          type="range"
          min={MIN_CANVAS_ZOOM}
          max={MAX_CANVAS_ZOOM}
          step={0.01}
          value={canvasZoom}
          onChange={(event) => setZoomAroundPoint(Number(event.target.value))}
          className="canvas-zoom-slider"
        />
        <button type="button" onClick={resetCanvasView} className="canvas-zoom-reset">
          {Math.round(canvasZoom * 100)}%
        </button>
      </div>

      <CreditInsufficientModal
        open={creditModal.open}
        onClose={() => setCreditModal((prev) => ({ ...prev, open: false }))}
        requiredCredits={creditModal.requiredCredits}
        availableCredits={creditModal.availableCredits}
      />
    </div>
    </div>
    </CanvasWorkspaceShell>
  )
}
