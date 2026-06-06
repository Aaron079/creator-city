'use client'

import { useState, useCallback } from 'react'
import { X, RefreshCw, Copy, Plus, Check } from 'lucide-react'
import {
  parseShotList,
  buildShotListReport,
  SHOT_SIZE_LABELS,
  OUTPUT_MODE_LABELS,
  PACING_LABELS,
  STRATEGY_LABELS,
  DEFAULT_SHOT_OPTIONS,
} from '@/lib/canvas/shot-list'
import type { ShotDraft, ShotSize, ShotKind, ShotListOptions } from '@/lib/canvas/shot-list'
import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'

interface SourceNode {
  id: string
  title?: string
  kind: string
  prompt?: string
  resultText?: string
}

interface ShotListBuilderPanelProps {
  nodes: SourceNode[]
  initialNodeId?: string
  onCreateNode: (kind: VisualCanvasNodeKind, options: { title?: string; prompt?: string; parentNodeId?: string }) => void
  onClose: () => void
}

const SHOT_SIZE_OPTIONS: Array<{ value: ShotSize; label: string }> = [
  { value: 'wide', label: '全景' },
  { value: 'medium', label: '中景' },
  { value: 'close', label: '近景' },
  { value: 'extreme-close', label: '特写' },
]

const COUNT_PRESETS = [3, 5, 8] as const
type CountPreset = typeof COUNT_PRESETS[number]

function getNodeText(node: SourceNode): string {
  return (node.resultText ?? node.prompt ?? '').trim()
}

function getNodeLabel(node: SourceNode): string {
  const kind = node.kind === 'text' ? '文本' : node.kind === 'image' ? '图片' : '视频'
  return node.title ?? `${kind}节点`
}

// Dark-panel textarea — explicit dark bg so browser cannot override with system white
const txClass = 'w-full resize-none rounded-lg border border-white/10 bg-[#1a1d26] px-3 py-2 text-[12px] leading-relaxed text-slate-100 placeholder:text-slate-500 outline-none focus:border-white/25'
const txSmClass = 'w-full resize-none rounded-lg border border-white/8 bg-[#1a1d26] px-3 py-1.5 text-[11px] leading-relaxed text-slate-200/75 placeholder:text-slate-500 outline-none focus:border-white/18'
const selClass = 'w-full rounded-lg border border-white/10 bg-[#1a1d26] px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-white/25'

