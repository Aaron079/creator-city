// Server-only: reads process.env via env.ts. Do not import from client components.
import { getAllToolProviders, getToolProviderById } from '@/lib/tools/provider-catalog'
import { checkEnvKeys } from '@/lib/providers/env'
import { getGatewayProvider } from '@/lib/providers/catalog'
import { getAdapter } from '@/lib/providers/registry'
import type { ToolProviderStatus } from '@/lib/tools/provider-catalog'

export interface ResolvedProviderStatus {
  id: string
  displayName: string
  category: string
  status: ToolProviderStatus
  configured: boolean
  missingEnvKeys: string[]
  canTest: boolean
  setupHint: string
}

export function resolveProviderStatus(providerId: string): ResolvedProviderStatus {
  const toolProvider = getToolProviderById(providerId)
  const gatewayEntry = getGatewayProvider(providerId)

  const displayName = toolProvider?.name ?? providerId
  const category = toolProvider?.category ?? 'unknown'

  if (!gatewayEntry) {
    return {
      id: providerId,
      displayName,
      category,
      status: toolProvider?.status ?? 'coming-soon',
      configured: false,
      missingEnvKeys: toolProvider?.envKeys ?? [],
      canTest: false,
      setupHint: 'No gateway adapter implemented for this provider yet.',
    }
  }

  const adapter = getAdapter(gatewayEntry.adapterId)
  if (!adapter) {
    return {
      id: providerId,
      displayName,
      category,
      status: 'coming-soon',
      configured: false,
      missingEnvKeys: gatewayEntry.envKeys,
      canTest: false,
      setupHint: gatewayEntry.setupHint,
    }
  }

  const envCheck = checkEnvKeys(gatewayEntry.envKeys)

  return {
    id: providerId,
    displayName,
    category,
    status: envCheck.configured ? 'available' : 'not-configured',
    configured: envCheck.configured,
    missingEnvKeys: envCheck.missing,
    canTest: envCheck.configured && gatewayEntry.canTest,
    setupHint: gatewayEntry.setupHint,
  }
}

export function resolveAllProviderStatuses(): ResolvedProviderStatus[] {
  return getAllToolProviders().map((provider) => resolveProviderStatus(provider.id))
}

export interface ProviderStatusSummary {
  total: number
  available: number
  notConfigured: number
  mock: number
  bridgeOnly: number
  comingSoon: number
  error: number
}

export function buildStatusSummary(statuses: ResolvedProviderStatus[]): ProviderStatusSummary {
  return statuses.reduce<ProviderStatusSummary>(
    (acc, s) => {
      acc.total++
      if (s.status === 'available') acc.available++
      else if (s.status === 'not-configured') acc.notConfigured++
      else if (s.status === 'mock') acc.mock++
      else if (s.status === 'bridge-only') acc.bridgeOnly++
      else if (s.status === 'coming-soon') acc.comingSoon++
      else if (s.status === 'error') acc.error++
      return acc
    },
    { total: 0, available: 0, notConfigured: 0, mock: 0, bridgeOnly: 0, comingSoon: 0, error: 0 },
  )
}
