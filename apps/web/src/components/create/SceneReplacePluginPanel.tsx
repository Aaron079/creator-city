'use client'

import { useMemo, useState } from 'react'
import type { SceneBible } from '@/lib/scenes'
import {
  buildSceneReplacePrompt,
  createScenePluginRun,
  type ScenePluginRegion,
  type ScenePluginRun,
  type SceneReplaceSourceNode,
} from '@/lib/scene-plugins'

interface SceneReplacePluginPanelProps {
  sourceNode: SceneReplaceSourceNode
  region: ScenePluginRegion | null
  projectId?: string
  sceneBible?: SceneBible | null
  onCreateImageNode: (run: ScenePluginRun, prompt: string) => void
  onClearRegion?: () => void
}

const textareaClassName = 'min-h-[84px] resize-y rounded-md border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-[rgba(255,255,255,0.45)] focus:border-cyan-200/60'

function regionLabel(region: ScenePluginRegion | null) {
  if (!region) return '尚未框选'
  return `x ${Math.round(region.x * 100)}% / y ${Math.round(region.y * 100)}% / w ${Math.round(region.width * 100)}% / h ${Math.round(region.height * 100)}%`
}

export function SceneReplacePluginPanel({
  sourceNode,
  region,
  projectId,
  sceneBible,
  onCreateImageNode,
  onClearRegion,
}: SceneReplacePluginPanelProps) {
  const [targetDescription, setTargetDescription] = useState('')
  const [preserveInstruction, setPreserveInstruction] = useState('保留霓虹、雨夜、湿润街道和主构图。')
  const [negativeInstruction, setNegativeInstruction] = useState('不要变成白天、乡村、卡通化。')
  const [styleInheritance, setStyleInheritance] = useState<'low' | 'medium' | 'high'>('high')
  const [prompt, setPrompt] = useState('')
  const [copied, setCopied] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [runMessage, setRunMessage] = useState('')
  const [runError, setRunError] = useState('')

  const draftRun = useMemo(() => {
    if (!region) return null
    return createScenePluginRun({
      sourceNodeId: sourceNode.id,
      sourceImageUrl: sourceNode.resultImageUrl,
      region,
      targetDescription,
      preserveInstruction,
      negativeInstruction,
      styleInheritance,
      status: 'draft',
    })
  }, [negativeInstruction, preserveInstruction, region, sourceNode.id, sourceNode.resultImageUrl, styleInheritance, targetDescription])

  const generatePrompt = () => {
    if (!draftRun) return ''
    const nextPrompt = buildSceneReplacePrompt(draftRun, sourceNode, null, sceneBible ?? null)
    setPrompt(nextPrompt)
    return nextPrompt
  }

  const copyPrompt = async () => {
    const nextPrompt = prompt || generatePrompt()
    if (!nextPrompt) return
    try {
      await navigator.clipboard?.writeText(nextPrompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  const executePlugin = async () => {
    if (!draftRun) return
    const nextPrompt = prompt || generatePrompt()
    if (!nextPrompt.trim()) return
    setIsRunning(true)
    setRunError('')
    setRunMessage('插件处理中')
    try {
      const response = await fetch('/api/scene-plugins/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceImageUrl: sourceNode.resultImageUrl,
          region: draftRun.region,
          targetDescription,
          preserveInstruction,
          negativeInstruction,
          styleInheritance,
          projectId,
          sourceNodeId: sourceNode.id,
        }),
      })
      const json = await response.json() as {
        success?: boolean
        imageUrl?: string
        errorCode?: string
        message?: string
        pluginProvider?: string
        result?: unknown
        upstreamMessage?: string
      }
      if (!response.ok || !json.success || !json.imageUrl) {
        const message = json.message || json.upstreamMessage || json.errorCode || '场景替换插件执行失败。'
        setRunError(message)
        setRunMessage('')
        return
      }
      const completedAt = new Date().toISOString()
      const run: ScenePluginRun = {
        ...draftRun,
        prompt: nextPrompt,
        resultImageUrl: json.imageUrl,
        pluginProvider: json.pluginProvider || 'custom',
        pluginResult: json.result ?? json,
        status: 'done',
        updatedAt: completedAt,
      }
      onCreateImageNode(run, nextPrompt)
      setRunMessage('插件已返回新图，已创建 Image 节点。')
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '场景替换插件执行失败。')
      setRunMessage('')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <aside className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-white" data-no-node-drag="true" onWheel={(event) => event.stopPropagation()}>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/48">Scene Replace Plugin</p>
        <h3 className="mt-1 text-base font-semibold text-white/88">场景替换</h3>
        <p className="mt-1 text-xs leading-5 text-white/46">框选区域，定义替换目标，然后调用后端插件返回新图，不触发普通图片生成。</p>
      </div>

      <div className="mb-4 rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="text-xs font-semibold text-white/52">当前选区</div>
        <p className="mt-1 font-mono text-xs text-cyan-100/72">{regionLabel(region)}</p>
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-white/58">替换目标</span>
          <textarea
            value={targetDescription}
            onChange={(event) => setTargetDescription(event.target.value)}
            placeholder="把这里改成海边未来城市"
            className={textareaClassName}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-white/58">保留内容</span>
          <textarea
            value={preserveInstruction}
            onChange={(event) => setPreserveInstruction(event.target.value)}
            placeholder="保留霓虹、雨夜、湿润街道和主构图"
            className={textareaClassName}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-white/58">禁止内容</span>
          <textarea
            value={negativeInstruction}
            onChange={(event) => setNegativeInstruction(event.target.value)}
            placeholder="不要变成白天、乡村、卡通化"
            className={textareaClassName}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-white/58">风格继承强度</span>
          <select
            value={styleInheritance}
            onChange={(event) => setStyleInheritance(event.target.value as 'low' | 'medium' | 'high')}
            className="h-9 rounded-md border border-white/15 bg-[#151719] px-3 text-sm text-white outline-none focus:border-cyan-200/60"
          >
            <option value="high">high / 强继承</option>
            <option value="medium">medium / 中等继承</option>
            <option value="low">low / 弱继承</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-2">
        <button type="button" className="rounded-md border border-cyan-200/30 bg-cyan-200/12 px-3 py-2 text-sm font-semibold text-cyan-50 disabled:opacity-45" disabled={!region} onClick={generatePrompt}>
          生成替换 Prompt
        </button>
        <button type="button" className="rounded-md border border-emerald-200/30 bg-emerald-200/14 px-3 py-2 text-sm font-semibold text-emerald-50 disabled:opacity-45" disabled={!region || !sourceNode.resultImageUrl || !targetDescription.trim() || isRunning} onClick={() => { void executePlugin() }}>
          {isRunning ? '插件处理中' : '执行场景替换插件'}
        </button>
        <button type="button" className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/74 disabled:opacity-45" disabled={!region} onClick={() => { void copyPrompt() }}>
          {copied ? '已复制' : '复制 Prompt'}
        </button>
        <button type="button" className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/58" onClick={onClearRegion}>
          清空
        </button>
      </div>

      {runMessage ? (
        <div className="mt-3 rounded-md border border-emerald-200/18 bg-emerald-200/[0.08] px-3 py-2 text-xs leading-5 text-emerald-50/82">{runMessage}</div>
      ) : null}

      {runError ? (
        <div className="mt-3 rounded-md border border-red-200/22 bg-red-500/[0.10] px-3 py-2 text-xs leading-5 text-red-50/82">{runError}</div>
      ) : null}

      {prompt ? (
        <pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/24 p-3 text-xs leading-5 text-white/68">{prompt}</pre>
      ) : null}
    </aside>
  )
}
