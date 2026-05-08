'use client'

import { useEffect, useMemo, useState } from 'react'
import type { VisualCanvasNode as CanvasNode } from '@/components/create/CanvasNodeCard'
import { SceneToolLayer } from './SceneToolLayer'
import { SceneToolPalette } from './SceneToolPalette'
import {
  buildSceneProfileDraftFromNode,
  getSceneEdits,
  sceneEditsMetadata,
  summarizeSceneSource,
  type SceneEditBrief,
  type SceneEditMark,
  type SceneEditTool,
  type SceneProfile,
  type SceneSourceNode,
  type SceneBible,
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

function formatPercent(value: number) {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`
}

function formatVisualSceneEditPrompt(source: SceneSourceNode, sceneEdits: SceneEditMark[], brief: Partial<SceneEditBrief>) {
  const advancedLines = [
    brief.targetTime && `- 时间：${brief.targetTime}`,
    brief.targetWeather && `- 天气：${brief.targetWeather}`,
    brief.targetColorPalette && `- 色调：${brief.targetColorPalette}`,
    brief.targetArchitecture && `- 建筑/空间：${brief.targetArchitecture}`,
    brief.targetAtmosphere && `- 氛围：${brief.targetAtmosphere}`,
    brief.preserveElements && `- 需要保留：${brief.preserveElements}`,
    brief.removeElements && `- 需要移除：${brief.removeElements}`,
    brief.customInstruction && `- 自定义导演指令：${brief.customInstruction}`,
    brief.negativeRules && `- 禁止项：${brief.negativeRules}`,
  ].filter(Boolean)

  return [
    '【基于图片的场景可视化修改】',
    '请保持原图主体、构图和世界观，只按照以下标记进行修改：',
    '',
    `来源节点：${source.title || source.nodeId}`,
    source.resultImageUrl && `来源图片：${source.resultImageUrl}`,
    source.prompt && `原始提示词：${compactText(source.prompt, 420)}`,
    '',
    sceneEdits.length
      ? sceneEdits.map((edit, index) => [
          `标记 ${index + 1}：`,
          `工具：${edit.label}`,
          `位置：x ${formatPercent(edit.x)} / y ${formatPercent(edit.y)}${edit.width && edit.height ? ` / 区域 ${formatPercent(edit.width)} × ${formatPercent(edit.height)}` : ''}`,
          `指令：${edit.instruction}`,
        ].join('\n')).join('\n\n')
      : '当前还没有标记。请先在图片上点击或框选要修改的位置。',
    '',
    '【全局要求】',
    '- 保持原场景空间结构',
    '- 保持主要构图',
    '- 不要改变未标记区域',
    '- 不要卡通化',
    '- 不要破坏角色和场景一致性',
    advancedLines.length ? ['', '【高级文字指令】', ...advancedLines].join('\n') : '',
  ].filter(Boolean).join('\n')
}

function mutateNodeMetadata(node: CanvasNode | null | undefined, sceneEdits: SceneEditMark[], patch: Record<string, unknown> = {}) {
  if (!node) return
  node.metadataJson = {
    ...sceneEditsMetadata(node.metadataJson, sceneEdits),
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
  const [activeTool, setActiveTool] = useState<SceneEditTool>('weather')
  const [sceneEdits, setSceneEdits] = useState<SceneEditMark[]>([])
  const [selectedEditId, setSelectedEditId] = useState('')
  const [brief, setBrief] = useState<Partial<SceneEditBrief>>({})
  const [sceneEditPrompt, setSceneEditPrompt] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')
  const [sceneSaveState, setSceneSaveState] = useState<'idle' | 'saved'>('idle')

  useEffect(() => {
    if (initialSourceNodeId) setSourceNodeId(initialSourceNodeId)
  }, [initialSourceNodeId])

  useEffect(() => {
    if (!sourceNodeId && defaultSourceNodeId) setSourceNodeId(defaultSourceNodeId)
  }, [defaultSourceNodeId, sourceNodeId])

  const sourceNode = sourceNodes.find((node) => node.id === sourceNodeId) ?? null
  const source = sourceNode ? sourceFromNode(sourceNode) : null
  const currentImageNode = currentNodeId
    ? nodes.find((node) => node.id === currentNodeId && node.kind === 'image') ?? null
    : null
  const targetImageNode = currentImageNode || (sourceNode?.kind === 'image' ? sourceNode : null)
  const boundScenes = sceneBible.scenes.filter((scene) => selectedSceneIds.includes(scene.id))
  const selectedEdit = sceneEdits.find((edit) => edit.id === selectedEditId) ?? null
  const sourceIsCurrentNode = Boolean(source && currentNodeId && source.nodeId === currentNodeId)
  const imageUrl = sourceNode?.kind === 'image' ? sourceNode.resultImageUrl : ''

  useEffect(() => {
    setSceneEdits(getSceneEdits(sourceNode?.metadataJson))
    setSelectedEditId('')
    setSceneEditPrompt('')
    setCopyState('idle')
    setSaveState('idle')
  }, [sourceNode?.id, sourceNode?.metadataJson])

  const buildPrompt = (nextEdits = sceneEdits) => {
    if (!source) return ''
    return formatVisualSceneEditPrompt(source, nextEdits, brief)
  }

  const updateSceneEdits = (nextEdits: SceneEditMark[]) => {
    setSceneEdits(nextEdits)
    if (!nextEdits.some((edit) => edit.id === selectedEditId)) {
      setSelectedEditId(nextEdits.at(-1)?.id || '')
    }
    setSaveState('idle')
  }

  const persistSceneLayer = (nextEdits = sceneEdits, prompt = sceneEditPrompt || buildPrompt(nextEdits)) => {
    if (!sourceNode || !source) return
    mutateNodeMetadata(sourceNode, nextEdits, {
      sceneEditPromptPreview: compactText(prompt, 1000),
      sceneEditPromptSourceNodeId: source.nodeId,
      sceneEditPromptUpdatedAt: new Date().toISOString(),
    })
    onSceneEditPromptChange?.(source.nodeId, prompt, source.nodeId)
    setSaveState('saved')
    window.setTimeout(() => setSaveState('idle'), 1400)
  }

  const generatePrompt = () => {
    const prompt = buildPrompt()
    setSceneEditPrompt(prompt)
    if (sourceNode && source) {
      mutateNodeMetadata(sourceNode, sceneEdits, {
        sceneEditPromptPreview: compactText(prompt, 1000),
        sceneEditPromptSourceNodeId: source.nodeId,
        sceneEditPromptUpdatedAt: new Date().toISOString(),
      })
      onSceneEditPromptChange?.(source.nodeId, prompt, source.nodeId)
    }
  }

  const copyPrompt = async () => {
    const prompt = sceneEditPrompt || buildPrompt()
    try {
      if (!prompt.trim() || !navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(prompt)
      setSceneEditPrompt(prompt)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1400)
    } catch {
      setCopyState('failed')
    }
  }

  const sendPrompt = () => {
    if (!targetImageNode || !source) return
    const prompt = sceneEditPrompt || buildPrompt()
    if (!prompt.trim()) return
    mutateNodeMetadata(targetImageNode, targetImageNode.id === sourceNode?.id ? sceneEdits : getSceneEdits(targetImageNode.metadataJson), {
      previousPrompt: targetImageNode.prompt,
      sceneEditPromptPreview: compactText(prompt, 1000),
      sceneEditPromptSourceNodeId: source.nodeId,
      sceneEditPromptUpdatedAt: new Date().toISOString(),
    })
    if (sourceNode) mutateNodeMetadata(sourceNode, sceneEdits)
    onSendPromptToNode?.(targetImageNode.id, prompt, source.nodeId)
    setSceneEditPrompt(prompt)
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
      className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"
      data-no-node-drag="true"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <section className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/48">Scene Lab</p>
            <h3 className="mt-1 text-base font-semibold text-white/88">图片场景导演</h3>
            <p className="mt-1 text-xs text-white/46">选择工具，然后在图片上点击或框选要修改的位置。</p>
          </div>
          <label className="grid min-w-[220px] gap-1.5">
            <span className="text-xs font-semibold text-white/50">来源节点</span>
            <select
              value={sourceNodeId}
              onChange={(event) => setSourceNodeId(event.target.value)}
              className={selectClassName}
            >
              {!sourceNodes.length ? <option value="">暂无 Image / Video 节点</option> : null}
              {sourceNodes.map((node) => (
                <option key={node.id} value={node.id}>{node.kind.toUpperCase()} · {node.title}</option>
              ))}
            </select>
          </label>
        </div>

        {source && imageUrl ? (
          <div className="grid gap-3">
            <div className="rounded-lg border border-cyan-100/15 bg-cyan-100/[0.07] px-3 py-2 text-xs leading-5 text-cyan-50/78">
              当前工具：{activeTool}。点击图片添加标记，拖拽可框选区域。{sourceIsCurrentNode ? '已自动选中当前 Image 节点。' : ''}
            </div>
            <div className="min-h-[420px] overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <SceneToolLayer
                imageUrl={imageUrl}
                imageAlt={source.title || 'Scene Lab source image'}
                activeTool={activeTool}
                sceneEdits={sceneEdits}
                selectedEditId={selectedEditId}
                onSceneEditsChange={updateSceneEdits}
                onSelectEdit={setSelectedEditId}
              />
            </div>
          </div>
        ) : (
          <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-white/14 bg-black/22 p-8 text-center">
            <div>
              <h4 className="text-base font-semibold text-white/76">当前节点还没有图片结果</h4>
              <p className="mt-2 max-w-md text-sm leading-6 text-white/48">可以先生成图片，或从上方选择其他已有 resultImageUrl 的 Image 节点。</p>
            </div>
          </div>
        )}
      </section>

      <aside className="grid min-h-0 gap-4">
        <SceneToolPalette
          activeTool={activeTool}
          sceneEdits={sceneEdits}
          selectedEditId={selectedEditId}
          copied={copyState === 'copied'}
          onToolChange={setActiveTool}
          onSelectEdit={setSelectedEditId}
          onLabelChange={(editId, label) => updateSceneEdits(sceneEdits.map((edit) => edit.id === editId ? { ...edit, label } : edit))}
          onInstructionChange={(editId, instruction) => updateSceneEdits(sceneEdits.map((edit) => edit.id === editId ? { ...edit, instruction } : edit))}
          onDeleteEdit={(editId) => updateSceneEdits(sceneEdits.filter((edit) => edit.id !== editId))}
          onClearEdits={() => {
            if (sceneEdits.length && !window.confirm('确定清空所有场景编辑标记？')) return
            updateSceneEdits([])
            persistSceneLayer([], buildPrompt([]))
          }}
          onCopyInstructions={() => { void copyPrompt() }}
          onSaveLayer={() => persistSceneLayer()}
        />

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-white/82">场景修改 Prompt</h4>
              <p className="mt-1 text-xs text-white/42">根据图片标记生成，不自动调用生成。</p>
            </div>
            <button type="button" className="rounded-md bg-cyan-100 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-white" onClick={generatePrompt}>
              生成
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-45" disabled={!source} onClick={() => { void copyPrompt() }}>
              {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制 Prompt'}
            </button>
            <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-45" disabled={!targetImageNode || !source} onClick={sendPrompt}>
              发送到当前 Image Prompt
            </button>
            <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-45" disabled={!source} onClick={() => persistSceneLayer()}>
              {saveState === 'saved' ? '已保存' : '保存编辑层'}
            </button>
          </div>
          {sceneEditPrompt ? (
            <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/30 p-3 text-xs leading-5 text-white/72">{sceneEditPrompt}</pre>
          ) : (
            <p className="mt-3 rounded-md border border-dashed border-white/12 p-3 text-xs leading-5 text-white/45">添加标记后点击“生成”，这里会出现可复制的场景修改 Prompt。</p>
          )}
        </section>

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
            <p className="mt-3 text-xs leading-5 text-white/45">原来的时间、天气、色调、建筑、保留/禁止等文字字段已收进这里，默认不打断图片标记流程。</p>
          )}
        </section>

        {!selectedEdit ? (
          <div className="rounded-xl border border-dashed border-white/12 p-4 text-sm leading-6 text-white/45">
            请选择右侧工具并点击图片添加场景修改标记。
          </div>
        ) : null}
      </aside>
    </div>
  )
}
