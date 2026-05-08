'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent } from 'react'
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
import { PromptInspectorPanel } from '@/components/create/PromptInspectorPanel'
import { StoryboardPreviewPanel } from '@/components/create/StoryboardPreviewPanel'
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
import { normalizeAssetType } from '@/lib/assets/normalize'
import { getToolProviderById, type ToolProviderNodeType, type ToolProviderStatus } from '@/lib/tools/provider-catalog'
import { isPlaceholderProjectId } from '@/lib/routing/placeholders'
import {
  runCanvasWorkflow,
  type CanvasWorkflowRunNodeResult,
  type CanvasWorkflowInputAsset,
} from '@/lib/canvas/workflow-runner'
import { collectGenerationTasks, type CanvasGenerationTask } from '@/lib/canvas/generation-tasks'
import { buildEdgeDirectivesForNode, getEdgeDirectorConfig } from '@/lib/canvas/edge-director'
import { compileNodePrompt, type CompiledNodePrompt } from '@/lib/prompt'
import { buildStoryboardFromCanvas } from '@/lib/storyboard'
import { CREATOR_SKILL_REGISTRY, getDefaultCreatorSkillIds, resolveCreatorSkills, type ProjectStyleBible } from '@/lib/skills'
import {
  characterIdsMetadata,
  getNodeCharacterIds,
  loadCharacterBible,
  saveCharacterBible,
  type CharacterBible,
} from '@/lib/characters'
import {
  getNodeSceneIds,
  loadSceneBible,
  saveSceneBible,
  sceneIdsMetadata,
  type SceneBible,
} from '@/lib/scenes'
import canvasStyles from '@/components/create/canvas.module.css'

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
type WorkflowRunStatus = 'idle' | 'running' | 'done' | 'partial-failed' | 'error'

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

interface ServerVersionPrompt {
  workflowId: string
  nodes: VisualCanvasNode[]
  edges: CanvasEdge[]
  viewport?: unknown
  serverUpdatedAt?: string
}

type LocalCanvasSource = 'snapshot' | 'cache' | 'draft'

function getDraftKey(projectId: string) {
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

function getEnabledSkillsKey(projectId: string) {
  return `creator-city:enabled-skills:${projectId}`
}

function timeValue(input?: string) {
  if (!input) return 0
  const value = new Date(input).getTime()
  return Number.isFinite(value) ? value : 0
}

function isLocalCanvasNewer(
  local: { updatedAt?: string; syncedAt?: string; serverUpdatedAt?: string },
  serverUpdatedAt?: string,
) {
  const localUpdatedAt = timeValue(local.updatedAt)
  const localSyncedAt = Math.max(timeValue(local.syncedAt), timeValue(local.serverUpdatedAt))
  const serverTime = timeValue(serverUpdatedAt)
  return localUpdatedAt > Math.max(localSyncedAt, serverTime) + 500
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
  resultImageUrl?: string
  resultVideoUrl?: string
  resultAudioUrl?: string
  resultText?: string
  metadataJson?: unknown
}

type CanvasEdgeStatus = 'idle' | 'active' | 'done'

interface CanvasEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  status: CanvasEdgeStatus
  type?: string
  metadataJson?: unknown
}

const NODE_META: Record<VisualCanvasNodeKind, { title: string; subtitle: string; model: string; ratio?: string }> = {
  text: { title: '文本', subtitle: '从一句想法、脚本片段或 brief 开始。', model: 'openai-text' },
  image: { title: '图片', subtitle: '先做视觉方向、关键画面与风格参考。', model: 'openai-image', ratio: '16:9' },
  video: { title: '视频', subtitle: '直接推进镜头、节奏和画面运动。', model: 'custom-video-gateway', ratio: '16:9' },
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
  video: { width: 288, height: 162 },
  audio: { width: 360, height: 260 },
  asset: { width: 360, height: 280 },
  template: { width: 360, height: 280 },
  delivery: { width: 360, height: 280 },
  world: { width: 380, height: 320 },
  upload: { width: 360, height: 280 },
}

const WORKSPACE_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9']
const MIN_CANVAS_ZOOM = 0.35
const MAX_CANVAS_ZOOM = 1.8
const CANVAS_ZOOM_STEP = 0.1
const CONNECTOR_CENTER_OFFSET = 23
const CONNECTION_DRAFT_HANDLE_OFFSET = 36
const DOWNSTREAM_NODE_X_GAP = 820
const DOWNSTREAM_NODE_Y_GAP = 220
const NODE_MENU_WIDTH = 214
const NODE_MENU_HEIGHT = 252
const NODE_ADD_MENU_WIDTH = 190
const NODE_ADD_MENU_HEIGHT = 220
const NODE_DIALOG_GAP = 16
const NODE_DIALOG_HEIGHT = 210
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

const TEXT_NODE_PROVIDER_OPTIONS = [
  { value: 'openai-text', label: 'OpenAI Text', hint: '默认文本生成', badge: 'available', duration: '10~20s' },
  { value: 'deepseek-text', label: 'DeepSeek V4 Flash', hint: '中文文本 · 快速', badge: 'available', duration: '10~20s' },
  { value: 'deepseek-reasoner', label: 'DeepSeek V4 Pro', hint: '中文文本 · 推理增强', badge: 'available', duration: '15~30s' },
  { value: 'kimi-text', label: 'Kimi K2.6', hint: '中文文本 · Kimi', badge: 'available', duration: '10~20s' },
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
  if (status === 'queued') return '排队中'
  if (status === 'running' || status === 'generating') return '运行中'
  if (status === 'done') return '完成'
  if (status === 'error') return '失败'
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
  asset?: { id?: string; url?: string | null }
  upstreamStatus?: number
  upstreamMessage?: string
  rawCode?: string
  requestId?: string
  missingEnv?: string[]
  missingEnvKeys?: string[]
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

function normalizeGenerateErrorMessage(result: Pick<GenerateApiResult, 'errorCode' | 'message'>) {
  const message = result.message ?? ''
  if (
    result.errorCode === 'KIMI_REQUEST_TIMEOUT'
    || (result.errorCode === 'KIMI_TEXT_FAILED' && message.toLowerCase().includes('abort'))
  ) {
    return 'Kimi 请求超时或被中断，请重试。'
  }
  return message
}

function formatGenerateError(result: GenerateApiResult) {
  const message = normalizeGenerateErrorMessage(result)
  return [
    result.errorCode,
    message,
    result.model ? `model: ${result.model}` : '',
    typeof result.upstreamStatus === 'number' ? `upstreamStatus: ${result.upstreamStatus}` : '',
    result.upstreamMessage ? `upstream: ${result.upstreamMessage.slice(0, 200)}` : '',
  ].filter(Boolean).join(' · ') || '生成失败'
}

function getGeneratedText(result: GenerateApiResult) {
  return result.result?.text ?? result.resultText ?? result.text
}

function metadataRecord(metadataJson: unknown) {
  return metadataJson && typeof metadataJson === 'object' && !Array.isArray(metadataJson)
    ? metadataJson as Record<string, unknown>
    : {}
}

function isPromptCompilerNodeKind(kind: VisualCanvasNodeKind): kind is 'text' | 'image' | 'video' {
  return kind === 'text' || kind === 'image' || kind === 'video'
}

function compactText(value: string | undefined, limit: number) {
  const text = value?.trim() ?? ''
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function compiledPromptMetadata(metadataJson: unknown, compiled: CompiledNodePrompt) {
  return {
    ...metadataRecord(metadataJson),
    compiledPromptPreview: compactText(compiled.prompt, 1600),
    compiledPromptDebug: {
      ...compiled.debug,
      userPrompt: compactText(compiled.debug.userPrompt, 300),
    },
    compiledAt: new Date().toISOString(),
  }
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
      at: new Date().toISOString(),
    },
  }
}

function imageSuccessMetadata(node: VisualCanvasNode, result: GenerateApiResult, providerId: string) {
  return {
    ...metadataRecord(node.metadataJson),
    providerId: result.providerId || providerId,
    model: result.model ?? result.result?.metadata?.model,
    generationSource: result.providerId || providerId,
    assetId: result.asset?.id ?? result.result?.metadata?.assetId,
  }
}

function videoSuccessMetadata(node: VisualCanvasNode, result: GenerateApiResult, providerId: string) {
  const resultMetadata = result.result?.metadata && typeof result.result.metadata === 'object'
    ? result.result.metadata as Record<string, unknown>
    : {}
  const taskId = result.taskId ?? (typeof resultMetadata.taskId === 'string' ? resultMetadata.taskId : undefined)
  const generationJobId = result.jobId
    ?? (typeof resultMetadata.generationJobId === 'string' ? resultMetadata.generationJobId : undefined)
    ?? taskId
  const submittedAt = result.submittedAt ?? (typeof resultMetadata.submittedAt === 'string' ? resultMetadata.submittedAt : undefined)
  const completedAt = result.completedAt ?? (typeof resultMetadata.completedAt === 'string' ? resultMetadata.completedAt : undefined)
  return {
    ...metadataRecord(node.metadataJson),
    providerId: result.providerId || providerId,
    model: result.model ?? (typeof resultMetadata.model === 'string' ? resultMetadata.model : undefined),
    taskId,
    generationJobId,
    ...(submittedAt ? { submittedAt } : {}),
    ...(completedAt ? { completedAt } : {}),
  }
}

