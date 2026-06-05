'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ArrowRight,
  Film,
  ImageIcon,
  Layers,
  Move,
  Play,
  Smartphone,
  Star,
  Sun,
  X,
  Zap,
} from 'lucide-react'
import { generateVariantPlans, parseAssetIntelligence } from '@/lib/canvas/asset-variant-planner'
import type { AssetVariantPlan, VariantIconKey } from '@/lib/canvas/asset-variant-planner'
import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'

interface AssetVariantPlannerPanelProps {
  node: VisualCanvasNode | null
  canvasPrompt: string
  canInsert: boolean
  onInsert: (text: string) => void
  onCreateNode: (kind: 'image' | 'video', title: string, prompt: string) => void
  onClose: () => void
}

// ─── icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<VariantIconKey, typeof Sun> = {
  sun: Sun,
  layers: Layers,
  zap: Zap,
  play: Play,
  star: Star,
  arrow: ArrowRight,
  phone: Smartphone,
  move: Move,
  film: Film,
  image: ImageIcon,
}

// ─── copy hook ────────────────────────────────────────────────────────────────

function useCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000)
    } catch {
      // clipboard unavailable — silent fail
    }
  }, [])
  return { copiedId, copy }
}

// ─── asset summary ────────────────────────────────────────────────────────────

