'use client'

import { useEffect, useState } from 'react'
import type { ToolProviderStatus } from '@/lib/tools/provider-catalog'

export function useProviderLiveStatus(): Map<string, ToolProviderStatus> {
  const [statusMap, setStatusMap] = useState<Map<string, ToolProviderStatus>>(new Map())

  useEffect(() => {
    fetch('/api/providers/status')
      .then((res) => res.json())
      .then((data: { providers?: Array<{ id: string; status: string }> }) => {
        if (!Array.isArray(data.providers)) return
        const map = new Map<string, ToolProviderStatus>()
        for (const p of data.providers) {
          map.set(p.id, p.status as ToolProviderStatus)
        }
        setStatusMap(map)
      })
      .catch(() => { /* silently fall back to static catalog values */ })
  }, [])

  return statusMap
}
