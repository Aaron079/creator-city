'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import type { Connection, NodeMouseHandler, NodeTypes, ReactFlowInstance } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CanvasV2Node } from './CanvasV2Node'
import { CanvasV2Toolbar } from './CanvasV2Toolbar'
import { CanvasV2Inspector } from './CanvasV2Inspector'
import {
  normalizeCanvasV2Node,
  flowNodesToCanvasNodes,
  flowEdgesToCanvasEdges,
  canvasNodesToFlowNodes,
  canvasApiEdgesToFlowEdges,
  type CanvasV2NodeKind,
  type CanvasV2NodeData,
  type FlowNode,
  type FlowEdge,
} from '@/lib/canvas-v2/canvasV2Adapter'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NODE_TYPES: NodeTypes = { canvasV2Node: CanvasV2Node as any }

const PROVIDER_BY_KIND: Partial<Record<CanvasV2NodeKind, string>> = {
  image: 'volcengine-seedream-image',
  video: 'volcengine-seedance-video',
  generation: 'volcengine-seedream-image',
}

type LoadState = 'init' | 'loading' | 'loaded' | 'error' | 'no-project'

type CanvasApiResponse = {
  workflow?: { id: string; [key: string]: unknown }
  nodes?: unknown[]
  edges?: unknown[]
  workflowId?: string
  project?: unknown
}

type Props = {
  projectId?: string
  workflowId?: string
  initialNodes?: FlowNode[]
  initialEdges?: FlowEdge[]
  loadError?: string | null
}

