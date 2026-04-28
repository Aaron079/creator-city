'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CanvasFlowEdge } from '@/components/create/CanvasFlowEdge'
import { CanvasNodeCard, type VisualCanvasNode, type VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { CanvasPromptBox, type CanvasPromptFooterItem } from '@/components/create/CanvasPromptBox'
import { CanvasToolDock } from '@/components/create/CanvasToolDock'
import { CanvasCommentsPanel, type CanvasComment } from '@/components/create/CanvasCommentsPanel'
import { CanvasHistoryPanel, type CanvasHistoryItem } from '@/components/create/CanvasHistoryPanel'
import { CanvasTemplatePanel } from '@/components/create/CanvasTemplatePanel'
import { ImageEditorPanel } from '@/components/create/ImageEditorPanel'
import { WorkspaceAssetsPanel } from '@/components/create/WorkspaceAssetsPanel'
import {
  getPublicTemplateById,
  type PublicTemplate,
} from '@/lib/templates/public-template-catalog'
import {
  CANVAS_PROVIDER_FALLBACKS,
  getCanvasProvider,
  getCanvasProviderLabel,
  getCanvasProviderNotice,
  getCanvasProviders,
  getCanvasProviderStatus,
  type CanvasProviderKind,
} from '@/lib/tools/provider-groups'
import { getProviderStatusLabel } from '@/lib/tools/provider-status'
import { generateWithProvider, pollJobStatus } from '@/lib/tools/provider-adapters'
import { getClientDeliveryHref } from '@/lib/routing/actions'
import type { ToolProviderNodeType } from '@/lib/tools/provider-catalog'

interface VisualCanvasWorkspaceProps {
  projectTitle: string
  templateName?: string | null
  onOpenTimeline: () => void
  onOpenAssets: () => void
  onOpenDelivery: () => void
  onShowStartup: () => void
}

type CanvasEdgeStatus = 'idle' | 'active' | 'done'

interface CanvasEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  status: CanvasEdgeStatus
}

