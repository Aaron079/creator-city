'use client'

import { useState, useCallback } from 'react'
import type {
  ContNode,
  ContEdge,
  ContinuityReport,
  ContinuityIssue,
  CheckSeverity,
} from '@/lib/canvas/continuity-check'
import { analyzeContinuity, buildContinuityReportText } from '@/lib/canvas/continuity-check'

interface ContinuityCheckerPanelProps {
  nodes: ContNode[]
  edges: ContEdge[]
  onFocusNode: (nodeId: string) => void
  onClose: () => void
}

const SEVERITY_BADGE: Record<CheckSeverity, { label: string; cls: string }> = {
  pass: { label: 'PASS', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  info: { label: 'INFO', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  warn: { label: 'WARN', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  risk: { label: 'RISK', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const SECTION_DOT: Record<CheckSeverity, string> = {
  pass: 'bg-green-400',
  info: 'bg-blue-400',
  warn: 'bg-amber-400',
  risk: 'bg-red-400',
}

const SECTION_LABEL_COLOR: Record<CheckSeverity, string> = {
  pass: 'text-green-400',
  info: 'text-blue-400',
  warn: 'text-amber-400',
  risk: 'text-red-400',
}

const SEVERITY_SORT: Record<CheckSeverity, number> = { risk: 0, warn: 1, info: 2, pass: 3 }

function scoreTextColor(score: number): string {
  if (score >= 85) return 'text-green-400'
  if (score >= 70) return 'text-amber-400'
  if (score >= 50) return 'text-orange-400'
  return 'text-red-400'
}

function scoreRingClass(score: number): string {
  if (score >= 85) return 'border-green-400/60'
  if (score >= 70) return 'border-amber-400/60'
  if (score >= 50) return 'border-orange-400/60'
  return 'border-red-400/60'
}

export function ContinuityCheckerPanel({
  nodes,
  edges,
  onFocusNode,
  onClose,
}: ContinuityCheckerPanelProps) {
  const [report, setReport] = useState<ContinuityReport>(() => analyzeContinuity(nodes, edges))
  const [copied, setCopied] = useState(false)

  const runCheck = useCallback(() => {
    setReport(analyzeContinuity(nodes, edges))
  }, [nodes, edges])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildContinuityReportText(report))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // silently ignore clipboard failures
    }
  }, [report])

  const sortedIssues = [...report.issues].sort(
    (a, b) => SEVERITY_SORT[a.severity] - SEVERITY_SORT[b.severity],
  )

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] -translate-y-1/2 flex flex-col"
      style={{ width: 500, maxHeight: 'calc(100vh - 80px)' }}
      data-no-node-drag="true"
    >
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/97 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="text-[15px]">🔍</span>
            <span className="text-[13px] font-semibold text-white/90">连贯性检查器</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runCheck}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/60 transition hover:border-white/20 hover:bg-white/5 hover:text-white/80"
            >
              重新检查
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

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {/* Score row */}
          <div className="flex items-center gap-5 px-5 py-4">
            <div
              className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 ${scoreRingClass(report.overallScore)}`}
            >
              <span className={`text-2xl font-bold tabular-nums ${scoreTextColor(report.overallScore)}`}>
                {report.overallScore}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-white/80">{report.summary}</p>
              <p className="mt-1 text-[11px] text-white/35">
                已检查 {report.totalNodesChecked} 个节点 · WARN {report.warnCount} · RISK{' '}
                {report.riskCount} · INFO {report.infoCount}
              </p>
            </div>
          </div>

          {/* Section cards 2-col grid */}
          {report.sections.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 px-5 pb-3">
              {report.sections.map((sec) => (
                <div
                  key={sec.category}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${SECTION_DOT[sec.severity]}`}
                    />
                    <span
                      className={`text-[9px] font-bold uppercase tracking-widest ${SECTION_LABEL_COLOR[sec.severity]}`}
                    >
                      {sec.severity === 'pass'
                        ? 'PASS'
                        : sec.severity === 'info'
                          ? 'INFO'
                          : sec.severity === 'warn'
                            ? 'WARN'
                            : 'RISK'}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-white/85">{sec.label}</p>
                  <p className="mt-0.5 text-[10px] text-white/45">{sec.summary}</p>
                </div>
              ))}
            </div>
          ) : null}

          {/* Not enough nodes state */}
          {report.totalNodesChecked < 2 ? (
            <div className="px-5 pb-5 text-center">
              <p className="text-[12px] text-white/45">
                需要至少 2 个带内容的节点才能进行连贯性分析。
              </p>
              <p className="mt-1 text-[11px] text-white/30">
                请添加文本、图片或视频节点并填入描述后重试。
              </p>
            </div>
          ) : null}

          {/* Issues list */}
          {sortedIssues.length > 0 ? (
            <div className="border-t border-white/10 px-5 pb-4 pt-3">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                问题详情 ({sortedIssues.length})
              </p>
              <div className="flex flex-col gap-2.5">
                {sortedIssues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} onFocusNode={onFocusNode} />
                ))}
              </div>
            </div>
          ) : report.totalNodesChecked >= 2 ? (
            <div className="border-t border-white/10 px-5 pb-4 pt-4 text-center">
              <p className="text-[12px] text-green-400">未发现连贯性问题，画布结构良好。</p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
          <p className="text-[10px] text-white/25">只读分析 · 不自动生成 · 不消耗 credits</p>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-white/10 px-3 py-1 text-[11px] text-white/60 transition hover:border-white/20 hover:bg-white/5 hover:text-white/80"
          >
            {copied ? '已复制' : '复制检查报告'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface IssueCardProps {
  issue: ContinuityIssue
  onFocusNode: (nodeId: string) => void
}

function IssueCard({ issue, onFocusNode }: IssueCardProps) {
  const badge = SEVERITY_BADGE[issue.severity]
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badge.cls}`}
        >
          {badge.label}
        </span>
        <span className="text-[12px] font-medium text-white/85">{issue.title}</span>
      </div>
      <p className="mb-1.5 text-[11px] leading-relaxed text-white/55">{issue.description}</p>
      {issue.suggestion ? (
        <p className="mb-2 text-[11px] text-white/40">
          <span className="text-white/25">建议：</span>
          {issue.suggestion}
        </p>
      ) : null}
      {issue.canJumpToNode && issue.affectedNodeIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {issue.affectedNodeIds.map((nodeId) => (
            <button
              key={nodeId}
              type="button"
              onClick={() => onFocusNode(nodeId)}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/50 transition hover:border-white/20 hover:bg-white/10 hover:text-white/75"
            >
              定位节点
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
