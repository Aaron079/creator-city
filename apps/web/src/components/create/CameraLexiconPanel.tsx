'use client'

import { useState } from 'react'
import { LEXICON_CATEGORIES, buildLexiconFragment, buildCameraLexiconSummaryText } from '@/lib/canvas/camera-lexicon'
import type { LexiconCategory, LexiconTerm } from '@/lib/canvas/camera-lexicon'
import { DirectorToolPanelFrame, type DirectorSourceNode } from '@/components/canvas/tools/DirectorToolPanelFrame'

interface CameraLexiconPanelProps {
  nodeKind: 'image' | 'video'
  canInsert: boolean
  onInsert: (fragment: string) => void
  onCreateDerived?: (fragment: string, selectedLabels: string[]) => void
  onClose: () => void
  workflowTargetNodeTitle?: string
  sourceNode?: DirectorSourceNode | null
}

function TermButton({
  term,
  selected,
  onToggle,
}: {
  term: LexiconTerm
  selected: boolean
  onToggle: (term: LexiconTerm) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(term)}
      className={`flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition ${
        selected
          ? 'border-violet-500/40 bg-violet-500/[0.1] text-violet-200'
          : 'border-white/[0.07] bg-white/[0.02] text-white/60 hover:border-white/20 hover:bg-white/[0.04] hover:text-white/80'
      }`}
    >
      {term.icon ? <span className="mb-1 text-[18px] leading-none">{term.icon}</span> : null}
      <span className="text-[12px] font-semibold leading-tight">{term.zhLabel}</span>
      <span className={`text-[10px] leading-tight ${selected ? 'text-violet-300/60' : 'text-white/25'}`}>
        {term.enLabel}
      </span>
    </button>
  )
}

export function CameraLexiconPanel({
  nodeKind,
  canInsert,
  onInsert,
  onCreateDerived,
  onClose,
  workflowTargetNodeTitle,
  sourceNode,
}: CameraLexiconPanelProps) {
  const [activeCategory, setActiveCategory] = useState<string>('shotSize')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const currentCategory = (
    LEXICON_CATEGORIES.find((c) => c.key === activeCategory) ?? LEXICON_CATEGORIES[0]
  ) as LexiconCategory
  const allTerms = LEXICON_CATEGORIES.flatMap((c) => c.terms)
  const selectedTerms = selectedIds
    .map((id) => allTerms.find((t) => t.id === id))
    .filter((t): t is LexiconTerm => t !== undefined)
  const fragment = buildLexiconFragment(selectedIds)
  const summary = buildCameraLexiconSummaryText(selectedTerms.map((t) => t.zhLabel))

  const filteredTerms = currentCategory.terms.filter(
    (t) => t.bestFor === 'both' || t.bestFor === nodeKind,
  )

  const toggleTerm = (term: LexiconTerm) => {
    setSelectedIds((prev) =>
      prev.includes(term.id) ? prev.filter((id) => id !== term.id) : [...prev, term.id],
    )
  }

  const isWorkflow = Boolean(workflowTargetNodeTitle)
  const canActuallyInsert = canInsert || isWorkflow
  const insertLabel = isWorkflow ? `插入到「${workflowTargetNodeTitle}」Prompt` : '插入 Prompt'

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
        title="镜头词典"
        titleEn="Camera Lexicon"
        icon="🎬"
        accentColor="violet"
        count={selectedIds.length}
        summary={summary || undefined}
        sourceNode={sourceNode}
        primaryLabel="创建镜头版本"
        primaryDisabled={!fragment || !onCreateDerived}
        onPrimary={() => {
          if (fragment && onCreateDerived) {
            onCreateDerived(fragment, selectedTerms.map((t) => t.zhLabel))
          }
        }}
        onClear={selectedIds.length > 0 ? () => setSelectedIds([]) : undefined}
        onClose={onClose}
        ariaLabel="镜头词典 / Camera Lexicon"
      >
        {/* Category tabs */}
        <div className="mb-4 flex gap-1 overflow-x-auto">
          {LEXICON_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`flex shrink-0 items-center rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                activeCategory === cat.key
                  ? 'border border-violet-500/30 bg-violet-500/20 text-violet-300'
                  : 'border border-transparent text-white/40 hover:border-white/10 hover:text-white/60'
              }`}
            >
              {cat.zhTitle}
            </button>
          ))}
        </div>

        {/* Term grid */}
        <p className="mb-2 text-[10px] text-white/25">{currentCategory.enTitle}</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
          {filteredTerms.map((term) => (
            <TermButton
              key={term.id}
              term={term}
              selected={selectedIds.includes(term.id)}
              onToggle={toggleTerm}
            />
          ))}
          {filteredTerms.length === 0 && (
            <p className="col-span-4 py-4 text-center text-[11px] text-white/30">
              该分类暂无适用于{nodeKind === 'image' ? '图片' : '视频'}节点的词汇
            </p>
          )}
        </div>

        {/* Selected chips */}
        {selectedTerms.length > 0 && (
          <div className="mt-4 border-t border-white/[0.07] pt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
              已选 {selectedTerms.length} 项
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedTerms.map((term) => (
                <button
                  key={term.id}
                  type="button"
                  onClick={() => toggleTerm(term)}
                  title="点击取消"
                  className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/[0.08] px-2 py-0.5 text-[10px] font-medium text-violet-300 transition hover:bg-violet-500/[0.15]"
                >
                  {term.zhLabel}
                  <span className="opacity-50">×</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prompt preview */}
        {fragment ? (
          <div className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/25">
              将追加到 Prompt
            </p>
            <p className="font-mono text-[10px] leading-relaxed text-white/50">{fragment}</p>
          </div>
        ) : null}

        {/* Secondary insert action (modifies source directly) */}
        {canActuallyInsert && fragment ? (
          <div className="mt-3 rounded-lg border border-amber-500/[0.15] bg-amber-500/[0.04] px-3 py-2">
            <p className="mb-1.5 text-[10px] text-amber-400/60">⚠ 以下动作会直接修改当前节点 Prompt，不创建新节点</p>
            <button
              type="button"
              onClick={() => { onInsert(fragment); setSelectedIds([]) }}
              className="rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-1 text-[11px] text-amber-300/70 transition hover:bg-amber-500/[0.12]"
            >
              {insertLabel}
            </button>
          </div>
        ) : null}

        {!canActuallyInsert && (
          <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] text-white/35">
            提示：打开节点对话框后可插入镜头词汇到 Prompt。
          </p>
        )}
      </DirectorToolPanelFrame>
    </div>
  )
}
