'use client'

import { forwardRef } from 'react'

export const CommandSearchInput = forwardRef<HTMLInputElement, {
  value: string
  onChange: (value: string) => void
}>(({ value, onChange }, ref) => (
  <div className="border-b border-white/8 px-4 py-4">
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <span className="text-white/35">⌘</span>
      <input
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="搜索项目、页面入口、待办或提醒..."
        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
      />
      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
        Quick Open
      </span>
    </div>
  </div>
))

CommandSearchInput.displayName = 'CommandSearchInput'
