'use client'

import { useMemo, useState } from 'react'
import { getAdaptersByPanel } from '@/lib/adapters/registry'
import { mapStoryboardToBoordsExport } from '@/lib/tools/mappers'
import type { StoryboardPrevis } from '@/store/shots.store'

type StoryboardAdapterOption = 'native' | 'boords'

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function StoryboardAdapterPanel({
  storyboardPrevis,
}: {
  storyboardPrevis: StoryboardPrevis | null
}) {
  const adapters = useMemo(() => getAdaptersByPanel('storyboard-previs'), [])
  const [adapter, setAdapter] = useState<StoryboardAdapterOption>('native')

  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold text-white/82">外部工具 / Adapter</p>
          <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.36)' }}>
            当前只做 storyboard export/import bridge，不会替你自动同步到外部服务。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={adapter}
            onChange={(event) => setAdapter(event.target.value as StoryboardAdapterOption)}
            className="rounded-xl px-3 py-2 text-[10px] outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.76)' }}
          >
            <option value="native">native</option>
            <option value="boords">boords</option>
          </select>
          <button
            type="button"
            onClick={() => {
              if (adapter !== 'boords') return
              downloadJson('creator-city-boords-export.json', mapStoryboardToBoordsExport(storyboardPrevis))
            }}
            disabled={adapter !== 'boords'}
            className="rounded-xl px-3 py-2 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
          >
            导出 Storyboard
          </button>
          <button
            type="button"
            disabled
            className="rounded-xl px-3 py-2 text-[10px] font-semibold opacity-40"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
          >
            导入入口预留
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

