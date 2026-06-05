'use client'

import { useMemo, useState } from 'react'
import { Activity, Clapperboard, Link2, Palette, Stethoscope, Wand2 } from 'lucide-react'
import { checkReadiness } from '@/lib/canvas/readiness-check'
import type { OverallStatus, UserAccountLike } from '@/lib/canvas/readiness-check'
import { GenerateReadinessPanel } from '@/components/create/GenerateReadinessPanel'
import { CameraLexiconPanel } from '@/components/create/CameraLexiconPanel'
import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'

interface CanvasSmartToolbarProps {
  /** Node whose dialog is open — primary context for prompt append */
  editingNode: VisualCanvasNode | null
  /** Canvas-selected node (dialog may be closed) — used for read-only analysis */
  selectedNode: VisualCanvasNode | null
  canvasPrompt: string
  billingMode: 'platform_credits' | 'user_provider_account'
  selectedUserAccountId: string
  userProviderAccounts: UserAccountLike[]
  providerStatus: string | null | undefined
  projectId: string
  onPromptChange: (value: string) => void
}

// ─── status dot ──────────────────────────────────────────────────────────────

const DOT_CLASSES: Record<OverallStatus | 'no_node', string> = {
  no_node: 'bg-white/20',
  ready: 'bg-emerald-400',
  needs_attention: 'bg-amber-400',
  blocked: 'bg-red-400',
}

// ─── future tool stub ────────────────────────────────────────────────────────

