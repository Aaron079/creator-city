'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CanvasFlowEdge } from '@/components/create/CanvasFlowEdge'
import { CanvasNodeCard, type VisualCanvasNode, type VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { CanvasPromptBox, type CanvasPromptFooterItem } from '@/components/create/CanvasPromptBox'
import { CanvasToolDock } from '@/components/create/CanvasToolDock'
import {
  CANVAS_PROVIDER_FALLBACKS,
  getCanvasProvider,
  getCanvasProviderLabel,
  getCanvasProviderNotice,
  getCanvasProviders,
  getCanvasProviderStatus,
  type CanvasProviderKind,
} from '@/lib/tools/provider-groups'

interface VisualCanvasWorkspaceProps {
  projectTitle: string
  templateName?: string | null
  onOpenTimeline: () => void
  onOpenAssets: () => void
  onOpenDelivery: () => void
  onShowStartup: () => void
}

type EntryKind = 'text' | 'image' | 'video' | 'audio' | 'upload' | 'template'
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
  video: { title: '视频', subtitle: '直接推进镜头、节奏和画面运动。', model: 'runway', ratio: '16:9' },
  audio: { title: '音频', subtitle: '补充音乐、旁白和声音氛围。', model: 'elevenlabs' },
  asset: { title: '素材', subtitle: '导入图片、视频或音频参考素材。', model: 'asset-drop' },
  template: { title: '模板', subtitle: '从模板流程继续创作。', model: 'asset-drop' },
  delivery: { title: '交付', subtitle: '整理版本摘要与客户确认信息。', model: 'delivery-agent' },
  world: { title: '3D 世界', subtitle: '建立场景结构、空间层级与世界观。', model: 'spatial-world' },
  upload: { title: '上传', subtitle: '导入图片、视频或音频参考素材。', model: 'asset-drop' },
}

const NODE_SIZE: Record<VisualCanvasNodeKind, { width: number; height: number }> = {
  text: { width: 360, height: 260 },
  image: { width: 380, height: 320 },
  video: { width: 420, height: 300 },
  audio: { width: 360, height: 220 },
  asset: { width: 360, height: 260 },
  template: { width: 360, height: 260 },
  delivery: { width: 360, height: 240 },
  world: { width: 380, height: 280 },
  upload: { width: 360, height: 260 },
}

const ENTRY_ACTIONS: Array<{ label: string; kind: EntryKind; hint: string }> = [
  { label: '文本', kind: 'text', hint: '脚本 / 文案' },
  { label: '图片', kind: 'image', hint: '关键画面' },
  { label: '视频', kind: 'video', hint: '镜头生成' },
  { label: '音频', kind: 'audio', hint: '旁白 / 配乐' },
  { label: '上传', kind: 'upload', hint: '参考素材' },
  { label: '模板', kind: 'template', hint: 'Setup' },
]

const WORKSPACE_RATIOS = ['16:9', '9:16', '1:1']
const MIN_CANVAS_ZOOM = 0.35
const MAX_CANVAS_ZOOM = 1.8
const CANVAS_ZOOM_STEP = 0.1
const NODE_MENU_WIDTH = 214
const NODE_MENU_HEIGHT = 252
const NODE_ADD_MENU_WIDTH = 190
const NODE_ADD_MENU_HEIGHT = 228
const INTENT_MENU_WIDTH = 286
const INTENT_MENU_HEIGHT = 220
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
          ? '素材'
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

