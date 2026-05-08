'use client'

import { useEffect, useMemo, useState } from 'react'
import type { VisualCanvasNode as CanvasNode } from '@/components/create/CanvasNodeCard'
import {
  buildSceneEditPrompt,
  buildSceneProfileDraftFromNode,
  summarizeSceneSource,
  type SceneEditBrief,
  type SceneProfile,
  type SceneSourceNode,
  type SceneBible,
} from '@/lib/scenes'

interface SceneLabPanelProps {
  nodes: CanvasNode[]
  projectId?: string
  currentNodeId?: string
  sceneBible: SceneBible
  initialSourceNodeId?: string
  onSaveScene: (scene: SceneProfile) => void
  onSendPromptToNode?: (nodeId: string, prompt: string, sourceNodeId?: string) => void
  onSceneEditPromptChange?: (nodeId: string, prompt: string, sourceNodeId?: string) => void
}

const SCENE_FIELDS: Array<{
  key: keyof Pick<SceneProfile, 'name' | 'logline' | 'location' | 'era' | 'atmosphere' | 'architecture' | 'lighting' | 'weather' | 'colorRules' | 'keyObjects' | 'continuityRules' | 'negativeRules'>
  label: string
  multiline?: boolean
}> = [
  { key: 'name', label: '场景名' },
  { key: 'logline', label: '一句话描述', multiline: true },
  { key: 'location', label: '地点' },
  { key: 'era', label: '时代' },
  { key: 'atmosphere', label: '氛围', multiline: true },
  { key: 'architecture', label: '建筑/空间结构', multiline: true },
  { key: 'lighting', label: '光线', multiline: true },
  { key: 'weather', label: '天气' },
  { key: 'colorRules', label: '色彩规则', multiline: true },
  { key: 'keyObjects', label: '关键物件', multiline: true },
  { key: 'continuityRules', label: '连续性规则', multiline: true },
  { key: 'negativeRules', label: '禁止变化项', multiline: true },
]

const BRIEF_FIELDS: Array<{
  key: keyof Omit<SceneEditBrief, 'sourceNodeId' | 'sourceKind'>
  label: string
  placeholder: string
  multiline?: boolean
}> = [
  { key: 'targetTime', label: '改成什么时间', placeholder: '黄昏 / 深夜 / 清晨' },
  { key: 'targetWeather', label: '改成什么天气', placeholder: '雨夜 / 雾天 / 雪' },
  { key: 'targetColorPalette', label: '改成什么色调', placeholder: '暖金色调 / 蓝紫霓虹 / 冷色低饱和' },
  { key: 'targetArchitecture', label: '改成什么建筑/空间', placeholder: '更窄的街道，更多玻璃幕墙', multiline: true },
  { key: 'targetAtmosphere', label: '改成什么氛围', placeholder: '更孤独、更电影感', multiline: true },
  { key: 'preserveElements', label: '保留元素', placeholder: '保留未来城市结构和湿润街道', multiline: true },
  { key: 'removeElements', label: '移除元素', placeholder: '移除杂乱路人和多余招牌', multiline: true },
  { key: 'customInstruction', label: '自定义导演指令', placeholder: '强化纵深和雨水反射', multiline: true },
  { key: 'negativeRules', label: '禁止项', placeholder: '禁止变成白天乡村，禁止卡通化', multiline: true },
]

