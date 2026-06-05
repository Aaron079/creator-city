'use client'

import { useState, useCallback } from 'react'
import { CINEMATIC_GROUPS, buildCinematicFragment } from '@/lib/canvas/cinematic-controls'

interface Props {
  prompt: string
  onPromptChange: (value: string) => void
  nodeKind: 'image' | 'video'
}

export function CinematicControlsPanel({ prompt, onPromptChange, nodeKind: _nodeKind }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Record<string, string>>({})

  const fragment = buildCinematicFragment(selected)
  const hasSelection = Object.keys(selected).length > 0

  const handlePillClick = useCallback((groupKey: string, optionId: string, promptHint: string) => {
    setSelected((prev) => {
      if (prev[groupKey] === promptHint) {
        const next = { ...prev }
        delete next[groupKey]
        return next
      }
      return { ...prev, [groupKey]: promptHint }
    })
  }, [])

  const handleApply = useCallback(() => {
    if (!fragment) return
    const trimmed = prompt.trim()
    onPromptChange(trimmed ? `${trimmed} ${fragment}` : fragment)
    setSelected({})
    setOpen(false)
  }, [fragment, prompt, onPromptChange])

  const handleClear = useCallback(() => {
    setSelected({})
  }, [])

  return (
    <div className="border-t border-white/[0.06] px-4 pb-3 pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-white/35 hover:text-white/60 transition-colors"
      >
        <span>专业镜头参数</span>
        <span className="text-[10px] font-normal normal-case tracking-normal text-white/25">
          {open ? '收起 ▲' : '展开 ▼'}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {CINEMATIC_GROUPS.map((group) => (
            <div key={group.key}>
              <p className="mb-1 text-[10px] font-medium text-white/30">{group.zhTitle}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((opt) => {
                  const isActive = selected[group.key] === opt.promptHint
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handlePillClick(group.key, opt.id, opt.promptHint)}
                      className={`rounded-full px-2.5 py-1 text-[11px] transition border ${
                        isActive
                          ? 'border-violet-500/50 bg-violet-500/[0.15] text-violet-200'
                          : 'border-white/[0.08] bg-white/[0.03] text-white/45 hover:text-white/70 hover:border-white/20'
                      }`}
                    >
                      {opt.zhLabel}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {hasSelection && (
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2">
              <p className="text-[10px] text-white/30 mb-1">将追加到提示词：</p>
              <p className="text-[11px] text-white/60 leading-relaxed">{fragment}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleApply}
              disabled={!hasSelection}
              className="flex-1 rounded-lg py-1.5 text-[12px] font-medium transition border border-violet-500/40 bg-violet-500/[0.1] text-violet-200 hover:bg-violet-500/[0.18] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              加入到提示词
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!hasSelection}
              className="rounded-lg px-3 py-1.5 text-[12px] transition border border-white/[0.08] bg-transparent text-white/40 hover:text-white/60 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              清空参数
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
