'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CanvasFlowEdge } from '@/components/create/CanvasFlowEdge'
import { CanvasNodeCard, type VisualCanvasNode, type VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { CanvasToolDock } from '@/components/create/CanvasToolDock'

interface VisualCanvasWorkspaceProps {
  projectTitle: string
  templateName?: string | null
  onOpenTimeline: () => void
  onOpenAssets: () => void
  onOpenDelivery: () => void
  onShowStartup: () => void
}

const DEFAULT_NODES: VisualCanvasNode[] = [
  {
    id: 'brief-node',
    kind: 'text',
    title: 'Brief',
    subtitle: '从项目 brief、脚本或品牌文案开始，把创作意图固定下来。',
    prompt: '',
    model: 'claude',
    status: 'ready',
  },
  {
    id: 'image-node',
    kind: 'image',
    title: 'Image',
    subtitle: '把文本意图转成视觉基调、参考帧和风格方向。',
    prompt: '',
    model: 'nano-banana',
    ratio: '16:9',
    status: 'idle',
  },
  {
    id: 'video-node',
    kind: 'video',
    title: 'Video',
    subtitle: '把镜头语言推进到视频生成阶段，建立节奏和运动。',
    prompt: '',
    model: 'runway',
    ratio: '16:9',
    status: 'idle',
  },
  {
    id: 'audio-node',
    kind: 'audio',
    title: 'Audio',
    subtitle: '用旁白、音乐和音效把观感收完整，形成节奏闭环。',
    prompt: '',
    model: 'soundscape',
    status: 'idle',
  },
  {
    id: 'delivery-node',
    kind: 'delivery',
    title: 'Delivery',
    subtitle: '整理本次版本、交付资产与客户确认说明。',
    prompt: '',
    model: 'manifest',
    status: 'idle',
  },
]

const ADD_NODE_META: Record<VisualCanvasNodeKind, Pick<VisualCanvasNode, 'title' | 'subtitle' | 'model' | 'ratio'>> = {
  text: { title: 'Text Node', subtitle: '记录 brief、脚本或说明文字。', model: 'claude' },
  image: { title: 'Image Node', subtitle: '追加新的图像生成或图像参考支路。', model: 'nano-banana', ratio: '16:9' },
  video: { title: 'Video Node', subtitle: '加入新的镜头生成或视频迭代阶段。', model: 'runway', ratio: '16:9' },
  audio: { title: 'Audio Node', subtitle: '补充声音、旁白或音乐制作节点。', model: 'soundscape' },
  delivery: { title: 'Delivery Node', subtitle: '追加交付汇总、版本整理或确认节点。', model: 'manifest' },
  world: { title: '3D World Node', subtitle: '搭建世界观、空间层次和场景结构。', model: 'spatial-world' },
  upload: { title: 'Upload Node', subtitle: '导入图片、视频、音频或参考资产。', model: 'asset-drop' },
}

function createNodeId(kind: VisualCanvasNodeKind) {
  return `${kind}-${Math.random().toString(36).slice(2, 8)}`
}

export function VisualCanvasWorkspace({
  projectTitle,
  templateName,
  onOpenTimeline,
  onOpenAssets,
  onOpenDelivery,
  onShowStartup,
}: VisualCanvasWorkspaceProps) {
  const [nodes, setNodes] = useState<VisualCanvasNode[]>(DEFAULT_NODES)
  const [activeNodeId, setActiveNodeId] = useState<string>(DEFAULT_NODES[0]?.id ?? '')
  const [activeTool, setActiveTool] = useState<string>('add')
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  const activeNode = useMemo(
    () => nodes.find((node) => node.id === activeNodeId) ?? nodes[0] ?? null,
    [activeNodeId, nodes]
  )

  const positionedNodes = useMemo(
    () =>
      nodes.map((node, index) => ({
        ...node,
        x: 220 + index * 330,
        y: index % 2 === 0 ? 180 : 280,
      })),
    [nodes]
  )

  const handleNodePatch = useCallback((nodeId: string, patch: Partial<VisualCanvasNode>) => {
    setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)))
  }, [])

  const handleGenerate = useCallback((nodeId: string) => {
    handleNodePatch(nodeId, { status: 'generating' })
    const timer = window.setTimeout(() => {
      handleNodePatch(nodeId, {
        status: 'done',
        outputLabel: '结果占位卡已生成。你可以继续进入下一个阶段，或返回这个节点继续修改。',
      })
    }, 1000)
    timersRef.current.push(timer)
  }, [handleNodePatch])

  const handleUpload = useCallback((nodeId: string) => {
    handleNodePatch(nodeId, {
      status: 'done',
      outputLabel: '已记录上传意图与结果占位。后续真实接入时可替换成文件面板。',
    })
  }, [handleNodePatch])

  const handleAddNode = useCallback((kind: VisualCanvasNodeKind) => {
    const meta = ADD_NODE_META[kind]
    const node: VisualCanvasNode = {
      id: createNodeId(kind),
      kind,
      title: meta.title,
      subtitle: meta.subtitle,
      prompt: '',
      model: meta.model,
      ratio: meta.ratio,
      status: 'ready',
    }
    setNodes((current) => [...current, node])
    setActiveNodeId(node.id)
  }, [])

  return (
    <div className="relative h-full min-h-[780px] overflow-hidden rounded-[32px] border border-white/8 bg-[#050505]">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 20%, rgba(138,43,226,0.12), transparent 32%), radial-gradient(circle at 80% 80%, rgba(0,255,255,0.06), transparent 36%), #050505',
        }}
      />
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 0.9px, transparent 0.9px)', backgroundSize: '24px 24px' }} />

      <div className="absolute inset-x-5 top-5 z-20 flex items-center justify-between rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-3 backdrop-blur-3xl">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/34">AI Canvas Workspace</div>
          <div className="mt-1 text-xl font-light tracking-[-0.03em] text-white">{projectTitle}</div>
          <div className="mt-1 text-[12px] text-white/48">
            {templateName ? `Template · ${templateName}` : '从当前模板继续推进'} · 节点式生成工作流
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onShowStartup} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/72 backdrop-blur-2xl transition hover:border-white/18 hover:text-white">
            查看启动区
          </button>
          <button type="button" onClick={onOpenTimeline} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/72 backdrop-blur-2xl transition hover:border-white/18 hover:text-white">
            Timeline
          </button>
          <button type="button" onClick={onOpenAssets} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/72 backdrop-blur-2xl transition hover:border-white/18 hover:text-white">
            Assets
          </button>
          <button type="button" onClick={onOpenDelivery} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/72 backdrop-blur-2xl transition hover:border-white/18 hover:text-white">
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

      <div className="absolute inset-x-0 bottom-0 top-24 overflow-auto px-24 py-10">
        {positionedNodes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-[32px] border border-white/10 bg-white/[0.03] px-8 py-8 text-center backdrop-blur-3xl">
              <div className="text-xl font-light tracking-[-0.03em] text-white">双击画布自由生成，或查看模板</div>
              <div className="mt-3 text-sm leading-[1.7] text-white/52">
                你也可以直接从左侧工具栏添加节点，快速开始文本生视频、图片换背景、首帧生成视频、音频生视频或模板化工作流。
              </div>
            </div>
          </div>
        ) : (
          <div className="relative min-h-[720px] min-w-[1800px]">
            {positionedNodes.map((node, index) => {
              const next = positionedNodes[index + 1]
              if (!next) return null
              return (
                <CanvasFlowEdge
                  key={`${node.id}-${next.id}`}
                  x1={node.x + 290}
                  y1={node.y + 165}
                  x2={next.x}
                  y2={next.y + 165}
                  active={activeNodeId === node.id || activeNodeId === next.id}
                />
              )
            })}

            {positionedNodes.map((node) => (
              <div
                key={node.id}
                className="absolute"
                style={{ left: node.x, top: node.y }}
              >
                <CanvasNodeCard
                  node={node}
                  active={node.id === activeNode?.id}
                  onSelect={() => setActiveNodeId(node.id)}
                  onPromptChange={(value) => handleNodePatch(node.id, { prompt: value })}
                  onModelChange={(value) => handleNodePatch(node.id, { model: value })}
                  onRatioChange={node.ratio ? (value) => handleNodePatch(node.id, { ratio: value }) : undefined}
                  onGenerate={() => handleGenerate(node.id)}
                  onUpload={() => handleUpload(node.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-3xl"
      >
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/34">Quick Open</span>
        {[
          { label: '文本生视频', action: onOpenTimeline },
          { label: '图片换背景', action: () => setActiveNodeId('image-node') },
          { label: '首帧生成视频', action: () => setActiveNodeId('video-node') },
          { label: '音频生视频', action: () => setActiveNodeId('audio-node') },
          { label: '模板', action: onShowStartup },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/74 transition hover:border-white/18 hover:text-white"
          >
            {item.label}
          </button>
        ))}
      </motion.div>
    </div>
  )
}
