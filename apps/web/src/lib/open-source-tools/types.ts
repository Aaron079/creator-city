export type OpenSourceToolStatus = 'enabled' | 'disabled' | 'misconfigured' | 'error'

export type OpenSourceToolRisk =
  | 'safe'
  | 'license_review'
  | 'service_isolation_required'
  | 'reference_only'

export type OpenSourceToolTier = 'P0' | 'P1' | 'P2' | 'deferred'

export type OpenSourceToolCategory =
  | 'storage'
  | 'queue'
  | 'canvas'
  | 'ai'
  | 'collaboration'
  | 'media'
  | 'integration'
  | 'protocol'

export type OpenSourceToolLicense =
  | 'MIT'
  | 'Apache-2.0'
  | 'BSD-3-Clause'
  | 'GPL-3.0'
  | 'AGPL-3.0'
  | 'MPL-2.0'
  | 'LGPL-3.0'
  | 'BSL-1.1'
  | 'fair-code'
  | 'proprietary'
  | 'custom'

export type OpenSourceToolHealth = {
  toolId: string
  status: OpenSourceToolStatus
  latencyMs?: number
  message?: string
  checkedAt: string
}

export type OpenSourceToolDefinition = {
  id: string
  name: string
  tier: OpenSourceToolTier
  category: OpenSourceToolCategory
  description: string
  license: OpenSourceToolLicense
  risk: OpenSourceToolRisk
  featureFlag: string
  envKeys: string[]
  productSurface: string[]
  userVisibleCapability: string
  stars?: number
  homepage?: string
  notes?: string
}
