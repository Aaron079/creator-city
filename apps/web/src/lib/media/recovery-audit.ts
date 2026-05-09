import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'

export type MediaRecoveryAuditNode = {
  id?: string
  kind?: string
  title?: string
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  metadataJson?: unknown
}

export type MediaRecoveryAudit = {
  hasStableAsset: boolean
  hasProviderUrl: boolean
  proxyReachable: boolean
  assetReachable: boolean
  likelyRecoverable: boolean
  diagnosis: string
  stableAssetUrl?: string
  providerUrl?: string
  currentUrl?: string
  currentReachable?: boolean
  providerReachable?: boolean
  proxyStatus?: number
  assetStatus?: number
  providerStatus?: number
}

type MediaKind = 'image' | 'video'

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function getMediaKind(node: MediaRecoveryAuditNode, preferredKind?: MediaKind): MediaKind {
  if (preferredKind) return preferredKind
  return node.kind === 'video' ? 'video' : 'image'
}

function getCurrentMediaUrl(node: MediaRecoveryAuditNode, kind: MediaKind) {
  return kind === 'video'
    ? stringValue(node.resultVideoUrl)
    : stringValue(node.resultImageUrl)
}

function getProviderUrl(metadata: Record<string, unknown>, kind: MediaKind, currentUrl: string) {
  const providerSpecific = kind === 'video'
    ? stringValue(metadata.originalProviderVideoUrl)
    : stringValue(metadata.originalProviderImageUrl)
  return providerSpecific
    || stringValue(metadata.originalProviderUrl)
    || stringValue(metadata.providerUrl)
    || stringValue(metadata.sourceProviderUrl)
    || currentUrl
}

async function diagnoseUrl(url: string) {
  if (!url) return { reachable: false, status: 0 }
  if (url.startsWith('data:')) return { reachable: true, status: 200 }
  if (!isHttpUrl(url)) return { reachable: false, status: 0 }
  try {
    const response = await fetch('/api/media/diagnose', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await response.json().catch(() => ({})) as { reachable?: unknown; status?: unknown }
    const status = typeof data.status === 'number' ? data.status : response.status
    return {
      reachable: response.ok && data.reachable === true,
      status,
    }
  } catch {
    return { reachable: false, status: 0 }
  }
}

async function checkProxy(url: string) {
  if (!url) return { reachable: false, status: 0 }
  if (url.startsWith('data:')) return { reachable: true, status: 200 }
  if (!isHttpUrl(url)) return { reachable: false, status: 0 }
  try {
    const response = await fetch(getProxiedMediaUrl(url), {
      method: 'GET',
      cache: 'no-store',
      headers: { Range: 'bytes=0-1' },
    })
    return {
      reachable: (response.ok || response.status === 206),
      status: response.status,
    }
  } catch {
    return { reachable: false, status: 0 }
  }
}

export async function auditNodeMedia(
  node: MediaRecoveryAuditNode,
  preferredKind?: MediaKind,
): Promise<MediaRecoveryAudit> {
  const kind = getMediaKind(node, preferredKind)
  const metadata = recordValue(node.metadataJson)
  const stableAssetUrl = stringValue(metadata.assetUrl)
  const currentUrl = getCurrentMediaUrl(node, kind)
  const providerUrl = getProviderUrl(metadata, kind, currentUrl)

  const [currentProxy, assetDiagnostic, providerDiagnostic] = await Promise.all([
    checkProxy(currentUrl),
    stableAssetUrl ? diagnoseUrl(stableAssetUrl) : Promise.resolve({ reachable: false, status: 0 }),
    providerUrl ? diagnoseUrl(providerUrl) : Promise.resolve({ reachable: false, status: 0 }),
  ])

  const hasStableAsset = Boolean(stableAssetUrl)
  const hasProviderUrl = Boolean(providerUrl)
  const assetReachable = hasStableAsset && assetDiagnostic.reachable
  const proxyReachable = currentProxy.reachable
  const providerReachable = hasProviderUrl && providerDiagnostic.reachable
  const likelyRecoverable = assetReachable || proxyReachable || providerReachable
  const diagnosis = assetReachable
    ? 'Stable asset is reachable and can be used for display.'
    : providerReachable
      ? 'Provider URL is still reachable and can be resynced into a stable asset.'
      : proxyReachable
        ? 'Current media URL is reachable through the media proxy.'
        : hasStableAsset || hasProviderUrl
          ? 'Media URLs are present, but proxy/provider checks failed.'
          : 'No stable asset or provider URL is recorded for this node.'

  return {
    hasStableAsset,
    hasProviderUrl,
    proxyReachable,
    assetReachable,
    likelyRecoverable,
    diagnosis,
    stableAssetUrl: stableAssetUrl || undefined,
    providerUrl: providerUrl || undefined,
    currentUrl: currentUrl || undefined,
    currentReachable: proxyReachable,
    providerReachable,
    proxyStatus: currentProxy.status,
    assetStatus: assetDiagnostic.status,
    providerStatus: providerDiagnostic.status,
  }
}
