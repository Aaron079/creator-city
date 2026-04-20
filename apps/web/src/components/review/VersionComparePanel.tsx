'use client'

import type { VersionCompareResult } from '@/store/version-history.store'

export function VersionComparePanel({
  compare,
  fromLabel,
  toLabel,
  onClose,
}: {
  compare: VersionCompareResult
  fromLabel: string
  toLabel: string
  onClose: () => void
}) {
  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: 'rgba(4,10,18,0.78)', border: '1px solid rgba(99,102,241,0.16)', boxShadow: '0 18px 44px rgba(0,0,0,0.22)' }}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-[12px] font-semibold text-white/84">版本差异</p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>
            {fromLabel} vs {toLabel}
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-xl text-[10px] font-semibold"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
        >
          关闭
        </button>
      </div>

      <div className="grid gap-2">
        {compare.changes.length === 0 && (
          <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.52)' }}>当前没有可显示的关键字段差异。</p>
          </div>
        )}

        {compare.changes.map((change) => (
          <div
            key={change.field}
            className="grid grid-cols-1 md:grid-cols-[120px_1fr_1fr] gap-2 rounded-xl px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div>
              <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.24)' }}>{change.field}</p>
            </div>
            <div>
              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.22)' }}>{fromLabel}</p>
              <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: 'rgba(255,255,255,0.56)' }}>{stringifyValue(change.before)}</p>
            </div>
            <div>
              <p className="text-[9px]" style={{ color: 'rgba(167,243,208,0.7)' }}>{toLabel}</p>
              <p className="text-[10px] mt-1 leading-[1.6]" style={{ color: '#a7f3d0' }}>{stringifyValue(change.after)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function stringifyValue(value: unknown) {
  if (value == null) return '未设置'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}