function metadataRecord(metadataJson: unknown) {
  return metadataJson && typeof metadataJson === 'object' && !Array.isArray(metadataJson)
    ? metadataJson as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
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

function parseKeywords(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function SceneLabPanel({
  nodes,
  projectId,
  currentNodeId,
  sceneBible,
  initialSourceNodeId,
  onSaveScene,
  onSendPromptToNode,
  onSceneEditPromptChange,
}: SceneLabPanelProps) {
  const sourceNodes = useMemo(
    () => nodes.filter((node) => node.kind === 'image' || node.kind === 'video'),
    [nodes],
  )
  const [sourceNodeId, setSourceNodeId] = useState(initialSourceNodeId || sourceNodes[0]?.id || '')
  const [sceneDraft, setSceneDraft] = useState<SceneProfile | null>(null)
  const [brief, setBrief] = useState<Partial<SceneEditBrief>>({})
  const [sceneEditPrompt, setSceneEditPrompt] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')

  useEffect(() => {
    if (initialSourceNodeId) setSourceNodeId(initialSourceNodeId)
  }, [initialSourceNodeId])

  useEffect(() => {
    if (!sourceNodeId && sourceNodes[0]?.id) setSourceNodeId(sourceNodes[0].id)
  }, [sourceNodeId, sourceNodes])

  const sourceNode = sourceNodes.find((node) => node.id === sourceNodeId) ?? null
  const source = sourceNode ? sourceFromNode(sourceNode) : null
  const currentImageNode = currentNodeId
    ? nodes.find((node) => node.id === currentNodeId && node.kind === 'image') ?? null
    : null

  const extractDraft = () => {
    if (!source) return
    setSceneDraft(buildSceneProfileDraftFromNode(source))
    setSaveState('idle')
  }

  const saveDraft = () => {
    if (!sceneDraft) return
    onSaveScene(sceneDraft)
    setSaveState('saved')
    window.setTimeout(() => setSaveState('idle'), 1400)
  }

  const generateEditPrompt = () => {
    if (!source || !sceneDraft) return
    const nextBrief: SceneEditBrief = {
      sourceNodeId: source.nodeId,
      sourceKind: source.kind,
      ...brief,
    }
    const prompt = buildSceneEditPrompt(source, sceneDraft, nextBrief)
    setSceneEditPrompt(prompt)
    onSceneEditPromptChange?.(currentImageNode?.id || currentNodeId || source.nodeId, prompt, source.nodeId)
  }

  const copyPrompt = async () => {
    try {
      if (!sceneEditPrompt.trim() || !navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(sceneEditPrompt)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1400)
    } catch {
      setCopyState('failed')
    }
  }

  const sendPrompt = () => {
    if (!currentImageNode || !sceneEditPrompt.trim()) return
    onSendPromptToNode?.(currentImageNode.id, sceneEditPrompt, source?.nodeId)
  }

  return (
    <div
      className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]"
      data-no-node-drag="true"
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white/84">Scene Lab</h3>
            <p className="mt-1 text-xs text-white/42">项目 {projectId || '未加载项目'}</p>
          </div>
          <span className="rounded-md border border-cyan-100/15 px-2 py-1 text-xs text-cyan-100/70">{sceneBible.scenes.length} 场景</span>
        </div>

        <label className="mt-4 grid gap-1.5">
          <span className="text-xs font-semibold text-white/56">选择来源</span>
          <select
            value={sourceNodeId}
            onChange={(event) => {
              setSourceNodeId(event.target.value)
              setSceneDraft(null)
              setSceneEditPrompt('')
            }}
            className="h-9 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white/82 outline-none focus:border-cyan-200/36"
          >
            {sourceNodes.map((node) => (
              <option key={node.id} value={node.id}>{node.kind.toUpperCase()} · {node.title}</option>
            ))}
          </select>
        </label>

        {source ? (
          <div className="mt-4 space-y-3">
            {source.resultImageUrl ? (
              <img src={source.resultImageUrl} alt={source.title || '来源图片'} className="max-h-44 w-full rounded-lg border border-white/10 object-cover" />
            ) : source.resultVideoUrl ? (
              <video src={source.resultVideoUrl} className="max-h-44 w-full rounded-lg border border-white/10 object-cover" muted playsInline preload="metadata" />
            ) : (
              <div className="rounded-lg border border-dashed border-white/14 p-4 text-sm text-white/45">来源节点还没有可预览的生成结果。</div>
            )}
            <div className="rounded-md bg-black/18 p-3 text-xs leading-5 text-white/58">
              <pre className="whitespace-pre-wrap break-words">{summarizeSceneSource(source)}</pre>
            </div>
            <button
              type="button"
              className="w-full rounded-md bg-cyan-100 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-white"
              onClick={extractDraft}
            >
              提取为场景
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-white/14 p-4 text-sm text-white/45">
            当前画布还没有 Image / Video 节点。
          </div>
        )}
      </section>

      <div className="grid min-w-0 gap-4">
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white/84">提取为场景</h3>
              <p className="mt-1 text-xs text-white/42">基于来源节点已有 prompt/result/metadata 生成草稿，不调用模型。</p>
            </div>
            <button
              type="button"
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-45"
              disabled={!sceneDraft}
              onClick={saveDraft}
            >
              {saveState === 'saved' ? '已保存' : '保存到场景库'}
            </button>
          </div>

          {sceneDraft ? (
            <div className="grid gap-3 md:grid-cols-2">
              {SCENE_FIELDS.map((field) => (
                <label key={field.key} className={`grid gap-1.5 ${field.multiline ? 'md:col-span-2' : ''}`}>
                  <span className="text-xs font-semibold text-white/56">{field.label}</span>
                  {field.multiline ? (
                    <textarea
                      value={String(sceneDraft[field.key] ?? '')}
                      onChange={(event) => setSceneDraft((current) => current ? { ...current, [field.key]: event.target.value } : current)}
                      rows={3}
                      className="min-h-[74px] resize-y rounded-md border border-white/10 bg-black/22 px-3 py-2 text-sm leading-6 text-white/82 outline-none placeholder:text-white/28 focus:border-cyan-200/36"
                    />
                  ) : (
                    <input
                      value={String(sceneDraft[field.key] ?? '')}
                      onChange={(event) => setSceneDraft((current) => current ? { ...current, [field.key]: event.target.value } : current)}
                      className="h-9 rounded-md border border-white/10 bg-black/22 px-3 text-sm text-white/82 outline-none placeholder:text-white/28 focus:border-cyan-200/36"
                    />
                  )}
                </label>
              ))}
              <label className="grid gap-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-white/56">参考关键词</span>
                <textarea
                  value={sceneDraft.referenceKeywords?.join(', ') ?? ''}
                  onChange={(event) => setSceneDraft((current) => current ? { ...current, referenceKeywords: parseKeywords(event.target.value) } : current)}
                  rows={2}
                  className="min-h-[58px] resize-y rounded-md border border-white/10 bg-black/22 px-3 py-2 text-sm leading-6 text-white/82 outline-none placeholder:text-white/28 focus:border-cyan-200/36"
                />
              </label>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/14 p-5 text-sm text-white/48">
              选择来源节点后点击“提取为场景”。
            </div>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white/84">场景改造</h3>
              <p className="mt-1 text-xs text-white/42">生成可复制或写回当前 Image 节点的 Prompt，不自动生成。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-45"
                disabled={!sceneDraft || !source}
                onClick={generateEditPrompt}
              >
                生成场景改造 Prompt
              </button>
              <button
                type="button"
                className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-45"
                disabled={!sceneEditPrompt.trim()}
                onClick={() => { void copyPrompt() }}
              >
                {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制 Prompt'}
              </button>
              <button
                type="button"
                className="rounded-md bg-cyan-100 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-white disabled:opacity-45"
                disabled={!currentImageNode || !sceneEditPrompt.trim()}
                onClick={sendPrompt}
                title={currentImageNode ? '只更新当前 Image 节点 Prompt，不自动生成。' : '当前节点不是 Image 节点'}
              >
                发送到当前 Image 节点 Prompt
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {BRIEF_FIELDS.map((field) => (
              <label key={field.key} className={`grid gap-1.5 ${field.multiline ? 'md:col-span-2' : ''}`}>
                <span className="text-xs font-semibold text-white/56">{field.label}</span>
                {field.multiline ? (
                  <textarea
                    value={String(brief[field.key] ?? '')}
                    onChange={(event) => setBrief((current) => ({ ...current, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    rows={3}
                    className="min-h-[74px] resize-y rounded-md border border-white/10 bg-black/22 px-3 py-2 text-sm leading-6 text-white/82 outline-none placeholder:text-white/28 focus:border-cyan-200/36"
                  />
                ) : (
                  <input
                    value={String(brief[field.key] ?? '')}
                    onChange={(event) => setBrief((current) => ({ ...current, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    className="h-9 rounded-md border border-white/10 bg-black/22 px-3 text-sm text-white/82 outline-none placeholder:text-white/28 focus:border-cyan-200/36"
                  />
                )}
              </label>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold text-white/56">输出区</div>
            {sceneEditPrompt ? (
              <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/22 p-3 text-sm leading-6 text-white/78">
                {sceneEditPrompt}
              </pre>
            ) : (
              <div className="rounded-lg border border-dashed border-white/14 p-5 text-sm text-white/48">
                生成后会显示 sceneEditPrompt。
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
