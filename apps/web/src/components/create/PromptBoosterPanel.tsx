'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type {
  PromptBoostNode,
  PromptBoostReport,
  PromptBoostSuggestion,
  PromptBoostCheckStatus,
  PromptBoostSeverity,
} from '@/lib/canvas/prompt-booster'
import {
  analyzePromptBoost,
  buildPromptBoostReportText,
  getBoostPromptText,
  isBoostableNode,
  textAlreadyContains,
} from '@/lib/canvas/prompt-booster'
import { DirectorToolPanelFrame, type DirectorSourceNode } from '@/components/canvas/tools/DirectorToolPanelFrame'

interface PromptBoosterPanelProps {
  nodes: PromptBoostNode[]
  initialNodeId?: string
  onAppendPrompt: (nodeId: string, appendText: string) => void
  onCreateDerived?: (nodeId: string, appendText: string, suggestionTitle?: string) => void
  onClose: () => void
  sourceNode?: DirectorSourceNode | null
}

const CHECK_STATUS_BADGE: Record<PromptBoostCheckStatus, { label: string; cls: string }> = {
  pass: { label: 'PASS', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  warn: { label: 'WARN', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  missing: { label: 'MISSING', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const SEVERITY_LABEL: Record<PromptBoostSeverity, { text: string; cls: string }> = {
  important: { text: '重要', cls: 'text-amber-400' },
  useful: { text: '建议', cls: 'text-blue-400' },
  optional: { text: '可选', cls: 'text-white/35' },
}

const KIND_LABEL: Record<string, string> = {
  image: '图片节点',
  video: '视频节点',
  text: '文本节点',
}

function scoreTextColor(score: number): string {
  if (score >= 80) return 'text-green-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function scoreRingClass(score: number): string {
  if (score >= 80) return 'border-green-400/60'
  if (score >= 50) return 'border-amber-400/60'
  return 'border-red-400/60'
}

function scoreBadge(score: number): { text: string; cls: string } {
  if (score >= 80) return { text: '结构较完整', cls: 'bg-green-500/15 text-green-400' }
  if (score >= 50) return { text: '建议增强', cls: 'bg-amber-500/15 text-amber-400' }
  return { text: '缺少关键描述', cls: 'bg-red-500/15 text-red-400' }
}

function runAnalysis(node: PromptBoostNode | null): PromptBoostReport | null {
  if (!node) return null
  const prompt = getBoostPromptText(node)
  if (!prompt.trim()) return null
  return analyzePromptBoost({
    kind: node.kind as 'text' | 'image' | 'video',
    prompt,
    providerId: node.providerId,
    model: node.model,
  })
}

export function PromptBoosterPanel({
  nodes,
  initialNodeId,
  onAppendPrompt,
  onCreateDerived,
  onClose,
  sourceNode,
}: PromptBoosterPanelProps) {
  const supportedNodes = useMemo(() => nodes.filter(isBoostableNode), [nodes])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
    const preferred = supportedNodes.find((n) => n.id === initialNodeId)
    return preferred?.id ?? supportedNodes[0]?.id ?? null
  })

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const [report, setReport] = useState<PromptBoostReport | null>(() => runAnalysis(selectedNode))
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [alreadyExistsId, setAlreadyExistsId] = useState<string | null>(null)
  const [copiedReport, setCopiedReport] = useState(false)
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null)

  useEffect(() => {
    const node = nodes.find((n) => n.id === selectedNodeId) ?? null
    setReport(runAnalysis(node))
    setDismissed(new Set())
    setAlreadyExistsId(null)
    setCopiedId(null)
    setSelectedSuggestionId(null)
  }, [selectedNodeId, nodes])

  const handleReanalyze = useCallback(() => {
    const node = nodes.find((n) => n.id === selectedNodeId) ?? null
    setReport(runAnalysis(node))
    setDismissed(new Set())
    setAlreadyExistsId(null)
    setCopiedId(null)
    setSelectedSuggestionId(null)
  }, [selectedNodeId, nodes])

  const handleCopySuggestion = useCallback(async (sugg: PromptBoostSuggestion) => {
    try {
      await navigator.clipboard.writeText(sugg.appendText)
      setCopiedId(sugg.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // ignore clipboard errors
    }
  }, [])

  const handleDirectAppend = useCallback(
    (sugg: PromptBoostSuggestion) => {
      if (!selectedNodeId) return
      const node = nodes.find((n) => n.id === selectedNodeId)
      if (!node) return
      const currentPrompt = getBoostPromptText(node)
      if (textAlreadyContains(currentPrompt, sugg.appendText)) {
        setAlreadyExistsId(sugg.id)
        setTimeout(() => setAlreadyExistsId(null), 2500)
        return
      }
      onAppendPrompt(selectedNodeId, sugg.appendText)
    },
    [selectedNodeId, nodes, onAppendPrompt],
  )

  const handleCreateDerived = useCallback(() => {
    if (!selectedNodeId || !selectedSuggestionId || !onCreateDerived) return
    const sugg = report?.suggestions.find((s) => s.id === selectedSuggestionId)
    if (!sugg) return
    const node = nodes.find((n) => n.id === selectedNodeId)
    if (!node) return
    const currentPrompt = getBoostPromptText(node)
    if (textAlreadyContains(currentPrompt, sugg.appendText)) {
      setAlreadyExistsId(sugg.id)
      setTimeout(() => setAlreadyExistsId(null), 2500)
      return
    }
    onCreateDerived(selectedNodeId, sugg.appendText, sugg.title)
  }, [selectedNodeId, selectedSuggestionId, report, nodes, onCreateDerived])

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]))
    if (selectedSuggestionId === id) setSelectedSuggestionId(null)
  }, [selectedSuggestionId])

  const handleCopyReport = useCallback(async () => {
    if (!report || !selectedNode) return
    const promptText = getBoostPromptText(selectedNode)
    const text = buildPromptBoostReportText(report, promptText, selectedNode.kind)
    try {
      await navigator.clipboard.writeText(text)
      setCopiedReport(true)
      setTimeout(() => setCopiedReport(false), 2000)
    } catch {
      // ignore clipboard errors
    }
  }, [report, selectedNode])

  const visibleSuggestions = report?.suggestions.filter((s) => !dismissed.has(s.id)) ?? []
  const promptPreview = selectedNode ? getBoostPromptText(selectedNode) : ''
  const selectedSuggestion = selectedSuggestionId
    ? report?.suggestions.find((s) => s.id === selectedSuggestionId) ?? null
    : null
  const summaryText = selectedSuggestion?.title ?? ''

  return (
    <div
      className="fixed inset-0 z-[1199] flex items-end justify-center bg-black/25 sm:items-center"
      role="presentation"
      data-no-node-drag="true"
      onPointerDown={(e) => { e.stopPropagation(); onClose() }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onWheelCapture={(e) => e.stopPropagation()}
    >
      <DirectorToolPanelFrame
        title="提示词增强"
        titleEn="Prompt Booster"
        icon="✨"
        accentColor="violet"
        count={selectedSuggestion ? 1 : 0}
        summary={summaryText || undefined}
        sourceNode={sourceNode}
        primaryLabel="创建增强版本"
        primaryDisabled={!selectedSuggestionId || !onCreateDerived}
        onPrimary={handleCreateDerived}
        onClear={selectedSuggestionId ? () => setSelectedSuggestionId(null) : undefined}
        onClose={onClose}
        ariaLabel="提示词增强 / Prompt Booster"
      >
        {supportedNodes.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[13px] text-white/45">请选择一个包含 Prompt 或文本内容的节点。</p>
            <p className="mt-1 text-[11px] text-white/25">文本、图片、视频节点均可检查。</p>
          </div>
        ) : (
          <>
            {/* Node picker */}
            <div className="mb-4">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
                分析节点
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedNodeId ?? ''}
                  onChange={(e) => setSelectedNodeId(e.target.value || null)}
                  className="flex-1 rounded-lg border border-white/10 bg-[#1a1d26] px-3 py-1.5 text-[12px] text-slate-100 outline-none focus:border-white/25"
                >
                  {supportedNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {KIND_LABEL[n.kind] ?? n.kind}
                      {n.title ? ` — ${n.title.slice(0, 28)}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleReanalyze}
                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/60 transition hover:border-white/20 hover:bg-white/5 hover:text-white/80"
                >
                  重新分析
                </button>
              </div>
            </div>

            {/* Node summary */}
            {selectedNode && (
              <div className="mb-4 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
                    {KIND_LABEL[selectedNode.kind] ?? selectedNode.kind}
                  </span>
                  {(selectedNode.providerId ?? selectedNode.model) ? (
                    <span className="text-[10px] text-white/30">
                      {[selectedNode.providerId, selectedNode.model].filter(Boolean).join(' / ')}
                    </span>
                  ) : null}
                </div>
                {promptPreview ? (
                  <p className="text-[11px] leading-relaxed text-white/55 line-clamp-2">
                    {promptPreview.slice(0, 160)}{promptPreview.length > 160 ? '…' : ''}
                  </p>
                ) : (
                  <p className="text-[11px] text-white/30">（无 Prompt 内容）</p>
                )}
              </div>
            )}

            {/* Score card */}
            {report ? (
              <>
                <div className="mb-4 flex items-center gap-4 rounded-lg border border-white/[0.07] bg-white/[0.025] px-4 py-4">
                  <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 ${scoreRingClass(report.score)}`}>
                    <span className={`text-xl font-bold tabular-nums ${scoreTextColor(report.score)}`}>
                      {report.score}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] font-medium text-white/60">Prompt 完整度</span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${scoreBadge(report.score).cls}`}>
                        {scoreBadge(report.score).text}
                      </span>
                    </div>
                    <p className="text-[12px] text-white/75">{report.summary}</p>
                  </div>
                </div>

                {/* Check list */}
                <div className="mb-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                    检查清单 ({report.checks.length})
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {report.checks.map((check) => {
                      const badge = CHECK_STATUS_BADGE[check.status]
                      return (
                        <div key={check.id} className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                          <span className={`mt-0.5 flex-shrink-0 rounded border px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider ${badge.cls}`}>
                            {badge.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-white/80">{check.label}</p>
                            <p className="text-[10px] text-white/45">{check.description}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Suggestions */}
                {visibleSuggestions.length > 0 ? (
                  <div>
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                      增强建议 ({visibleSuggestions.length}) — 选择一条后点击「创建增强版本」
                    </p>
                    <div className="flex flex-col gap-3">
                      {visibleSuggestions.map((sugg) => (
                        <SuggestionCard
                          key={sugg.id}
                          suggestion={sugg}
                          isCopied={copiedId === sugg.id}
                          alreadyExists={alreadyExistsId === sugg.id}
                          isSelected={selectedSuggestionId === sugg.id}
                          hasDerivedMode={Boolean(onCreateDerived)}
                          onCopy={handleCopySuggestion}
                          onDirectAppend={handleDirectAppend}
                          onSelect={(id) => setSelectedSuggestionId((prev) => prev === id ? null : id)}
                          onDismiss={handleDismiss}
                        />
                      ))}
                    </div>
                  </div>
                ) : report.suggestions.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-[12px] text-green-400">Prompt 结构良好，暂无增强建议。</p>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-[11px] text-white/30">所有建议已被忽略。点击「重新分析」重置。</p>
                  </div>
                )}

                {/* Copy report */}
                {selectedNode ? (
                  <div className="mt-4 border-t border-white/[0.07] pt-3">
                    <button
                      type="button"
                      onClick={handleCopyReport}
                      className="text-[10px] text-white/30 transition hover:text-white/55"
                    >
                      {copiedReport ? '✓ 已复制检查报告' : '复制检查报告'}
                    </button>
                    <p className="mt-1 text-[10px] text-white/20">只读分析 · 不自动生成 · 不消耗 credits</p>
                  </div>
                ) : null}
              </>
            ) : selectedNode && !promptPreview ? (
              <div className="py-8 text-center">
                <p className="text-[12px] text-white/45">该节点暂无 Prompt 内容，无法分析。</p>
              </div>
            ) : null}
          </>
        )}
      </DirectorToolPanelFrame>
    </div>
  )
}

