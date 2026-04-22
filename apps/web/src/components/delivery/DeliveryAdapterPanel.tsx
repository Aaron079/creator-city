'use client'

import { useMemo, useState } from 'react'
import { getAdaptersByPanel } from '@/lib/adapters/registry'
import { mapDeliveryPackageToResolveBridgeExport } from '@/lib/tools/mappers'
import type { DeliveryPackage } from '@/store/delivery-package.store'

type DeliveryAdapterOption = 'native' | 'otio' | 'davinci-resolve-bridge'

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function DeliveryAdapterPanel({
  deliveryPackage,
}: {
  deliveryPackage: DeliveryPackage | null
}) {
  const adapters = useMemo(() => getAdaptersByPanel('delivery'), [])
  const [adapter, setAdapter] = useState<DeliveryAdapterOption>('native')

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">外部交付 Adapter</h3>
          <p className="mt-1 text-sm text-white/55">
            Delivery 中的外部工具只作为 adapter / bridge。是否导出由你决定，不会自动替你提交或同步。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={adapter}
            onChange={(event) => setAdapter(event.target.value as DeliveryAdapterOption)}
            className="rounded-xl px-3 py-2 text-[11px] outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.76)' }}
          >
            <option value="native">native</option>
            <option value="otio">otio</option>
            <option value="davinci-resolve-bridge">davinci-bridge</option>
          </select>
          <button
            type="button"
            disabled={!deliveryPackage || adapter === 'native'}
            onClick={() => {
              if (!deliveryPackage) return
              if (adapter === 'davinci-resolve-bridge') {
                downloadJson('creator-city-delivery-resolve-bridge.json', mapDeliveryPackageToResolveBridgeExport(deliveryPackage))
                return
              }
              downloadJson('creator-city-delivery-otio-bridge.json', {
                provider: 'otio',
                exportType: 'delivery-timeline-bridge',
                packageId: deliveryPackage.id,
                includedAssetCount: deliveryPackage.assets.filter((asset) => asset.included).length,
                manifest: deliveryPackage.manifest,
              })
            }}
            className="rounded-xl px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe' }}
          >
            导出桥接包
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
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

