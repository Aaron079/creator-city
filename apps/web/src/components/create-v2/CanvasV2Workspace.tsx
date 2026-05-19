'use client'

import { useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import type { Connection, NodeMouseHandler, NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CanvasV2Node } from './CanvasV2Node'
import { CanvasV2Toolbar } from './CanvasV2Toolbar'
import { CanvasV2Inspector } from './CanvasV2Inspector'
import {
  normalizeCanvasV2Node,
  flowNodesToCanvasNodes,
  flowEdgesToCanvasEdges,
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

type Props = {
  projectId?: string
  workflowId?: string
  initialNodes?: FlowNode[]
  initialEdges?: FlowEdge[]
}

export function CanvasV2Workspace({ projectId, workflowId, initialNodes = [], initialEdges = [] }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialEdges)
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [saveError, setSaveError] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep', animated: true, style: { stroke: '#7c3aed', strokeWidth: 2 } }, eds)),
    [setEdges],
  )

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode(node as FlowNode)
  }, [])

  const onPaneClick = useCallback(() => setSelectedNode(null), [])

  const saveCanvas = useCallback(async (ns: FlowNode[], es: FlowEdge[]) => {
    if (!projectId || !workflowId) return
    setSaveStatus('saving')
    setSaveError('')
    try {
      const canvasNodes = flowNodesToCanvasNodes(ns, workflowId, projectId)
      const canvasEdges = flowEdgesToCanvasEdges(es)
      const resp = await fetch(`/api/projects/${encodeURIComponent(projectId)}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workflowId,
          nodes: canvasNodes.map((n) => ({ id: n.nodeId, kind: n.kind, title: n.title, prompt: n.prompt, status: n.status, x: n.x, y: n.y, width: n.width, height: n.height, resultImageUrl: n.resultImageUrl, resultVideoUrl: n.resultVideoUrl, errorMessage: n.errorMessage, metadataJson: n.metadataJson, paramsJson: n.paramsJson })),
          edges: canvasEdges.map((e) => ({ id: e.edgeId, fromNodeId: e.sourceNodeId, toNodeId: e.targetNodeId, type: e.type })),
        }),
      })
      if (resp.ok) { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000) }
      else { setSaveStatus('failed'); setSaveError('保存失败，本地画布不受影响'); setTimeout(() => setSaveStatus('idle'), 4000) }
    } catch { setSaveStatus('failed'); setSaveError('保存失败，本地画布不受影响'); setTimeout(() => setSaveStatus('idle'), 4000) }
  }, [projectId, workflowId])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setNodes((ns) => { setEdges((es) => { void saveCanvas(ns, es); return es }); return ns })
    }, 1500)
  }, [saveCanvas, setNodes, setEdges])

  function addNode(kind: CanvasV2NodeKind) {
    const id = `${kind}-${Date.now()}`
    const kindTitles: Record<CanvasV2NodeKind, string> = {
      text: '文本节点', image: '图像节点', video: '视频节点', asset: '素材节点', generation: '生成节点',
    }
    const newNode: FlowNode = {
      id,
      type: 'canvasV2Node',
      position: { x: 180 + Math.random() * 200, y: 120 + Math.random() * 200 },
      data: normalizeCanvasV2Node({
        nodeId: id,
        kind,
        title: kindTitles[kind],
        providerId: PROVIDER_BY_KIND[kind],
        providerRegion: (kind === 'image' || kind === 'video' || kind === 'generation') ? 'cn' : undefined,
        executionRegion: (kind === 'image' || kind === 'video' || kind === 'generation') ? 'cn' : undefined,
        storageRegion: (kind === 'image' || kind === 'video' || kind === 'generation') ? 'cn' : undefined,
        projectId,
        workflowId,
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

  async function handleGenerate(nodeId: string, kind: CanvasV2NodeKind, prompt: string, providerId?: string) {
    updateNode(nodeId, { status: 'running', prompt, errorMessage: undefined })
    const node = nodes.find((n) => n.id === nodeId)
    const pid = node?.data.projectId ?? projectId ?? ''
    const wid = node?.data.workflowId ?? workflowId ?? ''
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
          updateNode(nodeId, { status: 'failed', errorMessage: data.message ?? data.errorCode ?? '视频生成失败' })
        }
      } else {
        const resp = await fetch('/api/generate/image', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ prompt, providerId: providerId ?? 'volcengine-seedream-image', projectId: pid || undefined, nodeId, workflowId: wid || undefined }),
        })
        const data = await resp.json() as { success?: boolean; resultImageUrl?: string; stableUrl?: string; assetId?: string; model?: string; errorCode?: string; message?: string; providerRegion?: string; executionRegion?: string; storageRegion?: string }
        if (data.success && (data.resultImageUrl ?? data.stableUrl)) {
          updateNode(nodeId, { status: 'succeeded', resultImageUrl: data.resultImageUrl ?? data.stableUrl, thumbnailUrl: data.resultImageUrl ?? data.stableUrl, assetId: data.assetId, providerId: data.model ?? providerId, providerRegion: (data.providerRegion as 'cn' | 'global') ?? 'cn', executionRegion: (data.executionRegion as 'cn' | 'global') ?? 'cn', storageRegion: (data.storageRegion as 'cn' | 'global') ?? 'cn' })
        } else {
          updateNode(nodeId, { status: 'failed', errorMessage: data.message ?? data.errorCode ?? '生成失败' })
        }
      }
    } catch (err) {
      updateNode(nodeId, { status: 'failed', errorMessage: err instanceof Error ? err.message : '生成请求失败' })
    }
  }

  const statusColor = { idle: '#6b7280', saving: '#f59e0b', saved: '#10b981', failed: '#ef4444' }[saveStatus]
  const statusLabel = { idle: 'Canvas V2', saving: '保存中…', saved: '已保存', failed: '保存失败' }[saveStatus]

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#080814' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => { onNodesChange(changes); scheduleSave() }}
        onEdgesChange={(changes) => { onEdgesChange(changes); scheduleSave() }}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
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
        />
      )}

      <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(10,10,20,0.9)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 20, padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(12px)', fontSize: 12, pointerEvents: 'none' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{statusLabel}</span>
        {saveError && <span style={{ color: '#fca5a5', fontSize: 11 }}>— {saveError}</span>}
        {!projectId && <span style={{ color: '#4b5563', fontSize: 11 }}>· 临时画布</span>}
      </div>
    </div>
  )
}
