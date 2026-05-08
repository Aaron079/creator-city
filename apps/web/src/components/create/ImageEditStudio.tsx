'use client'

import { useMemo, useState } from 'react'
import type { VisualCanvasNode as CanvasNode } from '@/components/create/CanvasNodeCard'
import { ImageEditCanvas, type ImageEditTool } from './ImageEditCanvas'
import { ImageEditLayersPanel } from './ImageEditLayersPanel'
import {
  createImageEditLayer,
  defaultImageEditInstruction,
  formatImageEditLayersForPrompt,
  imageEditLayerIcon,
  imageEditLayersToSceneEdits,
  updateImageEditLayer,
  type ImageEditLayer,
  type ImageEditLayerMark,
  type ImageEditLayerType,
  type SceneEditMark,
} from '@/lib/scenes'

interface ImageEditStudioProps {
  node: CanvasNode
  imageUrl: string
  imageEditLayers: ImageEditLayer[]
  sceneEdits: SceneEditMark[]
  onSaveLayers: (layers: ImageEditLayer[], sceneEdits: SceneEditMark[], prompt: string) => void
  onSendPromptToImageNode?: (nodeId: string, prompt: string) => void
  onClose?: () => void
}

const TOOL_OPTIONS: Array<{ tool: ImageEditTool; label: string; icon: string; description: string }> = [
  { tool: 'select', label: '选择', icon: '↖', description: '选择或移动已有标记。' },
  { tool: 'color', label: '调色', icon: '🎨', description: '调整亮度、对比、饱和和暖色。' },
  { tool: 'weather', label: '天气', icon: '☔', description: '叠加雨、雪或雨雾。' },
  { tool: 'light', label: '光线', icon: '💡', description: '点击图片添加光源点。' },
  { tool: 'fog', label: '雾气', icon: '🌫', description: '叠加电影感雾气层。' },
  { tool: 'mask', label: '遮罩', icon: '🖌', description: '点击或框选局部重绘区域。' },
  { tool: 'person', label: '人物', icon: '👤', description: '点击添加人物标记。' },
  { tool: 'architecture', label: '建筑', icon: '🏙', description: '点击添加建筑/空间标记。' },
  { tool: 'prop', label: '道具', icon: '🧩', description: '点击添加道具/物件标记。' },
  { tool: 'camera', label: '镜头', icon: '🎥', description: '点击添加构图/镜头标记。' },
]

function layerTypeForTool(tool: ImageEditTool): ImageEditLayerType | null {
  if (tool === 'color') return 'color-adjustment'
  if (tool === 'weather') return 'weather-overlay'
  if (tool === 'light') return 'light-overlay'
  if (tool === 'fog') return 'fog-overlay'
  if (tool === 'mask') return 'mask'
  if (tool === 'person') return 'person-marker'
  if (tool === 'architecture') return 'architecture-marker'
  if (tool === 'prop') return 'prop-marker'
  if (tool === 'camera') return 'camera-guide'
  return null
}

function createMark(input: {
  x: number
  y: number
  width?: number
  height?: number
  label: string
  instruction: string
}): ImageEditLayerMark {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `image-mark-${Math.random().toString(36).slice(2, 10)}`
  return {
    id,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    label: input.label,
    instruction: input.instruction,
  }
}

function ensureBaseLayer(layers: ImageEditLayer[]) {
  return layers.some((layer) => layer.type === 'base')
    ? layers
    : [createImageEditLayer({ type: 'base', name: '原图层', visible: true, opacity: 1 }), ...layers]
}

function buildEditPrompt(layers: ImageEditLayer[], sceneEdits: SceneEditMark[]) {
  const layerText = formatImageEditLayersForPrompt(layers)
  const markText = sceneEdits.length
    ? [
        '【场景编辑标记】',
        ...sceneEdits.map((edit, index) => (
          `标记 ${index + 1}：${edit.label}，位置 x ${Math.round(edit.x * 100)}% / y ${Math.round(edit.y * 100)}%。${edit.instruction}`
        )),
      ].join('\n')
    : ''
  return [layerText, markText].filter(Boolean).join('\n\n')
}

