'use client'

import { useEffect, useState } from 'react'
import type { ToolProviderStatus } from '@/lib/tools/provider-catalog'

interface ProviderStatusPayload {
  id?: string
  providerId?: string
  status?: string
}

function normalizeProviderId(providerId: string) {
  if (providerId === 'gpt-5') return 'openai-text'
  if (providerId === 'openai-gpt-images' || providerId === 'openai-images' || providerId === 'openai-image2') return 'openai-image'
  if (providerId === 'openai-text-script') return 'openai-text'
  return providerId
}

export function useProviderLiveStatus(): { statusMap: Map<string, ToolProviderStatus>; isLoading: boolean } {
  const [statusMap, setStatusMap] = useState<Map<string, ToolProviderStatus>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/providers/status')
      .then((res) => res.json())
      .then((data: { providers?: ProviderStatusPayload[] } | ProviderStatusPayload[]) => {
        const providers = Array.isArray(data) ? data : data.providers
        if (!Array.isArray(providers)) return
        const map = new Map<string, ToolProviderStatus>()
        for (const provider of providers) {
          const rawKey = provider.id ?? provider.providerId
          if (!rawKey || !provider.status) continue
          const key = normalizeProviderId(rawKey)
          map.set(key, provider.status as ToolProviderStatus)
          if (key !== rawKey) {
            map.set(rawKey, provider.status as ToolProviderStatus)
          }
        }
        setStatusMap(map)
      })
      .catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[provider-live-status] failed to load provider statuses', error)
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  return { statusMap, isLoading }
}
