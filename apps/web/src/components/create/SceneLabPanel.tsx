'use client'

import { useEffect, useMemo, useState } from 'react'
import type { VisualCanvasNode as CanvasNode } from '@/components/create/CanvasNodeCard'
import { ImageEditStudio } from './ImageEditStudio'
import {
  buildSceneProfileDraftFromNode,
  getImageEditLayers,
  getSceneEdits,
  imageEditLayersMetadata,
  sceneEditsMetadata,
  summarizeSceneSource,
  type ImageEditLayer,
  type SceneBible,
  type SceneEditBrief,
  type SceneEditMark,
  type SceneProfile,
  type SceneSourceNode,
} from '@/lib/scenes'

interface SceneLabPanelProps {
  nodes: CanvasNode[]
  projectId?: string
  currentNode?: CanvasNode | null
  currentNodeId?: string
  sceneBible: SceneBible
  selectedSceneIds?: string[]
  initialSourceNodeId?: string
  onSaveScene: (scene: SceneProfile) => void
  onSceneIdsChange?: (sceneIds: string[]) => void
  onSendPromptToNode?: (nodeId: string, prompt: string, sourceNodeId?: string) => void
  onSceneEditPromptChange?: (nodeId: string, prompt: string, sourceNodeId?: string) => void
}

const BRIEF_FIELDS: Array<{
  key: keyof Omit<SceneEditBrief, 'sourceNodeId' | 'sourceKind'>
  label: string
  placeholder: string
  multiline?: boolean
}> = [
  { key: 'targetTime', label: '改成什么时间', placeholder: '黄昏 / 深夜 / 清晨' },
  { key: 'targetWeather', label: '改成什么天气', placeholder: '雪夜 / 雨夜 / 雾天' },
  { key: 'targetColorPalette', label: '改成什么色调', placeholder: '暖金黄昏 / 蓝紫霓虹 / 冷色低饱和' },
  { key: 'targetArchitecture', label: '改成什么建筑/空间', placeholder: '更窄的街道，更多玻璃幕墙', multiline: true },
  { key: 'targetAtmosphere', label: '改成什么氛围', placeholder: '更孤独、更电影感', multiline: true },
  { key: 'preserveElements', label: '保留元素', placeholder: '保留未来城市结构和湿润街道', multiline: true },
  { key: 'removeElements', label: '移除元素', placeholder: '移除杂乱路人和多余招牌', multiline: true },
  { key: 'customInstruction', label: '自定义导演指令', placeholder: '强化纵深和雨水反射', multiline: true },
  { key: 'negativeRules', label: '禁止项', placeholder: '不要卡通化，不要改变未标记区域', multiline: true },
]

const inputClassName = 'h-9 rounded-md border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-3 text-sm text-white outline-none placeholder:text-[rgba(255,255,255,0.45)] focus:border-cyan-200/60'
const textareaClassName = 'min-h-[72px] resize-y rounded-md border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-[rgba(255,255,255,0.45)] focus:border-cyan-200/60'
const selectClassName = 'h-9 rounded-md border border-[rgba(255,255,255,0.16)] bg-[#151719] px-3 text-sm text-white outline-none focus:border-cyan-200/60'