export function ShotListBuilderPanel({
  nodes,
  initialNodeId,
  onCreateNode,
  onClose,
}: ShotListBuilderPanelProps) {
  const textNodes = nodes.filter((n) => getNodeText(n).length > 0)

  const firstId = initialNodeId && textNodes.find((n) => n.id === initialNodeId)
    ? initialNodeId
    : textNodes[0]?.id ?? ''

  // Split controls
  const [countPreset, setCountPreset] = useState<CountPreset | 'custom'>(5)
  const [customCountStr, setCustomCountStr] = useState('6')
  const [outputMode, setOutputMode] = useState<ShotListOptions['outputMode']>('mixed')
  const [pacing, setPacing] = useState<ShotListOptions['pacing']>('standard')
  const [strategy, setStrategy] = useState<ShotListOptions['shotSizeStrategy']>('auto')
  const [instruction, setInstruction] = useState('')

  const effectiveCount: number = countPreset === 'custom'
    ? Math.min(12, Math.max(1, parseInt(customCountStr, 10) || 5))
    : countPreset

  const buildOpts = useCallback((): ShotListOptions => ({
    shotCount: effectiveCount,
    outputMode,
    pacing,
    shotSizeStrategy: strategy,
    userInstruction: instruction,
  }), [effectiveCount, outputMode, pacing, strategy, instruction])

  // Shot list state
  const [selectedNodeId, setSelectedNodeId] = useState(firstId)
  const [shots, setShots] = useState<ShotDraft[]>(() => {
    const node = textNodes.find((n) => n.id === firstId)
    return node ? parseShotList(getNodeText(node), DEFAULT_SHOT_OPTIONS) : []
  })
  const [copyDone, setCopyDone] = useState(false)
  const [createdCount, setCreatedCount] = useState<number | null>(null)

  const selectedNode = textNodes.find((n) => n.id === selectedNodeId)

  const handleNodeChange = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    const node = textNodes.find((n) => n.id === nodeId)
    setShots(node ? parseShotList(getNodeText(node), buildOpts()) : [])
    setCreatedCount(null)
  }

  const handleReparse = () => {
    if (!selectedNode) return
    setShots(parseShotList(getNodeText(selectedNode), buildOpts()))
    setCreatedCount(null)
  }

  const patchShot = (id: string, patch: Partial<ShotDraft>) => {
    setShots((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s))
  }

  const toggleAll = (selected: boolean) => {
    setShots((prev) => prev.map((s) => ({ ...s, selected })))
  }

  const handleCopy = () => {
    const title = selectedNode ? getNodeLabel(selectedNode) : '未知来源'
    const report = buildShotListReport(shots, title, buildOpts())
    void navigator.clipboard.writeText(report).then(() => {
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2000)
    })
  }

  const handleCreate = () => {
    const toCreate = shots.filter((s) => s.selected)
    if (toCreate.length === 0) return
    toCreate.forEach((shot) => {
      const kindLabel = shot.kind === 'video' ? `视频 ${shot.duration}s` : '图片'
      const sizeLabel = SHOT_SIZE_LABELS[shot.shotSize]
      const title = `镜头 · ${sizeLabel} · ${kindLabel}`
      const prompt = `${shot.description}\n\n[${shot.cinematicNote}]`
      onCreateNode(shot.kind as VisualCanvasNodeKind, {
        title,
        prompt,
        parentNodeId: selectedNodeId || undefined,
      })
    })
    setCreatedCount(toCreate.length)
  }

  const selectedCount = shots.filter((s) => s.selected).length

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] flex max-h-[92vh] w-[500px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/96 shadow-2xl backdrop-blur-xl"
      data-no-node-drag="true"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/8 px-5 py-3.5">
        <span className="text-[13px]">🎬</span>
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-white/40">
          分镜清单生成器
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-white/30 transition hover:bg-white/6 hover:text-white/70"
          aria-label="关闭"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">

        {/* Source selector */}
        <div className="mb-4">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
            来源节点
          </label>
          {textNodes.length === 0 ? (
            <p className="rounded-lg border border-white/8 bg-white/3 px-3 py-3 text-[12px] text-white/40">
              画布中没有可用节点。请先创建一个文本节点并输入内容。
            </p>
          ) : (
            <select
              value={selectedNodeId}
              onChange={(e) => handleNodeChange(e.target.value)}
              className={selClass}
            >
              {textNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {getNodeLabel(n)}
                  {getNodeText(n).length > 0 ? ` — ${getNodeText(n).slice(0, 40)}…` : ''}
                </option>
              ))}
            </select>
          )}
          {selectedNode && getNodeText(selectedNode).length > 0 ? (
            <p className="mt-2 line-clamp-2 rounded-lg border border-white/6 bg-white/3 px-3 py-2 text-[11px] leading-relaxed text-white/40">
              {getNodeText(selectedNode).slice(0, 140)}
              {getNodeText(selectedNode).length > 140 ? '…' : ''}
            </p>
          ) : null}
        </div>

        {/* ── Split controls ── */}
        <div className="mb-4 rounded-xl border border-white/8 bg-white/2 px-4 py-3">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
            分镜拆分要求
          </p>

          <div className="mb-3 grid grid-cols-2 gap-3">
            {/* Shot count */}
            <div>
              <label className="mb-1.5 block text-[10px] text-white/40">分镜数量</label>
              <div className="flex items-center gap-1">
                {COUNT_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCountPreset(n)}
                    className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                      countPreset === n
                        ? 'bg-indigo-500/30 text-indigo-200'
                        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={countPreset === 'custom' ? customCountStr : ''}
                  placeholder="自定"
                  onFocus={() => setCountPreset('custom')}
                  onChange={(e) => { setCountPreset('custom'); setCustomCountStr(e.target.value) }}
                  className={`w-14 rounded border px-1.5 py-1 text-center text-[11px] font-medium outline-none transition ${
                    countPreset === 'custom'
                      ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-200 placeholder:text-indigo-400/50'
                      : 'border-white/10 bg-white/5 text-white/50 placeholder:text-white/25'
                  }`}
                />
              </div>
            </div>

            {/* Output mode */}
            <div>
              <label className="mb-1.5 block text-[10px] text-white/40">输出类型</label>
              <select
                value={outputMode}
                onChange={(e) => setOutputMode(e.target.value as ShotListOptions['outputMode'])}
                className={selClass}
              >
                {(Object.keys(OUTPUT_MODE_LABELS) as Array<ShotListOptions['outputMode']>).map((k) => (
                  <option key={k} value={k}>{OUTPUT_MODE_LABELS[k]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3">
            {/* Pacing */}
            <div>
              <label className="mb-1.5 block text-[10px] text-white/40">节奏</label>
              <select
                value={pacing}
                onChange={(e) => setPacing(e.target.value as ShotListOptions['pacing'])}
                className={selClass}
              >
                {(Object.keys(PACING_LABELS) as Array<ShotListOptions['pacing']>).map((k) => (
                  <option key={k} value={k}>{PACING_LABELS[k]}</option>
                ))}
              </select>
            </div>

            {/* Shot size strategy */}
            <div>
              <label className="mb-1.5 block text-[10px] text-white/40">景别策略</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as ShotListOptions['shotSizeStrategy'])}
                className={selClass}
              >
                {(Object.keys(STRATEGY_LABELS) as Array<ShotListOptions['shotSizeStrategy']>).map((k) => (
                  <option key={k} value={k}>{STRATEGY_LABELS[k]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* User instruction */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[10px] text-white/40">补充要求（可选）</label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              placeholder="例如：拆成 6 个镜头，前两镜是废墟环境，中间突出孩子堆城堡，最后用女人笑声做悬念。"
              className={txClass}
            />
          </div>

          <button
            type="button"
            onClick={handleReparse}
            disabled={textNodes.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/10 py-2 text-[12px] font-semibold text-indigo-300 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw size={13} strokeWidth={2.2} />
            按要求重新拆分
          </button>
        </div>

        {/* Shot list */}
        {shots.length > 0 ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                分镜清单（{shots.length} 镜）
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => toggleAll(true)}
                  className="text-[11px] text-white/35 transition hover:text-white/70"
                >
                  全选
                </button>
                <button
                  type="button"
                  onClick={() => toggleAll(false)}
                  className="text-[11px] text-white/35 transition hover:text-white/70"
                >
                  全不选
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {shots.map((shot, i) => (
                <div
                  key={shot.id}
                  className={`rounded-xl border px-4 py-3 transition ${
                    shot.selected
                      ? 'border-white/14 bg-white/5'
                      : 'border-white/6 bg-white/2 opacity-50'
                  }`}
                >
                  {/* Shot header row */}
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => patchShot(shot.id, { selected: !shot.selected })}
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                        shot.selected
                          ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-300'
                          : 'border-white/20 bg-transparent text-transparent'
                      }`}
                      aria-label={shot.selected ? '取消选择' : '选择'}
                    >
                      <Check size={10} strokeWidth={3} />
                    </button>

                    <span className="text-[10px] font-semibold text-white/40">镜头 {i + 1}</span>

                    {/* Kind toggle */}
                    <div className="ml-auto flex overflow-hidden rounded-md border border-white/10">
                      {(['image', 'video'] as ShotKind[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => patchShot(shot.id, { kind: k })}
                          className={`px-2 py-0.5 text-[10px] transition ${
                            shot.kind === k
                              ? 'bg-white/12 text-white/90'
                              : 'text-white/35 hover:text-white/60'
                          }`}
                        >
                          {k === 'image' ? '图片' : '视频'}
                        </button>
                      ))}
                    </div>

                    {/* Shot size */}
                    <select
                      value={shot.shotSize}
                      onChange={(e) => patchShot(shot.id, { shotSize: e.target.value as ShotSize })}
                      className="rounded-md border border-white/10 bg-[#1a1d26] px-1.5 py-0.5 text-[10px] text-slate-100 outline-none"
                    >
                      {SHOT_SIZE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>

                    {/* Duration — video only */}
                    {shot.kind === 'video' ? (
                      <select
                        value={shot.duration}
                        onChange={(e) => patchShot(shot.id, { duration: Number(e.target.value) as 5 | 10 })}
                        className="rounded-md border border-white/10 bg-[#1a1d26] px-1.5 py-0.5 text-[10px] text-slate-100 outline-none"
                      >
                        <option value={5}>5s</option>
                        <option value={10}>10s</option>
                      </select>
                    ) : null}
                  </div>

                  {/* Description textarea */}
                  <textarea
                    value={shot.description}
                    onChange={(e) => patchShot(shot.id, { description: e.target.value })}
                    rows={2}
                    placeholder="画面描述"
                    className={`mb-2 ${txClass}`}
                  />

                  {/* Cinematic note textarea */}
                  <textarea
                    value={shot.cinematicNote}
                    onChange={(e) => patchShot(shot.id, { cinematicNote: e.target.value })}
                    rows={1}
                    placeholder="镜头语言"
                    className={txSmClass}
                  />
                </div>
              ))}
            </div>
          </>
        ) : textNodes.length > 0 ? (
          <p className="rounded-lg border border-white/8 bg-white/3 px-3 py-3 text-center text-[12px] text-white/40">
            请选择来源节点后点击「按要求重新拆分」生成分镜清单。
          </p>
        ) : null}
      </div>

      {/* Footer */}
      {shots.length > 0 ? (
        <div className="border-t border-white/8 px-5 py-3.5">
          {createdCount !== null ? (
            <p className="mb-2.5 text-center text-[11px] text-emerald-400/80">
              已创建 {createdCount} 个草案节点
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-[12px] text-white/60 transition hover:bg-white/8 hover:text-white/90"
            >
              {copyDone ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2.2} />}
              <span>{copyDone ? '已复制' : '复制分镜清单'}</span>
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={selectedCount === 0}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600/80 px-4 py-2 text-[12px] font-semibold text-white/90 transition hover:bg-indigo-500/90 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>
                {selectedCount > 0 ? `创建 ${selectedCount} 个草案节点` : '请选择镜头'}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