export function ImageEditStudio({
  node,
  imageUrl,
  imageEditLayers,
  sceneEdits,
  onSaveLayers,
  onSendPromptToImageNode,
  onClose,
}: ImageEditStudioProps) {
  const [layers, setLayers] = useState<ImageEditLayer[]>(() => ensureBaseLayer(imageEditLayers))
  const [activeTool, setActiveTool] = useState<ImageEditTool>('select')
  const [selectedLayerId, setSelectedLayerId] = useState('')
  const [selectedMarkId, setSelectedMarkId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [copied, setCopied] = useState(false)

  const derivedSceneEdits = useMemo(() => {
    const derived = imageEditLayersToSceneEdits(layers)
    return derived.length ? derived : sceneEdits
  }, [layers, sceneEdits])

  const selectLayer = (layerId: string, markId?: string) => {
    setSelectedLayerId(layerId)
    setSelectedMarkId(markId || '')
  }

  const updateLayer = (layerId: string, patch: Partial<ImageEditLayer>) => {
    setLayers((current) => updateImageEditLayer(current, layerId, patch))
  }

  const updateMark = (layerId: string, markId: string, patch: Partial<ImageEditLayerMark>) => {
    setLayers((current) => current.map((layer) => (
      layer.id === layerId
        ? { ...layer, marks: (layer.marks ?? []).map((mark) => mark.id === markId ? { ...mark, ...patch } : mark), updatedAt: new Date().toISOString() }
        : layer
    )))
  }

  const deleteLayer = (layerId: string) => {
    setLayers((current) => current.filter((layer) => layer.id !== layerId || layer.type === 'base'))
    if (selectedLayerId === layerId) {
      setSelectedLayerId('')
      setSelectedMarkId('')
    }
  }

  const activateTool = (tool: ImageEditTool) => {
    setActiveTool(tool)
    const type = layerTypeForTool(tool)
    if (!type || ['light-overlay', 'mask', 'person-marker', 'architecture-marker', 'prop-marker', 'camera-guide'].includes(type)) return
    const existing = layers.find((layer) => layer.type === type)
    if (existing) {
      selectLayer(existing.id, existing.marks?.[0]?.id)
      return
    }
    const layer = createImageEditLayer({ type })
    setLayers((current) => [...current, layer])
    selectLayer(layer.id)
  }

  const commitCanvasAction = (input: { tool: ImageEditTool; x: number; y: number; width?: number; height?: number }) => {
    const type = layerTypeForTool(input.tool)
    if (!type) return
    if (type === 'color-adjustment' || type === 'weather-overlay' || type === 'fog-overlay') {
      activateTool(input.tool)
      return
    }
    const mark = createMark({
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      label: type === 'mask' ? '局部遮罩' : imageEditLayerIcon(type),
      instruction: defaultImageEditInstruction(type),
    })
    const existing = layers.find((layer) => layer.type === type && ['light-overlay', 'mask'].includes(type) === false)
    if (existing && type !== 'light-overlay') {
      const nextMarks = [...(existing.marks ?? []), mark]
      setLayers((current) => updateImageEditLayer(current, existing.id, { marks: nextMarks }))
      selectLayer(existing.id, mark.id)
      return
    }
    const layer = createImageEditLayer({
      type,
      marks: [mark],
      name: type === 'light-overlay' ? '光线层' : undefined,
    })
    setLayers((current) => [...current, layer])
    selectLayer(layer.id, mark.id)
  }

  const moveMark = (layerId: string, markId: string, x: number, y: number) => {
    updateMark(layerId, markId, { x, y })
  }

  const generatePrompt = () => {
    const nextPrompt = buildEditPrompt(layers, derivedSceneEdits)
    setPrompt(nextPrompt)
    return nextPrompt
  }

  const saveLayers = () => {
    const nextPrompt = prompt || generatePrompt()
    onSaveLayers(layers, derivedSceneEdits, nextPrompt)
  }

  const copyPrompt = async () => {
    const nextPrompt = prompt || generatePrompt()
    try {
      await navigator.clipboard?.writeText(nextPrompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  const sendPrompt = () => {
    const nextPrompt = prompt || generatePrompt()
    onSaveLayers(layers, derivedSceneEdits, nextPrompt)
    onSendPromptToImageNode?.(node.id, nextPrompt)
  }

  const clearLayers = () => {
    if (!window.confirm('确定清空所有图片编辑层？')) return
    setLayers(ensureBaseLayer([]))
    setSelectedLayerId('')
    setSelectedMarkId('')
    setPrompt('')
  }

  return (
    <div className="image-edit-studio" data-no-node-drag="true" onWheel={(event) => event.stopPropagation()}>
      <aside className="image-edit-toolbar">
        {TOOL_OPTIONS.map((tool) => (
          <button
            key={tool.tool}
            type="button"
            className={activeTool === tool.tool ? 'is-active' : ''}
            onClick={() => activateTool(tool.tool)}
            title={tool.description}
          >
            <span>{tool.icon}</span>
            <small>{tool.label}</small>
          </button>
        ))}
      </aside>

      <main className="image-edit-main">
        <header className="image-edit-main-head">
          <div>
            <p>Image Edit Studio</p>
            <h3>{node.title}</h3>
          </div>
          {onClose ? <button type="button" onClick={onClose}>关闭</button> : null}
        </header>
        <ImageEditCanvas
          imageUrl={imageUrl}
          imageAlt={node.title}
          layers={layers}
          activeTool={activeTool}
          selectedLayerId={selectedLayerId}
          selectedMarkId={selectedMarkId}
          onCanvasCommit={commitCanvasAction}
          onSelectLayer={selectLayer}
          onMoveMark={moveMark}
        />
        <footer className="image-edit-footer">
          <button type="button" onClick={saveLayers}>保存编辑层</button>
          <button type="button" onClick={copyPrompt}>{copied ? '已复制' : '复制编辑 Prompt'}</button>
          <button type="button" onClick={sendPrompt}>发送到当前 Image Prompt</button>
          <button type="button" onClick={clearLayers}>清空编辑层</button>
        </footer>
        {prompt ? <pre className="image-edit-prompt-preview">{prompt}</pre> : null}
      </main>

      <ImageEditLayersPanel
        layers={layers}
        selectedLayerId={selectedLayerId}
        selectedMarkId={selectedMarkId}
        onSelectLayer={selectLayer}
        onUpdateLayer={updateLayer}
        onDeleteLayer={deleteLayer}
        onUpdateMark={updateMark}
      />
    </div>
  )
}
