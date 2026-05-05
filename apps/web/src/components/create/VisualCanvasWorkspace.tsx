'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { CanvasFlowEdge } from '@/components/create/CanvasFlowEdge'
import { CanvasNodeCard, type VisualCanvasNode as CanvasNodeCardNode, type VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { CanvasPromptBox, type CanvasPromptFooterItem } from '@/components/create/CanvasPromptBox'
import { CanvasToolDock } from '@/components/create/CanvasToolDock'
import { CanvasCommentsPanel, type CanvasComment } from '@/components/create/CanvasCommentsPanel'
import { CanvasHistoryPanel, type CanvasHistoryItem } from '@/components/create/CanvasHistoryPanel'
import { CanvasTemplatePanel } from '@/components/create/CanvasTemplatePanel'
import { ImageEditorPanel } from '@/components/create/ImageEditorPanel'
import { WorkspaceAssetsPanel } from '@/components/create/WorkspaceAssetsPanel'
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
import { getClientDeliveryHref } from '@/lib/routing/actions'
import { getToolProviderById, type ToolProviderNodeType } from '@/lib/tools/provider-catalog'
import canvasStyles from '@/components/create/canvas.module.css'

interface VisualCanvasWorkspaceProps {
  projectTitle: string
  templateName?: string | null
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
  workflow?: { id: string; viewportJson?: unknown; updatedAt?: string }
  nodes?: VisualCanvasNode[]
  edges?: CanvasEdge[]
  viewport?: unknown
  serverUpdatedAt?: string
}

interface CanvasDraft {
  projectId: string
  workflowId: string
  nodes: VisualCanvasNode[]
  edges: CanvasEdge[]
  viewport: { zoom: number; pan: { x: number; y: number } }
  updatedAt: string
  syncedAt?: string
}

interface CanvasCache extends CanvasDraft {
  serverUpdatedAt?: string
}

function getDraftKey(projectId: string) {
  return `creator-city:draft:${projectId}`
}

function getCanvasCacheKey(projectId: string) {
  return `creator-city:canvas-cache:${projectId}`
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
}

type CanvasEdgeStatus = 'idle' | 'active' | 'done'

interface CanvasEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  status: CanvasEdgeStatus
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
const CONNECTOR_VISUAL_OFFSET = 32
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
              : '交付'
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

function getNodeKindForPublicTemplate(nodeType: PublicTemplate['nodeType']): VisualCanvasNodeKind {
  if (nodeType === 'text' || nodeType === 'image' || nodeType === 'video' || nodeType === 'audio') {
    return nodeType
  }
  return 'template'
}

type GenerateApiResult = GenerateResponse & { requiredCredits?: number; availableCredits?: number }

async function callGenerationApi(
  nodeType: ToolProviderNodeType,
  providerId: string,
  prompt: string,
  params?: Record<string, string | number | boolean | undefined>,
  nodeId?: string,
  inputAssets?: Array<{ id: string; type: string; url?: string }>,
): Promise<GenerateApiResult> {
  const endpoint =
    nodeType === 'image' ? '/api/generate/image'
    : nodeType === 'video' ? '/api/generate/video'
    : nodeType === 'audio' ? '/api/generate/audio'
    : '/api/generate/text'

  if (process.env.NODE_ENV !== 'production') {
    console.info('[canvas-generate] submit', { nodeType, providerId })
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ providerId, nodeType, prompt, params, nodeId, inputAssets }),
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

export function VisualCanvasWorkspace({
  projectTitle,
  templateName,
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('opening')
  const [saveMessage, setSaveMessage] = useState('')
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
  const [activePanel, setActivePanel] = useState<'assets' | 'templates' | 'history' | 'image-editor' | null>(null)
  const [commentsEnabled, setCommentsEnabled] = useState(false)
  const [comments, setComments] = useState<CanvasComment[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedHistoryId, setSelectedHistoryId] = useState('')
  const [appliedImageEdit, setAppliedImageEdit] = useState('')
  const [canvasFeedback, setCanvasFeedback] = useState('')
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [nodeAddMenu, setNodeAddMenu] = useState<{ nodeId: string; direction: 'in' | 'out'; x: number; y: number; worldX: number; worldY: number } | null>(null)
  const [nodeCreateMenu, setNodeCreateMenu] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null)
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
  const cacheHydratedRef = useRef('')
  const skipNextAutosaveRef = useRef(false)
  const providerStatusPerfStartedRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const deletedNodeIdsRef = useRef<string[]>([])
  const deletedEdgeIdsRef = useRef<string[]>([])
  const latestNodesRef = useRef<VisualCanvasNode[]>([])
  const latestEdgesRef = useRef<CanvasEdge[]>([])
  const latestViewportRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } })
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
    startClientX: number
    startClientY: number
    startX: number
    startY: number
  } | null>(null)
  const connectionDragRef = useRef<{
    nodeId: string
    direction: 'in' | 'out'
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
    if (liveStatusLoading) {
      providerStatusPerfStartedRef.current = true
      devPerf('providerStatus', 'start')
    } else if (providerStatusPerfStartedRef.current) {
      providerStatusPerfStartedRef.current = false
      devPerf('providerStatus', 'end')
    }
  }, [liveStatusLoading])

  const commitNodes = useCallback((next: VisualCanvasNode[] | ((current: VisualCanvasNode[]) => VisualCanvasNode[])) => {
    setNodes((current) => {
      const resolved = typeof next === 'function' ? next(current) : next
      latestNodesRef.current = resolved
      return resolved
    })
  }, [])

  const commitEdges = useCallback((next: CanvasEdge[] | ((current: CanvasEdge[]) => CanvasEdge[])) => {
    setEdges((current) => {
      const resolved = typeof next === 'function' ? next(current) : next
      latestEdgesRef.current = resolved
      return resolved
    })
  }, [])

  const getCanvasSnapshot = useCallback(() => ({
    nodes: latestNodesRef.current,
    edges: latestEdgesRef.current,
    viewport: latestViewportRef.current,
  }), [])

  const readLocalDraft = useCallback((id: string): CanvasDraft | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(getDraftKey(id))
      return raw ? JSON.parse(raw) as CanvasDraft : null
    } catch {
      return null
    }
  }, [])

  const readCanvasCache = useCallback((id: string): CanvasCache | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(getCanvasCacheKey(id))
      return raw ? JSON.parse(raw) as CanvasCache : null
    } catch {
      return null
    }
  }, [])

  const writeCanvasCache = useCallback((args?: {
    projectId?: string
    workflowId?: string
    syncedAt?: string
    serverUpdatedAt?: string
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
      nodes: args?.nodes ?? snapshot.nodes,
      edges: args?.edges ?? snapshot.edges,
      viewport: args?.viewport ?? snapshot.viewport,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: args?.serverUpdatedAt,
      ...(args?.syncedAt ? { syncedAt: args.syncedAt } : {}),
    }
    try {
      window.localStorage.setItem(getCanvasCacheKey(targetProjectId), JSON.stringify(cache))
    } catch {
      // Cache is an acceleration layer only.
    }
  }, [getCanvasSnapshot, projectId, workflowId])

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
    if (args.title) setLoadedProjectTitle(args.title)
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
  }, [commitEdges, commitNodes])

  const writeLocalDraft = useCallback((syncedAt?: string) => {
    if (typeof window === 'undefined' || !projectId || !workflowId) return
    const snapshot = getCanvasSnapshot()
    const existing = readLocalDraft(projectId)
    const draft: CanvasDraft = {
      projectId,
      workflowId,
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      viewport: snapshot.viewport,
      updatedAt: syncedAt ? existing?.updatedAt ?? new Date().toISOString() : new Date().toISOString(),
      ...(syncedAt ? { syncedAt } : {}),
    }
    try {
      window.localStorage.setItem(getDraftKey(projectId), JSON.stringify(draft))
      window.localStorage.setItem('creator-city:last-project-id', projectId)
      window.localStorage.setItem('creator-city:last-workflow-id', workflowId)
      // draft written
    } catch {
      // localStorage can fail in private mode; do not disrupt the canvas.
    }
  }, [getCanvasSnapshot, projectId, readLocalDraft, workflowId])

  const saveCanvas = useCallback(async () => {
    if (!projectId || !workflowId || !hasHydratedCanvasRef.current || isInitializingRef.current) return
    const snapshot = getCanvasSnapshot()
    writeLocalDraft()
    setSaveStatus('saving')
    setSaveMessage('')
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workflowId,
          viewport: snapshot.viewport,
          nodes: snapshot.nodes,
          edges: snapshot.edges,
          deletedNodeIds: deletedNodeIdsRef.current,
          deletedEdgeIds: deletedEdgeIdsRef.current,
        }),
      })
      const data = await response.json().catch(() => ({})) as { errorCode?: string; message?: string; success?: boolean; savedAt?: string }
      if (response.status === 401) {
        router.replace(`/auth/login?next=${encodeURIComponent(`/create?projectId=${projectId}`)}`)
        return
      }
      if (!response.ok) throw new Error(data.message ?? '保存画布失败。')
      deletedNodeIdsRef.current = []
      deletedEdgeIdsRef.current = []
      writeLocalDraft(data.savedAt ?? new Date().toISOString())
      writeCanvasCache({ syncedAt: data.savedAt ?? new Date().toISOString(), serverUpdatedAt: data.savedAt })
      setSaveStatus('saved')
      setSaveMessage('Saved')
    } catch (error) {
      writeLocalDraft()
      setSaveStatus('local-draft')
      setSaveMessage(error instanceof Error ? error.message : '已保存到本地草稿，网络恢复后会继续同步')
    }
  }, [getCanvasSnapshot, projectId, router, workflowId, writeCanvasCache, writeLocalDraft])

  const scheduleCanvasSave = useCallback((delay = 800) => {
    if (!projectId || !workflowId || !hasHydratedCanvasRef.current || isInitializingRef.current) return
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    setSaveStatus('dirty')
    saveTimerRef.current = window.setTimeout(() => {
      void saveCanvas()
    }, delay)
  }, [projectId, saveCanvas, workflowId])

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
      devPerf('init:start')
      const nextProjectId = searchParamProjectId
      const initKey = nextProjectId ? `project:${nextProjectId}` : 'ensure'
      if (initStartedRef.current === initKey) return
      initStartedRef.current = initKey
      initAbortRef.current?.abort()
      const abortController = new AbortController()
      initAbortRef.current = abortController

      setSaveStatus('opening')
      setSaveMessage('')
      canvasLoadedRef.current = false
      hasHydratedCanvasRef.current = false
      isInitializingRef.current = true

      try {
        const resolvedProjectId = nextProjectId

        if (!resolvedProjectId) {
          setSaveMessage('正在打开项目...')
          try {
            devPerf('lastProject:read')
            const lastId = window.localStorage.getItem('creator-city:last-project-id')
            if (lastId) {
              router.replace(`/create?projectId=${encodeURIComponent(lastId)}`)
              return
            }
          } catch (_) {
            // localStorage may be unavailable; fall through to server ensure.
          }
          devPerf('ensure', 'start')
          const ensureRes = await fetch('/api/projects/ensure?includeCanvas=1', {
            method: 'POST',
            credentials: 'include',
            signal: abortController.signal,
          })
          devPerf('ensure', 'end')
          const ensureData = await ensureRes.json().catch(() => ({})) as {
            success?: boolean; errorCode?: string; message?: string
            project?: { id: string; title: string }; workflow?: { id: string; viewportJson?: unknown; updatedAt?: string }
            nodes?: VisualCanvasNode[]; edges?: CanvasEdge[]; viewport?: unknown; serverUpdatedAt?: string
          }
          if (ensureRes.status === 401) { router.replace(`/auth/login?next=${encodeURIComponent('/create')}`); return }
          if (ensureData.errorCode === 'DB_SCHEMA_MISSING') throw new Error('项目表未同步，请执行 project-canvas-setup.sql')
          if (!ensureRes.ok || !ensureData.project?.id || !ensureData.workflow?.id) throw new Error(ensureData.message ?? '打开项目失败。')
          if (cancelled) return
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
            message: 'Saved',
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

        devPerf('cache:hydrate', 'start')
        const cache = readCanvasCache(resolvedProjectId)
        if (cache?.workflowId && cache.nodes.length > 0 && cacheHydratedRef.current !== resolvedProjectId) {
          cacheHydratedRef.current = resolvedProjectId
          applyCanvasSnapshot({
            projectId: resolvedProjectId,
            workflowId: cache.workflowId,
            nodes: cache.nodes,
            edges: cache.edges,
            viewport: cache.viewport,
            status: 'saved',
            message: '正在同步...',
          })
          canvasLoadedRef.current = true
          hasHydratedCanvasRef.current = true
          isInitializingRef.current = false
          devPerf('firstRender')
        }
        devPerf('cache:hydrate', 'end')

        devPerf('canvas', 'start')
        const response = await fetch(`/api/projects/${encodeURIComponent(resolvedProjectId)}/canvas`, {
          credentials: 'include',
          signal: abortController.signal,
        })
        devPerf('canvas', 'end')
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

        // Persist so next visit to /create (without ?projectId) reopens this project
        try {
          window.localStorage.setItem('creator-city:last-project-id', resolvedProjectId)
          if (data.workflow?.id) window.localStorage.setItem('creator-city:last-workflow-id', data.workflow.id)
        } catch (_) { /* private mode */ }

        setProjectId(resolvedProjectId)
        setWorkflowId(data.workflow?.id ?? '')
        const serverNodes = (data.nodes ?? []) as VisualCanvasNode[]
        const serverEdges = (data.edges ?? []) as CanvasEdge[]
        const draft = readLocalDraft(resolvedProjectId)
        const serverUpdatedAtText = data.serverUpdatedAt ?? data.workflow?.updatedAt
        const serverUpdatedAt = serverUpdatedAtText ? new Date(serverUpdatedAtText).getTime() : 0
        const draftUpdatedAt = draft?.updatedAt ? new Date(draft.updatedAt).getTime() : 0
        const shouldUseDraft = Boolean(draft && draft.nodes.length > 0 && draftUpdatedAt > serverUpdatedAt)
        const shouldPreserveLocalNodes = serverNodes.length === 0 && (cache?.nodes.length ?? latestNodesRef.current.length) > 0
        const nextNodes = shouldUseDraft
          ? draft!.nodes
          : shouldPreserveLocalNodes
            ? (cache?.nodes ?? latestNodesRef.current)
            : serverNodes
        const nextEdges = shouldUseDraft
          ? draft!.edges
          : shouldPreserveLocalNodes
            ? (cache?.edges ?? latestEdgesRef.current)
            : serverEdges
        if (shouldPreserveLocalNodes) {
          setSaveMessage('已使用本地缓存，服务器同步中')
        }
        if (shouldUseDraft) {
          setSaveMessage('发现本地未同步草稿，已自动恢复')
          setSaveStatus('restored-draft')
        }
        const viewport = data.viewport ?? data.workflow?.viewportJson
        const nextViewport = shouldUseDraft ? draft!.viewport : shouldPreserveLocalNodes ? cache?.viewport ?? viewport : viewport
        applyCanvasSnapshot({
          projectId: resolvedProjectId,
          workflowId: data.workflow?.id ?? cache?.workflowId ?? '',
          title: data.project?.title ?? projectTitle,
          nodes: nextNodes,
          edges: nextEdges,
          viewport: nextViewport,
        })
        writeCanvasCache({
          projectId: resolvedProjectId,
          workflowId: data.workflow?.id ?? cache?.workflowId ?? '',
          nodes: nextNodes,
          edges: nextEdges,
          viewport: nextViewport as CanvasCache['viewport'],
          serverUpdatedAt: serverUpdatedAtText,
          syncedAt: serverUpdatedAtText,
        })
        setSaveStatus(shouldUseDraft ? 'restored-draft' : shouldPreserveLocalNodes ? 'local-draft' : 'saved')
        if (!shouldUseDraft && !shouldPreserveLocalNodes) setSaveMessage('Saved')
        canvasLoadedRef.current = true
        hasHydratedCanvasRef.current = true
        isInitializingRef.current = false
        if (shouldPreserveLocalNodes && nextNodes.length > 0) {
          const restoredWorkflowId = data.workflow?.id ?? cache?.workflowId
          if (restoredWorkflowId) {
            window.setTimeout(() => {
              void fetch(`/api/projects/${encodeURIComponent(resolvedProjectId)}/canvas`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  workflowId: restoredWorkflowId,
                  viewport: nextViewport,
                  nodes: nextNodes,
                  edges: nextEdges,
                  deletedNodeIds: [],
                  deletedEdgeIds: [],
                }),
              }).catch(() => {})
            }, 0)
          }
        }
        devPerf('firstRender')
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
  }, [applyCanvasSnapshot, projectTitle, readCanvasCache, readLocalDraft, router, searchParamProjectId, writeCanvasCache])

  useEffect(() => {
    latestViewportRef.current = { zoom: canvasZoom, pan: canvasPan }
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false
      return
    }
    if (hasHydratedCanvasRef.current && !isInitializingRef.current) {
      writeLocalDraft()
    }
    scheduleCanvasSave()
  }, [canvasPan, canvasZoom, edges, nodes, scheduleCanvasSave, writeLocalDraft])

  // Flush pending save on page leave / tab hide / component unmount
  useEffect(() => {
    if (!projectId || !workflowId) return

    function flushSave() {
      if (!hasHydratedCanvasRef.current || isInitializingRef.current) return
      const snapshot = {
        nodes: latestNodesRef.current,
        edges: latestEdgesRef.current,
        viewport: latestViewportRef.current,
      }
      // Always write local draft first (synchronous)
      try {
        window.localStorage.setItem(`creator-city:draft:${projectId}`, JSON.stringify({
          projectId,
          workflowId,
          ...snapshot,
          updatedAt: new Date().toISOString(),
        }))
      } catch (_) { /* localStorage unavailable */ }
      // Best-effort keepalive fetch so the server also gets the update
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      try {
        fetch(`/api/projects/${encodeURIComponent(projectId)}/canvas`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          keepalive: true,
          body: JSON.stringify({
            workflowId,
            viewport: snapshot.viewport,
            nodes: snapshot.nodes,
            edges: snapshot.edges,
            deletedNodeIds: deletedNodeIdsRef.current,
            deletedEdgeIds: deletedEdgeIdsRef.current,
          }),
        }).catch(() => {})
      } catch (_) { /* keepalive fetch not supported */ }
    }

    const onPageHide = () => flushSave()
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flushSave() }
    const onBeforeUnload = () => flushSave()

    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      flushSave()  // also flush on React component unmount (e.g. in-app navigation)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
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
    setContextMenu(null)
    setNodeAddMenu(null)
    setConnectionDraft(null)
  }, [commitEdges, commitNodes, edges])

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
    setContextMenu(null)
    setNodeAddMenu(null)
    return duplicate
  }, [commitNodes, nodes])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      return Boolean(element?.closest('input, textarea, [contenteditable="true"]'))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
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

      if (event.key === 'Escape') {
        setContextMenu(null)
        setNodeAddMenu(null)
        setNodeCreateMenu(null)
        setConnectionDraft(null)
        connectionDragRef.current = null
        setIsAddMenuOpen(false)
        setEditingNodeId(null)
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
  }, [activeNodeId, canvasZoom, deleteNode, resetCanvasView, setZoomAroundPoint])

  const activeNode = useMemo(
    () => nodes.find((node) => node.id === activeNodeId) ?? null,
    [activeNodeId, nodes],
  )
  const editingNode = useMemo(
    () => nodes.find((node) => node.id === editingNodeId) ?? null,
    [editingNodeId, nodes],
  )
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
  const activeProvider = useMemo(
    () => getCanvasProvider(getProviderKind(preferredKind), normalizedPromptModel),
    [preferredKind, normalizedPromptModel],
  )
  const providerOptionLabels = useMemo(
    () => Object.fromEntries(getCanvasProviders(getProviderKind(preferredKind)).map((provider) => [provider.id, provider.name])),
    [preferredKind],
  )
  const activeProviderLabel = activeProvider?.name ?? getCanvasProviderLabel(getProviderKind(preferredKind), normalizedPromptModel)
  const activeProviderLiveStatus = liveStatusMap.get(normalizedPromptModel)
  const activeProviderStatus = activeProviderLiveStatus
    ?? (liveStatusLoading ? 'checking' : activeProvider?.status ?? getCanvasProviderStatus(getProviderKind(preferredKind), normalizedPromptModel) ?? 'unknown')
  const activeProviderNotice = activeProviderStatus === 'checking'
    ? '正在检查 provider 实时状态'
    : activeProviderStatus === 'unknown'
      ? '暂时无法确认 provider 实时状态'
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

  const handleNodeDragStart = useCallback((
    nodeId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return

    event.preventDefault()
    event.stopPropagation()
    nodeDragRef.current = {
      nodeId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node.x,
      startY: node.y,
    }
    setActiveNodeId(nodeId)
    setDraggingNodeId(nodeId)
    setContextMenu(null)
    setNodeAddMenu(null)
  }, [nodes])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = nodeDragRef.current
      if (!drag) return
      const nextX = drag.startX + (event.clientX - drag.startClientX) / canvasZoom
      const nextY = drag.startY + (event.clientY - drag.startClientY) / canvasZoom
      handleNodePatch(drag.nodeId, {
        x: Number.isFinite(nextX) ? nextX : drag.startX,
        y: Number.isFinite(nextY) ? nextY : drag.startY,
      })
    }

    const handlePointerUp = () => {
      const hadDrag = Boolean(nodeDragRef.current)
      nodeDragRef.current = null
      setDraggingNodeId('')
      if (hadDrag) scheduleCanvasSave(0)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [canvasZoom, handleNodePatch, scheduleCanvasSave])

  const syncPromptPreset = useCallback((kind: VisualCanvasNodeKind) => {
    const meta = NODE_META[kind]
    const providerKind = getProviderKind(kind)
    const defaultModel = getCanvasProvider(providerKind, meta.model)?.id ?? CANVAS_PROVIDER_FALLBACKS[providerKind]
    setPreferredKind(kind)
    setPromptModel(defaultModel)
    if (meta.ratio) {
      setPromptRatio(meta.ratio)
      const preset = Object.entries(PARAMETER_RATIO_MAP).find(([, value]) => value === meta.ratio)?.[0]
      if (preset) {
        setPromptParameter(preset as keyof typeof PARAMETER_RATIO_MAP)
      }
    }
  }, [])

  const focusPromptForNode = useCallback((node: VisualCanvasNode) => {
    setActiveNodeId(node.id)
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
  }, [syncPromptPreset])

  const buildResultLabel = useCallback((title: string) => {
    const assetCopy = promptAssetMode === 'none' ? '无素材' : assetLabel
    const providerCopy = activeProviderNotice ? ` · ${activeProviderNotice}` : ''
    return `${title} · ${stageLabel} · ${assetCopy} · ${parameterLabel}${providerCopy}。结果已就绪，可继续追加下一个节点。`
  }, [activeProviderNotice, assetLabel, parameterLabel, promptAssetMode, stageLabel])

  const handleAddNode = useCallback((kind: VisualCanvasNodeKind, presetTitle?: string) => {
    setHasStarted(true)
    syncPromptPreset(kind)
    createNode(kind, {
      title: presetTitle ?? NODE_META[kind].title,
      model: NODE_META[kind].model,
      ratio: NODE_META[kind].ratio,
    })
    setEditingNodeId(null)
  }, [createNode, syncPromptPreset])

  const closeCanvasPanel = useCallback(() => {
    setActivePanel(null)
  }, [])

  const handleOpenAssetsPanel = useCallback(() => {
    setActivePanel((current) => (current === 'assets' ? null : 'assets'))
    setCommentsEnabled(false)
    setIsAddMenuOpen(false)
    setEditingNodeId(null)
    setContextMenu(null)
    setNodeAddMenu(null)
  }, [])

  const handleOpenTemplatePanel = useCallback(() => {
    setActivePanel((current) => (current === 'templates' ? null : 'templates'))
    setCommentsEnabled(false)
    setIsAddMenuOpen(false)
    setEditingNodeId(null)
    setContextMenu(null)
    setNodeAddMenu(null)
  }, [])

  const handleToggleCommentsPanel = useCallback(() => {
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
  }, [showCanvasFeedback])

  const handleOpenHistoryPanel = useCallback(() => {
    setActivePanel((current) => (current === 'history' ? null : 'history'))
    setCommentsEnabled(false)
    setIsAddMenuOpen(false)
    setEditingNodeId(null)
    setContextMenu(null)
    setNodeAddMenu(null)
  }, [])

  const handleOpenImageEditor = useCallback(() => {
    setHasStarted(true)
    setEditingNodeId(null)
    setActivePanel((current) => (current === 'image-editor' ? null : 'image-editor'))
    setCommentsEnabled(false)
    setIsAddMenuOpen(false)
    setEditingNodeId(null)
    showCanvasFeedback(activeNode?.kind === 'image' ? '已打开当前图片节点的编辑器。' : '请选择一个高级编辑功能。')
  }, [activeNode, showCanvasFeedback])

  const handleAddAsset = useCallback((asset: { title: string; category: string; prompt: string }) => {
    setHasStarted(true)
    const node = createNode('asset', {
      title: asset.title,
      prompt: asset.prompt,
      model: NODE_META.asset.model,
      status: 'done',
    })
    handleNodePatch(node.id, {
      resultPreview: `${asset.category} · ${asset.title} 已加入素材库，可拖入后续生成链路。`,
      outputLabel: '素材已就绪',
    })
    showCanvasFeedback(`${asset.title} 已加入画布素材。`)
  }, [createNode, handleNodePatch, showCanvasFeedback])

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

  const handleAddComment = useCallback((text: string) => {
    setComments((current) => [
      {
        id: `comment-${Date.now()}`,
        text,
        createdAt: Date.now(),
      },
      ...current,
    ])
    showCanvasFeedback('评论已添加到本地列表。')
  }, [showCanvasFeedback])

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

    const trimmedPrompt = canvasPrompt.trim()
    if (!trimmedPrompt) {
      const errMsg = '请先输入 prompt 再生成。'
      setDialogError(errMsg)
      return
    }

    const nodeSnapshot = editingNode
    const nodeType = getProviderNodeType(nodeSnapshot.kind)

    // Validate provider supports this node type
    const providerEntry = getToolProviderById(normalizedPromptModel)
    if (providerEntry && !providerEntry.nodeTypes.includes(nodeType)) {
      const supportedTypes = providerEntry.nodeTypes.join(' / ')
      const errMsg = `${providerEntry.name} 仅支持 ${supportedTypes} 节点，当前节点类型为 ${nodeType}。请切换到对应节点后重试。`
      setDialogError(errMsg)
      showCanvasFeedback(errMsg)
      return
    }

    // Collect image URLs from upstream nodes connected by edges (for image→video workflow)
    const upstreamImageAssets = edges
      .filter((edge) => edge.toNodeId === nodeSnapshot.id)
      .flatMap((edge) => {
        const upstreamNode = nodes.find((n) => n.id === edge.fromNodeId)
        if (!upstreamNode?.resultImageUrl) return []
        return [{ id: upstreamNode.id, type: 'image', url: upstreamNode.resultImageUrl }]
      })

    setDialogError(null)
    handleNodePatch(editingNode.id, {
      prompt: trimmedPrompt,
      model: normalizedPromptModel,
      providerId: normalizedPromptModel,
      stage: promptStage,
      ratio: editingNode.ratio ? promptRatio : editingNode.ratio,
      status: 'generating',
      errorMessage: undefined,
    })

    void callGenerationApi(
      nodeType,
      normalizedPromptModel,
      trimmedPrompt,
      { ratio: promptRatio, stage: promptStage, parameter: promptParameter },
      nodeSnapshot.id,
      upstreamImageAssets.length > 0 ? upstreamImageAssets : undefined,
    ).then(async (result) => {
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
            const errMsg = jobResult.message || jobResult.errorCode || '生成失败'
            handleNodePatch(nodeSnapshot.id, { status: 'error', errorMessage: errMsg, resultPreview: jobFallback, outputLabel: jobFallback })
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
          const jobResultText = jobResult.result?.text
          handleNodePatch(nodeSnapshot.id, {
            status: 'done',
            resultText: jobResultText,
            resultPreview: jobResultText?.slice(0, 200) ?? jobFallback,
            outputLabel: jobFallback,
            resultVideoUrl: jobResult.result?.videoUrl ?? nodeSnapshot.resultVideoUrl,
            errorMessage: undefined,
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
      const fallbackPreview = trimmedPrompt ? buildMockResult(nodeSnapshot, trimmedPrompt) : buildResultLabel(nodeSnapshot.title)

      if (!result.success) {
        const errMsg = result.message || result.errorCode || '生成失败'
        handleNodePatch(nodeSnapshot.id, { status: 'error', errorMessage: errMsg, resultPreview: fallbackPreview, outputLabel: fallbackPreview })
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

      const resultText = result.result?.text
      const resultImageUrl = result.result?.imageUrl
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
      if (resultImageUrl) {
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
  }, [buildResultLabel, canvasPrompt, commitEdges, createGeneratedAsset, edges, editingNode, handleNodePatch, nodes, normalizedPromptModel, promptParameter, promptRatio, promptStage, setDialogError, showCanvasFeedback])

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
      startClientX: event.clientX,
      startClientY: event.clientY,
    }
    setActiveNodeId(nodeId)
    setContextMenu(null)
    setNodeAddMenu(null)
    setEditingNodeId(null)
    setConnectionDraft({
      nodeId,
      x1: direction === 'out'
        ? sourceNode.x + sourceNode.width + CONNECTOR_VISUAL_OFFSET
        : sourceNode.x - CONNECTOR_VISUAL_OFFSET,
      y1: sourceNode.y + sourceNode.height / 2,
      x2: direction === 'out'
        ? sourceNode.x + sourceNode.width + CONNECTOR_VISUAL_OFFSET + 36
        : sourceNode.x - CONNECTOR_VISUAL_OFFSET - 36,
      y2: sourceNode.y + sourceNode.height / 2,
    })
  }, [nodes])

  const openNodeContextMenu = useCallback((nodeId: string, clientX: number, clientY: number) => {
    const position = clampMenuPosition(clientX, clientY, NODE_MENU_WIDTH, NODE_MENU_HEIGHT)
    setContextMenu({ nodeId, ...position })
    setNodeAddMenu(null)
    setIsAddMenuOpen(false)
    setActiveNodeId(nodeId)
  }, [])

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

      const point = getViewportWorldPoint(event.clientX, event.clientY)
      const size = getNodeSize('image')
      const nextWorldX = drag.direction === 'out' ? point.x + 42 : point.x - size.width - 42
      openNodeAddMenuAt(
        drag.nodeId,
        drag.direction,
        event.clientX + 12,
        event.clientY - NODE_ADD_MENU_HEIGHT / 2,
        nextWorldX,
        point.y - size.height / 2,
      )
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [getViewportWorldPoint, openNodeAddMenu, openNodeAddMenuAt])

  const canStartCanvasPan = useCallback((target: EventTarget | null) => {
    const element = target as HTMLElement | null
    return !element?.closest('button, input, textarea, [contenteditable="true"], .canvas-node-card, .canvas-node-dialog, .canvas-prompt-box, .canvas-prompt-console, .canvas-topbar, .canvas-toolbar-shell, .canvas-add-menu, .canvas-zoom-controls, .canvas-context-menu, .canvas-node-add-menu, .canvas-node-create-menu, .canvas-side-panel, .canvas-user-menu')
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
  }, [canStartCanvasPan, canvasPan.x, canvasPan.y])

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
      options: getCanvasProviders(getProviderKind(preferredKind)).map((provider) => ({
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
  ], [activeProviderLabel, assetLabel, handleProviderChange, liveStatusLoading, liveStatusMap, onShowStartup, parameterLabel, preferredKind, stageLabel, syncPromptPreset])

  const handleCreateMenuSelect = useCallback((kind: VisualCanvasNodeKind) => {
    const size = getNodeSize(kind)
    const position = nodeCreateMenu
      ? {
        x: nodeCreateMenu.worldX - (size.width - NODE_SIZE.text.width) / 2,
        y: nodeCreateMenu.worldY,
      }
      : undefined
    syncPromptPreset(kind)
    const node = createNode(kind, {
      title: NODE_META[kind].title,
      model: NODE_META[kind].model,
      ratio: NODE_META[kind].ratio,
      position,
    })
    setEditingNodeId(node.id)
    setNodeCreateMenu(null)
  }, [createNode, nodeCreateMenu, syncPromptPreset])

  const handleCanvasDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const element = event.target as HTMLElement | null
    if (element?.closest('button, input, textarea')) return
    if (!canStartCanvasPan(event.target)) return
    event.preventDefault()
    event.stopPropagation()

    setHasStarted(true)
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
  }, [canStartCanvasPan, createNode, focusPromptForNode, getViewportWorldPoint, syncPromptPreset])

  const handleShareCanvasLink = useCallback(async () => {
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
  }, [])

  const handleBeforeNewProject = useCallback(async () => {
    const confirmed = window.confirm('当前画布会先保存，然后创建新项目。')
    if (!confirmed) return false
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    await saveCanvas()
    return true
  }, [saveCanvas])

  const handleOpenClientDelivery = useCallback(() => {
    const projectId = new URLSearchParams(window.location.search).get('projectId') ?? undefined
    window.location.assign(getClientDeliveryHref(projectId))
  }, [])

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

  return (
    <div className={`${canvasStyles.scope} h-full min-h-0`}>
    <div className={`canvas-root ${hasStarted ? 'is-started' : ''}`}>
      <div className="canvas-background-glow" />
      <div className="canvas-grid" />

      <div className="canvas-topbar create-glass-panel">
        <div className="canvas-topbar-brand">
          <a
            href="/"
            className="canvas-topbar-home-link"
            aria-label="回到首页"
            title={`回到首页 · ${templateName ? `${loadedProjectTitle} · ${templateName}` : loadedProjectTitle}`}
          >
            <span className="canvas-topbar-logo" aria-hidden="true" />
            <span className="canvas-topbar-home-copy">
              <span className="canvas-topbar-title">Creator City</span>
              <span className="canvas-topbar-copy">{loadedProjectTitle}</span>
            </span>
          </a>
        </div>

        <div className="canvas-topbar-actions">
          <button
            type="button"
            className="canvas-secondary-button"
            title={saveMessage || saveStatus}
            onClick={() => { if (saveStatus === 'failed' || saveStatus === 'local-draft' || saveStatus === 'restored-draft') void saveCanvas() }}
          >
            {saveStatus === 'opening'
              ? '正在打开项目...'
              : saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'dirty'
                  ? 'Saving...'
                  : saveStatus === 'local-draft'
                    ? 'Offline draft saved'
                    : saveStatus === 'restored-draft'
                      ? 'Restored draft'
                      : saveStatus === 'failed'
                        ? 'Save failed'
                        : 'Saved'}
          </button>
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="canvas-secondary-button"
            title="新建项目"
            aria-label="新建项目"
            data-tooltip="新建项目"
          >
            新建项目
            <span className="canvas-hover-tooltip" aria-hidden="true">保存当前画布并创建新项目</span>
          </button>
          <a href="/projects" className="canvas-nav-link" title="打开项目列表" aria-label="打开项目列表" data-tooltip="打开项目列表">
            项目
            <span className="canvas-hover-tooltip" aria-hidden="true">打开项目列表</span>
          </a>
          <a href="/community" className="canvas-nav-link" title="进入社群" aria-label="进入社群" data-tooltip="进入社群">
            社区
            <span className="canvas-hover-tooltip" aria-hidden="true">进入社群</span>
          </a>
          <button
            type="button"
            onClick={handleOpenClientDelivery}
            className="canvas-secondary-button"
            title="客户交付"
            aria-label="打开客户交付界面"
            data-tooltip="客户交付"
          >
            客户
            <span className="canvas-hover-tooltip" aria-hidden="true">客户交付</span>
          </button>
          <button
            type="button"
            onClick={() => { void handleShareCanvasLink() }}
            className="canvas-secondary-button"
            title="复制画布链接"
            aria-label="复制画布链接"
            data-tooltip="复制画布链接"
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
            <WorkspaceAssetsPanel
              compact
              shotCount={nodes.filter((node) => node.kind === 'video').length}
              storyboardFrameCount={nodes.filter((node) => node.kind === 'image').length}
              versionCount={nodes.filter((node) => node.status === 'done').length}
              audioCueCount={nodes.filter((node) => node.kind === 'audio').length}
              onClose={closeCanvasPanel}
              onUploadMock={() => handleAddAsset({ title: '上传素材', category: 'Upload', prompt: '上传入口创建的本地素材，可替换为真实文件后继续生成。' })}
              onAddAsset={handleAddAsset}
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
        ) : null}
      </AnimatePresence>

      {commentsEnabled ? (
        <CanvasCommentsPanel
          comments={comments}
          onAddComment={handleAddComment}
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
                    x1={fromNode.x + fromNode.width + CONNECTOR_VISUAL_OFFSET}
                    y1={fromNode.y + fromNode.height / 2}
                    x2={toNode.x}
                    y2={toNode.y + toNode.height / 2}
                    active={edge.status === 'active' || activeNodeId === fromNode.id || activeNodeId === toNode.id}
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
              />
            </div>
          ))}
        </div>
      </div>

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
            resultSummary={editingNode.status === 'done' ? (editingNode.resultText ?? editingNode.resultPreview ?? editingNode.outputLabel) : undefined}
            errorMessage={dialogError ?? undefined}
            models={workspaceModels}
            onModelChange={handleProviderChange}
            ratio={promptRatio}
            ratios={WORKSPACE_RATIOS}
            onRatioChange={setPromptRatio}
            placeholder="描述这个节点要生成的内容"
            onGenerate={handleNodeDialogGenerate}
            generateLabel={
              editingNode.status === 'generating'
                ? '生成中…'
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