const NODE_META: Record<VisualCanvasNodeKind, { title: string; subtitle: string; model: string; ratio?: string }> = {
  text: { title: '文本', subtitle: '从一句想法、脚本片段或 brief 开始。', model: 'anthropic-claude' },
  image: { title: '图片', subtitle: '先做视觉方向、关键画面与风格参考。', model: 'nano-banana', ratio: '16:9' },
  video: { title: '视频', subtitle: '直接推进镜头、节奏和画面运动。', model: 'seedance-1-5-pro', ratio: '16:9' },
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
  const [nodes, setNodes] = useState<VisualCanvasNode[]>([])
  const [edges, setEdges] = useState<CanvasEdge[]>([])
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<string>('add')
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const [canvasPrompt, setCanvasPrompt] = useState('')
  const [promptModel, setPromptModel] = useState('runway')
  const [promptRatio, setPromptRatio] = useState('16:9')
  const [preferredKind, setPreferredKind] = useState<VisualCanvasNodeKind>('video')
  const [promptStage, setPromptStage] = useState<(typeof STAGE_OPTIONS)[number]['value']>('draft')
  const [promptAssetMode, setPromptAssetMode] = useState<(typeof ASSET_OPTIONS)[number]['value']>('none')
  const [promptParameter, setPromptParameter] = useState<(typeof PARAMETER_OPTIONS)[number]['value']>('16:9-balanced')
  const [hasStarted, setHasStarted] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
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
  const initialTemplateAppliedRef = useRef('')
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
    }
  }, [])

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
    setNodes((current) => current.filter((node) => node.id !== nodeId))
    setEdges((current) => current.filter((edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId))
    setActiveNodeId((current) => (current === nodeId ? null : current))
    setEditingNodeId((current) => (current === nodeId ? null : current))
    setContextMenu(null)
    setNodeAddMenu(null)
    setConnectionDraft(null)
  }, [])

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

    setNodes((current) => [...current, duplicate])
    setActiveNodeId(nodeId)
    setEditingNodeId(null)
    setContextMenu(null)
    setNodeAddMenu(null)
    return duplicate
  }, [nodes])

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
  const activeProvider = useMemo(
    () => getCanvasProvider(getProviderKind(preferredKind), promptModel),
    [preferredKind, promptModel],
  )
  const providerOptionLabels = useMemo(
    () => Object.fromEntries(getCanvasProviders(getProviderKind(preferredKind)).map((provider) => [provider.id, provider.name])),
    [preferredKind],
  )
  const activeProviderLabel = activeProvider?.name ?? getCanvasProviderLabel(getProviderKind(preferredKind), promptModel)
  const activeProviderStatus = activeProvider?.status ?? getCanvasProviderStatus(getProviderKind(preferredKind), promptModel)
  const activeProviderNotice = getCanvasProviderNotice(activeProvider)
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
    setPromptModel(activeNode.providerId || activeNode.model)
    setPreferredKind(activeNode.kind)
    if (activeNode.ratio) {
      setPromptRatio(activeNode.ratio)
    }
  }, [activeNode])

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
    const providerId = options?.model ?? meta.model
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

    setNodes((current) => [...current, node])
    if (parentNode) {
      const edgeId = `${parentNode.id}-${node.id}`
      setEdges((current) => [
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
  }, [canvasPan.x, canvasPan.y, canvasZoom, nodes, promptStage])

  const handleNodePatch = useCallback((nodeId: string, patch: Partial<VisualCanvasNode>) => {
    setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)))
  }, [])

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
      handleNodePatch(drag.nodeId, {
        x: drag.startX + (event.clientX - drag.startClientX) / canvasZoom,
        y: drag.startY + (event.clientY - drag.startClientY) / canvasZoom,
      })
    }

    const handlePointerUp = () => {
      nodeDragRef.current = null
      setDraggingNodeId('')
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [canvasZoom, handleNodePatch])

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
    setPromptModel(node.providerId || node.model)
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
        preview: {
          ...template.preview,
          gradientFrom: template.thumbnail.gradientFrom,
          gradientTo: template.thumbnail.gradientTo,
        },
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

    setNodes((current) => [...current, ...nextNodes])
    setEdges((current) => [...current, ...nextEdges])

    const firstNode = nextNodes[0]
    if (firstNode) {
      setActiveNodeId(firstNode.id)
      setEditingNodeId(null)
      setCanvasPrompt(firstNode.prompt)
      setPromptModel(firstNode.providerId || firstNode.model)
      syncPromptPreset(firstNode.kind)
    }

    showCanvasFeedback('已应用模板，可继续创作。')
  }, [nodes, promptStage, showCanvasFeedback, syncPromptPreset])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const queryTemplateId = new URLSearchParams(window.location.search).get('template')
    const storedTemplateId = window.sessionStorage.getItem('creator-city-template-id')
    const templateId = queryTemplateId ?? storedTemplateId
    if (!templateId || initialTemplateAppliedRef.current === templateId) return
    const template = getPublicTemplateById(templateId)
    if (!template) return
    initialTemplateAppliedRef.current = templateId
    handleSelectTemplate(template)
    window.sessionStorage.removeItem('creator-city-template-id')
    window.history.replaceState({}, '', window.location.pathname)
    window.setTimeout(() => {
      window.history.replaceState({}, '', window.location.pathname)
    }, 0)
  }, [handleSelectTemplate])

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
    const nodeSnapshot = editingNode
    handleNodePatch(editingNode.id, {
      prompt: trimmedPrompt,
      model: promptModel,
      providerId: promptModel,
      stage: promptStage,
      ratio: editingNode.ratio ? promptRatio : editingNode.ratio,
      status: 'generating',
    })

    void generateWithProvider({
      providerId: promptModel,
      nodeType: getProviderNodeType(nodeSnapshot.kind),
      prompt: trimmedPrompt,
      params: {
        ratio: promptRatio,
        stage: promptStage,
        parameter: promptParameter,
      },
    }).then(async (result) => {
      // Async job queued (e.g. Runway): poll until done or failed
      if ((result.status === 'queued' || result.status === 'running') && result.jobId) {
        handleNodePatch(nodeSnapshot.id, {
          resultPreview: result.resultPreview,
          outputLabel: result.message,
        })
        const maxPolls = 60
        let polls = 0
        const poll = async () => {
          if (polls++ >= maxPolls || !result.jobId) return
          const jobResult = await pollJobStatus(result.jobId)
          if (jobResult.status === 'queued' || jobResult.status === 'running') {
            handleNodePatch(nodeSnapshot.id, { resultPreview: jobResult.resultPreview })
            const timer = window.setTimeout(() => { void poll() }, 5000)
            timersRef.current.push(timer)
            return
          }
          const preview = jobResult.resultPreview || buildResultLabel(nodeSnapshot.title)
          handleNodePatch(nodeSnapshot.id, {
            status: 'done',
            resultPreview: preview,
            outputLabel: preview,
          })
          setEdges((current) => current.map((edge) => (
            edge.toNodeId === nodeSnapshot.id || edge.fromNodeId === nodeSnapshot.id
              ? { ...edge, status: 'done' }
              : edge
          )))
          setEditingNodeId(null)
        }
        const timer = window.setTimeout(() => { void poll() }, 5000)
        timersRef.current.push(timer)
        return
      }

      // Immediate result (real or mock)
      const fallbackPreview = trimmedPrompt
        ? buildMockResult(nodeSnapshot, trimmedPrompt)
        : buildResultLabel(nodeSnapshot.title)
      const preview = result.resultPreview || fallbackPreview

      handleNodePatch(nodeSnapshot.id, {
        status: 'done',
        resultPreview: preview,
        outputLabel: preview,
      })
      setEdges((current) => current.map((edge) => (
        edge.toNodeId === nodeSnapshot.id || edge.fromNodeId === nodeSnapshot.id
          ? { ...edge, status: 'done' }
          : edge
      )))
      setEditingNodeId(null)
    })
  }, [buildMockResult, buildResultLabel, canvasPrompt, editingNode, handleNodePatch, promptModel, promptParameter, promptRatio, promptStage])

  const handlePromptChange = useCallback((value: string) => {
    setCanvasPrompt(value)
    if (editingNode) {
      handleNodePatch(editingNode.id, { prompt: value })
    }
  }, [editingNode, handleNodePatch])

  const handleProviderChange = useCallback((value: string) => {
    setPromptModel(value)
    if (editingNode) {
      handleNodePatch(editingNode.id, {
        model: value,
        providerId: value,
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
      setEdges((current) => [
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
  }, [createNode, nodeAddMenu, syncPromptPreset])

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
      value: activeProviderStatus ? `${activeProviderLabel} · ${activeProviderStatus}` : activeProviderLabel,
      options: getCanvasProviders(getProviderKind(preferredKind)).map((provider) => ({
        value: provider.id,
        label: provider.name,
        hint: `${getProviderStatusLabel(provider.status)} · ${provider.estimatedTime}`,
        badge: provider.status,
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
  ], [activeProviderLabel, activeProviderStatus, assetLabel, handleProviderChange, onShowStartup, parameterLabel, preferredKind, stageLabel, syncPromptPreset])

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
    <div className={`canvas-root ${hasStarted ? 'is-started' : ''}`}>
      <div className="canvas-background-glow" />
      <div className="canvas-grid" />

      <div className="canvas-topbar create-glass-panel">
        <div className="canvas-topbar-brand">
          <a
            href="/"
            className="canvas-topbar-home-link"
            aria-label="回到首页"
            title={`回到首页 · ${templateName ? `${projectTitle} · ${templateName}` : projectTitle}`}
          >
            <span className="canvas-topbar-logo" aria-hidden="true" />
            <span className="canvas-topbar-home-copy">
              <span className="canvas-topbar-title">Creator City</span>
              <span className="canvas-topbar-copy">{projectTitle}</span>
            </span>
          </a>
        </div>

        <div className="canvas-topbar-actions">
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
        {!hasStarted && nodes.length === 0 ? (
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
            resultSummary={editingNode.status === 'done' ? editingNode.resultPreview ?? editingNode.outputLabel : undefined}
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
                : activeProviderStatus === 'not-configured'
                  ? '未配置'
                  : activeProviderStatus === 'available'
                    ? '生成'
                    : '模拟生成'
            }
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
  )
}