function videoErrorMetadata(node: VisualCanvasNode, result: Pick<GenerateApiResult, 'errorCode' | 'message' | 'upstreamStatus' | 'upstreamMessage' | 'rawCode' | 'requestId' | 'model' | 'providerId' | 'taskId'>, providerId: string) {
  return {
    ...metadataRecord(node.metadataJson),
    providerId: result.providerId || providerId,
    model: result.model,
    taskId: result.taskId,
    generationJobId: result.taskId,
    lastError: {
      errorCode: result.errorCode,
      message: normalizeGenerateErrorMessage(result),
      upstreamStatus: result.upstreamStatus,
      upstreamMessage: result.upstreamMessage,
      rawCode: result.rawCode,
      requestId: result.requestId,
      at: new Date().toISOString(),
    },
  }
}

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
): Promise<GenerateApiResult> {
  const endpoint =
    nodeType === 'image' ? '/api/generate/image'
    : nodeType === 'video' ? '/api/generate/video'
    : nodeType === 'audio' ? '/api/generate/audio'
    : '/api/generate/text'
  const maxTokens = nodeType === 'text' ? 1024 : undefined

  if (process.env.NODE_ENV !== 'production') {
    console.info('[canvas-generate] submit', { nodeType, providerId })
  }

  const firstImageUrl = inputAssets?.find((asset) => asset.type === 'image' && asset.url)?.url
  const requestBody = {
    providerId,
    nodeType,
    prompt,
    compiledPrompt: prompt,
    system,
    params,
    maxTokens,
    nodeId,
    inputAssets,
    projectId,
    workflowId,
    ...(nodeType === 'video'
      ? {
          imageUrl: firstImageUrl,
          duration: typeof params?.duration === 'number' ? params.duration : 5,
          aspectRatio: typeof params?.aspectRatio === 'string'
            ? params.aspectRatio
            : typeof params?.ratio === 'string'
              ? params.ratio
              : '16:9',
        }
      : {}),
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(requestBody),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '网络请求失败'
    return { success: false, providerId, mode: 'unavailable', status: 'failed', message, errorCode: 'PROVIDER_REQUEST_FAILED' }
  }

  const raw = await response.text().catch(() => '')
  if (!raw.trim()) {
    return { success: false, providerId, mode: 'unavailable', status: 'failed', message: `生成接口返回空响应（HTTP ${response.status}）`, errorCode: 'EMPTY_RESPONSE' }
  }
  try {
    return JSON.parse(raw) as GenerateApiResult
  } catch {
    return { success: false, providerId, mode: 'unavailable', status: 'failed', message: `生成接口返回非 JSON 响应（HTTP ${response.status}）`, errorCode: 'NON_JSON_RESPONSE' }
  }
}