function metadataRecord(metadataJson: unknown) {
  return metadataJson && typeof metadataJson === 'object' && !Array.isArray(metadataJson)
    ? metadataJson as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function compactText(value: string, limit: number) {
  const text = value.trim()
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function sourceFromNode(node: CanvasNode): SceneSourceNode {
  const metadata = metadataRecord(node.metadataJson)
  return {
    nodeId: node.id,
    kind: node.kind === 'video' ? 'video' : 'image',
    title: node.title,
    prompt: node.prompt,
    resultImageUrl: node.resultImageUrl,
    resultVideoUrl: node.resultVideoUrl,
    compiledPromptPreview: stringValue(metadata.compiledPromptPreview),
    providerId: node.providerId || stringValue(metadata.providerId),
    model: node.model || stringValue(metadata.model),
    metadataJson: node.metadataJson,
  }
}

function mutateNodeMetadata(
  node: CanvasNode | null | undefined,
  imageEditLayers: ImageEditLayer[],
  sceneEdits: SceneEditMark[],
  patch: Record<string, unknown> = {},
) {
  if (!node) return
  const withImageLayers = imageEditLayersMetadata(node.metadataJson, imageEditLayers)
  node.metadataJson = {
    ...sceneEditsMetadata(withImageLayers, sceneEdits),
    ...patch,
  }
}

export function SceneLabPanel({
  nodes,
  projectId,
  currentNode,
  currentNodeId,
  sceneBible,
  selectedSceneIds = [],
  initialSourceNodeId,
  onSaveScene,
  onSceneIdsChange,
  onSendPromptToNode,
  onSceneEditPromptChange,
}: SceneLabPanelProps) {
  const sourceNodes = useMemo(
    () => nodes.filter((node) => node.kind === 'image' || node.kind === 'video'),
    [nodes],
  )
  const currentSourceNode = currentNode?.kind === 'image' || currentNode?.kind === 'video' ? currentNode : null
  const defaultSourceNodeId = initialSourceNodeId || currentSourceNode?.id || sourceNodes[0]?.id || ''
  const [sourceNodeId, setSourceNodeId] = useState(defaultSourceNodeId)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [brief, setBrief] = useState<Partial<SceneEditBrief>>({})
  const [sceneSaveState, setSceneSaveState] = useState<'idle' | 'saved'>('idle')

  useEffect(() => {
    if (initialSourceNodeId) setSourceNodeId(initialSourceNodeId)
  }, [initialSourceNodeId])

  useEffect(() => {
    if (!sourceNodeId && defaultSourceNodeId) setSourceNodeId(defaultSourceNodeId)
  }, [defaultSourceNodeId, sourceNodeId])

  const sourceNode = sourceNodes.find((node) => node.id === sourceNodeId) ?? null
  const source = sourceNode ? sourceFromNode(sourceNode) : null
  const imageUrl = sourceNode?.kind === 'image' ? sourceNode.resultImageUrl : ''
  const boundScenes = sceneBible.scenes.filter((scene) => selectedSceneIds.includes(scene.id))

  const saveLayers = (layers: ImageEditLayer[], sceneEdits: SceneEditMark[], prompt: string) => {
    if (!sourceNode || !source) return
    mutateNodeMetadata(sourceNode, layers, sceneEdits, {
      sceneEditPromptPreview: compactText(prompt, 1000),
      sceneEditPromptSourceNodeId: source.nodeId,
      sceneEditPromptUpdatedAt: new Date().toISOString(),
    })
    onSceneEditPromptChange?.(source.nodeId, prompt, source.nodeId)
  }

  const sendPrompt = (nodeId: string, prompt: string) => {
    const targetNode = nodes.find((node) => node.id === nodeId) ?? sourceNode
    if (!targetNode || !source) return
    mutateNodeMetadata(
      targetNode,
      getImageEditLayers(targetNode.metadataJson),
      getSceneEdits(targetNode.metadataJson),
      {
        previousPrompt: targetNode.prompt,
        sceneEditPromptPreview: compactText(prompt, 1000),
        sceneEditPromptSourceNodeId: source.nodeId,
        sceneEditPromptUpdatedAt: new Date().toISOString(),
      },
    )
    onSendPromptToNode?.(targetNode.id, prompt, source.nodeId)
  }

  const saveSourceAsScene = (bindToCurrentNode = false) => {
    if (!source) return
    const scene = buildSceneProfileDraftFromNode(source)
    onSaveScene(scene)
    if (bindToCurrentNode && currentNodeId && onSceneIdsChange) {
      onSceneIdsChange([...new Set([...selectedSceneIds, scene.id])])
    }
    setSceneSaveState('saved')
    window.setTimeout(() => setSceneSaveState('idle'), 1400)
  }

  return (
    <div
      className="grid gap-4"
      data-no-node-drag="true"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/48">Scene Lab</p>
            <h3 className="mt-1 text-base font-semibold text-white/88">Image Edit Studio / 可视化图片编辑工作台</h3>
            <p className="mt-1 text-xs text-white/46">调色、天气、光线、雾气、遮罩和标记都会直接显示在图片上。</p>
          </div>
          <label className="grid min-w-[240px] gap-1.5">
            <span className="text-xs font-semibold text-white/50">来源 Image 节点</span>
            <select value={sourceNodeId} onChange={(event) => setSourceNodeId(event.target.value)} className={selectClassName}>
              {!sourceNodes.length ? <option value="">暂无 Image / Video 节点</option> : null}
              {sourceNodes.map((node) => (
                <option key={node.id} value={node.id}>{node.kind.toUpperCase()} · {node.title}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {sourceNode && imageUrl ? (
        <ImageEditStudio
          key={sourceNode.id}
          node={sourceNode}
          imageUrl={imageUrl}
          imageEditLayers={getImageEditLayers(sourceNode.metadataJson)}
          sceneEdits={getSceneEdits(sourceNode.metadataJson)}
          onSaveLayers={saveLayers}
          onSendPromptToImageNode={sendPrompt}
        />
      ) : (
        <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-white/14 bg-black/22 p-8 text-center">
          <div>
            <h4 className="text-base font-semibold text-white/76">当前节点还没有图片结果</h4>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/48">可以先生成图片，或从上方选择其他已有 resultImageUrl 的 Image 节点。</p>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-semibold text-white/82"
          onClick={() => setAdvancedOpen((current) => !current)}
        >
          <span>高级文字指令</span>
          <span className="text-white/42">{advancedOpen ? '收起' : '展开'}</span>
        </button>
        {advancedOpen ? (
          <div className="mt-4 grid gap-3">
            <div className="rounded-md border border-white/10 bg-black/20 p-3 text-xs leading-5 text-white/48">
              <p>项目：{projectId || '未加载项目'}</p>
              <p className="mt-1">当前绑定场景：{boundScenes.map((scene) => scene.name).join('、') || '无'}</p>
              {source ? <pre className="mt-2 whitespace-pre-wrap break-words">{summarizeSceneSource(source)}</pre> : null}
            </div>
            {BRIEF_FIELDS.map((field) => (
              <label key={field.key} className="grid gap-1.5">
                <span className="text-xs font-semibold text-white/56">{field.label}</span>
                {field.multiline ? (
                  <textarea
                    value={String(brief[field.key] ?? '')}
                    onChange={(event) => setBrief((current) => ({ ...current, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    rows={3}
                    className={textareaClassName}
                  />
                ) : (
                  <input
                    value={String(brief[field.key] ?? '')}
                    onChange={(event) => setBrief((current) => ({ ...current, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    className={inputClassName}
                  />
                )}
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-45" disabled={!source} onClick={() => saveSourceAsScene(false)}>
                {sceneSaveState === 'saved' ? '已保存' : '保存来源为场景'}
              </button>
              <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-45" disabled={!source || !currentNodeId || !onSceneIdsChange} onClick={() => saveSourceAsScene(true)}>
                保存为场景并绑定
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs leading-5 text-white/45">原来的时间、天气、色调、建筑、保留/禁止等文字字段保留在这里，默认不打断图片编辑流程。</p>
        )}
      </section>
    </div>
  )
}