function clampCanvasPoint(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

function clampCanvasZoom(value: number) {
  return Math.max(MIN_CANVAS_ZOOM, Math.min(value, MAX_CANVAS_ZOOM))
}

function getNodeRatio(kind: VisualCanvasNodeKind, ratio: string) {
  return kind === 'text' || kind === 'audio' || kind === 'upload' ? undefined : ratio
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

function getNodeSize(kind: VisualCanvasNodeKind) {
  return NODE_SIZE[kind] ?? NODE_SIZE.text
}

function doNodesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return !(
    left.x + left.width + 40 < right.x ||
    right.x + right.width + 40 < left.x ||
    left.y + left.height + 40 < right.y ||
    right.y + right.height + 40 < left.y
  )
}

function resolveNonOverlappingPosition(
  candidate: { x: number; y: number; width: number; height: number },
  nodes: VisualCanvasNode[],
) {
  let next = { ...candidate }
  let guard = 0

  while (nodes.some((node) => doNodesOverlap(next, node)) && guard < 16) {
    next = { ...next, y: next.y + 280 }
    guard += 1
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

export function VisualCanvasWorkspace({
  projectTitle,
  templateName,
  onOpenTimeline,
  onOpenAssets,
  onOpenDelivery,
  onShowStartup,
}: VisualCanvasWorkspaceProps) {
  const [nodes, setNodes] = useState<VisualCanvasNode[]>([])
  const [edges, setEdges] = useState<CanvasEdge[]>([])
  const [activeNodeId, setActiveNodeId] = useState<string>('')
  const [activeTool, setActiveTool] = useState<string>('add')
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const [canvasPrompt, setCanvasPrompt] = useState('')
  const [promptModel, setPromptModel] = useState('runway')
  const [promptRatio, setPromptRatio] = useState('16:9')
  const [preferredKind, setPreferredKind] = useState<VisualCanvasNodeKind>('video')
  const [promptStage, setPromptStage] = useState<(typeof STAGE_OPTIONS)[number]['value']>('draft')
  const [promptAssetMode, setPromptAssetMode] = useState<(typeof ASSET_OPTIONS)[number]['value']>('none')
  const [promptParameter, setPromptParameter] = useState<(typeof PARAMETER_OPTIONS)[number]['value']>('16:9-balanced')
  const [composer, setComposer] = useState<{ open: boolean; x: number; y: number; worldX: number; worldY: number }>({
    open: false,
    x: 420,
    y: 240,
    worldX: 420,
    worldY: 240,
  })
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [nodeAddMenu, setNodeAddMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [, setClipboardNode] = useState<VisualCanvasNode | null>(null)
  const [draggingNodeId, setDraggingNodeId] = useState<string>('')
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const timersRef = useRef<number[]>([])
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

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((current) => current.filter((node) => node.id !== nodeId))
    setEdges((current) => current.filter((edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId))
    setActiveNodeId((current) => (current === nodeId ? '' : current))
    setContextMenu(null)
    setNodeAddMenu(null)
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
        setIsAddMenuOpen(false)
        setComposer((current) => ({ ...current, open: false }))
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
    () => Object.fromEntries(getCanvasProviders(getProviderKind(preferredKind)).map((provider) => [provider.id, provider.displayName])),
    [preferredKind],
  )
  const activeProviderLabel = activeProvider?.displayName ?? getCanvasProviderLabel(getProviderKind(preferredKind), promptModel)
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
    if (!contextMenu && !nodeAddMenu && !isAddMenuOpen && !composer.open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.canvas-context-menu, .canvas-node-add-menu, .canvas-intent-popover, .canvas-add-menu, .canvas-toolbar-shell')) return
      setContextMenu(null)
      setNodeAddMenu(null)
      setIsAddMenuOpen(false)
      setComposer((current) => ({ ...current, open: false }))
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [composer.open, contextMenu, isAddMenuOpen, nodeAddMenu])

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
      : activeNode
    const viewportRect = viewportRef.current?.getBoundingClientRect()
    const centeredPosition = viewportRect
      ? {
        x: (viewportRect.width / 2 - canvasPan.x) / canvasZoom - size.width / 2,
        y: (viewportRect.height / 2 - canvasPan.y) / canvasZoom - size.height / 2,
      }
      : getDefaultPosition(nodes.length)
    const basePosition = options?.position
      ?? (parentNode
        ? { x: parentNode.x + parentNode.width + 220, y: parentNode.y }
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
    setComposer((current) => ({ ...current, open: false }))
    return node
  }, [activeNode, canvasPan.x, canvasPan.y, canvasZoom, nodes, promptStage])

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

  const handleGenerate = useCallback((nodeId: string, outputLabel?: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return

    handleNodePatch(nodeId, { status: 'generating' })
    const timer = window.setTimeout(() => {
      handleNodePatch(nodeId, {
        status: 'done',
        resultPreview: outputLabel ?? `${node.title} 已生成结果占位，可继续细化。`,
        outputLabel: outputLabel ?? `${node.title} 已生成结果占位，可继续细化。`,
      })
      setEdges((current) => current.map((edge) => (
        edge.toNodeId === nodeId || edge.fromNodeId === nodeId
          ? { ...edge, status: 'done' }
          : edge
      )))
    }, 950)
    timersRef.current.push(timer)
  }, [handleNodePatch, nodes])

  const handleUpload = useCallback((nodeId: string) => {
    handleNodePatch(nodeId, {
      status: 'done',
      resultPreview: '已记录上传素材占位，后续可继续作为参考输入。',
      outputLabel: '已记录上传素材占位，后续可继续作为参考输入。',
    })
  }, [handleNodePatch])

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
    syncPromptPreset(node.kind)
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

  const openComposer = useCallback((input?: { kind?: EntryKind; x?: number; y?: number }) => {
    if (input?.kind === 'template') {
      onShowStartup()
      return
    }

    const rect = viewportRef.current?.getBoundingClientRect()
    const fallbackWorldX = rect ? (rect.width / 2 - canvasPan.x) / canvasZoom - 150 : 420
    const fallbackWorldY = rect ? (rect.height / 2 - canvasPan.y) / canvasZoom - 110 : 240
    const worldX = clampCanvasPoint(input?.x ?? fallbackWorldX, -400, 2400)
    const worldY = clampCanvasPoint(input?.y ?? fallbackWorldY, -300, 1600)
    const screenPoint = rect
      ? {
        x: rect.left + worldX * canvasZoom + canvasPan.x,
        y: rect.top + worldY * canvasZoom + canvasPan.y,
      }
      : { x: 420, y: 240 }
    const menuPoint = clampMenuPosition(screenPoint.x, screenPoint.y, INTENT_MENU_WIDTH, INTENT_MENU_HEIGHT)

    if (input?.kind) {
      syncPromptPreset(input.kind)
    }

    setComposer({ open: true, x: menuPoint.x, y: menuPoint.y, worldX, worldY })
    setIsAddMenuOpen(false)
  }, [canvasPan.x, canvasPan.y, canvasZoom, onShowStartup, syncPromptPreset])

  const closeComposer = useCallback(() => {
    setComposer((current) => ({ ...current, open: false }))
  }, [])

  const handleAddNode = useCallback((kind: VisualCanvasNodeKind, presetTitle?: string) => {
    syncPromptPreset(kind)
    createNode(kind, {
      title: presetTitle ?? NODE_META[kind].title,
      model: NODE_META[kind].model,
      ratio: NODE_META[kind].ratio,
      parentNodeId: activeNode?.id,
    })
  }, [activeNode?.id, createNode, syncPromptPreset])

  const handleComposerGenerate = useCallback(() => {
    const kind = preferredKind
    const nextNode = createNode(kind, {
      prompt: canvasPrompt.trim(),
      model: promptModel,
      ratio: getNodeRatio(kind, promptRatio),
      parentNodeId: activeNode?.id,
      position: {
        x: composer.worldX,
        y: composer.worldY,
      },
    })

    closeComposer()

    if (kind === 'upload') {
      handleUpload(nextNode.id)
      return
    }

    handleGenerate(nextNode.id, buildResultLabel(nextNode.title))
  }, [activeNode?.id, buildResultLabel, canvasPrompt, closeComposer, composer.worldX, composer.worldY, createNode, handleGenerate, handleUpload, preferredKind, promptModel, promptRatio])

  const handleWorkspaceGenerate = useCallback(() => {
    const trimmedPrompt = canvasPrompt.trim()

    if (activeNode) {
      handleNodePatch(activeNode.id, {
        prompt: trimmedPrompt,
        model: promptModel,
        providerId: promptModel,
        stage: promptStage,
        ratio: activeNode.ratio ? promptRatio : activeNode.ratio,
      })
      handleGenerate(activeNode.id, buildResultLabel(activeNode.title))
      return
    }

    const nextNode = createNode(preferredKind, {
      prompt: trimmedPrompt,
      model: promptModel,
      parentNodeId: undefined,
      ratio: getNodeRatio(preferredKind, promptRatio),
    })

    if (preferredKind === 'upload') {
      handleUpload(nextNode.id)
      return
    }

    handleGenerate(nextNode.id, buildResultLabel(nextNode.title))
  }, [activeNode, buildResultLabel, canvasPrompt, createNode, handleGenerate, handleNodePatch, handleUpload, preferredKind, promptModel, promptRatio, promptStage])

  const handlePromptChange = useCallback((value: string) => {
    setCanvasPrompt(value)
    if (activeNode) {
      handleNodePatch(activeNode.id, { prompt: value })
    }
  }, [activeNode, handleNodePatch])

  const handleProviderChange = useCallback((value: string) => {
    setPromptModel(value)
    if (activeNode) {
      handleNodePatch(activeNode.id, {
        model: value,
        providerId: value,
      })
    }
  }, [activeNode, handleNodePatch])

  const createNodeFromIntent = useCallback((kind: VisualCanvasNodeKind) => {
    syncPromptPreset(kind)
    createNode(kind, {
      model: getCanvasProvider(getProviderKind(kind), NODE_META[kind].model)?.id ?? NODE_META[kind].model,
      parentNodeId: activeNode?.id,
      position: activeNode ? undefined : { x: composer.worldX, y: composer.worldY },
    })
  }, [activeNode, composer.worldX, composer.worldY, createNode, syncPromptPreset])

  const handleAddSpecificNextNode = useCallback((nodeId: string, kind: VisualCanvasNodeKind) => {
    syncPromptPreset(kind)
    createNode(kind, {
      parentNodeId: nodeId,
      model: NODE_META[kind].model,
      ratio: NODE_META[kind].ratio,
    })
    setNodeAddMenu(null)
  }, [createNode, syncPromptPreset])

  const openNodeAddMenu = useCallback((nodeId: string, clientX: number, clientY: number) => {
    const position = clampMenuPosition(clientX + 10, clientY - 16, NODE_ADD_MENU_WIDTH, NODE_ADD_MENU_HEIGHT)
    setNodeAddMenu({ nodeId, ...position })
    setContextMenu(null)
    setActiveNodeId(nodeId)
  }, [])

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

    return {
      x: (clientX - rect.left - canvasPan.x) / canvasZoom,
      y: (clientY - rect.top - canvasPan.y) / canvasZoom,
    }
  }, [canvasPan.x, canvasPan.y, canvasZoom])

  const canStartCanvasPan = useCallback((target: EventTarget | null) => {
    const element = target as HTMLElement | null
    return !element?.closest('button, input, textarea, [contenteditable="true"], .canvas-node-card, .canvas-prompt-console, .canvas-topbar, .canvas-toolbar-shell, .canvas-add-menu, .canvas-zoom-controls, .canvas-context-menu, .canvas-node-add-menu, .canvas-intent-popover')
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
        createNodeFromIntent(value as VisualCanvasNodeKind)
      },
    },
    {
      id: 'api',
      label: 'API / 模型',
      value: activeProviderStatus ? `${activeProviderLabel} · ${activeProviderStatus}` : activeProviderLabel,
      options: getCanvasProviders(getProviderKind(preferredKind)).map((provider) => ({
        value: provider.id,
        label: provider.displayName,
        hint: `${provider.status} · ${provider.setupHint}`,
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
  ], [activeProviderLabel, activeProviderStatus, assetLabel, createNodeFromIntent, handleProviderChange, onShowStartup, parameterLabel, preferredKind, stageLabel])

  const handleCanvasDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('button, input, textarea')) return
    if (!canStartCanvasPan(event.target)) return
    const point = getViewportWorldPoint(event.clientX, event.clientY)
    openComposer({
      x: point.x - 112,
      y: point.y - 88,
    })
  }, [canStartCanvasPan, getViewportWorldPoint, openComposer])

  return (
    <div className="canvas-root">
      <div className="canvas-background-glow" />
      <div className="canvas-grid" />

      <div className="canvas-topbar create-glass-panel">
        <div>
          <div className="canvas-topbar-label">AI Canvas</div>
          <div className="canvas-topbar-title">{projectTitle}</div>
          <div className="canvas-topbar-copy">
            {templateName ? `模板 · ${templateName}` : '自由创作画布'} · 不预设固定流程，按你的思路推进
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onShowStartup} className="canvas-secondary-button">
            模板
          </button>
          <button type="button" onClick={onOpenTimeline} className="canvas-secondary-button">
            Timeline
          </button>
          <button type="button" onClick={onOpenAssets} className="canvas-secondary-button">
            Assets
          </button>
          <button type="button" onClick={onOpenDelivery} className="canvas-secondary-button">
            Delivery
          </button>
        </div>
      </div>

      <CanvasToolDock
        onAddNode={handleAddNode}
        activeTool={activeTool}
        onToolSelect={setActiveTool}
        isAddMenuOpen={isAddMenuOpen}
        onToggleAddMenu={() => setIsAddMenuOpen((current) => !current)}
      />

      <div
        ref={viewportRef}
        className={`canvas-viewport ${isPanning ? 'is-panning' : ''} ${isSpacePressed ? 'is-space-panning' : ''}`}
        onWheel={handleCanvasWheel}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
      >
        <div
          ref={surfaceRef}
          className="canvas-flow-surface"
          onDoubleClick={handleCanvasDoubleClick}
          style={{
            transform: `translate3d(${canvasPan.x}px, ${canvasPan.y}px, 0) scale(${canvasZoom})`,
          }}
        >
          {nodes.length === 0 && !composer.open ? (
            <div className="canvas-empty-state">
              <div className="canvas-empty-title">双击画布开始创作</div>
            </div>
          ) : null}

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
                    x1={fromNode.x + fromNode.width}
                    y1={fromNode.y + fromNode.height / 2}
                    x2={toNode.x}
                    y2={toNode.y + toNode.height / 2}
                    active={edge.status === 'active' || activeNodeId === fromNode.id || activeNodeId === toNode.id}
                  />
                )
              })}
            </>
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
                  setActiveNodeId(node.id)
                  syncPromptPreset(node.kind)
                }}
                onPromptChange={(value) => handleNodePatch(node.id, { prompt: value })}
                onModelChange={(value) => handleNodePatch(node.id, { model: value })}
                onRatioChange={node.ratio ? (value) => handleNodePatch(node.id, { ratio: value }) : undefined}
                onGenerate={() => handleGenerate(node.id)}
                onUpload={() => handleUpload(node.id)}
                onAddNext={(clientX, clientY) => openNodeAddMenu(node.id, clientX, clientY)}
                onDragStart={(event) => handleNodeDragStart(node.id, event)}
                onOpenContextMenu={(event) => openNodeContextMenu(node.id, event.clientX, event.clientY)}
                onEdit={() => focusPromptForNode(node)}
              />
            </div>
          ))}
        </div>
      </div>

      {composer.open ? (
        <div
          className="canvas-intent-popover"
          style={{ left: composer.x, top: composer.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.16 }}
            className="canvas-composer-card canvas-composer-intent"
          >
            <div className="canvas-composer-head">
              <div className="canvas-composer-title">选择起点</div>
              <button type="button" onClick={closeComposer} className="canvas-composer-close" aria-label="关闭">
                ×
              </button>
            </div>
            <div className="canvas-composer-options">
              {ENTRY_ACTIONS.map((action) => {
                const active = action.kind !== 'template' && preferredKind === action.kind
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => {
                          if (action.kind === 'template') {
                            onShowStartup()
                            return
                          }
                          createNodeFromIntent(action.kind)
                        }}
                    className={`canvas-choice-button ${active ? 'is-active' : ''}`}
                  >
                    <span>{action.label}</span>
                    <span className="canvas-choice-hint">{action.hint}</span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        </div>
      ) : null}

      {nodeAddMenu && connectorNode ? (
        <div
          className="canvas-node-add-menu"
          style={{ left: nodeAddMenu.x, top: nodeAddMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="canvas-menu-label">Add Next</div>
          {(['text', 'image', 'video', 'audio', 'upload'] as VisualCanvasNodeKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => handleAddSpecificNextNode(connectorNode.id, kind)}
              className="canvas-menu-item"
            >
              <span>{getEntryKindLabel(kind)}</span>
              <span className="canvas-menu-shortcut">+</span>
            </button>
          ))}
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
        <button type="button" onClick={() => setZoomAroundPoint(canvasZoom - CANVAS_ZOOM_STEP)} className="canvas-zoom-button">
          -
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
        <button type="button" onClick={() => setZoomAroundPoint(canvasZoom + CANVAS_ZOOM_STEP)} className="canvas-zoom-button">
          +
        </button>
        <button type="button" onClick={fitCanvasView} className="canvas-zoom-reset">
          Fit
        </button>
        <button type="button" onClick={resetCanvasView} className="canvas-zoom-reset">
          {Math.round(canvasZoom * 100)}%
        </button>
      </div>

      <div className="canvas-prompt-console create-floating-console">
        <CanvasPromptBox
          layout="workspace"
          multiline={false}
          prompt={canvasPrompt}
          onPromptChange={handlePromptChange}
          model={promptModel}
          modelLabel={activeProviderLabel}
          modelOptionLabels={providerOptionLabels}
          providerStatus={activeProviderStatus}
          providerNotice={activeProviderNotice}
          resultSummary={activeNode?.status === 'done' ? activeNode.resultPreview ?? activeNode.outputLabel : undefined}
          models={workspaceModels}
          onModelChange={handleProviderChange}
          ratio={promptRatio}
          ratios={WORKSPACE_RATIOS}
          onRatioChange={setPromptRatio}
          placeholder="描述你想创作的内容……"
          onGenerate={composer.open ? handleComposerGenerate : handleWorkspaceGenerate}
          generateLabel={activeNode?.status === 'generating' ? '生成中…' : preferredKind === 'upload' ? '添加' : '生成'}
          footerItems={promptFooterItems}
          inputRef={(element) => {
            promptInputRef.current = element
          }}
        />
      </div>
    </div>
  )
}