async function pollGenerationJob(jobId: string): Promise<GenerateApiResult> {
  let response: Response
  try {
    response = await fetch(`/api/generate/jobs/${encodeURIComponent(jobId)}`, {
      credentials: 'include',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '网络请求失败'
    return { success: false, providerId: '', mode: 'unavailable', status: 'failed', message }
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

async function pollSeedanceVideoTask(providerId: string, taskId: string): Promise<GenerateApiResult> {
  let response: Response
  try {
    const params = new URLSearchParams({ providerId, taskId })
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

function workflowPromptForNode(node: VisualCanvasNode, upstreamText: string) {
  const ownPrompt = node.prompt?.trim() ?? ''
  const context = upstreamText.trim()
  if (node.kind === 'image') {
    return ownPrompt && context
      ? `${ownPrompt}\n\n上游文本上下文：\n${context}`
      : ownPrompt || context
  }
  if (node.kind === 'video') {
    return ownPrompt && context
      ? `${ownPrompt}\n\n上游文本上下文：\n${context}`
      : ownPrompt || context || '根据上游素材生成视频镜头。'
  }
  return ownPrompt && context
    ? `${ownPrompt}\n\n参考上游上下文：\n${context}`
    : ownPrompt || context
}

function workflowInputAssets(inputAssets: CanvasWorkflowInputAsset[]) {
  return inputAssets
    .filter((asset): asset is CanvasWorkflowInputAsset & { type: 'image' | 'video' | 'audio'; url: string } => (
      Boolean(asset.url) && (asset.type === 'image' || asset.type === 'video' || asset.type === 'audio')
    ))
    .map((asset) => ({ id: asset.id, type: asset.type, url: asset.url }))
}

function isReusableAssetNode(node: VisualCanvasNode) {
  return node.providerId === 'asset-library'
    || node.kind === 'asset'
    || node.kind === 'upload'
    || (node.kind === 'image' && Boolean(node.resultImageUrl))
}

function passthroughWorkflowResult(node: VisualCanvasNode): CanvasWorkflowRunNodeResult {
  return {
    resultText: node.resultText,
    resultImageUrl: node.resultImageUrl,
    resultVideoUrl: node.resultVideoUrl,
    resultAudioUrl: node.resultAudioUrl,
    resultPreview: node.resultPreview ?? node.outputLabel ?? '节点结果已作为下游输入。',
    outputLabel: node.outputLabel ?? '已有结果',
    preview: node.preview,
    metadataJson: node.metadataJson,
  }
}

function workflowErrorFromGenerateResult(node: VisualCanvasNode, result: GenerateApiResult) {
  if (node.kind === 'video' && (result.status === 'not-configured' || result.errorCode === 'PROVIDER_NOT_CONFIGURED')) {
    return `VIDEO_PROVIDER_NOT_CONFIGURED: ${result.message || '视频 provider 未配置'}`
  }
  return result.errorCode ? `${result.errorCode}: ${result.message}` : result.message || '节点运行失败。'
}

function workflowResultFromGenerateResult(node: VisualCanvasNode, result: GenerateApiResult, fallbackPrompt: string): CanvasWorkflowRunNodeResult {
  const resultText = getGeneratedText(result)
  const resultImageUrl = result.result?.imageUrl
  const resultVideoUrl = result.result?.videoUrl
  const resultAudioUrl = result.result?.audioUrl
  if (node.kind === 'video' && result.async && result.taskId) {
    return {
      status: 'running',
      resultVideoUrl: node.resultVideoUrl,
      resultPreview: '视频任务已提交，正在生成中',
      outputLabel: '视频生成中',
      preview: node.preview,
      metadataJson: videoSuccessMetadata(node, result, node.providerId || node.model),
    }
  }
  const fallbackPreview = fallbackPrompt ? buildMockResult(node, fallbackPrompt) : `${node.title} 已完成`
  const resultPreview = resultText?.slice(0, 200)
    ?? (resultImageUrl ? '图片已生成' : resultVideoUrl ? '视频已生成' : resultAudioUrl ? '音频已生成' : fallbackPreview)

  return {
    resultText,
    resultImageUrl: resultImageUrl ?? node.resultImageUrl,
    resultVideoUrl: resultVideoUrl ?? node.resultVideoUrl,
    resultAudioUrl: resultAudioUrl ?? node.resultAudioUrl,
    resultPreview,
    outputLabel: resultText?.slice(0, 80) ?? resultPreview,
    preview: resultVideoUrl
      ? { type: 'remote-video', url: resultVideoUrl, poster: result.result?.previewUrl, licenseType: 'original', attribution: 'Generated by configured video provider' }
      : node.preview,
    metadataJson: node.metadataJson,
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
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
  const [workflowRunStatus, setWorkflowRunStatus] = useState<WorkflowRunStatus>('idle')
  const [workflowRunMessage, setWorkflowRunMessage] = useState('')
  const [draftRestorePrompt, setDraftRestorePrompt] = useState<DraftRestorePrompt | null>(null)
  const [serverVersionPrompt, setServerVersionPrompt] = useState<ServerVersionPrompt | null>(null)
  const [nodes, setNodes] = useState<VisualCanvasNode[]>([])
  const [edges, setEdges] = useState<CanvasEdge[]>([])
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<string>('add')
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const [canvasPrompt, setCanvasPrompt] = useState('')
  const [promptModel, setPromptModel] = useState('custom-video-gateway')
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
  const [styleBible, setStyleBible] = useState<ProjectStyleBible>({})
  const [characterBible, setCharacterBible] = useState<CharacterBible>({ characters: [] })
  const [sceneBible, setSceneBible] = useState<SceneBible>({ scenes: [] })
  const [enabledSkillIds, setEnabledSkillIds] = useState<string[]>(() => getDefaultCreatorSkillIds())
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [nodeAddMenu, setNodeAddMenu] = useState<{ nodeId: string; direction: 'in' | 'out'; x: number; y: number; worldX: number; worldY: number } | null>(null)
  const [nodeCreateMenu, setNodeCreateMenu] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null)
  const [activePreviewNodeId, setActivePreviewNodeId] = useState<string | null>(null)
  const [activePreviewType, setActivePreviewType] = useState<CanvasNodePreviewType | null>(null)
  const [activeInspectorNodeId, setActiveInspectorNodeId] = useState<string | null>(null)
  const [activeCreativeAssetsNodeId, setActiveCreativeAssetsNodeId] = useState<string | null>(null)
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null)
  const [textEditorDraft, setTextEditorDraft] = useState('')
  const [textEditorCopied, setTextEditorCopied] = useState(false)
  const [previewLinkCopied, setPreviewLinkCopied] = useState(false)
  const [imageProviderStatusMap, setImageProviderStatusMap] = useState<Map<string, ImageProviderStatusInfo>>(new Map())
  const [videoProviderStatusMap, setVideoProviderStatusMap] = useState<Map<string, VideoProviderStatusInfo>>(new Map())
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
  const timersRef = useRef<number[]>([])
  const [dialogError, setDialogError] = useState<string | null>(null)
  const initialTemplateAppliedRef = useRef('')
  const canvasLoadedRef = useRef(false)
  const hasHydratedCanvasRef = useRef(false)
  const isInitializingRef = useRef(true)
  const initStartedRef = useRef('')
  const initAbortRef = useRef<AbortController | null>(null)
  const saveAbortRef = useRef<AbortController | null>(null)
  const isSwitchingProjectRef = useRef(false)
  const skipNextAutosaveRef = useRef(false)
  const providerStatusPerfStartedRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const deletedNodeIdsRef = useRef<string[]>([])
  const deletedEdgeIdsRef = useRef<string[]>([])
  const latestNodesRef = useRef<VisualCanvasNode[]>([])
  const latestEdgesRef = useRef<CanvasEdge[]>([])
  const latestViewportRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } })
  const latestCommentsRef = useRef<CanvasComment[]>([])
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

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    latestCommentsRef.current = comments
  }, [comments])

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
      const rawSkills = window.localStorage.getItem(getEnabledSkillsKey(projectId))
      const parsed = rawSkills ? JSON.parse(rawSkills) : null
      setEnabledSkillIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : getDefaultCreatorSkillIds())
    } catch {
      setEnabledSkillIds(getDefaultCreatorSkillIds())
    }
  }, [projectId])

  useEffect(() => {
    const stopAutosave = () => {
      isSwitchingProjectRef.current = true
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
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
      const workflow = typeof parsed.workflowId === 'string' ? parsed.workflowId : ''
      if (!workflow) return null
      const viewport = parsed.viewport && typeof parsed.viewport === 'object'
        ? parsed.viewport as CanvasLocalSnapshot['viewport']
        : { zoom: 1, pan: { x: 0, y: 0 } }
      return {
        version: 1,
        source: 'local',
        projectId: typeof parsed.projectId === 'string' ? parsed.projectId : id,
        workflowId: workflow,
        title: typeof parsed.title === 'string' ? parsed.title : undefined,
        nodes: parsed.nodes as VisualCanvasNode[],
        edges: parsed.edges as CanvasEdge[],
        viewport,
        commentsPreview: Array.isArray(parsed.commentsPreview) ? parsed.commentsPreview as CanvasComment[] : undefined,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        syncedAt: typeof parsed.syncedAt === 'string' ? parsed.syncedAt : undefined,
        serverUpdatedAt: typeof parsed.serverUpdatedAt === 'string' ? parsed.serverUpdatedAt : undefined,
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
    latestNodesRef.current = args.nodes
    latestEdgesRef.current = args.edges
    commitNodes(args.nodes)
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
    setHasStarted(args.nodes.length > 0)
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
    const snapshot = getCanvasSnapshot()
    flushLocalSnapshot()
    setSaveStatus('saving')
    setSaveMessage('')
    saveAbortRef.current?.abort()
    const controller = new AbortController()
    saveAbortRef.current = controller
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
        }),
      })
      const raw = await response.text()
      let data: {
        errorCode?: string
        message?: string
        success?: boolean
        savedAt?: string
        serverUpdatedAt?: string
        skipped?: boolean
        reason?: string
      }
      try { data = JSON.parse(raw) as typeof data } catch { data = {} }
      if (response.status === 401) {
        router.replace(`/auth/login?next=${encodeURIComponent(`/create?projectId=${projectId}`)}`)
        return
      }
      if (!response.ok || data.success === false) {
        throw new Error(data.errorCode ? `${data.errorCode}: ${data.message ?? '保存画布失败。'}` : data.message ?? '保存画布失败。')
      }
      if (data.skipped) {
        setSaveStatus('saved')
        setSaveMessage(data.reason === 'EMPTY_NODES_IGNORED' ? '空画布保存已跳过' : '已保存')
        return
      }
      deletedNodeIdsRef.current = []
      deletedEdgeIdsRef.current = []
      flushLocalSnapshot(data.serverUpdatedAt ?? data.savedAt ?? new Date().toISOString())
      setSaveStatus('saved')
      setSaveMessage('已保存')
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return
      flushLocalSnapshot()
      setSaveStatus('failed')
      const detail = error instanceof Error ? error.message : '保存失败'
      setSaveMessage(`${detail}；已保留本地草稿`)
    } finally {
      if (saveAbortRef.current === controller) saveAbortRef.current = null
    }
  }, [getCanvasSnapshot, projectId, router, workflowId, flushLocalSnapshot])

  const restoreDraftToServer = useCallback(async () => {
    if (!draftRestorePrompt?.workflowId) return
    const draft = draftRestorePrompt
    setDraftRestorePrompt(null)
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
      const data = await response.json().catch(() => ({})) as { savedAt?: string; serverUpdatedAt?: string; message?: string }
      if (!response.ok) throw new Error(data.message ?? '同步草稿失败。')
      const savedAt = data.serverUpdatedAt ?? data.savedAt ?? new Date().toISOString()
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
      setSaveStatus('local-draft')
      setSaveMessage(error instanceof Error ? error.message : '草稿已恢复到本地，稍后可再次保存')
    }
  }, [applyCanvasSnapshot, draftRestorePrompt, writeUnifiedLocalSnapshot])

  const keepServerEmptyCanvas = useCallback(() => {
    setDraftRestorePrompt(null)
    setSaveStatus('saved')
    setSaveMessage('使用服务器空画布')
  }, [])

  const switchToServerVersion = useCallback(() => {
    if (!projectId || !serverVersionPrompt) return
    applyCanvasSnapshot({
      projectId,
      workflowId: serverVersionPrompt.workflowId,
      title: loadedProjectTitle,
      nodes: serverVersionPrompt.nodes,
      edges: serverVersionPrompt.edges,
      viewport: serverVersionPrompt.viewport,
      status: 'saved',
      message: '已切换到服务器版本',
    })
    writeCanvasCache({
      projectId,
      workflowId: serverVersionPrompt.workflowId,
      nodes: serverVersionPrompt.nodes,
      edges: serverVersionPrompt.edges,
      viewport: serverVersionPrompt.viewport as CanvasCache['viewport'],
      syncedAt: serverVersionPrompt.serverUpdatedAt,
      serverUpdatedAt: serverVersionPrompt.serverUpdatedAt,
    })
    setServerVersionPrompt(null)
  }, [applyCanvasSnapshot, loadedProjectTitle, projectId, serverVersionPrompt, writeCanvasCache])

  const keepLocalVersion = useCallback(() => {
    setServerVersionPrompt(null)
    setSaveStatus('restored-draft')
    setSaveMessage('继续使用本地草稿，点击保存可覆盖服务器版本')
  }, [])

  const scheduleCanvasSave = useCallback((delay = 800) => {
    if (!projectId || !workflowId || !hasHydratedCanvasRef.current || isInitializingRef.current || isSwitchingProjectRef.current) return
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    setSaveStatus('dirty')
    saveTimerRef.current = window.setTimeout(() => {
      void saveCanvas()
    }, delay)
  }, [projectId, saveCanvas, workflowId])

  const handleManualSave = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void saveCanvas()
  }, [saveCanvas])

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
      await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`, {
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
    } catch (error) {
      console.warn('[canvas] failed to record generated asset', error)
    }
  }, [projectId, workflowId])

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

      setSaveStatus('opening')
      setSaveMessage('')
      setDraftRestorePrompt(null)
      setServerVersionPrompt(null)
      canvasLoadedRef.current = false
      hasHydratedCanvasRef.current = false
      isInitializingRef.current = true

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
          try {
            devPerf('read-last-project')
            const lastId = window.localStorage.getItem('creator-city:last-project-id')
            if (lastId) {
              router.replace(`/create?projectId=${encodeURIComponent(lastId)}`)
              return
            }
          } catch (_) {
            // localStorage may be unavailable; fall through to server ensure.
          }
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
          try {
            window.localStorage.setItem('creator-city:last-project-id', ensureData.project.id)
            if (ensureData.workflow?.id) window.localStorage.setItem('creator-city:last-workflow-id', ensureData.workflow.id)
          } catch (_) { /* private mode */ }
          applyCanvasSnapshot({
            projectId: ensureData.project.id,
            workflowId: ensureData.workflow.id,
            title: ensureData.project.title,
            nodes: (ensureData.nodes ?? []) as VisualCanvasNode[],
            edges: (ensureData.edges ?? []) as CanvasEdge[],
            viewport: ensureData.viewport ?? ensureData.workflow.viewportJson,
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
          canvasLoadedRef.current = true
          hasHydratedCanvasRef.current = true
          isInitializingRef.current = false
          initStartedRef.current = `project:${ensureData.project.id}`
          router.replace(`/create?projectId=${encodeURIComponent(ensureData.project.id)}`)
          return
        }

        const localPreview = readBestLocalCanvasSnapshot(resolvedProjectId)
        if (localPreview?.value.workflowId) {
          applyCanvasSnapshot({
            projectId: resolvedProjectId,
            workflowId: localPreview.value.workflowId,
            title: localPreview.value.title,
            nodes: localPreview.value.nodes,
            edges: localPreview.value.edges,
            viewport: localPreview.value.viewport,
            status: 'restored-draft',
            message: '已恢复本地草稿，正在同步服务器...',
          })
          canvasLoadedRef.current = true
          hasHydratedCanvasRef.current = true
          isInitializingRef.current = false
          devPerf('first-render')
        }

        devPerf('canvas-fetch', 'start')
        const response = await fetch(`/api/projects/${encodeURIComponent(resolvedProjectId)}/canvas`, {
          credentials: 'include',
          signal: abortController.signal,
        })
        devPerf('canvas-fetch', 'end')
        const data = await response.json().catch(() => ({})) as CanvasLoadResponse
        if (response.status === 401) {
          router.replace(`/auth/login?next=${encodeURIComponent(`/create?projectId=${resolvedProjectId}`)}`)
          return
        }
        if (data.errorCode === 'DB_SCHEMA_MISSING') throw new Error('项目表未同步，请执行 project-canvas-setup.sql')
        if (!response.ok && (data.errorCode === 'PROJECT_NOT_FOUND' || data.errorCode === 'FORBIDDEN')) {
          try {
            if (window.localStorage.getItem('creator-city:last-project-id') === resolvedProjectId) {
              window.localStorage.removeItem('creator-city:last-project-id')
              window.localStorage.removeItem('creator-city:last-workflow-id')
            }
          } catch (_) {
            // Fall through to server ensure through /create.
          }
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
        const localCandidate = readBestLocalCanvasSnapshot(resolvedProjectId) ?? localPreview
        const hasLocalCanvas = Boolean(localCandidate?.value.nodes.length)
        const localIsNewer = Boolean(localCandidate && isLocalCanvasNewer(localCandidate.value, serverUpdatedAtText))
        const serverTime = timeValue(serverUpdatedAtText)
        const localTime = timeValue(localCandidate?.value.updatedAt)
        const serverIsNewer = Boolean(serverNodes.length > 0 && hasLocalCanvas && serverTime > localTime + 500)
        const shouldRestoreLocalCanvas = hasLocalCanvas
        const viewport = data.viewport ?? data.workflow?.viewportJson
        const effectiveWorkflowId = data.workflow?.id ?? localCandidate?.value.workflowId ?? ''
        const effectiveNodes = shouldRestoreLocalCanvas && localCandidate ? localCandidate.value.nodes : serverNodes
        const effectiveEdges = shouldRestoreLocalCanvas && localCandidate ? localCandidate.value.edges : serverEdges
        const effectiveViewport = shouldRestoreLocalCanvas && localCandidate ? localCandidate.value.viewport : viewport
        applyCanvasSnapshot({
          projectId: resolvedProjectId,
          workflowId: effectiveWorkflowId,
          title: data.project?.title ?? projectTitle,
          nodes: effectiveNodes,
          edges: effectiveEdges,
          viewport: effectiveViewport,
        })
        if (shouldRestoreLocalCanvas && localCandidate) {
          setDraftRestorePrompt(null)
          if (serverIsNewer) {
            setServerVersionPrompt({
              workflowId: data.workflow?.id ?? effectiveWorkflowId,
              nodes: serverNodes,
              edges: serverEdges,
              viewport,
              serverUpdatedAt: serverUpdatedAtText,
            })
          } else {
            setServerVersionPrompt(null)
          }
          writeUnifiedLocalSnapshot({
            projectId: resolvedProjectId,
            workflowId: effectiveWorkflowId,
            nodes: localCandidate.value.nodes,
            edges: localCandidate.value.edges,
            viewport: localCandidate.value.viewport,
            updatedAt: localCandidate.value.updatedAt,
            syncedAt: localCandidate.value.syncedAt,
            serverUpdatedAt: localCandidate.value.serverUpdatedAt,
          })
          setSaveStatus('restored-draft')
          setSaveMessage(serverIsNewer ? '服务器版本更新，是否切换到服务器版本？' : '已恢复本地草稿，正在同步服务器...')
          if (!serverIsNewer && (serverNodes.length === 0 || localIsNewer)) {
            void fetch(`/api/projects/${encodeURIComponent(resolvedProjectId)}/canvas`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                workflowId: effectiveWorkflowId,
                viewport: localCandidate.value.viewport,
                nodes: localCandidate.value.nodes,
                edges: localCandidate.value.edges,
                deletedNodeIds: [],
                deletedEdgeIds: [],
              }),
            }).then(async (syncResponse) => {
              const raw = await syncResponse.text().catch(() => '')
              const syncData = raw ? JSON.parse(raw) as { savedAt?: string; serverUpdatedAt?: string; message?: string; errorCode?: string } : {}
              if (!syncResponse.ok) throw new Error(syncData.message ?? syncData.errorCode ?? '同步本地草稿失败。')
              if (cancelled) return
              const savedAt = syncData.serverUpdatedAt ?? syncData.savedAt ?? new Date().toISOString()
              writeUnifiedLocalSnapshot({
                projectId: resolvedProjectId,
                workflowId: effectiveWorkflowId,
                nodes: localCandidate.value.nodes,
                edges: localCandidate.value.edges,
                viewport: localCandidate.value.viewport,
                syncedAt: savedAt,
                serverUpdatedAt: savedAt,
              })
              setSaveStatus('saved')
              setSaveMessage('本地草稿已同步')
            }).catch((error: unknown) => {
              if (cancelled) return
              setSaveStatus('local-draft')
              setSaveMessage(error instanceof Error ? `${error.message}；已保留本地草稿` : '已保留本地草稿')
            })
          }
        } else {
          setDraftRestorePrompt(null)
          setServerVersionPrompt(null)
          writeCanvasCache({
            projectId: resolvedProjectId,
            workflowId: effectiveWorkflowId,
            nodes: serverNodes,
            edges: serverEdges,
            viewport: viewport as CanvasCache['viewport'],
            serverUpdatedAt: serverUpdatedAtText,
            syncedAt: serverUpdatedAtText,
          })
          setSaveStatus('saved')
          setSaveMessage('已同步')
        }
        canvasLoadedRef.current = true
        hasHydratedCanvasRef.current = true
        isInitializingRef.current = false
        devPerf('first-render')
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') return
        if (cancelled) return
        setSaveStatus('failed')
        setSaveMessage(error instanceof Error ? error.message : '加载项目失败。')
        isInitializingRef.current = false
      }
    }

    void loadOrCreateProject()
    return () => {
      cancelled = true
      initAbortRef.current?.abort()
    }
  }, [applyCanvasSnapshot, projectTitle, readBestLocalCanvasSnapshot, router, searchParamProjectId, writeCanvasCache, writeUnifiedLocalSnapshot])

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

    function flushBeforeLeave() {
      flushLocalSnapshot()
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }

    const onPageHide = () => flushBeforeLeave()
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flushBeforeLeave() }
    const onBeforeUnload = () => flushBeforeLeave()

    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      flushBeforeLeave()
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [flushLocalSnapshot, projectId, workflowId])

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

  const closeActivePreview = useCallback(() => {
    setActivePreviewNodeId(null)
    setActivePreviewType(null)
    setTextEditorDraft('')
    setTextEditorCopied(false)
    setPreviewLinkCopied(false)
  }, [])

  const closePromptInspector = useCallback(() => {
    setActiveInspectorNodeId(null)
  }, [])

  const closeCreativeAssets = useCallback(() => {
    setActiveCreativeAssetsNodeId(null)
  }, [])

  const closeEdgeDirector = useCallback(() => {
    setActiveEdgeId(null)
  }, [])

  const deleteNode = useCallback((nodeId: string) => {
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
    if (activeInspectorNodeId === nodeId) {
      closePromptInspector()
    }
    if (activeCreativeAssetsNodeId === nodeId) {
      closeCreativeAssets()
    }
    setActiveEdgeId((current) => current && removedEdges.includes(current) ? null : current)
    setContextMenu(null)
    setNodeAddMenu(null)
    setConnectionDraft(null)
  }, [activeCreativeAssetsNodeId, activeInspectorNodeId, activePreviewNodeId, closeActivePreview, closeCreativeAssets, closePromptInspector, commitEdges, commitNodes, edges])

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
      status: node.status === 'generating' ? 'idle' : node.status,
      createdAt: Date.now(),
    }

    commitNodes((current) => [...current, duplicate])
    setActiveNodeId(nodeId)
    setEditingNodeId(null)
    closeActivePreview()
    setContextMenu(null)
    setNodeAddMenu(null)
    return duplicate
  }, [closeActivePreview, commitNodes, nodes])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      return Boolean(element?.closest('input, textarea, [contenteditable="true"]'))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (activePreviewNodeId || activeInspectorNodeId || activeCreativeAssetsNodeId) {
          event.preventDefault()
        }
        if (activePreviewNodeId) {
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
        setContextMenu(null)
        setNodeAddMenu(null)
        setNodeCreateMenu(null)
        setConnectionDraft(null)
        connectionDragRef.current = null
        setIsAddMenuOpen(false)
        setEditingNodeId(null)
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
  }, [activeCreativeAssetsNodeId, activeEdgeId, activeInspectorNodeId, activeNodeId, activePreviewNodeId, canvasZoom, closeActivePreview, closeCreativeAssets, closeEdgeDirector, closePromptInspector, deleteNode, resetCanvasView, setZoomAroundPoint])

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

  const handleRunWorkflow = useCallback(async () => {
    if (workflowRunStatus === 'running') return
    if (!latestNodesRef.current.length) {
      showCanvasFeedback('画布上还没有可运行的节点。')
      return
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    setWorkflowRunStatus('running')
    setWorkflowRunMessage('工作流运行中...')
    showCanvasFeedback('工作流运行中...')
    setDialogError(null)

    const result = await runCanvasWorkflow({
      nodes: latestNodesRef.current,
      edges: latestEdgesRef.current,
      startNodeId: activeNodeId,
      onNodeUpdate: (_nodeId, _patch, nextNodes) => {
        commitNodes(nextNodes)
      },
      runNode: async ({ node, upstreamNodes, incomingEdges, upstreamText, inputAssets }) => {
        if (isReusableAssetNode(node)) {
          return passthroughWorkflowResult(node)
        }

        const nodeType = getProviderNodeType(node.kind)
        const providerId = normalizeProviderId(node.providerId || node.model || NODE_META[node.kind]?.model || NODE_META.text.model)
        const userPrompt = workflowPromptForNode(node, upstreamText)
        const upstreamImageUrl = inputAssets.find((asset) => asset.type === 'image' && asset.url)?.url
        const edgeDirectives = buildEdgeDirectivesForNode({
          targetNodeId: node.id,
          nodes: [node, ...upstreamNodes],
          edges: incomingEdges,
        })
        const characterContext = resolveCharacterPromptContext({
          node,
          upstreamNodes,
          incomingEdges,
          characterBible,
        })
        const sceneContext = resolveScenePromptContext({
          node,
          upstreamNodes,
          incomingEdges,
          sceneBible,
        })
        const compiled = isPromptCompilerNodeKind(node.kind)
          ? compileNodePrompt({
              nodeKind: node.kind,
              userPrompt: node.prompt?.trim() || userPrompt,
              upstreamText,
              upstreamImageUrl,
              styleBible,
              enabledSkills: enabledCreatorSkills,
              providerId,
              edgeDirectives,
              characters: characterContext.characters,
              scenes: sceneContext.scenes,
              edgeCharacterDirectives: {
                inheritedCharacterIdsFromEdges: characterContext.inheritedCharacterIdsFromEdges,
                lockCharacterConsistency: characterContext.lockCharacterConsistency,
              },
              edgeSceneDirectives: {
                inheritedSceneIdsFromEdges: sceneContext.inheritedSceneIdsFromEdges,
                lockSceneConsistency: sceneContext.lockSceneConsistency,
              },
            })
          : null
        const prompt = compiled?.prompt ?? userPrompt
        const nodeForGeneration = compiled
          ? { ...node, metadataJson: compiledPromptMetadata(node.metadataJson, compiled) }
          : node
        if (!prompt.trim()) {
          throw new Error('WORKFLOW_NODE_PROMPT_REQUIRED: 节点缺少 prompt 或上游文本。')
        }

        let generateResult = await callGenerationApi(
          nodeType,
          providerId,
          prompt,
          { ratio: node.ratio ?? '16:9', stage: node.stage ?? 'draft', workflowRun: true },
          node.id,
          workflowInputAssets(inputAssets),
          projectId,
          workflowId,
          compiled?.system,
        )

        if (node.kind === 'video' && generateResult.async && generateResult.taskId) {
          return workflowResultFromGenerateResult(nodeForGeneration, generateResult, prompt)
        }

        if ((generateResult.status === 'queued' || generateResult.status === 'running') && generateResult.jobId) {
          let polls = 0
          while (polls < 60 && generateResult.jobId && (generateResult.status === 'queued' || generateResult.status === 'running')) {
            await delay(5000)
            generateResult = await pollGenerationJob(generateResult.jobId)
            polls += 1
          }
        }

        if ((generateResult.status === 'queued' || generateResult.status === 'running') && generateResult.jobId) {
          throw new Error(`WORKFLOW_NODE_TIMEOUT: ${generateResult.message || '节点仍在运行，请稍后检查任务状态。'}`)
        }
        if (!generateResult.success) {
          throw new Error(workflowErrorFromGenerateResult(node, generateResult))
        }

        return workflowResultFromGenerateResult(nodeForGeneration, generateResult, prompt)
      },
    })

    commitNodes(result.nodes)
    void saveCanvas()

    if (!result.ok) {
      setWorkflowRunStatus('error')
      setWorkflowRunMessage(result.errorCode)
      showCanvasFeedback(result.errorCode)
      return
    }

    if (result.failedNodeIds.length > 0) {
      setWorkflowRunStatus('partial-failed')
      setWorkflowRunMessage('部分节点失败')
      showCanvasFeedback('部分节点失败')
      return
    }

    setWorkflowRunStatus('done')
    setWorkflowRunMessage('工作流完成')
    showCanvasFeedback('工作流完成')
  }, [activeNodeId, characterBible, commitNodes, enabledCreatorSkills, projectId, saveCanvas, sceneBible, showCanvasFeedback, styleBible, workflowId, workflowRunStatus])

  const generationTasks = useMemo(() => collectGenerationTasks(nodes), [nodes])
  const runningGenerationTaskCount = useMemo(
    () => generationTasks.filter((task) => task.status === 'running').length,
    [generationTasks],
  )

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
  const activePreviewMetadata = useMemo(
    () => metadataRecord(activePreviewNode?.metadataJson),
    [activePreviewNode?.metadataJson],
  )
  const activePreviewVideoUrl = activePreviewNode?.kind === 'video'
    ? activePreviewNode.resultVideoUrl || (activePreviewNode.preview?.type === 'remote-video' ? activePreviewNode.preview.url : undefined)
    : undefined
  const activePreviewVideoProviderLabel = activePreviewNode?.kind === 'video'
    ? activePreviewNode.providerId || (typeof activePreviewMetadata.providerId === 'string' ? activePreviewMetadata.providerId : '')
    : ''
  const activePreviewVideoModelLabel = activePreviewNode?.kind === 'video'
    ? typeof activePreviewMetadata.model === 'string' ? activePreviewMetadata.model : activePreviewNode.model
    : ''
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
    if (!activeNode) return
    setCanvasPrompt(activeNode.prompt)
    setPromptModel(normalizeProviderId(activeNode.providerId || activeNode.model))
    setPreferredKind(activeNode.kind)
    if (activeNode.ratio) {
      setPromptRatio(activeNode.ratio)
    }
  }, [activeNode])

  useEffect(() => {
    setDialogError(null)
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
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      createdAt: Date.now(),
    }

    commitNodes((current) => [...current, node])
    if (parentNode) {
      const edgeId = `${parentNode.id}-${node.id}`
      commitEdges((current) => [
        ...current.filter((edge) => edge.id !== edgeId),
        {
          id: edgeId,
          fromNodeId: parentNode.id,
          toNodeId: node.id,
          status: 'active',
        },
      ])
    }
    setActiveNodeId(node.id)
    setCanvasPrompt(node.prompt)
    setPromptModel(providerId)
    setPreferredKind(kind)
    return node
  }, [canvasPan.x, canvasPan.y, canvasZoom, commitEdges, commitNodes, nodes, promptStage])

  const handleNodePatch = useCallback((nodeId: string, patch: Partial<VisualCanvasNode>) => {
    commitNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)))
  }, [commitNodes])

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
    const statusResult = await pollSeedanceVideoTask(task.providerId, task.taskId)
    const normalizedStatus = String(statusResult.status ?? '')
    const currentMetadata = metadataRecord(nodeSnapshot.metadataJson)

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
  }, [flushLocalSnapshot, handleNodePatch, scheduleCanvasSave, showCanvasFeedback])

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
    setActiveEdgeId(null)
    if (activePreviewNodeId && activePreviewNodeId !== nodeId) {
      closeActivePreview()
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
    const defaultModel = kind === 'image'
      ? getDefaultImageProviderId(imageProviderStatusMap) ?? meta.model
      : kind === 'video'
        ? getDefaultVideoProviderId(videoProviderStatusMap) ?? meta.model
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
      closeActivePreview()
    }
    setActiveNodeId(node.id)
    setActiveEdgeId(null)
    setEditingNodeId(node.id)
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
  }, [activePreviewNodeId, closeActivePreview, syncPromptPreset])

  const openNodePreview = useCallback((node: VisualCanvasNode, type: CanvasNodePreviewType) => {
    if (type !== 'text' && type !== node.kind) return
    if (type === 'text' && node.kind !== 'text') return
    setActiveNodeId(node.id)
    setActiveEdgeId(null)
    setEditingNodeId(null)
    setActivePreviewNodeId(node.id)
    setActivePreviewType(type)
    setPreviewLinkCopied(false)
    if (type === 'text') {
      setTextEditorDraft(node.resultText ?? '')
    } else {
      setTextEditorDraft('')
    }
    setTextEditorCopied(false)
  }, [])

  const openPromptInspector = useCallback((nodeId: string) => {
    setActiveNodeId(nodeId)
    setActiveInspectorNodeId(nodeId)
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

  const closeCanvasPanel = useCallback(() => {
    setActivePanel(null)
  }, [])

  const handleOpenAssetsPanel = useCallback(() => {
    flushLocalSnapshot()
    setActivePanel((current) => (current === 'assets' ? null : 'assets'))
    setCommentsEnabled(false)
    setIsAddMenuOpen(false)
    setEditingNodeId(null)
    setContextMenu(null)
    setNodeAddMenu(null)
  }, [flushLocalSnapshot])

  const handleOpenTemplatePanel = useCallback(() => {
    flushLocalSnapshot()
    setActivePanel((current) => (current === 'templates' ? null : 'templates'))
    setCommentsEnabled(false)
    setIsAddMenuOpen(false)
    setEditingNodeId(null)
    setContextMenu(null)
    setNodeAddMenu(null)
  }, [flushLocalSnapshot])

  const handleToggleCommentsPanel = useCallback(() => {
    flushLocalSnapshot()
    setCommentsEnabled((current) => {
      const next = !current
      if (next) {
        setActivePanel(null)
        showCanvasFeedback('评论模式已开启。')
      } else {
        showCanvasFeedback('评论模式已关闭。')
      }
      return next
    })
    setIsAddMenuOpen(false)
    setEditingNodeId(null)
  }, [flushLocalSnapshot, showCanvasFeedback])

  const handleOpenHistoryPanel = useCallback(() => {
    flushLocalSnapshot()
    setActivePanel((current) => (current === 'history' ? null : 'history'))
    setCommentsEnabled(false)
    setIsAddMenuOpen(false)
    setEditingNodeId(null)
    setContextMenu(null)
    setNodeAddMenu(null)
  }, [flushLocalSnapshot])

  const handleOpenSkillPanel = useCallback(() => {
    flushLocalSnapshot()
    setActivePanel((current) => (current === 'skills' ? null : 'skills'))
    setCommentsEnabled(false)
    setIsAddMenuOpen(false)
    setEditingNodeId(null)
    setContextMenu(null)
    setNodeAddMenu(null)
  }, [flushLocalSnapshot])

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

  const openCreativeAssets = useCallback((nodeId: string) => {
    flushLocalSnapshot()
    setActiveCreativeAssetsNodeId(nodeId)
    setEditingNodeId(null)
    setContextMenu(null)
    setNodeAddMenu(null)
    setNodeCreateMenu(null)
  }, [flushLocalSnapshot])

  const handleOpenImageEditor = useCallback(() => {
    flushLocalSnapshot()
    setHasStarted(true)
    setEditingNodeId(null)
    setActivePanel((current) => (current === 'image-editor' ? null : 'image-editor'))
    setCommentsEnabled(false)
    setIsAddMenuOpen(false)
    setEditingNodeId(null)
    showCanvasFeedback(activeNode?.kind === 'image' ? '已打开当前图片节点的编辑器。' : '请选择一个高级编辑功能。')
  }, [activeNode, flushLocalSnapshot, showCanvasFeedback])

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
    if (nodeSnapshot.kind === 'video' && normalizedPromptModel === 'volcengine-seedance-video' && nodeSnapshot.status === 'running' && currentTaskId) {
      setDialogError(null)
      showCanvasFeedback('正在查询视频任务状态...')
      void pollSeedanceVideoTask(normalizedPromptModel, currentTaskId).then((statusResult) => {
        if (statusResult.status === 'running') {
          handleNodePatch(nodeSnapshot.id, {
            status: 'running',
            resultPreview: '视频生成中，请稍后再查。',
            outputLabel: '视频生成中',
            metadataJson: {
              ...metadataRecord(nodeSnapshot.metadataJson),
              providerId: statusResult.providerId || normalizedPromptModel,
              model: statusResult.model ?? currentMetadata.model,
              taskId: currentTaskId,
              generationJobId: currentTaskId,
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
            metadataJson: videoErrorMetadata(nodeSnapshot, { ...statusResult, taskId: currentTaskId }, normalizedPromptModel),
          })
          setDialogError(errMsg)
          showCanvasFeedback(errMsg)
          return
        }
        const videoUrl = statusResult.videoUrl ?? statusResult.result?.videoUrl
        if (!videoUrl) {
          const errMsg = 'VOLCENGINE_SEEDANCE_VIDEO_EMPTY: 视频任务已完成，但未返回视频 URL。'
          handleNodePatch(nodeSnapshot.id, {
            status: 'error',
            errorMessage: errMsg,
            resultPreview: nodeSnapshot.resultPreview ?? '视频任务未返回 URL',
            outputLabel: '视频任务未返回 URL',
          })
          setDialogError(errMsg)
          showCanvasFeedback(errMsg)
          return
        }
        const metadataJson = {
          ...metadataRecord(nodeSnapshot.metadataJson),
          providerId: statusResult.providerId || normalizedPromptModel,
          model: statusResult.model ?? currentMetadata.model,
          taskId: currentTaskId,
          generationJobId: currentTaskId,
          completedAt: new Date().toISOString(),
        }
        handleNodePatch(nodeSnapshot.id, {
          status: 'done',
          resultVideoUrl: videoUrl,
          resultPreview: '视频已生成',
          outputLabel: '视频已生成',
          errorMessage: undefined,
          metadataJson,
          preview: { type: 'remote-video', url: videoUrl, poster: videoUrl, licenseType: 'original', attribution: 'Generated by Volcengine Seedance' },
        })
        void createGeneratedAsset({
          nodeId: nodeSnapshot.id,
          type: 'video',
          title: `${nodeSnapshot.title} 视频结果`,
          url: videoUrl,
          providerId: normalizedPromptModel,
          generationJobId: currentTaskId,
          metadataJson,
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
    const generationPrompt = trimmedPrompt || upstreamTextPrompt
    const upstreamImageAssets = upstreamNodes
      .flatMap((upstreamNode) => {
        if (!upstreamNode?.resultImageUrl) return []
        return [{ id: upstreamNode.id, type: 'image', url: upstreamNode.resultImageUrl }]
      })
    const upstreamImageUrl = upstreamImageAssets.find((asset) => asset.url)?.url
    if (!generationPrompt && !(nodeSnapshot.kind === 'video' && upstreamImageAssets.length > 0)) {
      const errMsg = nodeSnapshot.kind === 'image'
        ? '请先输入图片 prompt，或连接一个已有文本结果的 Text 节点。'
        : nodeSnapshot.kind === 'video'
          ? '请先输入视频 prompt，或连接一个已有 Text/Image 结果的上游节点。'
        : '请先输入 prompt 再生成。'
      setDialogError(errMsg)
      return
    }

    // Validate provider supports this node type
    const providerEntry = getToolProviderById(normalizedPromptModel)
    if (providerEntry && !providerEntry.nodeTypes.includes(nodeType)) {
      const supportedTypes = providerEntry.nodeTypes.join(' / ')
      const errMsg = `${providerEntry.name} 仅支持 ${supportedTypes} 节点，当前节点类型为 ${nodeType}。请切换到对应节点后重试。`
      setDialogError(errMsg)
      showCanvasFeedback(errMsg)
      return
    }
    if (nodeSnapshot.kind === 'image') {
      const selectedProviderInfo = imageProviderStatusMap.get(normalizedPromptModel)
      const selectedProviderStatus = getImageProviderStatus(imageProviderStatusMap, normalizedPromptModel, liveStatusMap, liveStatusLoading)
      if (selectedProviderStatus !== 'available') {
        const errMsg = imageProviderUnavailableMessage(normalizedPromptModel, selectedProviderInfo)
        setDialogError(errMsg)
        handleNodePatch(nodeSnapshot.id, {
          status: 'error',
          errorMessage: errMsg,
          resultPreview: '请先选择并配置可用图片 Provider。',
          outputLabel: '图片 Provider 未配置',
        })
        showCanvasFeedback(errMsg)
        return
      }
    }
    if (nodeSnapshot.kind === 'video') {
      const selectedProviderInfo = videoProviderStatusMap.get(normalizedPromptModel)
      const selectedProviderStatus = getVideoProviderStatus(videoProviderStatusMap, normalizedPromptModel, liveStatusMap, liveStatusLoading)
      if (selectedProviderStatus !== 'available') {
        const errMsg = videoProviderUnavailableMessage(selectedProviderInfo)
        setDialogError(errMsg)
        handleNodePatch(nodeSnapshot.id, {
          status: 'error',
          errorMessage: errMsg,
          resultPreview: '请先选择并配置可用视频 Provider。',
          outputLabel: '视频 Provider 未配置',
        })
        showCanvasFeedback(errMsg)
        return
      }
    }

    const edgeDirectives = buildEdgeDirectivesForNode({
      targetNodeId: nodeSnapshot.id,
      nodes: [nodeSnapshot, ...upstreamNodes],
      edges: incomingEdges,
    })
    const characterContext = resolveCharacterPromptContext({
      node: nodeSnapshot,
      upstreamNodes,
      incomingEdges,
      characterBible,
    })
    const sceneContext = resolveScenePromptContext({
      node: nodeSnapshot,
      upstreamNodes,
      incomingEdges,
      sceneBible,
    })
    const compiled = isPromptCompilerNodeKind(nodeSnapshot.kind)
      ? compileNodePrompt({
          nodeKind: nodeSnapshot.kind,
          userPrompt: trimmedPrompt || generationPrompt || '根据上游素材生成内容。',
          upstreamText: upstreamTextPrompt,
          upstreamImageUrl,
          styleBible,
          enabledSkills: enabledCreatorSkills,
          providerId: normalizedPromptModel,
          edgeDirectives,
          characters: characterContext.characters,
          scenes: sceneContext.scenes,
          edgeCharacterDirectives: {
            inheritedCharacterIdsFromEdges: characterContext.inheritedCharacterIdsFromEdges,
            lockCharacterConsistency: characterContext.lockCharacterConsistency,
          },
          edgeSceneDirectives: {
            inheritedSceneIdsFromEdges: sceneContext.inheritedSceneIdsFromEdges,
            lockSceneConsistency: sceneContext.lockSceneConsistency,
          },
        })
      : null
    const compiledMetadata = compiled ? compiledPromptMetadata(nodeSnapshot.metadataJson, compiled) : nodeSnapshot.metadataJson
    const generationNodeSnapshot: VisualCanvasNode = {
      ...nodeSnapshot,
      metadataJson: compiledMetadata,
    }

    setDialogError(null)
    handleNodePatch(editingNode.id, {
      prompt: trimmedPrompt,
      model: normalizedPromptModel,
      providerId: normalizedPromptModel,
      stage: promptStage,
      ratio: editingNode.ratio ? promptRatio : editingNode.ratio,
      status: 'generating',
      errorMessage: undefined,
      metadataJson: compiledMetadata,
    })

    void callGenerationApi(
      nodeType,
      normalizedPromptModel,
      compiled?.prompt ?? generationPrompt,
      { ratio: promptRatio, stage: promptStage, parameter: promptParameter },
      nodeSnapshot.id,
      upstreamImageAssets.length > 0 ? upstreamImageAssets : undefined,
      nodeType === 'image' || nodeType === 'video' ? projectId : undefined,
      nodeType === 'image' || nodeType === 'video' ? workflowId : undefined,
      compiled?.system,
    ).then(async (result) => {
      if (nodeSnapshot.kind === 'video' && result.async && result.taskId) {
        const metadataJson = videoSuccessMetadata(generationNodeSnapshot, result, normalizedPromptModel)
        handleNodePatch(nodeSnapshot.id, {
          status: 'running',
          resultPreview: '视频任务已提交，正在生成中',
          outputLabel: '视频生成中',
          errorMessage: undefined,
          metadataJson,
        })
        showCanvasFeedback('视频任务已提交，正在生成中')
        return
      }

      // Async job queued (e.g. Runway): poll until done or failed
      if ((result.status === 'queued' || result.status === 'running') && result.jobId) {
        const queuingPreview = `${result.providerId} · 生成中，请稍候…`
        handleNodePatch(nodeSnapshot.id, {
          resultPreview: queuingPreview,
          outputLabel: result.message,
        })
        const maxPolls = 60
        let polls = 0
        const poll = async () => {
          if (polls++ >= maxPolls || !result.jobId) return
          const jobResult = await pollGenerationJob(result.jobId)
          if (jobResult.status === 'queued' || jobResult.status === 'running') {
            handleNodePatch(nodeSnapshot.id, { resultPreview: jobResult.result?.text?.slice(0, 200) ?? queuingPreview })
            const timer = window.setTimeout(() => { void poll() }, 5000)
            timersRef.current.push(timer)
            return
          }
          const jobFallback = buildResultLabel(nodeSnapshot.title)
          if (!jobResult.success) {
            const errMsg = formatGenerateError(jobResult)
            handleNodePatch(nodeSnapshot.id, {
              status: 'error',
              errorMessage: errMsg,
              resultPreview: jobFallback,
              outputLabel: jobFallback,
              ...(nodeSnapshot.kind === 'text' ? { metadataJson: textErrorMetadata(generationNodeSnapshot, jobResult) } : {}),
              ...(nodeSnapshot.kind === 'video' ? { metadataJson: videoErrorMetadata(generationNodeSnapshot, jobResult, normalizedPromptModel) } : {}),
            })
            if (jobResult.errorCode === 'INSUFFICIENT_CREDITS') {
              showCanvasFeedback(`积分不足，需要 ${jobResult.requiredCredits ?? '?'}，可用 ${jobResult.availableCredits ?? 0}。前往 /account/credits 购买。`)
            } else if (jobResult.status === 'not-configured' || jobResult.errorCode === 'PROVIDER_NOT_CONFIGURED') {
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
              providerId: normalizedPromptModel,
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
              providerId: normalizedPromptModel,
              generationJobId: result.jobId,
            })
          }
          commitEdges((current) => current.map((edge) => (
            edge.toNodeId === nodeSnapshot.id || edge.fromNodeId === nodeSnapshot.id ? { ...edge, status: 'done' } : edge
          )))
        }
        const timer = window.setTimeout(() => { void poll() }, 5000)
        timersRef.current.push(timer)
        return
      }

      // Immediate result
      const fallbackPreview = generationPrompt ? buildMockResult(nodeSnapshot, generationPrompt) : buildResultLabel(nodeSnapshot.title)

      if (!result.success) {
        const errMsg = formatGenerateError(result)
        handleNodePatch(nodeSnapshot.id, {
          status: 'error',
          errorMessage: errMsg,
          resultPreview: fallbackPreview,
          outputLabel: fallbackPreview,
          ...(nodeSnapshot.kind === 'text' ? { metadataJson: textErrorMetadata(generationNodeSnapshot, result) } : {}),
          ...(nodeSnapshot.kind === 'video' ? { metadataJson: videoErrorMetadata(generationNodeSnapshot, result, normalizedPromptModel) } : {}),
        })
        setDialogError(errMsg)
        if (result.errorCode === 'INSUFFICIENT_CREDITS') {
          showCanvasFeedback(`积分不足，需要 ${result.requiredCredits ?? '?'}，可用 ${result.availableCredits ?? 0}。前往 /account/credits 购买。`)
        } else if (result.status === 'not-configured' || result.errorCode === 'PROVIDER_NOT_CONFIGURED') {
          showCanvasFeedback('该模型 API 未配置，请到 /tools 配置 provider。')
        } else {
          showCanvasFeedback(errMsg)
        }
        return
      }

      const resultText = getGeneratedText(result)
      const resultImageUrl = result.result?.imageUrl ?? result.imageUrl ?? result.dataUrl
      const resultVideoUrl = result.result?.videoUrl
      const resultPreview = resultText?.slice(0, 200) ?? (resultImageUrl ? '图片已生成' : fallbackPreview)
      handleNodePatch(nodeSnapshot.id, {
        status: 'done',
        resultText,
        resultPreview,
        outputLabel: resultText?.slice(0, 80) ?? fallbackPreview,
        resultImageUrl: resultImageUrl ?? nodeSnapshot.resultImageUrl,
        resultVideoUrl: resultVideoUrl ?? nodeSnapshot.resultVideoUrl,
        errorMessage: undefined,
        ...(nodeSnapshot.kind === 'text' ? { metadataJson: textSuccessMetadata(generationNodeSnapshot, result, normalizedPromptModel) } : {}),
        ...(nodeSnapshot.kind === 'image' ? { metadataJson: imageSuccessMetadata(generationNodeSnapshot, result, normalizedPromptModel) } : {}),
        ...(nodeSnapshot.kind === 'video' ? { metadataJson: videoSuccessMetadata(generationNodeSnapshot, result, normalizedPromptModel) } : {}),
        preview: resultVideoUrl
          ? { type: 'remote-video', url: resultVideoUrl, poster: result.result?.previewUrl, licenseType: 'original', attribution: 'Generated by configured video provider' }
          : nodeSnapshot.preview,
      })
      if (resultText) {
        void createGeneratedAsset({
          nodeId: nodeSnapshot.id,
          type: 'text',
          title: `${nodeSnapshot.title} 文本结果`,
          providerId: normalizedPromptModel,
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
          providerId: normalizedPromptModel,
          generationJobId: result.jobId,
        })
      }
      if (resultVideoUrl) {
        void createGeneratedAsset({
          nodeId: nodeSnapshot.id,
          type: 'video',
          title: `${nodeSnapshot.title} 视频结果`,
          url: resultVideoUrl,
          providerId: normalizedPromptModel,
          generationJobId: result.jobId,
        })
      }
      commitEdges((current) => current.map((edge) => (
        edge.toNodeId === nodeSnapshot.id || edge.fromNodeId === nodeSnapshot.id ? { ...edge, status: 'done' } : edge
      )))
      // Keep dialog open so user can see the result — they close it manually
    })
  }, [buildResultLabel, canvasPrompt, characterBible, commitEdges, createGeneratedAsset, edges, editingNode, enabledCreatorSkills, handleNodePatch, imageProviderStatusMap, liveStatusLoading, liveStatusMap, nodes, normalizedPromptModel, projectId, promptParameter, promptRatio, promptStage, sceneBible, setDialogError, showCanvasFeedback, styleBible, videoProviderStatusMap, workflowId])

  const handlePromptChange = useCallback((value: string) => {
    setCanvasPrompt(value)
    if (editingNode) {
      handleNodePatch(editingNode.id, { prompt: value })
    }
  }, [editingNode, handleNodePatch])

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
      closeActivePreview()
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
      closeActivePreview()
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
    return !element?.closest('button, input, textarea, select, a, video, audio, [contenteditable="true"], [data-node-preview-overlay="true"], [data-prompt-inspector="true"], [data-creative-assets="true"], [data-storyboard-preview="true"], [data-edge-director="true"], .canvas-node-card, .canvas-node-dialog, .canvas-prompt-box, .canvas-prompt-console, .canvas-topbar, .canvas-toolbar-shell, .canvas-add-menu, .canvas-zoom-controls, .canvas-context-menu, .canvas-node-add-menu, .canvas-node-create-menu, .canvas-side-panel, .canvas-user-menu')
  }, [])

  const handleCanvasWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const normalizedDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    const zoomFactor = Math.exp(-normalizedDelta * 0.0014)
    setZoomAroundPoint(canvasZoom * zoomFactor, { x: event.clientX, y: event.clientY })
  }, [canvasZoom, setZoomAroundPoint])

  const handleCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !canStartCanvasPan(event.target)) return

    closeActivePreview()
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
    setEditingNodeId(node.id)
    setNodeCreateMenu(null)
  }, [createNode, imageProviderStatusMap, nodeCreateMenu, syncPromptPreset, videoProviderStatusMap])

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
    saveAbortRef.current?.abort()
    return true
  }, [flushLocalSnapshot])

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
    const dialogWidth = Math.max(320, Math.min(640, window.innerWidth - viewportMargin * 2))
    const surfaceOffset = getSurfaceOffset(surfaceRef.current)
    const nodeLeft = rect.left + surfaceOffset.left + canvasPan.x + editingNode.x * canvasZoom
    const nodeTop = rect.top + surfaceOffset.top + canvasPan.y + editingNode.y * canvasZoom
    const nodeWidth = editingNode.width * canvasZoom
    const nodeHeight = editingNode.height * canvasZoom
    const nodeBottom = nodeTop + nodeHeight
    const nodeCenterX = nodeLeft + nodeWidth / 2
    const dialogHeight = window.innerWidth <= 900 ? 190 : NODE_DIALOG_HEIGHT
    const belowTop = nodeBottom + NODE_DIALOG_GAP
    const aboveTop = nodeTop - NODE_DIALOG_GAP - dialogHeight
    const hasRoomBelow = belowTop + dialogHeight <= window.innerHeight - viewportMargin
    const hasRoomAbove = aboveTop >= viewportMargin
    const top = hasRoomBelow
      ? belowTop
      : hasRoomAbove
        ? aboveTop
        : clampNumber(belowTop, viewportMargin, Math.max(viewportMargin, window.innerHeight - dialogHeight - viewportMargin))

    return {
      left: clampNumber(nodeCenterX - dialogWidth / 2, viewportMargin, window.innerWidth - dialogWidth - viewportMargin),
      height: dialogHeight,
      top,
      width: dialogWidth,
    }
  }, [canvasPan.x, canvasPan.y, canvasZoom, editingNode])
  const selectedImageProviderStatus = editingNode?.kind === 'image'
    ? getImageProviderStatus(imageProviderStatusMap, normalizedPromptModel, liveStatusMap, liveStatusLoading)
    : null
  const selectedVideoProviderStatus = editingNode?.kind === 'video'
    ? getVideoProviderStatus(videoProviderStatusMap, normalizedPromptModel, liveStatusMap, liveStatusLoading)
    : null
  const imageGenerateDisabled = editingNode?.kind === 'image' && selectedImageProviderStatus !== 'available'
  const videoGenerateDisabled = editingNode?.kind === 'video'
    && selectedVideoProviderStatus !== 'available'
    && !(normalizedPromptModel === 'volcengine-seedance-video' && editingNode.status === 'running' && metadataRecord(editingNode.metadataJson).taskId)

  return (
    <div className={`${canvasStyles.scope} h-full min-h-0`} onClickCapture={handleCanvasRootClickCapture}>
    <div className={`canvas-root ${hasStarted ? 'is-started' : ''}`}>
      <div className="canvas-background-glow" />
      <div className="canvas-grid" />

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
          <button
            type="button"
            className="canvas-secondary-button"
            title={saveMessage || '立即保存画布'}
            disabled={saveStatus === 'opening' || saveStatus === 'saving' || !projectId}
            onClick={handleManualSave}
          >
            {saveStatus === 'saving'
              ? '保存中...'
              : saveStatus === 'saved'
                ? '已保存'
                : saveStatus === 'failed'
                  ? '保存失败，重试'
                  : '保存'}
          </button>
          <button
            type="button"
            className="canvas-secondary-button"
            title={workflowRunMessage || (activeNode ? `从「${activeNode.title}」开始运行` : '从所有无入边节点开始运行')}
            disabled={saveStatus === 'opening' || workflowRunStatus === 'running' || !projectId || nodes.length === 0}
            onClick={() => { void handleRunWorkflow() }}
          >
            {workflowRunStatus === 'running'
              ? '运行中...'
              : workflowRunStatus === 'done'
                ? '完成'
                : workflowRunStatus === 'partial-failed'
                  ? '部分失败'
                  : '运行工作流'}
          </button>
          <button
            type="button"
            className="canvas-secondary-button canvas-generation-tasks-trigger"
            title="查看当前画布异步生成任务"
            disabled={nodes.length === 0}
            onClick={() => setGenerationTasksOpen(true)}
          >
            生成任务
            {runningGenerationTaskCount > 0 ? (
              <span className="canvas-generation-tasks-badge">{runningGenerationTaskCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            className="canvas-secondary-button canvas-generation-tasks-trigger"
            title="按连接顺序查看 Storyboard Timeline"
            disabled={nodes.length === 0}
            onClick={() => setStoryboardPreviewOpen(true)}
          >
            组合预览
            {storyboardShotCount > 0 ? (
              <span className="canvas-generation-tasks-badge">{storyboardShotCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="canvas-secondary-button"
            title="新建项目"
            aria-label="新建项目"
            data-tooltip="新建项目"
            data-flush-canvas-before-nav="true"
          >
            新建项目
            <span className="canvas-hover-tooltip" aria-hidden="true">保存当前画布并创建新项目</span>
          </button>
          <button type="button" onClick={handleOpenProjects} className="canvas-nav-link" title="打开项目列表" aria-label="打开项目列表" data-tooltip="打开项目列表" data-flush-canvas-before-nav="true">
            项目
            <span className="canvas-hover-tooltip" aria-hidden="true">打开项目列表</span>
          </button>
          <a href="/community" className="canvas-nav-link" title="进入社群" aria-label="进入社群" data-tooltip="进入社群">
            社区
            <span className="canvas-hover-tooltip" aria-hidden="true">进入社群</span>
          </a>
          {canOpenClientDelivery ? (
            <button
              type="button"
              onClick={handleOpenClientDelivery}
              className="canvas-secondary-button"
              title="客户交付"
              aria-label="打开客户交付界面"
              data-tooltip="客户交付"
              data-flush-canvas-before-nav="true"
            >
              客户
              <span className="canvas-hover-tooltip" aria-hidden="true">客户交付</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => { void handleShareCanvasLink() }}
            className="canvas-secondary-button"
            title="复制画布链接"
            aria-label="复制画布链接"
            data-tooltip="复制画布链接"
            data-flush-canvas-before-nav="true"
          >
            {shareCopied ? '已复制' : '链接分享'}
            <span className="canvas-hover-tooltip" aria-hidden="true">复制画布链接</span>
          </button>
        </div>
      </div>

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
            {draftRestorePrompt.source === 'cache' ? '本地缓存' : '本地草稿'}包含 {draftRestorePrompt.nodes.length} 个节点。
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
              onClick={keepServerEmptyCanvas}
              className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:border-white/25 hover:text-white"
            >
              使用服务器空画布
            </button>
          </div>
        </div>
      ) : null}

      {serverVersionPrompt ? (
        <div className="fixed left-1/2 top-28 z-[70] w-[min(92vw,520px)] -translate-x-1/2 rounded-lg border border-sky-300/25 bg-slate-950/95 p-4 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="text-sm font-semibold text-white">服务器版本更新，是否切换到服务器版本？</div>
          <div className="mt-1 text-xs text-white/50">
            当前已保留本地草稿。服务器版本包含 {serverVersionPrompt.nodes.length} 个节点。
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="canvas-secondary-button" onClick={keepLocalVersion}>
              继续本地草稿
            </button>
            <button type="button" className="canvas-panel-primary" onClick={switchToServerVersion}>
              切换到服务器版本
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

      {saveStatus !== 'opening' ? (
        <CanvasToolDock
          onAddNode={handleAddNode}
          activeTool={activeTool}
          onToolSelect={setActiveTool}
          isAddMenuOpen={isAddMenuOpen}
          onToggleAddMenu={() => setIsAddMenuOpen((current) => !current)}
          commentsEnabled={commentsEnabled}
          onOpenAssetsPanel={handleOpenAssetsPanel}
          onOpenTemplatePanel={handleOpenTemplatePanel}
          onToggleCommentsPanel={handleToggleCommentsPanel}
          onOpenHistoryPanel={handleOpenHistoryPanel}
          onOpenImageEditor={handleOpenImageEditor}
          onOpenSkillPanel={handleOpenSkillPanel}
        />
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
              onClose={closeCanvasPanel}
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
              onClose={closeCanvasPanel}
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
              onClose={closeCanvasPanel}
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
              onClose={closeCanvasPanel}
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
              onClose={closeCanvasPanel}
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
        onWheel={handleCanvasWheel}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onDoubleClick={handleCanvasDoubleClick}
      >
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
              <CanvasNodeCard
                node={node}
                active={node.id === activeNode?.id}
                dragging={draggingNodeId === node.id}
                onSelect={() => {
                  focusPromptForNode(node)
                }}
                onAddPrev={(event) => startConnectionDrag(node.id, 'in', event)}
                onAddNext={(event) => startConnectionDrag(node.id, 'out', event)}
                onDragStart={(event) => handleNodeDragStart(node.id, event)}
                onOpenContextMenu={(event) => openNodeContextMenu(node.id, event.clientX, event.clientY)}
                onEdit={() => focusPromptForNode(node)}
                onOpenPreview={(type) => openNodePreview(node, type)}
                onOpenPromptInspector={() => openPromptInspector(node.id)}
                enabledSkillCount={enabledCreatorSkills.filter((skill) => isPromptCompilerNodeKind(node.kind) && skill.appliesTo.includes(node.kind)).length}
                onOpenSkillPanel={handleOpenSkillPanel}
                creativeAssetLabel={creativeAssetLabelForNode(node)}
                onOpenCreativeAssets={() => openCreativeAssets(node.id)}
              />
            </div>
          ))}
        </div>
      </div>

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

      {activeCreativeAssetsNode ? (
        <CreativeAssetsPanel
          open
          nodeTitle={activeCreativeAssetsNode.title}
          characterBible={characterBible}
          sceneBible={sceneBible}
          selectedCharacterIds={getNodeCharacterIds(activeCreativeAssetsNode)}
          selectedSceneIds={getNodeSceneIds(activeCreativeAssetsNode)}
          onCharacterBibleSave={persistCharacterBibleSettings}
          onSceneBibleSave={persistSceneBibleSettings}
          onCharacterIdsChange={(characterIds) => handleNodeCharacterIdsChange(activeCreativeAssetsNode.id, characterIds)}
          onSceneIdsChange={(sceneIds) => handleNodeSceneIdsChange(activeCreativeAssetsNode.id, sceneIds)}
          onClose={closeCreativeAssets}
        />
      ) : null}

      {editingNode && nodeDialogStyle ? (
        <div
          className="canvas-node-dialog create-floating-console"
          style={nodeDialogStyle}
          onPointerDown={(event) => event.stopPropagation()}
        >
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
            generateDisabled={imageGenerateDisabled || videoGenerateDisabled || editingNode.status === 'generating'}
            generateLabel={
              editingNode.status === 'generating'
                ? '生成中…'
                : editingNode.kind === 'video' && normalizedPromptModel === 'volcengine-seedance-video' && editingNode.status === 'running' && (metadataRecord(editingNode.metadataJson).taskId || metadataRecord(editingNode.metadataJson).generationJobId)
                  ? '查询结果'
                : editingNode.kind === 'video' && videoGenerateDisabled
                  ? '未配置'
                : editingNode.kind === 'image' && !defaultImageProviderId
                  ? '请先配置图片 Provider'
                : editingNode.kind === 'image' && imageGenerateDisabled
                  ? '未配置'
                : editingNode.status === 'error'
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
            estimatedCredits={estimateCreditCost(normalizedPromptModel, getProviderNodeType(editingNode.kind))}
            footerItems={promptFooterItems}
            inputRef={(element) => {
              promptInputRef.current = element
            }}
            onClose={() => setEditingNodeId(null)}
          />
        </div>
      ) : null}

      {activePreviewType === 'image' && activePreviewNode?.kind === 'image' && activePreviewNode.resultImageUrl ? (
        <div
          className="canvas-image-preview-backdrop"
          role="presentation"
          data-node-preview-overlay="true"
          data-no-node-drag="true"
        >
          <section
            className="canvas-image-preview-dialog"
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
            <div className="canvas-image-preview-head">
              <span>{activePreviewNode.title}</span>
              <button type="button" onClick={closeActivePreview} aria-label="关闭图片预览">×</button>
            </div>
            <img src={activePreviewNode.resultImageUrl} alt={activePreviewNode.title} className="canvas-image-preview-media" />
            <div className="canvas-image-preview-actions">
              <button type="button" onClick={() => { void copyActivePreviewLink(activePreviewNode.resultImageUrl!) }}>
                {previewLinkCopied ? '已复制' : '复制图片链接'}
              </button>
              <button type="button" onClick={() => openActivePreviewLink(activePreviewNode.resultImageUrl!)}>
                新标签页打开
              </button>
              <button type="button" onClick={closeActivePreview}>关闭</button>
            </div>
          </section>
        </div>
      ) : null}

      {activePreviewType === 'video' && activePreviewNode?.kind === 'video' && activePreviewVideoUrl ? (
        <div
          className="canvas-video-preview-backdrop"
          role="presentation"
          data-node-preview-overlay="true"
          data-no-node-drag="true"
        >
          <section
            className="canvas-video-preview-dialog"
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
            <div className="canvas-video-preview-head">
              <div className="canvas-video-preview-title">
                <span>视频预览</span>
                <small>{[activePreviewVideoProviderLabel, activePreviewVideoModelLabel, activePreviewNode.title].filter(Boolean).join(' / ')}</small>
              </div>
              <button type="button" onClick={closeActivePreview} aria-label="关闭视频预览">×</button>
            </div>
            <video
              src={activePreviewVideoUrl}
              poster={activePreviewNode.preview?.poster}
              className="canvas-video-preview-media"
              controls
              autoPlay
              playsInline
            />
            <div className="canvas-video-preview-actions">
              <button type="button" onClick={() => { void copyActivePreviewLink(activePreviewVideoUrl) }}>
                {previewLinkCopied ? '已复制' : '复制视频链接'}
              </button>
              <button type="button" onClick={() => openActivePreviewLink(activePreviewVideoUrl)}>
                新标签页打开
              </button>
              <button type="button" onClick={closeActivePreview}>关闭</button>
            </div>
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
              <button type="button" className="canvas-text-editor-close" onClick={closeActivePreview} aria-label="关闭">
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
              <button type="button" className="canvas-text-editor-button" onClick={closeActivePreview}>
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
          <div className="canvas-menu-label">引用该节点生成</div>
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

    </div>
    </div>
  )
}