function FutureTool({ icon: Icon, label }: { icon: typeof Activity; label: string }) {
  return (
    <div className="relative">
      <button
        type="button"
        disabled
        className="canvas-toolbar-button cursor-not-allowed opacity-25"
        title={`${label}（即将上线）`}
        aria-label={`${label}（即将上线）`}
      >
        <Icon size={20} strokeWidth={1.8} />
        <span className="canvas-hover-tooltip" aria-hidden="true">
          {label}（即将上线）
        </span>
      </button>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export function CanvasSmartToolbar({
  editingNode,
  selectedNode,
  canvasPrompt,
  billingMode,
  selectedUserAccountId,
  userProviderAccounts,
  providerStatus,
  projectId: _projectId,
  onPromptChange,
}: CanvasSmartToolbarProps) {
  const [readinessOpen, setReadinessOpen] = useState(false)
  const [lexiconOpen, setLexiconOpen] = useState(false)

  // The target node for analysis — prefer editingNode (dialog open), fall back to selectedNode
  const targetNode = editingNode ?? selectedNode
  const canAppendPrompt = editingNode !== null

  // Camera Lexicon is only applicable to image/video nodes
  const isLexiconApplicable = targetNode?.kind === 'image' || targetNode?.kind === 'video'

  // Guard: only run analysis for relevant node kinds
  const targetKind = targetNode?.kind
  const isAnalyzable =
    targetKind === 'text' || targetKind === 'image' || targetKind === 'video'

  const readinessResult = useMemo(() => {
    if (!targetNode || !isAnalyzable || targetKind === undefined) return null
    const kind = targetKind as 'text' | 'image' | 'video'
    return checkReadiness({
      nodeKind: kind,
      nodeTitle: targetNode.title || '',
      nodeId: targetNode.id,
      nodeStatus: targetNode.status || 'idle',
      prompt: canvasPrompt,
      providerId: targetNode.providerId || targetNode.model || '',
      providerStatus: providerStatus ?? undefined,
      billingMode,
      selectedUserAccountId,
      userProviderAccounts,
      resultImageUrl: targetNode.resultImageUrl,
      resultVideoUrl: targetNode.resultVideoUrl,
      resultText: 'resultText' in targetNode ? (targetNode as { resultText?: string }).resultText : undefined,
      assetId: targetNode.assetId,
      metadataJson: targetNode.metadataJson,
      projectId: _projectId,
    })
  }, [
    targetNode,
    isAnalyzable,
    targetKind,
    canvasPrompt,
    providerStatus,
    billingMode,
    selectedUserAccountId,
    userProviderAccounts,
    _projectId,
  ])

  const overallStatus: OverallStatus | 'no_node' = readinessResult?.overallStatus ?? 'no_node'

  const handlePromptAppend = (value: string) => {
    if (!canAppendPrompt) return
    const trimmed = canvasPrompt.trim()
    onPromptChange(trimmed ? `${trimmed}\n${value}` : value)
    setReadinessOpen(false)
  }

  const handleLexiconInsert = (fragment: string) => {
    if (!canAppendPrompt) return
    const trimmed = canvasPrompt.trim()
    onPromptChange(trimmed ? `${trimmed}, ${fragment}` : fragment)
  }

  return (
    <>
      {/* Right-side toolbar */}
      <div className="absolute right-6 top-1/2 z-[1100] -translate-y-1/2">
        <div className="canvas-toolbar-shell">
          <div className="flex flex-col gap-2">
            {/* Generate Readiness Check */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setReadinessOpen((o) => !o)
                  setLexiconOpen(false)
                }}
                className={`canvas-toolbar-button ${readinessOpen ? 'is-active' : ''}`}
                title="生成前体检"
                aria-label="生成前体检"
                aria-pressed={readinessOpen}
              >
                <Activity size={20} strokeWidth={1.8} />
                {/* Status dot */}
                <span
                  className={`pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#101117] ${DOT_CLASSES[overallStatus]}`}
                  aria-hidden="true"
                />
                <span className="canvas-hover-tooltip" aria-hidden="true">
                  生成前体检
                </span>
              </button>
            </div>

            {/* Tool 2: Camera Lexicon */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setLexiconOpen((o) => !o)
                  setReadinessOpen(false)
                }}
                className={`canvas-toolbar-button ${lexiconOpen ? 'is-active' : ''} ${!isLexiconApplicable ? 'opacity-40' : ''}`}
                title="镜头词典"
                aria-label="镜头词典"
                aria-pressed={lexiconOpen}
              >
                <Clapperboard size={20} strokeWidth={1.8} />
                <span className="canvas-hover-tooltip" aria-hidden="true">
                  镜头词典
                </span>
              </button>
            </div>

            <div className="canvas-toolbar-divider" />

            {/* Future tools — disabled */}
            <FutureTool icon={Stethoscope} label="镜头诊断" />
            <FutureTool icon={Wand2} label="提示词重写" />
            <FutureTool icon={Palette} label="风格提取" />
            <FutureTool icon={Link2} label="连贯性检查" />
          </div>
        </div>
      </div>

      {/* Readiness panel overlay */}
      {readinessOpen && (
        <>
          {/* Invisible backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-[1199]"
            aria-hidden="true"
            onPointerDown={() => setReadinessOpen(false)}
          />

          {readinessResult && targetNode && isAnalyzable ? (
            <GenerateReadinessPanel
              result={readinessResult}
              nodeTitle={targetNode.title || '未命名节点'}
              nodeKind={targetKind as 'text' | 'image' | 'video'}
              canAppendPrompt={canAppendPrompt}
              onPromptAppend={handlePromptAppend}
              onClose={() => setReadinessOpen(false)}
            />
          ) : (
            /* No node selected */
            <div
              className="fixed right-[80px] top-1/2 z-[1200] w-[280px] -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0f1117]/96 px-5 py-6 shadow-2xl backdrop-blur-xl"
              data-no-node-drag="true"
              data-smart-toolbar-panel="true"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
                生成前体检
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                请先点击一个文本、图片或视频节点，工具将自动读取节点状态进行分析。
              </p>
              <button
                type="button"
                onClick={() => setReadinessOpen(false)}
                className="mt-4 text-[11px] text-white/30 hover:text-white/55"
              >
                关闭
              </button>
            </div>
          )}
        </>
      )}

      {/* Camera Lexicon panel overlay */}
      {lexiconOpen && (
        <>
          {/* Invisible backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-[1199]"
            aria-hidden="true"
            onPointerDown={() => setLexiconOpen(false)}
          />

          {isLexiconApplicable && targetNode ? (
            <CameraLexiconPanel
              nodeKind={targetNode.kind as 'image' | 'video'}
              canInsert={canAppendPrompt}
              onInsert={handleLexiconInsert}
              onClose={() => setLexiconOpen(false)}
            />
          ) : (
            /* No applicable node selected */
            <div
              className="fixed right-[80px] top-1/2 z-[1200] w-[280px] -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0f1117]/96 px-5 py-6 shadow-2xl backdrop-blur-xl"
              data-no-node-drag="true"
              data-smart-toolbar-panel="true"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
                镜头词典
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                请先点击一个图片或视频节点，工具将显示可插入的专业镜头词汇。
              </p>
              <button
                type="button"
                onClick={() => setLexiconOpen(false)}
                className="mt-4 text-[11px] text-white/30 hover:text-white/55"
              >
                关闭
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