// Inner component that uses useReactFlow (must be inside ReactFlowProvider)
function CanvasV2WorkspaceInner({
  projectId,
  workflowId,
  initialNodes = [],
  initialEdges = [],
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialEdges)
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [saveError, setSaveError] = useState('')
  const [loadState, setLoadState] = useState<LoadState>('init')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [resolvedWorkflowId, setResolvedWorkflowId] = useState<string | null>(workflowId ?? null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rfInstanceRef = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null)
  const { fitView } = useReactFlow()

  // Load canvas on mount
  useEffect(() => {
    if (!projectId) {
      setLoadState('no-project')
      return
    }
    setLoadState('loading')
    fetch(`/api/projects/${encodeURIComponent(projectId)}/canvas`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (resp) => {
        if (!resp.ok) {
          setLoadState('error')
          setLoadError('canvas_v2_load_failed')
          return
        }
        const data = await resp.json() as CanvasApiResponse

        // API returns: { workflow: { id }, nodes: [...], edges: [...] }
        const rawNodes = (data.nodes ?? []) as Parameters<typeof canvasNodesToFlowNodes>[0]
        const rawEdges = (data.edges ?? []) as Parameters<typeof canvasApiEdgesToFlowEdges>[0]
        const wfId = data.workflow?.id ?? data.workflowId ?? workflowId ?? null
        setResolvedWorkflowId(wfId)

        const flowNodes = canvasNodesToFlowNodes(rawNodes)
        const flowEdges = canvasApiEdgesToFlowEdges(rawEdges)
        setNodes(flowNodes)
        setEdges(flowEdges)
        setLoadState('loaded')

        // Fit view after nodes are set
        setTimeout(() => { try { fitView({ padding: 0.2 }) } catch { /* ignore */ } }, 100)
      })
      .catch(() => {
        setLoadState('error')
        setLoadError('canvas_v2_load_failed')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const saveCanvas = useCallback(async (currentNodes: FlowNode[], currentEdges: FlowEdge[]) => {
    const wfId = resolvedWorkflowId
    if (!projectId || !wfId) return
    setSaveStatus('saving')
    setSaveError('')
    try {
      const canvasNodes = flowNodesToCanvasNodes(currentNodes, wfId, projectId)
      const canvasEdges = flowEdgesToCanvasEdges(currentEdges)
      const resp = await fetch(`/api/projects/${encodeURIComponent(projectId)}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          workflowId: wfId,
          nodes: canvasNodes.map((n) => ({
            id: n.nodeId,
            kind: n.kind,
            title: n.title,
            prompt: n.prompt,
            status: n.status,
            x: n.x,
            y: n.y,
            width: n.width,
            height: n.height,
            resultImageUrl: n.resultImageUrl,
            resultVideoUrl: n.resultVideoUrl,
            errorMessage: n.errorMessage,
            metadataJson: n.metadataJson,
            paramsJson: n.paramsJson,
          })),
          edges: canvasEdges.map((e) => ({
            id: e.edgeId,
            fromNodeId: e.sourceNodeId,
            toNodeId: e.targetNodeId,
            type: e.type,
          })),
        }),
      })
      if (resp.ok) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 3000)
      } else {
        setSaveStatus('failed')
        setSaveError('保存失败，本地画布不受影响')
        setTimeout(() => setSaveStatus((s) => s === 'failed' ? 'idle' : s), 5000)
      }
    } catch {
      setSaveStatus('failed')
      setSaveError('保存失败，本地画布不受影响')
      setTimeout(() => setSaveStatus((s) => s === 'failed' ? 'idle' : s), 5000)
    }
  }, [projectId, resolvedWorkflowId])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setNodes((ns) => { setEdges((es) => { void saveCanvas(ns, es); return es }); return ns })
    }, 1000)
  }, [saveCanvas, setNodes, setEdges])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Delete/Backspace: remove selected nodes & edges (not in input)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput) {
        setNodes((ns) => {
          const removed = ns.filter((n) => n.selected).map((n) => n.id)
          if (removed.length > 0) {
            setSelectedNode((prev) => (prev && removed.includes(prev.id) ? null : prev))
            setEdges((es) => es.filter((ed) => !removed.includes(ed.source) && !removed.includes(ed.target) && !ed.selected))
          } else {
            setEdges((es) => es.filter((ed) => !ed.selected))
          }
          return ns.filter((n) => !n.selected)
        })
        scheduleSave()
      }

      // Cmd/Ctrl+S: manual save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        setNodes((ns) => { setEdges((es) => { void saveCanvas(ns, es); return es }); return ns })
      }

      // Cmd/Ctrl+D: duplicate selected node
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && !inInput) {
        e.preventDefault()
        setNodes((ns) => {
          const selected = ns.filter((n) => n.selected)
          if (selected.length === 0) return ns
          const copies: FlowNode[] = selected.map((n) => {
            const newId = `${n.data.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            return {
              ...n,
              id: newId,
              position: { x: n.position.x + 40, y: n.position.y + 40 },
              selected: false,
              data: { ...n.data, nodeId: newId },
            }
          })
          scheduleSave()
          return [...ns.map((n) => ({ ...n, selected: false })), ...copies]
        })
      }

      // Esc: deselect / close inspector
      if (e.key === 'Escape') {
        setSelectedNode(null)
        setNodes((ns) => ns.map((n) => ({ ...n, selected: false })))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [saveCanvas, scheduleSave, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => {
        const result = addEdge({ ...connection, type: 'smoothstep', animated: true, style: { stroke: '#7c3aed', strokeWidth: 2 } }, eds)
        scheduleSave()
        return result
      }),
    [setEdges, scheduleSave],
  )

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode(node as FlowNode)
  }, [])

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode(node as FlowNode)
  }, [])

  const onPaneClick = useCallback(() => setSelectedNode(null), [])

  function addNode(kind: CanvasV2NodeKind) {
    const rfInstance = rfInstanceRef.current
    const viewport = rfInstance?.getViewport() ?? { x: 0, y: 0, zoom: 1 }
    const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom
    const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom
    const jitter = () => (Math.random() - 0.5) * 120

    const id = `${kind}-${Date.now()}`
    const kindTitles: Record<CanvasV2NodeKind, string> = {
      text: '文本节点', image: '图像节点', video: '视频节点', asset: '素材节点', generation: '生成节点',
    }
    const newNode: FlowNode = {
      id,
      type: 'canvasV2Node',
      position: { x: centerX + jitter(), y: centerY + jitter() },
      data: normalizeCanvasV2Node({
        nodeId: id,
        kind,
        title: kindTitles[kind],
        providerId: PROVIDER_BY_KIND[kind],
        providerRegion: (kind === 'image' || kind === 'video' || kind === 'generation') ? 'cn' : undefined,
        executionRegion: (kind === 'image' || kind === 'video' || kind === 'generation') ? 'cn' : undefined,
        storageRegion: (kind === 'image' || kind === 'video' || kind === 'generation') ? 'cn' : undefined,
        projectId,
        workflowId: resolvedWorkflowId ?? workflowId,
      }),
    }
    setNodes((ns) => [...ns, newNode])
    setSelectedNode(newNode)
    scheduleSave()
  }

  function updateNode(nodeId: string, updates: Partial<CanvasV2NodeData>) {
    setNodes((ns) => ns.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n))
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...updates } } : prev)
    scheduleSave()
  }

  function deleteNode(nodeId: string) {
    setNodes((ns) => ns.filter((n) => n.id !== nodeId))
    setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode((prev) => (prev?.id === nodeId ? null : prev))
    scheduleSave()
  }

  async function handleGenerate(nodeId: string, kind: CanvasV2NodeKind, prompt: string, providerId?: string) {
    updateNode(nodeId, { status: 'running', prompt, errorMessage: undefined })
    const node = nodes.find((n) => n.id === nodeId)
    const pid = node?.data.projectId ?? projectId ?? ''
    const wid = node?.data.workflowId ?? resolvedWorkflowId ?? workflowId ?? ''
    try {
      if (kind === 'video') {
        const resp = await fetch('/api/generate/video', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ prompt, providerId: providerId ?? 'volcengine-seedance-video', projectId: pid || undefined, nodeId, workflowId: wid || undefined }),
        })
        const data = await resp.json() as { success?: boolean; resultVideoUrl?: string; stableUrl?: string; assetId?: string; errorCode?: string; message?: string }
        if (data.success && (data.resultVideoUrl ?? data.stableUrl)) {
          updateNode(nodeId, { status: 'succeeded', resultVideoUrl: data.resultVideoUrl ?? data.stableUrl, assetId: data.assetId })
        } else {
          updateNode(nodeId, { status: 'failed', errorMessage: data.message ?? data.errorCode ?? '视频生成失败', errorCode: data.errorCode })
        }
      } else {
        const resp = await fetch('/api/generate/image', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ prompt, providerId: providerId ?? 'volcengine-seedream-image', projectId: pid || undefined, nodeId, workflowId: wid || undefined }),
        })
        const data = await resp.json() as {
          success?: boolean; resultImageUrl?: string; stableUrl?: string; assetId?: string
          model?: string; errorCode?: string; message?: string
          providerRegion?: string; executionRegion?: string; storageRegion?: string
          executorKind?: string; generationJobId?: string
        }
        if (data.success && (data.resultImageUrl ?? data.stableUrl)) {
          updateNode(nodeId, {
            status: 'succeeded',
            resultImageUrl: data.resultImageUrl ?? data.stableUrl,
            thumbnailUrl: data.resultImageUrl ?? data.stableUrl,
            assetId: data.assetId,
            providerId: data.model ?? providerId,
            providerRegion: (data.providerRegion as 'cn' | 'global') ?? 'cn',
            executionRegion: (data.executionRegion as 'cn' | 'global') ?? 'cn',
            storageRegion: (data.storageRegion as 'cn' | 'global') ?? 'cn',
            executorKind: data.executorKind,
            generationJobId: data.generationJobId,
          })
        } else {
          updateNode(nodeId, { status: 'failed', errorMessage: data.message ?? data.errorCode ?? '生成失败', errorCode: data.errorCode })
        }
      }
    } catch (err) {
      updateNode(nodeId, { status: 'failed', errorMessage: err instanceof Error ? err.message : '生成请求失败' })
    }
  }

  const statusColor = { idle: '#6b7280', saving: '#f59e0b', saved: '#10b981', failed: '#ef4444' }[saveStatus]
  const statusLabel = { idle: 'Canvas V2', saving: '保存中…', saved: '已保存', failed: '保存失败' }[saveStatus]

  // Loading / error overlays
  if (loadState === 'loading') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#080814', gap: 16 }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(124,58,237,.2)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500 }}>正在加载画布…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#080814', gap: 16 }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <span style={{ color: '#fca5a5', fontSize: 15, fontWeight: 600 }}>画布加载失败</span>
        <span style={{ color: '#6b7280', fontSize: 13 }}>{loadError ?? 'canvas_v2_load_failed'}</span>
        <button
          onClick={() => { setLoadState('loading'); setLoadError(null); window.location.reload() }}
          style={{ marginTop: 8, padding: '9px 24px', background: 'rgba(124,58,237,.18)', border: '1px solid rgba(124,58,237,.4)', borderRadius: 8, color: '#c4b5fd', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#080814' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => { onNodesChange(changes); scheduleSave() }}
        onEdgesChange={(changes) => { onEdgesChange(changes); scheduleSave() }}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onInit={(instance) => { rfInstanceRef.current = instance as ReactFlowInstance<FlowNode, FlowEdge> }}
        nodeTypes={NODE_TYPES}
        fitView
        style={{ background: 'transparent' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(124,58,237,0.15)" />
        <Controls style={{ background: 'rgba(10,10,20,0.9)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10 }} />
        <MiniMap style={{ background: 'rgba(10,10,20,0.9)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10 }} nodeColor={() => '#7c3aed'} maskColor="rgba(0,0,0,0.5)" />
      </ReactFlow>

      <CanvasV2Toolbar onAddNode={addNode} />

      {selectedNode && (
        <CanvasV2Inspector
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onSave={updateNode}
          onGenerate={handleGenerate}
          onDeleteNode={deleteNode}
        />
      )}

      {/* Status bar */}
      <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(10,10,20,0.9)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 20, padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(12px)', fontSize: 12, pointerEvents: 'none' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{statusLabel}</span>
        {saveError && <span style={{ color: '#fca5a5', fontSize: 11 }}>— {saveError}</span>}
        {!projectId && <span style={{ color: '#4b5563', fontSize: 11 }}>· 临时画布</span>}
        {loadState === 'no-project' && <span style={{ color: '#4b5563', fontSize: 11 }}>· 未关联项目</span>}
      </div>

      {/* Keyboard hints */}
      <div style={{ position: 'absolute', bottom: 14, right: 16, zIndex: 10, display: 'flex', gap: 6, pointerEvents: 'none' }}>
        {[
          { key: '⌘S', label: '保存' },
          { key: '⌘D', label: '复制' },
          { key: 'Del', label: '删除' },
          { key: 'Esc', label: '取消选择' },
        ].map(({ key, label }) => (
          <span key={key} style={{ fontSize: 10, color: '#374151', background: 'rgba(10,10,20,0.8)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 4, padding: '2px 6px' }}>
            <kbd style={{ fontFamily: 'system-ui' }}>{key}</kbd> {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// Outer component that wraps with ReactFlowProvider
export function CanvasV2Workspace(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasV2WorkspaceInner {...props} />
    </ReactFlowProvider>
  )
}
