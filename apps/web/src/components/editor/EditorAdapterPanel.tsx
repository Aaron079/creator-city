'use client'

import { useMemo, useState } from 'react'
import { getAdaptersByPanel } from '@/lib/adapters/registry'
import { mapEditorTimelineToOTIO } from '@/lib/tools/mappers'
import type { EditorTimeline } from '@/store/shots.store'

type EditorAdapterOption = 'native' | 'otio' | 'davinci-resolve-bridge'

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function EditorAdapterPanel({
  timeline,
}: {
  timeline: EditorTimeline
}) {
  const adapters = useMemo(() => getAdaptersByPanel('editor-desk'), [])
  const [adapter, setAdapter] = useState<EditorAdapterOption>('native')

  const helperText = adapter === 'native'
    ? '使用 Creator City 原生剪辑输出。'
    : adapter === 'otio'
      ? '导出 OTIO-like JSON，方便与外部时间线工具桥接。'
      : 'DaVinci Resolve 目前仅提供 bridge metadata，不直接执行外部脚本。'

  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold text-white/82">外部工具 / Adapter</p>
          <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.36)' }}>{helperText}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={adapter}
            onChange={(event) => setAdapter(event.target.value as EditorAdapterOption)}
            className="rounded-xl px-3 py-2 text-[10px] outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.76)' }}
          >
            <option value="native">native</option>
            <option value="otio">otio</option>
            <option value="davinci-resolve-bridge">davinci-bridge</option>
          </select>
          <button
            type="button"
            onClick={() => {
              if (adapter === 'native') return
              if (adapter === 'otio') {
                downloadJson('creator-city-timeline.otio.json', mapEditorTimelineToOTIO(timeline))
                return
              }
              downloadJson('creator-city-resolve-bridge.json', {
                provider: 'davinci-resolve-bridge',
                bridgeMode: 'timeline-export',
                timelineId: timeline.id,
                clipCount: timeline.clips.length,
                status: timeline.status,
              })
            }}
            disabled={adapter === 'native'}
            className="rounded-xl px-3 py-2 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
          >
            导出 Adapter 包
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {adapters.map((item) => (
          <span
            key={item.id}
            className="px-2 py-1 rounded-lg text-[9px]"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.56)' }}
          >
            {item.name} · {item.status}
          </span>
        ))}
      </div>
    </div>
  )
}

