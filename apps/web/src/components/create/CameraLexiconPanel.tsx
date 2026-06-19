'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { LEXICON_CATEGORIES, buildLexiconFragment } from '@/lib/canvas/camera-lexicon'
import type { LexiconCategory, LexiconTerm } from '@/lib/canvas/camera-lexicon'

interface CameraLexiconPanelProps {
  nodeKind: 'image' | 'video'
  canInsert: boolean
  onInsert: (fragment: string) => void
  onCreateDerived?: (fragment: string) => void
  onClose: () => void
  workflowTargetNodeTitle?: string
}

// ─── term button ──────────────────────────────────────────────────────────────

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
      {term.icon ? (
        <span className="mb-1 text-[18px] leading-none">{term.icon}</span>
      ) : null}
      <span className="text-[12px] font-semibold leading-tight">{term.zhLabel}</span>
      <span className={`text-[10px] leading-tight ${selected ? 'text-violet-300/60' : 'text-white/25'}`}>
        {term.enLabel}
      </span>
    </button>
  )
}

// ─── main panel ───────────────────────────────────────────────────────────────

export function CameraLexiconPanel({
  nodeKind,
  canInsert,
  onInsert,
  onCreateDerived,
  onClose,
  workflowTargetNodeTitle,
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

  const handleInsert = () => {
    if (!fragment || !canActuallyInsert) return
    onInsert(fragment)
    setSelectedIds([])
  }

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] flex max-h-[84vh] w-[320px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/96 shadow-2xl backdrop-blur-xl"
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
            镜头词典
          </p>
          <h2 className="mt-1 text-sm font-semibold text-white/90">Camera Lexicon</h2>
          {isWorkflow ? (
            <p className="mt-0.5 text-[11px] text-sky-300/70">
              正在给下游任务添加镜头语言 →「{workflowTargetNodeTitle}」
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-white/40">
              {nodeKind === 'image' ? '图片节点' : '视频节点'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white/80"
          aria-label="关闭镜头词典"
        >
          <X size={13} />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-white/[0.07] px-3 py-2">
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
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="mb-2 text-[10px] text-white/25">{currentCategory.enTitle}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {filteredTerms.map((term) => (
            <TermButton
              key={term.id}
              term={term}
              selected={selectedIds.includes(term.id)}
              onToggle={toggleTerm}
            />
          ))}
          {filteredTerms.length === 0 && (
            <p className="col-span-2 py-4 text-center text-[11px] text-white/30">
              该分类暂无适用于{nodeKind === 'image' ? '图片' : '视频'}节点的词汇
            </p>
          )}
        </div>

        {/* Selected chips */}
        {selectedTerms.length > 0 && (
          <div className="mt-3 border-t border-white/[0.07] pt-3">
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
        {fragment && (
          <div className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/25">
              将追加到 Prompt
            </p>
            <p className="font-mono text-[10px] leading-relaxed text-white/50">{fragment}</p>
          </div>
        )}

        {!canActuallyInsert && (
          <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] text-white/35">
            提示：打开节点对话框后可插入镜头词汇到 Prompt。
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-white/[0.07] px-4 py-3">
        {onCreateDerived ? (
          <button
            type="button"
            onClick={() => { if (fragment) { onCreateDerived(fragment); onClose() } }}
            disabled={!fragment}
            className="flex-1 rounded-lg border border-violet-500/30 bg-violet-500/[0.1] py-1.5 text-[12px] font-medium text-violet-300 transition hover:bg-violet-500/[0.18] disabled:cursor-not-allowed disabled:opacity-30"
          >
            创建镜头版本
          </button>
        ) : (
          <button
            type="button"
            onClick={handleInsert}
            disabled={!fragment || !canActuallyInsert}
            className="flex-1 rounded-lg border border-violet-500/30 bg-violet-500/[0.1] py-1.5 text-[12px] font-medium text-violet-300 transition hover:bg-violet-500/[0.18] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {insertLabel}
          </button>
        )}
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="rounded-lg border border-white/[0.07] bg-transparent px-3 py-1.5 text-[12px] text-white/40 transition hover:text-white/60"
          >
            清空
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/[0.07] bg-transparent px-3 py-1.5 text-[12px] text-white/40 transition hover:text-white/60"
        >
          关闭
        </button>
      </div>
    </div>
  )
}