interface SuggestionCardProps {
  suggestion: PromptBoostSuggestion
  isCopied: boolean
  alreadyExists: boolean
  isSelected: boolean
  hasDerivedMode: boolean
  onCopy: (sugg: PromptBoostSuggestion) => void
  onDirectAppend: (sugg: PromptBoostSuggestion) => void
  onSelect: (id: string) => void
  onDismiss: (id: string) => void
}

function SuggestionCard({
  suggestion: sugg,
  isCopied,
  alreadyExists,
  isSelected,
  hasDerivedMode,
  onCopy,
  onDirectAppend,
  onSelect,
  onDismiss,
}: SuggestionCardProps) {
  const sev = SEVERITY_LABEL[sugg.severity]
  return (
    <div className={`rounded-xl border p-3 transition ${
      isSelected
        ? 'border-violet-500/40 bg-violet-500/[0.06]'
        : 'border-white/10 bg-white/5'
    }`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-white/85">{sugg.title}</span>
          <span className={`text-[9px] font-semibold ${sev.cls}`}>{sev.text}</span>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(sugg.id)}
          className="text-[10px] text-white/25 transition hover:text-white/50"
        >
          忽略
        </button>
      </div>
      <p className="mb-2 text-[11px] text-white/50">{sugg.reason}</p>
      <div className="mb-2.5 rounded-lg border border-white/10 bg-[#1a1d26] px-3 py-2">
        <p className="font-mono text-[10px] leading-relaxed text-slate-300">{sugg.appendText}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onCopy(sugg)}
          className="flex-1 rounded-lg border border-white/10 py-1 text-[11px] text-white/55 transition hover:border-white/20 hover:bg-white/5 hover:text-white/80"
        >
          {isCopied ? '已复制' : '复制片段'}
        </button>
        {hasDerivedMode ? (
          <button
            type="button"
            onClick={() => onSelect(sugg.id)}
            className={`flex-1 rounded-lg border py-1 text-[11px] transition ${
              alreadyExists
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                : isSelected
                  ? 'border-violet-500/50 bg-violet-500/[0.15] text-violet-200'
                  : 'border-violet-500/30 bg-violet-500/[0.08] text-violet-300 hover:bg-violet-500/[0.15]'
            }`}
          >
            {alreadyExists ? '已存在类似片段' : isSelected ? '✓ 已选择' : '选择此建议'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onDirectAppend(sugg)}
            className={`flex-1 rounded-lg border py-1 text-[11px] transition ${
              alreadyExists
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                : 'border-white/10 text-white/55 hover:border-white/20 hover:bg-white/5 hover:text-white/80'
            }`}
          >
            {alreadyExists ? '已存在类似片段' : '追加到 Prompt'}
          </button>
        )}
      </div>
    </div>
  )
}
