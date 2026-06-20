'use client'

import { useState, useCallback } from 'react'
import { RefreshCw, Check, RotateCcw, Trash2 } from 'lucide-react'
import {
  parseShotList,
  buildShotListReport,
  SHOT_SIZE_LABELS,
  DEFAULT_SHOT_OPTIONS,
} from '@/lib/canvas/shot-list'
import type { ShotDraft, ShotSize, ShotKind, ShotListOptions } from '@/lib/canvas/shot-list'
import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { VisualTagPicker } from '@/components/toolkit/VisualTagPicker'
import type { VisualTagOption } from '@/components/toolkit/VisualTagPicker'
import { DirectorToolPanelFrame } from '@/components/canvas/tools/DirectorToolPanelFrame'

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
  onCreateNode: (kind: VisualCanvasNodeKind, options: { title?: string; prompt?: string; parentNodeId?: string; index?: number; total?: number }) => string
  onAutoGenerateNodes?: (nodeIds: string[]) => void
  onClose: () => void
}

const OUTPUT_MODE_OPTIONS: VisualTagOption<ShotListOptions['outputMode']>[] = [
  { value: 'image', label: '纯图片', icon: '🖼' },
  { value: 'mixed', label: '图+视频', icon: '🎬' },
  { value: 'video', label: '纯视频', icon: '📹' },
]

const PACING_OPTIONS: VisualTagOption<ShotListOptions['pacing']>[] = [
  { value: 'slow_cinematic', label: '慢', sublabel: '电影感', icon: '🐢' },
  { value: 'standard', label: '标准', icon: '⚡' },
  { value: 'fast_social', label: '快', sublabel: '短视频', icon: '🚀' },
]

const STRATEGY_OPTIONS: VisualTagOption<ShotListOptions['shotSizeStrategy']>[] = [
  { value: 'auto', label: '自动', icon: '🎯' },
  { value: 'wide_to_close', label: '全→特', icon: '📐' },
  { value: 'close_heavy', label: '特写重', icon: '🔍' },
  { value: 'wide_heavy', label: '全景重', icon: '🌅' },
]

