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

interface PromptBoosterPanelProps {
  nodes: PromptBoostNode[]
  initialNodeId?: string
  onAppendPrompt: (nodeId: string, appendText: string) => void
  onClose: () => void
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
  onClose,
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

  const [report, setReport] = useState<PromptBoostReport | null>(() =>
    runAnalysis(selectedNode),
  )
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [alreadyExistsId, setAlreadyExistsId] = useState<string | null>(null)
  const [copiedReport, setCopiedReport] = useState(false)

  // Re-run analysis when selected node changes
  useEffect(() => {
    const node = nodes.find((n) => n.id === selectedNodeId) ?? null
    setReport(runAnalysis(node))
    setDismissed(new Set())
    setAlreadyExistsId(null)
    setCopiedId(null)
  }, [selectedNodeId, nodes])

  const handleReanalyze = useCallback(() => {
    const node = nodes.find((n) => n.id === selectedNodeId) ?? null
    setReport(runAnalysis(node))
    setDismissed(new Set())
    setAlreadyExistsId(null)
    setCopiedId(null)
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

  const handleAppend = useCallback(
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

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]))
  }, [])

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

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] -translate-y-1/2 flex flex-col"
      style={{ width: 500, maxHeight: 'calc(100vh - 80px)' }}
      data-no-node-drag="true"
    >
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/97 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-3.5">
          <div className="min-w-0 flex-1 pr-3">
            <div className="flex items-center gap-2">
              <span className="text-[15px]">✨</span>
              <span className="text-[13px] font-semibold text-white/90">提示词增强器</span>
            </div>
            <p className="mt-0.5 text-[10px] leading-snug text-white/30">
              检查当前节点 Prompt 是否完整并给出可选增强片段。不自动改写，不自动生成，不消耗 credits。
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleReanalyze}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/60 transition hover:border-white/20 hover:bg-white/5 hover:text-white/80"
            >
              重新分析
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-white/70"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {/* Node selector */}
          {supportedNodes.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] text-white/45">请选择一个包含 Prompt 或文本内容的节点。</p>
              <p className="mt-1 text-[11px] text-white/25">
                文本、图片、视频节点均可检查。
              </p>
            </div>
          ) : (
            <>
              {/* Node picker */}
              <div className="border-b border-white/10 px-5 py-3">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  选择节点
                </label>
                <select
                  value={selectedNodeId ?? ''}
                  onChange={(e) => setSelectedNodeId(e.target.value || null)}
                  className="w-full rounded-lg border border-white/10 bg-[#1a1d26] px-3 py-1.5 text-[12px] text-slate-100 outline-none focus:border-white/25"
                >
                  {supportedNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {KIND_LABEL[n.kind] ?? n.kind}
                      {n.title ? ` — ${n.title.slice(0, 28)}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Node summary */}
              {selectedNode && (
                <div className="border-b border-white/10 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
                      {KIND_LABEL[selectedNode.kind] ?? selectedNode.kind}
                    </span>
                    {(selectedNode.providerId ?? selectedNode.model) ? (
                      <span className="text-[10px] text-white/30">
                        {[selectedNode.providerId, selectedNode.model].filter(Boolean).join(' / ')}
                      </span>
                    ) : null}
                    {selectedNode.status ? (
                      <span className="text-[10px] text-white/30">{selectedNode.status}</span>
                    ) : null}
                  </div>
                  {promptPreview ? (
                    <p className="text-[11px] leading-relaxed text-white/55 line-clamp-3">
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
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div
                      className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 ${scoreRingClass(report.score)}`}
                    >
                      <span className={`text-2xl font-bold tabular-nums ${scoreTextColor(report.score)}`}>
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
                  <div className="border-t border-white/10 px-5 pb-3 pt-3">
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
                    <div className="border-t border-white/10 px-5 pb-4 pt-3">
                      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                        增强建议 ({visibleSuggestions.length})
                      </p>
                      <div className="flex flex-col gap-3">
                        {visibleSuggestions.map((sugg) => (
                          <SuggestionCard
                            key={sugg.id}
                            suggestion={sugg}
                            isCopied={copiedId === sugg.id}
                            alreadyExists={alreadyExistsId === sugg.id}
                            onCopy={handleCopySuggestion}
                            onAppend={handleAppend}
                            onDismiss={handleDismiss}
                          />
                        ))}
                      </div>
                    </div>
                  ) : report.suggestions.length === 0 ? (
                    <div className="border-t border-white/10 px-5 pb-4 pt-4 text-center">
                      <p className="text-[12px] text-green-400">Prompt 结构良好，暂无增强建议。</p>
                    </div>
                  ) : (
                    <div className="border-t border-white/10 px-5 pb-4 pt-4 text-center">
                      <p className="text-[11px] text-white/30">所有建议已被忽略。点击「重新分析」重置。</p>
                    </div>
                  )}
                </>
              ) : selectedNode && !promptPreview ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-[12px] text-white/45">该节点暂无 Prompt 内容，无法分析。</p>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
          <p className="text-[10px] text-white/25">只读分析 · 不自动生成 · 不消耗 credits</p>
          {report && selectedNode ? (
            <button
              type="button"
              onClick={handleCopyReport}
              className="rounded-lg border border-white/10 px-3 py-1 text-[11px] text-white/60 transition hover:border-white/20 hover:bg-white/5 hover:text-white/80"
            >
              {copiedReport ? '已复制' : '复制检查报告'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

interface SuggestionCardProps {
  suggestion: PromptBoostSuggestion
  isCopied: boolean
  alreadyExists: boolean
  onCopy: (sugg: PromptBoostSuggestion) => void
  onAppend: (sugg: PromptBoostSuggestion) => void
  onDismiss: (id: string) => void
}

function SuggestionCard({
  suggestion: sugg,
  isCopied,
  alreadyExists,
  onCopy,
  onAppend,
  onDismiss,
}: SuggestionCardProps) {
  const sev = SEVERITY_LABEL[sugg.severity]
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
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
        <button
          type="button"
          onClick={() => onAppend(sugg)}
          className={`flex-1 rounded-lg border py-1 text-[11px] transition ${
            alreadyExists
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : 'border-white/10 text-white/55 hover:border-white/20 hover:bg-white/5 hover:text-white/80'
          }`}
        >
          {alreadyExists ? '已存在类似片段' : '追加到 Prompt'}
        </button>
      </div>
    </div>
  )
}
