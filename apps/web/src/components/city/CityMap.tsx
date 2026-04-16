'use client'

import { useEffect } from 'react'
import { useCityStore } from '@/store/city.store'
import type { CityBase } from '@/store/city.store'
import { apiClient } from '@/lib/api-client'

export function CityMap() {
  const { cityMap, setCityMap, selectedBaseId, selectBase } = useCityStore()

  useEffect(() => {
    apiClient.get<CityBase[]>('/city/map').then(setCityMap).catch(console.error)
  }, [setCityMap])

  return (
    <div className="city-card min-h-[600px] relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 bg-city-grid bg-city-grid opacity-30 pointer-events-none" />

      {/* City bases rendered as positioned dots */}
      <div className="relative w-full h-[560px]">
        {cityMap.map((base) => (
          <button
            key={base.id}
            onClick={() => selectBase(base.id === selectedBaseId ? null : base.id)}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 group transition-all duration-200 ${
              selectedBaseId === base.id ? 'z-10' : 'z-0'
            }`}
            style={{
              left: `${((base.positionX + 500) / 1000) * 100}%`,
              top: `${((base.positionY + 500) / 1000) * 100}%`,
            }}
          >
            <div
              className={`w-10 h-10 rounded-xl bg-city-surface border-2 flex items-center justify-center text-lg transition-all duration-200 ${
                selectedBaseId === base.id
                  ? 'border-city-accent glow scale-125'
                  : 'border-city-border hover:border-city-accent/50 hover:scale-110'
              }`}
            >
              🏙️
            </div>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              <div className="bg-city-surface border border-city-border rounded-lg px-3 py-2 text-xs">
                <div className="font-semibold">{base.name}</div>
                <div className="text-gray-400">{base.owner?.displayName}</div>
                <div className="text-city-gold">⭐ {base.reputation}</div>
              </div>
            </div>
          </button>
        ))}

        {cityMap.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-2">🌆</div>
              <p>No bases in this zone yet.</p>
            </div>
          </div>
        )}
      </div>

      {/* Selected base details */}
      {selectedBaseId && (() => {
        const base = cityMap.find((b) => b.id === selectedBaseId)
        if (!base) return null
        return (
          <div className="absolute bottom-4 right-4 bg-city-surface border border-city-border rounded-xl p-4 w-64 animate-slide-up">
            <h3 className="font-semibold mb-1">{base.name}</h3>
            <p className="text-sm text-gray-400 mb-2">@{base.owner?.username}</p>
            <div className="text-sm text-city-gold">⭐ {base.reputation} reputation</div>
            <div className="text-sm text-gray-400 mt-1">
              {base.buildings.length} building{base.buildings.length !== 1 ? 's' : ''}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