const SHOT_SIZE_VISUAL_OPTIONS: VisualTagOption<ShotSize>[] = [
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

// Shared class constants — explicit dark bg prevents browser system-theme override
const txClass = 'w-full resize-none rounded-lg border border-white/10 bg-[#1a1d26] px-3 py-2 text-[12px] leading-relaxed text-slate-100 placeholder:text-slate-500 outline-none focus:border-white/25'
const txSmClass = 'w-full resize-none rounded-lg border border-white/8 bg-[#1a1d26] px-3 py-1.5 text-[11px] leading-relaxed text-slate-200/75 placeholder:text-slate-500 outline-none focus:border-white/18'
const selClass = 'w-full rounded-lg border border-white/10 bg-[#1a1d26] px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-white/25'

export function ShotListBuilderPanel({
  nodes,
  initialNodeId,
  onCreateNode,
  onAutoGenerateNodes,
  onClose,
}: ShotListBuilderPanelProps) {
  // All nodes are usable as source (any with text content)
  const textNodes = nodes.filter((n) => getNodeText(n).length > 0)

  const firstId = initialNodeId && textNodes.find((n) => n.id === initialNodeId)
    ? initialNodeId
    : textNodes[0]?.id ?? ''

  const firstNodeText = textNodes.find((n) => n.id === firstId)
    ? getNodeText(textNodes.find((n) => n.id === firstId)!)
    : ''

  // ── Source state ──────────────────────────────────────────
  const [selectedNodeId, setSelectedNodeId] = useState(firstId)
  // Editable source text — initialized from node, but fully user-owned after that
  const [sourceDraftText, setSourceDraftText] = useState(firstNodeText)

  const selectedNode = textNodes.find((n) => n.id === selectedNodeId)

  const handleNodeChange = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    // Update the editable text to this node's content — user can still edit before reparting
    const node = textNodes.find((n) => n.id === nodeId)
    setSourceDraftText(node ? getNodeText(node) : '')
    setReparseError(null)
  }

  const handleRestoreNodeText = () => {
    const node = textNodes.find((n) => n.id === selectedNodeId)
    setSourceDraftText(node ? getNodeText(node) : '')
    setReparseError(null)
  }

  const handleClearSourceText = () => {
    setSourceDraftText('')
    setReparseError(null)
  }

  // ── Split controls ────────────────────────────────────────
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

  // ── Shot list state ───────────────────────────────────────
  const [shots, setShots] = useState<ShotDraft[]>(() =>
    firstNodeText ? parseShotList(firstNodeText, DEFAULT_SHOT_OPTIONS) : []
  )
  const [reparseError, setReparseError] = useState<string | null>(null)
  const [copyDone, setCopyDone] = useState(false)
  const [createdCount, setCreatedCount] = useState<number | null>(null)

  // ── Actions ───────────────────────────────────────────────
  const handleReparse = () => {
    if (!sourceDraftText.trim()) {
      setReparseError('请先输入或粘贴要拆分的文本。')
      return
    }
    setReparseError(null)
    setShots(parseShotList(sourceDraftText, buildOpts()))
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
    const report = buildShotListReport(shots, title, buildOpts(), sourceDraftText)
    void navigator.clipboard.writeText(report).then(() => {
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2000)
    })
  }

  const handleCreateAndGenerate = () => {
    const toCreate = shots.filter((s) => s.selected)
    if (toCreate.length === 0) return
    const createdIds: string[] = []
    toCreate.forEach((shot, index) => {
      const kindLabel = shot.kind === 'video' ? `视频 ${shot.duration}s` : '图片'
      const sizeLabel = SHOT_SIZE_LABELS[shot.shotSize]
      const title = `镜头 · ${sizeLabel} · ${kindLabel}`
      const prompt = `${shot.description}\n\n[${shot.cinematicNote}]`
      const nodeId = onCreateNode(shot.kind as VisualCanvasNodeKind, {
        title,
        prompt,
        parentNodeId: selectedNodeId || undefined,
        index,
        total: toCreate.length,
      })
      if (nodeId) createdIds.push(nodeId)
    })
    setCreatedCount(toCreate.length)
    if (createdIds.length > 0) onAutoGenerateNodes?.(createdIds)
  }

  const selectedCount = shots.filter((s) => s.selected).length

  const totalDurationSec = shots.reduce((sum, s) => sum + (s.kind === 'video' ? (s.duration || 0) : 0), 0)
  const durationStr = totalDurationSec > 0
    ? `总时长 ${String(Math.floor(totalDurationSec / 60)).padStart(2, '0')}:${String(totalDurationSec % 60).padStart(2, '0')}`
    : null
  const shotSummary = shots.length > 0
    ? [shots.length + ' 个镜头', durationStr].filter(Boolean).join(' · ')
    : undefined

  return (
    <div
      className="fixed inset-0 z-[1199] flex items-center justify-center bg-black/25"
      data-no-node-drag="true"
      onPointerDown={(e) => { e.stopPropagation(); onClose() }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onWheelCapture={(e) => e.stopPropagation()}
    >
      <DirectorToolPanelFrame
        icon="🎞"
        title="分镜表"
        titleEn="SHOT LIST"
        accentColor="violet"
        count={shots.length}
        summary={shotSummary}
        primaryLabel={selectedCount > 0 ? `生成全部镜头 (${selectedCount})` : '请选择镜头'}
        primaryDisabled={selectedCount === 0}
        onPrimary={handleCreateAndGenerate}
        onClear={shots.length > 0 ? handleCopy : undefined}
        clearLabel={copyDone ? '已复制' : '复制分镜清单'}
        onClose={onClose}
        ariaLabel="分镜表 / Shot List"
      >
      <div className="space-y-4">

        {/* ── A. 来源节点选择 ── */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
            A. 来源节点选择
          </label>
          {textNodes.length === 0 ? (
            <p className="rounded-lg border border-white/8 bg-white/3 px-3 py-3 text-[12px] text-white/40">
              画布中没有可用节点。请先创建文本节点并输入内容，或直接在下方粘贴文本。
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
                  {getNodeText(n).length > 0 ? ` — ${getNodeText(n).slice(0, 38)}…` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── B. 分镜文本输入（可编辑） ── */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
              B. 分镜文本输入
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRestoreNodeText}
                disabled={!selectedNode}
                className="flex items-center gap-1 text-[10px] text-white/35 transition hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
                title="恢复为来源节点文本"
              >
                <RotateCcw size={11} strokeWidth={2.2} />
                使用来源节点文本
              </button>
              <button
                type="button"
                onClick={handleClearSourceText}
                className="flex items-center gap-1 text-[10px] text-white/35 transition hover:text-white/70"
                title="清空"
              >
                <Trash2 size={11} strokeWidth={2.2} />
                清空
              </button>
            </div>
          </div>

          <textarea
            value={sourceDraftText}
            onChange={(e) => { setSourceDraftText(e.target.value); setReparseError(null) }}
            rows={7}
            placeholder="在这里粘贴剧本、故事梗概、广告脚本、短视频文案，或直接写你希望拆分的分镜内容……"
            className={txClass}
            style={{ minHeight: '160px' }}
          />

          <p className="mt-1.5 text-[10px] text-white/25">
            这里的修改只用于本次分镜拆分，不会改动原节点。点击「按要求重新拆分」后生效。
          </p>
        </div>

        {/* ── 分镜拆分要求 ── */}
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
              <VisualTagPicker
                options={OUTPUT_MODE_OPTIONS}
                value={outputMode}
                onChange={setOutputMode}
              />
            </div>
          </div>

          {/* Pacing */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[10px] text-white/40">节奏</label>
            <VisualTagPicker
              options={PACING_OPTIONS}
              value={pacing}
              onChange={setPacing}
            />
          </div>

          {/* Shot size strategy */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[10px] text-white/40">景别策略</label>
            <VisualTagPicker
              options={STRATEGY_OPTIONS}
              value={strategy}
              onChange={setStrategy}
            />
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

          {reparseError ? (
            <p className="mb-2 text-center text-[11px] text-amber-400/80">{reparseError}</p>
          ) : null}

          <button
            type="button"
            onClick={handleReparse}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/10 py-2 text-[12px] font-semibold text-indigo-300 transition hover:bg-indigo-500/20"
          >
            <RefreshCw size={13} strokeWidth={2.2} />
            按要求重新拆分
          </button>
        </div>

        {/* ── Shot list ── */}
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
                  <div className="mb-1.5 flex items-center gap-2">
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

                    {/* Duration — video only */}
                    {shot.kind === 'video' ? (
                      <div className="flex overflow-hidden rounded-md border border-white/10">
                        {([5, 10] as const).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => patchShot(shot.id, { duration: d })}
                            className={`px-2 py-0.5 text-[10px] transition ${
                              shot.duration === d
                                ? 'bg-white/12 text-white/90'
                                : 'text-white/35 hover:text-white/60'
                            }`}
                          >
                            {d}s
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {/* Shot size visual picker */}
                  <div className="mb-2">
                    <VisualTagPicker
                      size="sm"
                      options={SHOT_SIZE_VISUAL_OPTIONS}
                      value={shot.shotSize}
                      onChange={(v) => patchShot(shot.id, { shotSize: v })}
                    />
                  </div>

                  {/* Description */}
                  <textarea
                    value={shot.description}
                    onChange={(e) => patchShot(shot.id, { description: e.target.value })}
                    rows={2}
                    placeholder="画面描述"
                    className={`mb-2 ${txClass}`}
                  />

                  {/* Cinematic note */}
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
        ) : (
          <p className="rounded-lg border border-white/8 bg-white/3 px-3 py-3 text-center text-[12px] text-white/40">
            {sourceDraftText.trim()
              ? '点击「按要求重新拆分」生成分镜清单。'
              : '请先在上方输入或粘贴文本，再点击「按要求重新拆分」。'}
          </p>
        )}
        {createdCount !== null ? (
          <p className="mt-3 text-center text-[11px] text-emerald-400/80">
            已创建 {createdCount} 个草案节点
          </p>
        ) : null}
      </div>
      </DirectorToolPanelFrame>
    </div>
  )
}