function AssetSummary({ node, prompt }: { node: VisualCanvasNode; prompt: string }) {
  const hasImage = Boolean(node.resultImageUrl)
  const hasVideo = Boolean(node.resultVideoUrl)
  const hasAsset = Boolean(node.assetId || hasImage || hasVideo)
  const displayPrompt = (prompt || node.prompt || '').trim().slice(0, 90)

  return (
    <div className="border-b border-white/[0.07] px-4 py-3">
      <div className="flex gap-3">
        {/* Thumbnail */}
        {(hasImage || hasVideo) && (
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={node.resultImageUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Play size={16} className="text-white/30" />
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {node.kind === 'image' ? '图片节点' : node.kind === 'video' ? '视频节点' : '文本节点'}
            </span>
            {hasAsset && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                已有资产
              </span>
            )}
          </div>
          {displayPrompt ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/45">
              {displayPrompt}{displayPrompt.length === 90 ? '…' : ''}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-white/25">暂无 Prompt</p>
          )}
        </div>
      </div>

      {/* Asset protection notice */}
      {hasAsset ? (
        <p className="mt-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] px-2.5 py-1.5 text-[10px] leading-relaxed text-emerald-400/70">
          当前已有生成资产。变体规划不会覆盖或删除现有资产，只生成可复制 / 可追加 / 可新建节点的 Prompt 草案。
        </p>
      ) : (
        <p className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[10px] leading-relaxed text-white/35">
          当前尚未绑定生成资产，以下变体基于 Prompt 规划。生成一版资产后，变体会更准确。
        </p>
      )}
    </div>
  )
}

// ─── variant card ─────────────────────────────────────────────────────────────

function VariantCard({
  plan,
  canInsert,
  copiedId,
  onCopy,
  onInsert,
  onCreateNode,
}: {
  plan: AssetVariantPlan
  canInsert: boolean
  copiedId: string | null
  onCopy: (id: string, text: string) => void
  onInsert: (text: string) => void
  onCreateNode: (kind: 'image' | 'video', title: string, prompt: string) => void
}) {
  const Icon = ICON_MAP[plan.iconKey] ?? Layers
  const isCopied = copiedId === plan.id

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-white/50">
          <Icon size={14} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold leading-tight text-white/85">{plan.title}</p>
          <p className="mt-0.5 text-[10px] leading-snug text-white/40">{plan.description}</p>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-2 flex flex-wrap gap-1">
        {plan.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium text-white/40"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Prompt preview */}
      <div className="mt-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5">
        <p className="line-clamp-2 font-mono text-[10px] leading-relaxed text-white/40">
          {plan.promptDraft}
        </p>
      </div>

      {/* Actions */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => { void onCopy(plan.id, plan.promptDraft) }}
          className="inline-flex h-6 items-center rounded-md border border-white/10 bg-white/[0.05] px-2 text-[10px] font-medium text-white/55 transition hover:border-white/20 hover:text-white/80"
        >
          {isCopied ? '已复制' : '复制 Prompt'}
        </button>
        <button
          type="button"
          disabled={!canInsert}
          onClick={() => onInsert(plan.promptDraft)}
          title={!canInsert ? '打开节点对话框后可追加' : undefined}
          className="inline-flex h-6 items-center rounded-md border border-violet-500/25 bg-violet-500/[0.07] px-2 text-[10px] font-medium text-violet-300/80 transition hover:bg-violet-500/[0.14] disabled:cursor-not-allowed disabled:opacity-30"
        >
          追加 Prompt
        </button>
        <button
          type="button"
          onClick={() => onCreateNode(plan.recommendedNodeKind, plan.title, plan.promptDraft)}
          className={`inline-flex h-6 items-center rounded-md border px-2 text-[10px] font-medium transition ${
            plan.recommendedNodeKind === 'video'
              ? 'border-sky-500/25 bg-sky-500/[0.07] text-sky-300/80 hover:bg-sky-500/[0.14]'
              : 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300/80 hover:bg-emerald-500/[0.14]'
          }`}
        >
          + {plan.recommendedNodeKind === 'video' ? '视频' : '图片'}节点草案
        </button>
      </div>
    </div>
  )
}

// ─── main panel ───────────────────────────────────────────────────────────────

export function AssetVariantPlannerPanel({
  node,
  canvasPrompt,
  canInsert,
  onInsert,
  onCreateNode,
  onClose,
}: AssetVariantPlannerPanelProps) {
  const { copiedId, copy } = useCopy()

  const plans = useMemo(() => {
    if (!node) return []
    const prompt = (canvasPrompt || node.prompt || '').trim()
    const kind: 'text' | 'image' | 'video' =
      node.kind === 'image' ? 'image' : node.kind === 'video' ? 'video' : 'text'
    return generateVariantPlans({
      nodeKind: kind,
      prompt,
      hasAsset: Boolean(node.assetId || node.resultImageUrl || node.resultVideoUrl),
      assetIntelligence: parseAssetIntelligence(node.metadataJson),
    })
  }, [node, canvasPrompt])

  const isTextNode = node?.kind === 'text'

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] flex max-h-[88vh] w-[360px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/96 shadow-2xl backdrop-blur-xl"
      data-no-node-drag="true"
      data-smart-toolbar-panel="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/[0.07] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
            资产变体规划器
          </p>
          <h2 className="mt-1 text-sm font-semibold text-white/90">Variant Planner</h2>
          <p className="mt-0.5 text-[11px] text-white/40">
            {node ? `${node.title || '未命名节点'}` : '未选中节点'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white/80"
          aria-label="关闭变体规划器"
        >
          <X size={13} />
        </button>
      </div>

      {/* No node selected */}
      {!node ? (
        <div className="flex-1 px-5 py-8 text-center">
          <Layers size={28} className="mx-auto mb-3 text-white/15" />
          <p className="text-sm font-medium text-white/40">请先选择一个节点</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/25">
            点击画布上的图片或视频节点，工具将自动读取节点状态并生成变体规划。
          </p>
        </div>
      ) : (
        <>
          {/* Asset summary */}
          <AssetSummary node={node} prompt={canvasPrompt} />

          {/* Text node banner */}
          {isTextNode && (
            <div className="border-b border-amber-500/15 bg-amber-500/[0.05] px-4 py-2.5">
              <p className="text-[11px] leading-relaxed text-amber-400/70">
                变体规划器主要用于图片/视频资产。以下提供基于文本的图片草案建议，效果有限。
              </p>
            </div>
          )}

          {/* Variant cards */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-3">
              {plans.map((plan) => (
                <VariantCard
                  key={plan.id}
                  plan={plan}
                  canInsert={canInsert}
                  copiedId={copiedId}
                  onCopy={copy}
                  onInsert={onInsert}
                  onCreateNode={onCreateNode}
                />
              ))}
            </div>
          </div>

          {/* Footer safety note */}
          <div className="border-t border-white/[0.07] px-4 py-3">
            <p className="text-[10px] leading-relaxed text-white/25">
              本工具只规划变体方向，不会自动生成，不会消耗 credits，不会覆盖已有资产。新建节点草案需手动点击生成按钮才会生成。
            </p>
          </div>
        </>
      )}
    </div>
  )
}
